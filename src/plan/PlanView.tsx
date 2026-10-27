import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { darken, lighten } from '../colors';
import { DEFS, fullParams, getBuild, matColor, mountOf } from '../furniture/catalog';
import { projectBuild, type Shape2 } from '../furniture/project';
import { add, bboxOf, centroid, dist, dot, mul, snapTo, sub, vec } from '../geometry/math';
import { analyze, clearances, poseOf, toPlan, type Issue } from '../geometry/placement';
import { getWalls, outerPolygon, roomArea, setWallLength } from '../geometry/room';
import { useStore } from '../store';
import type { Item, Room, Vec2 } from '../types';
import { PlanToolbar } from './PlanToolbar';

interface VT { s: number; tx: number; ty: number }

type Drag =
  | { k: 'pan'; sx: number; sy: number; tx: number; ty: number; moved: boolean }
  | { k: 'item'; id: string; off: Vec2; sx: number; sy: number; started: boolean }
  | { k: 'rotate'; id: string; started: boolean }
  | { k: 'corner'; i: number; started: boolean }
  | { k: 'wall'; i: number; start: Vec2; pts: Vec2[]; started: boolean }
  | { k: 'underlay'; start: Vec2; ux: number; uy: number };

const NS = { vectorEffect: 'non-scaling-stroke' as const };

function ShapeEl({ s, fill, stroke, sw = 1, opacity, dash }: { s: Shape2; fill: string; stroke: string; sw?: number; opacity?: number; dash?: string }) {
  const common = { fill, stroke, strokeWidth: sw, ...NS, opacity, strokeDasharray: dash };
  if (s.t === 'rect') {
    const r = Math.min(s.r, s.w / 2, s.h / 2);
    return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={r || undefined} {...common} />;
  }
  if (s.t === 'ellipse') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
  return <polygon points={s.pts.map((p) => p.join(',')).join(' ')} {...common} />;
}

function shapeFill(mat: string, p: Record<string, any>) {
  if (mat === 'glass' || mat === 'water') return { fill: '#d6ecf7', stroke: '#7aa9c4', opacity: 0.7 };
  const c = matColor(mat, p);
  return { fill: lighten(c, 0.18), stroke: darken(c, 0.5), opacity: 1 };
}

function PlanItem({ item, room, issue, selected, interactive, onDown }: {
  item: Item; room: Room; issue?: Issue; selected: boolean; interactive: boolean;
  onDown: (e: RPointerEvent, item: Item) => void;
}) {
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  const p = fullParams(item);
  const opening = mountOf(item) === 'opening';
  const T = room.wallThickness;
  const { min, max } = b.bounds;
  const tone = issue?.level === 'error' ? 'err' : issue?.level === 'warn' ? 'warn' : '';
  return (
    <g transform={`translate(${pose.x} ${pose.y}) rotate(${pose.rot})`} className={`pitem ${opening ? 'opening' : ''} ${tone} ${selected ? 'sel' : ''}`} style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
      {opening ? (
        <>
          <rect x={b.cut![0]} y={-T - 1} width={b.cut![1] - b.cut![0]} height={T + 2} fill="#fbfcfd" stroke="none" />
          {b.symbol.map((sy, i) => (
            <path key={i} d={sy.d} fill="none" stroke={tone === 'err' ? '#e5484d' : '#3a4350'} strokeWidth={sy.dashed ? 1 : 1.6} strokeDasharray={sy.dashed ? '4 3' : undefined} {...NS} />
          ))}
        </>
      ) : (
        projectBuild(b, 'top').map((s, i) => {
          if (mountOf(item) === 'ceiling') return <ShapeEl key={i} s={s} fill="none" stroke="#5b6570" sw={1} dash="5 4" />;
          const f = shapeFill(s.mat, p);
          return <ShapeEl key={i} s={s} fill={f.fill} stroke={f.stroke} sw={0.8} opacity={f.opacity} />;
        })
      )}
      {tone && !opening && <rect x={min[0]} y={min[2]} width={max[0] - min[0]} height={max[2] - min[2]} className={`issue-box ${tone}`} {...NS} />}
      <rect
        x={opening ? b.cut![0] : min[0]}
        y={opening ? -T - 40 : min[2]}
        width={opening ? b.cut![1] - b.cut![0] : max[0] - min[0]}
        height={opening ? T + 80 : max[2] - min[2]}
        fill="transparent"
        className="hit"
        onPointerDown={(e) => onDown(e, item)}
      />
    </g>
  );
}

export function PlanView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [vt, setVt] = useState<VT | null>(null);
  const vtRef = useRef<VT | null>(vt);
  vtRef.current = vt;
  const drag = useRef<Drag | null>(null);

  const doc = useStore((s) => s.doc);
  const selectedId = useStore((s) => s.selectedId);
  const tool = useStore((s) => s.planTool);
  const grid = useStore((s) => s.grid);
  const showDims = useStore((s) => s.showDims);
  const underlay = useStore((s) => s.underlay);
  const dragging = useStore((s) => s.dragging);
  const fitNonce = useStore((s) => s.fitNonce);
  const room = doc.room;
  const walls = getWalls(room);
  const outer = outerPolygon(room);
  const issues = analyze(doc);

  const [drawPts, setDrawPts] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [typed, setTyped] = useState('');
  const [calPts, setCalPts] = useState<Vec2[]>([]);
  const [calInput, setCalInput] = useState<string | null>(null);
  const [editWall, setEditWall] = useState<{ i: number; x: number; y: number; value: string } | null>(null);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (size.w < 50) return;
    const pts = [...outerPolygon(useStore.getState().doc.room)];
    const bb = bboxOf(pts);
    const pad = 1400;
    const s = Math.min((size.w - 40) / (bb.w + pad), (size.h - 90) / (bb.h + pad));
    setVt({ s, tx: size.w / 2 - (bb.minX + bb.w / 2) * s, ty: size.h / 2 + 20 - (bb.minY + bb.h / 2) * s });
  }, [size.w, size.h]);

  // first layout: fit; later resizes: keep the same model point in the middle
  const prevSize = useRef(size);
  useEffect(() => {
    const prev = prevSize.current;
    prevSize.current = size;
    if (!vt) {
      if (size.w > 50) fit();
      return;
    }
    if (prev.w && (prev.w !== size.w || prev.h !== size.h)) setVt({ ...vt, tx: vt.tx + (size.w - prev.w) / 2, ty: vt.ty + (size.h - prev.h) / 2 });
  }, [size]);
  useEffect(() => {
    if (fitNonce) fit();
  }, [fitNonce]);

  // reset transient tool state when switching tools
  useEffect(() => {
    setDrawPts([]);
    setTyped('');
    setCalPts([]);
    setCalInput(null);
    setEditWall(null);
  }, [tool]);

  // wheel zoom (non-passive so we can prevent page scroll)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = vtRef.current;
      if (!v) return;
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const s = Math.min(3, Math.max(0.01, v.s * k));
      const f = s / v.s;
      setVt({ s, tx: mx - (mx - v.tx) * f, ty: my - (my - v.ty) * f });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size.w > 0]);

  const toModel = (cx: number, cy: number): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = vtRef.current!;
    return vec((cx - r.left - v.tx) / v.s, (cy - r.top - v.ty) / v.s);
  };

  const capture = (e: RPointerEvent) => svgRef.current?.setPointerCapture(e.pointerId);

  const drawSnap = (m: Vec2, free: boolean): Vec2 => {
    const g = Math.max(grid, 1);
    let p = vec(snapTo(m.x, g), snapTo(m.y, g));
    const last = drawPts[drawPts.length - 1];
    if (last && !free) {
      if (Math.abs(p.x - last.x) > Math.abs(p.y - last.y)) p = vec(p.x, last.y);
      else p = vec(last.x, p.y);
    }
    const first = drawPts[0];
    const s = vtRef.current?.s ?? 1;
    if (first && drawPts.length >= 2) {
      if (Math.abs(p.x - first.x) < 10 / s) p = vec(first.x, p.y);
      if (Math.abs(p.y - first.y) < 10 / s) p = vec(p.x, first.y);
    }
    return p;
  };

  const finishDraw = (pts: Vec2[]) => {
    if (pts.length < 3) return;
    useStore.getState().setRoomPoints(pts);
    useStore.getState().set({ planTool: 'select' });
    setTimeout(() => useStore.setState((s) => ({ fitNonce: s.fitNonce + 1 })), 0);
  };

  // draw-tool keyboard: type a length, Enter to place / close, Esc to cancel
  useEffect(() => {
    if (tool !== 'draw') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (/^[0-9.]$/.test(e.key)) {
        setTyped((t) => t + e.key);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        if (typed) setTyped((t) => t.slice(0, -1));
        else setDrawPts((p) => p.slice(0, -1));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const last = drawPts[drawPts.length - 1];
        const L = parseFloat(typed);
        if (last && L > 0 && cursor) {
          const c = drawSnap(cursor, e.altKey);
          const d = sub(c, last);
          const l = Math.hypot(d.x, d.y);
          const dir = l > 0 ? mul(d, 1 / l) : vec(1, 0);
          setDrawPts([...drawPts, add(last, mul(dir, L))]);
          setTyped('');
        } else finishDraw(drawPts);
      } else if (e.key === 'Escape') {
        if (drawPts.length) setDrawPts([]);
        else useStore.getState().set({ planTool: 'select' });
        setTyped('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, drawPts, typed, cursor, grid]);

  const onBgDown = (e: RPointerEvent) => {
    if (!vt) return;
    if (e.button === 1 || e.button === 2 || tool === 'select' || tool === 'walls') {
      if (e.button === 2) return;
      capture(e);
      drag.current = { k: 'pan', sx: e.clientX, sy: e.clientY, tx: vt.tx, ty: vt.ty, moved: false };
      return;
    }
    if (e.button !== 0) return;
    const m = toModel(e.clientX, e.clientY);
    if (tool === 'draw') {
      const s = vt.s;
      // closing is checked against the raw pointer: 90° snapping could pull it off the first corner
      if (drawPts.length >= 3 && dist(m, drawPts[0]) < 14 / s) return finishDraw(drawPts);
      const p = drawSnap(m, e.altKey);
      if (drawPts.length && dist(p, drawPts[drawPts.length - 1]) < 1) return;
      setDrawPts([...drawPts, p]);
      setTyped('');
    } else if (tool === 'calibrate') {
      const pts = [...calPts, m].slice(-2);
      setCalPts(pts);
      if (pts.length === 2) setCalInput('');
    } else if (tool === 'underlay' && underlay) {
      capture(e);
      drag.current = { k: 'underlay', start: m, ux: underlay.x, uy: underlay.y };
    }
  };

  const onItemDown = (e: RPointerEvent, item: Item) => {
    if (e.button !== 0 || tool !== 'select') return;
    e.stopPropagation();
    capture(e);
    const st = useStore.getState();
    st.select(item.id);
    const m = toModel(e.clientX, e.clientY);
    const pose = poseOf(item, room);
    drag.current = { k: 'item', id: item.id, off: sub(vec(pose.x, pose.y), m), sx: e.clientX, sy: e.clientY, started: false };
  };

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    const m = vt ? toModel(e.clientX, e.clientY) : null;
    if (tool === 'draw' && m) setCursor(m);
    if (!d || !m) return;
    const st = useStore.getState();
    switch (d.k) {
      case 'pan':
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 2) d.moved = true;
        setVt((v) => v && { ...v, tx: d.tx + e.clientX - d.sx, ty: d.ty + e.clientY - d.sy });
        break;
      case 'item':
        if (!d.started) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
          d.started = true;
          st.beginDrag(d.id);
        }
        st.moveItem(d.id, m.x + d.off.x, m.y + d.off.y, e.altKey);
        break;
      case 'rotate': {
        const it = st.doc.items.find((i) => i.id === d.id);
        if (!it) return;
        if (!d.started) {
          d.started = true;
          st.checkpoint();
        }
        const v = sub(m, vec(it.x, it.y));
        let deg = (Math.atan2(-v.x, v.y) * 180) / Math.PI;
        deg = e.shiftKey ? Math.round(deg) : snapTo(deg, 15);
        st.rotateLive(d.id, deg);
        break;
      }
      case 'corner': {
        if (!d.started) {
          d.started = true;
          st.checkpoint();
        }
        const pts = st.doc.room.points.slice();
        const n = pts.length;
        let p = e.altKey ? m : vec(snapTo(m.x, Math.max(grid, 1)), snapTo(m.y, Math.max(grid, 1)));
        const tol = 10 / (vt?.s ?? 1);
        for (const q of [pts[(d.i - 1 + n) % n], pts[(d.i + 1) % n]]) {
          if (Math.abs(p.x - q.x) < tol) p = vec(q.x, p.y);
          if (Math.abs(p.y - q.y) < tol) p = vec(p.x, q.y);
        }
        pts[d.i] = p;
        st.setRoomPoints(pts, false);
        break;
      }
      case 'wall': {
        if (!d.started) {
          d.started = true;
          st.checkpoint();
        }
        const w = getWalls({ ...room, points: d.pts })[d.i];
        let off = dot(sub(m, d.start), w.n);
        if (!e.altKey) off = snapTo(off, Math.max(grid, 1));
        const pts = d.pts.slice();
        const n = pts.length;
        pts[d.i] = add(pts[d.i], mul(w.n, off));
        pts[(d.i + 1) % n] = add(pts[(d.i + 1) % n], mul(w.n, off));
        st.setRoomPoints(pts, false);
        break;
      }
      case 'underlay':
        if (st.underlay) st.set({ underlay: { ...st.underlay, x: d.ux + m.x - d.start.x, y: d.uy + m.y - d.start.y } });
        break;
    }
  };

  const onUp = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    const st = useStore.getState();
    if (d.k === 'item' && d.started) st.endDrag();
    if (d.k === 'pan' && !d.moved && tool === 'select') st.select(null);
  };

  const startRotate = (e: RPointerEvent, id: string) => {
    e.stopPropagation();
    capture(e);
    drag.current = { k: 'rotate', id, started: false };
  };

  const startCorner = (e: RPointerEvent, i: number) => {
    e.stopPropagation();
    capture(e);
    drag.current = { k: 'corner', i, started: false };
  };

  const startWall = (e: RPointerEvent, i: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    capture(e);
    drag.current = { k: 'wall', i, start: toModel(e.clientX, e.clientY), pts: room.points.slice(), started: false };
  };

  const splitWall = (i: number) => {
    const pts = room.points.slice();
    const a = pts[i], b = pts[(i + 1) % pts.length];
    pts.splice(i + 1, 0, vec(Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2)));
    useStore.getState().setRoomPoints(pts);
  };

  const removeCorner = (i: number) => {
    if (room.points.length <= 3) return useStore.getState().notify('A room needs at least 3 corners.');
    const pts = room.points.slice();
    pts.splice(i, 1);
    useStore.getState().setRoomPoints(pts);
  };

  const commitWallEdit = () => {
    if (!editWall) return;
    const v = parseFloat(editWall.value);
    if (v > 50 && v <= 100000) useStore.getState().setRoomPoints(setWallLength(room.points, editWall.i, v));
    else if (!isNaN(v) && v !== Math.round(walls[editWall.i].len)) useStore.getState().notify('Wall length must be between 50 mm and 100 m.');
    setEditWall(null);
  };

  const sortedItems = useMemo(() => {
    const rank = (it: Item) => {
      const m = mountOf(it);
      if (m === 'rug') return -1e6;
      if (m === 'opening') return 1e7;
      const b = getBuild(it, room);
      return it.elev + b.size[1];
    };
    return doc.items.filter((i) => DEFS[i.type]).slice().sort((a, b) => rank(a) - rank(b));
  }, [doc.items, room]);

  if (!vt) return <div className="plan" ref={wrapRef} />;
  const { s, tx, ty } = vt;
  const px = (n: number) => n / s;

  // grid (screen space)
  const gridPaths = (() => {
    const step = 100 * s >= 9 ? 100 : 500 * s >= 9 ? 500 : 1000;
    let minor = '', major = '';
    const x0 = Math.floor(-tx / s / step) * step, x1 = (size.w - tx) / s;
    const y0 = Math.floor(-ty / s / step) * step, y1 = (size.h - ty) / s;
    for (let x = x0; x <= x1; x += step) {
      const sx = Math.round(tx + x * s) + 0.5;
      if (Math.round(x) % 1000 === 0) major += `M${sx} 0V${size.h}`;
      else minor += `M${sx} 0V${size.h}`;
    }
    for (let y = y0; y <= y1; y += step) {
      const sy = Math.round(ty + y * s) + 0.5;
      if (Math.round(y) % 1000 === 0) major += `M0 ${sy}H${size.w}`;
      else minor += `M0 ${sy}H${size.w}`;
    }
    return { minor, major };
  })();

  const sel = doc.items.find((i) => i.id === selectedId) ?? null;
  const interactive = tool === 'select';
  const wallPath = `M${outer.map((p) => `${p.x} ${p.y}`).join('L')}Z M${room.points.map((p) => `${p.x} ${p.y}`).join('L')}Z`;
  const rc = centroid(room.points);
  const T = room.wallThickness;

  return (
    <div className={`plan tool-${tool}`} ref={wrapRef}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setCursor(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <rect width={size.w} height={size.h} fill="#f6f8fa" />
        <path d={gridPaths.minor} stroke="#e3e8ee" strokeWidth={1} />
        <path d={gridPaths.major} stroke="#cfd7e0" strokeWidth={1} />
        <g transform={`translate(${tx} ${ty}) scale(${s})`}>
          {underlay && (
            <image href={underlay.src} x={underlay.x} y={underlay.y} width={underlay.pxW * underlay.mmPerPx} height={underlay.pxH * underlay.mmPerPx} opacity={underlay.opacity} preserveAspectRatio="none" style={{ pointerEvents: 'none' }} />
          )}
          <polygon points={room.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="#fbfcfd" fillOpacity={underlay ? 0.35 : 1} />
          {sortedItems.filter((it) => mountOf(it) !== 'opening').map((it) => (
            <PlanItem key={it.id} item={it} room={room} issue={issues.get(it.id)} selected={it.id === selectedId} interactive={interactive} onDown={onItemDown} />
          ))}
          <path d={wallPath} fillRule="evenodd" fill="#3b4250" fillOpacity={underlay ? 0.75 : 1} className="walls" onPointerDown={(e) => {
            if (tool !== 'walls') return;
            // find wall under pointer
            const m = toModel(e.clientX, e.clientY);
            let best = -1, bd = Infinity;
            walls.forEach((w, i) => {
              const t = dot(sub(m, w.a), w.dir);
              const dd = -dot(sub(m, w.a), w.n);
              if (t > -T && t < w.len + T && dd > -5 && dd < T + 5 && Math.abs(dd - T / 2) < bd) {
                bd = Math.abs(dd - T / 2);
                best = i;
              }
            });
            if (best >= 0) startWall(e, best);
          }} />
          {sortedItems.filter((it) => mountOf(it) === 'opening').map((it) => (
            <PlanItem key={it.id} item={it} room={room} issue={issues.get(it.id)} selected={it.id === selectedId} interactive={interactive} onDown={onItemDown} />
          ))}

          {/* wall lengths */}
          {walls.map((w) => {
            const mid = add(w.a, mul(w.dir, w.len / 2));
            const p = add(mid, mul(w.n, -(T + px(14))));
            let ang = (Math.atan2(w.dir.y, w.dir.x) * 180) / Math.PI;
            if (ang > 90) ang -= 180;
            if (ang <= -90) ang += 180;
            return (
              <text
                key={w.i}
                x={p.x}
                y={p.y}
                transform={`rotate(${ang} ${p.x} ${p.y})`}
                fontSize={px(12)}
                className={`wall-len ${tool === 'walls' ? 'editable' : ''}`}
                textAnchor="middle"
                dominantBaseline="middle"
                onPointerDown={(e) => {
                  if (tool !== 'walls') return;
                  // preventDefault keeps the browser from blurring the input we're about to focus
                  e.preventDefault();
                  e.stopPropagation();
                  setEditWall({ i: w.i, x: p.x * s + tx, y: p.y * s + ty, value: String(Math.round(w.len)) });
                }}
              >
                {Math.round(w.len)}
              </text>
            );
          })}
          <text x={rc.x} y={rc.y} fontSize={px(12)} className="area-label" textAnchor="middle">
            {(roomArea(room) / 1e6).toFixed(2)} m²
          </text>

          {/* selection overlay */}
          {sel && tool === 'select' && <Selection item={sel} s={s} showDims={showDims && !dragging} onRotate={startRotate} />}

          {/* room editing handles */}
          {tool === 'walls' && (
            <g>
              {walls.map((w) => {
                const mid = add(add(w.a, mul(w.dir, w.len / 2)), mul(w.n, px(16)));
                return (
                  <g key={`m${w.i}`} className="split-handle" onPointerDown={(e) => { e.stopPropagation(); splitWall(w.i); }}>
                    <circle cx={mid.x} cy={mid.y} r={px(8)} />
                    <path d={`M${mid.x - px(4)} ${mid.y}H${mid.x + px(4)}M${mid.x} ${mid.y - px(4)}V${mid.y + px(4)}`} {...NS} />
                    <title>Split wall (add a corner)</title>
                  </g>
                );
              })}
              {room.points.map((p, i) => (
                <circle
                  key={`c${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={px(7)}
                  className="corner-handle"
                  onPointerDown={(e) => startCorner(e, i)}
                  onDoubleClick={(e) => { e.stopPropagation(); removeCorner(i); }}
                >
                  <title>Drag to move · double-click to remove</title>
                </circle>
              ))}
            </g>
          )}

          {/* draw tool preview */}
          {tool === 'draw' && (
            <g className="draw-preview">
              {drawPts.length > 0 && <polyline points={drawPts.map((p) => `${p.x},${p.y}`).join(' ')} {...NS} />}
              {drawPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={px(i === 0 && drawPts.length >= 3 ? 7 : 4)} className={i === 0 ? 'first' : ''} />)}
              {cursor && (() => {
                const c = drawSnap(cursor, false);
                const last = drawPts[drawPts.length - 1];
                return (
                  <>
                    <circle cx={c.x} cy={c.y} r={px(3)} className="cursor" />
                    {last && (
                      <>
                        <line x1={last.x} y1={last.y} x2={c.x} y2={c.y} strokeDasharray="6 4" {...NS} />
                        <text x={(last.x + c.x) / 2} y={(last.y + c.y) / 2 - px(8)} fontSize={px(12)} textAnchor="middle" className="draw-len">
                          {typed ? `${typed}▏` : Math.round(dist(last, c))}
                        </text>
                      </>
                    )}
                  </>
                );
              })()}
            </g>
          )}

          {tool === 'calibrate' && calPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={px(5)} className="cal-pt" />)}
          {tool === 'calibrate' && calPts.length === 2 && <line x1={calPts[0].x} y1={calPts[0].y} x2={calPts[1].x} y2={calPts[1].y} className="cal-line" {...NS} />}
        </g>
      </svg>

      <PlanToolbar onFit={fit} />

      {editWall && (
        <input
          className="wall-edit"
          autoFocus
          onFocus={(e) => e.target.select()}
          style={{ left: editWall.x, top: editWall.y }}
          value={editWall.value}
          onChange={(e) => setEditWall({ ...editWall, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitWallEdit();
            if (e.key === 'Escape') setEditWall(null);
          }}
          onBlur={commitWallEdit}
        />
      )}

      {calInput !== null && (
        <div className="cal-dialog">
          <div>Real distance between the two points (mm):</div>
          <input
            autoFocus
            value={calInput}
            onChange={(e) => setCalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setCalInput(null); setCalPts([]); }
              if (e.key !== 'Enter') return;
              const real = parseFloat(calInput);
              const st = useStore.getState();
              if (real > 0 && st.underlay && calPts.length === 2) {
                const k = real / dist(calPts[0], calPts[1]);
                const a = calPts[0];
                st.set({ underlay: { ...st.underlay, mmPerPx: st.underlay.mmPerPx * k, x: a.x + (st.underlay.x - a.x) * k, y: a.y + (st.underlay.y - a.y) * k }, planTool: 'select' });
                st.notify('Plan image scaled. Use “Draw room” to trace it.');
              }
              setCalInput(null);
              setCalPts([]);
            }}
          />
          <div className="muted">Enter to apply · Esc to cancel</div>
        </div>
      )}

      <div className="plan-hint">
        {tool === 'select' && 'Drag items to move · drag the ● handle to rotate (Shift = free) · Alt = no snapping · drag empty space to pan · wheel to zoom'}
        {tool === 'walls' && 'Drag corners or walls · click a wall length to type it · ⊕ splits a wall · double-click a corner to remove it'}
        {tool === 'draw' && 'Click to place corners (snaps to 90°, Alt = free) · type a length + Enter for exact walls · click the first corner or Enter to close · Esc to cancel'}
        {tool === 'calibrate' && 'Click two points on the plan image whose real distance you know'}
        {tool === 'underlay' && 'Drag to move the plan image'}
      </div>
    </div>
  );
}

function Selection({ item, s, showDims, onRotate }: { item: Item; s: number; showDims: boolean; onRotate: (e: RPointerEvent, id: string) => void }) {
  const doc = useStore((st) => st.doc);
  const room = doc.room;
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  const opening = mountOf(item) === 'opening';
  const { min, max } = b.bounds;
  const px = (n: number) => n / s;
  const issue = analyze(doc).get(item.id);
  const color = issue?.level === 'error' ? '#e5484d' : issue?.level === 'warn' ? '#f59f00' : '#2f7cf6';
  const cl = showDims && !opening ? clearances(doc, item) : [];
  const hz = max[2] + px(28);
  const corners = [toPlan(pose, min[0], min[2]), toPlan(pose, max[0], min[2]), toPlan(pose, max[0], max[2]), toPlan(pose, min[0], max[2])];
  const handle = toPlan(pose, 0, hz);
  const front = toPlan(pose, 0, max[2]);
  const lbl = toPlan(pose, 0, (min[2] + max[2]) / 2);
  return (
    <g className="selection" style={{ pointerEvents: 'none' }}>
      <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="5 3" {...NS} />
      {cl.map((c) => {
        const mid = mul(add(c.from, c.to), 0.5);
        return (
          <g key={c.side} className={`clear ${c.wall ? 'wall' : 'obj'}`}>
            <line x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} {...NS} />
            <circle cx={c.to.x} cy={c.to.y} r={px(2.5)} />
            {c.d > 1 && (
              <g transform={`translate(${mid.x} ${mid.y})`}>
                <rect x={-px(20)} y={-px(8)} width={px(40)} height={px(16)} rx={px(3)} />
                <text fontSize={px(11)} textAnchor="middle" dominantBaseline="central">{Math.round(c.d)}</text>
              </g>
            )}
          </g>
        );
      })}
      {showDims && (
        <text x={lbl.x} y={lbl.y} fontSize={px(11)} textAnchor="middle" dominantBaseline="central" className="size-label">
          {Math.round(b.size[0])}×{Math.round(b.size[2])}
        </text>
      )}
      {!opening && (
        <g style={{ pointerEvents: 'auto' }} className="rot-handle" onPointerDown={(e) => onRotate(e, item.id)}>
          <line x1={front.x} y1={front.y} x2={handle.x} y2={handle.y} stroke={color} {...NS} />
          <circle cx={handle.x} cy={handle.y} r={px(7)} fill="#fff" stroke={color} strokeWidth={2} {...NS} />
          <title>Drag to rotate (snaps to 15°, Shift = 1°)</title>
        </g>
      )}
    </g>
  );
}

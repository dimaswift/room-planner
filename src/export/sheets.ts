import { CELL_TYPES, cabinetCells } from '../furniture/cabinet';
import { DEFS, fullParams, getBuild, mountOf, sizeLabel } from '../furniture/catalog';
import { projectBuild, shapeSvg, shapesExtent, type Shape2 } from '../furniture/project';
import type { DimAnno, View } from '../furniture/types';
import { add, bboxOf, mul, norm, sub, vec } from '../geometry/math';
import { poseOf, toPlan } from '../geometry/placement';
import { getWalls, outerPolygon, roomArea, roomPerimeter } from '../geometry/room';
import type { Doc, Item, Vec2 } from '../types';

export interface Theme {
  bg: string; line: string; thin: string; wall: string; floor: string; fill: string; text: string; muted: string; glass: string; accent: string;
}

export const THEMES: Record<'technical' | 'blueprint', Theme> = {
  technical: { bg: '#ffffff', line: '#1c222b', thin: '#5b6570', wall: '#2a3039', floor: '#ffffff', fill: '#ffffff', text: '#1c222b', muted: '#6b7580', glass: '#dcecf6', accent: '#2f6fd6' },
  blueprint: { bg: '#1d4b8a', line: '#ffffff', thin: '#c7dbff', wall: '#e9f1ff', floor: '#1d4b8a', fill: '#21549a', text: '#ffffff', muted: '#b9cff3', glass: '#3a6fb5', accent: '#ffd166' },
};

const f2 = (n: number) => +n.toFixed(2);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONT = `font-family="Inter, 'Helvetica Neue', Arial, sans-serif"`;

function text(x: number, y: number, s: string, size: number, fill: string, o: { anchor?: string; weight?: number; rot?: number; spacing?: number; baseline?: string } = {}) {
  const tr = o.rot ? ` transform="rotate(${f2(o.rot)} ${f2(x)} ${f2(y)})"` : '';
  return `<text x="${f2(x)}" y="${f2(y)}" font-size="${size}" fill="${fill}" text-anchor="${o.anchor ?? 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.spacing ? ` letter-spacing="${o.spacing}"` : ''} dominant-baseline="${o.baseline ?? 'alphabetic'}"${tr}>${esc(s)}</text>`;
}

const line = (a: Vec2, b: Vec2, stroke: string, w: number, extra = '') =>
  `<line x1="${f2(a.x)}" y1="${f2(a.y)}" x2="${f2(b.x)}" y2="${f2(b.y)}" stroke="${stroke}" stroke-width="${w}"${extra}/>`;

/**
 * Dimension line in paper space. p1/p2 are the measured points; the dimension line sits at
 * `off` along the left normal of p1→p2 (negative = right side).
 */
export function dimLine(p1: Vec2, p2: Vec2, off: number, label: string, th: Theme, fs = 2.5) {
  const d = norm(sub(p2, p1));
  const n = vec(-d.y, d.x);
  const sg = Math.sign(off) || 1;
  const q1 = add(p1, mul(n, off));
  const q2 = add(p2, mul(n, off));
  const L = Math.hypot(q2.x - q1.x, q2.y - q1.y);
  let out = '';
  out += line(add(p1, mul(n, sg * 0.8)), add(q1, mul(n, sg * 1.2)), th.thin, 0.13);
  out += line(add(p2, mul(n, sg * 0.8)), add(q2, mul(n, sg * 1.2)), th.thin, 0.13);
  out += line(sub(q1, mul(d, 1.2)), add(q2, mul(d, 1.2)), th.line, 0.18);
  const tk = mul(norm(add(d, n)), 0.9);
  for (const q of [q1, q2]) out += line(sub(q, tk), add(q, tk), th.line, 0.35);
  let ang = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  let flip = 1;
  if (ang > 90.1 || ang < -89.9) {
    ang += 180;
    flip = -1;
  }
  const tw = label.length * fs * 0.56;
  const mid = mul(add(q1, q2), 0.5);
  // keep text on the outside of the dimension line; labels that don't fit go one text-height further out
  const tp = add(mid, mul(n, sg * (fs * 0.45 + (tw + 1.5 > L ? fs * 1.25 : 0))));
  out += text(tp.x, tp.y, label, fs, th.text, { anchor: 'middle', rot: ang, baseline: sg * flip > 0 ? 'hanging' : 'alphabetic' });
  return out;
}

function sheetFrame(W: number, H: number, th: Theme) {
  return `<rect width="${W}" height="${H}" fill="${th.bg}"/><rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="none" stroke="${th.line}" stroke-width="0.5"/>`;
}

function svgDoc(W: number, H: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" ${FONT} stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function titleBlock(x: number, y: number, w: number, rows: [string, string][], title: string, subtitle: string, th: Theme) {
  const rh = 5;
  const h = 14 + rows.length * rh + 2;
  let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${th.bg}" stroke="${th.line}" stroke-width="0.35"/>`;
  o += text(x + 3, y + 6.5, title, 4.4, th.text, { weight: 700 });
  o += text(x + 3, y + 11.2, subtitle, 2.6, th.muted, { spacing: 0.3 });
  o += line(vec(x, y + 13), vec(x + w, y + 13), th.line, 0.25);
  rows.forEach(([k, v], i) => {
    const yy = y + 13 + (i + 1) * rh - 1.4;
    o += text(x + 3, yy, k, 2.4, th.muted);
    o += text(x + 30, yy, v, 2.6, th.text, { weight: 600 });
  });
  return { svg: o, h };
}

const today = () => new Date().toISOString().slice(0, 10);

export interface Numbering {
  furniture: Item[];
  openings: { item: Item; tag: string }[];
}

export function numbering(doc: Doc): Numbering {
  const furniture = doc.items.filter((i) => DEFS[i.type] && mountOf(i) !== 'opening');
  let d = 0, w = 0;
  const openings = doc.items
    .filter((i) => DEFS[i.type] && mountOf(i) === 'opening')
    .map((item) => ({ item, tag: item.type === 'door' ? `D${++d}` : `W${++w}` }));
  return { furniture, openings };
}

/** A3 landscape floor plan at a true architectural scale. */
export function roomSheet(doc: Doc, th: Theme): { svg: string; scale: number } {
  const room = doc.room;
  const walls = getWalls(room);
  const outer = outerPolygon(room);
  const W = 420, H = 297, M = 8;
  const tableW = 116;
  const area = { x: M + 4, y: M + 4, w: W - 2 * M - tableW - 12, h: H - 2 * M - 22 };
  const bb = bboxOf(outer);
  const ds = 26;
  const scales = [10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000];
  const N = scales.find((n) => bb.w / n <= area.w - 2 * ds && bb.h / n <= area.h - 2 * ds) ?? 1000;
  const ox = area.x + area.w / 2 - (bb.minX + bb.w / 2) / N;
  const oy = area.y + area.h / 2 - (bb.minY + bb.h / 2) / N;
  const P = (p: Vec2) => vec(ox + p.x / N, oy + p.y / N);
  const T = room.wallThickness;
  const { furniture, openings } = numbering(doc);

  let s = sheetFrame(W, H, th);
  s += `<polygon points="${room.points.map((p) => { const q = P(p); return `${f2(q.x)},${f2(q.y)}`; }).join(' ')}" fill="${th.floor}"/>`;

  // furniture (rugs first, then by height)
  const order = furniture.slice().sort((a, b) => {
    const ra = mountOf(a) === 'rug' ? -1e6 : a.elev + getBuild(a, room).size[1];
    const rb = mountOf(b) === 'rug' ? -1e6 : b.elev + getBuild(b, room).size[1];
    return ra - rb;
  });
  for (const it of order) {
    const b = getBuild(it, room);
    const pose = poseOf(it, room);
    const c = P(vec(pose.x, pose.y));
    const rugish = mountOf(it) === 'rug';
    const shapes = rugish ? projectBuild(b, 'top').slice(0, 1) : projectBuild(b, 'top');
    const sw = f2(0.16 * N);
    s += `<g transform="translate(${f2(c.x)} ${f2(c.y)}) rotate(${f2(pose.rot)}) scale(${1 / N})">`;
    for (const sh of shapes) {
      const glass = sh.mat === 'glass' || sh.mat === 'water';
      s += shapeSvg(sh, `fill="${glass ? th.glass : th.fill}" stroke="${rugish ? th.thin : th.line}" stroke-width="${sw}"${rugish ? ` stroke-dasharray="${2 * N} ${1.2 * N}"` : ''}`);
    }
    s += '</g>';
  }

  // walls
  const wp = `M${outer.map((p) => { const q = P(p); return `${f2(q.x)} ${f2(q.y)}`; }).join('L')}Z M${room.points.map((p) => { const q = P(p); return `${f2(q.x)} ${f2(q.y)}`; }).join('L')}Z`;
  s += `<path d="${wp}" fill="${th.wall}" fill-rule="evenodd" stroke="${th.line}" stroke-width="0.35"/>`;

  // openings
  for (const { item, tag } of openings) {
    const b = getBuild(item, room);
    const pose = poseOf(item, room);
    const c = P(vec(pose.x, pose.y));
    const [c0, c1] = b.cut!;
    s += `<g transform="translate(${f2(c.x)} ${f2(c.y)}) rotate(${f2(pose.rot)}) scale(${1 / N})">`;
    s += `<rect x="${c0}" y="${-T - 2 * N * 0.1}" width="${c1 - c0}" height="${T + 0.4 * N}" fill="${th.floor}"/>`;
    for (const sy of b.symbol) s += `<path d="${sy.d}" fill="none" stroke="${th.line}" stroke-width="${f2((sy.dashed ? 0.13 : 0.25) * N)}"${sy.dashed ? ` stroke-dasharray="${1.2 * N} ${0.8 * N}"` : ''}/>`;
    s += '</g>';
    const tp = P(toPlan(pose, 0, item.type === 'door' ? Math.min(450, (c1 - c0) / 2) : 280 + 3.5 * N));
    s += `<rect x="${f2(tp.x - 4)}" y="${f2(tp.y - 2)}" width="8" height="4" rx="1" fill="${th.bg}" stroke="${th.accent}" stroke-width="0.25"/>`;
    s += text(tp.x, tp.y + 0.15, tag, 2.4, th.accent, { anchor: 'middle', baseline: 'middle', weight: 700 });
  }

  // wall dimensions: chain through openings (inner row) and overall inner length (outer row)
  for (const w of walls) {
    const p1 = P(w.a), p2 = P(w.b);
    const d = norm(sub(p2, p1));
    const left = vec(-d.y, d.x);
    const sg = left.x * -w.n.x + left.y * -w.n.y > 0 ? 1 : -1;
    const base = T / N;
    const ops = openings.filter((o) => o.item.wall === w.i).map((o) => {
      const b = getBuild(o.item, room);
      return [(o.item.offset ?? 0) + b.cut![0], (o.item.offset ?? 0) + b.cut![1]] as [number, number];
    }).sort((a, b) => a[0] - b[0]);
    let row = base + 5;
    if (ops.length) {
      const ts = [0, ...ops.flat(), w.len].map((t) => Math.max(0, Math.min(w.len, t)));
      for (let i = 0; i < ts.length - 1; i++) {
        if (ts[i + 1] - ts[i] < 1) continue;
        const a = P(add(w.a, mul(w.dir, ts[i]))), b2 = P(add(w.a, mul(w.dir, ts[i + 1])));
        s += dimLine(a, b2, sg * row, String(Math.round(ts[i + 1] - ts[i])), th, 2.3);
      }
      row += 6.5;
    }
    s += dimLine(p1, p2, sg * row, String(Math.round(w.len)), th, 2.6);
  }

  // item tags, nudged apart when items sit on top of each other (TV on a stand, table on a rug)
  const placed: Vec2[] = [];
  const nudges = [vec(0, 0), vec(0, 5), vec(0, -5), vec(5, 0), vec(-5, 0), vec(5, 5), vec(-5, 5), vec(5, -5), vec(-5, -5), vec(0, 10), vec(0, -10)];
  furniture.forEach((it, i) => {
    const pose = poseOf(it, room);
    const at = P(vec(pose.x, pose.y));
    const c = nudges.map((n) => add(at, n)).find((q) => placed.every((o) => Math.hypot(o.x - q.x, o.y - q.y) > 4.8)) ?? at;
    placed.push(c);
    if (c !== at && (c.x !== at.x || c.y !== at.y)) s += line(at, c, th.accent, 0.15) + `<circle cx="${f2(at.x)}" cy="${f2(at.y)}" r="0.45" fill="${th.accent}"/>`;
    s += `<circle cx="${f2(c.x)}" cy="${f2(c.y)}" r="2.2" fill="${th.bg}" stroke="${th.accent}" stroke-width="0.3"/>`;
    s += text(c.x, c.y + 0.1, String(i + 1), 2.2, th.accent, { anchor: 'middle', baseline: 'middle', weight: 700 });
  });

  // scale bar
  const barM = [500, 1000, 2000, 5000, 10000, 20000].find((m) => m / N >= 35) ?? 20000;
  const bx = area.x + 4, by = H - M - 10, bl = barM / N;
  for (let i = 0; i < 4; i++) s += `<rect x="${f2(bx + (i * bl) / 4)}" y="${by}" width="${f2(bl / 4)}" height="1.6" fill="${i % 2 ? th.bg : th.line}" stroke="${th.line}" stroke-width="0.2"/>`;
  s += text(bx, by - 1.2, '0', 2.2, th.text, { anchor: 'middle' });
  s += text(bx + bl, by - 1.2, `${barM / 1000} m`, 2.2, th.text, { anchor: 'middle' });
  s += text(bx + bl + 6, by + 1.6, `Scale 1:${N} at A3 · all dimensions in mm (inner faces)`, 2.4, th.muted);

  // schedule
  const tx = W - M - tableW - 2, ty = M + 4;
  const blockRows: [string, string][] = [
    ['Scale', `1:${N} (A3)`],
    ['Floor area', `${(roomArea(room) / 1e6).toFixed(2)} m²`],
    ['Perimeter', `${(roomPerimeter(room) / 1000).toFixed(2)} m`],
    ['Ceiling height', `${room.wallHeight} mm`],
    ['Wall thickness', `${room.wallThickness} mm`],
    ['Date', today()],
  ];
  const blockH = 14 + blockRows.length * 5 + 2;
  const tby = H - M - 2 - blockH;
  const rowsAvail = tby - ty - 16;
  const nRows = furniture.length + (openings.length ? openings.length + 2 : 0) + 1;
  const rh = Math.min(4.4, rowsAvail / Math.max(1, nRows));
  const fs = Math.min(2.4, rh * 0.58);
  s += text(tx, ty + 4, 'SCHEDULE', 3.2, th.text, { weight: 700, spacing: 0.4 });
  let yy = ty + 9;
  const cols = [tx, tx + 7, tx + 58, tx + 98];
  s += text(cols[0], yy, '#', fs, th.muted) + text(cols[1], yy, 'Item', fs, th.muted) + text(cols[2], yy, 'W × D × H', fs, th.muted) + text(cols[3], yy, 'Elev.', fs, th.muted);
  s += line(vec(tx, yy + 1.2), vec(tx + tableW, yy + 1.2), th.line, 0.2);
  yy += rh + 0.6;
  const clip = (str: string, n: number) => (str.length > n ? str.slice(0, n - 1) + '…' : str);
  furniture.forEach((it, i) => {
    const b = getBuild(it, room);
    s += text(cols[0], yy, String(i + 1), fs, th.accent, { weight: 700 });
    s += text(cols[1], yy, clip(it.name, 30), fs, th.text);
    s += text(cols[2], yy, sizeLabel(b), fs, th.text);
    s += text(cols[3], yy, it.elev ? String(Math.round(it.elev)) : '—', fs, th.text);
    yy += rh;
  });
  if (openings.length) {
    yy += rh * 0.6;
    s += text(tx, yy, 'OPENINGS', fs * 1.1, th.text, { weight: 700, spacing: 0.3 });
    s += line(vec(tx, yy + 1.2), vec(tx + tableW, yy + 1.2), th.line, 0.2);
    yy += rh + 0.6;
    for (const { item, tag } of openings) {
      const b = getBuild(item, room);
      const desc = item.type === 'door'
        ? `${Math.round(b.size[0])} × ${Math.round(b.size[1])} · ${item.params.kind === 'hinged' ? `${item.params.leaves === 'double' ? 'double' : item.params.hinge + ' hinge'}, ${item.params.swing}` : item.params.kind}`
        : `${Math.round(b.size[0])} × ${Math.round(b.size[1])} · sill ${Math.round(item.elev)}`;
      s += text(cols[0], yy, tag, fs, th.accent, { weight: 700 });
      s += text(cols[1], yy, clip(item.name, 30), fs, th.text);
      s += text(cols[2], yy, desc, fs, th.text);
      yy += rh;
    }
  }
  s += titleBlock(tx, tby, tableW + 2, blockRows, doc.name, 'FLOOR PLAN', th).svg;
  return { svg: svgDoc(W, H, s), scale: N };
}

// ---------- item schematic ----------

const VIEW_LABEL: Record<View, string> = { front: 'FRONT', side: 'SIDE (RIGHT)', top: 'TOP' };

function paramRows(item: Item): [string, string, string?][] {
  const def = DEFS[item.type];
  const p = fullParams(item);
  const rows: [string, string, string?][] = [];
  for (const pd of def.params) {
    if (pd.show && !pd.show(p)) continue;
    const v = p[pd.key];
    if (pd.type === 'cells') {
      const { cells, cols } = cabinetCells(p);
      cols.forEach((c, ci) => {
        const cs = cells.filter((x) => x.col === ci);
        const desc = cs.map((x) => `${CELL_TYPES.find((t) => t.t === x.t)?.short.toLowerCase()} ${Math.round(x.y1 - x.y0)}`).join(' · ');
        rows.push([`Column ${ci + 1} (${Math.round(c.x1 - c.x0)})`, desc]);
      });
      continue;
    }
    let s = '';
    if (pd.type === 'bool') s = v ? 'yes' : 'no';
    else if (pd.type === 'select') s = pd.options?.find(([k]) => k === v)?.[1] ?? String(v);
    else if (pd.type === 'color') s = String(v).toUpperCase();
    else s = `${Math.round(+v * 10) / 10}${pd.unit && pd.unit !== 'mm' ? pd.unit : pd.unit === 'mm' ? ' mm' : ''}`;
    rows.push([pd.label, s, pd.type === 'color' ? String(v) : undefined]);
  }
  return rows;
}

/** A4 landscape orthographic drawing (front, top, side) with dimensions. */
export function itemSheet(doc: Doc, item: Item, th: Theme, qty = 1): string {
  const room = doc.room;
  const b = getBuild(item, room);
  const def = DEFS[item.type];
  const W = 297, H = 210, M = 8;
  const side = 88;
  const region = { x: M + 4, y: M + 4, w: W - 2 * M - side - 10, h: H - 2 * M - 8 };
  const views: Record<View, Shape2[]> = { front: projectBuild(b, 'front'), side: projectBuild(b, 'side'), top: projectBuild(b, 'top') };
  const ex = { front: shapesExtent(views.front), side: shapesExtent(views.side), top: shapesExtent(views.top) };
  const u0 = Math.min(ex.front.minU, ex.top.minU), u1 = Math.max(ex.front.maxU, ex.top.maxU);
  const v0 = Math.min(ex.front.minV, ex.side.minV), v1 = Math.max(ex.front.maxV, ex.side.maxV);
  const t0 = ex.top.minV, t1 = ex.top.maxV;
  const s0 = ex.side.minU, s1 = ex.side.maxU;
  const gapX = 32, gapY = 28, mg = 18, lbl = 6;
  const scales = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  const N = scales.find((n) => (u1 - u0 + s1 - s0) / n + gapX + 2 * mg <= region.w && (t1 - t0 + v1 - v0) / n + gapY + 2 * mg + lbl <= region.h) ?? 100;
  const totW = (u1 - u0 + s1 - s0) / N + gapX + 2 * mg;
  const totH = (t1 - t0 + v1 - v0) / N + gapY + 2 * mg + lbl;
  const fx = region.x + (region.w - totW) / 2 + mg;
  const sx = fx + (u1 - u0) / N + gapX;
  const ty = region.y + (region.h - totH) / 2 + mg;
  const fy = ty + (t1 - t0) / N + gapY;
  const origin: Record<View, Vec2> = { front: vec(fx - u0 / N, fy - v0 / N), top: vec(fx - u0 / N, ty - t0 / N), side: vec(sx - s0 / N, fy - v0 / N) };
  const box: Record<View, { x0: number; y0: number; x1: number; y1: number }> = {
    front: { x0: fx, y0: fy, x1: fx + (u1 - u0) / N, y1: fy + (v1 - v0) / N },
    top: { x0: fx, y0: ty, x1: fx + (u1 - u0) / N, y1: ty + (t1 - t0) / N },
    side: { x0: sx, y0: fy, x1: sx + (s1 - s0) / N, y1: fy + (v1 - v0) / N },
  };
  const p = fullParams(item);
  let s = sheetFrame(W, H, th);
  const sw = f2(0.2 * N);
  for (const v of ['top', 'front', 'side'] as View[]) {
    const o = origin[v];
    s += `<g transform="translate(${f2(o.x)} ${f2(o.y)}) scale(${1 / N})">`;
    for (const sh of views[v]) {
      const glass = sh.mat === 'glass' || sh.mat === 'water';
      s += shapeSvg(sh, `fill="${glass ? th.glass : th.fill}" stroke="${th.line}" stroke-width="${sw}"${glass ? ' fill-opacity="0.8"' : ''}`);
    }
    s += '</g>';
  }

  // dimensions
  const { min, max } = b.bounds;
  const dims: DimAnno[] = [...b.dims];
  const used = (view: View, dir: 'h' | 'v', sign: number) => Math.max(0, ...dims.filter((d) => d.view === view && d.dir === dir && Math.sign(d.level) === sign).map((d) => Math.abs(d.level)));
  const auto: DimAnno[] = [
    { view: 'front', dir: 'h', a: min[0], b: max[0], at: min[1], level: -(used('front', 'h', -1) + 1) },
    { view: 'front', dir: 'v', a: min[1], b: max[1], at: min[0], level: -(used('front', 'v', -1) + 1) },
    { view: 'side', dir: 'h', a: -max[2], b: -min[2], at: min[1], level: -(used('side', 'h', -1) + 1) },
    { view: 'side', dir: 'v', a: min[1], b: max[1], at: -min[2], level: used('side', 'v', 1) + 1 },
    { view: 'top', dir: 'v', a: min[2], b: max[2], at: min[0], level: -(used('top', 'v', -1) + 1) },
  ];
  dims.push(...auto);
  for (const d of dims) {
    const o = origin[d.view];
    const bx = box[d.view];
    const vdown = (y: number) => (d.view === 'top' ? y : -y);
    const step = 6.5;
    const dist0 = 5 + (Math.abs(d.level) - 1) * step;
    const label = String(Math.round(Math.abs(d.b - d.a))) + (d.label ? ` ${d.label}` : '');
    if (d.dir === 'h') {
      const [ua, ub] = d.a < d.b ? [d.a, d.b] : [d.b, d.a];
      const pa = vec(o.x + ua / N, o.y + vdown(d.at) / N);
      const pb = vec(o.x + ub / N, o.y + vdown(d.at) / N);
      const lineY = d.level < 0 ? bx.y1 + dist0 : bx.y0 - dist0;
      // a→b points +x, so its left normal (0, 1) points down the sheet
      s += dimLine(pa, pb, lineY - pa.y, label, th, 2.4);
    } else {
      const ya = o.y + vdown(d.a) / N, yb = o.y + vdown(d.b) / N;
      const x = o.x + d.at / N;
      const pa = vec(x, Math.max(ya, yb)), pb = vec(x, Math.min(ya, yb));
      const lineX = d.level < 0 ? bx.x0 - dist0 : bx.x1 + dist0;
      // a→b points up the sheet, so its left normal (1, 0) points right
      s += dimLine(pa, pb, lineX - x, label, th, 2.4);
    }
  }

  for (const v of ['top', 'front', 'side'] as View[]) {
    const bx = box[v];
    const lv = Math.max(0, ...dims.filter((d) => d.view === v && d.dir === 'h' && (v === 'top' ? d.level > 0 : d.level < 0)).map((d) => Math.abs(d.level)));
    const out = lv ? 5 + (lv - 1) * 6.5 + 4.5 : 1.5;
    s += text((bx.x0 + bx.x1) / 2, v === 'top' ? bx.y0 - out - 1.5 : bx.y1 + out + 3.2, VIEW_LABEL[v], 2.8, th.muted, { anchor: 'middle', weight: 700, spacing: 0.6 });
  }

  // parameter table + title block
  const tx = W - M - side - 2;
  let yy = M + 8;
  s += text(tx, yy, 'PARAMETERS', 3, th.text, { weight: 700, spacing: 0.4 });
  yy += 2;
  s += line(vec(tx, yy), vec(tx + side, yy), th.line, 0.2);
  const rows = paramRows(item);
  const blockRows: [string, string][] = [
    ['Overall W×D×H', `${sizeLabel(b)} mm`],
    ['Type', def.label],
    ['Quantity', String(qty)],
    ['Scale', `1:${N} (A4)`],
    ['Project', doc.name],
    ['Date', today()],
  ];
  const blockH = 14 + blockRows.length * 5 + 2;
  const avail = H - M - 4 - blockH - yy - 4;
  const rh = Math.min(4.3, avail / Math.max(1, rows.length + 3));
  const fs = Math.min(2.3, rh * 0.6);
  yy += rh;
  for (const [k, v, color] of rows) {
    s += text(tx, yy, k, fs, th.muted);
    if (color) s += `<rect x="${tx + 40}" y="${f2(yy - fs * 0.85)}" width="${fs}" height="${fs}" fill="${color}" stroke="${th.line}" stroke-width="0.15"/>`;
    const words = v.length > 34 ? v.slice(0, 33) + '…' : v;
    s += text(tx + (color ? 40 + fs + 1.2 : 40), yy, words, fs, th.text);
    yy += rh;
  }
  if (mountOf(item) !== 'opening') {
    yy += rh * 0.5;
    s += text(tx, yy, 'Placement', fs, th.muted);
    s += text(tx + 40, yy, `x ${Math.round(item.x)}, y ${Math.round(item.y)}, ${Math.round(item.rot)}°${item.elev ? `, elev ${Math.round(item.elev)}` : ''}`, fs, th.text);
  } else {
    yy += rh * 0.5;
    s += text(tx, yy, item.type === 'window' ? 'Sill height' : 'Wall', fs, th.muted);
    s += text(tx + 40, yy, item.type === 'window' ? `${Math.round(item.elev)} mm` : `wall ${(item.wall ?? 0) + 1}, centre at ${Math.round(item.offset ?? 0)} mm`, fs, th.text);
  }
  s += titleBlock(tx, H - M - 2 - blockH, side + 2, blockRows, item.name, 'ITEM DRAWING', th).svg;
  return svgDoc(W, H, s);
}

/** Group identical items (same type + params) for one drawing per design. */
export function uniqueDesigns(doc: Doc) {
  const groups = new Map<string, { item: Item; qty: number; ids: string[] }>();
  for (const it of doc.items) {
    if (!DEFS[it.type]) continue;
    const key = it.type + JSON.stringify(it.params);
    const g = groups.get(key);
    if (g) {
      g.qty++;
      g.ids.push(it.id);
    } else groups.set(key, { item: it, qty: 1, ids: [it.id] });
  }
  return [...groups.values()];
}

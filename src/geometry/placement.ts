import { DEFS, getBuild, mountOf } from '../furniture/catalog';
import type { Collider, Mount } from '../furniture/types';
import type { Doc, Item, Room, Vec2 } from '../types';
import {
  DEG, add, centroid, clamp, closestOnSegment, convexOverlap, dist, dot, mul, norm, normDeg, pointInPolygon,
  raySegment, rotPt, segmentsCross, snapTo, sub, vec,
} from './math';
import { getWalls, type Wall } from './room';

export interface Pose { x: number; y: number; rot: number }
export interface WCol { pts: Vec2[]; y0: number; y1: number }

export const wallRot = (w: Wall) => normDeg(Math.atan2(-w.n.x, w.n.y) / DEG);

export function poseOf(item: Item, room: Room): Pose {
  if (item.wall !== undefined && DEFS[item.type]?.mount === 'opening') {
    const w = getWalls(room)[item.wall];
    if (w) {
      const p = add(w.a, mul(w.dir, item.offset ?? w.len / 2));
      return { x: p.x, y: p.y, rot: wallRot(w) };
    }
  }
  return { x: item.x, y: item.y, rot: item.rot };
}

/** Bring derived x/y/rot of an opening in line with its wall + offset. */
export function syncOpening(item: Item, room: Room): Item {
  const p = poseOf(item, room);
  return { ...item, x: p.x, y: p.y, rot: p.rot };
}

export const toPlan = (pose: Pose, lx: number, lz: number): Vec2 => add(vec(pose.x, pose.y), rotPt(vec(lx, lz), pose.rot));

function colliderToWorld(c: Collider, pose: Pose, elev: number): WCol {
  return {
    pts: [toPlan(pose, c.min[0], c.min[2]), toPlan(pose, c.max[0], c.min[2]), toPlan(pose, c.max[0], c.max[2]), toPlan(pose, c.min[0], c.max[2])],
    y0: elev + c.min[1],
    y1: elev + c.max[1],
  };
}

export function worldColliders(item: Item, room: Room): WCol[] {
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  return b.colliders.map((c) => colliderToWorld(c, pose, item.elev));
}

export function worldSoft(item: Item, room: Room): WCol[] {
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  return b.soft.map((c) => colliderToWorld(c, pose, item.elev));
}

/** Bounding footprint (4 corners) in plan. */
export function footprint(item: Item, room: Room): Vec2[] {
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  const { min, max } = b.bounds;
  return [toPlan(pose, min[0], min[2]), toPlan(pose, max[0], min[2]), toPlan(pose, max[0], max[2]), toPlan(pose, min[0], max[2])];
}

function quadInsideRoom(pts: Vec2[], room: Room) {
  const c = centroid(pts);
  const q = pts.map((p) => add(p, mul(norm(sub(c, p)), 0.8)));
  for (const p of q) if (!pointInPolygon(p, room.points)) return false;
  const rp = room.points;
  for (let i = 0; i < rp.length; i++) {
    const a = rp[i];
    const b = rp[(i + 1) % rp.length];
    for (let j = 0; j < q.length; j++) if (segmentsCross(q[j], q[(j + 1) % q.length], a, b)) return false;
  }
  return true;
}

function colsOverlap(a: WCol[], b: WCol[]) {
  for (const ca of a) {
    for (const cb of b) {
      if (ca.y1 <= cb.y0 + 0.5 || cb.y1 <= ca.y0 + 0.5) continue;
      if (convexOverlap(ca.pts, cb.pts, 0.5)) return true;
    }
  }
  return false;
}

export interface PlaceCtx {
  room: Room;
  walls: Wall[];
  items: Item[];
  others: { item: Item; cols: WCol[] }[];
}

/** Context for placing `ids`: every other solid item becomes an obstacle. */
export function makeCtx(doc: Doc, ids: string[]): PlaceCtx {
  const skip = new Set(ids);
  const others = doc.items
    .filter((it) => !skip.has(it.id) && DEFS[it.type])
    .filter((it) => {
      const m = mountOf(it);
      return m !== 'rug' && m !== 'opening';
    })
    .map((item) => ({ item, cols: worldColliders(item, doc.room) }));
  return { room: doc.room, walls: getWalls(doc.room), items: doc.items, others };
}

export function openingIssue(item: Item, room: Room, items: Item[]): string | null {
  const w = getWalls(room)[item.wall ?? -1];
  if (!w) return 'Not attached to a wall';
  const b = getBuild(item, room);
  const [c0, c1] = b.cut ?? [-b.size[0] / 2, b.size[0] / 2];
  const off = item.offset ?? 0;
  if (off + c0 < -0.5 || off + c1 > w.len + 0.5) return 'Does not fit on this wall';
  if (item.elev + b.size[1] > room.wallHeight + 0.5) return 'Taller than the wall';
  for (const o of items) {
    if (o.id === item.id || o.wall !== item.wall || mountOf(o) !== 'opening') continue;
    const ob = getBuild(o, room);
    const [d0, d1] = ob.cut ?? [-ob.size[0] / 2, ob.size[0] / 2];
    const oo = o.offset ?? 0;
    if (Math.min(off + c1, oo + d1) - Math.max(off + c0, oo + d0) > 0.5) {
      const vOverlap = Math.min(item.elev + b.size[1], o.elev + ob.size[1]) - Math.max(item.elev, o.elev);
      if (vOverlap > 0.5) return `Overlaps ${o.name}`;
    }
  }
  return null;
}

export function isValid(ctx: PlaceCtx, item: Item): boolean {
  const m = mountOf(item);
  if (m === 'opening') return openingIssue(item, ctx.room, ctx.items) === null;
  const cols = worldColliders(item, ctx.room);
  for (const c of cols) {
    if (!quadInsideRoom(c.pts, ctx.room)) return false;
    if (c.y1 > ctx.room.wallHeight + 0.5 || c.y0 < -0.5) return false;
  }
  if (m === 'rug') return true;
  for (const o of ctx.others) if (colsOverlap(cols, o.cols)) return false;
  return true;
}

/** Height of the highest surface under a 'surface' item (gravity for small props). */
export function supportHeight(ctx: PlaceCtx, item: Item): number {
  const cols = worldColliders({ ...item, elev: 0 }, ctx.room);
  let best = 0;
  for (const o of ctx.others) {
    for (const oc of o.cols) {
      if (oc.y0 > 1200 || oc.y1 > 2400) continue;
      for (const c of cols) if (convexOverlap(c.pts, oc.pts, 0.5)) best = Math.max(best, oc.y1);
    }
  }
  return Math.round(best * 10) / 10;
}

/** Orient to the nearest wall (for wall-aligned items) and pull flush against walls within reach. */
export function snapToWalls(ctx: PlaceCtx, item: Item, align: boolean): Item {
  const def = DEFS[item.type];
  const m = mountOf(item);
  const b = getBuild(item, ctx.room);
  let it = item;
  const center = vec(it.x, it.y);
  const cands = ctx.walls
    .map((w) => ({ w, t: dot(sub(center, w.a), w.dir), d: dot(sub(center, w.a), w.n) }))
    .filter((c) => c.t > -150 && c.t < c.w.len + 150 && c.d > -100)
    .sort((a, c) => a.d - c.d);
  if (align && (def.wallAlign || m === 'wall') && cands.length) {
    const c = cands[0];
    const depth = b.bounds.max[2] - b.bounds.min[2];
    const reach = depth / 2 + (m === 'wall' ? 900 : 300);
    if (c.d < reach) it = { ...it, rot: wallRot(c.w) };
  }
  const snapD = m === 'wall' ? 500 : 110;
  let fp = footprint(it, ctx.room);
  const used: Vec2[] = [];
  for (const c of cands.slice(0, 4)) {
    if (used.length >= 2) break;
    if (used.some((n) => Math.abs(dot(n, c.w.n)) > 0.9)) continue;
    const ts = fp.map((p) => dot(sub(p, c.w.a), c.w.dir));
    if (Math.max(...ts) < 1 || Math.min(...ts) > c.w.len - 1) continue;
    const minD = Math.min(...fp.map((p) => dot(sub(p, c.w.a), c.w.n)));
    if (minD > 0.01 && minD < snapD) {
      const s = mul(c.w.n, -minD);
      it = { ...it, x: it.x + s.x, y: it.y + s.y };
      fp = fp.map((p) => add(p, s));
      used.push(c.w.n);
    } else if (Math.abs(minD) <= 0.01) used.push(c.w.n);
  }
  return it;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Sweep from `from` toward (tx, ty) in small steps and stop at the first contact, so fast drags
 * can't tunnel through other furniture. Assumes `from` is valid.
 */
function sweep(ctx: PlaceCtx, from: Item, tx: number, ty: number): Item {
  const L = Math.hypot(tx - from.x, ty - from.y);
  if (L < 0.05) return from;
  const at = (t: number) => ({ ...from, x: r1(from.x + (tx - from.x) * t), y: r1(from.y + (ty - from.y) * t) });
  const n = Math.max(1, Math.ceil(L / 35));
  let lo = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (isValid(ctx, at(t))) {
      lo = t;
      continue;
    }
    let hi = t;
    for (let k = 0; k < 10; k++) {
      const mid = (lo + hi) / 2;
      if (isValid(ctx, at(mid))) lo = mid;
      else hi = mid;
    }
    return at(lo);
  }
  return at(1);
}

/** Move toward the candidate, sliding along obstacles. Returns the furthest valid position. */
export function resolveMove(ctx: PlaceCtx, cur: Item, cand: Item): Item {
  if (!isValid(ctx, cur)) return cand;
  const start = { ...cur, elev: cand.elev };
  const straight = sweep(ctx, start, cand.x, cand.y);
  if (straight.x === cand.x && straight.y === cand.y) {
    // reached the spot with the old rotation; take the snapped rotation if it fits
    if (cand.rot !== cur.rot && isValid(ctx, cand)) return cand;
    return straight;
  }
  // blocked: slide x-then-y or y-then-x, keep whichever ends closest to the target
  const xy = sweep(ctx, start, cand.x, start.y);
  const yx = sweep(ctx, start, start.x, cand.y);
  const opts = [straight, sweep(ctx, xy, xy.x, cand.y), sweep(ctx, yx, cand.x, yx.y)];
  let best = straight;
  let bd = Infinity;
  for (const o of opts) {
    const d = dist(vec(o.x, o.y), vec(cand.x, cand.y));
    if (d < bd - 0.01) {
      bd = d;
      best = o;
    }
  }
  return best;
}

export interface MoveOpts {
  grid: number;
  walls: boolean;
  free?: boolean;
}

/** Full drag pipeline for a free-standing item. */
export function planMove(ctx: PlaceCtx, cur: Item, x: number, y: number, o: MoveOpts): Item {
  let cand: Item = { ...cur, x: snapTo(x, o.grid), y: snapTo(y, o.grid) };
  const m = mountOf(cur);
  if (o.walls && !o.free) cand = snapToWalls(ctx, cand, true);
  if (m === 'surface') {
    // small props hop onto whatever is below them instead of sliding
    cand = { ...cand, elev: supportHeight(ctx, cand) };
    return o.free || isValid(ctx, cand) || !isValid(ctx, cur) ? cand : cur;
  }
  if (o.free) return cand;
  return resolveMove(ctx, cur, cand);
}

/** Drag pipeline for doors / windows: slide along the nearest wall. */
export function planOpeningMove(ctx: PlaceCtx, cur: Item, x: number, y: number, grid: number): Item {
  const p = vec(x, y);
  let best: { w: Wall; t: number; d: number } | null = null;
  for (const w of ctx.walls) {
    const c = closestOnSegment(p, w.a, w.b);
    if (!best || c.d < best.d) best = { w, t: c.t * w.len, d: c.d };
  }
  if (!best) return cur;
  const b = getBuild(cur, ctx.room);
  const [c0, c1] = b.cut ?? [-b.size[0] / 2, b.size[0] / 2];
  const off = clamp(snapTo(best.t, grid), -c0, best.w.len - c1);
  const cand = syncOpening({ ...cur, wall: best.w.i, offset: off }, ctx.room);
  if (openingIssue(cand, ctx.room, ctx.items) === null) return cand;
  if (cur.wall === best.w.i) {
    const from = cur.offset ?? off;
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const t = syncOpening({ ...cur, offset: from + (off - from) * mid }, ctx.room);
      if (openingIssue(t, ctx.room, ctx.items) === null) lo = mid;
      else hi = mid;
    }
    return syncOpening({ ...cur, offset: r1(from + (off - from) * lo) }, ctx.room);
  }
  return cur;
}

/** Spiral / wall search for a free spot for a new or rotated item. */
export function findFreeSpot(ctx: PlaceCtx, item: Item, near?: Vec2, maxR = 9000): Item | null {
  const m = mountOf(item);
  const def = DEFS[item.type];
  const b = getBuild(item, ctx.room);
  if (m === 'opening') {
    const walls = ctx.walls.slice().sort((a, c) => c.len - a.len);
    for (const w of walls) {
      for (let s = 0; s <= w.len / 2; s += 50) {
        for (const sign of [1, -1]) {
          const cand = syncOpening({ ...item, wall: w.i, offset: Math.round(w.len / 2 + sign * s) }, ctx.room);
          if (openingIssue(cand, ctx.room, ctx.items) === null) return cand;
        }
      }
    }
    return null;
  }
  const start = near ?? centroid(ctx.room.points);
  const tryAt = (x: number, y: number, rot = item.rot) => {
    let cand: Item = { ...item, x: Math.round(x), y: Math.round(y), rot };
    if (m === 'surface') cand = { ...cand, elev: supportHeight(ctx, cand) };
    return isValid(ctx, cand) ? cand : null;
  };
  if (def.wallAlign || m === 'wall') {
    const depth = b.bounds.max[2] - b.bounds.min[2];
    const walls = ctx.walls.slice().sort((a, c) => dist(add(a.a, mul(a.dir, a.len / 2)), start) - dist(add(c.a, mul(c.dir, c.len / 2)), start));
    for (const w of walls) {
      for (let s = 0; s <= w.len / 2; s += 100) {
        for (const sign of [1, -1]) {
          const p = add(add(w.a, mul(w.dir, w.len / 2 + sign * s)), mul(w.n, depth / 2 + 1));
          let cand: Item = { ...item, x: p.x, y: p.y, rot: wallRot(w) };
          cand = snapToWalls(ctx, cand, false);
          const ok = tryAt(cand.x, cand.y, cand.rot);
          if (ok) return ok;
        }
      }
    }
  }
  for (let r = 0; r <= maxR; r += 100) {
    const n = Math.max(1, Math.floor((2 * Math.PI * r) / 150));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ok = tryAt(start.x + Math.cos(a) * r, start.y + Math.sin(a) * r);
      if (ok) return ok;
    }
  }
  return null;
}

export interface Issue {
  level: 'error' | 'warn';
  msg: string;
}

const analysisCache = new WeakMap<Doc, Map<string, Issue>>();

export function analyze(doc: Doc): Map<string, Issue> {
  const hit = analysisCache.get(doc);
  if (hit) return hit;
  const out = new Map<string, Issue>();
  const room = doc.room;
  const entries = doc.items
    .filter((it) => DEFS[it.type])
    .map((item) => ({ item, m: mountOf(item) as Mount, cols: worldColliders(item, room), soft: worldSoft(item, room) }));
  const set = (id: string, issue: Issue) => {
    const prev = out.get(id);
    if (!prev || (prev.level === 'warn' && issue.level === 'error')) out.set(id, issue);
  };
  for (const e of entries) {
    if (e.m === 'opening') {
      const iss = openingIssue(e.item, room, doc.items);
      if (iss) set(e.item.id, { level: 'error', msg: iss });
      continue;
    }
    if (e.cols.some((c) => !quadInsideRoom(c.pts, room))) set(e.item.id, { level: 'error', msg: 'Outside the room / into a wall' });
    else if (e.cols.some((c) => c.y1 > room.wallHeight + 0.5)) set(e.item.id, { level: 'error', msg: 'Taller than the ceiling' });
  }
  const solid = entries.filter((e) => e.m !== 'rug' && e.m !== 'opening');
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      if (colsOverlap(solid[i].cols, solid[j].cols)) {
        set(solid[i].item.id, { level: 'error', msg: `Overlaps ${solid[j].item.name}` });
        set(solid[j].item.id, { level: 'error', msg: `Overlaps ${solid[i].item.name}` });
      }
    }
  }
  for (const d of entries) {
    if (!d.soft.length) continue;
    for (const e of solid) {
      if (colsOverlap(d.soft, e.cols)) {
        set(e.item.id, { level: 'warn', msg: `Blocks the swing of ${d.item.name}` });
        set(d.item.id, { level: 'warn', msg: `Swing blocked by ${e.item.name}` });
      }
    }
  }
  analysisCache.set(doc, out);
  return out;
}

export interface Clearance {
  side: 'front' | 'back' | 'left' | 'right';
  from: Vec2;
  to: Vec2;
  d: number;
  wall: boolean;
}

/** Free distance from each side of an item to the nearest wall or obstacle. */
export function clearances(doc: Doc, item: Item, wallsOnly = false): Clearance[] {
  const room = doc.room;
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  const { min, max } = b.bounds;
  const y0 = item.elev + min[1], y1 = item.elev + max[1];
  const segs: { a: Vec2; b: Vec2; wall: boolean }[] = getWalls(room).map((w) => ({ a: w.a, b: w.b, wall: true }));
  if (!wallsOnly) {
    for (const o of doc.items) {
      if (o.id === item.id || !DEFS[o.type]) continue;
      const m = mountOf(o);
      if (m === 'rug' || m === 'opening') continue;
      for (const c of worldColliders(o, room)) {
        if (c.y1 <= y0 + 0.5 || c.y0 >= y1 - 0.5) continue;
        for (let i = 0; i < 4; i++) segs.push({ a: c.pts[i], b: c.pts[(i + 1) % 4], wall: false });
      }
    }
  }
  const sides: { side: Clearance['side']; dir: Vec2; pts: (t: number) => Vec2 }[] = [
    { side: 'front', dir: vec(0, 1), pts: (t) => vec(min[0] + (max[0] - min[0]) * t, max[2]) },
    { side: 'back', dir: vec(0, -1), pts: (t) => vec(min[0] + (max[0] - min[0]) * t, min[2]) },
    { side: 'right', dir: vec(1, 0), pts: (t) => vec(max[0], min[2] + (max[2] - min[2]) * t) },
    { side: 'left', dir: vec(-1, 0), pts: (t) => vec(min[0], min[2] + (max[2] - min[2]) * t) },
  ];
  const out: Clearance[] = [];
  for (const s of sides) {
    const dir = rotPt(s.dir, pose.rot);
    let best: Clearance | null = null;
    for (const t of [0.5, 0.08, 0.92, 0.3, 0.7]) {
      const lp = s.pts(t);
      const o = toPlan(pose, lp.x, lp.y);
      // start slightly behind the face so obstacles we are touching still register (as 0)
      const o2 = sub(o, mul(dir, 2));
      for (const sg of segs) {
        const d0 = raySegment(o2, dir, sg.a, sg.b);
        if (d0 === null || d0 > 8002) continue;
        const d = Math.max(0, d0 - 2);
        if (!best || d < best.d - 0.5) best = { side: s.side, from: o, to: add(o, mul(dir, d)), d, wall: sg.wall };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

/** After a resize, keep the sides that were flush against a wall still flush. */
export function anchorResize(doc: Doc, before: Item, after: Item): Item {
  const room = doc.room;
  if (mountOf(before) === 'opening') return after;
  const touching = new Set(clearances(doc, before, true).filter((c) => c.d < 2).map((c) => c.side));
  if (!touching.size) return after;
  const b0 = getBuild(before, room).bounds;
  const b1 = getBuild(after, room).bounds;
  let lx = 0, lz = 0;
  if (touching.has('back')) lz = b0.min[2] - b1.min[2];
  else if (touching.has('front')) lz = b0.max[2] - b1.max[2];
  if (touching.has('left') && !touching.has('right')) lx = b0.min[0] - b1.min[0];
  else if (touching.has('right') && !touching.has('left')) lx = b0.max[0] - b1.max[0];
  const s = rotPt(vec(lx, lz), after.rot);
  return { ...after, x: r1(after.x + s.x), y: r1(after.y + s.y) };
}

/**
 * Free distance to the left and right of an item: walls and furniture, plus any door or window in
 * the wall behind it that overlaps its height (so a stretched bookcase never covers an opening).
 */
export function freeSpan(doc: Doc, item: Item): { left: number; right: number } {
  const cl = clearances(doc, item);
  let left = cl.find((c) => c.side === 'left')?.d ?? Infinity;
  let right = cl.find((c) => c.side === 'right')?.d ?? Infinity;
  const room = doc.room;
  const back = clearances(doc, item, true).find((c) => c.side === 'back');
  if (!back || back.d > 5) return { left, right };
  const w = getWalls(room).find((wl) => {
    const t = dot(sub(back.to, wl.a), wl.dir);
    return Math.abs(dot(sub(back.to, wl.a), wl.n)) < 1 && t > -1 && t < wl.len + 1;
  });
  if (!w) return { left, right };
  const b = getBuild(item, room);
  const pose = poseOf(item, room);
  const { min, max } = b.bounds;
  const tA = dot(sub(toPlan(pose, min[0], min[2]), w.a), w.dir);
  const tB = dot(sub(toPlan(pose, max[0], min[2]), w.a), w.dir);
  const lo = Math.min(tA, tB), hi = Math.max(tA, tB);
  const y0 = item.elev, y1 = item.elev + b.size[1];
  let gapLo = Infinity, gapHi = Infinity;
  for (const o of doc.items) {
    if (o.wall !== w.i || !DEFS[o.type] || mountOf(o) !== 'opening') continue;
    const ob = getBuild(o, room);
    const [c0, c1] = ob.cut ?? [-ob.size[0] / 2, ob.size[0] / 2];
    const a = (o.offset ?? 0) + c0, e = (o.offset ?? 0) + c1;
    if (Math.min(y1, o.elev + ob.size[1]) - Math.max(y0, o.elev) <= 0) continue;
    if (e <= lo + 0.5) gapLo = Math.min(gapLo, lo - e);
    if (a >= hi - 0.5) gapHi = Math.min(gapHi, a - hi);
  }
  // local +x runs along the wall direction when the item's x axis agrees with it
  const along = dot(rotPt(vec(1, 0), pose.rot), w.dir) > 0;
  left = Math.min(left, along ? gapLo : gapHi);
  right = Math.min(right, along ? gapHi : gapLo);
  return { left, right };
}

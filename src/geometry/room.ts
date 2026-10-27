import type { Room, Vec2 } from '../types';
import { add, clipHalfPlane, cross, dist, dot, mul, norm, signedArea, sub, vec } from './math';

export interface Wall {
  i: number;
  a: Vec2;
  b: Vec2;
  dir: Vec2;
  /** Unit normal pointing into the room. */
  n: Vec2;
  len: number;
  /** Outer face end points (mitred). */
  oa: Vec2;
  ob: Vec2;
}

const wallCache = new WeakMap<Room, Wall[]>();

export function getWalls(room: Room): Wall[] {
  const hit = wallCache.get(room);
  if (hit) return hit;
  const pts = room.points;
  const cw = signedArea(pts) > 0;
  const T = room.wallThickness;
  const n = pts.length;
  const base = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const dir = norm(sub(b, a));
    const inward = cw ? vec(-dir.y, dir.x) : vec(dir.y, -dir.x);
    return { a, b, dir, n: inward, len: dist(a, b) };
  });
  const outer = outerPoints(base, T);
  const walls = base.map((w, i) => ({ ...w, i, oa: outer[i], ob: outer[(i + 1) % n] }));
  wallCache.set(room, walls);
  return walls;
}

/** Outer polygon point for each room corner: intersection of the two neighbouring offset wall lines. */
function outerPoints(base: { a: Vec2; dir: Vec2; n: Vec2 }[], T: number): Vec2[] {
  const n = base.length;
  return base.map((w, i) => {
    const prev = base[(i - 1 + n) % n];
    const p1 = add(prev.a, mul(prev.n, -T));
    const p2 = add(w.a, mul(w.n, -T));
    const den = cross(prev.dir, w.dir);
    if (Math.abs(den) < 1e-6) return add(w.a, mul(w.n, -T));
    const t = cross(sub(p2, p1), w.dir) / den;
    const p = add(p1, mul(prev.dir, t));
    // limit very sharp mitres
    const corner = w.a;
    if (dist(p, corner) > T * 4) return add(corner, mul(norm(sub(p, corner)), T * 4));
    return p;
  });
}

export function outerPolygon(room: Room): Vec2[] {
  return getWalls(room).map((w) => w.oa);
}

export interface WallHole {
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

export interface WallPiece {
  poly: Vec2[];
  y0: number;
  y1: number;
}

/** Split a wall prism into solid pieces around openings. */
export function wallPieces(w: Wall, holes: WallHole[], H: number): WallPiece[] {
  const quad = [w.a, w.b, w.ob, w.oa];
  const base = dot(w.a, w.dir);
  const clip = (t0: number | null, t1: number | null) => {
    let poly = quad;
    if (t0 !== null) poly = clipHalfPlane(poly, w.dir, base + t0);
    if (t1 !== null) poly = clipHalfPlane(poly, mul(w.dir, -1), -(base + t1));
    return poly;
  };
  const sorted = holes
    .map((h) => ({ ...h, t0: Math.max(0, h.t0), t1: Math.min(w.len, h.t1), y1: Math.min(H, h.y1) }))
    .filter((h) => h.t1 > h.t0)
    .sort((a, b) => a.t0 - b.t0);
  const pieces: WallPiece[] = [];
  let cursor: number | null = null;
  for (const h of sorted) {
    if (cursor === null || h.t0 > cursor + 0.5) {
      const poly = clip(cursor, h.t0);
      if (poly.length >= 3) pieces.push({ poly, y0: 0, y1: H });
    }
    const poly = clip(h.t0, h.t1);
    if (poly.length >= 3) {
      if (h.y0 > 0.5) pieces.push({ poly, y0: 0, y1: h.y0 });
      if (h.y1 < H - 0.5) pieces.push({ poly, y0: h.y1, y1: H });
    }
    cursor = cursor === null ? h.t1 : Math.max(cursor, h.t1);
  }
  const tail = clip(cursor, null);
  if (tail.length >= 3) pieces.push({ poly: tail, y0: 0, y1: H });
  return pieces;
}

/**
 * Change one wall's length. Points after the wall are shifted along the wall direction until a
 * wall parallel to it absorbs the change, which keeps rectangular / orthogonal rooms square.
 */
export function setWallLength(points: Vec2[], i: number, newLen: number): Vec2[] {
  const n = points.length;
  const a = points[i];
  const b = points[(i + 1) % n];
  const d = norm(sub(b, a));
  const delta = mul(d, newLen - dist(a, b));
  const out = points.slice();
  let j = (i + 1) % n;
  for (let steps = 0; steps < n - 1; steps++) {
    out[j] = add(out[j], delta);
    const k = (j + 1) % n;
    if (k === i) break;
    const wd = norm(sub(points[k], points[j]));
    if (Math.abs(cross(wd, d)) < 0.02) break;
    j = k;
  }
  return out;
}

export function rectRoom(w: number, d: number): Vec2[] {
  return [vec(0, 0), vec(w, 0), vec(w, d), vec(0, d)];
}

export function lRoom(w: number, d: number, cw: number, cd: number): Vec2[] {
  return [vec(0, 0), vec(w - cw, 0), vec(w - cw, cd), vec(w, cd), vec(w, d), vec(0, d)];
}

export function roomArea(room: Room) {
  return Math.abs(signedArea(room.points));
}

export function roomPerimeter(room: Room) {
  return getWalls(room).reduce((s, w) => s + w.len, 0);
}

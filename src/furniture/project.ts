import { convexHull } from '../geometry/math';
import type { BuildResult, Prim, V3, View } from './types';

/** 2D shape in view space (u right, v down), tagged with depth for painter's ordering. */
export type Shape2 =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r: number; depth: number; mat: string }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; depth: number; mat: string }
  | { t: 'poly'; pts: [number, number][]; depth: number; mat: string };

/** Map a local 3D point to (u, v-down, depth-toward-viewer). */
const MAP: Record<View, (p: V3) => [number, number, number]> = {
  top: ([x, y, z]) => [x, z, y],
  front: ([x, y, z]) => [x, -y, z],
  side: ([x, y, z]) => [-z, -y, x],
};

/** Euler XYZ rotation (same convention as three.js). */
function rotate(p: V3, r?: V3): V3 {
  if (!r) return p;
  let [x, y, z] = p;
  const [rx, ry, rz] = r;
  // three.js 'XYZ' order: v' = Rx * Ry * Rz * v
  if (rz) {
    const c = Math.cos(rz), s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  if (ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (rx) {
    const c = Math.cos(rx), s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  return [x, y, z];
}

const hasRot = (r?: V3) => !!r && (Math.abs(r[0]) > 1e-6 || Math.abs(r[1]) > 1e-6 || Math.abs(r[2]) > 1e-6);

/** Sample points of a primitive in item-local space. */
export function primPoints(pr: Prim): V3[] {
  const out: V3[] = [];
  const [px, py, pz] = pr.pos;
  if (pr.kind === 'box') {
    const [w, h, d] = pr.size;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const q = rotate([(sx * w) / 2, (sy * h) / 2, (sz * d) / 2], pr.rot);
      out.push([q[0] + px, q[1] + py, q[2] + pz]);
    }
  } else if (pr.kind === 'cyl') {
    const n = 20;
    const rzr = pr.rz ? pr.rz / pr.r : 1;
    for (const [yy, rr] of [[-pr.len / 2, pr.r], [pr.len / 2, pr.r2 ?? pr.r]] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let q: V3 = [Math.cos(a) * rr, yy, Math.sin(a) * rr * rzr];
        if (pr.axis === 'x') q = [q[1], -q[0], q[2]];
        else if (pr.axis === 'z') q = [q[0], -q[2], q[1]];
        q = rotate(q, pr.rot);
        out.push([q[0] + px, q[1] + py, q[2] + pz]);
      }
    }
  } else {
    const [sx, sy, sz] = pr.scale ?? [1, 1, 1];
    for (let i = 0; i < 6; i++) {
      const lat = -Math.PI / 2 + (i / 5) * Math.PI;
      for (let j = 0; j < 12; j++) {
        const lon = (j / 12) * Math.PI * 2;
        out.push([px + Math.cos(lat) * Math.cos(lon) * pr.r * sx, py + Math.sin(lat) * pr.r * sy, pz + Math.cos(lat) * Math.sin(lon) * pr.r * sz]);
      }
    }
  }
  return out;
}

function projectPrim(pr: Prim, view: View): Shape2 | null {
  const map = MAP[view];
  const pts = primPoints(pr).map(map);
  let dmax = -Infinity;
  for (const p of pts) dmax = Math.max(dmax, p[2]);
  const depth = dmax;
  // simple cases: unrotated boxes → rect; cylinders seen along their axis / spheres → ellipse
  if (pr.kind === 'box' && !hasRot(pr.rot)) {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const [u, v] of pts) {
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    return { t: 'rect', x: minU, y: minV, w: maxU - minU, h: maxV - minV, r: pr.r ?? 0, depth, mat: pr.mat };
  }
  const alongView = (pr.kind === 'cyl' && !hasRot(pr.rot) && ((view === 'top' && pr.axis === 'y') || (view === 'front' && pr.axis === 'z') || (view === 'side' && pr.axis === 'x'))) || (pr.kind === 'sphere');
  if (alongView) {
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const [u, v] of pts) {
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    return { t: 'ellipse', cx: (minU + maxU) / 2, cy: (minV + maxV) / 2, rx: (maxU - minU) / 2, ry: (maxV - minV) / 2, depth, mat: pr.mat };
  }
  const hull = convexHull(pts.map(([u, v]) => [u, v]));
  if (hull.length < 3) return null;
  return { t: 'poly', pts: hull, depth, mat: pr.mat };
}

/** Project all primitives of a build into a view, sorted far → near. Cached on the build. */
export function projectBuild(b: BuildResult, view: View): Shape2[] {
  const anyB = b as BuildResult & { _proj?: Partial<Record<View, Shape2[]>> };
  anyB._proj ??= {};
  const hit = anyB._proj[view];
  if (hit) return hit;
  const shapes = b.prims.map((p) => projectPrim(p, view)).filter((s): s is Shape2 => !!s);
  shapes.sort((a, c) => a.depth - c.depth);
  anyB._proj[view] = shapes;
  return shapes;
}

export function shapesExtent(shapes: Shape2[]) {
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const s of shapes) {
    if (s.t === 'rect') {
      minU = Math.min(minU, s.x); maxU = Math.max(maxU, s.x + s.w);
      minV = Math.min(minV, s.y); maxV = Math.max(maxV, s.y + s.h);
    } else if (s.t === 'ellipse') {
      minU = Math.min(minU, s.cx - s.rx); maxU = Math.max(maxU, s.cx + s.rx);
      minV = Math.min(minV, s.cy - s.ry); maxV = Math.max(maxV, s.cy + s.ry);
    } else {
      for (const [u, v] of s.pts) {
        minU = Math.min(minU, u); maxU = Math.max(maxU, u);
        minV = Math.min(minV, v); maxV = Math.max(maxV, v);
      }
    }
  }
  return { minU, minV, maxU, maxV };
}

export function shapeSvg(s: Shape2, attrs: string): string {
  const f = (n: number) => +n.toFixed(2);
  if (s.t === 'rect') {
    const r = Math.min(s.r, s.w / 2, s.h / 2);
    return `<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}"${r > 0 ? ` rx="${f(r)}"` : ''} ${attrs}/>`;
  }
  if (s.t === 'ellipse') return `<ellipse cx="${f(s.cx)}" cy="${f(s.cy)}" rx="${f(s.rx)}" ry="${f(s.ry)}" ${attrs}/>`;
  return `<polygon points="${s.pts.map(([u, v]) => `${f(u)},${f(v)}`).join(' ')}" ${attrs}/>`;
}

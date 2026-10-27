import type { BoxPrim, BuildResult, Collider, CylPrim, DimAnno, ParamDef, Params, PlanSymbol, Prim, V3, View } from './types';

const order = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a]);

/** Small builder used by every generator: primitives, colliders and dimension annotations. */
export class Kit {
  prims: Prim[] = [];
  colliders: Collider[] = [];
  soft: Collider[] = [];
  dims: DimAnno[] = [];
  symbol: PlanSymbol[] = [];
  lights: { pos: V3; color: string; intensity: number }[] = [];

  /** Box from min/max corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: string, o: Partial<BoxPrim> = {}) {
    const [ax, bx] = order(x0, x1);
    const [ay, by] = order(y0, y1);
    const [az, bz] = order(z0, z1);
    if (bx - ax < 0.5 || by - ay < 0.5 || bz - az < 0.5) return;
    this.prims.push({ kind: 'box', pos: [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], size: [bx - ax, by - ay, bz - az], mat, ...o });
  }

  /** Box from centre and size. */
  boxC(cx: number, cy: number, cz: number, w: number, h: number, d: number, mat: string, o: Partial<BoxPrim> = {}) {
    if (w < 0.5 || h < 0.5 || d < 0.5) return;
    this.prims.push({ kind: 'box', pos: [cx, cy, cz], size: [w, h, d], mat, ...o });
  }

  /** Vertical cylinder standing on y0. */
  cylY(cx: number, y0: number, cz: number, r: number, h: number, mat: string, o: Partial<CylPrim> = {}) {
    if (h < 0.5 || r < 0.5) return;
    this.prims.push({ kind: 'cyl', pos: [cx, y0 + h / 2, cz], r, len: h, axis: 'y', mat, ...o });
  }

  /** Cylinder centred at a point along an axis. */
  cyl(cx: number, cy: number, cz: number, r: number, len: number, axis: 'x' | 'y' | 'z', mat: string, o: Partial<CylPrim> = {}) {
    if (len < 0.5 || r < 0.5) return;
    this.prims.push({ kind: 'cyl', pos: [cx, cy, cz], r, len, axis, mat, ...o });
  }

  sphere(cx: number, cy: number, cz: number, r: number, mat: string, scale?: V3) {
    this.prims.push({ kind: 'sphere', pos: [cx, cy, cz], r, mat, scale });
  }

  light(x: number, y: number, z: number, intensity = 4, color = '#ffd8a8') {
    this.lights.push({ pos: [x, y, z], color, intensity });
  }

  col(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const [ax, bx] = order(x0, x1);
    const [ay, by] = order(y0, y1);
    const [az, bz] = order(z0, z1);
    this.colliders.push({ min: [ax, ay, az], max: [bx, by, bz] });
  }

  softCol(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const [ax, bx] = order(x0, x1);
    const [ay, by] = order(y0, y1);
    const [az, bz] = order(z0, z1);
    this.soft.push({ min: [ax, ay, az], max: [bx, by, bz] });
  }

  h(view: View, a: number, b: number, at: number, level: number, label?: string) {
    if (Math.abs(b - a) < 1) return;
    this.dims.push({ view, dir: 'h', a, b, at, level, label });
  }

  v(view: View, a: number, b: number, at: number, level: number, label?: string) {
    if (Math.abs(b - a) < 1) return;
    this.dims.push({ view, dir: 'v', a, b, at, level, label });
  }

  done(size: V3, extra: Partial<BuildResult> = {}): BuildResult {
    const [W, H, D] = size;
    const bounds = extra.bounds ?? { min: [-W / 2, 0, -D / 2] as V3, max: [W / 2, H, D / 2] as V3 };
    return {
      prims: this.prims,
      colliders: this.colliders.length ? this.colliders : [{ min: bounds.min, max: bounds.max }],
      soft: this.soft,
      size,
      dims: this.dims,
      symbol: this.symbol,
      lights: this.lights,
      ...extra,
      bounds,
    };
  }
}

/** Deterministic pseudo-random generator so procedural details stay stable between rebuilds. */
export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const BOOK_COLORS = ['#8c2f39', '#2f5d8c', '#c9a227', '#3f7d4e', '#5b4a8b', '#d9d2c3', '#b5542f', '#1f3b4d', '#7a8b99', '#a33b5b'];
export const CLOTH_COLORS = ['#3e4a5c', '#8a9bb0', '#d8d2c4', '#6b4f4f', '#2f2f35', '#a7b59a', '#c47f5e', '#f0ece4'];

export const FINISH_OPTIONS: [string, string][] = [
  ['wood', 'Wood'],
  ['matte', 'Matte paint'],
  ['gloss', 'Gloss lacquer'],
  ['fabric', 'Fabric'],
  ['leather', 'Leather'],
  ['metal', 'Metal'],
];

export const finishParam = (key: string, label: string, show?: (p: Params) => boolean): ParamDef => ({
  key, label, type: 'select', options: FINISH_OPTIONS, group: 'Colours', show,
});

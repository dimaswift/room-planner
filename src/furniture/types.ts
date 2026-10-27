export type V3 = [number, number, number];
export type Mount = 'floor' | 'surface' | 'wall' | 'rug' | 'opening';
export type View = 'top' | 'front' | 'side';
export type Params = Record<string, any>;

/**
 * Materials are palette keys ('body', 'accent', 'metal', 'glass', ...) or literal '#rrggbb' colours.
 * 'body' / 'accent' / 'third' resolve to the item's color / color2 / color3 params.
 */
export interface BoxPrim {
  kind: 'box';
  pos: V3;
  size: V3;
  rot?: V3;
  /** Corner radius (rounded box). */
  r?: number;
  mat: string;
  edges?: boolean;
}

export interface CylPrim {
  kind: 'cyl';
  pos: V3;
  /** Radius at the negative end of the axis. */
  r: number;
  /** Radius at the positive end of the axis (defaults to r). */
  r2?: number;
  len: number;
  axis: 'x' | 'y' | 'z';
  /** Elliptic cross-section: radius along z (axis 'y' only). */
  rz?: number;
  rot?: V3;
  mat: string;
  seg?: number;
}

export interface SpherePrim {
  kind: 'sphere';
  pos: V3;
  r: number;
  scale?: V3;
  mat: string;
}

export type Prim = BoxPrim | CylPrim | SpherePrim;

/** Axis-aligned box in item-local space. */
export interface Collider {
  min: V3;
  max: V3;
}

/**
 * Dimension annotation for item drawings.
 * h: a..b along the view's horizontal axis, extension lines start at vertical coordinate `at`.
 * v: a..b along the view's vertical axis, extension lines start at horizontal coordinate `at`.
 * View coordinates: front (u=x, v=y up), side from the right (u=-z, v=y up), top (u=x, v=z down).
 * level: h → negative below / positive above the view; v → negative left / positive right.
 */
export interface DimAnno {
  view: View;
  dir: 'h' | 'v';
  a: number;
  b: number;
  at: number;
  level: number;
  label?: string;
}

/** Plan-only line work in item-local plan coords (x, z). */
export interface PlanSymbol {
  d: string;
  dashed?: boolean;
}

export interface BuildResult {
  prims: Prim[];
  colliders: Collider[];
  /** Zones that should stay clear (door swing). Overlaps are warnings, not errors. */
  soft: Collider[];
  /** Nominal W, H, D. */
  size: V3;
  bounds: { min: V3; max: V3 };
  dims: DimAnno[];
  symbol: PlanSymbol[];
  /** Openings: wall gap along local x. */
  cut?: [number, number];
  /** Short human description of key sizes for schedules. */
  note?: string;
}

export interface BuildCtx {
  wallThickness: number;
  wallHeight: number;
}

export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'int' | 'select' | 'bool' | 'color' | 'cells';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: [string, string][];
  group?: string;
  hint?: string;
  show?: (p: Params) => boolean;
}

export interface Preset {
  name: string;
  params: Params;
  elev?: number;
}

export interface FurnitureDef {
  type: string;
  label: string;
  category: string;
  mount: Mount | ((p: Params) => Mount);
  /** Turn the item's back to a wall when dragged close to it. */
  wallAlign?: boolean;
  defaultElev?: number | ((p: Params) => number);
  params: ParamDef[];
  defaults: Params;
  presets: Preset[];
  build(p: Params, ctx: BuildCtx): BuildResult;
}

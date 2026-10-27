import type { Item, Room } from '../types';
import { bed } from './bed';
import { cabinet } from './cabinet';
import { appliance, floorLamp, plant, rug, tableLamp, tv } from './decor';
import { door, windowDef } from './openings';
import { sofa } from './sofa';
import { chair, desk, table } from './tables';
import type { BuildResult, FurnitureDef, Mount, Params } from './types';

export const DEFS: Record<string, FurnitureDef> = Object.fromEntries(
  [sofa, chair, bed, cabinet, desk, table, door, windowDef, rug, floorLamp, tableLamp, plant, tv, appliance].map((d) => [d.type, d]),
);

export const CATEGORIES = ['Seating', 'Bedroom', 'Storage', 'Tables & desks', 'Doors & windows', 'Kitchen & bath', 'Decor'];

export function fullParams(item: Pick<Item, 'type' | 'params'>): Params {
  return { ...DEFS[item.type].defaults, ...item.params };
}

export function mountOf(item: Pick<Item, 'type' | 'params'>): Mount {
  const def = DEFS[item.type];
  return typeof def.mount === 'function' ? def.mount(fullParams(item)) : def.mount;
}

export function defaultElev(type: string, params: Params): number {
  const def = DEFS[type];
  const p = { ...def.defaults, ...params };
  if (def.defaultElev === undefined) return 0;
  return typeof def.defaultElev === 'function' ? def.defaultElev(p) : def.defaultElev;
}

const cache = new Map<string, BuildResult>();

export function getBuild(item: Pick<Item, 'type' | 'params'>, room: Pick<Room, 'wallThickness' | 'wallHeight'>): BuildResult {
  const def = DEFS[item.type];
  const opening = def.mount === 'opening';
  const key = item.type + '|' + JSON.stringify(item.params) + (opening ? `|${room.wallThickness}|${room.wallHeight}` : '');
  let b = cache.get(key);
  if (!b) {
    b = def.build(fullParams(item), { wallThickness: room.wallThickness, wallHeight: room.wallHeight });
    cache.set(key, b);
    if (cache.size > 600) cache.delete(cache.keys().next().value!);
  }
  return b;
}

/** Human-readable W × D × H string. */
export function sizeLabel(b: BuildResult) {
  const [W, H, D] = b.size;
  return `${Math.round(W)} × ${Math.round(D)} × ${Math.round(H)}`;
}

/** Palette for non-parametric materials. */
export const PALETTE: Record<string, { color: string; kind?: 'glass' | 'metal' | 'emissive' | 'gloss' | 'water' }> = {
  metal: { color: '#a6abb2', kind: 'metal' },
  dark: { color: '#2b2c30' },
  white: { color: '#f5f5f2' },
  glass: { color: '#cde6f2', kind: 'glass' },
  water: { color: '#bfdff0', kind: 'water' },
  mattress: { color: '#f3f0e9' },
  pillow: { color: '#fbfaf7' },
  screen: { color: '#121416', kind: 'gloss' },
  shade: { color: '#f3ead7', kind: 'emissive' },
  bulb: { color: '#fff4d6', kind: 'emissive' },
  leaf2: { color: '#3c7431' },
  soil: { color: '#4b3a2c' },
  trunk: { color: '#6b4e36' },
  porcelain: { color: '#fafaf8', kind: 'gloss' },
  basin: { color: '#e6ecef', kind: 'gloss' },
};

/** Resolve a primitive material reference to a colour for this item's params. */
export function matColor(mat: string, p: Params): string {
  if (mat.startsWith('#')) return mat;
  if (mat === 'body') return p.color ?? '#cccccc';
  if (mat === 'accent') return p.color2 ?? p.color ?? '#999999';
  if (mat === 'third') return p.color3 ?? '#999999';
  if (mat === 'shade') return p.color ?? PALETTE.shade.color;
  return PALETTE[mat]?.color ?? '#cccccc';
}

export function matKind(mat: string, p: Params) {
  if (mat === 'shade') return 'emissive' as const;
  return PALETTE[mat]?.kind;
}

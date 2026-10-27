import type { Item, Room } from '../types';
import { bed } from './bed';
import { cabinet } from './cabinet';
import { appliance, floorLamp, plant, rug, tableLamp, tv } from './decor';
import { door, windowDef } from './openings';
import { cart, pendant, wallShelf } from './shelves';
import { sofa } from './sofa';
import { chair, desk, table } from './tables';
import type { BuildResult, FurnitureDef, Mount, Params } from './types';

export const DEFS: Record<string, FurnitureDef> = Object.fromEntries(
  [sofa, chair, bed, cabinet, wallShelf, cart, desk, table, door, windowDef, rug, floorLamp, tableLamp, pendant, plant, tv, appliance].map((d) => [d.type, d]),
);

export const CATEGORIES = ['Seating', 'Bedroom', 'Storage', 'Tables & desks', 'Doors & windows', 'Kitchen & bath', 'Decor'];

export function fullParams(item: Pick<Item, 'type' | 'params'>): Params {
  return { ...DEFS[item.type].defaults, ...item.params };
}

export function mountOf(item: Pick<Item, 'type' | 'params'>): Mount {
  const def = DEFS[item.type];
  return typeof def.mount === 'function' ? def.mount(fullParams(item)) : def.mount;
}

/** Elevation for an item given the room (ceiling items hang down from the ceiling). */
export function elevFor(item: Pick<Item, 'type' | 'params' | 'elev'>, room: Pick<Room, 'wallThickness' | 'wallHeight'>): number {
  if (mountOf(item) !== 'ceiling') return item.elev;
  return Math.max(0, room.wallHeight - getBuild(item, room).size[1]);
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
export const PALETTE: Record<string, { color: string; kind?: string }> = {
  metal: { color: '#a6abb2', kind: 'metal' },
  dark: { color: '#2b2c30', kind: 'matte' },
  white: { color: '#f5f5f2' },
  glass: { color: '#cde6f2', kind: 'glass' },
  water: { color: '#bfdff0', kind: 'water' },
  mattress: { color: '#f3f0e9', kind: 'fabric' },
  pillow: { color: '#fbfaf7', kind: 'fabric' },
  screen: { color: '#121416', kind: 'gloss' },
  shade: { color: '#f3ead7', kind: 'emissive' },
  bulb: { color: '#fff4d6', kind: 'emissive' },
  leaf2: { color: '#3c7431' },
  soil: { color: '#4b3a2c' },
  trunk: { color: '#6b4e36', kind: 'wood' },
  porcelain: { color: '#fafaf8', kind: 'gloss' },
  basin: { color: '#e6ecef', kind: 'gloss' },
  paper: { color: '#efe8d8' },
};

/**
 * Resolve a primitive material reference for this item's params.
 * 'body' / 'accent' / 'third' → color/color2/color3 with finish/finish2/finish3;
 * 'kind:#rrggbb' → explicit finish; 'tex:pattern|c1|c2' → patterned (rugs); palette keys; '#rrggbb'.
 */
export function resolveMat(mat: string, p: Params): { color: string; kind?: string } {
  if (mat.startsWith('tex:')) return { color: mat.slice(4).split('|')[1] ?? '#cccccc', kind: mat };
  const ci = mat.indexOf(':#');
  if (ci > 0) return { color: mat.slice(ci + 1), kind: mat.slice(0, ci) };
  if (mat.startsWith('#')) return { color: mat };
  if (mat === 'body') return { color: p.color ?? '#cccccc', kind: p.finish };
  if (mat === 'accent') return { color: p.color2 ?? p.color ?? '#999999', kind: p.finish2 ?? p.finish };
  if (mat === 'third') return { color: p.color3 ?? '#999999', kind: p.finish3 };
  if (mat === 'shade') return { color: p.color ?? PALETTE.shade.color, kind: 'emissive' };
  const pal = PALETTE[mat];
  return { color: pal?.color ?? '#cccccc', kind: pal?.kind };
}

export const matColor = (mat: string, p: Params) => resolveMat(mat, p).color;

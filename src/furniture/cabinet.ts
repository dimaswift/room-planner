import { CLOTH_COLORS, Kit, finishParam, rng } from './kit';
import { PALETTE_OPTIONS, STYLE_OPTIONS, fillShelf, type Content } from './fill';
import type { FurnitureDef, Params } from './types';

export type CellType = 'open' | 'books' | 'mixed' | 'decor' | 'door' | 'glass' | 'drawer' | 'rail';
export interface CabCell { h: number; t: CellType }
export interface CabCol { w: number; cells: CabCell[] }
export interface CabLayout { cols: CabCol[] }

export const CELL_TYPES: { t: CellType; label: string; short: string }[] = [
  { t: 'open', label: 'Open shelf', short: 'Open' },
  { t: 'books', label: 'Books', short: 'Books' },
  { t: 'mixed', label: 'Books with decor', short: 'Mixed' },
  { t: 'decor', label: 'Decor objects', short: 'Decor' },
  { t: 'door', label: 'Door', short: 'Door' },
  { t: 'glass', label: 'Glass door', short: 'Glass' },
  { t: 'drawer', label: 'Drawer', short: 'Drawer' },
  { t: 'rail', label: 'Hanging rail', short: 'Rail' },
];

export function uniformLayout(cols: number, rows: number, t: CellType = 'open', prev?: CabLayout): CabLayout {
  return {
    cols: Array.from({ length: cols }, (_, c) => ({
      w: 1,
      cells: Array.from({ length: rows }, (_, r) => ({ h: 1, t: prev?.cols[c]?.cells[r]?.t ?? prev?.cols[c]?.cells.at(-1)?.t ?? prev?.cols[0]?.cells[r]?.t ?? t })),
    })),
  };
}

const L = (spec: string[][], widths?: number[], heights?: number[][]): CabLayout => ({
  cols: spec.map((col, c) => ({
    w: widths?.[c] ?? 1,
    cells: col.map((t, r) => ({ t: t as CellType, h: heights?.[c]?.[r] ?? 1 })),
  })),
});

export const placementOf = (p: Params): 'floor' | 'wall' | 'surface' => p.placement ?? (p.wallMounted ? 'wall' : 'floor');

export interface CellRect { col: number; idx: number; x0: number; x1: number; y0: number; y1: number; t: CellType }

/** Resolve the layout into clear cell rectangles in local coordinates (front view). */
export function cabinetCells(p: Params) {
  const W = p.width, H = p.height, t = p.board;
  const f = p.frame ?? t;
  const baseH = placementOf(p) !== 'floor' || p.base === 'none' ? 0 : p.baseHeight;
  const ctT = p.countertop ? p.topThickness : 0;
  const yTop = H - ctT;
  const layout: CabLayout = p.layout?.cols?.length ? p.layout : uniformLayout(1, 1);
  const nc = layout.cols.length;
  const xi0 = -W / 2 + f;
  const availW = W - 2 * f - (nc - 1) * f;
  const sumW = layout.cols.reduce((s, c) => s + Math.max(0.01, c.w), 0);
  const yi0 = baseH + t, yi1 = yTop - t;
  const cells: CellRect[] = [];
  const cols: { x0: number; x1: number }[] = [];
  let x = xi0;
  layout.cols.forEach((col, ci) => {
    const cw = (availW * Math.max(0.01, col.w)) / sumW;
    const x0 = x, x1 = x + cw;
    cols.push({ x0, x1 });
    const m = col.cells.length;
    const availH = yi1 - yi0 - (m - 1) * t;
    const sumH = col.cells.reduce((s, c) => s + Math.max(0.01, c.h), 0);
    let y = yi1;
    col.cells.forEach((cell, ri) => {
      const ch = (availH * Math.max(0.01, cell.h)) / sumH;
      cells.push({ col: ci, idx: ri, x0, x1, y0: y - ch, y1: y, t: cell.t });
      y -= ch + t;
    });
    x = x1 + f;
  });
  return { cells, cols, baseH, yTop, yi0, yi1, layout, frame: f };
}

const showFloor = (p: Params) => placementOf(p) === 'floor';

export const cabinet: FurnitureDef = {
  type: 'cabinet',
  label: 'Shelving & cabinets',
  category: 'Storage',
  mount: (p) => placementOf(p),
  wallAlign: true,
  defaultElev: (p) => (placementOf(p) === 'wall' ? 1450 : 0),
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 150, max: 8000, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 100, max: 4000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 100, max: 1000, step: 10, group: 'Size' },
    { key: 'layout', label: 'Cells', type: 'cells', group: 'Cells' },
    { key: 'bookStyle', label: 'Arrangement', type: 'select', options: STYLE_OPTIONS, group: 'Books' },
    { key: 'bookPalette', label: 'Spines', type: 'select', options: PALETTE_OPTIONS, group: 'Books' },
    { key: 'bookFill', label: 'Fill', type: 'number', unit: '%', min: 10, max: 100, step: 5, group: 'Books' },
    { key: 'seed', label: 'Variation', type: 'seed', group: 'Books' },
    { key: 'board', label: 'Shelf thickness', type: 'number', unit: 'mm', min: 8, max: 60, step: 1, group: 'Construction' },
    { key: 'frame', label: 'Upright thickness', type: 'number', unit: 'mm', min: 8, max: 120, step: 1, group: 'Construction' },
    { key: 'back', label: 'Back panel', type: 'bool', group: 'Construction' },
    { key: 'placement', label: 'Placement', type: 'select', options: [['floor', 'On the floor'], ['wall', 'Wall mounted'], ['surface', 'On a surface']], group: 'Construction' },
    { key: 'base', label: 'Base', type: 'select', options: [['plinth', 'Plinth'], ['legs', 'Legs'], ['casters', 'Casters'], ['none', 'None']], group: 'Construction', show: showFloor },
    { key: 'baseHeight', label: 'Base height', type: 'number', unit: 'mm', min: 10, max: 400, step: 5, group: 'Construction', show: (p) => showFloor(p) && p.base !== 'none' },
    { key: 'handle', label: 'Handles', type: 'select', options: [['bar', 'Bar'], ['long', 'Long bar'], ['cup', 'Cup pull'], ['knob', 'Knob'], ['none', 'Push to open']], group: 'Construction' },
    { key: 'handleColor', label: 'Handle colour', type: 'color', group: 'Construction', show: (p) => p.handle !== 'none' },
    { key: 'ladder', label: 'Library ladder', type: 'bool', group: 'Ladder' },
    { key: 'railHeight', label: 'Rail height', type: 'number', unit: 'mm', min: 600, max: 4000, step: 10, group: 'Ladder', show: (p) => p.ladder },
    { key: 'ladderPos', label: 'Ladder from left', type: 'number', unit: 'mm', min: 0, max: 8000, step: 10, group: 'Ladder', show: (p) => p.ladder, hint: 'Distance from the left edge to the ladder centre' },
    { key: 'ladderColor', label: 'Ladder & rail', type: 'color', group: 'Ladder', show: (p) => p.ladder },
    { key: 'countertop', label: 'Countertop', type: 'bool', group: 'Countertop' },
    { key: 'topThickness', label: 'Top thickness', type: 'number', unit: 'mm', min: 10, max: 80, step: 1, group: 'Countertop', show: (p) => p.countertop },
    { key: 'overhang', label: 'Front overhang', type: 'number', unit: 'mm', min: 0, max: 400, step: 5, group: 'Countertop', show: (p) => p.countertop },
    { key: 'color', label: 'Carcass', type: 'color', group: 'Colours' },
    finishParam('finish', 'Carcass finish'),
    { key: 'color2', label: 'Fronts', type: 'color', group: 'Colours' },
    finishParam('finish2', 'Fronts finish'),
    { key: 'color3', label: 'Countertop', type: 'color', group: 'Colours', show: (p) => p.countertop },
    finishParam('finish3', 'Countertop finish', (p) => p.countertop),
  ],
  defaults: {
    width: 800, height: 2000, depth: 300, board: 18, frame: 18, back: true, placement: 'floor', base: 'plinth', baseHeight: 60,
    handle: 'bar', handleColor: '#a6abb2', countertop: false, topThickness: 30, overhang: 20,
    bookStyle: 'mixed', bookPalette: 'colorful', bookFill: 80, seed: 1,
    ladder: false, railHeight: 1900, ladderPos: 600, ladderColor: '#1e1e1e',
    color: '#e9e4da', finish: 'matte', color2: '#d8cfc0', finish2: 'matte', color3: '#9a9590', finish3: 'gloss',
    layout: L([['books', 'mixed', 'open', 'books', 'books', 'door']], undefined, [[1, 1, 1, 1, 1, 1.4]]),
  },
  presets: [
    { name: 'Bookshelf', params: {} },
    {
      name: 'Library wall',
      params: {
        width: 2700, height: 2650, depth: 360, board: 25, frame: 36, color: '#b0763f', finish: 'wood', color2: '#b0763f', finish2: 'wood',
        base: 'plinth', baseHeight: 40, handle: 'long', handleColor: '#2a2a2a', bookStyle: 'mixed', bookFill: 92,
        ladder: true, railHeight: 1950, ladderPos: 2100, ladderColor: '#1e1e1e',
        layout: L(
          [
            ['books', 'books', 'books', 'mixed', 'books', 'books', 'books', 'drawer'],
            ['books', 'mixed', 'books', 'books', 'books', 'books', 'books', 'drawer'],
            ['books', 'books', 'books', 'books', 'mixed', 'books', 'books', 'drawer'],
          ],
          undefined,
          [[1, 1, 1, 1, 1, 1, 1, 0.8], [1, 1, 1, 1, 1, 1, 1, 0.8], [1, 1, 1, 1, 1, 1, 1, 0.8]],
        ),
      },
    },
    {
      name: 'Wide bookcase',
      params: {
        width: 1600, height: 2000, depth: 350, frame: 25, color: '#8a6a4f', finish: 'wood', color2: '#8a6a4f', finish2: 'wood', bookPalette: 'warm',
        layout: L([['books', 'open', 'books', 'drawer'], ['books', 'books', 'decor', 'drawer'], ['mixed', 'books', 'books', 'drawer'], ['books', 'books', 'books', 'drawer']], undefined, [[1, 1, 1, 0.6], [1, 1, 1, 0.6], [1, 1, 1, 0.6], [1, 1, 1, 0.6]]),
      },
    },
    {
      name: 'Wardrobe',
      params: {
        width: 1500, height: 2200, depth: 600, back: true, color: '#f1efea', color2: '#f1efea',
        layout: L([['door', 'door'], ['door', 'door'], ['door', 'door']], undefined, [[0.22, 1], [0.22, 1], [0.22, 1]]),
      },
    },
    {
      name: 'Open wardrobe',
      params: {
        width: 1200, height: 2000, depth: 550, base: 'legs', baseHeight: 100, color: '#cfc6b8', color2: '#cfc6b8', finish: 'wood', finish2: 'wood',
        layout: L([['open', 'rail'], ['open', 'open', 'open', 'drawer', 'drawer']], [1.6, 1], [[0.25, 1], [1, 1, 1, 0.8, 0.8]]),
      },
    },
    {
      name: 'Dresser',
      params: {
        width: 1200, height: 800, depth: 500, base: 'legs', baseHeight: 120, back: true, color: '#c9b79c', color2: '#c9b79c', finish: 'wood', finish2: 'wood', handle: 'knob',
        layout: L([['drawer', 'drawer', 'drawer'], ['drawer', 'drawer', 'drawer']]),
      },
    },
    {
      name: 'Rolling chest',
      params: {
        width: 560, height: 820, depth: 480, base: 'casters', baseHeight: 70, color: '#6b3a22', color2: '#7a4428', finish: 'wood', finish2: 'gloss', handle: 'cup', handleColor: '#c9a646',
        layout: L([['drawer', 'drawer', 'drawer']]),
      },
    },
    {
      name: 'Drawer box',
      params: {
        width: 330, height: 230, depth: 260, board: 10, frame: 10, placement: 'surface', back: true, color: '#b07a4a', color2: '#b98756', finish: 'wood', finish2: 'wood', handle: 'knob', handleColor: '#c9a646',
        layout: L([['drawer', 'drawer', 'drawer', 'drawer', 'drawer', 'drawer']]),
      },
    },
    {
      name: 'Nightstand',
      params: {
        width: 450, height: 520, depth: 400, base: 'legs', baseHeight: 140, color: '#c9b79c', color2: '#c9b79c', finish: 'wood', finish2: 'wood', handle: 'knob',
        layout: L([['drawer', 'decor']]),
      },
    },
    {
      name: 'TV stand',
      params: {
        width: 1600, height: 450, depth: 420, base: 'legs', baseHeight: 100, color: '#3d3a37', color2: '#7a5a3f', finish2: 'wood',
        layout: L([['door'], ['open', 'open'], ['door']], [1, 1.4, 1]),
      },
    },
    {
      name: 'Kitchen base unit',
      params: {
        width: 600, height: 900, depth: 560, base: 'plinth', baseHeight: 100, countertop: true, topThickness: 38, overhang: 40,
        color: '#ececec', color2: '#5f7d74', color3: '#c8c3ba',
        layout: L([['drawer', 'door']], undefined, [[0.25, 1]]),
      },
    },
    {
      name: 'Kitchen wall unit',
      params: { width: 800, height: 700, depth: 340, placement: 'wall', color: '#ececec', color2: '#5f7d74', layout: L([['door'], ['door']]) },
    },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, H = p.height, D = p.depth, t = Math.min(p.board, W / 4, H / 4);
    const { cells, cols, baseH, yTop, yi0, yi1, layout, frame } = cabinetCells({ ...p, board: t, frame: Math.min(p.frame ?? t, W / 4) });
    const f = frame;
    const place = placementOf(p);
    const ov = p.countertop ? p.overhang : 0;
    const Dt = D + ov;
    const zb = -Dt / 2, zf = zb + D;
    const bk = p.back ? 8 : 0;
    const fT = 18;
    const hc = p.handle === 'none' ? '' : `metal:${p.handleColor ?? '#a6abb2'}`;
    const r = rng((p.seed ?? 1) * 7919 + Math.round(W + H));
    const fillOpts = { style: p.bookStyle ?? 'mixed', palette: p.bookPalette ?? 'colorful', fill: (p.bookFill ?? 80) / 100, rand: r };

    // carcass
    k.box(-W / 2, baseH, zb, -W / 2 + f, yTop, zf, 'body');
    k.box(W / 2 - f, baseH, zb, W / 2, yTop, zf, 'body');
    k.box(-W / 2 + f, yTop - t, zb, W / 2 - f, yTop, zf, 'body');
    k.box(-W / 2 + f, baseH, zb, W / 2 - f, baseH + t, zf, 'body');
    if (p.back) k.box(-W / 2 + f, yi0, zb, W / 2 - f, yi1, zb + bk, 'body');
    if (place === 'floor' && baseH > 0) {
      if (p.base === 'plinth') k.box(-W / 2 + 10, 0, zb + 20, W / 2 - 10, baseH, zf - 40, 'body');
      else if (p.base === 'legs') {
        for (const x of [-W / 2 + 40, W / 2 - 40]) for (const z of [zb + 40, zf - 40]) k.cylY(x, 0, z, 16, baseH, 'metal', { r2: 18 });
        if (W > 1400) for (const z of [zb + 40, zf - 40]) k.cylY(0, 0, z, 16, baseH, 'metal', { r2: 18 });
      } else if (p.base === 'casters') {
        const wr = Math.min(30, baseH * 0.38);
        for (const x of [-W / 2 + 45, W / 2 - 45]) for (const z of [zb + 45, zf - 45]) {
          k.cyl(x, wr, z, wr, 18, 'x', 'dark', { seg: 18 });
          k.box(x - 14, wr, z - 12, x + 14, baseH, z + 12, 'metal');
        }
      }
    }
    if (p.countertop) k.box(-W / 2, yTop, zb, W / 2, H, zf + ov, 'third');

    // dividers
    for (let i = 0; i < cols.length - 1; i++) k.box(cols[i].x1, yi0, zb + bk, cols[i].x1 + f, yi1, zf, 'body');

    const nc = cols.length;
    const handle = (cx: number, cy: number, vertical: boolean, span: number) => {
      if (!hc) return;
      if (p.handle === 'knob') {
        k.cyl(cx, cy, zf + 12, 13, 24, 'z', hc);
        return;
      }
      if (p.handle === 'cup') {
        const w = Math.min(96, span * 0.5);
        k.box(cx - w / 2 - 8, cy - 2, zf, cx + w / 2 + 8, cy + 20, zf + 3, hc);
        k.box(cx - w / 2, cy - 16, zf + 3, cx + w / 2, cy + 2, zf + 22, hc, { r: 7 });
        return;
      }
      const l = p.handle === 'long' ? Math.max(80, span * 0.7) : Math.max(60, Math.min(span * 0.4, 220));
      if (vertical) k.box(cx - 6, cy - l / 2, zf, cx + 6, cy + l / 2, zf + 24, hc);
      else k.box(cx - l / 2, cy - 6, zf, cx + l / 2, cy + 6, zf + 24, hc);
    };

    cells.forEach((c, i) => {
      const cw = c.x1 - c.x0, ch = c.y1 - c.y0;
      const col = layout.cols[c.col];
      if (c.idx < col.cells.length - 1) k.box(c.x0, c.y0 - t, zb + bk, c.x1, c.y0, zf - 2, 'body');
      const hingeLeft = nc === 1 ? true : c.col < (nc - 1) / 2 || (nc % 2 === 1 && c.col === (nc - 1) / 2);
      switch (c.t) {
        case 'books':
        case 'mixed':
        case 'decor':
          fillShelf(k, c.t as Content, c.x0, c.x1, c.y0, ch, zb + bk, zf, fillOpts);
          break;
        case 'door': {
          k.box(c.x0 + 2, c.y0 + 2, zf - fT, c.x1 - 2, c.y1 - 2, zf, 'accent');
          const hy = ch > 1000 ? Math.min(c.y1 - 150, Math.max(c.y0 + 150, 1050)) : c.y0 + ch / 2;
          handle(hingeLeft ? c.x1 - 40 : c.x0 + 40, hy, true, ch);
          break;
        }
        case 'glass': {
          const fw = Math.min(55, cw / 5, ch / 5);
          k.box(c.x0 + 2, c.y0 + 2, zf - fT, c.x0 + 2 + fw, c.y1 - 2, zf, 'accent');
          k.box(c.x1 - 2 - fw, c.y0 + 2, zf - fT, c.x1 - 2, c.y1 - 2, zf, 'accent');
          k.box(c.x0 + 2 + fw, c.y0 + 2, zf - fT, c.x1 - 2 - fw, c.y0 + 2 + fw, zf, 'accent');
          k.box(c.x0 + 2 + fw, c.y1 - 2 - fw, zf - fT, c.x1 - 2 - fw, c.y1 - 2, zf, 'accent');
          k.box(c.x0 + 2 + fw, c.y0 + 2 + fw, zf - 11, c.x1 - 2 - fw, c.y1 - 2 - fw, zf - 7, 'glass', { edges: false });
          fillShelf(k, 'mixed', c.x0, c.x1, c.y0, ch, zb + bk, zf - fT - 4, fillOpts);
          handle(hingeLeft ? c.x1 - 2 - fw / 2 : c.x0 + 2 + fw / 2, c.y0 + ch / 2, true, ch * 0.75);
          break;
        }
        case 'drawer': {
          k.box(c.x0 + 2, c.y0 + 2, zf - fT, c.x1 - 2, c.y1 - 2, zf, 'accent');
          handle((c.x0 + c.x1) / 2, c.y0 + ch * (p.handle === 'cup' ? 0.55 : 0.62), false, cw);
          break;
        }
        case 'rail': {
          const ry = c.y1 - 70;
          const zm = (zb + bk + zf) / 2;
          k.cyl((c.x0 + c.x1) / 2, ry, zm, 12, cw, 'x', 'metal');
          const rr = rng(i * 31 + 5);
          const n = Math.floor((cw - 60) / 75);
          for (let j = 0; j < n; j++) {
            const x = c.x0 + 40 + j * 75 + rr() * 15;
            const hh = Math.min(ch - 110, 650 + rr() * 450);
            if (hh < 150) break;
            const dd = Math.min(D - bk - 60, 480);
            k.box(x, ry - 25 - hh, zm - dd / 2, x + 14, ry - 25, zm + dd / 2, `fabric:${CLOTH_COLORS[Math.floor(rr() * CLOTH_COLORS.length)]}`, { edges: false });
          }
          break;
        }
      }
    });

    let maxZ = zf + ov;
    if (p.ladder) {
      // rail along the front with a rolling ladder hooked onto it
      const rail = Math.min(p.railHeight, H - 40);
      const lc = `metal:${p.ladderColor ?? '#1e1e1e'}`;
      const zr = zf + 70;
      k.cyl(0, rail, zr, 13, W - 40, 'x', lc);
      const nb = Math.max(2, Math.ceil(W / 900) + 1);
      for (let i = 0; i < nb; i++) {
        const x = -W / 2 + 25 + (i * (W - 50)) / (nb - 1);
        k.box(x - 9, rail - 14, zf, x + 9, rail + 14, zr, lc);
      }
      const lw = 440;
      const lx = Math.max(-W / 2 + lw / 2, Math.min(W / 2 - lw / 2, -W / 2 + (p.ladderPos ?? W / 2)));
      const top = rail + 30;
      const lean = top * 0.27;
      const zB = zr + lean;
      const len = Math.hypot(top, lean);
      const th = -Math.atan2(lean, top);
      for (const s of [-1, 1]) {
        const x = lx + s * (lw / 2 - 20);
        k.boxC(x, top / 2, (zB + zr) / 2, 40, len, 22, lc, { rot: [th, 0, 0] });
        k.box(x - 6, rail - 10, zr - 22, x + 6, top + 24, zr + 14, lc);
        k.cyl(x, 28, zB + 10, 28, 20, 'x', 'dark');
      }
      for (let y = 300; y < top - 150; y += 300) {
        const tt = y / top;
        k.boxC(lx, y, zB + (zr - zB) * tt + 8, lw - 70, 22, 90, lc);
      }
      k.col(lx - lw / 2, 0, zf, lx + lw / 2, top, zB + 40);
      maxZ = Math.max(maxZ, zB + 40);
      k.v('side', 0, rail, -zf, -1, 'rail');
    }

    k.col(-W / 2, 0, zb, W / 2, H, zf + ov);

    // dimensions: clear widths per column, clear heights for first (and last, if different) column
    cols.forEach((c) => k.h('front', c.x0, c.x1, yi0, -1));
    const colCells = (ci: number) => cells.filter((c) => c.col === ci);
    colCells(0).forEach((c) => k.v('front', c.y0, c.y1, cols[0].x0, -1));
    if (baseH > 0) k.v('front', 0, baseH, -W / 2, -1);
    if (nc > 1) {
      const a = colCells(0).map((c) => Math.round(c.y1 - c.y0)).join(',');
      const b = colCells(nc - 1).map((c) => Math.round(c.y1 - c.y0)).join(',');
      if (a !== b) colCells(nc - 1).forEach((c) => k.v('front', c.y0, c.y1, cols[nc - 1].x1, 1));
    }
    if (p.countertop && ov > 0) k.h('side', -zf, -zb, yTop, 1, 'carcass');

    const counts = layout.cols.map((c) => c.cells.length).join('+');
    return k.done([W, H, Dt], {
      bounds: { min: [-W / 2, 0, zb], max: [W / 2, H, maxZ] },
      note: `${nc} col${nc > 1 ? 's' : ''} (${counts} cells)${p.ladder ? ', ladder' : ''}`,
    });
  },
};

import { BOOK_COLORS, CLOTH_COLORS, Kit, rng } from './kit';
import type { FurnitureDef, Params } from './types';

export type CellType = 'open' | 'books' | 'door' | 'glass' | 'drawer' | 'rail';
export interface CabCell { h: number; t: CellType }
export interface CabCol { w: number; cells: CabCell[] }
export interface CabLayout { cols: CabCol[] }

export const CELL_TYPES: { t: CellType; label: string; short: string }[] = [
  { t: 'open', label: 'Open shelf', short: 'Open' },
  { t: 'books', label: 'Shelf with books', short: 'Books' },
  { t: 'door', label: 'Door', short: 'Door' },
  { t: 'glass', label: 'Glass door', short: 'Glass' },
  { t: 'drawer', label: 'Drawer', short: 'Drawer' },
  { t: 'rail', label: 'Hanging rail', short: 'Rail' },
];

export function uniformLayout(cols: number, rows: number, t: CellType = 'open', prev?: CabLayout): CabLayout {
  return {
    cols: Array.from({ length: cols }, (_, c) => ({
      w: 1,
      cells: Array.from({ length: rows }, (_, r) => ({ h: 1, t: prev?.cols[c]?.cells[r]?.t ?? prev?.cols[c]?.cells.at(-1)?.t ?? t })),
    })),
  };
}

const L = (spec: string[][], widths?: number[], heights?: number[][]): CabLayout => ({
  cols: spec.map((col, c) => ({
    w: widths?.[c] ?? 1,
    cells: col.map((t, r) => ({ t: t as CellType, h: heights?.[c]?.[r] ?? 1 })),
  })),
});

export interface CellRect { col: number; idx: number; x0: number; x1: number; y0: number; y1: number; t: CellType }

/** Resolve the layout into clear cell rectangles in local coordinates (front view). */
export function cabinetCells(p: Params) {
  const W = p.width, H = p.height, t = p.board;
  const baseH = p.wallMounted || p.base === 'none' ? 0 : p.baseHeight;
  const ctT = p.countertop ? p.topThickness : 0;
  const yTop = H - ctT;
  const layout: CabLayout = p.layout?.cols?.length ? p.layout : uniformLayout(1, 1);
  const nc = layout.cols.length;
  const xi0 = -W / 2 + t;
  const availW = W - 2 * t - (nc - 1) * t;
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
    x = x1 + t;
  });
  return { cells, cols, baseH, yTop, yi0, yi1, layout };
}

export const cabinet: FurnitureDef = {
  type: 'cabinet',
  label: 'Shelving & cabinets',
  category: 'Storage',
  mount: (p) => (p.wallMounted ? 'wall' : 'floor'),
  wallAlign: true,
  defaultElev: (p) => (p.wallMounted ? 1450 : 0),
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 150, max: 5000, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 100, max: 3000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 100, max: 1000, step: 10, group: 'Size' },
    { key: 'layout', label: 'Cells', type: 'cells', group: 'Cells' },
    { key: 'board', label: 'Board thickness', type: 'number', unit: 'mm', min: 8, max: 50, step: 1, group: 'Construction' },
    { key: 'back', label: 'Back panel', type: 'bool', group: 'Construction' },
    { key: 'wallMounted', label: 'Wall mounted', type: 'bool', group: 'Construction' },
    { key: 'base', label: 'Base', type: 'select', options: [['plinth', 'Plinth'], ['legs', 'Legs'], ['none', 'None']], group: 'Construction', show: (p) => !p.wallMounted },
    { key: 'baseHeight', label: 'Base height', type: 'number', unit: 'mm', min: 10, max: 400, step: 5, group: 'Construction', show: (p) => !p.wallMounted && p.base !== 'none' },
    { key: 'handle', label: 'Handles', type: 'select', options: [['bar', 'Bar'], ['knob', 'Knob'], ['none', 'Push to open']], group: 'Construction' },
    { key: 'countertop', label: 'Countertop', type: 'bool', group: 'Countertop' },
    { key: 'topThickness', label: 'Top thickness', type: 'number', unit: 'mm', min: 10, max: 80, step: 1, group: 'Countertop', show: (p) => p.countertop },
    { key: 'overhang', label: 'Front overhang', type: 'number', unit: 'mm', min: 0, max: 400, step: 5, group: 'Countertop', show: (p) => p.countertop },
    { key: 'color', label: 'Carcass', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Fronts', type: 'color', group: 'Colours' },
    { key: 'color3', label: 'Countertop', type: 'color', group: 'Colours', show: (p) => p.countertop },
  ],
  defaults: {
    width: 800, height: 2000, depth: 300, board: 18, back: true, wallMounted: false, base: 'plinth', baseHeight: 60,
    handle: 'bar', countertop: false, topThickness: 30, overhang: 20,
    color: '#e9e4da', color2: '#d8cfc0', color3: '#9a9590',
    layout: L([['books', 'books', 'open', 'books', 'books', 'door']], undefined, [[1, 1, 1, 1, 1, 1.4]]),
  },
  presets: [
    { name: 'Bookshelf', params: {} },
    {
      name: 'Wide bookcase',
      params: {
        width: 1600, height: 2000, depth: 350, color: '#8a6a4f', color2: '#8a6a4f',
        layout: L([['books', 'open', 'books', 'drawer'], ['books', 'books', 'open', 'drawer'], ['open', 'books', 'books', 'drawer'], ['books', 'books', 'books', 'drawer']], undefined, [[1, 1, 1, 0.6], [1, 1, 1, 0.6], [1, 1, 1, 0.6], [1, 1, 1, 0.6]]),
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
        width: 1200, height: 2000, depth: 550, base: 'legs', baseHeight: 100, color: '#cfc6b8', color2: '#cfc6b8',
        layout: L([['open', 'rail'], ['open', 'open', 'open', 'drawer', 'drawer']], [1.6, 1], [[0.25, 1], [1, 1, 1, 0.8, 0.8]]),
      },
    },
    {
      name: 'Dresser',
      params: {
        width: 1200, height: 800, depth: 480, base: 'legs', baseHeight: 120, back: true, color: '#c9b79c', color2: '#c9b79c', handle: 'knob',
        layout: L([['drawer', 'drawer', 'drawer'], ['drawer', 'drawer', 'drawer']]),
      },
    },
    {
      name: 'Nightstand',
      params: {
        width: 450, height: 520, depth: 400, base: 'legs', baseHeight: 140, color: '#c9b79c', color2: '#c9b79c', handle: 'knob',
        layout: L([['drawer', 'open']]),
      },
    },
    {
      name: 'TV stand',
      params: {
        width: 1600, height: 450, depth: 420, base: 'legs', baseHeight: 100, color: '#3d3a37', color2: '#7a5a3f',
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
      params: {
        width: 800, height: 700, depth: 340, wallMounted: true, color: '#ececec', color2: '#5f7d74',
        layout: L([['door'], ['door']]),
      },
    },
    {
      name: 'Wall shelf',
      params: { width: 900, height: 260, depth: 240, wallMounted: true, back: false, color: '#b98b5e', color2: '#b98b5e', layout: L([['books']]) },
      elev: 1500,
    },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, H = p.height, D = p.depth, t = Math.min(p.board, W / 4, H / 4);
    const { cells, cols, baseH, yTop, yi0, yi1, layout } = cabinetCells({ ...p, board: t });
    const ov = p.countertop ? p.overhang : 0;
    const Dt = D + ov;
    const zb = -Dt / 2, zf = zb + D;
    const bk = p.back ? 8 : 0;
    const fT = 18;

    // carcass
    k.box(-W / 2, baseH, zb, -W / 2 + t, yTop, zf, 'body');
    k.box(W / 2 - t, baseH, zb, W / 2, yTop, zf, 'body');
    k.box(-W / 2 + t, yTop - t, zb, W / 2 - t, yTop, zf, 'body');
    k.box(-W / 2 + t, baseH, zb, W / 2 - t, baseH + t, zf, 'body');
    if (p.back) k.box(-W / 2 + t, yi0, zb, W / 2 - t, yi1, zb + bk, 'body');
    if (!p.wallMounted && p.base === 'plinth' && baseH > 0) k.box(-W / 2 + 10, 0, zb + 20, W / 2 - 10, baseH, zf - 40, 'body');
    if (!p.wallMounted && p.base === 'legs' && baseH > 0) {
      for (const x of [-W / 2 + 40, W / 2 - 40]) for (const z of [zb + 40, zf - 40]) k.cylY(x, 0, z, 16, baseH, 'metal', { r2: 18 });
      if (W > 1400) for (const z of [zb + 40, zf - 40]) k.cylY(0, 0, z, 16, baseH, 'metal', { r2: 18 });
    }
    if (p.countertop) k.box(-W / 2, yTop, zb, W / 2, H, zf + ov, 'third');

    // dividers
    for (let i = 0; i < cols.length - 1; i++) k.box(cols[i].x1, yi0, zb + bk, cols[i].x1 + t, yi1, zf, 'body');

    const nc = cols.length;
    const handle = (cx: number, cy: number, vertical: boolean, lenMax: number) => {
      if (p.handle === 'none') return;
      if (p.handle === 'knob') {
        k.cyl(cx, cy, zf + 12, 13, 24, 'z', 'metal');
        return;
      }
      const l = Math.max(60, Math.min(lenMax, 220));
      if (vertical) k.box(cx - 6, cy - l / 2, zf, cx + 6, cy + l / 2, zf + 26, 'metal');
      else k.box(cx - l / 2, cy - 6, zf, cx + l / 2, cy + 6, zf + 26, 'metal');
    };

    cells.forEach((c, i) => {
      const cw = c.x1 - c.x0, ch = c.y1 - c.y0;
      const col = layout.cols[c.col];
      // shelf board below this cell (between cells)
      if (c.idx < col.cells.length - 1) k.box(c.x0, c.y0 - t, zb + bk, c.x1, c.y0, zf - 2, 'body');
      const hingeLeft = nc === 1 ? true : c.col < (nc - 1) / 2 || (nc % 2 === 1 && c.col === (nc - 1) / 2);
      switch (c.t) {
        case 'books': {
          const r = rng(i * 97 + c.col * 13 + 7);
          const bh = Math.min(ch - 15, 330);
          if (bh < 90 || cw < 60) break;
          const bd = Math.min(D - bk - 40, 230);
          const fill = cw * (0.62 + r() * 0.3);
          let x = c.x0 + 4;
          while (x < c.x0 + fill) {
            const w = 20 + r() * 26;
            if (x + w > c.x1 - 4) break;
            const h = bh * (0.68 + r() * 0.3);
            const bc = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)];
            k.box(x, c.y0, zf - 25 - bd * (0.9 + r() * 0.1), x + w - 1, c.y0 + h, zf - 25, bc, { edges: false });
            x += w;
          }
          break;
        }
        case 'door': {
          k.box(c.x0 + 2, c.y0 + 2, zf - fT, c.x1 - 2, c.y1 - 2, zf, 'accent');
          const hy = ch > 1000 ? Math.min(c.y1 - 150, Math.max(c.y0 + 150, 1050)) : c.y0 + ch / 2;
          handle(hingeLeft ? c.x1 - 40 : c.x0 + 40, hy, true, ch * 0.35);
          break;
        }
        case 'glass': {
          const fw = Math.min(55, cw / 5, ch / 5);
          k.box(c.x0 + 2, c.y0 + 2, zf - fT, c.x0 + 2 + fw, c.y1 - 2, zf, 'accent');
          k.box(c.x1 - 2 - fw, c.y0 + 2, zf - fT, c.x1 - 2, c.y1 - 2, zf, 'accent');
          k.box(c.x0 + 2 + fw, c.y0 + 2, zf - fT, c.x1 - 2 - fw, c.y0 + 2 + fw, zf, 'accent');
          k.box(c.x0 + 2 + fw, c.y1 - 2 - fw, zf - fT, c.x1 - 2 - fw, c.y1 - 2, zf, 'accent');
          k.box(c.x0 + 2 + fw, c.y0 + 2 + fw, zf - 11, c.x1 - 2 - fw, c.y1 - 2 - fw, zf - 7, 'glass', { edges: false });
          handle(hingeLeft ? c.x1 - 2 - fw / 2 : c.x0 + 2 + fw / 2, c.y0 + ch / 2, true, ch * 0.3);
          break;
        }
        case 'drawer': {
          k.box(c.x0 + 2, c.y0 + 2, zf - fT, c.x1 - 2, c.y1 - 2, zf, 'accent');
          handle((c.x0 + c.x1) / 2, c.y0 + ch * 0.62, false, cw * 0.45);
          break;
        }
        case 'rail': {
          const ry = c.y1 - 70;
          const zm = (zb + bk + zf) / 2;
          k.cyl((c.x0 + c.x1) / 2, ry, zm, 12, cw, 'x', 'metal');
          const r = rng(i * 31 + 5);
          const n = Math.floor((cw - 60) / 75);
          for (let j = 0; j < n; j++) {
            const x = c.x0 + 40 + j * 75 + r() * 15;
            const hh = Math.min(ch - 110, 650 + r() * 450);
            if (hh < 150) break;
            const dd = Math.min(D - bk - 60, 480);
            k.box(x, ry - 25 - hh, zm - dd / 2, x + 14, ry - 25, zm + dd / 2, CLOTH_COLORS[Math.floor(r() * CLOTH_COLORS.length)], { edges: false });
          }
          break;
        }
      }
    });

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
    return k.done([W, H, Dt], { note: `${nc} col${nc > 1 ? 's' : ''} (${counts} cells)` });
  },
};

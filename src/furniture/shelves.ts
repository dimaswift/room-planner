import { PALETTE_OPTIONS, STYLE_OPTIONS, decor, fillShelf, type Content } from './fill';
import { Kit, finishParam, rng } from './kit';
import type { FurnitureDef } from './types';

export interface ShelfRow { space: number; content: Content; fill: number }

export const CONTENT_OPTIONS: [Content, string][] = [
  ['books', 'Books'],
  ['mixed', 'Mixed'],
  ['decor', 'Decor'],
  ['empty', 'Empty'],
];

const POTS = ['#e9e4da', '#c26d47', '#2f5d8c', '#3f7d4e', '#1f1f1f'];

/** Wall-hung boards on brackets, optionally with a hanging rail underneath (S-hooks, pots, utensils). */
export const wallShelf: FurnitureDef = {
  type: 'wallshelf',
  label: 'Wall shelves',
  category: 'Storage',
  mount: 'wall',
  wallAlign: true,
  defaultElev: 900,
  params: [
    { key: 'width', label: 'Length', type: 'number', unit: 'mm', min: 200, max: 8000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 80, max: 600, step: 5, group: 'Size' },
    { key: 'board', label: 'Board thickness', type: 'number', unit: 'mm', min: 10, max: 80, step: 1, group: 'Size' },
    { key: 'shelves', label: 'Shelves', type: 'shelves', group: 'Shelves' },
    { key: 'brackets', label: 'Brackets', type: 'select', options: [['clamp', 'Clamp brackets'], ['lbracket', 'L brackets'], ['pipe', 'Pipe'], ['hidden', 'Hidden (floating)']], group: 'Brackets' },
    { key: 'bracketSpacing', label: 'Bracket spacing', type: 'number', unit: 'mm', min: 200, max: 2000, step: 10, group: 'Brackets', show: (p) => p.brackets !== 'hidden' },
    { key: 'bracketColor', label: 'Bracket colour', type: 'color', group: 'Brackets', show: (p) => p.brackets !== 'hidden' },
    { key: 'rail', label: 'Hanging rail below', type: 'bool', group: 'Rail' },
    { key: 'railDrop', label: 'Rail below bottom shelf', type: 'number', unit: 'mm', min: 40, max: 600, step: 5, group: 'Rail', show: (p) => p.rail },
    { key: 'hangers', label: 'On the hooks', type: 'select', options: [['plants', 'Hanging plants'], ['tools', 'Cups & utensils'], ['none', 'Nothing']], group: 'Rail', show: (p) => p.rail },
    { key: 'bookStyle', label: 'Arrangement', type: 'select', options: STYLE_OPTIONS, group: 'Books' },
    { key: 'bookPalette', label: 'Spines', type: 'select', options: PALETTE_OPTIONS, group: 'Books' },
    { key: 'seed', label: 'Variation', type: 'seed', group: 'Books' },
    { key: 'color', label: 'Boards', type: 'color', group: 'Colours' },
    finishParam('finish', 'Board finish'),
  ],
  defaults: {
    width: 2400, depth: 230, board: 32,
    shelves: [
      { space: 320, content: 'books', fill: 92 },
      { space: 300, content: 'books', fill: 85 },
      { space: 290, content: 'books', fill: 80 },
      { space: 300, content: 'decor', fill: 60 },
    ] as ShelfRow[],
    brackets: 'clamp', bracketSpacing: 650, bracketColor: '#1c1c1c',
    rail: true, railDrop: 110, hangers: 'plants',
    bookStyle: 'mixed', bookPalette: 'colorful', seed: 1, color: '#8a5634', finish: 'wood',
  },
  presets: [
    { name: 'Shelf wall with rail', params: {} },
    {
      name: 'Floating shelves',
      params: {
        width: 1200, depth: 220, board: 40, brackets: 'hidden', rail: false, color: '#c9a27a',
        shelves: [{ space: 300, content: 'mixed', fill: 70 }, { space: 300, content: 'decor', fill: 60 }],
      },
      elev: 1300,
    },
    {
      name: 'Pipe shelves',
      params: {
        width: 1600, depth: 250, board: 35, brackets: 'pipe', rail: false, color: '#6e4a2e', bracketColor: '#2a2a2a',
        shelves: [{ space: 330, content: 'books', fill: 85 }, { space: 330, content: 'mixed', fill: 75 }, { space: 280, content: 'decor', fill: 60 }],
      },
      elev: 1000,
    },
    { name: 'Single shelf', params: { width: 900, rail: false, brackets: 'lbracket', shelves: [{ space: 280, content: 'mixed', fill: 70 }] }, elev: 1500 },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, D = p.depth, bt = p.board;
    const rows: ShelfRow[] = p.shelves?.length ? p.shelves : [{ space: 300, content: 'books', fill: 80 }];
    const zb = -D / 2, zf = D / 2;
    const r = rng((p.seed ?? 1) * 104729 + Math.round(W));
    const bc = `metal:${p.bracketColor ?? '#1c1c1c'}`;
    const hang = p.rail ? p.railDrop + 300 : 0;
    const nb = Math.max(2, Math.ceil((W - 200) / Math.max(200, p.bracketSpacing)) + 1);
    const bxs = Array.from({ length: nb }, (_, i) => -W / 2 + 110 + (i * (W - 220)) / (nb - 1));

    let y = hang;
    rows.forEach((row, i) => {
      const by = y;
      k.box(-W / 2, by, zb, W / 2, by + bt, zf, 'body');
      for (const x of bxs) {
        if (p.brackets === 'clamp') {
          k.box(x - 13, by - 95, zb, x + 13, by + bt + 28, zb + 8, bc);
          k.box(x - 13, by - 9, zb, x + 13, by, zb + D * 0.72, bc);
          k.box(x - 13, by + bt, zb, x + 13, by + bt + 9, zb + 48, bc);
          k.box(x - 13, by - 28, zb + D * 0.72 - 9, x + 13, by, zb + D * 0.72, bc);
        } else if (p.brackets === 'lbracket') {
          const arm = D * 0.85;
          k.box(x - 12, by - 160, zb, x + 12, by, zb + 6, bc);
          k.box(x - 12, by - 6, zb, x + 12, by, zb + arm, bc);
          const dl = Math.hypot(150, arm * 0.8);
          k.boxC(x, by - 80, zb + arm * 0.42, 8, dl, 8, bc, { rot: [Math.atan2(arm * 0.8, 150), 0, 0] });
        } else if (p.brackets === 'pipe') {
          k.cyl(x, by - 12, zb + 5, 30, 10, 'z', bc, { seg: 20 });
          k.cyl(x, by - 12, zb + D * 0.42, 12, D * 0.8, 'z', bc);
          k.cyl(x, by - 12, zb + D * 0.82 + 6, 15, 12, 'z', bc);
        }
      }
      const yTop = by + bt;
      const space = row.space;
      fillShelf(k, row.content, -W / 2 + 25, W / 2 - 25, yTop, space - 8, zb + 6, zf, {
        style: p.bookStyle ?? 'mixed', palette: p.bookPalette ?? 'colorful', fill: (row.fill ?? 80) / 100, rand: r,
      });
      k.col(-W / 2, by - (p.brackets === 'lbracket' ? 160 : p.brackets === 'clamp' ? 95 : 0), zb, W / 2, yTop + space, zf);
      k.v('front', yTop, yTop + space, -W / 2, -1, i === rows.length - 1 ? 'top' : undefined);
      y = yTop + space;
    });
    const H = y;

    if (p.rail) {
      const ry = hang - p.railDrop;
      const zr = zb + 75;
      k.cyl(0, ry, zr, 9, W - 160, 'x', bc);
      for (const x of [-W / 2 + 90, W / 2 - 90]) {
        k.box(x - 8, ry - 8, zb, x + 8, ry + 28, zr + 8, bc);
        k.box(x - 8, ry + 28, zb, x + 8, hang, zb + 6, bc);
      }
      if (p.hangers !== 'none') {
        const n = Math.max(1, Math.floor((W - 260) / 230));
        for (let i = 0; i < n; i++) {
          const x = -W / 2 + 130 + ((i + 0.5) * (W - 260)) / n + (r() - 0.5) * 50;
          const hook = 45 + r() * 50;
          k.box(x - 2, ry - hook, zr - 2, x + 2, ry + 10, zr + 2, bc, { edges: false });
          const top = ry - hook;
          if (p.hangers === 'plants') {
            const pr = 38 + r() * 18;
            k.cylY(x, top - pr * 1.6, zr, pr * 0.75, pr * 1.4, `gloss:${POTS[Math.floor(r() * POTS.length)]}`, { r2: pr, seg: 20 });
            for (let j = 0; j < 4; j++) k.sphere(x + (r() - 0.5) * pr, top - pr * 0.1 - r() * 30, zr + (r() - 0.5) * pr, pr * 0.55, j % 2 ? '#4f8a3f' : 'leaf2');
            for (let j = 0; j < 4; j++) k.sphere(x + (r() - 0.5) * pr * 1.4, top - pr * 1.6 - j * 45, zr + (r() - 0.5) * pr, 16 + r() * 8, '#4f8a3f');
          } else if (r() < 0.55) {
            k.cylY(x, top - 95, zr, 34, 90, `gloss:${POTS[Math.floor(r() * POTS.length)]}`, { r2: 38, seg: 20 });
            for (let j = 0; j < 3; j++) k.cylY(x + (r() - 0.5) * 30, top - 40, zr + (r() - 0.5) * 30, 3, 110, '#c9a27a');
          } else {
            k.box(x - 5, top - 180, zr - 3, x + 5, top, zr + 3, 'wood:#b98756');
            k.sphere(x, top - 205, zr, 32, 'wood:#b98756', [1, 0.55, 1]);
          }
        }
      }
      k.col(-W / 2, 0, zb, W / 2, hang, zb + 160);
      k.v('front', ry, hang, W / 2, 1, 'rail');
    }

    return k.done([W, H, D], { note: `${rows.length} shelf${rows.length > 1 ? 'ves' : ''}${p.rail ? ' + rail' : ''}` });
  },
};

export const cart: FurnitureDef = {
  type: 'cart',
  label: 'Rolling cart',
  category: 'Storage',
  mount: 'floor',
  wallAlign: false,
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 250, max: 1200, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 200, max: 800, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 300, max: 1400, step: 10, group: 'Size' },
    { key: 'tiers', label: 'Tiers', type: 'int', min: 1, max: 6, group: 'Size' },
    { key: 'contents', label: 'Contents', type: 'select', options: [['supplies', 'Supplies'], ['plants', 'Plants'], ['empty', 'Empty']], group: 'Look' },
    { key: 'seed', label: 'Variation', type: 'seed', group: 'Look' },
    { key: 'color', label: 'Frame', type: 'color', group: 'Colours' },
    finishParam('finish', 'Finish'),
  ],
  defaults: { width: 450, depth: 380, height: 780, tiers: 3, contents: 'supplies', seed: 1, color: '#4fa3a5', finish: 'gloss' },
  presets: [{ name: 'Rolling cart', params: {} }],
  build(p) {
    const k = new Kit();
    const W = p.width, D = p.depth, H = p.height;
    const n = Math.max(1, Math.round(p.tiers));
    const r = rng((p.seed ?? 1) * 31337 + n);
    const wr = 24;
    for (const x of [-W / 2 + 25, W / 2 - 25]) for (const z of [-D / 2 + 25, D / 2 - 25]) {
      k.cyl(x, wr, z, wr, 16, 'x', 'dark', { seg: 16 });
      k.box(x - 10, wr, z - 10, x + 10, wr + 30, z + 10, 'metal');
      k.cylY(x, wr + 30, z, 9, H - wr - 30, 'body');
    }
    const y0 = wr + 70, y1 = H - 70;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? y1 : y0 + (i * (y1 - y0)) / (n - 1);
      const ix = W / 2 - 12, iz = D / 2 - 12;
      k.box(-ix, y, -iz, ix, y + 5, iz, 'body');
      k.box(-ix, y, -iz, ix, y + 65, -iz + 4, 'body');
      k.box(-ix, y, iz - 4, ix, y + 65, iz, 'body');
      k.box(-ix, y, -iz, -ix + 4, y + 65, iz, 'body');
      k.box(ix - 4, y, -iz, ix, y + 65, iz, 'body');
      const room = (i === n - 1 ? 220 : (y1 - y0) / Math.max(1, n - 1) - 20);
      if (p.contents === 'empty') continue;
      let x = -ix + 20;
      while (x < ix - 70) {
        if (p.contents === 'plants' || r() < 0.25) {
          const w = decor(k, x, y + 5, (r() - 0.5) * D * 0.2, ix - x - 10, room, D - 50, r, 'plant');
          x += w || 80;
        } else {
          const rr = 25 + r() * 20;
          const hh = Math.min(room - 10, 60 + r() * 80);
          k.cylY(x + rr, y + 5, (r() - 0.5) * (D - 120), rr, hh, `gloss:${['#f2efe8', '#2f5d8c', '#c26d47', '#e3c75a', '#1f1f1f'][Math.floor(r() * 5)]}`, { seg: 18 });
          if (r() < 0.5) for (let j = 0; j < 4; j++) k.cylY(x + rr + (r() - 0.5) * rr, y + 5 + hh * 0.5, (r() - 0.5) * 20, 3, Math.min(room - 20, hh + 60 + r() * 50), ['#c9a27a', '#2f5d8c', '#8c2f39'][j % 3]);
          x += rr * 2 + 15;
        }
      }
    }
    return k.done([W, H, D]);
  },
};

const shadeHeight = (style: string, d: number) => (style === 'globe' ? d : style === 'tiered' ? d * 0.42 : style === 'drum' ? d * 0.6 : d * 0.5);

export const pendant: FurnitureDef = {
  type: 'pendant',
  label: 'Pendant lamp',
  category: 'Decor',
  mount: 'ceiling',
  params: [
    { key: 'style', label: 'Shade', type: 'select', options: [['tiered', 'Tiered discs'], ['dome', 'Dome'], ['globe', 'Opal globe'], ['drum', 'Fabric drum']], group: 'Lamp' },
    { key: 'diameter', label: 'Diameter', type: 'number', unit: 'mm', min: 100, max: 1200, step: 10, group: 'Lamp' },
    { key: 'drop', label: 'Cord length', type: 'number', unit: 'mm', min: 50, max: 2500, step: 10, group: 'Lamp', hint: 'From the ceiling to the top of the shade' },
    { key: 'light', label: 'Light on', type: 'bool', group: 'Lamp' },
    { key: 'color', label: 'Shade', type: 'color', group: 'Colours' },
    finishParam('finish', 'Shade finish', (p) => p.style === 'tiered' || p.style === 'dome'),
  ],
  defaults: { style: 'tiered', diameter: 450, drop: 900, light: true, color: '#e9e9e7', finish: 'metal' },
  presets: [
    { name: 'Pendant lamp', params: {} },
    { name: 'Dome pendant', params: { style: 'dome', diameter: 380, color: '#2c3e35', finish: 'gloss', drop: 800 } },
    { name: 'Globe pendant', params: { style: 'globe', diameter: 300, drop: 700, color: '#fff6e6' } },
  ],
  build(p) {
    const k = new Kit();
    const D = p.diameter, R = D / 2;
    const sh = shadeHeight(p.style, D);
    const H = sh + p.drop;
    switch (p.style) {
      case 'tiered':
        k.cylY(0, 0, 0, R, 30, 'body', { r2: R * 0.74, seg: 40 });
        k.cylY(0, sh * 0.38, 0, R * 0.72, 30, 'body', { r2: R * 0.5, seg: 40 });
        k.cylY(0, sh * 0.72, 0, R * 0.46, sh * 0.28, 'body', { r2: R * 0.12, seg: 40 });
        k.cylY(0, 8, 0, R * 0.4, 4, 'bulb', { seg: 30 });
        k.cylY(0, sh * 0.2, 0, R * 0.2, sh * 0.5, 'bulb', { r2: R * 0.1, seg: 20 });
        break;
      case 'dome':
        k.cylY(0, 0, 0, R, sh * 0.75, 'body', { r2: R * 0.55, seg: 40 });
        k.cylY(0, sh * 0.75, 0, R * 0.55, sh * 0.25, 'body', { r2: R * 0.12, seg: 40 });
        k.cylY(0, 5, 0, R * 0.85, 3, 'bulb', { seg: 30 });
        break;
      case 'globe':
        k.sphere(0, R, 0, R, 'shade');
        break;
      default:
        k.cylY(0, 0, 0, R, sh, 'shade', { seg: 40 });
    }
    k.cylY(0, sh - 5, 0, 3, p.drop - 20, 'dark');
    k.cylY(0, H - 20, 0, 55, 20, 'white');
    if (p.light !== false) k.light(0, sh * 0.3, 0, 6);
    k.col(-R, 0, -R, R, sh, R);
    k.v('front', 0, sh, R, 1, 'shade');
    return k.done([D, H, D]);
  },
};

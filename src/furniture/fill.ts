import { Kit } from './kit';

/** Shelf contents: books in runs, stacks and leaning books, plus small decor objects. */

export const BOOK_PALETTES: Record<string, string[]> = {
  colorful: ['#8c2f39', '#2f5d8c', '#c9a227', '#3f7d4e', '#5b4a8b', '#d9d2c3', '#b5542f', '#1f3b4d', '#7a8b99', '#a33b5b', '#e8e1d0', '#d26a3c'],
  warm: ['#8c2f39', '#b5542f', '#c9a227', '#7a3b2e', '#d98a3a', '#5a2a27', '#e3c9a0', '#a0522d', '#efe3cc'],
  cool: ['#2f5d8c', '#1f3b4d', '#3f7d4e', '#7a8b99', '#5b8a9a', '#a7c4d4', '#2e4a3a', '#d9e1e8', '#476a7d'],
  muted: ['#d9d2c3', '#bfb6a5', '#8a8173', '#4a5560', '#6e7b6b', '#e8e2d6', '#a39b8b', '#2f3a44', '#c9c0ae'],
  white: ['#f2efe8', '#ebe6dc', '#f7f5f0', '#e0d9cc', '#f2efe8', '#c8bfae', '#d14b3b', '#2f5d8c', '#ece7dc'],
  leather: ['#5a2a1e', '#3d2418', '#6b3a24', '#7a2e2e', '#2e2a24', '#8a5a32', '#4a3020', '#1f2a20'],
};

export const PALETTE_OPTIONS: [string, string][] = [
  ['colorful', 'Colourful'],
  ['warm', 'Warm'],
  ['cool', 'Cool'],
  ['muted', 'Muted'],
  ['white', 'Light spines'],
  ['leather', 'Leather-bound'],
];

export const STYLE_OPTIONS: [string, string][] = [
  ['neat', 'Neat rows'],
  ['mixed', 'Rows, stacks & leaning'],
  ['loose', 'Loose, with decor'],
];

export type Content = 'books' | 'mixed' | 'decor' | 'empty';

export interface FillOpts {
  style: string;
  palette: string;
  /** 0..1 share of the shelf length to fill. */
  fill: number;
  rand: () => number;
}

const BANDS = ['#c9a646', '#f1ece0', '#1c1c1c', '#8c2f39'];
const CERAMIC = ['#2f5d8c', '#ece6da', '#c26d47', '#3f7d4e', '#1f1f1f', '#d9b65a', '#8fa8a0'];

/** One upright book standing on y0 with its spine at zFront. */
function book(k: Kit, x: number, w: number, h: number, y0: number, d: number, zFront: number, color: string, r: () => number, lean = 0) {
  if (lean) {
    // leans left onto the run: top-left corner touches x, rests on its bottom corner
    const c = Math.cos(lean), s = Math.sin(lean);
    k.boxC(x + (w / 2) * c + (h / 2) * s, y0 + (w / 2) * s + (h / 2) * c, zFront - d / 2, w, h, d, color, { rot: [0, 0, lean], edges: false });
    return;
  }
  k.box(x, y0, zFront - d, x + w - 0.8, y0 + h, zFront, color, { edges: false });
  if (r() < 0.38 && h > 120) {
    const by = y0 + h * (0.72 + r() * 0.12);
    k.box(x + 0.5, by, zFront, x + w - 1.3, by + 6 + r() * 10, zFront + 0.8, BANDS[Math.floor(r() * BANDS.length)], { edges: false });
  }
}

/** A horizontal stack of books lying flat. Returns the stack width. */
function stack(k: Kit, x: number, y0: number, maxH: number, maxW: number, depth: number, zFront: number, pal: string[], r: () => number) {
  const w = Math.min(maxW, 150 + r() * 90);
  let y = y0;
  const n = 2 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const t = 18 + r() * 26;
    if (y + t > y0 + maxH - 5) break;
    const ww = w * (0.85 + r() * 0.15);
    const dd = depth * (0.85 + r() * 0.15);
    k.box(x + (w - ww) / 2, y, zFront - dd, x + (w + ww) / 2, y + t - 0.6, zFront, pal[Math.floor(r() * pal.length)], { edges: false });
    y += t;
  }
  return w;
}

/** A small decorative object; returns the width it used (0 if nothing fit). */
export function decor(k: Kit, x: number, y0: number, zc: number, maxW: number, maxH: number, maxD: number, r: () => number, kind?: string): number {
  const kinds = ['vase', 'plant', 'box', 'frame', 'bowl', 'figure', 'trailing'];
  const pick = kind ?? kinds[Math.floor(r() * kinds.length)];
  const glaze = `gloss:${CERAMIC[Math.floor(r() * CERAMIC.length)]}`;
  if (maxH < 70 || maxW < 60) return 0;
  switch (pick) {
    case 'vase': {
      const rr = Math.min(maxW / 2 - 5, maxD / 2 - 5, 45 + r() * 35);
      const h = Math.min(maxH - 10, 140 + r() * 140);
      k.cylY(x + rr + 5, y0, zc, rr, h * 0.7, glaze, { r2: rr * 0.8, seg: 24 });
      k.cylY(x + rr + 5, y0 + h * 0.7, zc, rr * 0.8, h * 0.3, glaze, { r2: rr * 0.45, seg: 24 });
      if (r() < 0.6) for (let i = 0; i < 4; i++) k.cylY(x + rr + 5 + (r() - 0.5) * 20, y0 + h * 0.8, zc + (r() - 0.5) * 20, 2.5, Math.min(maxH - h * 0.8 - 5, 120 + r() * 120), '#6b5a3a');
      return rr * 2 + 15;
    }
    case 'plant':
    case 'trailing': {
      const pr = Math.min(maxW / 2 - 5, maxD / 2 - 5, 55 + r() * 25);
      const ph = Math.min(maxH * 0.45, pr * 1.6);
      k.cylY(x + pr + 5, y0, zc, pr * 0.8, ph, glaze, { r2: pr, seg: 22 });
      const cx = x + pr + 5;
      if (pick === 'plant') {
        for (let i = 0; i < 5; i++) {
          const fr = pr * (0.6 + r() * 0.5);
          k.sphere(cx + (r() - 0.5) * pr, Math.min(y0 + ph + fr * 0.8 + r() * pr * 0.6, y0 + maxH - fr), zc + (r() - 0.5) * pr * 0.6, fr, i % 2 ? '#4f8a3f' : 'leaf2', [1, 1.15, 1]);
        }
      } else {
        // trailing vine spilling over the front edge
        for (let i = 0; i < 7; i++) {
          const t = i / 6;
          k.sphere(cx + (r() - 0.5) * pr * 1.5, y0 + ph + 10 - t * 260, zc + maxD / 2 + 10 + t * 25, 22 + r() * 14, i % 2 ? '#4f8a3f' : 'leaf2');
        }
        k.sphere(cx, y0 + ph + 25, zc, pr * 0.9, '#4f8a3f');
      }
      return pr * 2 + 15;
    }
    case 'box': {
      const w = Math.min(maxW - 10, 160 + r() * 120), h = Math.min(maxH - 10, 50 + r() * 90), d = Math.min(maxD - 20, 120 + r() * 80);
      const col = `gloss:${['#1f3b6b', '#7a2e2e', '#1c1c1c', '#c9a227'][Math.floor(r() * 4)]}`;
      k.box(x + 5, y0, zc - d / 2, x + 5 + w, y0 + h, zc + d / 2, col, { r: 4 });
      k.box(x + 5 - 1, y0 + h - 12, zc - d / 2 - 1, x + 5 + w + 1, y0 + h - 8, zc + d / 2 + 1, 'metal:#c9a646', { edges: false });
      return w + 15;
    }
    case 'frame': {
      const h = Math.min(maxH - 15, 180 + r() * 120), w = Math.min(maxW - 10, h * (0.7 + r() * 0.4));
      const z = zc - maxD / 2 + 25;
      const tilt = -0.12;
      k.boxC(x + 5 + w / 2, y0 + h / 2, z, w, h, 18, `gloss:${['#1c1c1c', '#c9a646', '#f2efe8', '#8a5a32'][Math.floor(r() * 4)]}`, { rot: [tilt, 0, 0] });
      k.boxC(x + 5 + w / 2, y0 + h / 2 + 1, z + 9.5, w * 0.78, h * 0.78, 1, ['#d9c7a3', '#9db4c0', '#c9a0a0', '#e8e2d6'][Math.floor(r() * 4)], { rot: [tilt, 0, 0], edges: false });
      return w + 15;
    }
    case 'bowl': {
      const rr = Math.min(maxW / 2 - 5, maxD / 2 - 5, 70 + r() * 40);
      k.cylY(x + rr + 5, y0, zc, rr * 0.55, Math.min(maxH - 10, 60), glaze, { r2: rr, seg: 26 });
      return rr * 2 + 15;
    }
    default: {
      // figurine: a small animal-ish sculpture
      const s = Math.min(maxH / 2.4, maxW / 3, 60 + r() * 20);
      const col = `gloss:${['#2b2c30', '#7a2e2e', '#c9a646'][Math.floor(r() * 3)]}`;
      k.sphere(x + 5 + s * 1.2, y0 + s * 0.9, zc, s, col, [1.25, 0.85, 0.8]);
      k.sphere(x + 5 + s * 2.1, y0 + s * 1.5, zc, s * 0.55, col);
      k.cylY(x + 5 + s * 0.5, y0, zc, s * 0.2, s * 0.6, col);
      k.cylY(x + 5 + s * 1.9, y0, zc, s * 0.2, s * 0.6, col);
      return s * 2.8 + 15;
    }
  }
}

/** Fill a shelf span [x0, x1] standing on y0 with books and/or decor. */
export function fillShelf(k: Kit, content: Content, x0: number, x1: number, y0: number, maxH: number, zBack: number, zFront: number, o: FillOpts) {
  if (content === 'empty' || maxH < 60 || x1 - x0 < 60) return;
  const r = o.rand;
  const pal = BOOK_PALETTES[o.palette] ?? BOOK_PALETTES.colorful;
  const depth = zFront - zBack;
  const zc = (zBack + zFront) / 2;
  if (content === 'decor') {
    let x = x0 + 20 + r() * 60;
    const n = 1 + Math.floor(r() * 2);
    for (let i = 0; i < n && x < x1 - 80; i++) {
      x += decor(k, x, y0, zc, x1 - x - 10, maxH, depth, r) + 40 + r() * 120;
    }
    return;
  }
  const decorChance = content === 'mixed' ? 0.5 : o.style === 'loose' ? 0.3 : 0;
  const stackChance = o.style === 'neat' ? 0 : o.style === 'loose' ? 0.3 : 0.18;
  const span = x1 - x0;
  const target = span * Math.min(1, Math.max(0.1, o.fill));
  const bookD = Math.max(60, Math.min(depth - 20, 170 + r() * 70));
  const zF = zFront - 12;
  const hMax = Math.min(maxH - 12, 320);
  // decide where the empty part goes: right, left or a decor gap in the middle
  let x = r() < 0.65 ? x0 + 2 : x0 + 2 + (span - target) * r();
  const end = Math.min(x1 - 2, x + target);
  let placedDecor = false;
  while (x < end - 15) {
    const roll = r();
    if (!placedDecor && decorChance && roll < decorChance * 0.35 && end - x > 160) {
      const w = decor(k, x + 10, y0, zc, Math.min(240, end - x - 10), maxH, depth, r);
      if (w) {
        x += w + 20;
        placedDecor = true;
        continue;
      }
    }
    if (stackChance && roll > 1 - stackChance && end - x > 160) {
      x += stack(k, x + 5, y0, Math.min(maxH, 240), end - x - 10, bookD, zF, pal, r) + 15;
      continue;
    }
    // a run of books, sometimes a matching series
    const series = r() < 0.3;
    const runN = 3 + Math.floor(r() * 9);
    const baseH = Math.max(110, hMax * (0.6 + r() * 0.4));
    const seriesColor = pal[Math.floor(r() * pal.length)];
    for (let i = 0; i < runN && x < end - 15; i++) {
      const w = Math.min(end - x, series ? 26 + r() * 6 : 16 + r() * 32);
      if (w < 12) break;
      const h = Math.min(hMax, series ? baseH : baseH * (0.82 + r() * 0.2));
      book(k, x, w, h, y0, bookD * (0.9 + r() * 0.1), zF, series ? seriesColor : pal[Math.floor(r() * pal.length)], r);
      x += w;
    }
    // occasionally a book leaning on the end of the run
    if (o.style !== 'neat' && r() < 0.35 && end - x > 70) {
      const h = Math.min(hMax, baseH * 0.9);
      const lean = 0.28 + r() * 0.12;
      book(k, x, 22, h, y0, bookD, zF, pal[Math.floor(r() * pal.length)], r, lean);
      x += 22 * Math.cos(lean) + h * Math.sin(lean) + 20;
    }
    x += o.style === 'neat' ? 0 : r() * 25;
  }
}

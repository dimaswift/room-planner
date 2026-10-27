import { Kit, clampN } from './kit';
import type { FurnitureDef } from './types';

export const desk: FurnitureDef = {
  type: 'desk',
  label: 'Desk',
  category: 'Tables & desks',
  mount: 'floor',
  wallAlign: true,
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 500, max: 3000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 300, max: 1200, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 450, max: 1250, step: 5, group: 'Size' },
    { key: 'top', label: 'Top thickness', type: 'number', unit: 'mm', min: 10, max: 80, step: 1, group: 'Size' },
    { key: 'legs', label: 'Legs', type: 'select', options: [['legs', 'Four legs'], ['panel', 'Side panels'], ['frame', 'Metal T-frame']], group: 'Base' },
    { key: 'legSize', label: 'Leg size', type: 'number', unit: 'mm', min: 20, max: 120, step: 1, group: 'Base', show: (p) => p.legs === 'legs' },
    { key: 'drawers', label: 'Drawer unit', type: 'select', options: [['none', 'None'], ['left', 'Left'], ['right', 'Right'], ['both', 'Both sides']], group: 'Drawers' },
    { key: 'drawerWidth', label: 'Unit width', type: 'number', unit: 'mm', min: 250, max: 700, step: 10, group: 'Drawers', show: (p) => p.drawers !== 'none' },
    { key: 'drawerCount', label: 'Drawers', type: 'int', min: 1, max: 6, group: 'Drawers', show: (p) => p.drawers !== 'none' },
    { key: 'modesty', label: 'Modesty panel', type: 'bool', group: 'Base' },
    { key: 'color', label: 'Top', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Base', type: 'color', group: 'Colours' },
  ],
  defaults: { width: 1400, depth: 700, height: 750, top: 25, legs: 'legs', legSize: 45, drawers: 'none', drawerWidth: 400, drawerCount: 3, modesty: false, color: '#c8a77e', color2: '#2e2e30' },
  presets: [
    { name: 'Desk', params: {} },
    { name: 'Desk with drawers', params: { width: 1500, legs: 'panel', drawers: 'right', color: '#f0eee9', color2: '#f0eee9', modesty: true } },
    { name: 'Standing desk', params: { width: 1600, depth: 800, height: 1100, legs: 'frame', color: '#d9c3a5', color2: '#d8d8d8' } },
    { name: 'Vanity table', params: { width: 1000, depth: 450, height: 760, drawers: 'both', drawerWidth: 300, drawerCount: 2, legSize: 35, color: '#efe9df', color2: '#efe9df' } },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, D = p.depth, H = p.height, tt = p.top;
    const yb = H - tt;
    k.box(-W / 2, yb, -D / 2, W / 2, H, D / 2, 'body');
    k.col(-W / 2, yb, -D / 2, W / 2, H, D / 2);
    const left = p.drawers === 'left' || p.drawers === 'both';
    const right = p.drawers === 'right' || p.drawers === 'both';
    const dw = Math.min(p.drawerWidth, W / (p.drawers === 'both' ? 2.5 : 1.6));

    const pedestal = (x0: number, x1: number) => {
      k.box(x0, 0, -D / 2 + 30, x1, yb, D / 2 - 10, 'accent');
      k.col(x0, 0, -D / 2 + 30, x1, yb, D / 2 - 10);
      const n = Math.round(p.drawerCount);
      const fh = (yb - 40) / n;
      for (let i = 0; i < n; i++) {
        const y0 = 30 + i * fh;
        k.box(x0 + 3, y0 + 2, D / 2 - 10, x1 - 3, y0 + fh - 2, D / 2 + 8, 'accent');
        k.box((x0 + x1) / 2 - 60, y0 + fh * 0.7 - 5, D / 2 + 8, (x0 + x1) / 2 + 60, y0 + fh * 0.7 + 5, D / 2 + 26, 'metal');
      }
      k.h('front', x0, x1, 0, -1);
    };
    if (left) pedestal(-W / 2 + 5, -W / 2 + 5 + dw);
    if (right) pedestal(W / 2 - 5 - dw, W / 2 - 5);

    const side = (x: number, hasPed: boolean) => {
      if (hasPed) return;
      if (p.legs === 'legs') {
        const s = p.legSize;
        const xx = x < 0 ? -W / 2 + 20 : W / 2 - 20 - s;
        for (const z of [-D / 2 + 20, D / 2 - 20 - s]) {
          k.box(xx, 0, z, xx + s, yb, z + s, 'accent');
          k.col(xx, 0, z, xx + s, yb, z + s);
        }
      } else if (p.legs === 'panel') {
        const xx = x < 0 ? -W / 2 + 10 : W / 2 - 35;
        k.box(xx, 0, -D / 2 + 10, xx + 25, yb, D / 2 - 10, 'accent');
        k.col(xx, 0, -D / 2 + 10, xx + 25, yb, D / 2 - 10);
      } else {
        const xx = x < 0 ? -W / 2 + 80 : W / 2 - 140;
        k.box(xx, 0, -D / 2 + 30, xx + 60, 40, D / 2 - 30, 'accent');
        k.box(xx + 5, 40, -30, xx + 55, yb - 30, 30, 'accent');
        k.box(xx, yb - 30, -D / 2 + 50, xx + 60, yb, D / 2 - 50, 'accent');
        k.col(xx, 0, -D / 2 + 30, xx + 60, 40, D / 2 - 30);
        k.col(xx + 5, 0, -30, xx + 55, yb, 30);
      }
    };
    side(-1, left);
    side(1, right);
    if (p.legs === 'frame') k.box(-W / 2 + 140, yb - 60, -25, W / 2 - 140, yb - 20, 15, 'accent');
    if (p.modesty) {
      k.box(-W / 2 + 40, yb - 320, -D / 2 + 50, W / 2 - 40, yb, -D / 2 + 68, 'accent');
      k.col(-W / 2 + 40, yb - 320, -D / 2 + 50, W / 2 - 40, yb, -D / 2 + 68);
    }
    k.v('front', yb, H, W / 2, 1);
    k.v('front', 0, yb, W / 2, 1, 'knee');
    return k.done([W, H, D]);
  },
};

export const table: FurnitureDef = {
  type: 'table',
  label: 'Table',
  category: 'Tables & desks',
  mount: 'floor',
  params: [
    { key: 'shape', label: 'Shape', type: 'select', options: [['rect', 'Rectangular'], ['round', 'Round / oval']], group: 'Size' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 300, max: 4000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 300, max: 2000, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 200, max: 1200, step: 5, group: 'Size' },
    { key: 'top', label: 'Top thickness', type: 'number', unit: 'mm', min: 10, max: 100, step: 1, group: 'Size' },
    { key: 'legs', label: 'Base', type: 'select', options: [['corner', 'Four legs'], ['pedestal', 'Pedestal'], ['trestle', 'Trestle']], group: 'Base' },
    { key: 'legSize', label: 'Leg size', type: 'number', unit: 'mm', min: 20, max: 150, step: 1, group: 'Base', show: (p) => p.legs === 'corner' },
    { key: 'legInset', label: 'Leg inset', type: 'number', unit: 'mm', min: 0, max: 400, step: 5, group: 'Base', show: (p) => p.legs === 'corner' },
    { key: 'apron', label: 'Apron', type: 'bool', group: 'Base', show: (p) => p.legs === 'corner' && p.shape === 'rect' },
    { key: 'shelf', label: 'Lower shelf', type: 'bool', group: 'Base', show: (p) => p.legs === 'corner' && p.shape === 'rect' },
    { key: 'color', label: 'Top', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Base', type: 'color', group: 'Colours' },
  ],
  defaults: { shape: 'rect', width: 1600, depth: 900, height: 750, top: 30, legs: 'corner', legSize: 60, legInset: 50, apron: true, shelf: false, color: '#a87c55', color2: '#a87c55' },
  presets: [
    { name: 'Dining table', params: {} },
    { name: 'Round dining table', params: { shape: 'round', width: 1100, depth: 1100, legs: 'pedestal', color: '#e8e3da', color2: '#2f2f2f' } },
    { name: 'Coffee table', params: { width: 1100, depth: 600, height: 420, top: 25, legSize: 40, legInset: 30, apron: false, shelf: true, color: '#c29a6b', color2: '#c29a6b' } },
    { name: 'Side table', params: { shape: 'round', width: 450, depth: 450, height: 550, top: 20, legs: 'corner', legSize: 25, legInset: 40, color: '#e2ddd4', color2: '#2b2b2b' } },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, D = p.depth, H = p.height, tt = p.top;
    const yb = H - tt;
    const round = p.shape === 'round';
    if (round) {
      k.cylY(0, yb, 0, W / 2, tt, 'body', { rz: D / 2, seg: 48 });
      k.col(-W / 2, yb, -D * 0.2, W / 2, H, D * 0.2);
      k.col(-W * 0.2, yb, -D / 2, W * 0.2, H, D / 2);
      k.col(-W * 0.36, yb, -D * 0.36, W * 0.36, H, D * 0.36);
    } else {
      k.box(-W / 2, yb, -D / 2, W / 2, H, D / 2, 'body');
      k.col(-W / 2, yb, -D / 2, W / 2, H, D / 2);
    }
    if (p.legs === 'corner') {
      const s = p.legSize;
      const pos: [number, number][] = [];
      if (round) {
        const rx = W / 2 - p.legInset - s, rz = D / 2 - p.legInset - s;
        for (const a of [45, 135, 225, 315]) pos.push([Math.cos((a * Math.PI) / 180) * rx, Math.sin((a * Math.PI) / 180) * rz]);
      } else {
        const ix = W / 2 - p.legInset - s / 2, iz = D / 2 - p.legInset - s / 2;
        for (const x of [-ix, ix]) for (const z of [-iz, iz]) pos.push([x, z]);
      }
      for (const [x, z] of pos) {
        if (round) k.cylY(x, 0, z, s / 2, yb, 'accent', { r2: s / 2 + 2 });
        else k.box(x - s / 2, 0, z - s / 2, x + s / 2, yb, z + s / 2, 'accent');
        k.col(x - s / 2, 0, z - s / 2, x + s / 2, yb, z + s / 2);
      }
      if (!round && p.apron) {
        const ix = W / 2 - p.legInset - s, iz = D / 2 - p.legInset - s;
        const ah = Math.min(90, yb * 0.18);
        k.box(-ix, yb - ah, iz - 2, ix, yb, iz + 18, 'accent');
        k.box(-ix, yb - ah, -iz - 18, ix, yb, -iz + 2, 'accent');
        k.box(-ix - 18 + 2, yb - ah, -iz, -ix + 2, yb, iz, 'accent');
        k.box(ix - 2, yb - ah, -iz, ix + 18 - 2, yb, iz, 'accent');
      }
      if (!round && p.shelf) {
        const ix = W / 2 - p.legInset - s / 2, iz = D / 2 - p.legInset - s / 2;
        const sy = Math.min(120, yb * 0.3);
        k.box(-ix, sy, -iz, ix, sy + 18, iz, 'body');
        k.col(-ix, sy, -iz, ix, sy + 18, iz);
      }
    } else if (p.legs === 'pedestal') {
      const twin = !round && W > D * 1.6;
      for (const x of twin ? [-W / 4, W / 4] : [0]) {
        const br = clampN(Math.min(W, D) * 0.32, 150, 380);
        k.cylY(x, 0, 0, br, 30, 'accent', { seg: 32 });
        k.cylY(x, 30, 0, 55, yb - 30, 'accent', { r2: 45 });
        k.cylY(x, yb - 25, 0, 140, 25, 'accent');
        k.col(x - br, 0, -br, x + br, 30, br);
        k.col(x - 55, 0, -55, x + 55, yb, 55);
      }
    } else {
      const pw = Math.min(D * 0.7, 700);
      for (const x of [-W / 2 + W * 0.15, W / 2 - W * 0.15]) {
        k.box(x - 35, 0, -pw / 2, x + 35, 50, pw / 2, 'accent');
        k.box(x - 30, 50, -60, x + 30, yb, 60, 'accent');
        k.box(x - 35, yb - 45, -pw / 2, x + 35, yb, pw / 2, 'accent');
        k.col(x - 35, 0, -pw / 2, x + 35, 50, pw / 2);
        k.col(x - 30, 0, -60, x + 30, yb, 60);
      }
      k.box(-W / 2 + W * 0.15, yb * 0.35, -25, W / 2 - W * 0.15, yb * 0.35 + 60, 25, 'accent');
    }
    k.v('front', 0, yb, W / 2, 1, 'clear');
    return k.done([W, H, D]);
  },
};

export const chair: FurnitureDef = {
  type: 'chair',
  label: 'Chair',
  category: 'Seating',
  mount: 'floor',
  params: [
    { key: 'style', label: 'Style', type: 'select', options: [['dining', 'Dining chair'], ['office', 'Office chair'], ['stool', 'Stool']], group: 'Type' },
    { key: 'seatWidth', label: 'Seat width', type: 'number', unit: 'mm', min: 300, max: 800, step: 5, group: 'Seat' },
    { key: 'seatDepth', label: 'Seat depth', type: 'number', unit: 'mm', min: 300, max: 700, step: 5, group: 'Seat' },
    { key: 'seatHeight', label: 'Seat height', type: 'number', unit: 'mm', min: 250, max: 900, step: 5, group: 'Seat' },
    { key: 'seatThickness', label: 'Seat thickness', type: 'number', unit: 'mm', min: 15, max: 120, step: 1, group: 'Seat' },
    { key: 'height', label: 'Overall height', type: 'number', unit: 'mm', min: 400, max: 1400, step: 5, group: 'Back', show: (p) => p.style !== 'stool' },
    { key: 'back', label: 'Back style', type: 'select', options: [['panel', 'Panel'], ['slats', 'Slats'], ['rails', 'Rails']], group: 'Back', show: (p) => p.style === 'dining' },
    { key: 'arms', label: 'Armrests', type: 'bool', group: 'Back', show: (p) => p.style !== 'stool' },
    { key: 'legSize', label: 'Leg size', type: 'number', unit: 'mm', min: 15, max: 80, step: 1, group: 'Frame', show: (p) => p.style !== 'office' },
    { key: 'color', label: 'Frame', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Seat', type: 'color', group: 'Colours' },
  ],
  defaults: { style: 'dining', seatWidth: 450, seatDepth: 450, seatHeight: 460, seatThickness: 40, height: 880, back: 'slats', arms: false, legSize: 35, color: '#8b6443', color2: '#c9b8a0' },
  presets: [
    { name: 'Dining chair', params: {} },
    { name: 'Office chair', params: { style: 'office', seatWidth: 500, seatDepth: 480, seatHeight: 480, seatThickness: 70, height: 1150, arms: true, color: '#2c2c2e', color2: '#3d4650' } },
    { name: 'Bar stool', params: { style: 'stool', seatWidth: 380, seatDepth: 380, seatHeight: 750, seatThickness: 35, legSize: 30, color: '#2b2b2b', color2: '#a6774e' } },
  ],
  build(p) {
    const k = new Kit();
    const sw = p.seatWidth, sd = p.seatDepth, sh = p.seatHeight, st = p.seatThickness;
    const H = p.style === 'stool' ? sh : Math.max(p.height, sh + 150);
    const ls = p.legSize;

    if (p.style === 'office') {
      const R = 330;
      for (let i = 0; i < 5; i++) {
        const a = (i * 72 * Math.PI) / 180;
        const cx = Math.sin(a) * (R / 2), cz = Math.cos(a) * (R / 2);
        k.boxC(cx, 55, cz, 50, 30, R, 'dark', { rot: [0, a, 0] });
        k.sphere(Math.sin(a) * (R - 25), 25, Math.cos(a) * (R - 25), 25, 'dark');
      }
      k.cylY(0, 40, 0, 45, 60, 'dark');
      k.cylY(0, 100, 0, 22, sh - 190, 'metal');
      k.box(-100, sh - 95, -110, 100, sh - st, 110, 'dark');
      k.box(-sw / 2, sh - st, -sd / 2 + 20, sw / 2, sh, sd / 2 + 20, 'accent', { r: 28 });
      k.box(-25, sh - 90, -sd / 2 - 20, 25, sh + 120, -sd / 2 + 20, 'dark');
      k.box(-sw * 0.45, sh + 90, -sd / 2 - 70, sw * 0.45, H, -sd / 2 - 10, 'accent', { r: 28, rot: [-0.1, 0, 0] });
      if (p.arms) {
        for (const s of [-1, 1]) {
          const x = s * (sw / 2 + 25);
          k.box(x - 15, sh - 80, -20, x + 15, sh + 210, 20, 'dark');
          k.box(x - 35, sh + 210, -150, x + 35, sh + 240, 110, 'dark', { r: 12 });
        }
      }
      const W = Math.max(2 * R, sw + (p.arms ? 110 : 0));
      k.col(-R, 0, -R, R, 80, R);
      k.col(-sw / 2, 0, -sd / 2 + 20, sw / 2, sh, sd / 2 + 20);
      k.col(-sw / 2, sh, -sd / 2 - 75, sw / 2, H, -sd / 2 + 20);
      if (p.arms) k.col(-W / 2, sh - 80, -150, W / 2, sh + 240, 110);
      k.v('front', 0, sh, W / 2, 1, 'seat');
      return k.done([W, H, 2 * R]);
    }

    if (p.style === 'stool') {
      const r = sw / 2;
      k.cylY(0, sh - st, 0, r, st, 'accent', { seg: 32 });
      const lr = r * 0.72;
      const legs: [number, number][] = [[-lr, -lr], [lr, -lr], [lr, lr], [-lr, lr]].map(([x, z]) => [x * 0.75, z * 0.75]);
      for (const [x, z] of legs) k.box(x - ls / 2, 0, z - ls / 2, x + ls / 2, sh - st, z + ls / 2, 'body');
      const fy = sh * 0.33;
      const e = lr * 0.75;
      k.box(-e, fy, -e - 8, e, fy + 18, -e + 8, 'body');
      k.box(-e, fy, e - 8, e, fy + 18, e + 8, 'body');
      k.box(-e - 8, fy, -e, -e + 8, fy + 18, e, 'body');
      k.box(e - 8, fy, -e, e + 8, fy + 18, e, 'body');
      k.col(-r, 0, -r, r, sh, r);
      k.v('front', fy, fy + 18, r, 1, 'footrest');
      return k.done([sw, sh, sw]);
    }

    // dining
    const zb = -sd / 2, zf = sd / 2;
    const ys = sh - st;
    for (const x of [-sw / 2 + 8, sw / 2 - 8 - ls]) {
      k.box(x, 0, zf - 8 - ls, x + ls, ys, zf - 8, 'body');
      k.box(x, 0, zb, x + ls, H, zb + ls, 'body');
    }
    k.box(-sw / 2 + 8, ys - 70, zb + ls, -sw / 2 + 8 + 20, ys, zf - 8 - ls, 'body');
    k.box(sw / 2 - 28, ys - 70, zb + ls, sw / 2 - 8, ys, zf - 8 - ls, 'body');
    k.box(-sw / 2 + 8 + ls, ys - 70, zf - 28, sw / 2 - 8 - ls, ys, zf - 8, 'body');
    k.box(-sw / 2, ys, zb + 5, sw / 2, sh, zf, 'accent', { r: 8 });
    const bx0 = -sw / 2 + 8 + ls, bx1 = sw / 2 - 8 - ls;
    const bz0 = zb + ls * 0.2, bz1 = zb + ls * 0.8;
    if (p.back === 'panel') {
      k.box(bx0, H - 260, bz0, bx1, H - 30, bz1, 'body');
    } else if (p.back === 'slats') {
      k.box(bx0, H - 90, bz0, bx1, H - 20, bz1, 'body');
      const n = 3;
      for (let i = 0; i < n; i++) {
        const cx = bx0 + ((i + 1) * (bx1 - bx0)) / (n + 1);
        k.box(cx - 15, sh + 60, bz0 + 2, cx + 15, H - 90, bz1 - 2, 'body');
      }
    } else {
      for (const y of [H - 80, H - 220, H - 360]) if (y > sh + 60) k.box(bx0, y - 50, bz0, bx1, y, bz1, 'body');
    }
    if (p.arms) {
      for (const s of [-1, 1]) {
        const x = s * (sw / 2 - 8 - ls / 2);
        k.box(x - ls / 2, sh + 215, zb + ls, x + ls / 2, sh + 245, zf - 10, 'body');
        k.box(x - 12, sh, zf - 50, x + 12, sh + 215, zf - 26, 'body');
      }
      k.col(-sw / 2, sh, zb, sw / 2, sh + 245, zf);
    }
    k.col(-sw / 2, 0, zb, sw / 2, sh, zf);
    k.col(-sw / 2, sh, zb, sw / 2, H, zb + ls);
    k.v('front', 0, sh, sw / 2, 1, 'seat');
    return k.done([sw, H, sd]);
  },
};

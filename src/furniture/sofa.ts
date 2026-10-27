import { darken } from '../colors';
import { Kit, clampN, finishParam } from './kit';
import type { FurnitureDef } from './types';

export const sofa: FurnitureDef = {
  type: 'sofa',
  label: 'Sofa',
  category: 'Seating',
  mount: 'floor',
  wallAlign: true,
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 600, max: 5000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 500, max: 1500, step: 10, group: 'Size' },
    { key: 'height', label: 'Back height', type: 'number', unit: 'mm', min: 500, max: 1300, step: 10, group: 'Size' },
    { key: 'seatHeight', label: 'Seat height', type: 'number', unit: 'mm', min: 250, max: 700, step: 10, group: 'Seat' },
    { key: 'seats', label: 'Seat cushions', type: 'int', min: 1, max: 6, group: 'Seat' },
    { key: 'backThickness', label: 'Back depth', type: 'number', unit: 'mm', min: 100, max: 450, step: 10, group: 'Seat' },
    { key: 'tufted', label: 'Button tufting', type: 'bool', group: 'Seat' },
    { key: 'arms', label: 'Arms', type: 'select', options: [['square', 'Square'], ['round', 'Rounded'], ['none', 'None']], group: 'Arms' },
    { key: 'armWidth', label: 'Arm width', type: 'number', unit: 'mm', min: 40, max: 400, step: 10, group: 'Arms', show: (p) => p.arms !== 'none' },
    { key: 'armHeight', label: 'Arm height', type: 'number', unit: 'mm', min: 300, max: 1000, step: 10, group: 'Arms', show: (p) => p.arms !== 'none' },
    { key: 'chaise', label: 'Chaise (seen from front)', type: 'select', options: [['none', 'None'], ['left', 'Left'], ['right', 'Right']], group: 'Chaise' },
    { key: 'chaiseLength', label: 'Chaise length', type: 'number', unit: 'mm', min: 800, max: 2500, step: 10, group: 'Chaise', show: (p) => p.chaise !== 'none' },
    { key: 'base', label: 'Base', type: 'select', options: [['legs', 'Legs'], ['plinth', 'Plinth']], group: 'Base' },
    { key: 'legHeight', label: 'Leg height', type: 'number', unit: 'mm', min: 20, max: 300, step: 5, group: 'Base', show: (p) => p.base === 'legs' },
    { key: 'color', label: 'Upholstery', type: 'color', group: 'Colours' },
    finishParam('finish', 'Upholstery finish'),
    { key: 'color2', label: 'Legs', type: 'color', group: 'Colours', show: (p) => p.base === 'legs' },
    finishParam('finish2', 'Legs finish', (p) => p.base === 'legs'),
  ],
  defaults: {
    width: 2200, depth: 950, height: 820, seatHeight: 430, seats: 3, backThickness: 230,
    arms: 'square', armWidth: 160, armHeight: 600, chaise: 'none', chaiseLength: 1650,
    base: 'legs', legHeight: 120, color: '#7d8a99', color2: '#3b2f2a', finish: 'fabric', finish2: 'wood', tufted: false,
  },
  presets: [
    { name: '3-seat sofa', params: {} },
    { name: '2-seat sofa', params: { width: 1700, seats: 2 } },
    { name: 'Corner sofa', params: { width: 2700, seats: 3, chaise: 'right', chaiseLength: 1650 } },
    { name: 'Armchair', params: { width: 900, depth: 880, seats: 1, height: 860, color: '#a2785a' } },
    {
      name: 'Leather sofa',
      params: { width: 2300, depth: 980, height: 780, seatHeight: 420, color: '#7a4526', finish: 'leather', tufted: true, arms: 'round', armWidth: 210, armHeight: 640, backThickness: 270, legHeight: 80, color2: '#2a1d16' },
    },
    {
      name: 'Leather armchair',
      params: { width: 1000, depth: 950, height: 800, seats: 1, color: '#7a4526', finish: 'leather', tufted: true, arms: 'round', armWidth: 200, armHeight: 640, backThickness: 260, legHeight: 80, color2: '#2a1d16' },
    },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, D = p.depth, H = p.height;
    const sH = clampN(p.seatHeight, 150, H - 100);
    const aw = p.arms === 'none' ? 0 : Math.min(p.armWidth, W / 3);
    const aH = clampN(p.armHeight, sH, H);
    const legH = p.base === 'legs' ? Math.min(p.legHeight, sH - 120) : 0;
    const hasCh = p.chaise !== 'none';
    const CL = hasCh ? Math.max(p.chaiseLength, D + 200) : D;
    const Dt = Math.max(D, CL);
    const zb = -Dt / 2, zf = zb + D, zc = zb + CL;
    const bt = clampN(p.backThickness, 80, D - 250);
    const cushT = clampN((sH - legH) * 0.42, 60, 170);
    const baseTop = sH - cushT;
    const xi0 = -W / 2 + aw, xi1 = W / 2 - aw;
    const N = Math.max(1, Math.round(p.seats));
    const sw = (xi1 - xi0) / N;
    const chLeft = p.chaise === 'left';
    const chX0 = chLeft ? xi0 : xi1 - sw;
    const chX1 = chX0 + sw;
    const bf = Math.min(bt * 0.45, 110);

    // frame
    k.box(xi0, legH, zb, xi1, baseTop, zf, 'body');
    if (hasCh) k.box(chX0, legH, zf - 1, chX1, baseTop, zc, 'body');
    k.box(xi0, legH, zb, xi1, H - 70, zb + bf, 'body', { r: 20 });

    // arms
    const armR = p.arms === 'round' ? Math.min(aw / 2 - 1, 70) : 18;
    if (aw > 0) {
      const zl = hasCh && chLeft ? zc : zf;
      const zr = hasCh && !chLeft ? zc : zf;
      k.box(-W / 2, legH, zb, -W / 2 + aw, aH, zl, 'body', { r: armR });
      k.box(W / 2 - aw, legH, zb, W / 2, aH, zr, 'body', { r: armR });
    }

    // cushions
    for (let i = 0; i < N; i++) {
      const x0 = xi0 + i * sw;
      const x1 = x0 + sw;
      const isCh = hasCh && Math.abs(x0 - chX0) < 1;
      k.box(x0 + 4, baseTop, zb + bt, x1 - 4, sH, isCh ? zc : zf + 10, 'body', { r: 34 });
      k.box(x0 + 6, sH - 10, zb + bf - 5, x1 - 6, H, zb + bt + 15, 'body', { r: 45, rot: [-0.07, 0, 0] });
      if (p.tufted) {
        // diamond-pattern buttons pressed into the back cushion
        const btn = `${p.finish ?? 'fabric'}:${darken(p.color, 0.35)}`;
        const cy = (sH - 10 + H) / 2;
        const per = Math.max(2, Math.round((x1 - x0) / 220));
        for (let row = 0; row < 3; row++) {
          const y = sH + 80 + row * ((H - sH - 150) / 2);
          const n = row % 2 ? per - 1 : per;
          for (let j = 0; j < n; j++) {
            const x = x0 + ((j + (row % 2 ? 1 : 0.5)) * (x1 - x0)) / per;
            k.sphere(x, y, zb + bt + 12 - (y - cy) * Math.tan(0.07), 9, btn);
          }
        }
      }
    }

    // legs
    if (legH > 0) {
      const xs = [-W / 2 + 55, W / 2 - 55];
      if (W > 1900) xs.push(0);
      const zs = [zb + 55, zf - 55];
      for (const x of xs) for (const z of zs) k.cylY(x, 0, z, 20, legH, 'accent', { r2: 24 });
      if (hasCh) {
        const xo = chLeft ? -W / 2 + 55 : W / 2 - 55;
        const xin = chLeft ? chX1 - 55 : chX0 + 55;
        k.cylY(xo, 0, zc - 55, 20, legH, 'accent', { r2: 24 });
        k.cylY(xin, 0, zc - 55, 20, legH, 'accent', { r2: 24 });
      }
    }

    // colliders
    k.col(-W / 2, 0, zb, W / 2, H, zb + bt);
    k.col(-W / 2, 0, zb, W / 2, sH, zf);
    if (aw > 0) {
      k.col(-W / 2, 0, zb, -W / 2 + aw, aH, hasCh && chLeft ? zc : zf);
      k.col(W / 2 - aw, 0, zb, W / 2, aH, hasCh && !chLeft ? zc : zf);
    }
    if (hasCh) k.col(chLeft ? -W / 2 : chX0, 0, zf, chLeft ? chX1 : W / 2, sH, zc);

    // dimensions
    k.v('front', 0, sH, W / 2, 1, 'seat');
    if (aw > 0) {
      k.v('front', 0, aH, -W / 2, -1, 'arm');
      k.h('front', -W / 2, -W / 2 + aw, aH, 1);
      k.h('front', xi0, xi1, sH, 1, 'seat width');
    }
    k.h('side', -zf, -(zb + bt), sH, 1, 'seat depth');
    if (hasCh) k.v('top', zb, zc, chLeft ? -W / 2 : W / 2, chLeft ? -1 : 1, 'chaise');

    return k.done([W, H, Dt], { note: hasCh ? `chaise ${Math.round(CL)}` : undefined });
  },
};

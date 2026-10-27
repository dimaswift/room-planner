import { Kit, clampN, finishParam } from './kit';
import type { FurnitureDef } from './types';

export const bed: FurnitureDef = {
  type: 'bed',
  label: 'Bed',
  category: 'Bedroom',
  mount: 'floor',
  wallAlign: true,
  params: [
    { key: 'mattressWidth', label: 'Mattress width', type: 'number', unit: 'mm', min: 600, max: 2400, step: 10, group: 'Mattress' },
    { key: 'mattressLength', label: 'Mattress length', type: 'number', unit: 'mm', min: 1400, max: 2400, step: 10, group: 'Mattress' },
    { key: 'mattressHeight', label: 'Mattress height', type: 'number', unit: 'mm', min: 80, max: 400, step: 10, group: 'Mattress' },
    { key: 'frameHeight', label: 'Frame height', type: 'number', unit: 'mm', min: 100, max: 700, step: 10, group: 'Frame', hint: 'Top of the side rails' },
    { key: 'frameThickness', label: 'Rail thickness', type: 'number', unit: 'mm', min: 15, max: 150, step: 5, group: 'Frame' },
    { key: 'legHeight', label: 'Leg height', type: 'number', unit: 'mm', min: 0, max: 400, step: 5, group: 'Frame' },
    { key: 'headboard', label: 'Headboard', type: 'select', options: [['panel', 'Panel'], ['upholstered', 'Upholstered'], ['none', 'None']], group: 'Headboard' },
    { key: 'headboardHeight', label: 'Headboard height', type: 'number', unit: 'mm', min: 300, max: 1600, step: 10, group: 'Headboard', show: (p) => p.headboard !== 'none' },
    { key: 'headboardThickness', label: 'Headboard thickness', type: 'number', unit: 'mm', min: 20, max: 250, step: 5, group: 'Headboard', show: (p) => p.headboard !== 'none' },
    { key: 'footboard', label: 'Footboard', type: 'bool', group: 'Headboard' },
    { key: 'footboardHeight', label: 'Footboard height', type: 'number', unit: 'mm', min: 200, max: 1000, step: 10, group: 'Headboard', show: (p) => p.footboard },
    { key: 'pillows', label: 'Pillows', type: 'int', min: 0, max: 4, group: 'Bedding' },
    { key: 'duvet', label: 'Duvet', type: 'bool', group: 'Bedding' },
    { key: 'color', label: 'Frame', type: 'color', group: 'Colours' },
    finishParam('finish', 'Frame finish'),
    { key: 'color2', label: 'Bedding', type: 'color', group: 'Colours' },
  ],
  defaults: {
    mattressWidth: 1600, mattressLength: 2000, mattressHeight: 220, frameHeight: 320, frameThickness: 40, legHeight: 80,
    headboard: 'upholstered', headboardHeight: 1050, headboardThickness: 90, footboard: false, footboardHeight: 450,
    pillows: 2, duvet: true, color: '#b49a7d', color2: '#e8e1d4', finish: 'wood', finish2: 'fabric',
  },
  presets: [
    { name: 'Double 160×200', params: {} },
    { name: 'King 180×200', params: { mattressWidth: 1800 } },
    { name: 'Single 90×200', params: { mattressWidth: 900, pillows: 1, headboard: 'panel', headboardHeight: 850 } },
    { name: 'Crib 60×120', params: { mattressWidth: 600, mattressLength: 1200, mattressHeight: 100, frameHeight: 450, legHeight: 120, headboard: 'panel', headboardHeight: 900, footboard: true, footboardHeight: 900, pillows: 0, color: '#f2f0ec' } },
  ],
  build(p) {
    const k = new Kit();
    const mW = p.mattressWidth, mL = p.mattressLength, mH = p.mattressHeight;
    const ft = p.frameThickness;
    const hb = p.headboard !== 'none';
    const hbT = hb ? p.headboardThickness : ft;
    const W = mW + 2 * ft;
    const L = mL + hbT + ft;
    const zb = -L / 2, zf = L / 2;
    const zm0 = zb + hbT, zm1 = zf - ft;
    const legH = Math.min(p.legHeight, p.frameHeight - 60);
    const fH = p.frameHeight;
    const deck = fH - 50;
    const mTop = deck + mH;

    // legs + frame
    if (legH > 0) {
      for (const x of [-W / 2, W / 2 - 60]) for (const z of [zb + (hb ? hbT - 60 : 0), zf - 60]) k.box(x, 0, z, x + 60, legH, z + 60, 'body');
    }
    k.box(-W / 2, legH, zm0, -W / 2 + ft, fH, zf, 'body');
    k.box(W / 2 - ft, legH, zm0, W / 2, fH, zf, 'body');
    if (!p.footboard) k.box(-W / 2 + ft, legH, zm1, W / 2 - ft, fH, zf, 'body');
    k.box(-mW / 2, deck - 25, zm0, mW / 2, deck, zm1, 'body');
    // mattress & bedding
    k.box(-mW / 2 + 5, deck, zm0 + 5, mW / 2 - 5, mTop, zm1 - 5, 'mattress', { r: 40 });
    if (p.duvet) k.box(-mW / 2 - 18, mTop - Math.min(150, mH - 20), zm0 + mL * 0.27, mW / 2 + 18, mTop + 45, zm1 + 15, 'accent', { r: 28 });
    const n = Math.round(p.pillows);
    if (n > 0) {
      const pw = Math.min(700, (mW - 60) / n - 30);
      for (let i = 0; i < n; i++) {
        const cx = -mW / 2 + 30 + (i + 0.5) * ((mW - 60) / n);
        k.box(cx - pw / 2, mTop - 10, zm0 + 40, cx + pw / 2, mTop + 130, zm0 + 420, 'pillow', { r: 55 });
      }
    }
    // headboard / footboard
    const hbH = hb ? Math.max(p.headboardHeight, mTop + 50) : fH;
    if (hb) {
      if (p.headboard === 'upholstered') {
        k.box(-W / 2, 0, zb, W / 2, hbH - 10, zb + hbT * 0.45, 'body');
        k.box(-W / 2 + 15, fH - 40, zb + hbT * 0.45 - 5, W / 2 - 15, hbH, zm0, `fabric:${p.color}`, { r: 35 });
      } else {
        k.box(-W / 2, 0, zb, W / 2, hbH, zm0, 'body');
      }
    } else {
      k.box(-W / 2, legH, zb, W / 2, fH, zm0, 'body');
    }
    const fbH = p.footboard ? Math.max(p.footboardHeight, fH) : fH;
    if (p.footboard) k.box(-W / 2, 0, zm1, W / 2, fbH, zf, 'body');

    // colliders
    k.col(-W / 2, 0, zb, W / 2, Math.max(mTop + 45, fbH), zf);
    if (hb) k.col(-W / 2, 0, zb, W / 2, hbH, zm0);

    // dimensions
    k.h('top', -mW / 2, mW / 2, zm1, -1, 'mattress');
    k.v('top', zm0, zm1, W / 2, 1, 'mattress');
    k.v('front', 0, mTop, W / 2, 1, 'sleep');
    k.v('side', 0, fH, -zf, -1, 'frame');

    return k.done([W, hbH, L], { note: `mattress ${mW}×${mL}` });
  },
};

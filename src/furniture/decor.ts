import { Kit, finishParam, rng } from './kit';
import type { FurnitureDef, Params } from './types';

export const rug: FurnitureDef = {
  type: 'rug',
  label: 'Rug',
  category: 'Decor',
  mount: 'rug',
  params: [
    { key: 'shape', label: 'Shape', type: 'select', options: [['rect', 'Rectangular'], ['round', 'Round / oval']], group: 'Size' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 300, max: 6000, step: 10, group: 'Size' },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', min: 300, max: 8000, step: 10, group: 'Size' },
    { key: 'thickness', label: 'Pile height', type: 'number', unit: 'mm', min: 2, max: 50, step: 1, group: 'Size' },
    { key: 'pattern', label: 'Pattern', type: 'select', options: [['plain', 'Plain'], ['border', 'Border'], ['stripes', 'Stripes'], ['kilim', 'Kilim stripes'], ['persian', 'Persian'], ['jute', 'Jute weave']], group: 'Look' },
    { key: 'color', label: 'Base', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Pattern', type: 'color', group: 'Colours', show: (p) => p.pattern !== 'plain' },
  ],
  defaults: { shape: 'rect', width: 2000, length: 3000, thickness: 12, pattern: 'border', color: '#c9b9a3', color2: '#7f6a55', finish: 'rug', finish2: 'rug' },
  presets: [
    { name: 'Rug 200×300', params: {} },
    { name: 'Rug 160×230', params: { width: 1600, length: 2300, pattern: 'stripes', color: '#d7d3cb', color2: '#6f7f8f' } },
    { name: 'Round rug', params: { shape: 'round', width: 2000, length: 2000, pattern: 'border', color: '#b8c2b1', color2: '#5f6f5a' } },
    { name: 'Kilim stripes', params: { width: 2000, length: 3000, pattern: 'kilim', color: '#efe6d2', color2: '#b8432f' } },
    { name: 'Persian rug', params: { width: 1700, length: 2400, pattern: 'persian', color: '#8c2b25', color2: '#1f3557' } },
    { name: 'Jute rug', params: { width: 1600, length: 2300, pattern: 'jute', color: '#c4a676' } },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, Lg = p.length, t = p.thickness;
    const textured = p.pattern === 'kilim' || p.pattern === 'persian' || p.pattern === 'jute';
    if (textured) {
      const mat = `tex:${p.pattern}|${p.color}|${p.color2}`;
      if (p.shape === 'round') k.cylY(0, 0, 0, W / 2, t, mat, { rz: Lg / 2, seg: 64 });
      else k.box(-W / 2, 0, -Lg / 2, W / 2, t, Lg / 2, mat, { edges: false });
    } else if (p.shape === 'round') {
      k.cylY(0, 0, 0, W / 2, t, 'body', { rz: Lg / 2, seg: 64 });
      if (p.pattern === 'border') {
        k.cylY(0, t, 0, W / 2 - 60, 1, 'accent', { rz: Lg / 2 - 60, seg: 64 });
        k.cylY(0, t + 1, 0, W / 2 - 150, 1, 'body', { rz: Lg / 2 - 150, seg: 64 });
      } else if (p.pattern === 'stripes') {
        for (const f of [0.75, 0.45]) k.cylY(0, t + (f < 0.5 ? 2 : 1), 0, (W / 2) * f, 1, f < 0.5 ? 'body' : 'accent', { rz: (Lg / 2) * f, seg: 64 });
      }
    } else {
      k.box(-W / 2, 0, -Lg / 2, W / 2, t, Lg / 2, 'body', { edges: false });
      if (p.pattern === 'border') {
        const b = Math.min(120, W / 8), i = Math.min(70, W / 12);
        k.box(-W / 2 + i, t, -Lg / 2 + i, W / 2 - i, t + 1, -Lg / 2 + i + b, 'accent', { edges: false });
        k.box(-W / 2 + i, t, Lg / 2 - i - b, W / 2 - i, t + 1, Lg / 2 - i, 'accent', { edges: false });
        k.box(-W / 2 + i, t, -Lg / 2 + i + b, -W / 2 + i + b, t + 1, Lg / 2 - i - b, 'accent', { edges: false });
        k.box(W / 2 - i - b, t, -Lg / 2 + i + b, W / 2 - i, t + 1, Lg / 2 - i - b, 'accent', { edges: false });
      } else if (p.pattern === 'stripes') {
        const n = Math.max(3, Math.round(Lg / 350));
        for (let j = 0; j < n; j += 2) {
          const z0 = -Lg / 2 + (j * Lg) / n;
          k.box(-W / 2, t, z0, W / 2, t + 1, z0 + Lg / n, 'accent', { edges: false });
        }
      }
    }
    return k.done([W, t, Lg]);
  },
};

const lampBuild = (p: Params) => {
  const k = new Kit();
  const H = p.height, sd = p.shadeDiameter, sh = p.shadeHeight, bd = p.baseDiameter;
  const top = p.shade === 'cone' ? sd * 0.6 : sd * 0.92;
  k.cylY(0, 0, 0, bd / 2, 25, 'accent', { seg: 32 });
  k.cylY(0, 25, 0, Math.max(8, H / 140), H - sh * 0.6 - 25, 'metal');
  k.cylY(0, H - sh, 0, sd / 2, sh, 'shade', { r2: top / 2, seg: 32 });
  k.sphere(0, H - sh * 0.55, 0, Math.min(45, sd / 6), 'bulb');
  if (p.light !== false) k.light(0, H - sh * 0.5, 0, H > 1000 ? 6 : 3.5);
  const R = Math.max(sd, bd) / 2;
  k.col(-bd / 2, 0, -bd / 2, bd / 2, 25, bd / 2);
  k.col(-20, 0, -20, 20, H, 20);
  k.col(-sd / 2, H - sh, -sd / 2, sd / 2, H, sd / 2);
  k.v('front', H - sh, H, R, 1, 'shade');
  return k.done([2 * R, H, 2 * R]);
};

const lampParams = [
  { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 200, max: 2200, step: 10, group: 'Size' },
  { key: 'shade', label: 'Shade', type: 'select', options: [['drum', 'Drum'], ['cone', 'Cone']], group: 'Shade' },
  { key: 'shadeDiameter', label: 'Shade diameter', type: 'number', unit: 'mm', min: 100, max: 900, step: 10, group: 'Shade' },
  { key: 'shadeHeight', label: 'Shade height', type: 'number', unit: 'mm', min: 60, max: 600, step: 10, group: 'Shade' },
  { key: 'baseDiameter', label: 'Base diameter', type: 'number', unit: 'mm', min: 80, max: 600, step: 10, group: 'Size' },
  { key: 'light', label: 'Light on', type: 'bool', group: 'Shade' },
  { key: 'color', label: 'Shade', type: 'color', group: 'Colours' },
  { key: 'color2', label: 'Base', type: 'color', group: 'Colours' },
  finishParam('finish2', 'Base finish'),
] as FurnitureDef['params'];

export const floorLamp: FurnitureDef = {
  type: 'floorlamp',
  label: 'Floor lamp',
  category: 'Decor',
  mount: 'floor',
  params: lampParams,
  defaults: { height: 1650, shade: 'drum', shadeDiameter: 450, shadeHeight: 320, baseDiameter: 320, color: '#f1e8d6', color2: '#2d2d2d', finish2: 'metal', light: true },
  presets: [{ name: 'Floor lamp', params: {} }],
  build: lampBuild,
};

export const tableLamp: FurnitureDef = {
  type: 'tablelamp',
  label: 'Table lamp',
  category: 'Decor',
  mount: 'surface',
  params: lampParams,
  defaults: { height: 480, shade: 'cone', shadeDiameter: 300, shadeHeight: 200, baseDiameter: 150, color: '#f1e8d6', color2: '#b88a5a', finish2: 'gloss', light: true },
  presets: [{ name: 'Table lamp', params: {} }],
  build: lampBuild,
};

export const plant: FurnitureDef = {
  type: 'plant',
  label: 'Plant',
  category: 'Decor',
  mount: 'surface',
  params: [
    { key: 'style', label: 'Style', type: 'select', options: [['bush', 'Bush'], ['tree', 'Tree'], ['tall', 'Tall & narrow']], group: 'Plant' },
    { key: 'height', label: 'Total height', type: 'number', unit: 'mm', min: 150, max: 2500, step: 10, group: 'Plant' },
    { key: 'spread', label: 'Foliage width', type: 'number', unit: 'mm', min: 100, max: 1500, step: 10, group: 'Plant' },
    { key: 'potDiameter', label: 'Pot diameter', type: 'number', unit: 'mm', min: 80, max: 800, step: 10, group: 'Pot' },
    { key: 'potHeight', label: 'Pot height', type: 'number', unit: 'mm', min: 60, max: 800, step: 10, group: 'Pot' },
    { key: 'color', label: 'Foliage', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Pot', type: 'color', group: 'Colours' },
    finishParam('finish2', 'Pot finish'),
  ],
  defaults: { style: 'tree', height: 1500, spread: 700, potDiameter: 380, potHeight: 380, color: '#4f8a3f', color2: '#c9c3b8', finish: 'matte', finish2: 'gloss' },
  presets: [
    { name: 'Floor plant', params: {} },
    { name: 'Small plant', params: { style: 'bush', height: 350, spread: 280, potDiameter: 150, potHeight: 130, color2: '#c26d47' } },
    { name: 'Tall plant', params: { style: 'tall', height: 1900, spread: 450, potDiameter: 320, potHeight: 350 } },
  ],
  build(p) {
    const k = new Kit();
    const H = p.height, S = p.spread, pd = p.potDiameter, ph = Math.min(p.potHeight, H * 0.6);
    k.cylY(0, 0, 0, pd * 0.38, ph, 'accent', { r2: pd / 2, seg: 28 });
    k.cylY(0, ph - 25, 0, pd / 2 - 15, 10, 'soil');
    const r = rng(Math.round(H + S));
    const fH = H - ph;
    if (p.style === 'bush') {
      const rr = Math.min(S / 2, fH * 0.55);
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * (S / 2 - rr * 0.6);
        k.sphere(Math.cos(a) * d, ph + rr * (0.7 + r() * 0.5), Math.sin(a) * d, rr * (0.6 + r() * 0.35), i % 2 ? 'body' : 'leaf2');
      }
    } else if (p.style === 'tree') {
      const trunkTop = ph + fH * 0.45;
      k.cylY(0, ph - 20, 0, Math.max(10, pd * 0.05), trunkTop - ph + 60, 'trunk');
      const rr = Math.min(S / 2, fH * 0.32);
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * (S / 2 - rr * 0.7);
        const y = trunkTop + rr * 0.4 + r() * (H - trunkTop - rr * 1.3);
        k.sphere(Math.cos(a) * d, y, Math.sin(a) * d, rr * (0.55 + r() * 0.4), i % 2 ? 'body' : 'leaf2');
      }
    } else {
      k.cylY(0, ph - 20, 0, Math.max(10, pd * 0.04), fH * 0.9, 'trunk');
      const n = 5;
      for (let i = 0; i < n; i++) {
        const y = ph + fH * 0.3 + (i * fH * 0.6) / (n - 1);
        const rr = (S / 2) * (0.75 - i * 0.08);
        k.sphere((r() - 0.5) * S * 0.2, y, (r() - 0.5) * S * 0.2, rr, i % 2 ? 'body' : 'leaf2', [1, 1.3, 1]);
      }
    }
    const R = Math.max(S, pd) / 2;
    k.col(-pd / 2, 0, -pd / 2, pd / 2, ph, pd / 2);
    k.col(-S / 2 * 0.8, ph, -S / 2 * 0.8, S / 2 * 0.8, H, S / 2 * 0.8);
    k.v('front', 0, ph, R, 1, 'pot');
    return k.done([2 * R, H, 2 * R]);
  },
};

export const tv: FurnitureDef = {
  type: 'tv',
  label: 'TV',
  category: 'Decor',
  mount: (p) => (p.wallMounted ? 'wall' : 'surface'),
  wallAlign: true,
  defaultElev: (p) => (p.wallMounted ? 1000 : 0),
  params: [
    { key: 'diagonal', label: 'Diagonal', type: 'number', unit: 'in', min: 15, max: 110, step: 1, group: 'Screen' },
    { key: 'wallMounted', label: 'Wall mounted', type: 'bool', group: 'Mount' },
    { key: 'stand', label: 'Stand', type: 'select', options: [['feet', 'Feet'], ['pedestal', 'Pedestal']], group: 'Mount', show: (p) => !p.wallMounted },
  ],
  defaults: { diagonal: 55, wallMounted: false, stand: 'feet' },
  presets: [
    { name: 'TV 55″ on stand', params: {} },
    { name: 'TV 65″ wall', params: { diagonal: 65, wallMounted: true }, elev: 1000 },
  ],
  build(p) {
    const k = new Kit();
    const d = p.diagonal * 25.4;
    const W = (d * 16) / Math.sqrt(337), Hs = (d * 9) / Math.sqrt(337);
    const gap = p.wallMounted ? 0 : 70;
    const pt = p.wallMounted ? 35 : 45;
    const sd = p.wallMounted ? pt : Math.min(260, W * 0.25);
    const zb = -sd / 2;
    const zs0 = p.wallMounted ? zb : -pt / 2;
    k.box(-W / 2, gap, zs0, W / 2, gap + Hs, zs0 + pt, 'dark');
    k.box(-W / 2 + 8, gap + 8, zs0 + pt, W / 2 - 8, gap + Hs - 8, zs0 + pt + 1, 'screen', { edges: false });
    if (!p.wallMounted) {
      if (p.stand === 'pedestal') {
        k.box(-150, 0, -sd / 2, 150, 15, sd / 2, 'dark');
        k.box(-40, 15, -25, 40, gap + 120, 5, 'dark');
      } else {
        for (const s of [-1, 1]) {
          const x = s * W * 0.36;
          k.box(x - 15, 0, -sd / 2, x + 15, 12, sd / 2, 'dark');
          k.box(x - 12, 12, -10, x + 12, gap + 40, 10, 'dark');
        }
      }
    }
    k.col(-W / 2, gap, zs0, W / 2, gap + Hs, zs0 + pt);
    if (!p.wallMounted) k.col(-W / 2, 0, -sd / 2, W / 2, gap, sd / 2);
    k.h('front', -W / 2 + 8, W / 2 - 8, gap + Hs, 1, 'screen');
    return k.done([W, gap + Hs, sd], { note: `${p.diagonal}″` });
  },
};

export const appliance: FurnitureDef = {
  type: 'appliance',
  label: 'Appliance / fixture',
  category: 'Kitchen & bath',
  mount: (p) => (p.kind === 'radiator' ? 'wall' : 'floor'),
  wallAlign: true,
  defaultElev: (p) => (p.kind === 'radiator' ? 150 : 0),
  params: [
    {
      key: 'kind', label: 'Kind', type: 'select', group: 'Type',
      options: [['box', 'Plain box'], ['fridge', 'Fridge'], ['washer', 'Washing machine'], ['dishwasher', 'Dishwasher'], ['stove', 'Stove / oven'], ['sink', 'Washbasin vanity'], ['toilet', 'Toilet'], ['bathtub', 'Bathtub'], ['shower', 'Shower'], ['radiator', 'Radiator']],
    },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 100, max: 3000, step: 10, group: 'Size' },
    { key: 'depth', label: 'Depth', type: 'number', unit: 'mm', min: 50, max: 2000, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 50, max: 3000, step: 10, group: 'Size' },
    { key: 'color', label: 'Body', type: 'color', group: 'Colours' },
    finishParam('finish', 'Finish'),
  ],
  defaults: { kind: 'fridge', width: 600, depth: 650, height: 1850, color: '#e9eaec', finish: 'gloss' },
  presets: [
    { name: 'Fridge', params: {} },
    { name: 'Washing machine', params: { kind: 'washer', width: 600, depth: 600, height: 850, color: '#f4f4f4' } },
    { name: 'Dishwasher', params: { kind: 'dishwasher', width: 600, depth: 580, height: 850, color: '#d9dadc' } },
    { name: 'Stove', params: { kind: 'stove', width: 600, depth: 600, height: 900, color: '#d9dadc' } },
    { name: 'Washbasin', params: { kind: 'sink', width: 700, depth: 470, height: 850, color: '#f1efea' } },
    { name: 'Toilet', params: { kind: 'toilet', width: 380, depth: 650, height: 790, color: '#f7f7f5' } },
    { name: 'Bathtub', params: { kind: 'bathtub', width: 1700, depth: 750, height: 560, color: '#f7f7f5' } },
    { name: 'Shower 90×90', params: { kind: 'shower', width: 900, depth: 900, height: 2000, color: '#f7f7f5' } },
    { name: 'Radiator', params: { kind: 'radiator', width: 800, depth: 100, height: 600, color: '#f4f4f4' }, elev: 150 },
    { name: 'Box', params: { kind: 'box', width: 600, depth: 600, height: 600, color: '#c6b59c' } },
  ],
  build(p) {
    const k = new Kit();
    const W = p.width, D = p.depth, H = p.height;
    const zb = -D / 2, zf = D / 2;
    switch (p.kind) {
      case 'fridge': {
        k.box(-W / 2, 0, zb, W / 2, H, zf - 20, 'body');
        const split = H * 0.38;
        k.box(-W / 2 + 2, 2, zf - 20, W / 2 - 2, split - 3, zf, 'body');
        k.box(-W / 2 + 2, split + 3, zf - 20, W / 2 - 2, H - 2, zf, 'body');
        k.box(W / 2 - 60, split - 260, zf, W / 2 - 45, split - 40, zf + 30, 'metal');
        k.box(W / 2 - 60, split + 60, zf, W / 2 - 45, split + 460, zf + 30, 'metal');
        break;
      }
      case 'washer':
      case 'dishwasher': {
        k.box(-W / 2, 0, zb, W / 2, H, zf - 5, 'body');
        k.box(-W / 2 + 10, H - 110, zf - 5, W / 2 - 10, H - 10, zf, 'body');
        k.cyl(W / 2 - 90, H - 60, zf + 8, 25, 16, 'z', 'metal');
        if (p.kind === 'washer') {
          const r = Math.min(W, H) * 0.3;
          k.cyl(0, H * 0.45, zf + 5, r, 20, 'z', 'metal', { seg: 36 });
          k.cyl(0, H * 0.45, zf + 10, r * 0.78, 20, 'z', 'glass', { seg: 36 });
        } else {
          k.box(-W / 2 + 5, 60, zf - 5, W / 2 - 5, H - 120, zf + 3, 'body');
          k.box(-W / 2 + 60, H - 160, zf + 3, W / 2 - 60, H - 145, zf + 25, 'metal');
        }
        break;
      }
      case 'stove': {
        k.box(-W / 2, 0, zb, W / 2, H - 10, zf, 'body');
        k.box(-W / 2, H - 10, zb, W / 2, H, zf, 'dark');
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cylY((x * W) / 4.5, H, (z * D) / 4.5, Math.min(W, D) * 0.11, 3, 'metal');
        k.box(-W / 2 + 40, 100, zf, W / 2 - 40, H - 200, zf + 5, 'glass');
        k.box(-W / 2 + 60, H - 175, zf + 5, W / 2 - 60, H - 160, zf + 35, 'metal');
        break;
      }
      case 'sink': {
        k.box(-W / 2, 150, zb, W / 2, H - 30, zf - 20, 'body');
        k.box(-W / 2 + 3, 153, zf - 20, -1.5, H - 33, zf, 'body');
        k.box(1.5, 153, zf - 20, W / 2 - 3, H - 33, zf, 'body');
        k.box(-W / 2, H - 30, zb, W / 2, H, zf, 'porcelain');
        k.cylY(0, H - 2, 30, Math.min(W * 0.32, 220), 3, 'basin', { rz: Math.min(D * 0.3, 160), seg: 36 });
        k.cylY(0, H, zb + 60, 15, 200, 'metal');
        k.cyl(0, H + 190, zb + 120, 12, 120, 'z', 'metal');
        k.box(-W / 2 + 40, 0, zb + 60, W / 2 - 40, 150, zf - 60, 'dark');
        break;
      }
      case 'toilet': {
        const tankD = 180;
        k.box(-W / 2, 380, zb, W / 2, H, zb + tankD, 'porcelain', { r: 20 });
        k.cylY(0, 0, zb + tankD + 120, W * 0.3, 200, 'porcelain', { rz: (D - tankD) * 0.35, seg: 28 });
        k.cylY(0, 200, zb + tankD + (D - tankD) / 2 - 10, W / 2 - 10, 180, 'porcelain', { rz: (D - tankD) / 2, r2: W / 2, seg: 36 });
        k.cylY(0, 380, zb + tankD + (D - tankD) / 2 - 10, W / 2 - 5, 25, 'body', { rz: (D - tankD) / 2 + 5, seg: 36 });
        k.col(-W / 2, 0, zb, W / 2, H, zb + tankD);
        k.col(-W / 2, 0, zb + tankD, W / 2, 410, zf);
        break;
      }
      case 'bathtub': {
        const rim = 70;
        k.box(-W / 2, 0, zb, W / 2, H - 40, zf, 'body');
        k.box(-W / 2, H - 40, zb, W / 2, H, zb + rim, 'porcelain');
        k.box(-W / 2, H - 40, zf - rim, W / 2, H, zf, 'porcelain');
        k.box(-W / 2, H - 40, zb + rim, -W / 2 + rim, H, zf - rim, 'porcelain');
        k.box(W / 2 - rim, H - 40, zb + rim, W / 2, H, zf - rim, 'porcelain');
        k.box(-W / 2 + rim, H - 42, zb + rim, W / 2 - rim, H - 40, zf - rim, 'water', { edges: false });
        k.cyl(-W / 2 + 120, H + 60, zb + 40, 12, 140, 'z', 'metal');
        break;
      }
      case 'shower': {
        k.box(-W / 2, 0, zb, W / 2, 40, zf, 'porcelain');
        k.cylY(0, 40, 0, 40, 2, 'metal');
        k.box(W / 2 - 8, 40, zb, W / 2, H, zf, 'glass', { edges: false });
        k.box(-W / 2, 40, zf - 8, W / 2 - 8, H, zf, 'glass', { edges: false });
        k.box(W / 2 - 14, 40, zb, W / 2, H, zb + 30, 'metal');
        k.cylY(-W / 2 + 60, 1000, zb + 30, 12, H - 950, 'metal');
        k.cyl(-W / 2 + 60, H + 30, zb + 140, 90, 15, 'y', 'metal');
        k.col(-W / 2, 0, zb, W / 2, H, zf);
        break;
      }
      case 'radiator': {
        const n = Math.max(3, Math.floor(W / 50));
        const fw = W / n;
        for (let i = 0; i < n; i++) k.box(-W / 2 + i * fw + 4, 0, zb + 10, -W / 2 + (i + 1) * fw - 4, H, zf, 'body');
        k.box(-W / 2, H - 60, zb + 25, W / 2, H - 30, zf - 15, 'body');
        k.box(-W / 2, 30, zb + 25, W / 2, 60, zf - 15, 'body');
        break;
      }
      default:
        k.box(-W / 2, 0, zb, W / 2, H, zf, 'body');
    }
    if (!k.colliders.length) k.col(-W / 2, 0, zb, W / 2, H, zf);
    return k.done([W, H, D]);
  },
};


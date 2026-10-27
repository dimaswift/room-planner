import { Kit } from './kit';
import type { FurnitureDef, V3 } from './types';

const rotY = (x: number, z: number, a: number): [number, number] => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

/**
 * Openings use a wall-local frame: x along the wall, y up, z into the room.
 * The wall occupies z ∈ [-T, 0]; the room-side face is z = 0.
 */
export const door: FurnitureDef = {
  type: 'door',
  label: 'Door',
  category: 'Doors & windows',
  mount: 'opening',
  params: [
    { key: 'width', label: 'Opening width', type: 'number', unit: 'mm', min: 500, max: 3000, step: 10, group: 'Size', hint: 'Rough opening in the wall' },
    { key: 'height', label: 'Opening height', type: 'number', unit: 'mm', min: 1500, max: 3000, step: 10, group: 'Size' },
    { key: 'frame', label: 'Frame width', type: 'number', unit: 'mm', min: 20, max: 150, step: 5, group: 'Size' },
    { key: 'kind', label: 'Type', type: 'select', options: [['hinged', 'Hinged'], ['sliding', 'Sliding'], ['passage', 'Open passage']], group: 'Leaf' },
    { key: 'leaves', label: 'Leaves', type: 'select', options: [['single', 'Single'], ['double', 'Double']], group: 'Leaf', show: (p) => p.kind === 'hinged' },
    { key: 'hinge', label: 'Hinge side (from room)', type: 'select', options: [['left', 'Left'], ['right', 'Right']], group: 'Leaf', show: (p) => p.kind === 'hinged' && p.leaves === 'single' },
    { key: 'swing', label: 'Swing', type: 'select', options: [['in', 'Into room'], ['out', 'Out of room']], group: 'Leaf', show: (p) => p.kind === 'hinged' },
    { key: 'open', label: 'Shown open', type: 'number', unit: '°', min: 0, max: 100, step: 5, group: 'Leaf', show: (p) => p.kind === 'hinged' },
    { key: 'color', label: 'Leaf', type: 'color', group: 'Colours' },
    { key: 'color2', label: 'Frame', type: 'color', group: 'Colours' },
  ],
  defaults: { width: 900, height: 2100, frame: 50, kind: 'hinged', leaves: 'single', hinge: 'left', swing: 'in', open: 25, color: '#f3f1ec', color2: '#e4e0d8' },
  presets: [
    { name: 'Interior door', params: {} },
    { name: 'Double door', params: { width: 1500, leaves: 'double', open: 20 } },
    { name: 'Sliding door', params: { width: 1000, kind: 'sliding', color: '#c9b08f' } },
    { name: 'Open passage', params: { width: 1200, kind: 'passage' } },
  ],
  build(p, ctx) {
    const k = new Kit();
    const T = ctx.wallThickness;
    const w = p.width, h = Math.min(p.height, ctx.wallHeight), f = Math.min(p.frame, w / 4);
    const cas = 70, casT = 12;
    const headTop = Math.min(h + cas, ctx.wallHeight);

    k.box(-w / 2, 0, -T, -w / 2 + f, h, 0, 'accent');
    k.box(w / 2 - f, 0, -T, w / 2, h, 0, 'accent');
    k.box(-w / 2, h - f, -T, w / 2, h, 0, 'accent');
    for (const [z0, z1] of [[0, casT], [-T - casT, -T]]) {
      k.box(-w / 2 - cas + f, 0, z0, -w / 2 + f, headTop, z1, 'accent');
      k.box(w / 2 - f, 0, z0, w / 2 + cas - f, headTop, z1, 'accent');
      if (headTop > h - f + 5) k.box(-w / 2 + f, h - f, z0, w / 2 - f, headTop, z1, 'accent');
    }

    const cw = w - 2 * f, ch = h - f, lt = 40;
    if (p.kind === 'hinged') {
      const double = p.leaves === 'double';
      const lw = double ? cw / 2 : cw;
      const swingIn = p.swing === 'in';
      const sides: ('left' | 'right')[] = double ? ['left', 'right'] : [p.hinge];
      const phi = (Math.min(100, Math.max(0, p.open)) * Math.PI) / 180;
      for (const side of sides) {
        const hx = side === 'left' ? -w / 2 + f : w / 2 - f;
        const hz = swingIn ? 0 : -T;
        const sgn = (side === 'left' ? 1 : -1) * (swingIn ? -1 : 1);
        const a = sgn * phi;
        const dx = side === 'left' ? 1 : -1;
        const dz = swingIn ? -1 : 1;
        const [ox, oz] = rotY((dx * lw) / 2, (dz * lt) / 2, a);
        k.boxC(hx + ox, ch / 2, hz + oz, lw - 4, ch - 3, lt, 'body', { rot: [0, a, 0] });
        for (const s of [-1, 1]) {
          const [hxo, hzo] = rotY(dx * (lw - 70), dz * (lt / 2) + s * (lt / 2 + 14), a);
          k.boxC(hx + hxo, 1000, hz + hzo, 120, 18, 18, 'metal', { rot: [0, a, 0] });
        }
        // plan symbol: leaf drawn fully open plus swing arc
        const zEnd = swingIn ? lw : -T - lw;
        const sweep = (side === 'left') === swingIn ? 0 : 1;
        k.symbol.push({ d: `M ${hx} ${hz} L ${hx} ${zEnd}` });
        k.symbol.push({ d: `M ${hx} ${zEnd} A ${lw} ${lw} 0 0 ${sweep} ${hx + dx * lw} ${hz}`, dashed: true });
        if (swingIn) k.softCol(Math.min(hx, hx + dx * lw), 0, 0, Math.max(hx, hx + dx * lw), h, lw);
      }
    } else if (p.kind === 'sliding') {
      k.box(-w / 2 + f - 30, 0, 8, w / 2 - f + 30, ch + 20, 8 + lt, 'body');
      k.box(-w / 2 - cw, ch + 25, 5, w / 2 + 40, ch + 85, 55, 'metal');
      k.box(w / 2 - f - 50, 950, 8 + lt, w / 2 - f - 30, 1150, 8 + lt + 15, 'metal');
      k.symbol.push({ d: `M ${-w / 2 + f - 30} ${8 + lt / 2} L ${w / 2 - f + 30} ${8 + lt / 2}` });
      k.symbol.push({ d: `M ${-w / 2 - cw} ${8 + lt / 2 + 40} L ${w / 2} ${8 + lt / 2 + 40}`, dashed: true });
    }
    k.symbol.push({ d: `M ${-w / 2} 0 L ${-w / 2} ${-T} M ${w / 2} 0 L ${w / 2} ${-T}` });

    k.h('front', -w / 2 + f, w / 2 - f, 0, -1, 'clear');
    k.v('front', 0, ch, w / 2 - f, 1, 'clear');
    const bounds = { min: [-w / 2 - cas + f, 0, -T - casT] as V3, max: [w / 2 + cas - f, headTop, casT] as V3 };
    return k.done([w, h, T], { bounds, cut: [-w / 2, w / 2], colliders: [], note: `clear ${Math.round(cw)}×${Math.round(ch)}` });
  },
};

export const windowDef: FurnitureDef = {
  type: 'window',
  label: 'Window',
  category: 'Doors & windows',
  mount: 'opening',
  defaultElev: 900,
  params: [
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', min: 300, max: 6000, step: 10, group: 'Size' },
    { key: 'height', label: 'Height', type: 'number', unit: 'mm', min: 300, max: 3000, step: 10, group: 'Size', hint: 'Sill height is the Elevation field above' },
    { key: 'frame', label: 'Frame width', type: 'number', unit: 'mm', min: 30, max: 150, step: 5, group: 'Frame' },
    { key: 'panesX', label: 'Panes across', type: 'int', min: 1, max: 8, group: 'Frame' },
    { key: 'panesY', label: 'Panes down', type: 'int', min: 1, max: 6, group: 'Frame' },
    { key: 'sill', label: 'Interior sill', type: 'bool', group: 'Sill' },
    { key: 'sillDepth', label: 'Sill projection', type: 'number', unit: 'mm', min: 0, max: 500, step: 5, group: 'Sill', show: (p) => p.sill, hint: 'How far the sill sticks into the room' },
    { key: 'color', label: 'Frame', type: 'color', group: 'Colours' },
  ],
  defaults: { width: 1200, height: 1400, frame: 60, panesX: 2, panesY: 1, sill: true, sillDepth: 60, color: '#f7f7f5' },
  presets: [
    { name: 'Window', params: {} },
    { name: 'Wide window', params: { width: 2400, panesX: 3 } },
    { name: 'Floor-to-ceiling', params: { width: 1800, height: 2400, panesX: 2, panesY: 1, sill: false }, elev: 0 },
    { name: 'Small window', params: { width: 600, height: 800, panesX: 1 }, elev: 1300 },
  ],
  build(p, ctx) {
    const k = new Kit();
    const T = ctx.wallThickness;
    const w = p.width, h = p.height, f = Math.min(p.frame, w / 6, h / 6);
    const fd = Math.min(70, T * 0.6);
    const zc = -T / 2;
    const z0 = zc - fd / 2, z1 = zc + fd / 2;
    k.box(-w / 2, 0, z0, -w / 2 + f, h, z1, 'body');
    k.box(w / 2 - f, 0, z0, w / 2, h, z1, 'body');
    k.box(-w / 2 + f, 0, z0, w / 2 - f, f, z1, 'body');
    k.box(-w / 2 + f, h - f, z0, w / 2 - f, h, z1, 'body');
    const nx = Math.max(1, Math.round(p.panesX)), ny = Math.max(1, Math.round(p.panesY));
    const mf = f * 0.75;
    const iw = w - 2 * f, ih = h - 2 * f;
    const pw = (iw - (nx - 1) * mf) / nx, ph = (ih - (ny - 1) * mf) / ny;
    for (let i = 1; i < nx; i++) {
      const x = -w / 2 + f + i * pw + (i - 1) * mf;
      k.box(x, f, z0 + 5, x + mf, h - f, z1 - 5, 'body');
    }
    for (let j = 1; j < ny; j++) {
      const y = f + j * ph + (j - 1) * mf;
      k.box(-w / 2 + f, y, z0 + 5, w / 2 - f, y + mf, z1 - 5, 'body');
    }
    k.box(-w / 2 + f, f, zc - 3, w / 2 - f, h - f, zc + 3, 'glass', { edges: false });
    if (nx > 1) {
      const x = -w / 2 + f + pw;
      k.box(x - 30, h / 2 - 70, z1, x - 12, h / 2 + 70, z1 + 25, 'metal');
    }
    if (p.sill) {
      k.box(-w / 2 - 40, -25, zc, w / 2 + 40, 0, Math.max(5, p.sillDepth), 'body');
      k.symbol.push({ d: `M ${-w / 2 - 40} 0 L ${-w / 2 - 40} ${p.sillDepth} L ${w / 2 + 40} ${p.sillDepth} L ${w / 2 + 40} 0` });
    }
    k.box(-w / 2 - 20, -30, -T - 40, w / 2 + 20, -5, zc, 'body');
    k.symbol.push({ d: `M ${-w / 2} ${z0} L ${w / 2} ${z0} M ${-w / 2} ${z1} L ${w / 2} ${z1} M ${-w / 2} ${zc} L ${w / 2} ${zc}` });
    k.symbol.push({ d: `M ${-w / 2} 0 L ${-w / 2} ${-T} M ${w / 2} 0 L ${w / 2} ${-T}` });

    for (let i = 0; i < nx; i++) {
      const x0 = -w / 2 + f + i * (pw + mf);
      k.h('front', x0, x0 + pw, 0, -1);
    }
    const bounds = { min: [-w / 2 - 40, -30, -T - 40] as V3, max: [w / 2 + 40, h, Math.max(5, p.sill ? p.sillDepth : 0)] as V3 };
    return k.done([w, h, T], { bounds, cut: [-w / 2, w / 2], colliders: [], note: `${nx}×${ny} panes` });
  },
};

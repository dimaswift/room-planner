import * as THREE from 'three';

/**
 * Procedural canvas textures. Colour maps are near-white greys so the material colour sets the hue;
 * bump maps are plain height fields. All tile seamlessly unless noted.
 */

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!] as const;
}

function toTex(c: HTMLCanvasElement, color: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

/** Draw a shape at x and at x ± size so it wraps across the tile edges. */
function wrapDraw(size: number, x: number, y: number, draw: (x: number, y: number) => void) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    const xx = x + dx, yy = y + dy;
    if (xx > -size * 0.3 && xx < size * 1.3 && yy > -size * 0.3 && yy < size * 1.3) draw(xx, yy);
  }
}

/** Wood grain; one tile = 1000 mm, grain along u. Boards of slightly different tone. */
export function woodTexture() {
  return cached('wood', () => {
    const S = 1024;
    const [c, g] = canvas(S);
    const r = seeded(11);
    let y = 0;
    const strips: [number, number][] = [];
    while (y < S) {
      const h = Math.min(S - y, 110 + r() * 150);
      strips.push([y, h]);
      y += h;
    }
    for (const [y0, h] of strips) {
      const tone = 214 + r() * 34;
      g.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`;
      g.fillRect(0, y0, S, h);
      // grain: wavy lines that wrap horizontally (integer number of periods across the tile)
      const lines = Math.floor(h / 2.2);
      for (let k = 0; k < lines; k++) {
        const yy = y0 + r() * h;
        const amp = 1 + r() * 4;
        const per = 1 + Math.floor(r() * 3);
        const ph = r() * Math.PI * 2;
        g.strokeStyle = `rgba(70,45,25,${0.03 + r() * 0.08})`;
        g.lineWidth = 0.5 + r() * 1.6;
        g.beginPath();
        for (let x = 0; x <= S; x += 16) {
          const v = yy + Math.sin((x / S) * Math.PI * 2 * per + ph) * amp + Math.sin((x / S) * Math.PI * 2 * (per + 3) + ph * 2) * amp * 0.3;
          if (x === 0) g.moveTo(x, v);
          else g.lineTo(x, v);
        }
        g.stroke();
      }
      // a few knots / cathedral arcs
      if (r() < 0.5) {
        const kx = r() * S, ky = y0 + h * (0.3 + r() * 0.4);
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = `rgba(70,40,20,${0.05 + k * 0.012})`;
          g.lineWidth = 1.2;
          g.beginPath();
          g.ellipse(kx, ky, 18 + k * 14, 3 + k * 2.5, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      g.fillStyle = 'rgba(40,25,10,0.18)';
      g.fillRect(0, y0, S, 1.2);
    }
    return toTex(c, true);
  });
}

function noiseBump(key: string, size: number, blobs: number, rMin: number, rMax: number, alpha: number, seed: number, base = 128) {
  return cached(key, () => {
    const [c, g] = canvas(size);
    const r = seeded(seed);
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < blobs; i++) {
      const x = r() * size, y = r() * size, rad = rMin + r() * (rMax - rMin);
      const light = r() < 0.5;
      wrapDraw(size, x, y, (xx, yy) => {
        const gr = g.createRadialGradient(xx, yy, 0, xx, yy, rad);
        gr.addColorStop(0, light ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`);
        gr.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = gr;
        g.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
      });
    }
    return toTex(c, false);
  });
}

/** Fine woven fabric height map; one tile ≈ 40 mm. */
export function fabricBump() {
  return cached('fabric', () => {
    const S = 128;
    const [c, g] = canvas(S);
    const r = seeded(5);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = Math.sin((x / S) * Math.PI * 2 * 16);
      const wy = Math.sin((y / S) * Math.PI * 2 * 16);
      const over = ((Math.floor(x / 4) + Math.floor(y / 4)) & 1) ? wx : wy;
      const v = 128 + over * 50 + (r() - 0.5) * 40;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTex(c, false);
  });
}

/** Pebbled leather grain; one tile ≈ 160 mm. */
export const leatherBump = () => noiseBump('leather', 256, 1400, 2, 7, 0.55, 23);
/** Soft plaster unevenness; one tile ≈ 1500 mm. */
export const plasterBump = () => noiseBump('plaster', 256, 500, 6, 40, 0.14, 31);

/** Rug pile; one tile ≈ 60 mm. */
export function rugBump() {
  return cached('rugbump', () => {
    const S = 128;
    const [c, g] = canvas(S);
    const r = seeded(77);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const knot = Math.sin((x / S) * Math.PI * 2 * 12) * Math.sin((y / S) * Math.PI * 2 * 12);
      const v = 128 + knot * 45 + (r() - 0.5) * 70;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTex(c, false);
  });
}

export type FloorType = 'planks' | 'parquet' | 'tiles' | 'concrete' | 'carpet';

/** Floor colour maps; returns the texture and the tile size in mm. */
export function floorTexture(type: FloorType): { tex: THREE.Texture; tile: number } {
  switch (type) {
    case 'parquet':
      return { tex: cached('f-parquet', parquet), tile: 900 };
    case 'tiles':
      return { tex: cached('f-tiles', tiles), tile: 1200 };
    case 'concrete':
      return { tex: cached('f-concrete', () => blotchy(512, 900, 0.07, 41)), tile: 2400 };
    case 'carpet':
      return { tex: cached('f-carpet', () => blotchy(256, 4000, 0.05, 43, 2, 5)), tile: 400 };
    default:
      return { tex: cached('f-planks', planks), tile: 1200 };
  }
}

function planks() {
  const S = 1024;
  const [c, g] = canvas(S);
  const wood = woodTexture().image as HTMLCanvasElement;
  const r = seeded(7);
  const rows = 6;
  const rh = S / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 400;
    while (x < S) {
      const w = 380 + r() * 420;
      const sx = r() * (1024 - w), sy = r() * (1024 - rh);
      g.drawImage(wood, sx, sy, w, rh, x, row * rh, w, rh);
      if (x + w > S) g.drawImage(wood, sx, sy, w, rh, x - S, row * rh, w, rh);
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`;
      g.fillRect(x, row * rh, w, rh);
      g.fillStyle = 'rgba(30,20,10,0.35)';
      g.fillRect(x, row * rh, 2, rh);
      x += w;
    }
    g.fillStyle = 'rgba(30,20,10,0.4)';
    g.fillRect(0, row * rh, S, 2);
  }
  return toTex(c, true);
}

function parquet() {
  const S = 1024;
  const [c, g] = canvas(S);
  const wood = woodTexture().image as HTMLCanvasElement;
  const r = seeded(9);
  const n = 4;
  const cell = S / n;
  const pw = cell / 3;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const horiz = (i + j) % 2 === 0;
    for (let k = 0; k < 3; k++) {
      const x = i * cell + (horiz ? 0 : k * pw), y = j * cell + (horiz ? k * pw : 0);
      const w = horiz ? cell : pw, h = horiz ? pw : cell;
      g.save();
      g.translate(x, y);
      if (!horiz) {
        g.translate(w, 0);
        g.rotate(Math.PI / 2);
      }
      g.drawImage(wood, r() * (1024 - cell), r() * (1024 - pw), cell, pw, 0, 0, cell, pw);
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`;
      g.fillRect(0, 0, cell, pw);
      g.strokeStyle = 'rgba(30,20,10,0.4)';
      g.lineWidth = 1.5;
      g.strokeRect(0, 0, cell, pw);
      g.restore();
    }
  }
  return toTex(c, true);
}

function tiles() {
  const S = 1024;
  const [c, g] = canvas(S);
  const r = seeded(13);
  const n = 2;
  const ts = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 228 + r() * 20;
    g.fillStyle = `rgb(${v},${v},${v - 3})`;
    g.fillRect(i * ts, j * ts, ts, ts);
    for (let k = 0; k < 220; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,90,90'},${r() * 0.08})`;
      const rr = 3 + r() * 30;
      g.beginPath();
      g.arc(i * ts + r() * ts, j * ts + r() * ts, rr, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgb(165,162,158)';
  for (let k = 0; k <= n; k++) {
    g.fillRect(k * ts - 3, 0, 6, S);
    g.fillRect(0, k * ts - 3, S, 6);
  }
  return toTex(c, true);
}

function blotchy(S: number, count: number, alpha: number, seed: number, rMin = 6, rMax = 60) {
  const [c, g] = canvas(S);
  const r = seeded(seed);
  g.fillStyle = 'rgb(236,236,236)';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < count; i++) {
    const x = r() * S, y = r() * S, rad = rMin + r() * (rMax - rMin);
    const light = r() < 0.5;
    wrapDraw(S, x, y, (xx, yy) => {
      const gr = g.createRadialGradient(xx, yy, 0, xx, yy, rad);
      gr.addColorStop(0, light ? `rgba(255,255,255,${alpha})` : `rgba(60,60,60,${alpha})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
    });
  }
  return toTex(c, true);
}

/** Whole-rug patterns (not tiled): u across the rug width, v along its length. */
export function rugPattern(kind: string, colors: string[]) {
  return cached(`rug-${kind}-${colors.join(',')}`, () => {
    const S = 1024;
    const [c, g] = canvas(S);
    const r = seeded(kind.length * 97 + colors.join('').length);
    const [c1, c2] = colors;
    if (kind === 'kilim') {
      g.fillStyle = c1;
      g.fillRect(0, 0, S, S);
      const pal = [c2, '#b8432f', '#d98a3a', '#3f7d4e', '#2f5d8c', '#c95d3a', '#5d86b5'];
      let x = 30 + r() * 40;
      let i = 0;
      while (x < S - 60) {
        const w = 50 + r() * 90;
        g.fillStyle = pal[i % pal.length];
        g.fillRect(x, 0, w, S);
        // irregular hand-woven edges
        g.fillStyle = 'rgba(255,255,255,0.08)';
        for (let y = 0; y < S; y += 6) g.fillRect(x + r() * w, y, 2, 4);
        x += w + 40 + r() * 110;
        i++;
      }
      // small diamond motifs in the plain bands
      g.fillStyle = c2;
      for (let k = 0; k < 40; k++) {
        const mx = r() * S, my = r() * S, s = 6 + r() * 8;
        g.beginPath();
        g.moveTo(mx, my - s); g.lineTo(mx + s, my); g.lineTo(mx, my + s); g.lineTo(mx - s, my);
        g.fill();
      }
    } else if (kind === 'persian') {
      g.fillStyle = c1;
      g.fillRect(0, 0, S, S);
      const bands = [[0, 70, c2], [70, 22, '#e9dcc0'], [92, 50, '#7d2f2a'], [142, 14, c2]] as const;
      for (const [o, w, col] of bands) {
        g.fillStyle = col;
        g.fillRect(o, o, S - 2 * o, w);
        g.fillRect(o, S - o - w, S - 2 * o, w);
        g.fillRect(o, o, w, S - 2 * o);
        g.fillRect(S - o - w, o, w, S - 2 * o);
      }
      g.fillStyle = '#e9dcc0';
      for (let k = 0; k < 60; k++) {
        const t = k / 60;
        g.fillRect(20 + t * (S - 40), 30, 8, 8);
        g.fillRect(20 + t * (S - 40), S - 38, 8, 8);
      }
      const med = (s: number, col: string) => {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(S / 2, S / 2 - s); g.lineTo(S / 2 + s * 0.7, S / 2); g.lineTo(S / 2, S / 2 + s); g.lineTo(S / 2 - s * 0.7, S / 2);
        g.fill();
      };
      med(300, c2); med(230, '#e9dcc0'); med(170, '#7d2f2a'); med(90, c2); med(40, '#e9dcc0');
      g.fillStyle = c2;
      for (let k = 0; k < 120; k++) {
        const mx = 170 + r() * (S - 340), my = 170 + r() * (S - 340);
        if (Math.abs(mx - S / 2) / 0.7 + Math.abs(my - S / 2) < 330) continue;
        g.beginPath();
        g.arc(mx, my, 5 + r() * 7, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      // jute / natural weave
      g.fillStyle = c1;
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 8) {
        for (let x = 0; x < S; x += 16) {
          const off = (y / 8) % 2 ? 8 : 0;
          g.fillStyle = `rgba(${r() < 0.5 ? '255,240,210' : '60,40,20'},${0.08 + r() * 0.14})`;
          g.beginPath();
          g.ellipse(x + off, y + 4, 9, 4, 0.5, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    // global wool/fiber noise
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`;
      g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
    }
    return toTex(c, true);
  });
}

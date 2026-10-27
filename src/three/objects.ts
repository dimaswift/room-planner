import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { matColor, matKind } from '../furniture/catalog';
import type { BuildResult, Params } from '../furniture/types';

const matCache = new Map<string, THREE.Material>();

export function getMaterial(color: string, kind?: string): THREE.Material {
  const key = `${color}|${kind ?? ''}`;
  let m = matCache.get(key);
  if (m) return m;
  switch (kind) {
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0, depthWrite: false });
      break;
    case 'water':
      m = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
      break;
    case 'metal':
      m = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32 });
      break;
    case 'emissive':
      m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.9 });
      break;
    case 'gloss':
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.05 });
      break;
    default:
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
  }
  matCache.set(key, m);
  return m;
}

const EDGE_MAT = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 });

/** Turn a procedural build into a three.js group (millimetre units). */
export function buildObject(b: BuildResult, p: Params): THREE.Group {
  const g = new THREE.Group();
  for (const pr of b.prims) {
    let geo: THREE.BufferGeometry;
    if (pr.kind === 'box') {
      const [w, h, d] = pr.size;
      const r = pr.r ? Math.min(pr.r, w / 2 - 0.5, h / 2 - 0.5, d / 2 - 0.5) : 0;
      geo = r > 1 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
    } else if (pr.kind === 'cyl') {
      geo = new THREE.CylinderGeometry(pr.r2 ?? pr.r, pr.r, pr.len, pr.seg ?? 20);
      if (pr.rz) geo.scale(1, 1, pr.rz / pr.r);
      if (pr.axis === 'x') geo.rotateZ(-Math.PI / 2);
      else if (pr.axis === 'z') geo.rotateX(Math.PI / 2);
    } else {
      geo = new THREE.SphereGeometry(pr.r, 18, 12);
    }
    const kind = matKind(pr.mat, p);
    const mesh = new THREE.Mesh(geo, getMaterial(matColor(pr.mat, p), kind));
    mesh.position.set(pr.pos[0], pr.pos[1], pr.pos[2]);
    if (pr.kind !== 'sphere' && pr.rot) mesh.rotation.set(pr.rot[0], pr.rot[1], pr.rot[2]);
    if (pr.kind === 'sphere' && pr.scale) mesh.scale.set(pr.scale[0], pr.scale[1], pr.scale[2]);
    mesh.castShadow = kind !== 'glass' && kind !== 'water';
    mesh.receiveShadow = true;
    g.add(mesh);
    if (pr.kind === 'box' && !pr.r && pr.edges !== false && Math.min(...pr.size) > 3) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), EDGE_MAT);
      e.raycast = () => {};
      mesh.add(e);
    }
  }
  return g;
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const anyC = c as THREE.Mesh;
    if (anyC.geometry) anyC.geometry.dispose();
  });
}

let floorTex: THREE.CanvasTexture | null = null;

/** Light-grey plank texture, tinted by the floor colour. One tile covers 1200 × 1200 mm. */
export function floorTexture() {
  if (floorTex) return floorTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const rows = 6;
  const rh = 512 / rows;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < 512) {
      const w = 220 + rnd() * 260;
      const v = 232 + Math.floor(rnd() * 22);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, r * rh, w, rh);
      g.strokeStyle = 'rgba(0,0,0,0.05)';
      for (let k = 0; k < 5; k++) {
        const yy = r * rh + 4 + rnd() * (rh - 8);
        g.beginPath();
        g.moveTo(x + 4, yy);
        g.bezierCurveTo(x + w * 0.3, yy + 3, x + w * 0.6, yy - 3, x + w - 4, yy);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x, r * rh, 1.5, rh);
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, r * rh, 512, 1.5);
  }
  floorTex = new THREE.CanvasTexture(c);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(1 / 1200, 1 / 1200);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.anisotropy = 8;
  return floorTex;
}

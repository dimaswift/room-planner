import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resolveMat } from '../furniture/catalog';
import type { BuildResult, Params, Prim } from '../furniture/types';
import { fabricBump, leatherBump, rugBump, rugPattern, woodTexture } from './textures';

const matCache = new Map<string, THREE.Material>();

/** Finishes whose textures tile in real-world units (need box-projected UVs). */
const TILED = new Set(['wood', 'fabric', 'leather', 'rug']);

function withRepeat(t: THREE.Texture, k: number) {
  t.repeat.set(k, k);
  return t;
}

export function getMaterial(color: string, kind?: string): THREE.Material {
  const key = `${color}|${kind ?? ''}`;
  let m = matCache.get(key);
  if (m) return m;
  if (kind?.startsWith('tex:')) {
    const [pattern, ...cols] = kind.slice(4).split('|');
    m = new THREE.MeshStandardMaterial({ map: rugPattern(pattern, cols), roughness: 1 });
  } else {
    switch (kind) {
      case 'glass':
        m = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 1.5 });
        break;
      case 'water':
        m = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.55, roughness: 0.08, depthWrite: false });
        break;
      case 'metal':
        m = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.32 });
        break;
      case 'emissive':
        m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide });
        break;
      case 'gloss':
        m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.15 });
        break;
      case 'wood':
        m = new THREE.MeshStandardMaterial({ color, map: woodTexture(), bumpMap: woodTexture(), bumpScale: 0.6, roughness: 0.58 });
        break;
      case 'fabric':
        m = new THREE.MeshPhysicalMaterial({
          color, roughness: 0.94, sheen: 1, sheenRoughness: 0.65, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.4),
          bumpMap: withRepeat(fabricBump(), 25), bumpScale: 1.2,
        });
        break;
      case 'leather':
        m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.46, clearcoat: 0.3, clearcoatRoughness: 0.45, bumpMap: withRepeat(leatherBump(), 6), bumpScale: 0.9 });
        break;
      case 'rug':
        m = new THREE.MeshStandardMaterial({ color, roughness: 1, bumpMap: withRepeat(rugBump(), 16), bumpScale: 2 });
        break;
      default:
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 });
    }
  }
  matCache.set(key, m);
  return m;
}

const EDGE_MAT = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16 });

/**
 * Box-projected UVs in metres so textures keep real-world scale on any part. Wood grain runs along
 * the part's longest axis; each part gets its own offset so boards don't repeat visibly.
 */
function projectUV(geo: THREE.BufferGeometry, grain: number, seed: number) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const offU = ((seed * 0.6180339) % 1) * 3, offV = ((seed * 0.4142135) % 1) * 3;
  const c = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const ax = nx >= ny && nx >= nz ? 0 : ny >= nz ? 1 : 2;
    let a = ax === 0 ? 2 : 0, b = ax === 1 ? 2 : 1;
    if (b === grain) [a, b] = [b, a];
    c[0] = pos.getX(i);
    c[1] = pos.getY(i);
    c[2] = pos.getZ(i);
    uv[i * 2] = c[a] / 1000 + offU;
    uv[i * 2 + 1] = c[b] / 1000 + offV;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function primGeometry(pr: Prim): THREE.BufferGeometry {
  if (pr.kind === 'box') {
    const [w, h, d] = pr.size;
    const r = pr.r ? Math.min(pr.r, w / 2 - 0.5, h / 2 - 0.5, d / 2 - 0.5) : 0;
    return r > 1 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  }
  if (pr.kind === 'cyl') {
    const geo = new THREE.CylinderGeometry(pr.r2 ?? pr.r, pr.r, pr.len, pr.seg ?? 20);
    if (pr.rz) geo.scale(1, 1, pr.rz / pr.r);
    if (pr.axis === 'x') geo.rotateZ(-Math.PI / 2);
    else if (pr.axis === 'z') geo.rotateX(Math.PI / 2);
    return geo;
  }
  return new THREE.SphereGeometry(pr.r, 18, 12);
}

const grainAxis = (pr: Prim) => {
  if (pr.kind === 'box') return pr.size.indexOf(Math.max(...pr.size));
  if (pr.kind === 'cyl') return pr.axis === 'x' ? 0 : pr.axis === 'z' ? 2 : 1;
  return 1;
};

/**
 * Turn a procedural build into a three.js group (millimetre units). Parts sharing a material are
 * merged into one mesh, so a bookcase full of books stays a handful of draw calls.
 */
export function buildObject(b: BuildResult, p: Params, outlines = false): THREE.Group {
  const g = new THREE.Group();
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
  const edges: THREE.BufferGeometry[] = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  b.prims.forEach((pr, idx) => {
    const geo = primGeometry(pr);
    const { color, kind } = resolveMat(pr.mat, p);
    if (kind && TILED.has(kind)) projectUV(geo, grainAxis(pr), idx + 1);
    const rot = pr.kind !== 'sphere' && pr.rot ? pr.rot : [0, 0, 0];
    const scale = pr.kind === 'sphere' && pr.scale ? pr.scale : [1, 1, 1];
    q.setFromEuler(e.set(rot[0], rot[1], rot[2]));
    m4.compose(new THREE.Vector3(...pr.pos), q, new THREE.Vector3(scale[0], scale[1], scale[2]));
    if (outlines && pr.kind === 'box' && !pr.r && pr.edges !== false && Math.min(...pr.size) > 3) {
      edges.push(new THREE.EdgesGeometry(geo, 30).applyMatrix4(m4));
    }
    geo.applyMatrix4(m4);
    const mat = getMaterial(color, kind);
    let grp = groups.get(mat);
    if (!grp) groups.set(mat, (grp = { geos: [], shadow: kind !== 'glass' && kind !== 'water' }));
    grp.geos.push(geo.index ? geo.toNonIndexed() : geo);
    if (geo.index) geo.dispose();
  });
  for (const [mat, grp] of groups) {
    const geo = grp.geos.length === 1 ? grp.geos[0] : mergeGeometries(grp.geos, false);
    if (grp.geos.length > 1) grp.geos.forEach((x) => x.dispose());
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = grp.shadow;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  if (edges.length) {
    const eg = mergeGeometries(edges, false);
    edges.forEach((x) => x.dispose());
    if (eg) {
      const ls = new THREE.LineSegments(eg, EDGE_MAT);
      ls.raycast = () => {};
      g.add(ls);
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

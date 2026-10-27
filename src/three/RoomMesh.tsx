import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBuild, mountOf } from '../furniture/catalog';
import { add, dot, mul, sub, vec } from '../geometry/math';
import { getWalls, wallPieces, type WallHole } from '../geometry/room';
import { useStore } from '../store';
import type { Vec2 } from '../types';
import { floorTexture, plasterBump } from './textures';

const LOW = 320;
const SKIRT_T = 14;

function prism(poly: Vec2[], y0: number, y1: number) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

const plaster = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (!t) {
      t = plasterBump().clone();
      t.repeat.set(1 / 1500, 1 / 1500);
      t.needsUpdate = true;
    }
    return t;
  };
})();

export function RoomMesh() {
  const room = useStore((s) => s.doc.room);
  const items = useStore((s) => s.doc.items);
  const wallDisplay = useStore((s) => s.wallDisplay);
  const walls = getWalls(room);
  const skirtH = room.skirting ?? 80;

  const holesKey = items
    .filter((it) => mountOf(it) === 'opening')
    .map((it) => {
      const b = getBuild(it, room);
      const [c0, c1] = b.cut ?? [-b.size[0] / 2, b.size[0] / 2];
      return `${it.wall}:${(it.offset ?? 0) + c0}:${(it.offset ?? 0) + c1}:${it.elev}:${it.elev + b.size[1]}`;
    })
    .join('|');

  const holes = useMemo(() => {
    const per: WallHole[][] = walls.map(() => []);
    for (const part of holesKey ? holesKey.split('|') : []) {
      const [w, t0, t1, y0, y1] = part.split(':').map(Number);
      per[w]?.push({ t0, t1, y0, y1 });
    }
    return per;
  }, [holesKey, walls]);

  const H = wallDisplay === 'low' ? Math.min(LOW, room.wallHeight) : room.wallHeight;

  const wallGeos = useMemo(
    () =>
      walls.map((w, i) =>
        wallPieces(w, holes[i], room.wallHeight)
          .map((pc) => ({ ...pc, y1: Math.min(pc.y1, H) }))
          .filter((pc) => pc.y1 - pc.y0 > 1)
          .map((pc) => prism(pc.poly, pc.y0, pc.y1)),
      ),
    [walls, holes, room.wallHeight, H],
  );
  useEffect(() => () => wallGeos.flat().forEach((g) => g.dispose()), [wallGeos]);

  // skirting boards along each wall, interrupted where openings reach the floor
  const skirtGeo = useMemo(() => {
    if (skirtH <= 0) return [];
    const out: THREE.BufferGeometry[] = [];
    walls.forEach((w, i) => {
      const cuts = holes[i].filter((h) => h.y0 < skirtH).map((h) => [h.t0, h.t1]).sort((a, b) => a[0] - b[0]);
      let t = 0;
      const segs: [number, number][] = [];
      for (const [c0, c1] of cuts) {
        if (c0 > t) segs.push([t, c0]);
        t = Math.max(t, c1);
      }
      if (t < w.len) segs.push([t, w.len]);
      for (const [t0, t1] of segs) {
        if (t1 - t0 < 2) continue;
        const a = add(w.a, mul(w.dir, t0)), b = add(w.a, mul(w.dir, t1));
        const inset = mul(w.n, SKIRT_T);
        out.push(prism([a, b, add(b, inset), add(a, inset)], 0, skirtH));
      }
    });
    return out;
  }, [walls, holes, skirtH]);
  useEffect(() => () => skirtGeo.forEach((g) => g.dispose()), [skirtGeo]);
  const skirtMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(room.wallColor).lerp(new THREE.Color('#ffffff'), 0.5), roughness: 0.45 }), [room.wallColor]);
  useEffect(() => () => skirtMat.dispose(), [skirtMat]);

  const mats = useMemo(
    () =>
      walls.map(() => [
        new THREE.MeshStandardMaterial({ color: new THREE.Color(room.wallColor).multiplyScalar(0.55), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: room.wallColor, roughness: 0.95, bumpMap: plaster(), bumpScale: 1.5 }),
      ]),
    [walls.length, room.wallColor],
  );
  useEffect(() => () => mats.flat().forEach((m) => m.dispose()), [mats]);

  const floorGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(room.points.map((p) => new THREE.Vector2(p.x, -p.y))));
    g.rotateX(-Math.PI / 2);
    // ShapeGeometry UVs are shape coordinates (mm); flip v back to plan y
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, -uv.getY(i));
    return g;
  }, [room.points]);
  useEffect(() => () => floorGeo.dispose(), [floorGeo]);

  const floorType = room.floorType ?? 'planks';
  const floorMat = useMemo(() => {
    const { tex, tile } = floorTexture(floorType);
    const map = tex.clone();
    map.repeat.set(1 / tile, 1 / tile);
    map.needsUpdate = true;
    const rough = floorType === 'tiles' ? 0.35 : floorType === 'carpet' ? 1 : floorType === 'concrete' ? 0.8 : 0.6;
    return new THREE.MeshStandardMaterial({ color: room.floorColor, map, bumpMap: floorType === 'carpet' ? map : null, bumpScale: 2, roughness: rough });
  }, [floorType, room.floorColor]);
  useEffect(() => () => {
    floorMat.map?.dispose();
    floorMat.dispose();
  }, [floorMat]);

  // fade (and stop shadowing with) walls between the camera and the room
  const wallMeshes = useRef<(THREE.Mesh | null)[][]>([]);
  const faded = useRef<boolean[]>([]);
  useFrame(({ camera }) => {
    const c = vec(camera.position.x * 1000, camera.position.z * 1000);
    walls.forEach((w, i) => {
      const fade = wallDisplay === 'cutaway' && dot(sub(c, w.a), w.n) < -50 && camera.position.y * 1000 < room.wallHeight * 6;
      if (faded.current[i] === fade) return;
      faded.current[i] = fade;
      for (const m of mats[i] ?? []) {
        m.transparent = fade;
        m.opacity = fade ? 0.1 : 1;
        m.depthWrite = !fade;
        m.needsUpdate = true;
      }
      for (const mesh of wallMeshes.current[i] ?? []) if (mesh) mesh.castShadow = !fade;
    });
  });
  useEffect(() => {
    faded.current = [];
  }, [mats, wallDisplay, wallGeos]);

  return (
    <group>
      <mesh geometry={floorGeo} receiveShadow position={[0, 0.5, 0]} material={floorMat} />
      {wallGeos.map((geos, i) =>
        geos.map((g, j) => (
          <mesh
            key={`${i}-${j}`}
            ref={(m) => {
              (wallMeshes.current[i] ??= [])[j] = m;
            }}
            geometry={g}
            material={mats[i]}
            castShadow
            receiveShadow
          />
        )),
      )}
      {skirtGeo.map((g, i) => (
        <mesh key={`s${i}`} geometry={g} material={skirtMat} castShadow receiveShadow />
      ))}
    </group>
  );
}

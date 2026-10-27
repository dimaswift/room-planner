import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getBuild, mountOf } from '../furniture/catalog';
import { dot, sub, vec } from '../geometry/math';
import { getWalls, wallPieces, type WallHole } from '../geometry/room';
import { useStore } from '../store';
import type { Vec2 } from '../types';
import { floorTexture } from './objects';

const LOW = 320;

function prism(poly: Vec2[], y0: number, y1: number) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

export function RoomMesh() {
  const room = useStore((s) => s.doc.room);
  const items = useStore((s) => s.doc.items);
  const wallDisplay = useStore((s) => s.wallDisplay);
  const walls = getWalls(room);

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

  const mats = useMemo(
    () =>
      walls.map(() => [
        new THREE.MeshStandardMaterial({ color: new THREE.Color(room.wallColor).multiplyScalar(0.55), roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: room.wallColor, roughness: 0.92 }),
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

  const faded = useRef<boolean[]>([]);
  useFrame(({ camera }) => {
    const c = vec(camera.position.x * 1000, camera.position.z * 1000);
    walls.forEach((w, i) => {
      const fade = wallDisplay === 'cutaway' && dot(sub(c, w.a), w.n) < -50 && camera.position.y * 1000 < room.wallHeight * 6;
      if (faded.current[i] === fade) return;
      faded.current[i] = fade;
      for (const m of mats[i] ?? []) {
        m.transparent = fade;
        m.opacity = fade ? 0.12 : 1;
        m.depthWrite = !fade;
        m.needsUpdate = true;
      }
    });
  });
  useEffect(() => {
    faded.current = [];
  }, [mats, wallDisplay]);

  return (
    <group>
      <mesh geometry={floorGeo} receiveShadow position={[0, 0.5, 0]}>
        <meshStandardMaterial color={room.floorColor} map={floorTexture()} roughness={0.75} />
      </mesh>
      {wallGeos.map((geos, i) =>
        geos.map((g, j) => <mesh key={`${i}-${j}`} geometry={g} material={mats[i]} castShadow receiveShadow />),
      )}
    </group>
  );
}

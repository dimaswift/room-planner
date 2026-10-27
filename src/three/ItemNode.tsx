import { useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { fullParams, getBuild } from '../furniture/catalog';
import { DEG } from '../geometry/math';
import { poseOf, type Issue } from '../geometry/placement';
import { useStore } from '../store';
import type { Item, Room } from '../types';
import { buildObject, disposeObject } from './objects';

const ERR_MAT = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.28, depthWrite: false });

export const ItemNode = memo(function ItemNode({ item, room, issue }: { item: Item; room: Room; issue?: Issue }) {
  const build = getBuild(item, room);
  const outlines = useStore((s) => s.outlines);
  const lampsOn = useStore((s) => s.quality === 'high');
  const obj = useMemo(() => buildObject(build, fullParams(item), outlines), [build, outlines]);
  useEffect(() => () => disposeObject(obj), [obj]);
  const { camera, gl, controls } = useThree() as any;
  const pose = poseOf(item, room);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const st = useStore.getState();
    st.select(item.id);
    if (controls) controls.enabled = false;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y);
    const hit = new THREE.Vector3();
    e.ray.intersectPlane(plane, hit);
    const p0 = poseOf(item, room);
    const off = { x: p0.x - hit.x * 1000, y: p0.y - hit.z * 1000 };
    const sx = e.nativeEvent.clientX, sy = e.nativeEvent.clientY;
    const ray = new THREE.Raycaster();
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
        started = true;
        useStore.getState().beginDrag(item.id);
      }
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera);
      if (ray.ray.intersectPlane(plane, hit)) useStore.getState().moveItem(item.id, hit.x * 1000 + off.x, hit.z * 1000 + off.y, ev.altKey);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (started) useStore.getState().endDrag();
      if (controls) controls.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <group
      position={[pose.x, item.elev, pose.y]}
      rotation={[0, -pose.rot * DEG, 0]}
      onPointerDown={onDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        gl.domElement.style.cursor = 'grab';
      }}
      onPointerOut={() => (gl.domElement.style.cursor = '')}
    >
      <primitive object={obj} />
      {lampsOn &&
        build.lights?.map((l, i) => (
          <pointLight key={i} position={l.pos} color={l.color} intensity={l.intensity} distance={7} decay={2} />
        ))}
      {issue?.level === 'error' &&
        build.colliders.map((c, i) => (
          <mesh
            key={i}
            material={ERR_MAT}
            raycast={() => null}
            position={[(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2]}
          >
            <boxGeometry args={[c.max[0] - c.min[0] + 6, c.max[1] - c.min[1] + 6, c.max[2] - c.min[2] + 6]} />
          </mesh>
        ))}
    </group>
  );
});

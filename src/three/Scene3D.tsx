import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bboxOf, centroid } from '../geometry/math';
import { analyze } from '../geometry/placement';
import { useStore, type CameraPreset, type WallDisplay } from '../store';
import { ItemNode } from './ItemNode';
import { Overlay3D } from './Overlay3D';
import { RoomMesh } from './RoomMesh';

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    (scene as any).environmentIntensity = 0.55;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Lights() {
  const room = useStore((s) => s.doc.room);
  const light = useRef<THREE.DirectionalLight>(null);
  const bb = bboxOf(room.points);
  const cx = (bb.minX + bb.maxX) / 2000, cz = (bb.minY + bb.maxY) / 2000;
  const s = Math.max(bb.w, bb.h) / 1000 / 2 + 1.5;
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 0.5; cam.far = 40;
    cam.updateProjectionMatrix();
  }, [cx, cz, s]);
  return (
    <>
      <hemisphereLight args={['#ffffff', '#b9b2a6', 0.75]} />
      <directionalLight
        ref={light}
        castShadow
        position={[cx - 4, 9, cz + 6]}
        intensity={1.7}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}

function CameraRig() {
  const cmd = useStore((s) => s.cameraCmd);
  const room = useStore((s) => s.doc.room);
  const view = useStore((s) => s.view);
  const { camera, controls, size } = useThree() as any;
  const eyeIdx = useRef(0);
  // re-frame once the canvas has its new size after a layout change (split ↔ 3D, first mount)
  const pending = useRef(true);

  const apply = (advanceEye: boolean) => {
    const bb = bboxOf(room.points);
    const c = centroid(room.points);
    const cx = c.x / 1000, cz = c.y / 1000;
    // distance that fits the room's bounding sphere in the narrower field of view
    const r = Math.hypot(bb.w, bb.h) / 2000 + 0.4;
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * (size.width / Math.max(1, size.height)));
    const fov = Math.min(fovV, fovH);
    const preset: CameraPreset = cmd.preset;
    if (preset === 'top') {
      camera.position.set(cx, r / Math.tan(fov / 2) + 0.5, cz + 0.01);
      controls.target.set(cx, 0, cz);
    } else if (preset === 'eye') {
      const pts = room.points;
      if (!advanceEye) eyeIdx.current = Math.max(0, eyeIdx.current - 1);
      const corner = pts[eyeIdx.current++ % pts.length];
      const dir = new THREE.Vector2(c.x - corner.x, c.y - corner.y).normalize();
      camera.position.set((corner.x + dir.x * 450) / 1000, 1.6, (corner.y + dir.y * 450) / 1000);
      controls.target.set(cx, 1.0, cz);
    } else {
      const d = (r / Math.sin(fov / 2)) * 0.95;
      const dir = new THREE.Vector3(0.42, 0.78, 0.95).normalize();
      camera.position.set(cx + dir.x * d, dir.y * d, cz + dir.z * d);
      controls.target.set(cx, 0.2, cz);
    }
    controls.update();
  };

  useEffect(() => {
    if (controls && cmd.n) apply(true);
  }, [cmd.n]);
  useEffect(() => {
    pending.current = true;
  }, [view]);
  useEffect(() => {
    if (!controls || !pending.current || size.width < 50 || size.height < 50) return;
    const t = setTimeout(() => {
      pending.current = false;
      apply(false);
    }, 150);
    return () => clearTimeout(t);
  }, [size.width, size.height, controls, view]);
  return null;
}

function Items() {
  const doc = useStore((s) => s.doc);
  const issues = analyze(doc);
  return (
    <>
      {doc.items.map((it) => (
        <ItemNode key={it.id} item={it} room={doc.room} issue={issues.get(it.id)} />
      ))}
    </>
  );
}

export function Scene3D() {
  const select = useStore((s) => s.select);
  const wallDisplay = useStore((s) => s.wallDisplay);
  const set = useStore((s) => s.set);
  const setCamera = useStore((s) => s.setCamera);
  const gl = useMemo(() => ({ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping }), []);
  return (
    <div className="viewport3d">
      <Canvas shadows gl={gl} camera={{ fov: 45, near: 0.05, far: 300, position: [6, 6, 8] }} onPointerMissed={(e) => e.button === 0 && select(null)}>
        <color attach="background" args={['#e8ecf1']} />
        <Environment />
        <Lights />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#dfe3e8" roughness={1} />
        </mesh>
        <group scale={0.001}>
          <RoomMesh />
          <Items />
          <Overlay3D />
        </group>
        <OrbitControls makeDefault zoomToCursor enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.03} minDistance={0.3} maxDistance={60} />
        <CameraRig />
      </Canvas>
      <div className="vp-toolbar">
        <button onClick={() => setCamera('iso')} title="Overview">Overview</button>
        <button onClick={() => setCamera('top')} title="Top-down">Top</button>
        <button onClick={() => setCamera('eye')} title="Stand in a corner at eye level (click again for the next corner)">Eye level</button>
        <span className="sep" />
        <span className="vp-label">Walls</span>
        {(['cutaway', 'full', 'low'] as WallDisplay[]).map((w) => (
          <button key={w} className={wallDisplay === w ? 'on' : ''} onClick={() => set({ wallDisplay: w })}>
            {w === 'cutaway' ? 'Cutaway' : w === 'full' ? 'Full' : 'Low'}
          </button>
        ))}
      </div>
    </div>
  );
}

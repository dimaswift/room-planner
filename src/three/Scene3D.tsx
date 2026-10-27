import { OrbitControls, SoftShadows } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getBuild } from '../furniture/catalog';
import { bboxOf, centroid, rotPt } from '../geometry/math';
import { analyze } from '../geometry/placement';
import { getWalls } from '../geometry/room';
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
    (scene as any).environmentIntensity = 0.5;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Sun shining in through the biggest window (or from the front-left if there is none). */
function Lights() {
  const room = useStore((s) => s.doc.room);
  const items = useStore((s) => s.doc.items);
  const light = useRef<THREE.DirectionalLight>(null);
  const bb = bboxOf(room.points);
  const c = centroid(room.points);
  const cx = c.x / 1000, cz = c.y / 1000;
  const s = Math.max(bb.w, bb.h) / 1000 / 2 + 2;
  const win = items
    .filter((i) => i.type === 'window' && i.wall !== undefined)
    .sort((a, b) => getBuild(b, room).size[0] * getBuild(b, room).size[1] - getBuild(a, room).size[0] * getBuild(a, room).size[1])[0];
  const wall = win ? getWalls(room)[win.wall!] : undefined;
  // horizontal direction the light travels in, then rotated a bit so patches fall at an angle
  const dir = rotPt(wall ? wall.n : { x: 0.55, y: -0.83 }, 28);
  const el = (38 * Math.PI) / 180, D = 14;
  const pos: [number, number, number] = [cx - dir.x * D * Math.cos(el), D * Math.sin(el), cz - dir.y * D * Math.cos(el)];
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 1; cam.far = 40;
    cam.updateProjectionMatrix();
  }, [cx, cz, s, pos[0], pos[2]]);
  return (
    <>
      <hemisphereLight args={['#fff8ef', '#a89880', 0.7]} />
      <directionalLight
        ref={light}
        castShadow
        position={pos}
        color="#fff1dc"
        intensity={2.4}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
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
  const quality = useStore((s) => s.quality);
  const outlines = useStore((s) => s.outlines);
  const set = useStore((s) => s.set);
  const setCamera = useStore((s) => s.setCamera);
  const high = quality === 'high';
  const gl = useMemo(() => ({ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping }), []);
  return (
    <div className="viewport3d">
      <Canvas
        key={quality}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        gl={gl}
        camera={{ fov: 45, near: 0.05, far: 300, position: [6, 6, 8] }}
        onPointerMissed={(e) => e.button === 0 && select(null)}
      >
        <color attach="background" args={['#e8ecf1']} />
        {high && <SoftShadows size={22} samples={12} focus={0.4} />}
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
        {high && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <N8AO aoRadius={0.5} distanceFalloff={0.5} intensity={2.4} quality="medium" halfRes />
            <SMAA />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        )}
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
        <span className="sep" />
        <button className={high ? 'on' : ''} onClick={() => set({ quality: high ? 'fast' : 'high' })} title="Realistic lighting: ambient occlusion, soft shadows, lamp light. Turn off on slow machines.">
          Realistic
        </button>
        <button className={outlines ? 'on' : ''} onClick={() => set({ outlines: !outlines })} title="Draw part outlines">
          Outlines
        </button>
      </div>
    </div>
  );
}

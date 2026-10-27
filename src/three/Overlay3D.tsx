import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { getBuild, mountOf } from '../furniture/catalog';
import { DEG } from '../geometry/math';
import { analyze, clearances, poseOf } from '../geometry/placement';
import { useSelected, useStore } from '../store';

const Label = ({ p, text, tone }: { p: [number, number, number]; text: string; tone?: string }) => (
  <Html position={p} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
    <div className={`lbl3d ${tone ?? ''}`}>{text}</div>
  </Html>
);

/** Selection box, overall dimensions and clearances of the selected item. */
export function Overlay3D() {
  const item = useSelected();
  const doc = useStore((s) => s.doc);
  const showDims = useStore((s) => s.showDims);
  const dragging = useStore((s) => s.dragging);
  const b = item ? getBuild(item, doc.room) : null;
  const edges = useMemo(() => {
    if (!b) return null;
    const { min, max } = b.bounds;
    const g = new THREE.BoxGeometry(max[0] - min[0] + 8, max[1] - min[1] + 8, max[2] - min[2] + 8);
    g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const e = new THREE.EdgesGeometry(g);
    g.dispose();
    return e;
  }, [b]);
  if (!item || !b || !edges) return null;
  const issue = analyze(doc).get(item.id);
  const color = issue?.level === 'error' ? '#ff3b30' : issue?.level === 'warn' ? '#ff9f0a' : '#2f7cf6';
  const pose = poseOf(item, doc.room);
  const { min, max } = b.bounds;
  const [W, H, D] = b.size;
  const opening = mountOf(item) === 'opening';
  const cl = showDims && !opening ? clearances(doc, item) : [];
  const y = 12;
  return (
    <group>
      <group position={[pose.x, item.elev, pose.y]} rotation={[0, -pose.rot * DEG, 0]}>
        <lineSegments geometry={edges} raycast={() => null}>
          <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
        </lineSegments>
        {showDims && !dragging && (
          <>
            <Label p={[(min[0] + max[0]) / 2, max[1], max[2]]} text={`W ${Math.round(W)}`} />
            <Label p={[max[0], max[1], (min[2] + max[2]) / 2]} text={`D ${Math.round(D)}`} />
            <Label p={[max[0], (min[1] + max[1]) / 2, max[2]]} text={`H ${Math.round(H)}`} />
          </>
        )}
      </group>
      {cl.map((c) => (
        <group key={c.side}>
          <Line points={[[c.from.x, y, c.from.y], [c.to.x, y, c.to.y]]} color={c.wall ? '#2f7cf6' : '#d9480f'} lineWidth={2} dashed dashSize={60} gapSize={40} />
          {c.d > 1 && <Label p={[(c.from.x + c.to.x) / 2, y, (c.from.y + c.to.y) / 2]} text={`${Math.round(c.d)}`} tone={c.wall ? 'blue' : 'orange'} />}
        </group>
      ))}
    </group>
  );
}

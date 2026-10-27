import { useRef } from 'react';
import { bboxOf } from '../geometry/math';
import { useStore, type PlanTool } from '../store';

const TOOLS: { t: PlanTool; label: string; key: string; title: string }[] = [
  { t: 'select', label: 'Select', key: 'V', title: 'Select and move furniture' },
  { t: 'walls', label: 'Edit walls', key: 'W', title: 'Drag corners / walls, type wall lengths' },
  { t: 'draw', label: 'Draw room', key: 'D', title: 'Click corners to draw a new room outline' },
];

export function loadUnderlay(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result);
    const img = new Image();
    img.onload = () => {
      const st = useStore.getState();
      const bb = bboxOf(st.doc.room.points);
      const mmPerPx = (bb.w * 1.3) / img.naturalWidth;
      st.set({
        underlay: { src, x: bb.minX - bb.w * 0.15, y: bb.minY - bb.h * 0.15, mmPerPx, pxW: img.naturalWidth, pxH: img.naturalHeight, opacity: 0.5 },
        planTool: 'calibrate',
        view: st.view === '3d' ? 'split' : st.view,
      });
      st.notify('Plan image loaded. Click two points with a known distance to set its scale.');
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

export function PlanToolbar({ onFit }: { onFit: () => void }) {
  const tool = useStore((s) => s.planTool);
  const set = useStore((s) => s.set);
  const grid = useStore((s) => s.grid);
  const wallSnap = useStore((s) => s.wallSnap);
  const showDims = useStore((s) => s.showDims);
  const underlay = useStore((s) => s.underlay);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="plan-toolbar">
      <div className="seg">
        {TOOLS.map((t) => (
          <button key={t.t} className={tool === t.t ? 'on' : ''} title={`${t.title} (${t.key})`} onClick={() => set({ planTool: t.t })}>
            {t.label}
          </button>
        ))}
      </div>
      <button onClick={onFit} title="Fit room to view (F)">Fit</button>
      <span className="sep" />
      <label className="mini" title="Snap positions to a grid">
        Grid
        <select value={grid} onChange={(e) => set({ grid: +e.target.value })}>
          <option value={0}>off</option>
          <option value={1}>1 mm</option>
          <option value={10}>10 mm</option>
          <option value={50}>50 mm</option>
          <option value={100}>100 mm</option>
        </select>
      </label>
      <label className="mini chk" title="Pull items flush against nearby walls and turn their back to the wall">
        <input type="checkbox" checked={wallSnap} onChange={(e) => set({ wallSnap: e.target.checked })} /> Wall snap
      </label>
      <label className="mini chk" title="Show sizes and clearances of the selected item">
        <input type="checkbox" checked={showDims} onChange={(e) => set({ showDims: e.target.checked })} /> Clearances
      </label>
      <span className="sep" />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadUnderlay(f); e.target.value = ''; }} />
      {!underlay ? (
        <button onClick={() => fileRef.current?.click()} title="Load a scan or photo of a floor plan to trace over">Plan image…</button>
      ) : (
        <div className="seg">
          <button className={tool === 'calibrate' ? 'on' : ''} onClick={() => set({ planTool: 'calibrate' })} title="Set the image scale from a known distance">Scale image</button>
          <button className={tool === 'underlay' ? 'on' : ''} onClick={() => set({ planTool: 'underlay' })} title="Drag the image into place">Move image</button>
          <input type="range" min={0.1} max={1} step={0.05} value={underlay.opacity} title="Image opacity" onChange={(e) => set({ underlay: { ...underlay, opacity: +e.target.value } })} />
          <button onClick={() => set({ underlay: null, planTool: tool === 'calibrate' || tool === 'underlay' ? 'select' : tool })} title="Remove plan image">✕</button>
        </div>
      )}
    </div>
  );
}

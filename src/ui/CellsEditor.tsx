import { useState } from 'react';
import { CELL_TYPES, cabinetCells, uniformLayout, type CabLayout, type CellType } from '../furniture/cabinet';
import { useStore } from '../store';
import type { Item } from '../types';
import { NumberField, Row } from './fields';

const CELL_BG: Record<CellType, string> = {
  open: '#ffffff',
  books: 'repeating-linear-gradient(90deg,#c9705d 0 5px,#5d7fa8 5px 9px,#d9b65a 9px 13px,#6f9a6a 13px 18px,#fff 18px 20px)',
  door: '#e7dfd2',
  glass: '#d6ecf7',
  drawer: '#efe6d6',
  rail: 'linear-gradient(#fff 0 8px,#888 8px 10px,#fff 10px)',
};

export function CellsEditor({ item, p }: { item: Item; p: Record<string, any> }) {
  const updateParams = useStore((s) => s.updateParams);
  const layout: CabLayout = p.layout?.cols?.length ? p.layout : uniformLayout(1, 1);
  const [sel, setSel] = useState({ c: 0, r: 0 });
  const [gridC, setGridC] = useState(layout.cols.length);
  const [gridR, setGridR] = useState(Math.max(...layout.cols.map((c) => c.cells.length)));
  const geo = cabinetCells(p);
  const nc = layout.cols.length;
  const c = Math.min(sel.c, nc - 1);
  const r = Math.min(sel.r, layout.cols[c].cells.length - 1);
  const W = p.width, H = p.height, t = p.board;

  const commit = (next: CabLayout) => updateParams(item.id, { layout: next });
  const clone = (): CabLayout => structuredClone(layout);

  const setType = (ty: CellType) => {
    const l = clone();
    l.cols[c].cells[r].t = ty;
    commit(l);
  };
  const cycle = (ci: number, ri: number) => {
    const l = clone();
    const cur = l.cols[ci].cells[ri].t;
    const i = CELL_TYPES.findIndex((x) => x.t === cur);
    l.cols[ci].cells[ri].t = CELL_TYPES[(i + 1) % CELL_TYPES.length].t;
    commit(l);
  };
  const cellRect = geo.cells.find((x) => x.col === c && x.idx === r)!;
  const colRect = geo.cols[c];
  const m = layout.cols[c].cells.length;
  const availH = geo.yi1 - geo.yi0 - (m - 1) * t;
  const availW = W - 2 * t - (nc - 1) * t;

  const setCellHeight = (mm: number) => {
    const l = clone();
    const cells = l.cols[c].cells;
    const f = Math.min(0.97, Math.max(0.02, mm / availH));
    const others = cells.reduce((s, x, i) => (i === r ? s : s + x.h), 0);
    cells[r].h = (f / (1 - f)) * others;
    commit(l);
  };
  const setColWidth = (mm: number) => {
    const l = clone();
    const f = Math.min(0.97, Math.max(0.02, mm / availW));
    const others = l.cols.reduce((s, x, i) => (i === c ? s : s + x.w), 0);
    l.cols[c].w = (f / (1 - f)) * others;
    commit(l);
  };
  const split = () => {
    const l = clone();
    const cell = l.cols[c].cells[r];
    l.cols[c].cells.splice(r, 1, { ...cell, h: cell.h / 2 }, { ...cell, h: cell.h / 2 });
    commit(l);
  };
  const removeCell = () => {
    const l = clone();
    const cells = l.cols[c].cells;
    if (cells.length < 2) return;
    const [gone] = cells.splice(r, 1);
    cells[Math.max(0, r - 1)].h += gone.h;
    setSel({ c, r: Math.max(0, r - 1) });
    commit(l);
  };
  const addCol = () => {
    const l = clone();
    l.cols.splice(c + 1, 0, structuredClone(l.cols[c]));
    setSel({ c: c + 1, r });
    commit(l);
  };
  const removeCol = () => {
    if (nc < 2) return;
    const l = clone();
    l.cols.splice(c, 1);
    setSel({ c: Math.max(0, c - 1), r: 0 });
    commit(l);
  };

  // preview box: fit 264 × 280 px keeping proportions
  const scale = Math.min(264 / W, 280 / H);
  const pw = W * scale, ph = H * scale;

  return (
    <div className="cells">
      <div className="cab-preview" style={{ width: pw, height: ph }}>
        {geo.cells.map((cl) => {
          const w = cl.x1 - cl.x0, h = cl.y1 - cl.y0;
          const on = cl.col === c && cl.idx === r;
          return (
            <div
              key={`${cl.col}-${cl.idx}`}
              className={`cab-cell ${on ? 'on' : ''} t-${cl.t}`}
              style={{ left: (cl.x0 + W / 2) * scale, top: (H - cl.y1) * scale, width: w * scale, height: h * scale, background: CELL_BG[cl.t] }}
              onClick={() => setSel({ c: cl.col, r: cl.idx })}
              onDoubleClick={() => cycle(cl.col, cl.idx)}
              title={`${CELL_TYPES.find((x) => x.t === cl.t)?.label} · ${Math.round(w)} × ${Math.round(h)} mm clear (double-click to change type)`}
            >
              {w * scale > 34 && h * scale > 16 && <span>{w * scale > 60 && h * scale > 28 ? `${Math.round(w)}×${Math.round(h)}` : CELL_TYPES.find((x) => x.t === cl.t)?.short}</span>}
            </div>
          );
        })}
      </div>
      <div className="cell-types">
        {CELL_TYPES.map((ct) => (
          <button key={ct.t} className={layout.cols[c].cells[r].t === ct.t ? 'on' : ''} onClick={() => setType(ct.t)} title={ct.label}>
            {ct.short}
          </button>
        ))}
      </div>
      <Row label="Cell clear height">
        <NumberField value={Math.round(cellRect.y1 - cellRect.y0)} unit="mm" min={20} onChange={setCellHeight} disabled={m < 2} title={m < 2 ? 'Only cell in this column' : ''} />
      </Row>
      <Row label={`Column ${c + 1} clear width`}>
        <NumberField value={Math.round(colRect.x1 - colRect.x0)} unit="mm" min={20} onChange={setColWidth} disabled={nc < 2} />
      </Row>
      <div className="btn-row">
        <button onClick={split} title="Split the selected cell into two">Split cell</button>
        <button onClick={removeCell} disabled={m < 2} title="Merge the selected cell into its neighbour">Merge cell</button>
      </div>
      <div className="btn-row">
        <button onClick={addCol} title="Duplicate the selected column">+ Column</button>
        <button onClick={removeCol} disabled={nc < 2}>− Column</button>
      </div>
      <div className="grid-quick">
        <span>Uniform grid</span>
        <input type="number" min={1} max={12} value={gridC} onChange={(e) => setGridC(Math.max(1, Math.min(12, +e.target.value || 1)))} />
        <span>×</span>
        <input type="number" min={1} max={20} value={gridR} onChange={(e) => setGridR(Math.max(1, Math.min(20, +e.target.value || 1)))} />
        <button onClick={() => commit(uniformLayout(gridC, gridR, 'open', layout))}>Apply</button>
      </div>
    </div>
  );
}

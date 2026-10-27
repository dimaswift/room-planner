import { useEffect, useMemo, useState } from 'react';
import { getBuild, sizeLabel } from '../furniture/catalog';
import { downloadBlob, downloadText, printSheets, safeName, svgToPng } from '../export/output';
import { THEMES, itemSheet, roomSheet, uniqueDesigns } from '../export/sheets';
import { useStore } from '../store';

export function DrawingsModal() {
  const drawings = useStore((s) => s.drawings);
  const doc = useStore((s) => s.doc);
  const set = useStore((s) => s.set);
  const notify = useStore((s) => s.notify);
  const [theme, setTheme] = useState<'technical' | 'blueprint'>('technical');
  const [picked, setPicked] = useState<string | null>(null);
  const designs = useMemo(() => uniqueDesigns(doc), [doc]);
  // a fresh open starts on whatever was requested; clicks in the list override it
  useEffect(() => setPicked(null), [drawings]);
  const requested = drawings?.kind === 'item' ? designs.find((d) => d.ids.includes(drawings.id))?.item.id ?? 'room' : 'room';
  const sel = picked ?? requested;
  const setSel = setPicked;

  const current = useMemo(() => {
    if (!drawings) return null;
    const th = THEMES[theme];
    if (sel === 'room') return { svg: roomSheet(doc, th).svg, size: 'A3' as const, w: 420, h: 297, name: `${safeName(doc.name)}-floor-plan` };
    const g = designs.find((d) => d.item.id === sel);
    if (!g) return { svg: roomSheet(doc, th).svg, size: 'A3' as const, w: 420, h: 297, name: `${safeName(doc.name)}-floor-plan` };
    return { svg: itemSheet(doc, g.item, th, g.qty), size: 'A4' as const, w: 297, h: 210, name: safeName(g.item.name) };
  }, [drawings, sel, theme, doc, designs]);

  if (!drawings || !current) return null;
  const close = () => set({ drawings: null });
  const printAll = () => {
    const th = THEMES[theme];
    printSheets([{ svg: roomSheet(doc, th).svg, size: 'A3' }, ...designs.map((g) => ({ svg: itemSheet(doc, g.item, th, g.qty), size: 'A4' as const }))]);
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal drawings">
        <aside>
          <h3>Drawings</h3>
          <button className={`sheet-btn ${sel === 'room' ? 'on' : ''}`} onClick={() => setSel('room')}>
            <b>Floor plan</b>
            <small>A3 · room, openings, furniture, schedule</small>
          </button>
          <h5>Items</h5>
          <div className="sheet-list">
            {designs.map((g) => (
              <button key={g.item.id} className={`sheet-btn ${sel === g.item.id ? 'on' : ''}`} onClick={() => setSel(g.item.id)}>
                <b>{g.item.name}{g.qty > 1 ? ` ×${g.qty}` : ''}</b>
                <small>{sizeLabel(getBuild(g.item, doc.room))} mm</small>
              </button>
            ))}
          </div>
        </aside>
        <main>
          <div className="drawings-bar">
            <div className="seg">
              <button className={theme === 'technical' ? 'on' : ''} onClick={() => setTheme('technical')}>Technical</button>
              <button className={theme === 'blueprint' ? 'on' : ''} onClick={() => setTheme('blueprint')}>Blueprint</button>
            </div>
            <div className="grow" />
            <button onClick={() => downloadText(current.svg, `${current.name}.svg`)}>SVG</button>
            <button onClick={async () => {
              try {
                downloadBlob(await svgToPng(current.svg, current.w, current.h), `${current.name}.png`);
              } catch (e) {
                notify(String((e as Error).message));
              }
            }}>PNG</button>
            <button onClick={() => printSheets([{ svg: current.svg, size: current.size }])} title="Print, or choose “Save as PDF” in the print dialog">Print / PDF</button>
            <button className="primary" onClick={printAll} title="Floor plan + one sheet per distinct item">Print full set</button>
            <button className="icon" onClick={close} title="Close">✕</button>
          </div>
          <div className={`sheet-preview ${current.size}`} dangerouslySetInnerHTML={{ __html: current.svg }} />
          <p className="muted small">Print at 100 % (no “fit to page”) to keep the stated scale. Dimensions are in millimetres.</p>
        </main>
      </div>
    </div>
  );
}

export function HelpModal() {
  const open = useStore((s) => s.helpOpen);
  const set = useStore((s) => s.set);
  if (!open) return null;
  const rows: [string, string][] = [
    ['Drag', 'Move an item (plan or 3D). It slides along walls and other items instead of passing through them'],
    ['Alt + drag', 'Move without snapping or collision checks'],
    ['● handle', 'Rotate in the plan (15° steps, Shift = 1°)'],
    ['R / Shift+R', 'Rotate selected 90° / −90°'],
    ['Q / E', 'Rotate selected −15° / +15°'],
    ['Arrows', 'Nudge by the grid step (Shift = ×10)'],
    ['⌘D', 'Duplicate'],
    ['Del / Backspace', 'Delete selected'],
    ['⌘Z / ⇧⌘Z', 'Undo / redo'],
    ['V / W / D', 'Plan tools: select, edit walls, draw room'],
    ['F', 'Fit the plan to the room'],
    ['Esc', 'Deselect / leave a tool'],
  ];
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && set({ helpOpen: false })}>
      <div className="modal help">
        <h3>How it works</h3>
        <p>Set up the room in the <b>Plan</b>: type wall lengths in the right panel, drag walls with <b>Edit walls</b>, or <b>Draw room</b> (optionally over a scanned <b>Plan image</b> you scale with two clicks). Then add furniture from the left. Every item is generated from its parameters — change any size or, for shelving, the cells — and the 3D view updates live.</p>
        <p>Items can't be placed inside walls or each other. Red means a collision, orange a warning (e.g. something in a door's swing). Small things like plants, lamps and TVs sit on whatever is under them. Blue dashed lines show the free space from the selected item to walls; orange ones to other furniture.</p>
        <table>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="insp-actions"><button className="primary" onClick={() => set({ helpOpen: false })}>Got it</button></div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3800);
    return () => clearTimeout(t);
  }, [toast?.n]);
  if (!toast || !visible) return null;
  return <div className="toast">{toast.msg}</div>;
}

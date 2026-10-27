import { useRef } from 'react';
import { downloadText, safeName } from '../export/output';
import { sanitizeDoc, useStore, type ViewMode } from '../store';

export function TopBar() {
  const st = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const open = (f: File) => {
    f.text().then((t) => {
      try {
        const d = sanitizeDoc(JSON.parse(t));
        if (!d) throw new Error('bad');
        st.loadProject(d);
        st.notify(`Opened “${d.name}”.`);
      } catch {
        st.notify('That file is not a Room Planner project.');
      }
    });
  };
  return (
    <header className="topbar">
      <div className="brand">
        <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M2 11h7v7M13 2v6h5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        Room Planner
      </div>
      <div className="seg">
        {(['plan', 'split', '3d'] as ViewMode[]).map((v) => (
          <button key={v} className={st.view === v ? 'on' : ''} onClick={() => st.set({ view: v })}>
            {v === 'plan' ? 'Plan' : v === 'split' ? 'Split' : '3D'}
          </button>
        ))}
      </div>
      <div className="seg">
        <button onClick={st.undo} disabled={!st.past.length} title="Undo (⌘Z)">↶ Undo</button>
        <button onClick={st.redo} disabled={!st.future.length} title="Redo (⇧⌘Z)">↷ Redo</button>
      </div>
      <div className="grow" />
      <div className="seg">
        <button onClick={() => { if (confirm('Start a new empty room? (The current one can be restored with Undo.)')) st.newProject(); }}>New</button>
        <button onClick={() => fileRef.current?.click()} title="Open a saved .room.json project">Open…</button>
        <button onClick={() => downloadText(JSON.stringify(st.doc, null, 2), `${safeName(st.doc.name)}.room.json`, 'application/json')} title="Save project as a file">Save</button>
      </div>
      <button className="primary" onClick={() => st.set({ drawings: st.selectedId ? { kind: 'item', id: st.selectedId } : { kind: 'room' } })} title="Blueprint of the room and dimensioned drawings of each item">
        Drawings
      </button>
      <button className="icon" onClick={() => st.set({ helpOpen: true })} title="Shortcuts and help (?)">?</button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />
    </header>
  );
}

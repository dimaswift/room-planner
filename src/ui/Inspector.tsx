import { useState } from 'react';
import { DEFS, fullParams, getBuild, mountOf, sizeLabel } from '../furniture/catalog';
import type { ParamDef } from '../furniture/types';
import { analyze } from '../geometry/placement';
import { getWalls, lRoom, rectRoom, roomArea, roomPerimeter, setWallLength } from '../geometry/room';
import { useSelected, useStore } from '../store';
import type { Item } from '../types';
import { CellsEditor } from './CellsEditor';
import { NumberField, Row, Section, TextField } from './fields';

function ParamField({ item, pd, p }: { item: Item; pd: ParamDef; p: Record<string, any> }) {
  const updateParams = useStore((s) => s.updateParams);
  const set = (v: any) => updateParams(item.id, { [pd.key]: v });
  const v = p[pd.key];
  switch (pd.type) {
    case 'number':
    case 'int':
      return (
        <Row label={pd.label} hint={pd.hint}>
          <NumberField value={+v} unit={pd.unit} min={pd.min} max={pd.max} step={pd.type === 'int' ? 1 : pd.step ?? 10} onChange={(n) => set(pd.type === 'int' ? Math.round(n) : n)} />
        </Row>
      );
    case 'select':
      return (
        <Row label={pd.label} hint={pd.hint}>
          <select value={v} onChange={(e) => set(e.target.value)}>
            {pd.options!.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </Row>
      );
    case 'bool':
      return (
        <Row label={pd.label} hint={pd.hint}>
          <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} />
        </Row>
      );
    case 'color':
      return (
        <Row label={pd.label} hint={pd.hint}>
          <span className="color-ctl">
            <input type="color" value={v} onChange={(e) => set(e.target.value)} />
            <code>{String(v).toUpperCase()}</code>
          </span>
        </Row>
      );
    case 'cells':
      return <CellsEditor item={item} p={p} />;
  }
}

function ItemPanel({ item }: { item: Item }) {
  const st = useStore();
  const doc = st.doc;
  const def = DEFS[item.type];
  const p = fullParams(item);
  const b = getBuild(item, doc.room);
  const issue = analyze(doc).get(item.id);
  const m = mountOf(item);
  const opening = m === 'opening';
  const walls = getWalls(doc.room);
  const groups: { name: string; params: ParamDef[] }[] = [];
  for (const pd of def.params) {
    if (pd.show && !pd.show(p)) continue;
    const g = pd.group ?? 'Parameters';
    let grp = groups.find((x) => x.name === g);
    if (!grp) groups.push((grp = { name: g, params: [] }));
    grp.params.push(pd);
  }
  const [presetIdx, setPresetIdx] = useState('');

  return (
    <div className="inspector">
      <div className="insp-head">
        <TextField className="name-input" value={item.name} onChange={(name) => st.updateItem(item.id, { name })} />
        <div className="muted small">
          {def.label} · {sizeLabel(b)} mm{b.note ? ` · ${b.note}` : ''}
        </div>
        {issue && <div className={`issue ${issue.level}`}>{issue.level === 'error' ? '⛔' : '⚠️'} {issue.msg}</div>}
      </div>

      <Section title="Placement">
        {opening ? (
          <>
            <Row label="Wall">
              <select value={item.wall} onChange={(e) => {
                const w = walls[+e.target.value];
                st.updateItem(item.id, { wall: w.i, offset: Math.round(w.len / 2) });
              }}>
                {walls.map((w) => (
                  <option key={w.i} value={w.i}>Wall {w.i + 1} ({Math.round(w.len)} mm)</option>
                ))}
              </select>
            </Row>
            <Row label="Centre from wall start" hint="Distance along the wall from its first corner to the opening centre">
              <NumberField value={Math.round(item.offset ?? 0)} unit="mm" min={0} step={10} onChange={(v) => st.updateItem(item.id, { offset: v })} />
            </Row>
            <Row label="Left edge from corner">
              <NumberField value={Math.round((item.offset ?? 0) + b.cut![0])} unit="mm" min={0} step={10} onChange={(v) => st.updateItem(item.id, { offset: v - b.cut![0] })} />
            </Row>
            {item.type === 'window' && (
              <Row label="Sill height">
                <NumberField value={item.elev} unit="mm" min={0} step={10} onChange={(v) => st.updateItem(item.id, { elev: v })} />
              </Row>
            )}
          </>
        ) : (
          <>
            <div className="xy">
              <Row label="X"><NumberField value={Math.round(item.x)} unit="mm" step={10} onChange={(v) => st.updateItem(item.id, { x: v })} /></Row>
              <Row label="Y"><NumberField value={Math.round(item.y)} unit="mm" step={10} onChange={(v) => st.updateItem(item.id, { y: v })} /></Row>
            </div>
            <Row label="Rotation">
              <span className="rot-ctl">
                <NumberField value={Math.round(item.rot * 10) / 10} unit="°" step={15} onChange={(v) => st.setRotation(item.id, v)} />
                <button title="Rotate −90° (Shift+R)" onClick={() => st.rotateBy(item.id, -90)}>⟲</button>
                <button title="Rotate +90° (R)" onClick={() => st.rotateBy(item.id, 90)}>⟳</button>
              </span>
            </Row>
            <Row label="Elevation" hint={m === 'surface' ? 'Set automatically: rests on whatever is below it' : 'Height of the bottom above the floor'}>
              {m === 'surface' ? (
                <span className="auto-val">{Math.round(item.elev)} mm <em>auto</em></span>
              ) : (
                <NumberField value={item.elev} unit="mm" min={0} step={10} onChange={(v) => st.updateItem(item.id, { elev: v })} />
              )}
            </Row>
          </>
        )}
        {def.presets.length > 1 && (
          <Row label="Preset">
            <select value={presetIdx} onChange={(e) => {
              const i = +e.target.value;
              setPresetIdx('');
              const pr = def.presets[i];
              st.updateParams(item.id, structuredClone({ ...def.defaults, ...pr.params }));
            }}>
              <option value="">Apply a preset…</option>
              {def.presets.map((pr, i) => <option key={i} value={i}>{pr.name}</option>)}
            </select>
          </Row>
        )}
      </Section>

      {groups.map((g) => (
        <Section key={g.name} title={g.name}>
          {g.params.map((pd) => <ParamField key={pd.key} item={item} pd={pd} p={p} />)}
        </Section>
      ))}

      <div className="insp-actions">
        <button onClick={() => st.duplicateItem(item.id)} title="Duplicate (⌘D)">Duplicate</button>
        <button onClick={() => st.set({ drawings: { kind: 'item', id: item.id } })} title="Front / side / top drawing with dimensions">Drawing</button>
        <button className="danger" onClick={() => st.deleteItem(item.id)} title="Delete (Del)">Delete</button>
      </div>
    </div>
  );
}

function RoomPanel() {
  const st = useStore();
  const { doc } = st;
  const room = doc.room;
  const walls = getWalls(room);
  const issues = analyze(doc);
  const [rect, setRect] = useState({ w: 4000, d: 3500 });
  const [lr, setLr] = useState({ w: 6000, d: 5000, cw: 2500, cd: 2000 });
  const errs = [...issues.values()].filter((i) => i.level === 'error').length;
  const warns = issues.size - errs;
  return (
    <div className="inspector">
      <div className="insp-head">
        <TextField className="name-input" value={doc.name} onChange={(name) => st.commitDoc({ ...doc, name })} />
        <div className="muted small">
          {(roomArea(room) / 1e6).toFixed(2)} m² · perimeter {(roomPerimeter(room) / 1000).toFixed(2)} m · {doc.items.length} items
        </div>
        {errs + warns > 0 && <div className={`issue ${errs ? 'error' : 'warn'}`}>{errs ? `⛔ ${errs} placement problem${errs > 1 ? 's' : ''}` : ''}{errs && warns ? ' · ' : ''}{warns ? `⚠️ ${warns} warning${warns > 1 ? 's' : ''}` : ''}</div>}
      </div>
      <Section title="Room">
        <Row label="Ceiling height"><NumberField value={room.wallHeight} unit="mm" min={1800} max={6000} step={10} onChange={(v) => st.setRoom({ wallHeight: v })} /></Row>
        <Row label="Wall thickness"><NumberField value={room.wallThickness} unit="mm" min={50} max={600} step={5} onChange={(v) => st.setRoom({ wallThickness: v })} /></Row>
        <Row label="Floor"><span className="color-ctl"><input type="color" value={room.floorColor} onChange={(e) => st.setRoom({ floorColor: e.target.value })} /><code>{room.floorColor.toUpperCase()}</code></span></Row>
        <Row label="Walls"><span className="color-ctl"><input type="color" value={room.wallColor} onChange={(e) => st.setRoom({ wallColor: e.target.value })} /><code>{room.wallColor.toUpperCase()}</code></span></Row>
      </Section>
      <Section title="Wall lengths (inner)">
        {walls.map((w) => (
          <Row key={w.i} label={`Wall ${w.i + 1}`}>
            <NumberField value={Math.round(w.len)} unit="mm" min={100} max={100000} step={10} onChange={(v) => st.setRoomPoints(setWallLength(room.points, w.i, v))} />
          </Row>
        ))}
        <p className="muted small">Changing a length keeps square rooms square. Use <b>Edit walls</b> in the plan to drag corners or walls, or add corners.</p>
      </Section>
      <Section title="New outline">
        <div className="shape-row">
          <span>Rectangle</span>
          <NumberField value={rect.w} unit="mm" min={500} step={50} onChange={(w) => setRect({ ...rect, w })} />
          <span>×</span>
          <NumberField value={rect.d} unit="mm" min={500} step={50} onChange={(d) => setRect({ ...rect, d })} />
          <button onClick={() => { st.setRoomPoints(rectRoom(rect.w, rect.d)); st.set({ fitNonce: st.fitNonce + 1 }); }}>Apply</button>
        </div>
        <div className="shape-row">
          <span>L-shape</span>
          <NumberField value={lr.w} unit="mm" min={1000} step={50} onChange={(w) => setLr({ ...lr, w })} />
          <span>×</span>
          <NumberField value={lr.d} unit="mm" min={1000} step={50} onChange={(d) => setLr({ ...lr, d })} />
        </div>
        <div className="shape-row">
          <span>cut-out</span>
          <NumberField value={lr.cw} unit="mm" min={100} step={50} onChange={(cw) => setLr({ ...lr, cw })} />
          <span>×</span>
          <NumberField value={lr.cd} unit="mm" min={100} step={50} onChange={(cd) => setLr({ ...lr, cd })} />
          <button onClick={() => {
            if (lr.cw >= lr.w || lr.cd >= lr.d) return st.notify('The cut-out must be smaller than the room.');
            st.setRoomPoints(lRoom(lr.w, lr.d, lr.cw, lr.cd));
            st.set({ fitNonce: st.fitNonce + 1 });
          }}>Apply</button>
        </div>
        <p className="muted small">Or use <b>Draw room</b> in the plan to click out any shape, optionally over a scanned plan image.</p>
      </Section>
      <div className="insp-actions">
        <button onClick={() => st.set({ drawings: { kind: 'room' } })}>Floor plan drawing</button>
      </div>
    </div>
  );
}

export function Inspector() {
  const item = useSelected();
  return item && DEFS[item.type] ? <ItemPanel key={item.id} item={item} /> : <RoomPanel />;
}

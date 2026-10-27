import { useMemo, useState } from 'react';
import { CATEGORIES, DEFS, fullParams } from '../furniture/catalog';
import { analyze } from '../geometry/placement';
import { useStore } from '../store';

function presetSize(type: string, i: number) {
  const def = DEFS[type];
  const p = { ...def.defaults, ...def.presets[i].params };
  const b = def.build(p, { wallThickness: 150, wallHeight: 2700 });
  return `${Math.round(b.size[0])}×${Math.round(b.size[2])}`;
}

export function Catalog() {
  const addItem = useStore((s) => s.addItem);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    return CATEGORIES.map((cat) => ({
      cat,
      entries: Object.values(DEFS)
        .filter((d) => d.category === cat)
        .flatMap((d) => d.presets.map((pr, i) => ({ type: d.type, i, name: pr.name, size: d.type === 'door' || d.type === 'window' ? `${pr.params.width ?? d.defaults.width}` : presetSize(d.type, i) }))),
    }));
  }, []);
  const ql = q.trim().toLowerCase();
  return (
    <div className="catalog">
      <input className="search" placeholder="Search furniture…" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map((g) => {
        const entries = g.entries.filter((e) => !ql || e.name.toLowerCase().includes(ql) || g.cat.toLowerCase().includes(ql));
        if (!entries.length) return null;
        return (
          <div key={g.cat} className="cat">
            <h5>{g.cat}</h5>
            <div className="cat-grid">
              {entries.map((e) => (
                <button key={`${e.type}-${e.i}`} className="cat-btn" onClick={() => addItem(e.type, e.i)} title={`Add ${e.name}`}>
                  <span>{e.name}</span>
                  <small>{e.size}</small>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Outliner() {
  const doc = useStore((s) => s.doc);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const issues = analyze(doc);
  return (
    <div className="outliner">
      <h5>In this room ({doc.items.length})</h5>
      <ul>
        {doc.items.map((it) => {
          const iss = issues.get(it.id);
          const p = fullParams(it);
          return (
            <li key={it.id} className={it.id === selectedId ? 'on' : ''} onClick={() => select(it.id)} title={iss?.msg}>
              <i className="swatch" style={{ background: p.color ?? '#ccc' }} />
              <span className="nm">{it.name}</span>
              {iss && <span className={`dot ${iss.level}`} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

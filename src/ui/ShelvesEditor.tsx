import { CONTENT_OPTIONS, type ShelfRow } from '../furniture/shelves';
import { useStore } from '../store';
import type { Item } from '../types';
import { NumberField } from './fields';

/** Per-board settings for wall shelves, listed top board first. */
export function ShelvesEditor({ item, p }: { item: Item; p: Record<string, any> }) {
  const updateParams = useStore((s) => s.updateParams);
  const rows: ShelfRow[] = p.shelves ?? [];
  const commit = (next: ShelfRow[]) => updateParams(item.id, { shelves: next });
  const patch = (i: number, v: Partial<ShelfRow>) => commit(rows.map((r, j) => (j === i ? { ...r, ...v } : r)));
  const order = rows.map((_, i) => i).reverse();
  return (
    <div className="shelves-ed">
      <div className="shelf-head">
        <span>Board</span>
        <span title="Clear height above the board">Space above</span>
        <span>Contents</span>
        <span title="How much of the length is filled">Fill</span>
        <span />
      </div>
      {order.map((i) => {
        const r = rows[i];
        return (
          <div key={i} className="shelf-row">
            <span className="muted">{i === rows.length - 1 ? 'Top' : i === 0 ? 'Bottom' : `#${i + 1}`}</span>
            <NumberField value={r.space} unit="mm" min={60} max={1500} step={10} onChange={(v) => patch(i, { space: v })} />
            <select value={r.content} onChange={(e) => patch(i, { content: e.target.value as ShelfRow['content'] })}>
              {CONTENT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <NumberField value={r.fill} unit="%" min={10} max={100} step={5} onChange={(v) => patch(i, { fill: v })} disabled={r.content === 'empty'} />
            <button className="icon" title="Remove this board" disabled={rows.length < 2} onClick={() => commit(rows.filter((_, j) => j !== i))}>✕</button>
          </div>
        );
      })}
      <div className="btn-row">
        <button onClick={() => commit([...rows, { ...(rows.at(-1) ?? { space: 300, content: 'books', fill: 80 }) }])}>+ Board on top</button>
        <button onClick={() => commit([{ ...(rows[0] ?? { space: 300, content: 'books', fill: 80 }) }, ...rows])}>+ Board below</button>
      </div>
    </div>
  );
}

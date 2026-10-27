import { create } from 'zustand';
import { DEFS, defaultElev, getBuild, mountOf } from './furniture/catalog';
import { add, clamp, closestOnSegment, convexOverlap, dot, mul, normDeg, sub, uid, vec } from './geometry/math';
import {
  anchorResize, findFreeSpot, footprint, isValid, makeCtx, planMove, planOpeningMove, supportHeight, syncOpening, worldColliders,
} from './geometry/placement';
import { getWalls, rectRoom } from './geometry/room';
import type { Doc, Item, Room, Underlay, Vec2 } from './types';

export type ViewMode = 'plan' | '3d' | 'split';
export type PlanTool = 'select' | 'walls' | 'draw' | 'calibrate' | 'underlay';
export type WallDisplay = 'cutaway' | 'full' | 'low';
export type CameraPreset = 'iso' | 'top' | 'eye';

const DOC_KEY = 'room-planner:doc:v1';
const UNDERLAY_KEY = 'room-planner:underlay:v1';
const UI_KEY = 'room-planner:ui:v1';

function makeItem(type: string, presetIdx = 0, extra: Partial<Item> = {}): Item {
  const def = DEFS[type];
  const preset = def.presets[presetIdx] ?? def.presets[0];
  const params = structuredClone({ ...def.defaults, ...(preset?.params ?? {}) });
  return {
    id: uid(),
    type,
    name: preset?.name ?? def.label,
    x: 0,
    y: 0,
    rot: 0,
    elev: preset?.elev ?? defaultElev(type, params),
    params,
    ...extra,
  };
}

export function sampleDoc(): Doc {
  const room: Room = { points: rectRoom(5200, 4000), wallHeight: 2700, wallThickness: 150, floorColor: '#c9a882', wallColor: '#f2efe9' };
  const it = (type: string, preset: number, p: Partial<Item>) => makeItem(type, preset, p);
  const items: Item[] = [
    it('window', 1, { wall: 0, offset: 2600, params: { ...DEFS.window.defaults, ...DEFS.window.presets[1].params, width: 1800 } }),
    it('door', 0, { wall: 2, offset: 4350, params: { ...DEFS.door.defaults, hinge: 'right' } }),
    it('rug', 0, { x: 1750, y: 2000, rot: 90 }),
    it('sofa', 0, { x: 475, y: 2000, rot: 270 }),
    it('table', 2, { x: 1700, y: 2000, rot: 90 }),
    it('cabinet', 6, { x: 4990, y: 2000, rot: 90 }),
    it('tv', 0, { x: 5070, y: 2000, rot: 90, elev: 450 }),
    it('cabinet', 0, { x: 900, y: 150, rot: 0 }),
    it('desk', 0, { x: 2600, y: 350, rot: 0 }),
    it('chair', 1, { x: 2600, y: 860, rot: 180 }),
    it('plant', 0, { x: 4750, y: 450, rot: 0 }),
    it('floorlamp', 0, { x: 240, y: 600, rot: 0 }),
  ].map((i) => (DEFS[i.type].mount === 'opening' ? syncOpening(i, room) : i));
  return { version: 1, name: 'Living room', room, items };
}

function loadJSON<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function sanitizeDoc(d: any): Doc | null {
  if (!d || !Array.isArray(d?.room?.points) || d.room.points.length < 3 || !Array.isArray(d.items)) return null;
  const room: Room = {
    points: d.room.points.map((p: any) => vec(+p.x || 0, +p.y || 0)),
    wallHeight: +d.room.wallHeight || 2700,
    wallThickness: +d.room.wallThickness || 150,
    floorColor: d.room.floorColor || '#c9a882',
    wallColor: d.room.wallColor || '#f2efe9',
  };
  const items: Item[] = d.items
    .filter((i: any) => i && DEFS[i.type])
    .map((i: any) => ({
      id: String(i.id || uid()), type: i.type, name: String(i.name || DEFS[i.type].label),
      x: +i.x || 0, y: +i.y || 0, rot: +i.rot || 0, elev: +i.elev || 0,
      params: { ...DEFS[i.type].defaults, ...(i.params || {}) },
      ...(i.wall !== undefined ? { wall: +i.wall, offset: +i.offset || 0 } : {}),
    }));
  return { version: 1, name: String(d.name || 'Room'), room, items };
}

/** Keep doors and windows attached to the same spot when the room outline changes. */
function reprojectOpenings(items: Item[], oldRoom: Room, newRoom: Room): Item[] {
  const ow = getWalls(oldRoom);
  const nw = getWalls(newRoom);
  const same = ow.length === nw.length;
  return items.map((it) => {
    if (DEFS[it.type]?.mount !== 'opening') return it;
    const w0 = ow[it.wall ?? 0];
    if (!w0) return syncOpening({ ...it, wall: 0, offset: nw[0].len / 2 }, newRoom);
    const p = add(w0.a, mul(w0.dir, it.offset ?? 0));
    let w = same ? nw[it.wall!] : undefined;
    if (!w) {
      let best = Infinity;
      for (const c of nw) {
        const d = closestOnSegment(p, c.a, c.b).d;
        if (d < best) {
          best = d;
          w = c;
        }
      }
    }
    if (!w) return it;
    const t = clamp(dot(sub(p, w.a), w.dir), 0, w.len);
    return syncOpening({ ...it, wall: w.i, offset: Math.round(t * 10) / 10 }, newRoom);
  });
}

/** Furniture standing against a wall that slides along its normal moves with that wall. */
function carryAttached(items: Item[], oldRoom: Room, newRoom: Room): Item[] {
  const n = oldRoom.points.length;
  if (n !== newRoom.points.length) return items;
  const walls = getWalls(oldRoom);
  const moves = new Map<string, Vec2>();
  walls.forEach((w, i) => {
    const da = sub(newRoom.points[i], oldRoom.points[i]);
    const db = sub(newRoom.points[(i + 1) % n], oldRoom.points[(i + 1) % n]);
    if (Math.hypot(da.x - db.x, da.y - db.y) > 0.5) return;
    const shift = dot(da, w.n);
    if (Math.abs(shift) < 0.05) return;
    for (const it of items) {
      const m = mountOf(it);
      if (m === 'opening' || m === 'rug') continue;
      const fp = footprint(it, oldRoom);
      const dmin = Math.min(...fp.map((p) => dot(sub(p, w.a), w.n)));
      const ts = fp.map((p) => dot(sub(p, w.a), w.dir));
      if (Math.abs(dmin) > 3 || Math.max(...ts) <= 0 || Math.min(...ts) >= w.len) continue;
      moves.set(it.id, add(moves.get(it.id) ?? vec(0, 0), mul(w.n, shift)));
    }
  });
  if (!moves.size) return items;
  return items.map((it) => {
    const v = moves.get(it.id);
    return v ? { ...it, x: Math.round((it.x + v.x) * 10) / 10, y: Math.round((it.y + v.y) * 10) / 10 } : it;
  });
}

interface UiPrefs {
  view: ViewMode;
  grid: number;
  wallSnap: boolean;
  showDims: boolean;
  wallDisplay: WallDisplay;
}

export interface State extends UiPrefs {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  selectedId: string | null;
  planTool: PlanTool;
  dragging: boolean;
  cameraCmd: { preset: CameraPreset; n: number };
  drawings: null | { kind: 'room' } | { kind: 'item'; id: string };
  underlay: Underlay | null;
  toast: { msg: string; n: number } | null;
  helpOpen: boolean;
  fitNonce: number;
  /** Items riding on the dragged one (moved along with it). */
  riders: string[];

  set: (patch: Partial<State>) => void;
  notify: (msg: string) => void;
  checkpoint: () => void;
  commitDoc: (doc: Doc, history?: boolean) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setRoom: (patch: Partial<Room>, history?: boolean) => void;
  setRoomPoints: (points: Vec2[], history?: boolean) => void;
  addItem: (type: string, presetIdx?: number, near?: Vec2) => void;
  updateItem: (id: string, patch: Partial<Item>, history?: boolean) => void;
  updateParams: (id: string, patch: Record<string, any>) => void;
  beginDrag: (id: string) => void;
  endDrag: () => void;
  moveItem: (id: string, x: number, y: number, free?: boolean) => void;
  nudge: (id: string, dx: number, dy: number) => void;
  setRotation: (id: string, deg: number, history?: boolean) => void;
  rotateBy: (id: string, delta: number) => void;
  /** Rotation while dragging a handle: applied only if the result is valid. */
  rotateLive: (id: string, deg: number) => void;
  deleteItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  newProject: () => void;
  loadProject: (doc: Doc) => void;
  setCamera: (preset: CameraPreset) => void;
}

const prefs = loadJSON<Partial<UiPrefs>>(UI_KEY) ?? {};
const initialDoc = sanitizeDoc(loadJSON(DOC_KEY)) ?? sampleDoc();

export const useStore = create<State>()((set, get) => {
  const mutateItems = (fn: (items: Item[]) => Item[], history = true) => {
    const { doc } = get();
    get().commitDoc({ ...doc, items: fn(doc.items) }, history);
  };
  const replaceItem = (id: string, fn: (it: Item) => Item, history = true) =>
    mutateItems((items) => items.map((it) => (it.id === id ? fn(it) : it)), history);
  const findItem = (id: string) => get().doc.items.find((i) => i.id === id);

  return {
    doc: initialDoc,
    past: [],
    future: [],
    selectedId: null,
    view: prefs.view ?? 'split',
    grid: prefs.grid ?? 10,
    wallSnap: prefs.wallSnap ?? true,
    showDims: prefs.showDims ?? true,
    wallDisplay: prefs.wallDisplay ?? 'cutaway',
    planTool: 'select',
    dragging: false,
    cameraCmd: { preset: 'iso', n: 0 },
    drawings: null,
    underlay: loadJSON<Underlay>(UNDERLAY_KEY),
    toast: null,
    helpOpen: false,
    fitNonce: 0,
    riders: [],

    set: (patch) => set(patch),
    notify: (msg) => set((s) => ({ toast: { msg, n: (s.toast?.n ?? 0) + 1 } })),

    checkpoint: () => set((s) => ({ past: [...s.past.slice(-150), s.doc], future: [] })),

    commitDoc: (doc, history = true) => {
      if (history) get().checkpoint();
      set({ doc });
    },

    undo: () => {
      const { past, doc, future } = get();
      if (!past.length) return;
      set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future].slice(0, 150) });
    },
    redo: () => {
      const { past, doc, future } = get();
      if (!future.length) return;
      set({ doc: future[0], future: future.slice(1), past: [...past, doc] });
    },

    select: (id) => set({ selectedId: id }),

    setRoom: (patch, history = true) => {
      const { doc } = get();
      const room = { ...doc.room, ...patch };
      const items = patch.points ? carryAttached(doc.items, doc.room, room) : doc.items;
      get().commitDoc({ ...doc, room, items: reprojectOpenings(items, doc.room, room) }, history);
    },

    setRoomPoints: (points, history = true) => get().setRoom({ points: points.map((p) => vec(Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10)) }, history),

    addItem: (type, presetIdx = 0, near) => {
      const { doc } = get();
      let item = makeItem(type, presetIdx);
      const same = doc.items.filter((i) => i.name === item.name || i.name.startsWith(item.name + ' ')).length;
      if (same) item.name = `${item.name} ${same + 1}`;
      const ctx = makeCtx(doc, [item.id]);
      const spot = findFreeSpot(ctx, item, near);
      if (spot) item = spot;
      else {
        if (DEFS[type].mount === 'opening') item = syncOpening({ ...item, wall: 0, offset: getWalls(doc.room)[0].len / 2 }, doc.room);
        else {
          const c = near ?? vec(0, 0);
          item = { ...item, x: c.x, y: c.y };
        }
        get().notify('No free spot found — placed anyway, drag it somewhere with room.');
      }
      get().commitDoc({ ...doc, items: [...doc.items, item] });
      set({ selectedId: item.id });
    },

    updateItem: (id, patch, history = true) => {
      const { doc } = get();
      replaceItem(id, (it) => {
        const next = { ...it, ...patch };
        return DEFS[next.type].mount === 'opening' ? syncOpening(next, doc.room) : next;
      }, history);
    },

    updateParams: (id, patch) => {
      const { doc } = get();
      const before = findItem(id);
      if (!before) return;
      let after: Item = { ...before, params: { ...before.params, ...patch } };
      const m0 = mountOf(before), m1 = mountOf(after);
      if (m0 !== m1) after.elev = defaultElev(after.type, after.params);
      if (m1 === 'surface') after.elev = supportHeight(makeCtx(doc, [id]), after);
      after = anchorResize(doc, before, after);
      replaceItem(id, () => after);
    },

    beginDrag: (id) => {
      const { doc } = get();
      const item = findItem(id);
      get().checkpoint();
      const riders: string[] = [];
      if (item && mountOf(item) !== 'opening') {
        const base = worldColliders(item, doc.room);
        for (const o of doc.items) {
          if (o.id === id || o.elev < 1 || mountOf(o) !== 'surface') continue;
          const oc = worldColliders({ ...o, elev: 0 }, doc.room);
          const on = base.some((b) => Math.abs(b.y1 - o.elev) < 2 && oc.some((c) => convexOverlap(c.pts, b.pts, 0.5)));
          if (on) riders.push(o.id);
        }
      }
      set({ dragging: true, riders });
    },
    endDrag: () => set({ dragging: false, riders: [] }),

    moveItem: (id, x, y, free = false) => {
      const { doc, grid, wallSnap, riders } = get();
      const cur = findItem(id);
      if (!cur) return;
      const ctx = makeCtx(doc, [id, ...riders]);
      const next = mountOf(cur) === 'opening'
        ? planOpeningMove(ctx, cur, x, y, free ? 0 : grid)
        : planMove(ctx, cur, x, y, { grid: free ? 0 : grid, walls: wallSnap, free });
      if (next.x === cur.x && next.y === cur.y && next.rot === cur.rot && next.elev === cur.elev && next.offset === cur.offset && next.wall === cur.wall) return;
      const dx = next.x - cur.x, dy = next.y - cur.y;
      const rs = new Set(riders);
      mutateItems((items) => items.map((it) => (it.id === id ? next : rs.has(it.id) ? { ...it, x: it.x + dx, y: it.y + dy } : it)), false);
    },

    nudge: (id, dx, dy) => {
      const { doc } = get();
      const cur = findItem(id);
      if (!cur) return;
      const ctx = makeCtx(doc, [id]);
      const next = mountOf(cur) === 'opening'
        ? planOpeningMove(ctx, cur, cur.x + dx, cur.y + dy, 0)
        : planMove(ctx, cur, cur.x + dx, cur.y + dy, { grid: 0, walls: false });
      replaceItem(id, () => next);
    },

    setRotation: (id, deg, history = true) => {
      const { doc } = get();
      const cur = findItem(id);
      if (!cur || mountOf(cur) === 'opening') return;
      let cand: Item = { ...cur, rot: normDeg(deg) };
      if (mountOf(cand) === 'surface') cand.elev = supportHeight(makeCtx(doc, [id]), cand);
      const ctx = makeCtx(doc, [id]);
      if (!isValid(ctx, cand) && isValid(ctx, cur)) {
        const spot = findFreeSpot(ctx, cand, vec(cur.x, cur.y), 700);
        if (spot) cand = spot;
      }
      replaceItem(id, () => cand, history);
    },

    rotateBy: (id, delta) => {
      const cur = findItem(id);
      if (cur) get().setRotation(id, cur.rot + delta);
    },

    rotateLive: (id, deg) => {
      const { doc } = get();
      const cur = findItem(id);
      if (!cur || mountOf(cur) === 'opening') return;
      const cand: Item = { ...cur, rot: normDeg(deg) };
      const ctx = makeCtx(doc, [id]);
      if (mountOf(cand) === 'surface') cand.elev = supportHeight(ctx, cand);
      if (cand.rot !== cur.rot && (isValid(ctx, cand) || !isValid(ctx, cur))) replaceItem(id, () => cand, false);
    },

    deleteItem: (id) => {
      mutateItems((items) => items.filter((i) => i.id !== id));
      if (get().selectedId === id) set({ selectedId: null });
    },

    duplicateItem: (id) => {
      const { doc } = get();
      const cur = findItem(id);
      if (!cur) return;
      let copy: Item = { ...structuredClone(cur), id: uid(), name: cur.name.replace(/( \d+)?$/, '') + ' copy' };
      const ctx = makeCtx(doc, [copy.id]);
      if (mountOf(copy) === 'opening') {
        const spot = findFreeSpot(ctx, copy);
        if (!spot) return get().notify('No room on the walls for another one.');
        copy = spot;
      } else {
        const b = getBuild(copy, doc.room);
        const spot = findFreeSpot(ctx, { ...copy, x: copy.x + b.size[0] * 0.6, y: copy.y }, vec(copy.x, copy.y));
        if (spot) copy = spot;
        else get().notify('No free spot found for the copy.');
      }
      get().commitDoc({ ...doc, items: [...doc.items, copy] });
      set({ selectedId: copy.id });
    },

    newProject: () => {
      get().commitDoc({ version: 1, name: 'New room', room: { ...sampleDoc().room, points: rectRoom(4000, 3500) }, items: [] });
      set((s) => ({ selectedId: null, cameraCmd: { preset: 'iso', n: s.cameraCmd.n + 1 }, fitNonce: s.fitNonce + 1 }));
    },

    loadProject: (doc) => {
      get().commitDoc(doc);
      set((s) => ({ selectedId: null, cameraCmd: { preset: 'iso', n: s.cameraCmd.n + 1 }, fitNonce: s.fitNonce + 1 }));
    },

    setCamera: (preset) => set((s) => ({ cameraCmd: { preset, n: s.cameraCmd.n + 1 } })),
  };
});

// persistence
let saveTimer: number | undefined;
useStore.subscribe((s, prev) => {
  if (s.doc !== prev.doc) {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(DOC_KEY, JSON.stringify(useStore.getState().doc));
      } catch {
        /* storage full or unavailable */
      }
    }, 400);
  }
  if (s.underlay !== prev.underlay) {
    try {
      if (s.underlay) localStorage.setItem(UNDERLAY_KEY, JSON.stringify(s.underlay));
      else localStorage.removeItem(UNDERLAY_KEY);
    } catch {
      useStore.getState().notify('Plan image is too large to remember between sessions.');
    }
  }
  if (s.view !== prev.view || s.grid !== prev.grid || s.wallSnap !== prev.wallSnap || s.showDims !== prev.showDims || s.wallDisplay !== prev.wallDisplay) {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ view: s.view, grid: s.grid, wallSnap: s.wallSnap, showDims: s.showDims, wallDisplay: s.wallDisplay }));
    } catch {
      /* ignore */
    }
  }
});

export const useSelected = () => useStore((s) => s.doc.items.find((i) => i.id === s.selectedId) ?? null);

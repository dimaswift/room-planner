# Room Planner

Plan a room in 2D, see it in 3D, and try out procedurally generated furniture at real sizes. All dimensions are in millimetres.

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # type-check + production build into dist/
```

## What it does

- **Room outline**: type wall lengths, drag walls or corners (*Edit walls*), draw any shape (*Draw room*: 90° snapping, type a length + Enter for exact walls), or trace a scanned plan image after scaling it with two clicks. Ceiling height and wall thickness are configurable.
- **Procedural furniture**: sofas (seat count, arms, chaise), beds, chairs (dining / office / stool), desks, tables, shelving & cabinets (columns and cells you edit one by one: open, books, door, glass, drawer, hanging rail), doors, windows, rugs, lamps, plants, TVs, kitchen and bath fixtures. Every part is generated from its parameters, so sizes and layouts can be anything.
- **Placement rules**: items can't overlap each other or go into walls. Each item has per-part collision boxes, so a chair seat slides under a desk top but its back doesn't. Drags slide along obstacles instead of passing through them. Items snap flush to walls and turn their back to them. Small props (plants, table lamps, TVs) rest on whatever is under them. Door swings that are blocked produce a warning.
- **Measurements**: the selected item shows its free distance to walls (blue) and to other furniture (orange), in both the plan and 3D.
- **Drawings**: an A3 floor plan at a true scale (walls, openings, chained wall dimensions, furniture, schedule, title block), plus an A4 sheet per distinct item with front, side and top views and dimensions. Export as SVG or PNG, or print / save as PDF. Technical or blueprint style.
- Undo/redo, autosave in the browser, and Save/Open of `.room.json` project files.

## Code map

- `src/furniture/*` – one generator per furniture type. Each returns primitives (boxes, cylinders, spheres), collision boxes, and dimension annotations.
- `src/furniture/project.ts` – projects primitives to 2D for the plan and the drawings.
- `src/geometry/placement.ts` – collisions, wall snapping, sliding, support height, clearances.
- `src/geometry/room.ts` – walls, mitred outline, wall pieces around openings.
- `src/plan/` – the SVG plan editor; `src/three/` – the 3D scene; `src/export/` – drawing sheets.
- `src/store.ts` – document, history, and all editing actions.

# Room Planner

Plan a room in 2D, see it in 3D, and try out procedurally generated furniture at real sizes. All dimensions are in millimetres.

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # type-check + production build into dist/
```

## What it does

- **Room outline**: type wall lengths, drag walls or corners (*Edit walls*), draw any shape (*Draw room*: 90° snapping, type a length + Enter for exact walls), or trace a scanned plan image after scaling it with two clicks. Ceiling height and wall thickness are configurable.
- **Procedural furniture**: sofas (seat count, arms, chaise, button tufting), beds, chairs (dining / office / stool), desks, tables, doors, windows, rugs (plain, border, stripes, kilim, Persian, jute), floor/table/pendant lamps, plants, TVs, rolling carts, kitchen and bath fixtures. Every part is generated from its parameters, so sizes and layouts can be anything.
- **Custom bookshelves**:
  - *Shelving & cabinets*: columns and cells edited one by one (open, books, books with decor, decor, door, glass door, drawer, hanging rail), separate shelf and upright thicknesses, plinth / legs / casters, bar / long-bar / cup / knob handles, a library ladder on a rail, and floor, wall or tabletop placement.
  - *Wall shelves*: any number of boards with their own spacing and contents, clamp / L / pipe / hidden brackets, and a hanging rail with plants or utensils on S-hooks.
  - Books come in runs, series, stacks and leaning books with spine palettes, a fill percentage and a *Shuffle* button. Tools: *Stretch to fill* (grow to the nearest wall, furniture, door or window) and *Fit to ceiling*.
- **Realistic view**: ambient occlusion, soft shadows, sunlight through the largest window, lamps that give light, and wood / fabric / leather / gloss / metal finishes per colour. Floors in planks, parquet, tiles, concrete or carpet, with skirting boards. A *Realistic* toggle falls back to a fast mode.
- **Placement rules**: items can't overlap each other or go into walls. Each item has per-part collision boxes, so a chair seat slides under a desk top but its back doesn't. Drags slide along obstacles instead of passing through them. Items snap flush to walls and turn their back to them. Small props (plants, table lamps, TVs) rest on whatever is under them. Door swings that are blocked produce a warning.
- **Measurements**: the selected item shows its free distance to walls (blue) and to other furniture (orange), in both the plan and 3D.
- **Drawings**: an A3 floor plan at a true scale (walls, openings, chained wall dimensions, furniture, schedule, title block), plus an A4 sheet per distinct item with front, side and top views and dimensions. Export as SVG or PNG, or print / save as PDF. Technical or blueprint style.
- Undo/redo, autosave in the browser, and Save/Open of `.room.json` project files.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the site on every push to `main` or `master`. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions** once. The build uses relative asset paths, so it works at `https://<user>.github.io/<repo>/`.

## Code map

- `src/furniture/*` – one generator per furniture type. Each returns primitives (boxes, cylinders, spheres), collision boxes, dimension annotations and light sources. `fill.ts` arranges books and decor on shelves.
- `src/furniture/project.ts` – projects primitives to 2D for the plan and the drawings.
- `src/geometry/placement.ts` – collisions, wall snapping, sliding, support height, clearances.
- `src/geometry/room.ts` – walls, mitred outline, wall pieces around openings.
- `src/plan/` – the SVG plan editor; `src/three/` – the 3D scene, materials and procedural textures; `src/export/` – drawing sheets.
- `src/store.ts` – document, history, and all editing actions.

# SimRodman — Architecture

This document explains how SimRodman is built so you can extend, tune, or
port it. The whole game is **vanilla HTML / CSS / JavaScript** with no build
step, no bundler, and no runtime dependencies.

## Big picture

```
┌────────────┐
│ index.html │  loads everything in order, then bootstraps via main.js
└────┬───────┘
     │
     ▼
  main.js  ─►  boot screen ─►  renderer/minimap/input/ui init ─► load save ─► RAF loop
                                                                   │
                                                                   ▼
                                                             game.update(dt)
                                                                   │
                                                                   ▼
                                                             every game-month:
                                                             sim.tick() →
                                                                ├─ recomputeNetworks
                                                                ├─ recomputeFields
                                                                ├─ growZones
                                                                ├─ payDay
                                                                └─ disasters.maybeTrigger
```

Everything lives inside the global namespace `window.SR`. Each module
attaches a sub-namespace (`SR.utils`, `SR.grid`, `SR.sim`, …) so you can
poke around in DevTools.

## Module responsibilities

| Module          | Responsibility |
|-----------------|----------------|
| `utils.js`      | Math, formatting, deterministic RNG (Mulberry32), value-noise / fbm. |
| `audio.js`      | Single WebAudio context, named SFX (`click`, `place`, `cash`, `boom`, …). All sound is synthesized — no audio files. |
| `buildings.js`  | Static `BUILDINGS` table (cost, footprint, power/water draw, coverage radius, color, glyph). Also the `ZONE_VIS` palette per density level and a `TOOL_TO_BUILDING` reverse map. |
| `grid.js`       | The 64×64 tile array. Handles terrain generation (river, elevation), and the placement primitives `setRoad`, `setPower`, `setPipe`, `setZone`, `place`, `demolish`. |
| `camera.js`     | Pan / zoom and the iso transform `tileToScreen` ↔ `screenToTile`, plus an elevation-aware picker `screenToTileWithElev`. |
| `renderer.js`   | Two-pass canvas renderer. Pass 1: terrain, water, roads, zones, wires, pipes — row-major. Pass 2: zone buildings, special buildings, fire — diagonal-major (back-to-front iso order). Also draws cursor highlight, parallax stars, and disaster glitch. |
| `minimap.js`    | Pixel-by-pixel image of the grid with 6 view modes (terrain, zones, power, crime, pollution, value). Click / tap recenters the camera. |
| `input.js`      | Mouse, wheel, touch, and keyboard. Tracks `cursor.{x,y}` for the renderer. Implements pinch-zoom, two-finger pan, double-tap-pan, and hotkeys. |
| `tools.js`      | Tool selection state and `applyAt(x, y)` — validates the action, deducts cost, calls grid primitives, plays SFX, marks sim dirty. |
| `simulation.js` | The economy and city sim. See "Tick pipeline" below. |
| `disasters.js`  | Random event list with `weight`, `effect()`, plus `tickFires()` that decays burning tiles. |
| `save.js`       | Snapshot / restore. Format version `1` includes seed, date, funds, tax, ordinances, and a per-tile slim record. |
| `ui.js`         | All HUD wiring: stats, alerts, ticker, info panel, minimap, modals (budget, charts, news, ordinances, export, import, new city, help). |
| `game.js`       | Top-level game state, `setSpeed`, `update(dt)`, `stepMonth`, `newCity({...})`. |
| `main.js`       | Boot screen typewriter, click handler, RAF loop. |

## Tile data

Each tile in `SR.grid.tiles` is a plain object:

```js
{
  z: 0..7,             // elevation
  t: 'water'|'ground',
  road: 0|1|2,         // 0 none, 1 road, 2 highway
  power: bool,         // power-line on tile
  pipe:  bool,         // water-pipe on tile
  poweredBy: bool,     // computed: connected to a power source
  watered:   bool,     // computed: connected to a water source
  zone: null|'r'|'c'|'i',
  building: null|key,  // key into SR.BUILDINGS
  bx, by: int,         // top-left footprint coords for multi-tile buildings
  level: 0..3,         // zone density level
  pop, jobs: int,
  pollution, crime, land: 0..100,
  onFire: int,         // remaining ticks
}
```

Tiles are stored in a flat `Array` indexed by `y * W + x`.

## Tick pipeline

`SR.sim.tick()` runs once per simulated month. The order matters:

1. **`recomputeNetworks`** — flood-fill BFS from every power source over
   *carriers* (`road | power | building | grown zone`). Adjacent zones at
   level 0 are *consumers* — they are marked `poweredBy: true` but the BFS
   does not propagate through them. Same algorithm for water with pipes.
   Tracks total `supply` and `demand` per network.
2. **`recomputeFields`** — for each service building or polluting structure,
   `spread()` a value over its Chebyshev radius with linear falloff.
   Pollution diffuses one step. Crime, land value, and coverage flags
   (`_policeCov`, `_fireCov`, `_healthCov`, `_eduCov`) are written back to
   each tile.
3. **`growZones`** — for every zone tile, compute a fitness score in
   `[-∞, ~1]`:
   ```
   fit  = 0
   fit += t.land/100 * 0.4
   fit += hasUtil ? 0.25 : 0
   fit += adjRoad ? 0.15 : -0.5
   fit += t._eduCov  * 0.10
   fit += t._healthCov * 0.05
   fit -= t.pollution/100 * 0.2
   fit -= t.crime/100 * 0.2
   fit -= taxRate * 1.5
   fit += demand[zoneKind] * 0.0008
   ```
   Then target = round(fit * 3.5) clamped to 0..3. If `t.level < target`, a
   random ~18% chance to step up. If above target, a ~10% chance to step
   down. Population and jobs are derived from `level`.
4. **`payDay`** — tax revenue from population and jobs; subtract
   maintenance. Approval drifts toward a target derived from tax rate,
   utility shortages, and population growth. History is appended for charts.
5. **`disasters.maybeTrigger`** — once population ≥ 200, ~5.5% chance per
   tick. Weighted random pick from the disaster list.

If any topology change happens (player builds something), `tools.js` calls
`SR.sim.markDirty()` so `recomputeNetworks` runs at the start of next tick.

## Iso rendering

The world uses a **2:1 isometric projection** with tile size 48×24 px.
Conversion (in `camera.js`):

```js
wx = (x - y) * (TILE_W / 2)
wy = (x + y) * (TILE_H / 2) - z * Z_STEP
```

Inverse picking is done by computing tile-space coords from screen coords,
then refining over neighboring tiles with elevation to pick the topmost
diamond hit (`screenToTileWithElev`).

The renderer paints in two passes:

- **Pass 1** (row-major, `y` outer): tile bases, road glyphs, zone marker
  glyphs, power lines, water pipes. Order doesn't matter much for flat
  terrain.
- **Pass 2** (diagonal-major, `d = x + y`): zone buildings, special
  buildings, and fire. This is the standard back-to-front iso painter's
  algorithm, ensuring tall buildings in front correctly occlude buildings
  behind them.

Each special building is drawn from its **top-left footprint tile** only;
when iterating other footprint tiles we early-return based on
`gridXFromScreenContext` matching `t.bx, t.by`.

## Save format

`localStorage` key `simrodman.save.v1`. Schema:

```jsonc
{
  "v": 1,
  "meta": { "date": 1745904000000, "cityName": "Neo-Rodman" },
  "game": {
    "seed": 12345, "year": 2079, "month": 4,
    "funds": 31818, "taxRate": 0.09, "approval": 64,
    "history": [ ... ],
    "ordinances": { ... }
  },
  "tiles": [
    { "z":0, "t":"ground", "road":1, "power":0, "pipe":0,
      "zone":"r", "building":null, "bx":0, "by":0, "level":2,
      "pop":32, "jobs":0 },
    ...  /* one per tile, flat row-major */
  ]
}
```

Restoring rebuilds the grid from `seed`, then overlays the saved per-tile
fields. Computed fields (pollution, crime, land, coverage, network flags)
are re-derived on the next tick.

## Extending the game

Some easy things to try:

- **New building type**: add an entry to `SR.BUILDINGS` and a button in
  `index.html`'s toolbar. The toolbar wiring auto-binds via `data-tool`.
- **New disaster**: add an item to `SR.disasters.list` with `effect()`.
- **New ordinance**: add a row in `ui.js openOrdinances()`, then read
  `SR.game.ordinances.<key>` in `simulation.js`.
- **Bigger map**: change `SR.GRID_W` / `SR.GRID_H` in `grid.js`. Performance
  at 128×128 is still fine; at 256×256, the BFS and fields will start to bite
  — switch fields to typed-array passes by coord rather than tile lookups.
- **Multiplayer**: the snapshot in `save.js` is JSON-serializable; ship it
  over WebRTC / WebSocket and replay actions instead of state.

## Performance notes

- Grids are linear arrays; BFS uses a head-pointer deque, not `Array.shift`.
- Zone fitness pass is `O(W·H)` with constant-time field lookups.
- Pollution diffusion is one-pass on a `Float32Array`.
- Renderer culls offscreen tiles with `viewBounds()` and a margin.
- The minimap re-renders only every ~600 ms (see `main.js`), not every
  frame.

## Testing

`scripts/smoketest.js` boots the entire codebase under Node with stubbed
DOM/canvas, builds a tiny city, runs 24 months, and asserts that population
grew and save/load round-trips. Run it after any simulation change.

```bash
node scripts/smoketest.js
```

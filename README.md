# SimRodman

> A cyberpunk SimCity 2000 clone, in neon orange and black, running entirely in your
> browser. Build the smoggy megacity Mayor Rodman deserves.

```
   ____  ____  __  __  ____   ___   ____  __  __    __    _   _
  / ___||  _ \|  \/  |/ ___| / _ \ |  _ \|  \/  |  / _\  | \ | |
  \___ \| |_) | |\/| | |    | | | || | | | |\/| | / _ \  |  \| |
   ___) |  _ <| |  | | |___ | |_| || |_| | |  | |/ ___ \ | |\  |
  |____/|_| \_\_|  |_|\____| \___/ |____/|_|  |_/_/   \_\|_| \_|
            // NEO-RODMAN CITY MUNICIPAL OS  v2.077
```

SimRodman is a complete, self-contained SC2000-style city builder: zone neon
districts, lay streets and power lines, manage budget and tax, plop megacorp
arcologies, weather cyber attacks and acid rain, and watch your cyberpunk
megacity grow. It runs in any modern browser on **desktop or mobile**, with no
build step and no dependencies.

## Quick start

```bash
# 1. Clone or download this repo
# 2. Serve the directory with any static server. Some options:

python3 -m http.server 8000
# or
npx http-server -p 8000
# or just double-click index.html (most browsers will allow file:// loading)
```

Open `http://localhost:8000` and click **JACK IN**.

> Tip: You can also push the folder to GitHub Pages, Netlify, Vercel, or any
> static host — there's nothing to build.

## Features

- **Isometric tile-based world** generated from procedural noise, with a
  river, terraced elevation, and a coastline.
- **Six tool families**: Inspect, Demolish, Roads (regular + Neon Highway),
  Power Lines, Water Pipes, Zones (R/C/I), Service Buildings (Police, Fire,
  Hospital, School, Park), Power Plants (Coal, Solar, Wind, Fusion), Water
  Pumps, and three Megastructures (Megacorp Tower, Neon Arcology, Rodman Plaza).
- **Full city simulation** running on a monthly tick: power & water flood-fill
  networks, service coverage radii (police, fire, health, education),
  pollution diffusion, crime, land value, and zone density growth (levels 0-3).
- **Demand-driven RCI economy** balancing residential, commercial, and
  industrial pressure against tax rate, services, and pollution. Live RCI bars
  show your city's mood.
- **Adjustable tax rate** (0-20%) plus **ordinances** like Neon Curfew, Air
  Filtration Mandate, and Cyberware Subsidy.
- **Disasters**: Cyber Attack, Acid Rain, Neon Riot, Structure Fire, Power
  Surge, Drone Swarm, and Quake — each with its own visual effect.
- **HUD**: animated topbar with date / credits / population / approval, RCI
  bars, news ticker, alert toasts, mini-map with 6 visualization modes
  (terrain, zones, power, crime, pollution, land value), and a per-tile info
  panel.
- **Save / load** via `localStorage` with autosave every 30 seconds, plus
  JSON export and import for sharing or backing up cities.
- **Cyberpunk aesthetic**: scanlines, vignette, glitch on disaster, neon-lit
  windows pulsing on tall buildings, glow trim, and a custom WebAudio synth
  for SFX (no external files).
- **Mobile-first input**: tap to apply tools, two-finger drag to pan, pinch to
  zoom, double-tap to enter pan mode. Toolbar collapses to a horizontal
  scrolling drawer on small screens.
- **Three difficulty presets** (Easy ₡40k, Normal ₡20k, Hard ₡10k) and seeded
  map generation so you can replay the same Neo-Rodman with friends.
- **Starter city** — every new game starts with a working road grid, a wind
  farm, water pump, holopark, and R/C/I zones already in place (free of
  charge). Uncheck "Starter city" in *New City…* for a blank slate.
- **Day / night cycle** — sky tint, building windows light up at night, neon
  ground halos under tall residences in the dark.
- **Animated traffic** — orange/yellow car dots stream along roads,
  density-scaled to adjacent built-up zones.
- **Building variety** — every grown zone tile has its own deterministic
  height, footprint, and window pattern so neighbourhoods don't look like a
  copy/paste job.
- **Floating in-canvas tile labels** show what you're hovering over and the
  cost of the current tool.
- **Drag-line painting** — fast drags don't skip tiles thanks to Bresenham
  interpolation, even at maximum drag speed.
- **Loans** — borrow up to ₡20k from the megacorps, repaid over 30 months
  at 20% interest.
- **Achievements** — 15 milestones from "Boot Sequence" (100 pop) to
  "Megacity" (10k pop), Plaza Founder, Net Zero (clean megacity), and more.
- **Onboarding tutorial** auto-opens for new mayors, accessible any time
  from the menu.
- **Ambient cyberpunk music** — synthesized drone pad + arpeggio loop with
  a sweeping low-pass filter. Toggle from the menu.
- **No build step, no dependencies** — pure HTML, CSS, and vanilla JS. Open
  the file, play the game.

## Controls

### Desktop
| Action            | Input                                       |
|-------------------|---------------------------------------------|
| Apply tool        | Click / drag                                |
| Pan camera        | Right-click drag, or hold Shift + drag      |
| Zoom              | Mouse wheel                                 |
| Pause / play      | `Space`                                     |
| Quick save        | `Ctrl/Cmd + S`                              |
| Demolish          | `B`                                         |
| Road / Highway    | `R` / `H`                                   |
| Power / Water     | `P` / `W`                                   |
| R / C / I zones   | `1` / `2` / `3`                             |
| Police / Fire / Hospital / School / Park | `4` / `5` / `6` / `7` / `8` |
| Solar / Wind      | `9` / `0`                                   |
| Move camera       | Arrow keys                                  |
| Cancel tool       | `Esc`                                       |

### Mobile
| Action       | Input                                    |
|--------------|------------------------------------------|
| Apply tool   | Tap / drag                               |
| Pan camera   | Two-finger drag, or double-tap-and-drag  |
| Zoom         | Pinch                                    |
| Menu         | Hamburger button (top-right)             |

## Project layout

```
.
├── index.html         # Entry. Lays out boot screen, HUD, panels, canvases.
├── css/style.css      # All theming and responsive layout.
├── js/
│   ├── utils.js       # RNG, noise, math helpers, formatting.
│   ├── audio.js       # WebAudio synth SFX.
│   ├── buildings.js   # Building definitions and tool→building map.
│   ├── grid.js        # Tile grid + terrain generator + place/demolish.
│   ├── camera.js      # Pan/zoom + isometric ↔ screen projection.
│   ├── renderer.js    # 2D canvas isometric renderer.
│   ├── minimap.js     # Mini-map with terrain/zones/power/crime/etc. modes.
│   ├── input.js       # Mouse + touch + keyboard handlers.
│   ├── tools.js       # Toolbar logic, validates and applies tool actions.
│   ├── simulation.js  # Monthly tick: networks, fields, growth, payday.
│   ├── disasters.js   # Random events.
│   ├── save.js        # localStorage save/load + JSON import/export.
│   ├── ui.js          # HUD wiring, panels, modals, alerts, ticker.
│   ├── game.js        # Top-level game state and tick scheduler.
│   └── main.js        # Boot screen + RAF loop.
├── docs/
│   ├── GAMEPLAY.md    # Detailed gameplay guide.
│   └── ARCHITECTURE.md# How the code fits together.
└── scripts/
    └── smoketest.js   # Headless simulation test (run with `node`).
```

## How the simulation works (overview)

1. **Networks** (`recomputeNetworks`) — flood-fill BFS from each power plant
   over carriers (power lines, roads, buildings, built-up zones). Adjacent
   zones get `poweredBy = true`. Same again for water through pipes.
2. **Fields** (`recomputeFields`) — for each service building, spread its
   coverage value over a Chebyshev radius. Pollution diffuses, then crime is
   computed from low police + low value + high pollution; land value combines
   amenity coverage minus pollution and crime.
3. **Zone growth** (`growZones`) — each zone tile computes a fitness score
   from land value, utilities, services, pollution, crime, tax, and overall
   RCI demand, then probabilistically grows or decays toward a target density.
4. **Demand** — recomputed from population vs. jobs balance, modulated by tax
   rate. Drives the RCI bars.
5. **Payday** — taxes from population/jobs minus building/road maintenance.
6. **Disasters** — small chance per tick once population > 200.

See `docs/ARCHITECTURE.md` for the full technical walkthrough.

## Smoke test

```bash
node scripts/smoketest.js
```

Boots the game in a stubbed DOM, builds a tiny city (wind farm + water pump +
roads + zones), runs 24 simulated months, and verifies population grew and
save/load round-trips. Useful for catching regressions in the simulation.

## Tips for a profitable Neo-Rodman

- Build small at first. A Wind Farm + Water Pump + 5×5 grid of roads + a few
  R/C/I tiles will get you past your first year without going broke.
- Every zone tile must touch a road. Power and water flow through roads,
  power lines, water pipes, buildings, and grown-up zones — not through empty
  ground.
- Industrial pollutes. Put it downwind (south-east) of residential.
- Service buildings have coverage radii. Overlap them slightly. A Holopark
  every few blocks is the cheapest land-value boost.
- Set tax rate 7-9% early on. Bump to 11-12% once you have 1000+ population
  and you'll have ₡ to spare for an Arcology.
- A Rodman Plaza is unique and gives a city-wide morale and land-value boost.
  Save up: it costs ₡8000.

## License

MIT. Build something the megacorps can't ignore.

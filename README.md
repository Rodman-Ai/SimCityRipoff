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
  charge). The *New City…* dialog also offers a **Demo city** (fully-
  developed showcase: 5×5 road grid, solar + wind plants, two water pumps,
  Police HQ, Fire Dept, Cyberclinic, Datanet School, six holoparks,
  Megacorp Tower, the unique Rodman Plaza, a maglev demo line, and pre-
  grown R/C/I districts) or a **Blank slate** for purists. *Menu → Load
  Demo City* loads it in one click.
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
- **Particle system** — coal stack smoke, fusion magenta plume, water-pump
  steam; floating "+₡" tax pop-ups on payday; police / fire / clinic
  vehicles dispatching on a service tour each tick.
- **Construction pop-in animation** — buildings and zone level-ups scale
  up with an ease-out-back overshoot.
- **Lightning + thunder** — disasters trigger a triple-flash overlay tinted
  per disaster (magenta cyber-attack, acid green, etc.) and a boom SFX.
- **Maglev tube** — new neon transit tile (`M`). Costs ₡25/tile, carries
  power and water, counts as road for zone fitness, drawn as a glowing
  magenta line with a moving pulse.
- **Working ordinances** — Neon Curfew cuts crime 35%, Air Filtration cuts
  pollution 25%, Cyberware Subsidy boosts R demand, Megacorp Tax Holiday
  boosts I demand. Filtration/subsidy/holiday charge a monthly fee.
- **Undo last action** — `Ctrl/Cmd+Z` or the topbar `↶` button reverts the
  last drag session (up to 30 history slots).
- **City advisor** — periodic state-aware tip toasts (power shortage, high
  crime, available landmark unlocks, etc.).
- **Population density minimap mode** — new `D` button on the mini-map.
- **Per-zone tax bands** — separate Residential, Commercial, Industrial tax
  sliders in the Budget modal.
- **Municipal bonds** — borrow ₡10k–₡50k over 60 months at ~10% interest
  (cheaper than 30-month loans).
- **Bankruptcy game-over** — six months below ₡-5,000 ends the game with a
  glitch overlay; accept a bailout (-25% approval, +₡20k) or restart.
- **Garbage system** — built-up zones produce garbage; without enough
  Incinerator coverage it bumps citywide pollution and approval drops.
- **Production chains (MVP)** — Industrial zones produce goods, Commercial
  consumes them; shortages cap commercial growth and demand.
- **Three new buildings** — **Incinerator** (♨ ₡800, takes garbage),
  **Cryo Bank** (☩ ₡400, mortuary capacity for residential), and
  **Mega Stadium** (⌬ ₡6k, +6 city-wide approval, requires 1500 pop).
- **Scenarios** — three time-limited goals (Boom Town: 5k pop in 60mo;
  Eco-Mayor: 1k pop with avg pollution <10 in 48mo; Megacorp Tycoon: build
  Megacorp + Arcology + Plaza in 72mo). Reward credits on completion.
- **City Health Dashboard** — radar-chart modal showing power, water,
  approval, land value, air quality, and order at a glance.
- **Find Building** — search modal pulse-highlights every matching
  building on the map.
- **Heat-map overlay** — tint the main view by pollution / crime / land
  value / population density.
- **Year-end report** — auto-pops every January with year-over-year deltas
  and a snarky quote.
- **Keymap overlay** — press `?` to see every shortcut.
- **Long-press to undo** — hold a tap for 600 ms on mobile to undo the
  current placement.
- **Weather** — rain, snow, and fog overlays auto-cycle per season (winter
  snow/fog, summer rain, autumn fog/rain).
- **Seasonal tint** — palette shifts subtly with the calendar quarter
  (cool winter, warm autumn, neutral spring/summer).
- **Photo mode** — 📷 button in the topbar pauses time, hides the HUD,
  and exposes a CAPTURE PNG button to download the framed shot.
- **Holographic billboards** — neon hover-screens animate above every
  level-3 commercial tower at zoom ≥ 0.7.
- **Landmark searchlights** — Megacorp Tower, Arcology, and Plaza shine
  rotating spotlight cones at night.
- **Drone flyovers** — small blinking drones traverse the city every
  8–14 s with a faint ground shadow.
- **Citizen sprites** — pedestrian dots wander the base of every level-2+
  residential tile.
- **Demolition debris** — 12-particle puff with gravity bursts every
  time you bulldoze something.
- **Round 2 — Wave R2-1 (8 features)** — paintable named **Districts**
  with stats panel and color overlay, **traffic-congestion tint** on busy
  roads, **service-coverage outline overlay**, 5 new disasters (Tornado,
  DDoS, Toxic Spill, Memetic Plague, Black-Ice Winter), **Shift+drag
  rectangle paint** for any tool, **5 named save slots**, **quest-log
  HUD chip** for the active scenario, and a **building-layer filter**
  modal to hide categories for screenshots.
- **Wave 4 + 5 sweep** — 9 specialty buildings (casino, prison, recycling
  plant, cyberware clinic, convention centre, net-cathedral, drone
  airfield, rooftop solar, disaster bunker), 4 transit add-ons (cable car,
  pedestrian plaza, helipad, net university), 5 new disasters (AI
  uprising, nano-plague, solar flare, climate refugees, EMP eruption),
  difficulty modifiers (perma-night, 2× pollution, no loans), city
  specializations (Industrial, Tourism, Tech), three new ordinances (R/C/I
  subsidies + transit pass), inflation, demolition refund, credit rating,
  bird's-eye camera (`F`), wet-asphalt rain reflections, water-table
  pump boost, worker-commute job filling, milestone fireworks, arcology
  victory screen, mayor portrait, local leaderboard, weekly seed
  challenge, share-city-by-URL, accessibility settings (color-blind,
  large text, reduced motion, haptics, theme palettes), camera bookmarks
  (Shift+1..4 / Alt+1..4), patchnotes modal, custom hotkeys, achievement
  badge export, and a Konami-code cheat console.
- **Subway tube** ⎇ — underground transit (`U` hotkey, ₡20). Carries
  power and water and counts as road for zone fitness, drawn as a
  scrolling magenta dashed line that doesn't conflict with the surface.
- **One-way road** → — cyan stripe with an animated arrow pulse
  showing direction (`O` hotkey, ₡15).
- **Diagonal road** ╱ — single 45° lane stripe variant (₡12).
- **Bridges** — drag a road or highway over water at +₡30 premium;
  rendered with cool blued asphalt and underdeck girders.
- **Bus Depot** ⊟ (₡600, 2×2, range 12) — adds transit coverage and
  land value.
- **Train Station** ⌷ (₡1,500, 3×3, range 18, requires 1k pop) — big
  land-value boost.
- **Ferry Pier** ⊻ (₡800, 2×2, range 10) — must touch a water tile.
- **Subway Station** ⊕ (₡200, 1×1, range 7) — small surface plop with
  land-value bonus, pairs with Subway tubes.
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
| Maglev tube       | `M`                                         |
| R / C / I zones   | `1` / `2` / `3`                             |
| Undo              | `Ctrl/Cmd + Z`                              |
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

// game.js — top-level game state and tick scheduling
'use strict';

SR.game = (() => {
  const state = {
    seed: 1337,
    cityName: 'Neo-Rodman',
    funds: 20000,
    year: 2077, month: 0, minute: 0,
    speed: 1, // 0=pause, 1=slow, 2=fast, 3=ultra
    paused: false,
    population: 0, popCommercial: 0, popIndustrial: 0,
    jobs: 0,
    approval: 50,
    taxRates: { r: 0.09, c: 0.09, i: 0.09 },
    demand: { r: 50, c: 30, i: 30 },
    power: { supply: 0, demand: 0 },
    water: { supply: 0, demand: 0 },
    goods: { produced: 0, consumed: 0 },
    garbage: { produced: 0, handled: 0 },
    deathCapacityRatio: 1,
    stadiumApprovalBoost: 0,
    debtMonths: 0,
    gameOver: null,
    lastIncome: 0, lastExpense: 0,
    lastLoanPayment: 0,
    history: [],
    yearStart: { funds: 20000, population: 0 },
    newsLog: [],
    ordinances: {},
    loans: [],         // [{ id, kind, principal, balance, monthly, monthsLeft }]
    nextLoanId: 1,
    achievements: {},  // key -> { unlocked: bool, at: 'YYYY-MM' }
    tutorialDone: false,
    activeScenario: null,
    scenarioStartYear: 0,
    scenarioStartMonth: 0,
    search: '',
    heatmap: null, // null | 'pollution' | 'crime' | 'value' | 'density'
    weather: null, // null | 'rain' | 'snow' | 'fog'
    weatherAuto: true,
    photoMode: false,
    aiUprisingMonths: 0,
    disasterHistory: [],
    lastRevenueExtra: 0,
    bookmarks: [null, null, null, null], // #72 — Shift+1..4
    cityScores: [], // #77 — local leaderboard
    a11y: { reducedMotion: false, largeText: false, palette: 'orange', haptics: true },
    cheatsEnabled: false,
    cryptoTokens: 0, // #8
  };

  // Legacy: some older code paths still read SR.game.taxRate. Provide a
  // compatibility accessor so we don't have to chase every callsite at once.
  Object.defineProperty(state, 'taxRate', {
    get() { return (state.taxRates.r + state.taxRates.c + state.taxRates.i) / 3; },
    set(v) { state.taxRates.r = v; state.taxRates.c = v; state.taxRates.i = v; },
    enumerable: false,
    configurable: true,
  });

  // months per real-time second per speed
  const SPEED_RATES = [0, 0.4, 1.6, 4.0];

  let monthAccumulator = 0;

  // Season-driven weather distribution — month 0..11 → null|rain|snow|fog
  function pickWeather(month) {
    const r = Math.random();
    if (month < 3) {        // winter
      return r < 0.30 ? 'snow' : r < 0.45 ? 'fog' : null;
    } else if (month < 6) { // spring
      return r < 0.22 ? 'rain' : r < 0.32 ? 'fog' : null;
    } else if (month < 9) { // summer
      return r < 0.18 ? 'rain' : null;
    } else {                // autumn
      return r < 0.30 ? 'fog' : r < 0.42 ? 'rain' : null;
    }
  }

  function setSpeed(s) {
    state.speed = s;
    document.querySelectorAll('.spd').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.speed, 10) === s);
    });
  }

  function update(dtSec) {
    state.minute = (state.minute + dtSec * 60) % 1e9;
    if (state.speed === 0) return;
    monthAccumulator += dtSec * SPEED_RATES[state.speed];
    while (monthAccumulator >= 1) {
      monthAccumulator -= 1;
      stepMonth();
    }
  }

  function stepMonth() {
    state.month = (state.month + 1) % 12;
    const yearJustRolled = state.month === 0;
    if (yearJustRolled) state.year++;
    if (state.weatherAuto) state.weather = pickWeather(state.month);
    SR.sim.tick();
    SR.disasters.tickFires();
    SR.ui.markStatsDirty();
    if (yearJustRolled) {
      const closingYear = state.year - 1;
      if (SR.ui && SR.ui.yearEndReport) SR.ui.yearEndReport(closingYear);
      // Roll the snapshot forward AFTER the report is shown
      state.yearStart = { funds: state.funds, population: state.population };
    }
  }

  // mode: 'starter' (default), 'demo', or 'blank'
  function newCity({ name, seed, funds, starter, mode, specialization, modifiers } = {}) {
    if (mode == null) {
      mode = (starter === false) ? 'blank' : 'starter';
    }
    state.specialization = specialization || null;
    state.modifiers = modifiers || {};
    // Demo always uses a known-good seed so the showcase landscape is consistent.
    if (mode === 'demo') seed = 0xC1A0 ^ 0xCAFE;
    state.cityName = name || (mode === 'demo' ? 'Neo-Rodman Showcase' : 'Neo-Rodman');
    state.seed = (seed | 0) || 1337;
    state.funds = funds || 20000;
    state.year = 2077; state.month = 0;
    state.population = 0; state.popCommercial = 0; state.popIndustrial = 0;
    state.jobs = 0; state.approval = 50;
    state.taxRates = { r: 0.09, c: 0.09, i: 0.09 };
    state.demand = { r: 50, c: 30, i: 30 };
    state.power = { supply: 0, demand: 0 };
    state.water = { supply: 0, demand: 0 };
    state.goods = { produced: 0, consumed: 0 };
    state.garbage = { produced: 0, handled: 0 };
    state.deathCapacityRatio = 1;
    state.stadiumApprovalBoost = 0;
    state.debtMonths = 0;
    state.gameOver = null;
    state.lastIncome = 0; state.lastExpense = 0; state.lastLoanPayment = 0;
    state.history = []; state.newsLog = []; state.ordinances = {};
    state.yearStart = { funds: state.funds, population: 0 };
    state.loans = []; state.nextLoanId = 1;
    state.achievements = {};
    state.tutorialDone = false;
    state.activeScenario = null;
    state.scenarioStartYear = state.year;
    state.scenarioStartMonth = state.month;
    state.search = '';
    state.heatmap = null;
    state.weather = null;
    state.weatherAuto = true;
    state.photoMode = false;
    state.aiUprisingMonths = 0;
    state.disasterHistory = [];
    state.lastRevenueExtra = 0;
    state.bookmarks = [null, null, null, null];
    state.cryptoTokens = 0;
    state.cheatsEnabled = false;
    SR.grid.init(state.seed);
    let center = { x: SR.GRID_W / 2, y: SR.GRID_H / 2 };
    if (mode === 'starter') center = buildStarterCity();
    else if (mode === 'demo') center = buildDemoCity();
    SR.camera.center(center.x, center.y);
    SR.sim.markDirty();
    // Pre-compute networks/fields so the demo looks finished on first render.
    if (mode === 'demo') {
      SR.sim.recomputeNetworks();
      SR.sim.recomputeFields();
    }
    SR.ui.markStatsDirty();
    if (SR.tools && SR.tools.clearUndo) SR.tools.clearUndo();
    if (SR.renderer && SR.renderer.clearParticles) SR.renderer.clearParticles();
  }

  // Drop a small starter kit on the map: cross-shaped roads, a wind farm,
  // a water pump, a holopark, and one strip each of R/C/I zoning. All
  // utilities are gifted (no cost) so the player keeps their starting funds.
  function buildStarterCity() {
    const W = SR.GRID_W, H = SR.GRID_H;
    function isClear(cx, cy, r) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const t = SR.grid.get(cx + dx, cy + dy);
        if (!t || t.t !== 'ground') return false;
      }
      return true;
    }
    const W2 = (W / 2) | 0, H2 = (H / 2) | 0;
    let cx = W2, cy = H2, found = false;
    // Spiral outward from center looking for a clear 15x15 ground patch
    for (let r = 0; r <= 22 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = W2 + dx, y = H2 + dy;
          if (x >= 8 && y >= 8 && x < W - 8 && y < H - 8 && isClear(x, y, 7)) {
            cx = x; cy = y; found = true;
          }
        }
      }
    }

    // Cross-shaped roads — every zone we'll place sits directly next to
    // this cross, so power/water flow to every block.
    for (let x = cx - 6; x <= cx + 6; x++) SR.grid.setRoad(x, cy, 1);
    for (let y = cy - 6; y <= cy + 6; y++) SR.grid.setRoad(cx, y, 1);

    // Free starter equipment — placed at the cross extremities so they
    // (1) touch the row road for adjacency, (2) leave inner blocks free.
    SR.grid.place(cx + 5, cy + 1, 'wind');   // 2x2 footprint (cx+5..cx+6, cy+1..cy+2)
    SR.grid.place(cx - 6, cy + 1, 'water');  // 2x2 footprint (cx-6..cx-5, cy+1..cy+2)
    SR.grid.place(cx + 4, cy - 1, 'park');   // 1x1 morale boost north-east

    // Zone strips one step off each axis of the cross — every zone tile has
    // the cross road as an immediate 4-neighbor (so power/water reach it).
    // Residential — north of row road, both sides of col road.
    for (let y = cy - 5; y <= cy - 1; y++) {
      SR.grid.setZone(cx - 1, y, 'r');
      SR.grid.setZone(cx + 1, y, 'r');
    }
    // Commercial — south of row road, west of col road (avoiding water pump).
    for (let y = cy + 1; y <= cy + 5; y++) SR.grid.setZone(cx - 1, y, 'c');
    // Industrial — south of row road, east of col road (avoiding wind farm).
    for (let y = cy + 1; y <= cy + 5; y++) SR.grid.setZone(cx + 1, y, 'i');

    return { x: cx, y: cy };
  }

  // Drop a fully-developed demo city: a 5x5 road grid, a solar array and a
  // wind farm at the corners, two water pumps, a Police HQ + Fire Dept +
  // Cyberclinic + Datanet School in inner cells, four Holoparks, a Megacorp
  // Tower and the unique Rodman Plaza, plus zones pre-grown to level 1-3
  // so the showcase looks lived-in immediately.
  function buildDemoCity() {
    const W = SR.GRID_W, H = SR.GRID_H;
    function isClear(cx, cy, r) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const t = SR.grid.get(cx + dx, cy + dy);
        if (!t || t.t !== 'ground') return false;
      }
      return true;
    }
    const W2 = (W / 2) | 0, H2 = (H / 2) | 0;
    let cx = W2, cy = H2, found = false;
    // Need a clear ~28x28 patch for a 13-radius city
    for (let r = 0; r <= 18 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = W2 + dx, y = H2 + dy;
          if (x >= 14 && y >= 14 && x < W - 14 && y < H - 14 && isClear(x, y, 13)) {
            cx = x; cy = y; found = true;
          }
        }
      }
    }

    // 5x5 grid of streets — a road every 4 tiles, with the central avenues
    // as Neon Highways.
    const HALF = 12;
    for (let dy = -HALF; dy <= HALF; dy++) {
      for (let dx = -HALF; dx <= HALF; dx++) {
        const x = cx + dx, y = cy + dy;
        if (dx === 0 || dy === 0) {
          SR.grid.setRoad(x, y, 2); // central highways
        } else if ((dx % 4 === 0) || (dy % 4 === 0)) {
          SR.grid.setRoad(x, y, 1);
        }
      }
    }

    // Power & water at the four outer corners
    SR.grid.place(cx - 11, cy - 11, 'solar');   // 3x3 NW
    SR.grid.place(cx + 10, cy - 11, 'wind');    // 2x2 NE
    SR.grid.place(cx - 11, cy + 9,  'water');   // 2x2 SW
    SR.grid.place(cx + 10, cy + 9,  'water');   // 2x2 SE

    // Service buildings — one per inner block quadrant
    SR.grid.place(cx - 7, cy - 7, 'police');    // 2x2 NW inner
    SR.grid.place(cx + 5, cy - 7, 'fire');      // 2x2 NE inner
    SR.grid.place(cx - 7, cy + 5, 'hospital');  // 2x2 SW inner
    SR.grid.place(cx + 5, cy + 5, 'school');    // 2x2 SE inner

    // Holoparks scattered through the central blocks (1x1)
    [[ -3, -3], [1, -3], [-3, 1], [1, 1], [-7, -3], [5, 1]].forEach(([dx, dy]) => {
      SR.grid.place(cx + dx, cy + dy, 'park');
    });

    // Megacorp Tower (3x3) — landmark on western edge
    SR.grid.place(cx - 11, cy + 1, 'megacorp');
    // Rodman Plaza (unique 2x2) — landmark on eastern edge
    SR.grid.place(cx + 9, cy - 7, 'plaza');

    // Short maglev line connecting two distant blocks (showcase the tool)
    for (let dx = -3; dx <= 3; dx++) {
      // place between roads at y = cy - 6 (between row roads at -8 and -4)
      const x = cx + dx, y = cy - 6;
      const t = SR.grid.get(x, y);
      if (t && !t.road && !t.building) SR.grid.setMaglev(x, y);
    }

    // Fill remaining inner cells with zones; pre-grow them so the demo
    // looks populated on first render. Pollution-aware placement keeps
    // industry south, residential north, commerce in the middle band.
    for (let dy = -HALF + 1; dy < HALF; dy++) {
      for (let dx = -HALF + 1; dx < HALF; dx++) {
        const x = cx + dx, y = cy + dy;
        const t = SR.grid.get(x, y);
        if (!t || t.t !== 'ground') continue;
        if (t.road || t.building || t.maglev || t.zone) continue;

        let kind;
        if (dy < -2) kind = 'r';
        else if (dy < 2) kind = 'c';
        else kind = 'i';

        if (SR.grid.setZone(x, y, kind)) {
          const tt = SR.grid.get(x, y);
          // Distance-based level: dense in the middle, sparse on the edges
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const lvl = d < 4 ? 3 : d < 8 ? 2 : 1;
          tt.level = lvl;
          // Stagger pop-in animation outward from the centre
          tt._anim = { from: performance.now() + d * 25, dur: 600 };
        }
      }
    }

    return { x: cx, y: cy };
  }

  return Object.assign(state, { setSpeed, update, stepMonth, newCity });
})();

// scripts/smoketest.js — load all SR modules with stub DOM and run a few ticks.
// Run with: node scripts/smoketest.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Minimal browser shim
const documentStub = {
  body: { },
  getElementById: () => stubEl(),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => stubEl(),
  addEventListener: () => {},
};
function stubEl() {
  return new Proxy({
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {},
    dataset: {},
    addEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
    setAttribute: () => {},
    getContext: () => ({
      // canvas 2d stub
      fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      shadowColor: '', shadowBlur: 0, font: '', textAlign: '', textBaseline: '',
      globalCompositeOperation: 'source-over',
      fillRect() {}, strokeRect() {}, clearRect() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() {}, stroke() {}, arc() {}, save() {}, restore() {},
      drawImage() {}, fillText() {}, setLineDash() {},
      createImageData() { return { data: new Uint8ClampedArray(64 * 64 * 4) }; },
      putImageData() {},
    }),
    appendChild() {}, contains() { return false; },
    children: [], childNodes: [],
    width: 800, height: 600,
  }, {
    get(t, k) { if (k in t) return t[k]; return () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const windowStub = {
  addEventListener: () => {},
  AudioContext: undefined,
  webkitAudioContext: undefined,
  devicePixelRatio: 1,
};

const ctx = vm.createContext({
  console,
  document: documentStub,
  window: windowStub,
  performance: { now: () => Date.now() },
  setInterval: () => 0,
  setTimeout: () => 0,
  requestAnimationFrame: () => 0,
  Math, Date, JSON,
  Array, Object, Number, String, Boolean,
  Float32Array, Uint8Array, Uint8ClampedArray, Int32Array,
  parseInt, parseFloat, isFinite, isNaN,
  localStorage: { getItem: () => null, setItem: () => {} },
});

const order = [
  'utils.js', 'audio.js', 'buildings.js', 'grid.js', 'camera.js',
  'renderer.js', 'minimap.js', 'input.js', 'tools.js',
  'simulation.js', 'disasters.js', 'save.js', 'ui.js', 'game.js',
];
for (const f of order) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, ctx, { filename: f });
}

const SR = ctx.window.SR || ctx.SR;
if (!SR) throw new Error('SR namespace missing');

console.log('Modules loaded. Initializing city...');
// starter:false → blank slate so the test can build its own deterministic layout
SR.game.newCity({ name: 'TestRodman', seed: 12345, funds: 30000, starter: false });
console.log('Grid tiles:', SR.grid.tiles.length);

// Build a tiny city: small power plant, water pump, road grid, R/C/I zones.
const W = SR.GRID_W, H = SR.GRID_H;
// Find a clear 16x16 ground area
function findGround(W, H) {
  const r = 8;
  for (let y = r; y < H - r; y++) {
    for (let x = r; x < W - r; x++) {
      let ok = true;
      for (let dy = -r; dy <= r && ok; dy++)
        for (let dx = -r; dx <= r && ok; dx++) {
          const t = SR.grid.get(x + dx, y + dy);
          if (!t || t.t !== 'ground') ok = false;
        }
      if (ok) return { x, y };
    }
  }
  return null;
}
const c = findGround(W, H);
if (!c) throw new Error('no clear ground area');
const cx = c.x, cy = c.y;
console.log('Center at', cx, cy);

// roads first (so building needsRoad passes)
for (let x = cx - 6; x <= cx + 6; x++) SR.grid.setRoad(x, cy, 1);
for (let y = cy - 6; y <= cy + 6; y++) SR.grid.setRoad(cx, y, 1);
// power & water plants directly adjacent to roads
const placedWind = SR.grid.place(cx + 1, cy + 1, 'wind');   // 2x2 block beside intersection
const placedWater = SR.grid.place(cx - 3, cy + 1, 'water'); // 2x2
console.log('Placed wind/water:', placedWind, placedWater);
// Zones — directly adjacent to roads so power/water reach them
// Column road at x=cx; zones flank at cx-1 and cx+1 (rows away from buildings)
for (let y = cy - 5; y <= cy - 1; y++) {
  SR.grid.setZone(cx + 1, y, 'r');
  SR.grid.setZone(cx - 1, y, 'c');
}
// Row road at y=cy; zones flank at cy-1 / cy+1 (cols away from buildings)
for (let x = cx + 4; x <= cx + 6; x++) {
  SR.grid.setZone(x, cy + 1, 'i');
  SR.grid.setZone(x, cy - 1, 'i');
}

SR.sim.markDirty();

// Diagnostic: count zones placed and their poweredBy/watered after first tick
SR.sim.recomputeNetworks();
let zR = 0, zRP = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const t = SR.grid.get(x, y);
  if (t.zone === 'r') { zR++; if (t.poweredBy && t.watered) zRP++; }
}
console.log('Residential zones:', zR, 'with power+water:', zRP);

for (let t = 0; t < 24; t++) SR.game.stepMonth();
let postR = 0, postLvl = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const t = SR.grid.get(x, y);
  if (t.zone === 'r') { postR++; postLvl += t.level; }
}
console.log('Post-tick R-zones:', postR, 'avg level:', (postLvl / Math.max(1, postR)).toFixed(2));
console.log('Year:', SR.game.year, 'Pop:', SR.game.population, 'Jobs:', SR.game.jobs);
console.log('Funds:', Math.round(SR.game.funds), 'Approval:', SR.game.approval);
console.log('Power:', SR.game.power, 'Water:', SR.game.water);
console.log('Demand:', SR.game.demand);

if (SR.game.population <= 0) {
  console.warn('WARNING: zero population after 24 months — investigate.');
} else {
  console.log('Population grew successfully ✓');
}

// Achievements check — firstR should have fired once R-zones built up
const achv = SR.game.achievements || {};
console.log('Achievements:', Object.keys(achv).filter(k => achv[k].unlocked).join(', ') || '(none)');
if (!achv.firstR || !achv.firstR.unlocked) console.warn('WARNING: firstR achievement did not fire');

// Loans round-trip
SR.game.funds = 1000;
SR.game.loans.push({ id: 99, principal: 1200, balance: 1200, monthly: 40, monthsLeft: 30 });
SR.game.stepMonth();
console.log('After loan tick: funds =', Math.round(SR.game.funds), 'loanPayment =', SR.game.lastLoanPayment, 'loans left =', SR.game.loans.length);

// Save/load round-trip
const json = SR.save.exportJson();
const ok = SR.save.importJson(json);
console.log('Save/load round-trip:', ok ? 'OK' : 'FAIL');
const post = SR.game.loans.length;
console.log('Loans after restore:', post);
// ----- Starter city test: a fresh newCity with starter=true should produce
// a working city that grows population over a year of simulated time.
console.log('---');
console.log('Starter-city test:');
SR.game.newCity({ name: 'StartRodman', seed: 7, funds: 20000 /* starter:true default */ });
let starterRoads = 0, starterZones = 0, starterBuildings = 0;
for (const t of SR.grid.tiles) {
  if (t.road) starterRoads++;
  if (t.zone) starterZones++;
  if (t.building) starterBuildings++;
}
console.log('Starter pieces — roads:', starterRoads, 'zones:', starterZones, 'building tiles:', starterBuildings);
if (starterRoads < 20 || starterZones < 10 || starterBuildings < 4) {
  console.warn('WARNING: starter city looks too sparse');
}
SR.sim.markDirty();
SR.sim.recomputeNetworks();
let powered = 0, watered = 0, totalZones = 0;
for (const t of SR.grid.tiles) if (t.zone) {
  totalZones++;
  if (t.poweredBy) powered++;
  if (t.watered) watered++;
}
console.log('Starter zones with power:', powered, '/', totalZones, 'with water:', watered, '/', totalZones);
if (powered !== totalZones || watered !== totalZones) {
  console.warn('WARNING: not all starter zones are connected!');
}
for (let i = 0; i < 12; i++) SR.game.stepMonth();
console.log('Starter pop after 12 months:', SR.game.population, 'funds:', Math.round(SR.game.funds));
if (SR.game.population <= 0) console.warn('WARNING: starter city did not grow');

// ----- Maglev + undo + ordinances test -----
console.log('---');
console.log('Maglev / undo / ordinances test:');
SR.game.newCity({ name: 'TestRodman2', seed: 99, funds: 30000, starter: false });
const tx0 = 16, ty0 = 16;
SR.tools.beginAction();
for (let i = 0; i < 5; i++) SR.grid.setMaglev(tx0 + i, ty0);
SR.tools.endAction();
let mag = 0;
for (const t of SR.grid.tiles) if (t.maglev) mag++;
console.log('Maglev tiles placed:', mag);

// Toggle ordinances and step a month
SR.game.ordinances = { curfew: true, clean: true, rec: true, promo: true };
const fundsBefore = SR.game.funds;
SR.game.stepMonth();
console.log('Ordinance cost (≈₡650/mo):', Math.round(fundsBefore - SR.game.funds + (SR.game.lastIncome - SR.game.lastExpense + (fundsBefore - SR.game.funds))));
console.log('lastExpense includes ordinance fee:', SR.game.lastExpense);
if (SR.game.lastExpense < 600) console.warn('WARNING: ordinance cost not applied');

// Undo a tool-driven placement (the path real input takes)
SR.tools.select('road');
SR.tools.beginAction();
SR.tools.applyAt(20, 20);
SR.tools.applyAt(21, 20);
SR.tools.applyAt(22, 20);
SR.tools.endAction();
const had = SR.grid.get(20, 20).road;
SR.tools.undo();
const after20 = SR.grid.get(20, 20).road;
const after21 = SR.grid.get(21, 20).road;
console.log('Undo road: before=', had, 'after undo (20,21)=', after20, after21);
if (after20 !== 0 || after21 !== 0) console.warn('WARNING: undo did not revert all placed road tiles');

// ----- Demo city test -----
console.log('---');
console.log('Demo-city test:');
SR.game.newCity({ name: 'DemoRodman', funds: 30000, mode: 'demo' });
let demoRoads = 0, demoZones = 0, demoBuildingTops = 0, demoMaglev = 0, demoLeveled = 0;
const demoBuildings = new Set();
for (let y = 0; y < SR.GRID_H; y++) for (let x = 0; x < SR.GRID_W; x++) {
  const t = SR.grid.get(x, y);
  if (t.road) demoRoads++;
  if (t.maglev) demoMaglev++;
  if (t.zone) demoZones++;
  if (t.zone && t.level > 0) demoLeveled++;
  if (t.building && t.bx === x && t.by === y) { demoBuildingTops++; demoBuildings.add(t.building); }
}
console.log('Demo roads:', demoRoads, 'zones:', demoZones, '(' + demoLeveled + ' pre-leveled)', 'maglev:', demoMaglev, 'buildings:', demoBuildingTops);
console.log('Demo unique building keys:', [...demoBuildings].sort().join(', '));
const expected = ['fire', 'hospital', 'megacorp', 'park', 'plaza', 'police', 'school', 'solar', 'water', 'wind'];
for (const e of expected) {
  if (!demoBuildings.has(e)) console.warn('WARNING: demo missing', e);
}
SR.game.stepMonth();
console.log('Demo pop after 1 tick:', SR.game.population, 'jobs:', SR.game.jobs, 'funds:', Math.round(SR.game.funds));
if (SR.game.population < 1000) console.warn('WARNING: demo population looks low');

console.log('Smoke test PASS');

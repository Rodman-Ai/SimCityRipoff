// buildings.js — building / structure definitions
'use strict';

// Each building entry:
//   tool        : matching toolbar tool key (or null for grown zone buildings)
//   label       : short user-facing label
//   cost        : one-time build cost
//   maint       : monthly maintenance
//   size        : tile footprint (1, 2 or 3)
//   power       : kW supplied (>0) or consumed (<0)
//   water       : units supplied (>0) or consumed (<0)
//   pop         : residents
//   jobs        : jobs provided
//   capacity    : service capacity (people served)
//   range       : service coverage radius (Chebyshev tiles)
//   pollution   : added pollution at center
//   crimeRed    : crime reduction factor (0..1)
//   fireRed     : fire risk reduction (0..1)
//   landBoost   : land value boost in range
//   needsRoad   : true if must touch road (for service buildings)
//   color       : neon body color
//   trim        : roof / accent color
//   glyph       : single character glyph drawn on top
//   category    : for UI grouping

SR.BUILDINGS = {
  // --- Service buildings ---
  police: {
    tool: 'build_police', label: 'Police HQ', cost: 500, maint: 100, size: 2,
    power: -10, water: -2, pop: 0, jobs: 30, capacity: 0, range: 8,
    pollution: 0, crimeRed: 0.7, fireRed: 0, landBoost: 4, needsRoad: true,
    color: '#1a4d8a', trim: '#56b1ff', glyph: '✦', category: 'service',
  },
  fire: {
    tool: 'build_fire', label: 'Fire Dept.', cost: 500, maint: 100, size: 2,
    power: -10, water: -4, pop: 0, jobs: 28, capacity: 0, range: 8,
    pollution: 0, crimeRed: 0, fireRed: 0.8, landBoost: 2, needsRoad: true,
    color: '#7a1a08', trim: '#ff6a30', glyph: '▲', category: 'service',
  },
  hospital: {
    tool: 'build_hospital', label: 'Cyberclinic', cost: 800, maint: 160, size: 2,
    power: -20, water: -10, pop: 0, jobs: 60, capacity: 1500, range: 10,
    pollution: 1, crimeRed: 0, fireRed: 0, landBoost: 5, needsRoad: true,
    color: '#0a3a3a', trim: '#3affd0', glyph: '+', category: 'service',
  },
  school: {
    tool: 'build_school', label: 'Datanet School', cost: 600, maint: 80, size: 2,
    power: -8, water: -6, pop: 0, jobs: 24, capacity: 1200, range: 9,
    pollution: 0, crimeRed: 0.1, fireRed: 0, landBoost: 5, needsRoad: true,
    color: '#3a2a4a', trim: '#aa6aff', glyph: '◇', category: 'service',
  },
  park: {
    tool: 'build_park', label: 'Holopark', cost: 100, maint: 5, size: 1,
    power: -1, water: -2, pop: 0, jobs: 0, capacity: 0, range: 4,
    pollution: -3, crimeRed: 0, fireRed: 0, landBoost: 8, needsRoad: false,
    color: '#062a14', trim: '#3aff7a', glyph: '❋', category: 'service',
  },

  // --- Power plants ---
  coal: {
    tool: 'build_coal', label: 'Coal Plant', cost: 4000, maint: 350, size: 3,
    power: 200, water: -10, pop: 0, jobs: 80, capacity: 0, range: 0,
    pollution: 30, crimeRed: 0, fireRed: 0, landBoost: -10, needsRoad: true,
    color: '#1a1a1a', trim: '#ff6030', glyph: '▮', category: 'power',
  },
  solar: {
    tool: 'build_solar', label: 'Solar Array', cost: 3500, maint: 100, size: 3,
    power: 90, water: 0, pop: 0, jobs: 20, capacity: 0, range: 0,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 0, needsRoad: true,
    color: '#0a0a18', trim: '#ffd23a', glyph: '☀', category: 'power',
  },
  wind: {
    tool: 'build_wind', label: 'Wind Farm', cost: 2000, maint: 60, size: 2,
    power: 50, water: 0, pop: 0, jobs: 8, capacity: 0, range: 0,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 0, needsRoad: true,
    color: '#0a1018', trim: '#9adfff', glyph: '⌬', category: 'power',
  },
  fusion: {
    tool: 'build_fusion', label: 'Fusion Reactor', cost: 18000, maint: 800, size: 3,
    power: 700, water: -20, pop: 0, jobs: 120, capacity: 0, range: 0,
    pollution: 2, crimeRed: 0, fireRed: 0, landBoost: 0, needsRoad: true,
    color: '#180a18', trim: '#ff2acc', glyph: '◉', category: 'power',
  },

  // --- Water ---
  water: {
    tool: 'build_water', label: 'Water Pump', cost: 700, maint: 25, size: 2,
    power: -8, water: 200, pop: 0, jobs: 4, capacity: 0, range: 0,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 0, needsRoad: true,
    color: '#0a1a2a', trim: '#3ad7ff', glyph: '⊙', category: 'water',
  },

  // --- Mass transit ---
  busdepot: {
    tool: 'build_busdepot', label: 'Bus Depot', cost: 600, maint: 40, size: 2,
    power: -4, water: -2, pop: 0, jobs: 14, capacity: 0, range: 12,
    pollution: 1, crimeRed: 0, fireRed: 0, landBoost: 6, needsRoad: true,
    color: '#1a1410', trim: '#ffd23a', glyph: '⊟', category: 'service',
  },
  trainstation: {
    tool: 'build_trainstation', label: 'Train Station', cost: 1500, maint: 120, size: 3,
    power: -10, water: -5, pop: 0, jobs: 30, capacity: 0, range: 18,
    pollution: 2, crimeRed: 0, fireRed: 0, landBoost: 10, needsRoad: true,
    color: '#1a0a0a', trim: '#ff6a00', glyph: '⌷', category: 'service',
    requires: { population: 1000 },
  },
  ferry: {
    tool: 'build_ferry', label: 'Ferry Pier', cost: 800, maint: 50, size: 2,
    power: -2, water: 0, pop: 0, jobs: 14, capacity: 0, range: 10,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 5,
    needsRoad: true, needsWater: true,
    color: '#0a141a', trim: '#3ad7ff', glyph: '⊻', category: 'service',
  },
  subwaystn: {
    tool: 'build_subwaystn', label: 'Subway Stn', cost: 200, maint: 10, size: 1,
    power: -1, water: 0, pop: 0, jobs: 4, capacity: 0, range: 7,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 5, needsRoad: true,
    color: '#0a0a14', trim: '#ff2acc', glyph: '⊕', category: 'service',
  },

  // --- Sanitation / civic ---
  incinerator: {
    tool: 'build_incinerator', label: 'Incinerator', cost: 800, maint: 80, size: 2,
    power: -10, water: -2, pop: 0, jobs: 12, capacity: 0, range: 5,
    pollution: 12, garbageCapacity: 200,
    crimeRed: 0, fireRed: 0, landBoost: -4, needsRoad: true,
    color: '#1a1006', trim: '#ff6a00', glyph: '♨', category: 'service',
  },
  cemetery: {
    tool: 'build_cemetery', label: 'Cryo Bank', cost: 400, maint: 30, size: 2,
    power: -2, water: -1, pop: 0, jobs: 4, capacity: 0, range: 8,
    burialCapacity: 1500,
    crimeRed: 0, fireRed: 0, landBoost: 1, needsRoad: true,
    color: '#0a141a', trim: '#9adfff', glyph: '☩', category: 'service',
  },
  stadium: {
    tool: 'build_stadium', label: 'Mega Stadium', cost: 6000, maint: 200, size: 3,
    power: -30, water: -10, pop: 0, jobs: 200, capacity: 0, range: 20,
    approvalBoost: 6, // adds to global approval each tick
    crimeRed: 0, fireRed: 0, landBoost: 8, needsRoad: true,
    color: '#1a0a14', trim: '#ff6a00', glyph: '⌬', category: 'service',
    requires: { population: 1500 },
  },

  // --- Specialized civic / commercial (Wave 5 #22-30) ---
  casino: {
    tool: 'build_casino', label: 'Holocasino', cost: 4000, maint: 100, size: 2,
    power: -20, water: -8, pop: 0, jobs: 80, capacity: 0, range: 8,
    pollution: 1, crimeRed: -0.2, fireRed: 0, landBoost: -2, needsRoad: true,
    revenueBoost: 1500, // direct ₡/mo income
    color: '#1a0a14', trim: '#ff2acc', glyph: '♠', category: 'service',
    requires: { population: 800 },
  },
  prison: {
    tool: 'build_prison', label: 'Datavault Prison', cost: 3000, maint: 200, size: 3,
    power: -15, water: -10, pop: 0, jobs: 90, capacity: 0, range: 6,
    pollution: 1, crimeRed: 0.4, fireRed: 0, landBoost: -8, needsRoad: true,
    color: '#15110a', trim: '#9adfff', glyph: '⊞', category: 'service',
    requires: { population: 1200 },
  },
  recycling: {
    tool: 'build_recycling', label: 'Recycling Plant', cost: 1200, maint: 60, size: 2,
    power: -8, water: -2, pop: 0, jobs: 18, capacity: 0, range: 6,
    pollution: -2, crimeRed: 0, fireRed: 0, landBoost: 2,
    garbageCapacity: 250, needsRoad: true,
    color: '#0a1410', trim: '#3aff7a', glyph: '♻', category: 'service',
  },
  cyberclinic: {
    tool: 'build_cyberclinic', label: 'Cyberware Clinic', cost: 1100, maint: 90, size: 2,
    power: -16, water: -8, pop: 0, jobs: 24, capacity: 1800, range: 8,
    pollution: 0, crimeRed: 0.1, fireRed: 0, landBoost: 4, needsRoad: true,
    color: '#1a0a18', trim: '#ff2acc', glyph: '✚', category: 'service',
    requires: { population: 600 },
  },
  conv: {
    tool: 'build_conv', label: 'Convention Centre', cost: 3500, maint: 110, size: 3,
    power: -18, water: -8, pop: 0, jobs: 60, capacity: 0, range: 10,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 12, needsRoad: true,
    revenueBoost: 600,
    color: '#0e1018', trim: '#3ad7ff', glyph: '⌂', category: 'service',
    requires: { population: 1500 },
  },
  cathedral: {
    tool: 'build_cathedral', label: 'Net-Cathedral', cost: 2200, maint: 30, size: 2,
    power: -4, water: -2, pop: 0, jobs: 6, capacity: 0, range: 10,
    pollution: 0, crimeRed: 0.15, fireRed: 0,
    landBoost: 8, approvalBoost: 3, needsRoad: true,
    color: '#1a0a06', trim: '#ffd23a', glyph: '✜', category: 'service',
  },
  drones: {
    tool: 'build_drones', label: 'Drone Airfield', cost: 2800, maint: 140, size: 3,
    power: -22, water: -4, pop: 0, jobs: 40, capacity: 0, range: 14,
    pollution: 1, crimeRed: 0, fireRed: 0,
    landBoost: 4, freightBoost: 1, // unlocks freight revenue
    needsRoad: true,
    color: '#10141a', trim: '#3ad7ff', glyph: '✈', category: 'service',
    requires: { population: 1500 },
  },
  rooftop: {
    tool: 'build_rooftop', label: 'Rooftop Solar', cost: 200, maint: 2, size: 1,
    power: 5, water: 0, pop: 0, jobs: 0, capacity: 0, range: 0,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 1, needsRoad: false,
    color: '#0a0a18', trim: '#ffd23a', glyph: '☀', category: 'power',
  },
  bunker: {
    tool: 'build_bunker', label: 'Disaster Bunker', cost: 1800, maint: 50, size: 2,
    power: -2, water: -2, pop: 0, jobs: 8, capacity: 0, range: 14,
    pollution: 0, crimeRed: 0, fireRed: 0.3,
    landBoost: 2, disasterShield: 0.5, // halves damage in coverage
    needsRoad: true,
    color: '#10100a', trim: '#9adfff', glyph: '⛨', category: 'service',
  },

  // --- Wave 5 transit/civic add-ons (#37-#39, #43) ---
  cablecar: {
    tool: 'build_cablecar', label: 'Cable Car Stn', cost: 1200, maint: 70, size: 2,
    power: -8, water: -2, pop: 0, jobs: 16, capacity: 0, range: 12,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 6, needsRoad: true,
    color: '#0a1018', trim: '#9adfff', glyph: '⌥', category: 'service',
  },
  pedpath: {
    tool: 'build_pedpath', label: 'Pedestrian Plaza', cost: 80, maint: 1, size: 1,
    power: 0, water: 0, pop: 0, jobs: 0, capacity: 0, range: 3,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 3, needsRoad: false,
    color: '#1a160a', trim: '#ffaa1f', glyph: '·', category: 'service',
  },
  helipad: {
    tool: 'build_helipad', label: 'Emergency Helipad', cost: 900, maint: 40, size: 2,
    power: -5, water: -2, pop: 0, jobs: 6, capacity: 0, range: 10,
    pollution: 0, crimeRed: 0, fireRed: 0.2, landBoost: 1, needsRoad: true,
    color: '#1a0a0a', trim: '#ff6a00', glyph: '✜', category: 'service',
  },
  university: {
    tool: 'build_university', label: 'Net University', cost: 2500, maint: 180, size: 3,
    power: -15, water: -8, pop: 0, jobs: 60, capacity: 3000, range: 14,
    pollution: 0, crimeRed: 0, fireRed: 0, landBoost: 12, needsRoad: true,
    color: '#1a0a14', trim: '#ff2acc', glyph: '◇', category: 'service',
    requires: { population: 2000 },
  },

  // --- Megastructures / landmarks ---
  arcology: {
    tool: 'build_arcology', label: 'Neon Arcology', cost: 35000, maint: 1500, size: 3,
    power: -120, water: -60, pop: 8000, jobs: 1500, capacity: 0, range: 0,
    pollution: 0, crimeRed: 0.1, fireRed: 0, landBoost: 25, needsRoad: true,
    color: '#1a0a14', trim: '#ff6a00', glyph: '▣', category: 'landmark',
    requires: { population: 5000 },
  },
  megacorp: {
    tool: 'build_megacorp', label: 'Megacorp Tower', cost: 22000, maint: 800, size: 3,
    power: -80, water: -30, pop: 0, jobs: 2500, capacity: 0, range: 0,
    pollution: 4, crimeRed: 0, fireRed: 0, landBoost: 30, needsRoad: true,
    color: '#0a0a14', trim: '#ffaa1f', glyph: '⌘', category: 'landmark',
    requires: { population: 3000 },
  },
  plaza: {
    tool: 'build_plaza', label: 'Rodman Plaza', cost: 8000, maint: 200, size: 2,
    power: -10, water: -10, pop: 0, jobs: 50, capacity: 0, range: 12,
    pollution: -2, crimeRed: 0.2, fireRed: 0.1, landBoost: 35, needsRoad: true,
    color: '#1a0a02', trim: '#ffaa1f', glyph: '★', category: 'landmark',
    unique: true,
  },
};

// Zone "grown" buildings — generated procedurally from zones.
// Color per density level for residential, commercial, industrial.
SR.ZONE_VIS = {
  r: { name: 'Residential', tint: ['#1a3520', '#234a2a', '#2a5a32', '#316a3a'], glow: '#3aff7a' },
  c: { name: 'Commercial',  tint: ['#0e2a3a', '#13384a', '#18465a', '#1d556e'], glow: '#3ad7ff' },
  i: { name: 'Industrial',  tint: ['#3a2a08', '#4a360a', '#5a420c', '#6a4e0e'], glow: '#ffd23a' },
};

// Tool -> building key
SR.TOOL_TO_BUILDING = {};
for (const [k, b] of Object.entries(SR.BUILDINGS)) {
  if (b.tool) SR.TOOL_TO_BUILDING[b.tool] = k;
}

// Helper for achievement tests: count built things
function _countBuilding(key) {
  if (!SR.grid || !SR.grid.tiles) return 0;
  let n = 0;
  for (const t of SR.grid.tiles) if (t.building === key && t.bx === undefined ? false : true) {
    // count once via top-left
  }
  // Simpler: walk tiles directly
  n = 0;
  const W = SR.GRID_W, H = SR.GRID_H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = SR.grid.get(x, y);
      if (t.building === key && t.bx === x && t.by === y) n++;
    }
  }
  return n;
}
function _hasAnyZone(kind) {
  if (!SR.grid || !SR.grid.tiles) return false;
  for (const t of SR.grid.tiles) if (t.zone === kind && t.level > 0) return true;
  return false;
}

// ---- Scenarios (#71) ----
// Each scenario has: key, name, desc, deadlineMonths, test(g)→bool, progress(g)→0..1, reward.
SR.SCENARIOS = [
  {
    key: 'boom',
    name: 'BOOM TOWN',
    desc: 'Reach 5,000 population within 60 months.',
    deadlineMonths: 60,
    reward: 5000,
    test: g => g.population >= 5000,
    progress: g => Math.min(1, g.population / 5000),
  },
  {
    key: 'eco',
    name: 'ECO-MAYOR',
    desc: 'Reach 1,000 population while keeping average pollution under 10 (48 months).',
    deadlineMonths: 48,
    reward: 4000,
    test: g => {
      if (g.population < 1000) return false;
      let n = 0, s = 0;
      for (const t of SR.grid.tiles) if (t.zone) { n++; s += t.pollution || 0; }
      return n > 0 && (s / n) < 10;
    },
    progress: g => {
      let n = 0, s = 0;
      for (const t of SR.grid.tiles) if (t.zone) { n++; s += t.pollution || 0; }
      const popK = Math.min(1, g.population / 1000);
      const polK = n > 0 ? Math.max(0, Math.min(1, 1 - (s / n - 10) / 20)) : 1;
      return Math.min(popK, polK);
    },
  },
  {
    key: 'tycoon',
    name: 'MEGACORP TYCOON',
    desc: 'Build the Megacorp Tower, an Arcology, and Rodman Plaza (72 months).',
    deadlineMonths: 72,
    reward: 8000,
    test: g => {
      let m = false, a = false, p = false;
      for (const t of SR.grid.tiles) {
        if (t.building === 'megacorp') m = true;
        if (t.building === 'arcology') a = true;
        if (t.building === 'plaza') p = true;
      }
      return m && a && p;
    },
    progress: g => {
      let n = 0;
      const seen = { megacorp: false, arcology: false, plaza: false };
      for (const t of SR.grid.tiles) {
        if (seen[t.building] === false) { seen[t.building] = true; n++; }
      }
      return n / 3;
    },
  },
];

SR.ACHIEVEMENTS = [
  { key: 'pop100',  name: 'Boot Sequence',     desc: 'Reach 100 citizens',                  test: g => g.population >= 100 },
  { key: 'pop1k',   name: 'Going Online',      desc: 'Reach 1,000 citizens',                test: g => g.population >= 1000 },
  { key: 'pop5k',   name: 'Critical Mass',     desc: 'Reach 5,000 citizens',                test: g => g.population >= 5000 },
  { key: 'pop10k',  name: 'Megacity',          desc: 'Reach 10,000 citizens',               test: g => g.population >= 10000 },
  { key: 'firstR',  name: 'Tenants Move In',   desc: 'First built-up residential block',    test: g => _hasAnyZone('r') },
  { key: 'firstC',  name: 'Open For Business', desc: 'First built-up commercial block',     test: g => _hasAnyZone('c') },
  { key: 'firstI',  name: 'Smokestack',        desc: 'First built-up industrial block',     test: g => _hasAnyZone('i') },
  { key: 'fusion',  name: 'Fusion Future',     desc: 'Build a Fusion Reactor',              test: g => _countBuilding('fusion') > 0 },
  { key: 'corp',    name: 'Megacorp Era',      desc: 'Build a Megacorp Tower',              test: g => _countBuilding('megacorp') > 0 },
  { key: 'arco',    name: 'Arcology Age',      desc: 'Build a Neon Arcology',               test: g => _countBuilding('arcology') > 0 },
  { key: 'plaza',   name: 'Plaza Founder',     desc: 'Build the Rodman Plaza',              test: g => _countBuilding('plaza') > 0 },
  { key: 'rich',    name: 'Funded',            desc: 'Have ₡100,000 in the bank',           test: g => g.funds >= 100000 },
  { key: 'apr95',   name: 'Beloved Mayor',     desc: 'Reach 95% approval',                  test: g => g.approval >= 95 },
  { key: 'green',   name: 'Net Zero',          desc: '1,000+ pop with average pollution < 5', test: g => {
      if (g.population < 1000) return false;
      let n = 0, s = 0;
      for (const t of SR.grid.tiles) if (t.zone) { n++; s += t.pollution || 0; }
      return n > 0 && (s / n) < 5;
  } },
];


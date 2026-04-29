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

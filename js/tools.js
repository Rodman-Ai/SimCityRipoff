// tools.js — toolbar/tools logic. Validates and applies build actions.
'use strict';

SR.tools = (() => {
  let current = 'select';

  function select(toolKey) {
    current = toolKey;
    document.querySelectorAll('.tool').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === toolKey);
    });
    SR.audio.sfx.click();
  }

  function getCost(tool) {
    switch (tool) {
      case 'bulldoze': return 5;
      case 'road': return 10;
      case 'highway': return 30;
      case 'power': return 5;
      case 'pipe': return 5;
      case 'zone_r':
      case 'zone_c':
      case 'zone_i': return 10;
      default:
        if (tool && tool.startsWith('build_')) {
          const key = SR.TOOL_TO_BUILDING[tool];
          const def = SR.BUILDINGS[key];
          if (def) return def.cost;
        }
        return 0;
    }
  }

  function canAfford(c) { return SR.game.funds >= c; }
  function spend(c) { SR.game.funds -= c; SR.ui.markStatsDirty(); }

  // Apply current tool at tile (x,y). May be called many times during drag.
  function applyAt(x, y) {
    const t = SR.grid.get(x, y);
    if (!t) return;
    switch (current) {
      case 'select': SR.ui.showTileInfo(x, y); return;
      case 'bulldoze': return doBulldoze(x, y);
      case 'road': return doRoad(x, y, 1);
      case 'highway': return doRoad(x, y, 2);
      case 'power': return doPower(x, y);
      case 'pipe': return doPipe(x, y);
      case 'zone_r': return doZone(x, y, 'r');
      case 'zone_c': return doZone(x, y, 'c');
      case 'zone_i': return doZone(x, y, 'i');
      default:
        if (current && current.startsWith('build_')) return doBuild(x, y, current);
    }
  }

  function doBulldoze(x, y) {
    const t = SR.grid.get(x, y);
    if (!t) return;
    if (t.t === 'water') { return; }
    const had = SR.grid.demolish(x, y);
    if (had) {
      const cost = getCost('bulldoze');
      if (!canAfford(cost)) { fail('LOW FUNDS'); return; }
      spend(cost);
      SR.audio.sfx.bulldoze();
      SR.sim.markDirty();
    }
  }

  function doRoad(x, y, level) {
    const t = SR.grid.get(x, y);
    if (!t || t.t !== 'ground' || t.building) { fail(); return; }
    if (t.road === level) return;
    const cost = getCost(level === 2 ? 'highway' : 'road');
    if (!canAfford(cost)) { fail('LOW FUNDS'); return; }
    if (SR.grid.setRoad(x, y, level)) { spend(cost); SR.audio.sfx.place(); SR.sim.markDirty(); }
  }

  function doPower(x, y) {
    const t = SR.grid.get(x, y);
    if (!t || t.t !== 'ground') { fail(); return; }
    if (t.power) return;
    const cost = getCost('power');
    if (!canAfford(cost)) { fail('LOW FUNDS'); return; }
    if (SR.grid.setPower(x, y)) { spend(cost); SR.audio.sfx.place(); SR.sim.markDirty(); }
  }

  function doPipe(x, y) {
    const t = SR.grid.get(x, y);
    if (!t || t.t !== 'ground') { fail(); return; }
    if (t.pipe) return;
    const cost = getCost('pipe');
    if (!canAfford(cost)) { fail('LOW FUNDS'); return; }
    if (SR.grid.setPipe(x, y)) { spend(cost); SR.audio.sfx.place(); SR.sim.markDirty(); }
  }

  function doZone(x, y, kind) {
    const t = SR.grid.get(x, y);
    if (!t || t.t !== 'ground' || t.road || t.building || t.power) { fail(); return; }
    if (t.zone === kind) return;
    const cost = getCost('zone_' + kind);
    if (!canAfford(cost)) { fail('LOW FUNDS'); return; }
    if (SR.grid.setZone(x, y, kind)) { spend(cost); SR.audio.sfx.place(); SR.sim.markDirty(); }
  }

  function doBuild(x, y, tool) {
    const key = SR.TOOL_TO_BUILDING[tool];
    if (!key) return;
    const def = SR.BUILDINGS[key];
    if (!def) return;

    if (def.unique) {
      // disallow duplicates
      for (const t of SR.grid.tiles) if (t.building === key) { fail('ONE PER CITY'); return; }
    }
    if (def.requires) {
      if (def.requires.population && SR.game.population < def.requires.population) {
        fail('NEED POP ' + def.requires.population);
        return;
      }
    }

    const cost = def.cost;
    if (!canAfford(cost)) { fail('LOW FUNDS'); return; }

    if (SR.grid.place(x, y, key)) {
      spend(cost);
      SR.audio.sfx.cash();
      SR.sim.markDirty();
      SR.ui.alert(def.label.toUpperCase() + ' BUILT', 'good');
    } else {
      fail('CANNOT PLACE');
    }
  }

  function fail(msg) {
    SR.audio.sfx.deny();
    if (msg) SR.ui.alert(msg, 'bad');
  }

  return {
    select, applyAt, getCost,
    get current() { return current; },
  };
})();

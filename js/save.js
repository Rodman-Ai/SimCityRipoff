// save.js — localStorage save/load and JSON import/export
'use strict';

SR.save = (() => {
  const KEY = 'simrodman.save.v1';

  function snapshot() {
    return {
      v: 1,
      meta: {
        date: Date.now(),
        cityName: SR.game.cityName,
      },
      game: {
        seed: SR.game.seed,
        year: SR.game.year, month: SR.game.month,
        funds: SR.game.funds,
        taxRates: SR.game.taxRates,
        approval: SR.game.approval,
        history: SR.game.history,
        yearStart: SR.game.yearStart,
        ordinances: SR.game.ordinances,
        loans: SR.game.loans,
        nextLoanId: SR.game.nextLoanId,
        achievements: SR.game.achievements,
        tutorialDone: SR.game.tutorialDone,
        activeScenario: SR.game.activeScenario,
        scenarioStartYear: SR.game.scenarioStartYear,
        scenarioStartMonth: SR.game.scenarioStartMonth,
        debtMonths: SR.game.debtMonths,
        weather: SR.game.weather,
        weatherAuto: SR.game.weatherAuto,
        a11y: SR.game.a11y,
        bookmarks: SR.game.bookmarks,
        specialization: SR.game.specialization,
        modifiers: SR.game.modifiers,
        cryptoTokens: SR.game.cryptoTokens,
        disasterHistory: SR.game.disasterHistory,
        aiUprisingMonths: SR.game.aiUprisingMonths,
      },
      tiles: SR.grid.tiles.map(t => ({
        z: t.z, t: t.t, road: t.road, power: t.power ? 1 : 0, pipe: t.pipe ? 1 : 0,
        maglev: t.maglev ? 1 : 0, subway: t.subway ? 1 : 0,
        zone: t.zone, building: t.building, bx: t.bx, by: t.by, level: t.level,
        pop: t.pop, jobs: t.jobs,
      })),
    };
  }

  function restoreFrom(data) {
    if (!data || data.v !== 1) return false;
    SR.game.seed = data.game.seed;
    SR.game.year = data.game.year;
    SR.game.month = data.game.month;
    SR.game.funds = data.game.funds;
    // Backward compat: old saves had a single `taxRate` number.
    if (data.game.taxRates) {
      SR.game.taxRates = {
        r: data.game.taxRates.r != null ? data.game.taxRates.r : 0.09,
        c: data.game.taxRates.c != null ? data.game.taxRates.c : 0.09,
        i: data.game.taxRates.i != null ? data.game.taxRates.i : 0.09,
      };
    } else if (typeof data.game.taxRate === 'number') {
      SR.game.taxRates = { r: data.game.taxRate, c: data.game.taxRate, i: data.game.taxRate };
    }
    SR.game.approval = data.game.approval;
    SR.game.history = data.game.history || [];
    SR.game.yearStart = data.game.yearStart || { funds: SR.game.funds, population: 0 };
    SR.game.ordinances = data.game.ordinances || {};
    SR.game.loans = data.game.loans || [];
    SR.game.nextLoanId = data.game.nextLoanId || 1;
    SR.game.achievements = data.game.achievements || {};
    SR.game.tutorialDone = !!data.game.tutorialDone;
    SR.game.activeScenario = data.game.activeScenario || null;
    SR.game.scenarioStartYear = data.game.scenarioStartYear || SR.game.year;
    SR.game.scenarioStartMonth = data.game.scenarioStartMonth || 0;
    SR.game.debtMonths = data.game.debtMonths || 0;
    SR.game.gameOver = null;
    SR.game.weather = data.game.weather || null;
    SR.game.weatherAuto = data.game.weatherAuto !== false;
    SR.game.photoMode = false;
    SR.game.a11y = data.game.a11y || SR.game.a11y;
    SR.game.bookmarks = data.game.bookmarks || [null, null, null, null];
    SR.game.specialization = data.game.specialization || null;
    SR.game.modifiers = data.game.modifiers || {};
    SR.game.cryptoTokens = data.game.cryptoTokens || 0;
    SR.game.disasterHistory = data.game.disasterHistory || [];
    SR.game.aiUprisingMonths = data.game.aiUprisingMonths || 0;
    SR.game.cityName = (data.meta && data.meta.cityName) || SR.game.cityName || 'Neo-Rodman';

    // Rebuild blank grid then restore
    SR.grid.init(SR.game.seed);
    const tiles = SR.grid.tiles;
    for (let i = 0; i < tiles.length && i < data.tiles.length; i++) {
      const s = data.tiles[i];
      const t = tiles[i];
      t.z = s.z; t.t = s.t;
      t.road = s.road | 0;
      t.power = !!s.power; t.pipe = !!s.pipe;
      t.maglev = !!s.maglev;
      t.subway = !!s.subway;
      t.zone = s.zone || null;
      t.building = s.building || null;
      t.bx = s.bx | 0; t.by = s.by | 0;
      t.level = s.level | 0;
      t.pop = s.pop | 0; t.jobs = s.jobs | 0;
    }
    SR.sim.markDirty();
    return true;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot()));
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  }
  function load() {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return false;
      return restoreFrom(JSON.parse(s));
    } catch (e) {
      console.warn('load failed', e);
      return false;
    }
  }
  function exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  function exportJson() { return JSON.stringify(snapshot(), null, 0); }
  function importJson(s) {
    try { return restoreFrom(JSON.parse(s)); } catch (e) { return false; }
  }

  return { save, load, exists, exportJson, importJson, snapshot, restoreFrom };
})();

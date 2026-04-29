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
    taxRate: 0.09,
    demand: { r: 50, c: 30, i: 30 },
    power: { supply: 0, demand: 0 },
    water: { supply: 0, demand: 0 },
    lastIncome: 0, lastExpense: 0,
    history: [],
    newsLog: [],
    ordinances: {},
  };

  // months per real-time second per speed
  const SPEED_RATES = [0, 0.4, 1.6, 4.0];

  let monthAccumulator = 0;

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
    if (state.month === 0) state.year++;
    SR.sim.tick();
    SR.disasters.tickFires();
    SR.ui.markStatsDirty();
  }

  function newCity({ name, seed, funds } = {}) {
    state.cityName = name || 'Neo-Rodman';
    state.seed = (seed | 0) || 1337;
    state.funds = funds || 20000;
    state.year = 2077; state.month = 0;
    state.population = 0; state.popCommercial = 0; state.popIndustrial = 0;
    state.jobs = 0; state.approval = 50;
    state.taxRate = 0.09;
    state.demand = { r: 50, c: 30, i: 30 };
    state.power = { supply: 0, demand: 0 };
    state.water = { supply: 0, demand: 0 };
    state.lastIncome = 0; state.lastExpense = 0;
    state.history = []; state.newsLog = []; state.ordinances = {};
    SR.grid.init(state.seed);
    SR.camera.center(SR.GRID_W / 2, SR.GRID_H / 2);
    SR.sim.markDirty();
    SR.ui.markStatsDirty();
  }

  return Object.assign(state, { setSpeed, update, stepMonth, newCity });
})();

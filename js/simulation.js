// simulation.js — monthly tick: services, demand, growth, economy
'use strict';

SR.sim = (() => {
  let netDirty = true; // recompute power/water network when topology changes

  function markDirty() { netDirty = true; }

  // Flood-fill power network from each plant outward.
  // Network propagates over: power tiles, road tiles, building tiles, zone-built tiles.
  function recomputeNetworks() {
    const W = SR.GRID_W, H = SR.GRID_H;
    const tiles = SR.grid.tiles;

    // Reset
    let powerSupply = 0, powerDemand = 0;
    let waterSupply = 0, waterDemand = 0;
    for (let i = 0; i < tiles.length; i++) {
      tiles[i].poweredBy = false;
      tiles[i].watered = false;
    }

    // BFS from each power source
    function isCarrier(t) {
      return t && (t.power || t.road || t.building || (t.zone && t.level > 0));
    }
    function isPipeCarrier(t) {
      return t && (t.pipe || t.road || t.building || (t.zone && t.level > 0));
    }

    const visited = new Uint8Array(W * H);
    const queue = [];

    // Power sources: buildings with power > 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        if (t.building) {
          const def = SR.BUILDINGS[t.building];
          if (def && def.power > 0) {
            if (t.bx === x && t.by === y) powerSupply += def.power;
            const idx = y * W + x;
            if (!visited[idx]) { visited[idx] = 1; t.poweredBy = true; queue.push(idx); }
          }
        }
      }
    }
    // BFS power (deque via index head). Carriers propagate;
    // non-carrier consumers (e.g. unbuilt zones) only get a "powered" mark.
    {
      let head = 0;
      while (head < queue.length) {
        const i = queue[head++];
        const x = i % W, y = (i / W) | 0;
        for (let k = 0; k < 4; k++) {
          const dx = k === 0 ? 1 : k === 1 ? -1 : 0;
          const dy = k === 2 ? 1 : k === 3 ? -1 : 0;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          const nt = tiles[ni];
          if (!nt) continue;
          if (isCarrier(nt)) {
            if (visited[ni]) continue;
            visited[ni] = 1;
            nt.poweredBy = true;
            queue.push(ni);
          } else if (nt.zone) {
            nt.poweredBy = true; // consumer adjacent to carrier
          }
        }
      }
    }

    // Water network
    const wvisited = new Uint8Array(W * H);
    const wq = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        if (t.building) {
          const def = SR.BUILDINGS[t.building];
          if (def && def.water > 0) {
            if (t.bx === x && t.by === y) waterSupply += def.water;
            const idx = y * W + x;
            if (!wvisited[idx]) { wvisited[idx] = 1; t.watered = true; wq.push(idx); }
          }
        }
      }
    }
    {
      let head = 0;
      while (head < wq.length) {
        const i = wq[head++];
        const x = i % W, y = (i / W) | 0;
        for (let k = 0; k < 4; k++) {
          const dx = k === 0 ? 1 : k === 1 ? -1 : 0;
          const dy = k === 2 ? 1 : k === 3 ? -1 : 0;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          const nt = tiles[ni];
          if (!nt) continue;
          if (isPipeCarrier(nt)) {
            if (wvisited[ni]) continue;
            wvisited[ni] = 1;
            nt.watered = true;
            wq.push(ni);
          } else if (nt.zone) {
            nt.watered = true;
          }
        }
      }
    }

    // Compute demand from buildings + zones
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.building) {
        const def = SR.BUILDINGS[t.building];
        if (def && t.bx + t.by * W === i % (W * H)) {
          // count once via top-left
        }
      }
      if (t.zone && t.level > 0) {
        powerDemand += t.level * 1.5;
        waterDemand += t.level * 1.0;
      }
    }
    // Building consumers
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        if (t.building && t.bx === x && t.by === y) {
          const def = SR.BUILDINGS[t.building];
          if (!def) continue;
          if (def.power < 0) powerDemand += -def.power;
          if (def.water < 0) waterDemand += -def.water;
        }
      }
    }

    SR.game.power = { supply: powerSupply, demand: powerDemand };
    SR.game.water = { supply: waterSupply, demand: waterDemand };
    netDirty = false;
  }

  // Spread a value to nearby ground tiles within radius (Chebyshev).
  function spread(field, x, y, radius, strength) {
    const W = SR.GRID_W, H = SR.GRID_H;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const fall = Math.max(0, 1 - dist / (radius + 1));
        field[ny * W + nx] += strength * fall;
      }
    }
  }

  // Compute coverage / pollution / crime / land-value fields and apply to tiles.
  function recomputeFields() {
    const W = SR.GRID_W, H = SR.GRID_H;
    const tiles = SR.grid.tiles;
    const N = W * H;
    const policeF = new Float32Array(N);
    const fireF = new Float32Array(N);
    const healthF = new Float32Array(N);
    const eduF = new Float32Array(N);
    const polF = new Float32Array(N);
    const valueF = new Float32Array(N);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        const i = y * W + x;
        // baseline land value: river/road proximity (handled by services); start with terrain
        valueF[i] = 20;
        if (t.t === 'water') valueF[i] = 0;
        // pollution from industrial zones
        if (t.zone === 'i' && t.level > 0) {
          polF[i] += t.level * 8;
        }
        if (t.building) {
          if (t.bx !== x || t.by !== y) continue; // only top-left
          const def = SR.BUILDINGS[t.building];
          if (!def) continue;
          if (def.pollution) polF[i] += def.pollution * 1.0;
          if (def.range > 0) {
            if (def.crimeRed > 0) spread(policeF, x, y, def.range, def.crimeRed);
            if (def.fireRed > 0) spread(fireF, x, y, def.range, def.fireRed);
            if (def.capacity > 0 && (t.building === 'hospital')) spread(healthF, x, y, def.range, 1);
            if (def.capacity > 0 && (t.building === 'school')) spread(eduF, x, y, def.range, 1);
            if (def.landBoost) spread(valueF, x, y, def.range, def.landBoost);
          }
        }
      }
    }

    // Diffuse pollution
    const pol2 = new Float32Array(N);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        pol2[i] = (polF[i] * 4 + polF[i - 1] + polF[i + 1] + polF[i - W] + polF[i + W]) / 8;
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        const i = y * W + x;
        t.pollution = SR.utils.clamp(Math.round(pol2[i] || polF[i]), 0, 100);

        // Crime ↑ with low police, low value, high pollution
        const baseCrime = 15 - policeF[i] * 25 + (t.pollution * 0.2) - (valueF[i] * 0.2);
        t.crime = SR.utils.clamp(Math.round(baseCrime), 0, 100);

        // Fire risk ~ crime + low fire coverage
        // Land value: combine valueF, low pollution, low crime
        let lv = valueF[i] - t.pollution * 0.6 - t.crime * 0.4;
        if (t.t === 'water') lv = 0;
        t.land = SR.utils.clamp(Math.round(lv), 0, 100);

        // Coverage flags scaled 0..1
        t._policeCov = SR.utils.clamp(policeF[i], 0, 1);
        t._fireCov = SR.utils.clamp(fireF[i], 0, 1);
        t._healthCov = SR.utils.clamp(healthF[i], 0, 1);
        t._eduCov = SR.utils.clamp(eduF[i], 0, 1);
      }
    }
  }

  // Update zoned buildings level, growing or decaying based on conditions.
  function growZones() {
    const W = SR.GRID_W, H = SR.GRID_H;
    let popR = 0, popC = 0, popI = 0;
    let jobsC = 0, jobsI = 0;

    // Demand baseline: tax rate + ratio of jobs to pop
    const tax = SR.game.taxRate; // 0..0.2

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        if (!t.zone) continue;

        const adjRoad = roadNearby(x, y, 2);
        const hasUtil = t.poweredBy && t.watered;

      // Fitness 0..1: amenities, value, services
      let fit = 0;
      fit += t.land / 100 * 0.4;
      fit += (hasUtil ? 0.25 : 0) + (adjRoad ? 0.15 : -0.5);
      fit += (t._eduCov || 0) * 0.1;
      fit += (t._healthCov || 0) * 0.05;
      fit -= (t.pollution / 100) * 0.2;
      fit -= (t.crime / 100) * 0.2;
      fit -= tax * 1.5;

      // Tax/quality dependent demand bias
      if (t.zone === 'r') fit += SR.game.demand.r * 0.0008;
      if (t.zone === 'c') fit += SR.game.demand.c * 0.0008;
      if (t.zone === 'i') fit += SR.game.demand.i * 0.0008;

      // Decide level changes
      const target = SR.utils.clamp(Math.round(fit * 3.5), 0, 3);
      if (t.level < target) {
        if (Math.random() < 0.18) t.level++;
      } else if (t.level > target) {
        if (Math.random() < 0.10) t.level--;
        if (t.level < 0) t.level = 0;
      }

      // populate / employ
      if (t.zone === 'r') {
        t.pop = t.level * 16;
        popR += t.pop;
      } else if (t.zone === 'c') {
        t.jobs = t.level * 14;
        jobsC += t.jobs;
        popC += t.level * 4; // commerce supports residents indirectly
      } else if (t.zone === 'i') {
        t.jobs = t.level * 18;
        jobsI += t.jobs;
        popI += t.level * 2;
      }
      } // x
    } // y

    // Demand calc:
    const totalPop = popR;
    const totalJobs = jobsC + jobsI;
    // R demand: more jobs than pop -> R demand up
    SR.game.demand = {
      r: SR.utils.clamp((totalJobs * 2 - totalPop) * 0.2 + (50 - tax * 400), -100, 100),
      c: SR.utils.clamp((popR * 0.6 - jobsC) * 0.5 + (40 - tax * 350), -100, 100),
      i: SR.utils.clamp((popR * 0.4 - jobsI) * 0.5 + (40 - tax * 300), -100, 100),
    };

    SR.game.population = totalPop;
    SR.game.jobs = totalJobs;
    SR.game.popCommercial = popC;
    SR.game.popIndustrial = popI;
  }

  function roadNearby(x, y, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nt = SR.grid.get(x + dx, y + dy);
        if (nt && nt.road) return true;
      }
    }
    return false;
  }

  function payDay() {
    // Compute taxes from R/C/I population and jobs
    const tax = SR.game.taxRate;
    const incomeR = SR.game.population * 6 * tax;
    const incomeC = SR.game.popCommercial * 14 * tax * 4;
    const incomeI = SR.game.popIndustrial * 18 * tax * 4;
    const income = incomeR + incomeC + incomeI;

    // Maintenance
    let maintBuildings = 0;
    let maintRoads = 0;
    for (const t of SR.grid.tiles) {
      if (t.road) maintRoads += t.road === 2 ? 1 : 0.4;
      if (t.building) {
        if (t.bx === undefined) continue;
        // Only count once via top-left
      }
    }
    // unique pass for buildings
    for (let y = 0; y < SR.GRID_H; y++) {
      for (let x = 0; x < SR.GRID_W; x++) {
        const t = SR.grid.get(x, y);
        if (t.building && t.bx === x && t.by === y) {
          const def = SR.BUILDINGS[t.building];
          if (def && def.maint) maintBuildings += def.maint;
        }
      }
    }

    // Loan repayments
    let loanPayment = 0;
    if (SR.game.loans && SR.game.loans.length) {
      const remaining = [];
      for (const l of SR.game.loans) {
        loanPayment += l.monthly;
        l.balance -= l.monthly;
        l.monthsLeft -= 1;
        if (l.monthsLeft > 0 && l.balance > 0) remaining.push(l);
      }
      SR.game.loans = remaining;
    }
    SR.game.lastLoanPayment = loanPayment;

    const expense = maintBuildings + maintRoads + loanPayment;
    const net = income - expense;
    SR.game.funds += net;
    SR.game.lastIncome = income;
    SR.game.lastExpense = expense;
    SR.game.history.push({ year: SR.game.year, month: SR.game.month, pop: SR.game.population, funds: SR.game.funds, income, expense });
    if (SR.game.history.length > 240) SR.game.history.shift();

    // Approval — based on tax rate, services, growth
    const polAvg = SR.game.population > 0 ? SR.game.population : 1;
    let approval = 60;
    approval -= SR.game.taxRate * 200;
    approval += Math.min(20, SR.game.population / 200);
    if (SR.game.power.demand > SR.game.power.supply) approval -= 10;
    if (SR.game.water.demand > SR.game.water.supply) approval -= 6;
    approval = SR.utils.clamp(approval, 0, 100);
    SR.game.approval = Math.round(approval * 0.3 + (SR.game.approval || 50) * 0.7);

    // alerts
    if (SR.game.power.demand > SR.game.power.supply * 1.05 && SR.game.population > 100) {
      SR.ui.alert('POWER GRID OVERLOADED', 'bad');
    }
    if (SR.game.water.demand > SR.game.water.supply * 1.05 && SR.game.population > 100) {
      SR.ui.alert('WATER SHORTAGE', 'bad');
    }
    if (net < 0 && SR.game.funds < 0) {
      SR.ui.alert('CITY IN DEBT', 'bad');
    }
  }

  function checkAchievements() {
    if (!SR.ACHIEVEMENTS) return;
    for (const a of SR.ACHIEVEMENTS) {
      if (SR.game.achievements[a.key] && SR.game.achievements[a.key].unlocked) continue;
      if (a.test(SR.game)) {
        SR.game.achievements[a.key] = { unlocked: true, at: SR.game.year + '-' + (SR.game.month + 1) };
        SR.ui.unlockAchievement(a);
      }
    }
  }

  // Called every game-month
  function tick() {
    if (netDirty) recomputeNetworks();
    recomputeFields();
    growZones();
    if (netDirty) recomputeNetworks(); // zones may have changed levels
    payDay();
    checkAchievements();

    SR.disasters.maybeTrigger();

    // Random news
    if (Math.random() < 0.15) {
      const news = SR.NEWS_LINES[(Math.random() * SR.NEWS_LINES.length) | 0];
      SR.ui.pushTicker(news);
    }
  }

  return { tick, markDirty, recomputeNetworks, recomputeFields };
})();

SR.NEWS_LINES = [
  "MEGACORP DOWNSIZES — MAYOR PROMISES JOBS PROGRAM",
  "NIGHT MARKET RECORDS RECORD ATTENDANCE",
  "ROGUE AI CAUGHT BIDDING ON MUNICIPAL CONTRACTS",
  "CHROME-PLATED CARS STUCK IN RUSH HOUR PLASMA STORM",
  "STREET PREACHER PROPHESIZES NEON RAPTURE",
  "DRONE DELIVERIES UP 32% THIS QUARTER",
  "MAYOR RODMAN SPOTTED AT NEW ARCOLOGY OPENING",
  "BLACK MARKET TURNS OVER NEW MEMORYWARE",
  "POPULATION MILESTONE TRIGGERS FIREWORKS HACK",
  "AIR FILTRATION INDEX: GO HUG A HOLOPARK",
];

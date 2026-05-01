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
      return t && (t.power || t.road || t.maglev || t.subway || t.building || (t.zone && t.level > 0));
    }
    function isPipeCarrier(t) {
      return t && (t.pipe || t.road || t.maglev || t.subway || t.building || (t.zone && t.level > 0));
    }

    const visited = new Uint8Array(W * H);
    const queue = [];

    // Power sources: buildings with power > 0
    // #48 Water table — pumps adjacent to water tiles get +25% supply
    function waterTableBoost(x, y, def) {
      if (def.water <= 0) return 1;
      for (let dy = -1; dy <= def.size; dy++) for (let dx = -1; dx <= def.size; dx++) {
        const n = SR.grid.get(x + dx, y + dy);
        if (n && n.t === 'water') return 1.25;
      }
      return 1;
    }
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
            if (t.bx === x && t.by === y) waterSupply += def.water * waterTableBoost(x, y, def);
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

  // ---- Ordinance helpers ----
  function ord(key) { return !!(SR.game.ordinances && SR.game.ordinances[key]); }
  function ordinanceCost() {
    let c = 0;
    if (ord('promo')) c += 200;
    if (ord('clean')) c += 150;
    if (ord('rec'))   c += 300;
    if (ord('subR')) c += 200;     // #10 R subsidy
    if (ord('subC')) c += 200;     // #10 C subsidy
    if (ord('subI')) c += 200;     // #10 I subsidy
    if (ord('transit')) c += 250;  // #40 mass-transit pass
    return c;
  }
  // #5 Specialization perks — picked at New City; applied as multipliers each tick.
  // #6 Credit rating — derived 0..100 from approval, debt and tax rate.
  function creditRating() {
    const debtRatio = SR.game.loans.reduce((s, l) => s + l.balance, 0) / 80000;
    let r = (SR.game.approval || 50);
    r -= debtRatio * 30;
    r -= Math.max(0, SR.game.taxRate * 100 - 11) * 1.5;
    return SR.utils.clamp(Math.round(r), 0, 100);
  }
  // #7 Inflation — slowly drift building costs upward with year.
  function inflationFactor() {
    return 1 + (SR.game.year - 2077) * 0.005;
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
          // R2-27 DDoS — service buildings (those with a coverage range) go silent
          const ddosed = SR.game.ddosMonths > 0 && def.range > 0 && def.category === 'service';
          if (def.range > 0 && !ddosed) {
            if (def.crimeRed > 0) spread(policeF, x, y, def.range, def.crimeRed);
            if (def.fireRed > 0) spread(fireF, x, y, def.range, def.fireRed);
            if (def.capacity > 0 && (t.building === 'hospital' || t.building === 'cyberclinic' || t.building === 'university')) spread(healthF, x, y, def.range, 1);
            if (def.capacity > 0 && (t.building === 'school' || t.building === 'university')) spread(eduF, x, y, def.range, 1);
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

    const polMul = (ord('clean') ? 0.75 : 1) * ((SR.game.modifiers && SR.game.modifiers.doublePollution) ? 2 : 1);
    const crimeMul = ord('curfew') ? 0.65 : 1;
    // Untreated garbage adds to citywide pollution (multiplicative bump on top
    // of zone-local pollution sources).
    const gProd = SR.game.garbage.produced || 0;
    const gHandled = SR.game.garbage.handled || 0;
    const garbageBump = gHandled >= gProd ? 0
      : SR.utils.clamp((gProd - gHandled) * 0.05, 0, 30);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        const i = y * W + x;
        t.pollution = SR.utils.clamp(Math.round(((pol2[i] || polF[i]) + garbageBump) * polMul), 0, 100);

        // Crime ↑ with low police, low value, high pollution
        const baseCrime = (15 - policeF[i] * 25 + (t.pollution * 0.2) - (valueF[i] * 0.2)) * crimeMul;
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

    // Per-zone tax bands. Each zone reads its own band for fitness and income.
    const taxR = SR.game.taxRates.r;
    const taxC = SR.game.taxRates.c;
    const taxI = SR.game.taxRates.i;

    // Production-chain MVP: industrial zones produce goods, commercial consume
    // them. Aggregate per tick — if commerce demand outpaces supply, the
    // demand bar drops and individual commercial tiles take a fitness hit.
    let goodsProd = 0, goodsCons = 0;
    let garbageProd = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        if (!t.zone || t.level === 0) continue;
        if (t.zone === 'i') goodsProd += t.level * 2;
        else if (t.zone === 'c') goodsCons += t.level;
        garbageProd += t.level;
      }
    }
    const goodsRatio = goodsCons > 0 ? Math.min(1.5, goodsProd / goodsCons) : 1;
    SR.game.goods = { produced: goodsProd, consumed: goodsCons };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = SR.grid.get(x, y);
        if (!t.zone) continue;

        const adjRoad = roadNearby(x, y, 2);
        const hasUtil = t.poweredBy && t.watered;
        const tax = t.zone === 'r' ? taxR : t.zone === 'c' ? taxC : taxI;

        // Fitness 0..1: amenities, value, services
        let fit = 0;
        fit += t.land / 100 * 0.4;
        fit += (hasUtil ? 0.25 : 0) + (adjRoad ? 0.15 : -0.5);
        fit += (t._eduCov || 0) * 0.1;
        fit += (t._healthCov || 0) * 0.05;
        fit -= (t.pollution / 100) * 0.2;
        fit -= (t.crime / 100) * 0.2;
        fit -= tax * 1.5;
        // Cemetery shortage hurts residential
        if (t.zone === 'r' && SR.game.deathCapacityRatio < 1) {
          fit -= (1 - SR.game.deathCapacityRatio) * 0.1;
        }
        // Goods supply gates commerce growth
        if (t.zone === 'c' && goodsRatio < 1) {
          fit -= (1 - goodsRatio) * 0.3;
        }

        // Tax/quality dependent demand bias
        if (t.zone === 'r') fit += SR.game.demand.r * 0.0008;
        if (t.zone === 'c') fit += SR.game.demand.c * 0.0008;
        if (t.zone === 'i') fit += SR.game.demand.i * 0.0008;

        // Decide level changes
        const target = SR.utils.clamp(Math.round(fit * 3.5), 0, 3);
        if (t.level < target) {
          if (Math.random() < 0.18) {
            t.level++;
            t._anim = { from: performance.now(), dur: 500 };
          }
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
    const recBoost = ord('rec') ? 25 : 0;       // Cyberware Subsidy → more R
    const promoBoost = ord('promo') ? 25 : 0;   // Megacorp Tax Holiday → more I
    const curfewMalus = ord('curfew') ? -10 : 0; // Curfew suppresses commerce
    // #10 Direct subsidies + #40 transit pass + #5 specialization
    const subR = ord('subR') ? 15 : 0;
    const subC = ord('subC') ? 15 : 0;
    const subI = ord('subI') ? 15 : 0;
    const transitBoost = ord('transit') ? 8 : 0;
    const spec = SR.game.specialization || null;
    const specR = spec === 'tourism' ? 10 : 0;
    const specC = spec === 'tourism' ? 20 : spec === 'tech' ? 8 : 0;
    const specI = spec === 'industrial' ? 25 : spec === 'tech' ? 10 : 0;
    const goodsMalus = goodsRatio < 1 ? Math.round((1 - goodsRatio) * 50) : 0;
    SR.game.demand = {
      r: SR.utils.clamp((totalJobs * 2 - totalPop) * 0.2 + (50 - taxR * 400) + recBoost + subR + transitBoost + specR, -100, 100),
      c: SR.utils.clamp((popR * 0.6 - jobsC) * 0.5 + (40 - taxC * 350) + curfewMalus - goodsMalus + subC + transitBoost + specC, -100, 100),
      i: SR.utils.clamp((popR * 0.4 - jobsI) * 0.5 + (40 - taxI * 300) + promoBoost + subI + specI, -100, 100),
    };

    SR.game.population = totalPop;
    SR.game.jobs = totalJobs;
    SR.game.popCommercial = popC;
    SR.game.popIndustrial = popI;
    SR.game.garbage.produced = garbageProd;
  }

  function roadNearby(x, y, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nt = SR.grid.get(x + dx, y + dy);
        if (nt && ((nt.road && !nt.frozen) || nt.maglev || nt.subway)) return true;
      }
    }
    return false;
  }

  function payDay() {
    // Per-zone tax bands
    const taxR = SR.game.taxRates.r;
    const taxC = SR.game.taxRates.c;
    const taxI = SR.game.taxRates.i;
    const incomeR = SR.game.population * 6 * taxR;
    const incomeC = SR.game.popCommercial * 14 * taxC * 4;
    const incomeI = SR.game.popIndustrial * 18 * taxI * 4;
    let income = incomeR + incomeC + incomeI;

    // Maintenance + tally building-level effects
    let maintBuildings = 0;
    let maintRoads = 0;
    let burialCapacity = 0;
    let garbageHandled = 0;
    let approvalBoostSum = 0;
    let revenueExtra = 0;     // direct ₡ income from casino / convention / etc.
    let freightBoost = 0;     // drone-airfield freight income proxy
    for (const t of SR.grid.tiles) {
      if (t.road) maintRoads += t.road === 2 ? 1 : 0.4;
      if (t.subway) maintRoads += 0.2; // subway maintenance
    }
    for (let y = 0; y < SR.GRID_H; y++) {
      for (let x = 0; x < SR.GRID_W; x++) {
        const t = SR.grid.get(x, y);
        if (t.building && t.bx === x && t.by === y) {
          const def = SR.BUILDINGS[t.building];
          if (!def) continue;
          if (def.maint) maintBuildings += def.maint;
          if (def.burialCapacity) burialCapacity += def.burialCapacity;
          if (def.garbageCapacity) garbageHandled += def.garbageCapacity;
          if (def.approvalBoost) approvalBoostSum += def.approvalBoost;
          if (def.revenueBoost) revenueExtra += def.revenueBoost;
          if (def.freightBoost) freightBoost += def.freightBoost;
        }
      }
    }
    // Drone airfield freight income scales with population and number of fields.
    if (freightBoost > 0) revenueExtra += freightBoost * Math.min(2000, SR.game.population * 0.5);

    // Cemetery: 1 unit / pop. Without enough capacity, residential growth bites.
    SR.game.deathCapacityRatio = SR.game.population > 0
      ? SR.utils.clamp(burialCapacity / SR.game.population, 0, 1)
      : 1;
    SR.game.garbage.handled = garbageHandled;
    SR.game.stadiumApprovalBoost = approvalBoostSum;
    SR.game.lastRevenueExtra = revenueExtra;

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

    // #49 Worker commute — when jobs outpace workforce, only the filled jobs earn
    const jobsAvail = SR.game.jobs;
    const workforce = SR.game.population * 0.55; // ~55% of pop works
    if (jobsAvail > workforce && workforce > 0) {
      const fillRate = workforce / jobsAvail;
      income *= fillRate; // tax base falls because some jobs go unfilled
    }
    income += revenueExtra;
    const ordCost = ordinanceCost();
    const expense = maintBuildings + maintRoads + loanPayment + ordCost;
    const net = income - expense;
    SR.game.funds += net;
    SR.game.lastIncome = income;
    SR.game.lastExpense = expense;

    // Visual: float a few "+₡" particles from earning zones (and "-₡" if in deficit)
    if (SR.renderer && SR.renderer.spawnFloater && income > 0) {
      const earners = [];
      for (let y = 0; y < SR.GRID_H; y++) for (let x = 0; x < SR.GRID_W; x++) {
        const t = SR.grid.get(x, y);
        if (t.zone && t.level > 0) earners.push([x, y, t]);
      }
      const popCount = Math.min(5, Math.max(1, earners.length));
      for (let i = 0; i < popCount; i++) {
        const [x, y, t] = earners[(Math.random() * earners.length) | 0];
        const share = (income / Math.max(1, earners.length)) * (0.7 + Math.random() * 0.6);
        SR.renderer.spawnFloater(x, y, '+₡' + Math.round(share),
          t.zone === 'r' ? '#3aff7a' : t.zone === 'c' ? '#3ad7ff' : '#ffd23a');
      }
    }
    if (SR.renderer && SR.renderer.spawnFloater && net < -50) {
      // Show a red deficit pop in the city center
      SR.renderer.spawnFloater(SR.GRID_W / 2, SR.GRID_H / 2, '-₡' + Math.round(-net), '#ff5050');
    }
    SR.game.history.push({ year: SR.game.year, month: SR.game.month, pop: SR.game.population, funds: SR.game.funds, income, expense });
    if (SR.game.history.length > 240) SR.game.history.shift();

    // Approval — averaged tax weighed by zone size; service balance; stadium boost
    let approval = 60;
    approval -= SR.game.taxRate * 200;
    approval += Math.min(20, SR.game.population / 200);
    if (SR.game.power.demand > SR.game.power.supply) approval -= 10;
    if (SR.game.water.demand > SR.game.water.supply) approval -= 6;
    if (SR.game.garbage.produced > SR.game.garbage.handled) approval -= 4;
    if (SR.game.deathCapacityRatio < 1 && SR.game.population > 200) approval -= 4;
    approval += SR.game.stadiumApprovalBoost;
    approval = SR.utils.clamp(approval, 0, 100);
    SR.game.approval = Math.round(approval * 0.3 + (SR.game.approval || 50) * 0.7);

    // Bankruptcy watchdog — if funds stay deeply negative for 6 months,
    // surface the game-over screen.
    if (SR.game.funds < -5000) SR.game.debtMonths = (SR.game.debtMonths || 0) + 1;
    else SR.game.debtMonths = 0;
    if (SR.game.debtMonths >= 6 && !SR.game.gameOver) {
      SR.game.gameOver = 'bankruptcy';
      if (SR.ui && SR.ui.gameOver) SR.ui.gameOver('bankruptcy');
    }

    // alerts
    if (SR.game.power.demand > SR.game.power.supply * 1.05 && SR.game.population > 100) {
      SR.ui.alert('POWER GRID OVERLOADED', 'bad');
    }
    if (SR.game.water.demand > SR.game.water.supply * 1.05 && SR.game.population > 100) {
      SR.ui.alert('WATER SHORTAGE', 'bad');
    }
    if (SR.game.garbage.produced > SR.game.garbage.handled * 1.2 && SR.game.population > 200) {
      SR.ui.alert('GARBAGE PILE-UP', 'bad');
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

  function dispatchServices() {
    if (!SR.renderer || !SR.renderer.spawnVehicle) return;
    const dispatched = { police: '#3ad7ff', fire: '#ff6a00', hospital: '#3aff7a' };
    for (let y = 0; y < SR.GRID_H; y++) {
      for (let x = 0; x < SR.GRID_W; x++) {
        const t = SR.grid.get(x, y);
        if (!t.building || t.bx !== x || t.by !== y) continue;
        const color = dispatched[t.building];
        if (!color) continue;
        if (Math.random() > 0.5) continue;
        const def = SR.BUILDINGS[t.building];
        const r = def.range || 6;
        const dx = (Math.random() * 2 - 1) * r;
        const dy = (Math.random() * 2 - 1) * r;
        const tx = SR.utils.clamp(x + dx, 0, SR.GRID_W - 1);
        const ty = SR.utils.clamp(y + dy, 0, SR.GRID_H - 1);
        SR.renderer.spawnVehicle(x + 1, y + 1, tx, ty, color);
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
    dispatchServices();
    // AI uprising — drain a small chunk of funds while active and decrement
    if (SR.game.aiUprisingMonths > 0) {
      SR.game.funds -= 200 + ((SR.game.population * 0.05) | 0);
      SR.game.aiUprisingMonths--;
      if (SR.game.aiUprisingMonths === 0) SR.ui.alert('AI UPRISING ENDED', 'good');
    }
    // R2-27 DDoS — countdown each month while service buildings are gimped
    if (SR.game.ddosMonths > 0) {
      SR.game.ddosMonths--;
      if (SR.game.ddosMonths === 0) SR.ui.alert('SERVICES BACK ONLINE', 'good');
    }
    // R2-29 memetic plague — drag approval while active
    if (SR.game.plagueMonths > 0) {
      SR.game.plagueMonths--;
      SR.game.approval = SR.utils.clamp((SR.game.approval || 50) - 2, 0, 100);
      if (SR.game.plagueMonths === 0) SR.ui.alert('MEME WAVE PASSED', 'good');
    }
    // R2-28 toxic spills — bump pollution in radius for the duration
    if (SR.game.toxicSpills && SR.game.toxicSpills.length) {
      const remaining = [];
      for (const s of SR.game.toxicSpills) {
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const t = SR.grid.get(s.x + dx, s.y + dy);
          if (t) t.pollution = SR.utils.clamp(t.pollution + 8, 0, 100);
        }
        s.ticksLeft--;
        if (s.ticksLeft > 0) remaining.push(s);
      }
      SR.game.toxicSpills = remaining;
    }
    // R2-30 frozen roads — decrement, alerting on full thaw
    let thawed = 0;
    for (const t of SR.grid.tiles) {
      if (t.frozen > 0) { t.frozen--; if (t.frozen === 0) thawed++; }
    }
    if (thawed > 30) SR.ui.alert(thawed + ' ROADS THAWED', 'good');
    if (SR.advisor) SR.advisor.tick();
    if (SR.ui && SR.ui.checkScenarioCompletion) SR.ui.checkScenarioCompletion();
    if (SR.extras && SR.extras.checkArcologyWin) SR.extras.checkArcologyWin();
    // Population milestones — fire fireworks at 1k / 5k / 10k
    const pop = SR.game.population;
    SR.game._milestonesShown = SR.game._milestonesShown || {};
    [1000, 5000, 10000].forEach(m => {
      if (pop >= m && !SR.game._milestonesShown[m]) {
        SR.game._milestonesShown[m] = true;
        if (SR.extras) SR.extras.fireworks();
        SR.ui.pushTicker('★ Population milestone ' + m);
      }
    });

    SR.disasters.maybeTrigger();

    // Random news
    if (Math.random() < 0.15) {
      const news = SR.NEWS_LINES[(Math.random() * SR.NEWS_LINES.length) | 0];
      SR.ui.pushTicker(news);
    }
  }

  return { tick, markDirty, recomputeNetworks, recomputeFields, creditRating, inflationFactor };
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

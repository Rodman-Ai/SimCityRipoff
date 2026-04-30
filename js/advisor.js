// advisor.js — periodic state-aware tips. Runs each month after the sim
// tick and may push at most one advisor toast.
'use strict';

SR.advisor = (() => {
  let cooldown = 0;        // months until next advisor message
  let lastKey = null;

  // Each rule has a `key`, predicate `test(g)`, message, severity.
  // The first rule whose `test` returns true (and isn't on cooldown) wins.
  const rules = [
    {
      key: 'powerShortage', sev: 'bad',
      test: g => g.power.demand > g.power.supply * 1.02 && g.population > 100,
      msg: () => 'Power demand exceeds supply — build another plant.',
    },
    {
      key: 'waterShortage', sev: 'bad',
      test: g => g.water.demand > g.water.supply * 1.02 && g.population > 100,
      msg: () => 'Water shortage — add a Water Pump.',
    },
    {
      key: 'broke', sev: 'bad',
      test: g => g.funds < 500,
      msg: () => 'Funds are low. Raise taxes, take a loan, or cut services.',
    },
    {
      key: 'highTax', sev: 'warn',
      test: g => g.taxRate > 0.13 && g.demand.r < 0,
      msg: () => 'Taxes are choking growth. Try lowering to 9-11%.',
    },
    {
      key: 'crime', sev: 'warn',
      test: g => avgCrime() > 35 && g.population > 200,
      msg: () => 'Crime is climbing — add Police HQs or enable Neon Curfew.',
    },
    {
      key: 'pollution', sev: 'warn',
      test: g => avgPollution() > 25 && g.population > 200,
      msg: () => 'Pollution is heavy — add Holoparks or enable Air Filtration.',
    },
    {
      key: 'rDemand', sev: 'good',
      test: g => g.demand.r > 60 && g.population < 5000,
      msg: () => 'Strong residential demand. Zone more R blocks.',
    },
    {
      key: 'cDemand', sev: 'good',
      test: g => g.demand.c > 50,
      msg: () => 'Commercial demand is up. Zone more C blocks.',
    },
    {
      key: 'megacorp', sev: 'good',
      test: g => g.population >= 3000 && !hasBuilding('megacorp'),
      msg: () => 'Population over 3,000 — you can now build a Megacorp Tower.',
    },
    {
      key: 'arcology', sev: 'good',
      test: g => g.population >= 5000 && !hasBuilding('arcology'),
      msg: () => 'Population over 5,000 — drop a Neon Arcology for +8,000 residents.',
    },
    {
      key: 'plaza', sev: 'good',
      test: g => g.population >= 1500 && g.funds >= 8000 && !hasBuilding('plaza'),
      msg: () => 'You can afford the unique Rodman Plaza — big morale boost.',
    },
    {
      key: 'idleFunds', sev: 'good',
      test: g => g.funds > 30000 && g.population < 2000,
      msg: () => 'Lots of unspent credits. Expand zoning or build a Solar Array.',
    },
  ];

  function hasBuilding(key) {
    if (!SR.grid || !SR.grid.tiles) return false;
    for (const t of SR.grid.tiles) if (t.building === key) return true;
    return false;
  }
  function avgCrime() {
    let n = 0, s = 0;
    for (const t of SR.grid.tiles) if (t.zone) { n++; s += t.crime || 0; }
    return n > 0 ? s / n : 0;
  }
  function avgPollution() {
    let n = 0, s = 0;
    for (const t of SR.grid.tiles) if (t.zone) { n++; s += t.pollution || 0; }
    return n > 0 ? s / n : 0;
  }

  function tick() {
    if (cooldown > 0) { cooldown--; return; }
    if (!SR.game.population || SR.game.population < 30) return;
    // Pass 1: prefer rules whose key differs from the most recent tip so
    // the mayor sees variety. Pass 2: allow repeat if it's still relevant.
    for (let pass = 0; pass < 2; pass++) {
      for (const r of rules) {
        if (pass === 0 && r.key === lastKey) continue;
        if (r.test(SR.game)) {
          SR.ui.advisor(r.msg(), r.sev || 'warn');
          lastKey = r.key;
          cooldown = 6 + ((Math.random() * 4) | 0);
          return;
        }
      }
    }
  }

  return { tick };
})();

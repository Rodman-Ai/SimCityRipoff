// disasters.js — random events that test your city
'use strict';

SR.disasters = (() => {
  const list = [
    {
      key: 'cyber', name: 'CYBER ATTACK',
      msg: 'Net intrusion! Comms compromised. Funds drained.',
      effect: () => { SR.game.funds -= Math.min(SR.game.funds, 800 + Math.random() * 1500 | 0); SR.renderer.triggerGlitch(1500); },
      weight: 1.0,
    },
    {
      key: 'acidrain', name: 'ACID RAIN',
      msg: 'Acid rain corrodes buildings. Maintenance spike.',
      effect: () => {
        let count = 0;
        for (const t of SR.grid.tiles) {
          if (t.zone && t.level > 0 && Math.random() < 0.06) { t.level = Math.max(0, t.level - 1); count++; }
        }
        if (count) SR.ui.alert('-' + count + ' BUILDINGS DEGRADED', 'bad');
      },
      weight: 1.0,
    },
    {
      key: 'riot', name: 'NEON RIOT',
      msg: 'Gangs riot in low-coverage districts.',
      effect: () => {
        let n = 0;
        for (const t of SR.grid.tiles) {
          if (t.zone && t.crime > 60 && Math.random() < 0.1) { t.onFire = 6; n++; }
        }
        SR.ui.alert(n + ' BLOCKS ON FIRE', 'bad');
      },
      weight: 0.8,
    },
    {
      key: 'fire', name: 'STRUCTURE FIRE',
      msg: 'A building has caught fire.',
      effect: () => {
        const candidates = [];
        for (let y = 0; y < SR.GRID_H; y++) {
          for (let x = 0; x < SR.GRID_W; x++) {
            const t = SR.grid.get(x, y);
            if ((t.zone && t.level > 0) || (t.building && t.bx === x && t.by === y)) candidates.push(t);
          }
        }
        if (!candidates.length) return;
        const c = candidates[(Math.random() * candidates.length) | 0];
        c.onFire = 8;
      },
      weight: 1.4,
    },
    {
      key: 'surge', name: 'POWER SURGE',
      msg: 'Power surge briefly knocks out the grid.',
      effect: () => {
        // Just the alert — visual handled by glitch
        SR.renderer.triggerGlitch(1200);
      },
      weight: 1.2,
    },
    {
      key: 'drone', name: 'DRONE SWARM',
      msg: 'Rogue drone swarm strafes the industrial belt.',
      effect: () => {
        let n = 0;
        for (const t of SR.grid.tiles) {
          if (t.zone === 'i' && t.level > 0 && Math.random() < 0.08) { t.level = Math.max(0, t.level - 1); n++; }
        }
        if (n) SR.ui.alert('-' + n + ' INDUSTRIAL BLOCKS HIT', 'bad');
      },
      weight: 0.6,
    },
    {
      key: 'quake', name: 'QUAKE',
      msg: 'Tremors shake the megacity.',
      effect: () => {
        let n = 0;
        for (const t of SR.grid.tiles) {
          if ((t.road || t.zone) && Math.random() < 0.03 * disasterMul()) {
            if (t.zone) t.level = Math.max(0, t.level - 1);
            if (t.road && Math.random() < 0.4) t.road = 0;
            n++;
          }
        }
        if (n) SR.ui.alert(n + ' TILES DAMAGED', 'bad');
        SR.renderer.triggerGlitch(2000);
      },
      weight: 0.4,
    },
    // ---- Wave 5 disasters (#51-55) ----
    {
      key: 'ai', name: 'AI UPRISING',
      msg: 'Megacorp AI hijacks municipal systems for six months.',
      effect: () => {
        SR.game.aiUprisingMonths = 6;
        SR.ui.alert('CONTROL LOST FOR 6 MONTHS', 'bad');
      },
      weight: 0.5,
    },
    {
      key: 'plague', name: 'NANO-PLAGUE',
      msg: 'A rogue nano-virus tears through the population.',
      effect: () => {
        let n = 0;
        for (const t of SR.grid.tiles) {
          if (t.zone === 'r' && t.level > 0 && Math.random() < 0.10 * disasterMul()) {
            t.level = Math.max(0, t.level - 1); n++;
          }
        }
        if (n) SR.ui.alert('-' + n + ' RESIDENTIAL BLOCKS COLLAPSED', 'bad');
      },
      weight: 0.7,
    },
    {
      key: 'flare', name: 'SOLAR FLARE',
      msg: 'Geomagnetic storm — power grid offline.',
      effect: () => {
        // Visual-only blackout: temporarily erase poweredBy. Will restore on next sim tick.
        for (const t of SR.grid.tiles) t.poweredBy = false;
        SR.renderer.flashScreen(400, 'rgba(255,210,80,0.8)');
        SR.renderer.triggerGlitch(2500);
      },
      weight: 0.9,
    },
    {
      key: 'refugees', name: 'CLIMATE REFUGEES',
      msg: 'Mass arrivals — housing demand explodes.',
      effect: () => {
        // Force-bump random R-zone levels by 1 if there is room.
        let n = 0;
        for (const t of SR.grid.tiles) {
          if (t.zone === 'r' && t.level < 3 && Math.random() < 0.25) {
            t.level++; n++;
            t._anim = { from: performance.now(), dur: 600 };
          }
        }
        SR.game.demand.r = Math.min(100, (SR.game.demand.r || 0) + 40);
        if (n) SR.ui.alert('+' + n + ' BLOCKS, R DEMAND SURGE', 'good');
      },
      weight: 0.4,
    },
    // ---- Round 2 disasters (R2-26..R2-30) ----
    {
      key: 'tornado', name: 'TORNADO',
      msg: 'A funnel rips a column of tiles across the city.',
      effect: () => {
        const W = SR.GRID_W, H = SR.GRID_H;
        const col = (Math.random() * W) | 0;
        let n = 0;
        for (let y = 0; y < H; y++) {
          if (Math.random() < 0.45 * disasterMul()) {
            const t = SR.grid.get(col, y);
            if (!t || t.t === 'water') continue;
            if (t.zone) t.level = Math.max(0, t.level - 2);
            if (t.road && Math.random() < 0.6) t.road = 0;
            if (t.building && Math.random() < 0.3) {
              SR.grid.demolish(col, y);
            }
            n++;
          }
        }
        SR.renderer.triggerGlitch(1500);
        if (n) SR.ui.alert(n + ' TILES SHREDDED', 'bad');
      },
      weight: 0.6,
    },
    {
      key: 'ddos', name: 'DDoS ATTACK',
      msg: 'Service buildings dropped offline by botnet flood.',
      effect: () => {
        SR.game.ddosMonths = 4;
        SR.renderer.flashScreen(280, 'rgba(255,40,180,0.7)');
      },
      weight: 0.8,
    },
    {
      key: 'toxic', name: 'TOXIC SPILL',
      msg: 'Industrial accident — pollution surge for 12 months.',
      effect: () => {
        // Find a random industrial tile (or any tile) as the spill epicentre.
        const tiles = SR.grid.tiles;
        let candidates = [];
        for (let y = 0; y < SR.GRID_H; y++) for (let x = 0; x < SR.GRID_W; x++) {
          const t = SR.grid.get(x, y);
          if (t.zone === 'i' && t.level > 0) candidates.push([x, y]);
        }
        if (!candidates.length) {
          for (let y = 0; y < SR.GRID_H; y++) for (let x = 0; x < SR.GRID_W; x++) {
            const t = SR.grid.get(x, y); if (t.t === 'ground') candidates.push([x, y]);
          }
        }
        if (!candidates.length) return;
        const [x, y] = candidates[(Math.random() * candidates.length) | 0];
        SR.game.toxicSpills.push({ x, y, ticksLeft: 12 });
        SR.ui.alert('TOXIC SPILL @ ' + x + ',' + y, 'bad');
        SR.renderer.flashScreen(220, 'rgba(180,255,80,0.6)');
      },
      weight: 0.7,
    },
    {
      key: 'memeplague', name: 'MEMETIC PLAGUE',
      msg: 'Viral info-bomb tanks public morale for 6 months.',
      effect: () => {
        SR.game.plagueMonths = 6;
        SR.game.approval = SR.utils.clamp((SR.game.approval || 50) - 12, 0, 100);
        SR.renderer.triggerGlitch(2000);
      },
      weight: 0.9,
    },
    {
      key: 'blackice', name: 'BLACK-ICE WINTER',
      msg: 'Sudden frost — random roads frozen for weeks.',
      effect: () => {
        // Only triggers in winter months (0..2) — soft-skip otherwise.
        if (SR.game.month > 2 && SR.game.month < 11) return;
        let n = 0;
        for (const t of SR.grid.tiles) {
          if (t.road && Math.random() < 0.05 * disasterMul()) {
            t.frozen = 4 + ((Math.random() * 4) | 0);
            n++;
          }
        }
        if (n) SR.ui.alert(n + ' ROADS ICED OVER', 'bad');
      },
      weight: 0.4,
    },
    {
      key: 'eruption', name: 'EMP ERUPTION',
      msg: 'Underground reactor breach! Lava-glass tiles permanent.',
      effect: () => {
        // Convert a small radius around a random ground tile into water (proxy for lava).
        const W = SR.GRID_W, H = SR.GRID_H;
        for (let tries = 0; tries < 8; tries++) {
          const cx = (Math.random() * W) | 0, cy = (Math.random() * H) | 0;
          const c = SR.grid.get(cx, cy);
          if (!c || c.t !== 'ground') continue;
          let n = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (Math.random() < 0.6 * disasterMul()) {
              const t = SR.grid.get(cx + dx, cy + dy);
              if (!t) continue;
              t.t = 'water'; // permanent
              t.road = 0; t.power = false; t.pipe = false; t.maglev = false;
              t.subway = false; t.zone = null; t.building = null;
              t.level = 0;
              n++;
            }
          }
          if (n) SR.ui.alert(n + ' TILES MELTED', 'bad');
          break;
        }
        SR.renderer.flashScreen(280, 'rgba(255,80,40,0.7)');
      },
      weight: 0.25,
    },
  ];

  // #56 Disaster preparedness — bunkers in coverage radius cut severity.
  // Returned as a multiplier 0.5..1 applied to all disaster-effect random rolls.
  function disasterMul() {
    let coverage = 0;
    for (const t of SR.grid.tiles) {
      if (t.building && SR.BUILDINGS[t.building] && SR.BUILDINGS[t.building].disasterShield) {
        coverage = Math.max(coverage, SR.BUILDINGS[t.building].disasterShield);
      }
    }
    return 1 - coverage;
  }

  // Per-disaster flash color + thunder pitch
  const FX = {
    cyber:    { color: 'rgba(255,40,180,0.7)', pitch: 220 },
    acidrain: { color: 'rgba(180,255,80,0.7)', pitch: 130 },
    riot:     { color: 'rgba(255,80,40,0.7)',  pitch: 180 },
    fire:     { color: 'rgba(255,140,40,0.7)', pitch: 160 },
    surge:    { color: 'rgba(255,255,180,0.7)', pitch: 320 },
    drone:    { color: 'rgba(140,200,255,0.7)', pitch: 240 },
    quake:    { color: 'rgba(255,255,255,0.7)', pitch: 90  },
  };

  function trigger(key) {
    const d = list.find(x => x.key === key);
    if (!d) return;
    SR.audio.sfx.alert();
    SR.audio.sfx.boom();
    SR.ui.alert(d.name, 'bad');
    SR.ui.pushTicker('!! ' + d.name + ' :: ' + d.msg);
    // #58 history log
    SR.game.disasterHistory = SR.game.disasterHistory || [];
    SR.game.disasterHistory.push({
      key: d.key, name: d.name,
      year: SR.game.year, month: SR.game.month,
    });
    if (SR.game.disasterHistory.length > 60) SR.game.disasterHistory.shift();
    const fx = FX[key];
    if (fx && SR.renderer && SR.renderer.flashScreen) {
      // Triple-flash like lightning
      SR.renderer.flashScreen(120, fx.color);
      setTimeout(() => SR.renderer && SR.renderer.flashScreen(80, fx.color), 180);
      setTimeout(() => SR.renderer && SR.renderer.flashScreen(60, fx.color), 350);
    }
    d.effect();
    SR.sim.markDirty();
  }

  function maybeTrigger() {
    if (SR.game.population < 200) return;
    // #57 Season pressure — winter ↑disasters, summer ↓ them
    const m = SR.game.month | 0;
    const seasonMul = m < 3 ? 1.6 : m < 6 ? 1.0 : m < 9 ? 0.7 : 1.2;
    // baseline: ~1 disaster per 18 months, modulated by season
    if (Math.random() > seasonMul / 18) return;
    let total = 0; for (const d of list) total += d.weight;
    let r = Math.random() * total;
    for (const d of list) { r -= d.weight; if (r <= 0) { trigger(d.key); return; } }
  }

  // Decrement fires and damage buildings on fire
  function tickFires() {
    for (const t of SR.grid.tiles) {
      if (t.onFire > 0) {
        if (Math.random() < (1 - (t._fireCov || 0) * 0.5) * 0.3) {
          // damage
          if (t.zone && t.level > 0) t.level = Math.max(0, t.level - 1);
        }
        t.onFire--;
      }
    }
  }

  return { trigger, maybeTrigger, tickFires, list };
})();

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
          if ((t.road || t.zone) && Math.random() < 0.03) {
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
  ];

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
    // average ~ 1 disaster every 18 months
    if (Math.random() > 1 / 18) return;
    // Weighted random pick
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

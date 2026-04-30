// grid.js — tile grid model and terrain generator
'use strict';

SR.GRID_W = 64;
SR.GRID_H = 64;

// Tile shape:
// {
//   z: elevation (0..7)
//   t: 'water' | 'ground'
//   road: 0 none | 1 road | 2 highway
//   power: bool       // power line on this tile
//   pipe: bool        // water pipe under this tile
//   poweredBy: bool   // computed: connected to a power source
//   watered: bool     // computed: connected to water source
//   zone: null|'r'|'c'|'i'
//   building: null|key
//   bx, by: top-left corner if part of multi-tile building
//   level: 0..3 (zone build level)
//   pop: int
//   jobs: int
//   pollution: int (0..100)
//   crime: int (0..100)
//   land: int (0..100)
//   onFire: 0 or remaining ticks
// }

SR.grid = (() => {
  let W = SR.GRID_W, H = SR.GRID_H;
  let tiles = null;

  function idx(x, y) { return y * W + x; }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function get(x, y) { return inBounds(x, y) ? tiles[idx(x, y)] : null; }

  function newTile() {
    return {
      z: 0, t: 'ground',
      road: 0, power: false, pipe: false, maglev: false,
      poweredBy: false, watered: false,
      zone: null, building: null, bx: 0, by: 0,
      level: 0, pop: 0, jobs: 0,
      pollution: 0, crime: 0, land: 30,
      onFire: 0,
    };
  }

  function init(seed) {
    const u = SR.utils;
    const rng = u.makeRng(seed >>> 0 || 1337);
    W = SR.GRID_W; H = SR.GRID_H;
    tiles = new Array(W * H);
    for (let i = 0; i < tiles.length; i++) tiles[i] = newTile();

    // Generate terrain noise. We carve some rivers and a coastline.
    const elev = u.fbm(rng, W, H);
    // emphasize a lower band on one edge to make a coast
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = elev[y * W + x];
        // coastline bias: lower towards the south-east corner
        const d = (x + y) / (W + H); // 0..1
        v -= (1 - d) * 0.0;
        v += (d - 0.5) * 0.0;

        const t = tiles[idx(x, y)];
        // Map noise to elevation 0..7 with water below threshold
        if (v < 0.32) {
          t.t = 'water'; t.z = 0;
        } else {
          t.t = 'ground';
          // gentle elevation
          t.z = Math.max(0, Math.min(7, Math.floor((v - 0.32) * 10)));
        }
      }
    }

    // Carve a winding river
    let rx = (rng() * W) | 0;
    let ry = 0;
    let dir = 0;
    for (let s = 0; s < H * 2; s++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = rx + dx, ny = ry + dy;
          if (inBounds(nx, ny)) {
            const t = tiles[idx(nx, ny)];
            t.t = 'water'; t.z = 0;
          }
        }
      }
      // step
      ry += 1;
      if (rng() < 0.4) dir += (rng() < 0.5 ? -1 : 1);
      dir = u.clamp(dir, -1, 1);
      rx += dir;
      if (rx < 1) rx = 1; if (rx > W - 2) rx = W - 2;
      if (ry > H - 1) break;
    }

    // Smooth elevation a bit
    for (let i = 0; i < 2; i++) {
      const copy = tiles.map(t => t.z);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const t = tiles[idx(x, y)];
          if (t.t === 'water') continue;
          const sum = copy[idx(x - 1, y)] + copy[idx(x + 1, y)] + copy[idx(x, y - 1)] + copy[idx(x, y + 1)] + copy[idx(x, y)] * 4;
          t.z = Math.round(sum / 8);
        }
      }
    }
  }

  function clear(t) {
    t.road = 0; t.power = false; t.pipe = false; t.maglev = false;
    t.zone = null; t.building = null;
    t.level = 0; t.pop = 0; t.jobs = 0;
    t.bx = 0; t.by = 0; t.onFire = 0;
  }

  // Demolish whatever is on this tile (and any building footprint it belongs to).
  // Roads/zones are removed individually.
  function demolish(x, y) {
    const t = get(x, y);
    if (!t) return false;
    if (t.building) {
      // remove whole footprint
      const ox = t.bx, oy = t.by;
      const def = SR.BUILDINGS[t.building];
      const sz = def ? def.size : 1;
      for (let dy = 0; dy < sz; dy++) {
        for (let dx = 0; dx < sz; dx++) {
          const tt = get(ox + dx, oy + dy);
          if (tt) clear(tt);
        }
      }
      return true;
    }
    if (t.road || t.power || t.pipe || t.maglev || t.zone) {
      clear(t);
      return true;
    }
    return false;
  }

  function setMaglev(x, y) {
    const t = get(x, y);
    if (!t || t.t !== 'ground') return false;
    if (t.building) return false;
    t.maglev = true;
    t.zone = null;
    return true;
  }

  // Place a building footprint. Returns true on success.
  function place(x, y, key) {
    const def = SR.BUILDINGS[key];
    if (!def) return false;
    const sz = def.size;
    // Check footprint
    for (let dy = 0; dy < sz; dy++) {
      for (let dx = 0; dx < sz; dx++) {
        const t = get(x + dx, y + dy);
        if (!t) return false;
        if (t.t !== 'ground') return false;
        if (t.building) return false;
        if (t.road || t.zone) return false;
      }
    }
    // Road adjacency check
    if (def.needsRoad) {
      let ok = false;
      for (let dy = -1; dy <= sz; dy++) {
        for (let dx = -1; dx <= sz; dx++) {
          if (dx >= 0 && dx < sz && dy >= 0 && dy < sz) continue;
          const t = get(x + dx, y + dy);
          if (t && t.road) { ok = true; break; }
        }
        if (ok) break;
      }
      if (!ok) return false;
    }
    // Place
    for (let dy = 0; dy < sz; dy++) {
      for (let dx = 0; dx < sz; dx++) {
        const t = get(x + dx, y + dy);
        clear(t);
        t.building = key;
        t.bx = x; t.by = y;
        // Power plants and pumps act like power/water sources directly underneath
        if (def.power > 0) t.power = true;
        if (def.water > 0) t.pipe = true;
      }
    }
    // Construction pop-in animation marker on the top-left tile only
    const head = get(x, y);
    if (head) head._anim = { from: performance.now(), dur: 600 };
    return true;
  }

  function setRoad(x, y, level) {
    const t = get(x, y);
    if (!t || t.t !== 'ground') return false;
    if (t.building) return false;
    t.road = level;
    t.zone = null;
    return true;
  }

  function setPower(x, y) {
    const t = get(x, y);
    if (!t || t.t !== 'ground') return false;
    if (t.building) return true; // already conducts via building
    t.power = true;
    return true;
  }

  function setPipe(x, y) {
    const t = get(x, y);
    if (!t || t.t !== 'ground') return false;
    if (t.building) return true;
    t.pipe = true;
    return true;
  }

  function setZone(x, y, z) {
    const t = get(x, y);
    if (!t || t.t !== 'ground') return false;
    if (t.road || t.building || t.power) return false;
    t.zone = z;
    return true;
  }

  function size() { return { W, H }; }

  function snapshot() {
    // shallow snapshot for rendering checks (we mutate directly)
    return tiles;
  }

  return {
    init, get, idx, inBounds, demolish, place,
    setRoad, setPower, setPipe, setMaglev, setZone,
    size, snapshot,
    get tiles() { return tiles; },
    set tiles(v) { tiles = v; W = SR.GRID_W; H = SR.GRID_H; },
  };
})();

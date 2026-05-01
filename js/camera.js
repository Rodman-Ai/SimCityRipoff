// camera.js — pan / zoom and isometric projection
'use strict';

SR.camera = (() => {
  // Tile diamond size in pixels
  const TILE_W = 48; // diamond width
  const TILE_H = 24; // diamond height (half of width)
  const Z_STEP = 8;  // pixel rise per elevation step

  let cx = 0, cy = 0; // centered world position (in pixels of the iso plane)
  let zoom = 1;       // 0.5 .. 2
  let viewW = 1, viewH = 1;

  function setView(w, h) { viewW = w; viewH = h; }

  function center(x, y) {
    // World pixel at tile (x,y) elevation 0 — using formula below
    cx = (x - y) * (TILE_W / 2);
    cy = (x + y) * (TILE_H / 2);
  }

  function pan(dx, dy) {
    cx -= dx / zoom;
    cy -= dy / zoom;
  }

  function setZoom(z, ax, ay) {
    z = Math.max(0.25, Math.min(3.0, z)); // #61 broader zoom range — bird's-eye to close-up
    if (ax == null) {
      zoom = z;
      return;
    }
    // zoom around screen point (ax, ay)
    const before = screenToWorld(ax, ay);
    zoom = z;
    const after = screenToWorld(ax, ay);
    cx += before.wx - after.wx;
    cy += before.wy - after.wy;
  }

  function getZoom() { return zoom; }

  function tileToWorld(x, y, z) {
    return {
      wx: (x - y) * (TILE_W / 2),
      wy: (x + y) * (TILE_H / 2) - (z || 0) * Z_STEP,
    };
  }

  function worldToScreen(wx, wy) {
    return {
      sx: (wx - cx) * zoom + viewW / 2,
      sy: (wy - cy) * zoom + viewH / 2,
    };
  }

  function tileToScreen(x, y, z) {
    const w = tileToWorld(x, y, z);
    return worldToScreen(w.wx, w.wy);
  }

  function screenToWorld(sx, sy) {
    return {
      wx: (sx - viewW / 2) / zoom + cx,
      wy: (sy - viewH / 2) / zoom + cy,
    };
  }

  // Inverse iso projection (ignoring elevation; we ray test elevations afterwards)
  function screenToTile(sx, sy) {
    const w = screenToWorld(sx, sy);
    // wx = (x - y) * TILE_W/2; wy = (x + y) * TILE_H/2  (ignoring z)
    const x = w.wx / TILE_W + w.wy / TILE_H;
    const y = -w.wx / TILE_W + w.wy / TILE_H;
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  // Smarter pick that accounts for elevation by checking nearby tiles top-down
  function screenToTileWithElev(sx, sy) {
    const base = screenToTile(sx, sy);
    const u = SR.utils;
    let best = null;
    // Check tiles in a small window because elevation lifts visuals up
    for (let dy = -8; dy <= 4; dy++) {
      for (let dx = -8; dx <= 4; dx++) {
        const tx = base.x + dx, ty = base.y + dy;
        const t = SR.grid.get(tx, ty);
        if (!t) continue;
        const sc = tileToScreen(tx, ty, t.z);
        // Diamond at sc.sx, sc.sy with half-width = TILE_W/2 * zoom
        const hw = (TILE_W / 2) * zoom;
        const hh = (TILE_H / 2) * zoom;
        const px = sx - sc.sx;
        const py = sy - sc.sy;
        // diamond hit test: |px|/hw + |py|/hh <= 1
        if (Math.abs(px) / hw + Math.abs(py) / hh <= 1) {
          if (!best || ty + tx > best.y + best.x) best = { x: tx, y: ty };
        }
      }
    }
    return best || base;
  }

  return {
    TILE_W, TILE_H, Z_STEP,
    setView, center, pan, setZoom, getZoom,
    tileToWorld, worldToScreen, tileToScreen,
    screenToWorld, screenToTile, screenToTileWithElev,
    get cx() { return cx; }, set cx(v) { cx = v; },
    get cy() { return cy; }, set cy(v) { cy = v; },
  };
})();

// input.js — mouse, touch and keyboard handling for build tools and camera
'use strict';

SR.input = (() => {
  let canvas;
  let dragging = false;
  let dragMode = null; // 'pan' | 'paint'
  let lastX = 0, lastY = 0;
  let lastTileX = -1, lastTileY = -1; // last tile we applied a paint to
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let pinchCenter = null;
  const cursor = { x: 0, y: 0, sx: 0, sy: 0 };

  // Bresenham line — call applyAt on every tile from (x0,y0) to (x1,y1)
  // so fast drags don't skip squares.
  function paintLine(x0, y0, x1, y1) {
    if (x0 < 0 || y0 < 0) { SR.tools.applyAt(x1, y1); return; }
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    let safety = 256;
    while (safety-- > 0) {
      SR.tools.applyAt(x, y);
      if (x === x1 && y === y1) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
  }

  function init(c) {
    canvas = c;

    // Pointer (mouse + touch)
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    document.addEventListener('keydown', onKey);
  }

  function localXY(e) {
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / r.width;
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
  }

  function updateCursor(sx, sy) {
    cursor.sx = sx; cursor.sy = sy;
    const t = SR.camera.screenToTileWithElev(sx, sy);
    cursor.x = t.x;
    cursor.y = t.y;
    SR.ui.updateCursorChip();
  }

  function onMouseDown(e) {
    e.preventDefault();
    const p = localXY(e);
    lastX = p.x; lastY = p.y;
    updateCursor(p.x, p.y);
    if (e.button === 2 || e.shiftKey) {
      dragMode = 'pan';
      dragging = true;
    } else {
      dragMode = 'paint';
      dragging = true;
      lastTileX = cursor.x; lastTileY = cursor.y;
      SR.tools.applyAt(cursor.x, cursor.y);
    }
  }
  function onMouseMove(e) {
    const p = localXY(e);
    updateCursor(p.x, p.y);
    if (!dragging) return;
    const dx = p.x - lastX, dy = p.y - lastY;
    lastX = p.x; lastY = p.y;
    if (dragMode === 'pan') {
      SR.camera.pan(dx, dy);
    } else if (dragMode === 'paint') {
      if (cursor.x !== lastTileX || cursor.y !== lastTileY) {
        paintLine(lastTileX, lastTileY, cursor.x, cursor.y);
        lastTileX = cursor.x; lastTileY = cursor.y;
      }
    }
  }
  function onMouseUp() { dragging = false; dragMode = null; lastTileX = -1; lastTileY = -1; }

  function onWheel(e) {
    e.preventDefault();
    const p = localXY(e);
    const dz = -Math.sign(e.deltaY) * 0.1;
    SR.camera.setZoom(SR.camera.getZoom() + dz, p.x, p.y);
  }

  // ---- Touch ----
  let lastTap = 0;
  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const p = localXY(t);
      lastX = p.x; lastY = p.y;
      updateCursor(p.x, p.y);
      const now = performance.now();
      if (now - lastTap < 280) {
        // double tap = pan mode
        dragMode = 'pan';
      } else {
        dragMode = 'paint';
        lastTileX = cursor.x; lastTileY = cursor.y;
        SR.tools.applyAt(cursor.x, cursor.y);
      }
      lastTap = now;
      dragging = true;
    } else if (e.touches.length === 2) {
      dragging = true;
      dragMode = 'pinch';
      const a = localXY(e.touches[0]);
      const b = localXY(e.touches[1]);
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStartZoom = SR.camera.getZoom();
      pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      lastX = pinchCenter.x; lastY = pinchCenter.y;
    }
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragMode !== 'pinch') {
      const t = e.touches[0];
      const p = localXY(t);
      const dx = p.x - lastX, dy = p.y - lastY;
      lastX = p.x; lastY = p.y;
      updateCursor(p.x, p.y);
      if (dragMode === 'pan') SR.camera.pan(dx, dy);
      else if (dragMode === 'paint') {
        if (cursor.x !== lastTileX || cursor.y !== lastTileY) {
          paintLine(lastTileX, lastTileY, cursor.x, cursor.y);
          lastTileX = cursor.x; lastTileY = cursor.y;
        }
      }
    } else if (e.touches.length === 2) {
      const a = localXY(e.touches[0]);
      const b = localXY(e.touches[1]);
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // pinch zoom
      const newZoom = pinchStartZoom * (dist / pinchStartDist);
      SR.camera.setZoom(newZoom, center.x, center.y);
      // two-finger pan
      const dx = center.x - lastX, dy = center.y - lastY;
      lastX = center.x; lastY = center.y;
      SR.camera.pan(dx, dy);
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length === 0) { dragging = false; dragMode = null; lastTileX = -1; lastTileY = -1; }
    else if (e.touches.length === 1 && dragMode === 'pinch') {
      // continue as single-finger pan
      dragMode = 'pan';
      const p = localXY(e.touches[0]);
      lastX = p.x; lastY = p.y;
    }
  }

  // ---- Keyboard ----
  const keymap = {
    'b': 'bulldoze', 'r': 'road', 'h': 'highway', 'p': 'power', 'w': 'pipe',
    '1': 'zone_r', '2': 'zone_c', '3': 'zone_i',
    '4': 'build_police', '5': 'build_fire', '6': 'build_hospital',
    '7': 'build_school', '8': 'build_park',
    '9': 'build_solar', '0': 'build_wind',
  };
  function onKey(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (keymap[k]) { SR.tools.select(keymap[k]); e.preventDefault(); return; }
    switch (k) {
      case 'escape': SR.tools.select('select'); break;
      case ' ': SR.game.setSpeed(SR.game.speed === 0 ? 1 : 0); e.preventDefault(); break;
      case '+': case '=': SR.camera.setZoom(SR.camera.getZoom() + 0.2); break;
      case '-': SR.camera.setZoom(SR.camera.getZoom() - 0.2); break;
      case 'arrowup': SR.camera.pan(0, 60); break;
      case 'arrowdown': SR.camera.pan(0, -60); break;
      case 'arrowleft': SR.camera.pan(60, 0); break;
      case 'arrowright': SR.camera.pan(-60, 0); break;
      case 's': if (e.ctrlKey || e.metaKey) { e.preventDefault(); SR.save.save(); SR.ui.alert('CITY SAVED', 'good'); } break;
    }
  }

  return { init, cursor };
})();

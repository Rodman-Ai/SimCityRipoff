// renderer.js — isometric canvas renderer
'use strict';

SR.renderer = (() => {
  let canvas, ctx;
  let dpr = 1;
  let frame = 0;
  let glitchUntil = 0;

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(2, Math.round(r.width * dpr));
    canvas.height = Math.max(2, Math.round(r.height * dpr));
    SR.camera.setView(canvas.width, canvas.height);
    const ov = document.getElementById('overlay');
    if (ov) {
      ov.width = canvas.width;
      ov.height = canvas.height;
    }
  }

  function triggerGlitch(ms) { glitchUntil = performance.now() + (ms || 800); }

  // Draw a diamond polygon (top-down iso tile face)
  function diamondPath(sx, sy, hw, hh) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - hh);
    ctx.lineTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx - hw, sy);
    ctx.closePath();
  }

  // Compute view-tile bounds to skip offscreen tiles
  function viewBounds() {
    const cam = SR.camera;
    const W = SR.GRID_W, H = SR.GRID_H;
    const corners = [
      cam.screenToTile(0, 0),
      cam.screenToTile(canvas.width, 0),
      cam.screenToTile(0, canvas.height),
      cam.screenToTile(canvas.width, canvas.height),
    ];
    let minX = W, minY = H, maxX = 0, maxY = 0;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    const pad = 6;
    return {
      x0: Math.max(0, minX - pad), y0: Math.max(0, minY - pad),
      x1: Math.min(W - 1, maxX + pad), y1: Math.min(H - 1, maxY + pad),
    };
  }

  function shade(hex, amt) {
    // amt = -1..1
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
    g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
    b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Tile base colors
  function tileColor(t) {
    if (t.t === 'water') {
      // animate water hue subtly
      const v = 0.05 + 0.05 * Math.sin(frame * 0.04 + t.z);
      return ['#06121b', '#0a1d2c', '#102a3e'][Math.min(2, Math.floor((0.1 + v) * 20) & 3)] || '#0a1d2c';
    }
    // Ground — dim asphalt/dirt with orange tint by elevation
    const base = ['#1a120a', '#1f160c', '#251a0e', '#2b1e10', '#322212', '#382614', '#3e2a16', '#442e18'];
    return base[Math.min(7, Math.max(0, t.z))];
  }

  function drawTileBase(sx, sy, hw, hh, t) {
    // top diamond
    ctx.fillStyle = tileColor(t);
    diamondPath(sx, sy, hw, hh);
    ctx.fill();

    // sides if elevated
    if (t.z > 0 && t.t === 'ground') {
      const dz = t.z * SR.camera.Z_STEP * SR.camera.getZoom();
      // left side
      ctx.fillStyle = shade(tileColor(t), -0.06);
      ctx.beginPath();
      ctx.moveTo(sx - hw, sy);
      ctx.lineTo(sx, sy + hh);
      ctx.lineTo(sx, sy + hh + dz);
      ctx.lineTo(sx - hw, sy + dz);
      ctx.closePath();
      ctx.fill();
      // right side
      ctx.fillStyle = shade(tileColor(t), -0.12);
      ctx.beginPath();
      ctx.moveTo(sx, sy + hh);
      ctx.lineTo(sx + hw, sy);
      ctx.lineTo(sx + hw, sy + dz);
      ctx.lineTo(sx, sy + hh + dz);
      ctx.closePath();
      ctx.fill();
    }

    // grid line
    ctx.strokeStyle = 'rgba(255,106,0,0.07)';
    ctx.lineWidth = 1;
    diamondPath(sx, sy, hw, hh);
    ctx.stroke();
  }

  function drawWaterEdge(sx, sy, hw, hh) {
    // shimmer accent line on water
    ctx.strokeStyle = 'rgba(58,215,255,0.18)';
    ctx.beginPath();
    const t = (frame * 0.05) % 1;
    ctx.moveTo(sx - hw + hw * t, sy);
    ctx.lineTo(sx + hw - hw * t, sy);
    ctx.stroke();
  }

  function drawZone(sx, sy, hw, hh, t) {
    const v = SR.ZONE_VIS[t.zone];
    if (!v) return;
    if (t.level > 0) return; // building drawn instead
    ctx.fillStyle = v.tint[0];
    diamondPath(sx, sy, hw * 0.85, hh * 0.85);
    ctx.fill();
    ctx.strokeStyle = v.glow;
    ctx.lineWidth = 1;
    diamondPath(sx, sy, hw * 0.85, hh * 0.85);
    ctx.stroke();
    // small letter glyph
    ctx.fillStyle = v.glow;
    ctx.font = (Math.floor(hh) + 'px') + ' ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.zone.toUpperCase(), sx, sy);
  }

  function drawRoad(sx, sy, hw, hh, t, x, y) {
    // Connect to neighbours
    const left = SR.grid.get(x, y - 1);
    const right = SR.grid.get(x, y + 1);
    const up = SR.grid.get(x - 1, y);
    const down = SR.grid.get(x + 1, y);
    const isHigh = t.road === 2;
    const conLeft = left && left.road;
    const conRight = right && right.road;
    const conUp = up && up.road;
    const conDown = down && down.road;

    // Asphalt diamond
    ctx.fillStyle = isHigh ? '#0a0a0a' : '#0d0d0e';
    diamondPath(sx, sy, hw, hh);
    ctx.fill();

    // Lane stripe color
    const stripe = isHigh ? '#ffaa1f' : '#ff6a00';
    ctx.strokeStyle = stripe;
    ctx.lineWidth = isHigh ? 2 : 1;
    ctx.shadowColor = stripe;
    ctx.shadowBlur = isHigh ? 10 : 5;

    ctx.beginPath();
    if (conLeft || conRight || (!conLeft && !conRight && !conUp && !conDown)) {
      // axis 1: from left-corner to right-corner of diamond
      ctx.moveTo(sx - hw * (conLeft ? 1 : 0.45), sy - (conLeft ? 0 : hh * 0.0));
      ctx.lineTo(sx + hw * (conRight ? 1 : 0.45), sy);
    }
    if (conUp || conDown) {
      ctx.moveTo(sx - (conUp ? 0 : 0), sy - hh * (conUp ? 1 : 0.45));
      ctx.lineTo(sx, sy + hh * (conDown ? 1 : 0.45));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawPower(sx, sy, hw, hh) {
    ctx.strokeStyle = '#ffd23a';
    ctx.shadowColor = '#ffaa1f';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - hh * 0.6);
    ctx.lineTo(sx, sy + hh * 0.6);
    ctx.moveTo(sx - hw * 0.6, sy);
    ctx.lineTo(sx + hw * 0.6, sy);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // pole
    ctx.fillStyle = '#ffaa1f';
    ctx.fillRect(sx - 1, sy - hh * 0.7, 2, hh * 0.7);
  }

  function drawPipe(sx, sy, hw, hh) {
    ctx.strokeStyle = 'rgba(58,215,255,0.4)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - hw * 0.6, sy);
    ctx.lineTo(sx + hw * 0.6, sy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawZoneBuilding(sx, sy, hw, hh, t) {
    const v = SR.ZONE_VIS[t.zone];
    if (!v) return;
    const lvl = SR.utils.clamp(t.level, 1, 3);
    const h = (8 + lvl * 14) * SR.camera.getZoom();
    // base color tinted by level
    const body = v.tint[lvl] || v.tint[3];
    // Building footprint (single tile)
    const bw = hw * 0.7;
    const bh = hh * 0.7;
    // top
    ctx.fillStyle = shade(body, 0.05);
    ctx.beginPath();
    ctx.moveTo(sx, sy - bh - h);
    ctx.lineTo(sx + bw, sy - h);
    ctx.lineTo(sx, sy + bh - h);
    ctx.lineTo(sx - bw, sy - h);
    ctx.closePath();
    ctx.fill();
    // left
    ctx.fillStyle = shade(body, -0.1);
    ctx.beginPath();
    ctx.moveTo(sx - bw, sy - h);
    ctx.lineTo(sx, sy + bh - h);
    ctx.lineTo(sx, sy + bh);
    ctx.lineTo(sx - bw, sy);
    ctx.closePath();
    ctx.fill();
    // right
    ctx.fillStyle = shade(body, -0.2);
    ctx.beginPath();
    ctx.moveTo(sx, sy + bh - h);
    ctx.lineTo(sx + bw, sy - h);
    ctx.lineTo(sx + bw, sy);
    ctx.lineTo(sx, sy + bh);
    ctx.closePath();
    ctx.fill();
    // neon edge — use zone glow
    ctx.strokeStyle = v.glow;
    ctx.lineWidth = 1;
    ctx.shadowColor = v.glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(sx - bw, sy - h);
    ctx.lineTo(sx, sy - bh - h);
    ctx.lineTo(sx + bw, sy - h);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // windows — pixel rows
    const rows = lvl + 1;
    const cols = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = sx - bw * 0.4 + (bw * 0.4) * c;
        const wy = sy - h + bh * 0.2 + (h - bh * 0.4) * (r / rows);
        const lit = ((SR.game.minute + r * 7 + c * 13 + (sx | 0)) % 9) < 6;
        ctx.fillStyle = lit ? '#ffaa1f' : '#221308';
        ctx.fillRect(wx | 0, wy | 0, 2, 2);
      }
    }

    // unpowered indicator
    if (t.pop > 0 && !t.poweredBy) {
      ctx.fillStyle = '#ff3030';
      ctx.font = (Math.floor(hh * 0.9) + 'px ') + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', sx + bw * 0.5, sy - h);
    }
  }

  function drawSpecialBuilding(sx, sy, hw, hh, t) {
    const def = SR.BUILDINGS[t.building];
    if (!def) return;
    // Only draw on the top-left footprint tile
    if (t.bx !== gridXFromScreenContext.x || t.by !== gridXFromScreenContext.y) {
      return;
    }
    const sz = def.size;
    // height by category and size
    let h = (8 + sz * 12) * SR.camera.getZoom();
    if (def.category === 'landmark') h *= 2.4;
    if (def.category === 'power') h *= 1.5;

    // For multi-tile, expand the diamond footprint
    const bw = hw * sz * 0.92;
    const bh = hh * sz * 0.92;
    // Footprint center in iso: same x as top-left, but shifted down by (sz-1)*hh
    const cx = sx;
    const cy = sy + (sz - 1) * hh;

    // top
    ctx.fillStyle = shade(def.color, 0.06);
    ctx.beginPath();
    ctx.moveTo(cx, cy - bh - h);
    ctx.lineTo(cx + bw, cy - h);
    ctx.lineTo(cx, cy + bh - h);
    ctx.lineTo(cx - bw, cy - h);
    ctx.closePath();
    ctx.fill();
    // left
    ctx.fillStyle = shade(def.color, -0.1);
    ctx.beginPath();
    ctx.moveTo(cx - bw, cy - h);
    ctx.lineTo(cx, cy + bh - h);
    ctx.lineTo(cx, cy + bh);
    ctx.lineTo(cx - bw, cy);
    ctx.closePath();
    ctx.fill();
    // right
    ctx.fillStyle = shade(def.color, -0.2);
    ctx.beginPath();
    ctx.moveTo(cx, cy + bh - h);
    ctx.lineTo(cx + bw, cy - h);
    ctx.lineTo(cx + bw, cy);
    ctx.lineTo(cx, cy + bh);
    ctx.closePath();
    ctx.fill();

    // Neon trim
    ctx.strokeStyle = def.trim;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = def.trim;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx - bw, cy - h);
    ctx.lineTo(cx, cy - bh - h);
    ctx.lineTo(cx + bw, cy - h);
    ctx.stroke();
    // antenna for landmarks
    if (def.category === 'landmark') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - bh - h);
      ctx.lineTo(cx, cy - bh - h - 12 * SR.camera.getZoom());
      ctx.stroke();
      // pulsing tip
      const blink = ((frame >> 3) & 1) ? def.trim : '#ffffff';
      ctx.fillStyle = blink;
      ctx.beginPath();
      ctx.arc(cx, cy - bh - h - 12 * SR.camera.getZoom(), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // glyph
    ctx.fillStyle = def.trim;
    ctx.font = (Math.floor(hh * 1.2) + 'px ') + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.glyph, cx, cy - h * 0.5);

    // Smoke for coal
    if (t.building === 'coal' && (frame & 3) === 0) {
      // ephemeral particle in overlay (drawn here for simplicity)
      ctx.fillStyle = 'rgba(120,120,120,0.4)';
      const px = cx + (Math.sin(frame * 0.1) * 4);
      const py = cy - h - 14 - (frame % 30);
      ctx.fillRect(px, py, 4, 4);
    }
  }

  // Hack-ish: pass current grid coord into drawSpecialBuilding via closure-friendly object
  const gridXFromScreenContext = { x: 0, y: 0 };

  function drawCursorHighlight() {
    const cur = SR.input.cursor;
    if (!cur) return;
    const cam = SR.camera;
    const t = SR.grid.get(cur.x, cur.y);
    if (!t) return;
    const sc = cam.tileToScreen(cur.x, cur.y, t.z);
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const tool = SR.tools.current;
    let col = '#ffaa1f';
    let sz = 1;
    if (tool && tool.startsWith('build_')) {
      const key = SR.TOOL_TO_BUILDING[tool];
      const def = SR.BUILDINGS[key];
      if (def) sz = def.size;
    }
    // Highlight sz x sz footprint
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    for (let dy = 0; dy < sz; dy++) {
      for (let dx = 0; dx < sz; dx++) {
        const tt = SR.grid.get(cur.x + dx, cur.y + dy);
        if (!tt) continue;
        const s2 = cam.tileToScreen(cur.x + dx, cur.y + dy, tt.z);
        diamondPath(s2.sx, s2.sy, hw, hh);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function render() {
    frame++;
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // subtle grid backdrop (parallax stars)
    drawStars();

    const cam = SR.camera;
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();

    const b = viewBounds();
    // iso draw order: from back (smallest x+y) to front
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        // skip if far offscreen
        if (sc.sx < -hw * 4 || sc.sx > canvas.width + hw * 4 ||
            sc.sy < -hh * 8 || sc.sy > canvas.height + hh * 12) continue;

        drawTileBase(sc.sx, sc.sy, hw, hh, t);
        if (t.t === 'water' && (frame % 8) === 0) drawWaterEdge(sc.sx, sc.sy, hw, hh);

        if (t.road) drawRoad(sc.sx, sc.sy, hw, hh, t, x, y);
        else if (t.zone && t.level === 0) drawZone(sc.sx, sc.sy, hw, hh, t);
        if (t.power && !t.building) drawPower(sc.sx, sc.sy, hw, hh);
        if (t.pipe && !t.building) drawPipe(sc.sx, sc.sy, hw, hh);
      }
    }

    // Second pass: building tops, drawn in correct iso (back→front) order.
    const dStart = b.x0 + b.y0;
    const dEnd = b.x1 + b.y1;
    for (let d = dStart; d <= dEnd; d++) {
      const xMin = Math.max(b.x0, d - b.y1);
      const xMax = Math.min(b.x1, d - b.y0);
      for (let x = xMin; x <= xMax; x++) {
        const y = d - x;
        const t = SR.grid.get(x, y);
        if (!t) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        if (sc.sx < -hw * 4 || sc.sx > canvas.width + hw * 4 ||
            sc.sy < -hh * 8 || sc.sy > canvas.height + hh * 12) continue;

        if (t.zone && t.level > 0) drawZoneBuilding(sc.sx, sc.sy, hw, hh, t);
        if (t.building) {
          gridXFromScreenContext.x = x; gridXFromScreenContext.y = y;
          drawSpecialBuilding(sc.sx, sc.sy, hw, hh, t);
        }
        if (t.onFire > 0) drawFire(sc.sx, sc.sy, hw, hh);
      }
    }

    drawCursorHighlight();

    // Overlay glitch for disasters
    if (performance.now() < glitchUntil) {
      const off = (Math.random() * 6 - 3) | 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      ctx.drawImage(canvas, off, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawFire(sx, sy, hw, hh) {
    const r = (frame % 8) + 4;
    ctx.fillStyle = 'rgba(255,80,0,0.6)';
    ctx.beginPath();
    ctx.arc(sx, sy - r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,40,0.8)';
    ctx.beginPath();
    ctx.arc(sx, sy - r * 0.7, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Background star/parallax field — subtle
  let starsBuf = null;
  function drawStars() {
    if (!starsBuf) {
      starsBuf = document.createElement('canvas');
      starsBuf.width = 400; starsBuf.height = 400;
      const s = starsBuf.getContext('2d');
      const r = SR.utils.makeRng(98765);
      for (let i = 0; i < 220; i++) {
        const x = r() * 400;
        const y = r() * 400;
        const a = 0.05 + r() * 0.25;
        s.fillStyle = `rgba(255,170,31,${a})`;
        s.fillRect(x | 0, y | 0, 1, 1);
      }
      // a few neon dots
      for (let i = 0; i < 30; i++) {
        const x = r() * 400, y = r() * 400;
        s.fillStyle = `rgba(255,${30 + r() * 100 | 0},${r() < 0.5 ? 30 : 200},0.4)`;
        s.fillRect(x | 0, y | 0, 1, 1);
      }
    }
    const cam = SR.camera;
    const ox = -cam.cx * 0.05;
    const oy = -cam.cy * 0.05;
    const W = canvas.width, H = canvas.height;
    for (let y = -((oy % 400 + 400) % 400); y < H; y += 400) {
      for (let x = -((ox % 400 + 400) % 400); x < W; x += 400) {
        ctx.drawImage(starsBuf, x, y);
      }
    }
  }

  return { init, resize, render, triggerGlitch };
})();

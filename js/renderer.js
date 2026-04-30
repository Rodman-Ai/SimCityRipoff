// renderer.js — isometric canvas renderer
'use strict';

SR.renderer = (() => {
  let canvas, ctx;
  let dpr = 1;
  let frame = 0;
  let glitchUntil = 0;
  let flashUntil = 0;
  let flashColor = 'rgba(255,255,255,0.7)';

  // 0..1 — 0=full daylight, 1=deep night. Updated each frame from game.minute.
  let darkness = 0;
  // 0..1 — peak around dawn (0.25) and dusk (0.75)
  let dawnDusk = 0;
  function getDarkness() { return darkness; }

  // ----- Particle system -----
  // Particles are simple objects with a `kind` field; each kind has its own
  // update + draw step. We keep them in a single ring-buffer-ish array.
  const particles = [];
  const MAX_PARTICLES = 240;

  function addParticle(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    p.born = performance.now();
    particles.push(p);
  }

  function spawnSmoke(tx, ty, opts) {
    opts = opts || {};
    addParticle({
      kind: 'smoke', tx, ty,
      ox: (Math.random() - 0.5) * 6,
      oy: -8 - Math.random() * 6,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.4 - Math.random() * 0.3,
      life: 1800 + Math.random() * 1200,
      size: 3 + Math.random() * 4,
      color: opts.color || 'rgba(120,120,120,0.55)',
    });
  }

  function spawnFloater(tx, ty, text, color) {
    addParticle({
      kind: 'floater', tx, ty,
      ox: (Math.random() - 0.5) * 8,
      oy: -16,
      vy: -0.6,
      life: 1600,
      text, color: color || '#ffd23a',
    });
  }

  function spawnVehicle(fromX, fromY, toX, toY, color) {
    addParticle({
      kind: 'vehicle',
      fromX, fromY, toX, toY,
      life: 2400 + Math.hypot(toX - fromX, toY - fromY) * 80,
      color: color || '#3ad7ff',
      blink: 0,
    });
  }

  function flashScreen(ms, color) {
    flashUntil = performance.now() + (ms || 200);
    if (color) flashColor = color;
  }

  function clearParticles() { particles.length = 0; }

  function drawParticles(now) {
    const cam = SR.camera;
    const zoom = cam.getZoom();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = now - p.born;
      if (age > p.life) { particles.splice(i, 1); continue; }
      const t = age / p.life;
      const fade = 1 - t;
      if (p.kind === 'smoke') {
        p.ox += p.vx;
        p.oy += p.vy;
        const sc = cam.tileToScreen(p.tx, p.ty, 0);
        ctx.globalAlpha = fade * 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sc.sx + p.ox * zoom, sc.sy + p.oy * zoom, p.size * (1 + t * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'floater') {
        p.oy += p.vy;
        p.vy *= 0.985;
        const sc = cam.tileToScreen(p.tx, p.ty, 0);
        ctx.globalAlpha = fade;
        ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillText(p.text, sc.sx + p.ox * zoom, sc.sy + p.oy * zoom);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else if (p.kind === 'vehicle') {
        const u = SR.utils.clamp(t * 2, 0, 1); // forward leg in first half
        const v = SR.utils.clamp((t - 0.5) * 2, 0, 1);
        const lerp = (a, b, k) => a + (b - a) * k;
        let cx, cy;
        if (t < 0.5) { cx = lerp(p.fromX, p.toX, u); cy = lerp(p.fromY, p.toY, u); }
        else         { cx = lerp(p.toX, p.fromX, v); cy = lerp(p.toY, p.fromY, v); }
        const sc = cam.tileToScreen(cx, cy, 0);
        ctx.fillStyle = ((frame >> 3) & 1) ? p.color : '#fff';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillRect((sc.sx | 0) - 1, (sc.sy | 0) - 1, 3, 3);
        ctx.shadowBlur = 0;
      }
    }
  }
  // ----- end particles -----

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

  function drawWaterEdge(sx, sy, hw, hh, x, y) {
    // Two moving wave lines plus a faint sparkle
    const phase = (frame * 0.04 + x * 0.31 + y * 0.17);
    for (let i = 0; i < 2; i++) {
      const t = ((phase + i * 0.5) % 1);
      const yo = (i - 0.5) * hh * 0.35;
      const wAlpha = 0.18 + 0.18 * Math.sin(phase * 6 + i);
      ctx.strokeStyle = `rgba(58,215,255,${wAlpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - hw * 0.6 + hw * t * 0.4, sy + yo);
      ctx.lineTo(sx + hw * 0.6 - hw * (1 - t) * 0.4, sy + yo);
      ctx.stroke();
    }
    if ((frame + x * 7 + y * 13) % 23 === 0) {
      ctx.fillStyle = 'rgba(180,230,255,0.7)';
      ctx.fillRect(sx + (Math.sin(phase * 11) * hw * 0.3) | 0, sy - hh * 0.2 | 0, 1, 1);
    }
  }

  // Animated traffic dots moving along road tiles. Slot count scales with
  // adjacent zone density to suggest busier streets.
  function drawTraffic(sx, sy, hw, hh, t, x, y) {
    const left = SR.grid.get(x, y - 1);
    const right = SR.grid.get(x, y + 1);
    const up = SR.grid.get(x - 1, y);
    const down = SR.grid.get(x + 1, y);
    const horiz = (left && left.road) || (right && right.road);
    const vert = (up && up.road) || (down && down.road);
    if (!horiz && !vert) return;

    // Density: count adjacent built-up zones to scale traffic
    let density = 1;
    for (const n of [left, right, up, down]) {
      if (n && n.zone && n.level > 0) density += n.level;
    }
    const speed = (t.road === 2 ? 0.012 : 0.008);
    const car = t.road === 2 ? '#ffd23a' : '#ff8a1f';

    // E/W diamond axis: from (sx-hw, sy) to (sx+hw, sy)
    if (horiz) {
      const slots = Math.min(3, density);
      for (let i = 0; i < slots; i++) {
        const tt = ((frame * speed) + (x * 0.13 + y * 0.07) + i / slots) % 1;
        const px = sx - hw + tt * (2 * hw);
        const py = sy - hh * 0.18;
        ctx.fillStyle = car;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      // opposite lane (different direction)
      for (let i = 0; i < slots; i++) {
        const tt = (1 - (((frame * speed) + (x * 0.27 + y * 0.21) + i / slots) % 1));
        const px = sx - hw + tt * (2 * hw);
        const py = sy + hh * 0.18;
        ctx.fillStyle = car;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }
    if (vert) {
      const slots = Math.min(3, density);
      for (let i = 0; i < slots; i++) {
        const tt = ((frame * speed) + (x * 0.41 + y * 0.11) + i / slots) % 1;
        const px = sx - hw * 0.18;
        const py = sy - hh + tt * (2 * hh);
        ctx.fillStyle = car;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
      for (let i = 0; i < slots; i++) {
        const tt = (1 - (((frame * speed) + (x * 0.19 + y * 0.37) + i / slots) % 1));
        const px = sx + hw * 0.18;
        const py = sy - hh + tt * (2 * hh);
        ctx.fillStyle = car;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }
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

  function drawMaglev(sx, sy, hw, hh, x, y) {
    // Magenta neon line connecting to maglev neighbors with a moving glow pulse.
    const u = SR.grid.get(x - 1, y);
    const d = SR.grid.get(x + 1, y);
    const l = SR.grid.get(x, y - 1);
    const r = SR.grid.get(x, y + 1);
    ctx.strokeStyle = '#ff2acc';
    ctx.shadowColor = '#ff2acc';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if ((l && l.maglev) || (r && r.maglev)) {
      ctx.moveTo(sx - hw * 0.7, sy);
      ctx.lineTo(sx + hw * 0.7, sy);
    }
    if ((u && u.maglev) || (d && d.maglev)) {
      ctx.moveTo(sx, sy - hh * 0.7);
      ctx.lineTo(sx, sy + hh * 0.7);
    }
    if (!(l && l.maglev) && !(r && r.maglev) && !(u && u.maglev) && !(d && d.maglev)) {
      // isolated tile — draw a small node
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // pulse dot
    const pulse = ((frame + x * 5 + y * 3) % 60) / 60;
    ctx.fillStyle = '#ffaadc';
    ctx.fillRect((sx - hw * 0.6 + hw * 1.2 * pulse) | 0, (sy | 0) - 1, 2, 2);
  }

  function _animScale(t) {
    if (!t._anim) return 1;
    const elapsed = performance.now() - t._anim.from;
    if (elapsed >= t._anim.dur) { t._anim = null; return 1; }
    const k = elapsed / t._anim.dur;
    // easeOutBack-ish: overshoots slightly past 1 then settles
    const s = 1.7;
    return 1 + ((k - 1) * (k - 1) * ((s + 1) * (k - 1) + s));
  }

  function drawZoneBuilding(sx, sy, hw, hh, t, x, y) {
    const v = SR.ZONE_VIS[t.zone];
    if (!v) return;
    const lvl = SR.utils.clamp(t.level, 1, 3);
    // Deterministic per-tile variation: heightMul, footprintMul, window pattern
    const h32 = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const heightMul = 0.7 + ((h32 & 0xff) / 255) * 0.7;          // 0.7..1.4
    const footMul = 0.55 + (((h32 >>> 8) & 0xff) / 255) * 0.30;  // 0.55..0.85
    const wPat = ((h32 >>> 16) & 7);                              // 0..7
    const tint = ((h32 >>> 19) & 0xf) / 15 - 0.5;                // -0.5..0.5
    const animK = _animScale(t);
    const h = (8 + lvl * 14) * SR.camera.getZoom() * heightMul * animK;
    const body = shade(v.tint[lvl] || v.tint[3], tint * 0.06);
    const bw = hw * footMul * animK;
    const bh = hh * footMul * animK;
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

    // windows — pixel rows. At night more windows are lit; pattern varies per-tile.
    const rows = lvl + 2;
    const cols = 2;
    const offHour = ((SR.game.minute / 60) | 0) & 0xff;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = sx - bw * 0.4 + (bw * 0.4) * c;
        const wy = sy - h + bh * 0.2 + (h - bh * 0.4) * (r / rows);
        // Threshold per window depends on its own seed plus night intensity.
        const seed = (h32 ^ (r * 2654435769) ^ (c * 40503) ^ (wPat * 11)) >>> 0;
        const flicker = (seed + offHour) & 15;
        const litThresh = 6 + ((1 - darkness) * 8); // night → lower threshold → more lit
        const lit = flicker < (16 - litThresh);
        if (lit) {
          ctx.fillStyle = '#ffd28a';
          ctx.fillRect(wx | 0, wy | 0, 2, 2);
        } else {
          ctx.fillStyle = '#221308';
          ctx.fillRect(wx | 0, wy | 0, 2, 2);
        }
      }
    }
    // Soft neon ground halo when night
    if (darkness > 0.2 && lvl >= 2) {
      const glow = darkness * 0.35;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,150,40,${glow.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy + bh * 0.4, bw * 1.2, bh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
    const animK = _animScale(t);
    // height by category and size
    let h = (8 + sz * 12) * SR.camera.getZoom() * animK;
    if (def.category === 'landmark') h *= 2.4;
    if (def.category === 'power') h *= 1.5;

    // For multi-tile, expand the diamond footprint
    const bw = hw * sz * 0.92 * animK;
    const bh = hh * sz * 0.92 * animK;
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

    // (Coal/fusion smoke now produced by the particle system.)
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

  function updateDayNight() {
    // 1 in-game day = 1440 minutes. Game.minute increments per real-time frame
    // and per-month tick — fine grained enough for a smooth cycle.
    const phase = ((SR.game.minute % 1440) / 1440 + 0.25) % 1; // shift so dawn ~ 0
    // sun intensity: 1 at noon, 0 at midnight, smooth
    const sun = Math.max(0, Math.sin(phase * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5);
    darkness = SR.utils.clamp(1 - sun, 0, 1);
    // dawn/dusk peak ~ 0.25 / 0.75 of the cycle
    const distDawn = Math.min(Math.abs(phase - 0.25), 1 - Math.abs(phase - 0.25));
    const distDusk = Math.min(Math.abs(phase - 0.75), 1 - Math.abs(phase - 0.75));
    dawnDusk = SR.utils.clamp(1 - Math.min(distDawn, distDusk) * 6, 0, 1);
  }

  function drawSky() {
    // Drawn UNDER everything — sky gradient that shifts with day/night.
    const W = canvas.width, H = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (darkness < 0.15) {
      // bright day
      grad.addColorStop(0, '#1a0e08'); grad.addColorStop(1, '#06030a');
    } else if (darkness < 0.55) {
      // dusk warm
      grad.addColorStop(0, '#2a0e02'); grad.addColorStop(1, '#04030a');
    } else {
      // night
      grad.addColorStop(0, '#0a0510'); grad.addColorStop(1, '#000');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawDayNightOverlay() {
    if (darkness > 0.05) {
      ctx.fillStyle = `rgba(8,4,28,${(darkness * 0.5).toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (dawnDusk > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(255,110,40,${(dawnDusk * 0.18).toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  function render() {
    frame++;
    updateDayNight();

    drawSky();

    // subtle grid backdrop (parallax stars) — more visible at night
    drawStars(0.4 + darkness * 0.8);

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
        if (t.t === 'water') drawWaterEdge(sc.sx, sc.sy, hw, hh, x, y);

        if (t.road) {
          drawRoad(sc.sx, sc.sy, hw, hh, t, x, y);
          drawTraffic(sc.sx, sc.sy, hw, hh, t, x, y);
        }
        else if (t.zone && t.level === 0) drawZone(sc.sx, sc.sy, hw, hh, t);
        if (t.power && !t.building) drawPower(sc.sx, sc.sy, hw, hh);
        if (t.pipe && !t.building) drawPipe(sc.sx, sc.sy, hw, hh);
        if (t.maglev && !t.building) drawMaglev(sc.sx, sc.sy, hw, hh, x, y);
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

        if (t.zone && t.level > 0) drawZoneBuilding(sc.sx, sc.sy, hw, hh, t, x, y);
        if (t.building) {
          gridXFromScreenContext.x = x; gridXFromScreenContext.y = y;
          drawSpecialBuilding(sc.sx, sc.sy, hw, hh, t);
        }
        if (t.onFire > 0) drawFire(sc.sx, sc.sy, hw, hh);
      }
    }

    drawDayNightOverlay();
    drawParticles(performance.now());
    drawCursorHighlight();
    drawHoverLabel();

    // Overlay glitch for disasters
    if (performance.now() < glitchUntil) {
      const off = (Math.random() * 6 - 3) | 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      ctx.drawImage(canvas, off, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Lightning flash
    if (performance.now() < flashUntil) {
      const left = flashUntil - performance.now();
      const a = Math.min(1, left / 200);
      ctx.fillStyle = flashColor.replace(/[\d.]+\)$/, (a * 0.7).toFixed(2) + ')');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Auto-emit smoke from coal/fusion plants
    if ((frame % 6) === 0) emitPlantSmoke();
  }

  function emitPlantSmoke() {
    const tiles = SR.grid && SR.grid.tiles;
    if (!tiles) return;
    const W = SR.GRID_W, H = SR.GRID_H;
    const b = viewBounds();
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || !t.building) continue;
        if (t.bx !== x || t.by !== y) continue;
        if (t.building === 'coal') {
          spawnSmoke(x + 1, y + 1, { color: 'rgba(80,80,80,0.55)' });
        } else if (t.building === 'fusion' && (frame % 18) === 0) {
          spawnSmoke(x + 1, y + 1, { color: 'rgba(255,80,200,0.4)' });
        } else if (t.building === 'water' && (frame % 24) === 0) {
          spawnSmoke(x + 1, y + 1, { color: 'rgba(120,200,255,0.3)' });
        }
      }
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

  function drawHoverLabel() {
    const cur = SR.input && SR.input.cursor;
    if (!cur) return;
    const t = SR.grid.get(cur.x, cur.y);
    if (!t) return;
    let label = '';
    if (t.t === 'water') label = 'WATER';
    else if (t.building) {
      const def = SR.BUILDINGS[t.building];
      label = (def && def.label) || String(t.building).toUpperCase();
    } else if (t.zone && t.level > 0) {
      label = SR.ZONE_VIS[t.zone].name + ' L' + t.level;
    } else if (t.zone) {
      label = SR.ZONE_VIS[t.zone].name + ' (empty)';
    } else if (t.road) {
      label = t.road === 2 ? 'NEON HIGHWAY' : 'ROAD';
    } else if (t.power) label = 'POWER LINE';
    else if (t.pipe) label = 'WATER PIPE';
    else label = 'GROUND z' + t.z;

    // Show tool action preview (e.g. cost) for build tools
    const tool = SR.tools && SR.tools.current;
    let sub = '';
    if (tool && tool !== 'select') {
      const cost = SR.tools.getCost(tool);
      if (cost > 0) sub = '₡' + cost;
    }
    if (t.zone && t.level > 0 && t.pop > 0) sub = (sub ? sub + '  ' : '') + 'pop ' + t.pop;
    if (t.zone && t.level > 0 && t.jobs > 0) sub = (sub ? sub + '  ' : '') + 'jobs ' + t.jobs;

    const cam = SR.camera;
    const sc = cam.tileToScreen(cur.x, cur.y, t.z);
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const fontPx = 12;
    ctx.font = fontPx + 'px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lw = Math.max(ctx.measureText(label).width, sub ? ctx.measureText(sub).width : 0);
    const w = Math.ceil(lw) + 14;
    const h = sub ? 30 : 18;
    const lx = sc.sx - w / 2;
    const ly = sc.sy - hh - h - 6;
    ctx.save();
    ctx.fillStyle = 'rgba(8,4,2,0.85)';
    ctx.fillRect(lx, ly, w, h);
    ctx.strokeStyle = '#ff8a1f';
    ctx.shadowColor = '#ff8a1f';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1;
    ctx.strokeRect(lx + 0.5, ly + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd28a';
    ctx.fillText(label, sc.sx, ly + (sub ? 9 : h / 2));
    if (sub) {
      ctx.fillStyle = '#ffaa1f';
      ctx.font = (fontPx - 1) + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillText(sub, sc.sx, ly + 22);
    }
    // tail
    ctx.fillStyle = '#ff8a1f';
    ctx.fillRect(sc.sx - 1, ly + h, 2, 4);
    ctx.restore();
  }

  // Background star/parallax field — subtle
  let starsBuf = null;
  function drawStars(alphaMul) {
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
    const a = (alphaMul == null ? 1 : alphaMul);
    ctx.globalAlpha = SR.utils.clamp(a, 0, 1);
    for (let y = -((oy % 400 + 400) % 400); y < H; y += 400) {
      for (let x = -((ox % 400 + 400) % 400); x < W; x += 400) {
        ctx.drawImage(starsBuf, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    init, resize, render, triggerGlitch, getDarkness,
    spawnSmoke, spawnFloater, spawnVehicle, flashScreen, clearParticles,
  };
})();

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

  // #67 Drone flyover — straight line across the world, slow, blinking
  function spawnDrone() {
    const W = SR.GRID_W, H = SR.GRID_H;
    // Pick two opposite edges
    const side = Math.random();
    let fx, fy, tx, ty;
    if (side < 0.5) { // east → west
      fx = W + 4; fy = Math.random() * H;
      tx = -4;     ty = Math.random() * H;
    } else {           // north → south
      fx = Math.random() * W; fy = -4;
      tx = Math.random() * W; ty = H + 4;
    }
    addParticle({
      kind: 'drone',
      fromX: fx, fromY: fy, toX: tx, toY: ty,
      life: 12000,
    });
  }

  // #70 Demolition debris — small puff of pixels at a tile
  function spawnDebris(tx, ty) {
    for (let i = 0; i < 12; i++) {
      addParticle({
        kind: 'debris', tx, ty,
        ox: (Math.random() - 0.5) * 4,
        oy: -4 - Math.random() * 4,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -1.6 - Math.random() * 0.8,
        gravity: 0.06,
        life: 700 + Math.random() * 400,
        color: ['#a06030', '#7a4818', '#503010', '#ff8a3a'][i & 3],
      });
    }
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
      } else if (p.kind === 'drone') {
        // Slow straight-line traversal at altitude
        const lerp = (a, b, k) => a + (b - a) * k;
        const dx = lerp(p.fromX, p.toX, t);
        const dy = lerp(p.fromY, p.toY, t);
        const sc = cam.tileToScreen(dx, dy, 0);
        const altY = sc.sy - 24 * zoom; // hover above ground
        const blink = ((frame >> 2) & 1);
        ctx.fillStyle = blink ? '#ff2acc' : '#3ad7ff';
        ctx.shadowColor = blink ? '#ff2acc' : '#3ad7ff';
        ctx.shadowBlur = 6;
        // Tiny X-shape drone body
        ctx.fillRect((sc.sx | 0) - 2, (altY | 0), 4, 1);
        ctx.fillRect((sc.sx | 0), (altY | 0) - 2, 1, 4);
        ctx.shadowBlur = 0;
        // Faint shadow on ground
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(sc.sx, sc.sy, 3 * zoom, 1.5 * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'debris') {
        // Ballistic — apply gravity each step
        p.vx *= 0.96;
        p.vy += p.gravity || 0.05;
        p.ox += p.vx;
        p.oy += p.vy;
        const sc = cam.tileToScreen(p.tx, p.ty, 0);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = fade;
        ctx.fillRect((sc.sx + p.ox * zoom) | 0, (sc.sy + p.oy * zoom) | 0, 2, 2);
        ctx.globalAlpha = 1;
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

  // Animated traffic dots moving along road lanes. Slot count scales with
  // adjacent zone density to suggest busier streets.
  // Lanes follow the iso edge axes: NW↔SE (between mNW and mSE midpoints) and
  // NE↔SW (between mNE and mSW midpoints).
  function drawTraffic(sx, sy, hw, hh, t, x, y) {
    const nw = SR.grid.get(x - 1, y);
    const se = SR.grid.get(x + 1, y);
    const ne = SR.grid.get(x, y - 1);
    const sw = SR.grid.get(x, y + 1);
    const cNW = nw && nw.road;
    const cSE = se && se.road;
    const cNE = ne && ne.road;
    const cSW = sw && sw.road;
    const axisA = cNW || cSE;     // NW↔SE lane
    const axisB = cNE || cSW;     // NE↔SW lane
    if (!axisA && !axisB) return;

    let density = 1;
    for (const n of [nw, se, ne, sw]) {
      if (n && n.zone && n.level > 0) density += n.level;
    }
    const speed = (t.road === 2 ? 0.012 : 0.008);
    const car = t.road === 2 ? '#ffd23a' : '#ff8a1f';

    const mNW = { x: sx - hw / 2, y: sy - hh / 2 };
    const mNE = { x: sx + hw / 2, y: sy - hh / 2 };
    const mSE = { x: sx + hw / 2, y: sy + hh / 2 };
    const mSW = { x: sx - hw / 2, y: sy + hh / 2 };

    function travelDot(a, b, tt) {
      const px = a.x + (b.x - a.x) * tt;
      const py = a.y + (b.y - a.y) * tt;
      ctx.fillStyle = car;
      ctx.fillRect((px | 0) - 1, (py | 0) - 1, 2, 2);
    }

    // NW↔SE lane (two parallel sub-lanes for opposing traffic)
    if (axisA) {
      const a = cNW ? mNW : { x: sx, y: sy };
      const b = cSE ? mSE : { x: sx, y: sy };
      // perpendicular offset for the two sub-lanes
      const pxoff = (mSE.y - mNW.y) === 0 ? 0 : 0; // we just shift on screen-y for lane separation
      const slots = Math.min(3, density);
      for (let i = 0; i < slots; i++) {
        const tt = ((frame * speed) + (x * 0.13 + y * 0.07) + i / slots) % 1;
        travelDot({ x: a.x, y: a.y - 2 }, { x: b.x, y: b.y - 2 }, tt);
        const tt2 = 1 - (((frame * speed) + (x * 0.27 + y * 0.21) + i / slots) % 1);
        travelDot({ x: a.x, y: a.y + 2 }, { x: b.x, y: b.y + 2 }, tt2);
      }
    }
    // NE↔SW lane
    if (axisB) {
      const a = cNE ? mNE : { x: sx, y: sy };
      const b = cSW ? mSW : { x: sx, y: sy };
      const slots = Math.min(3, density);
      for (let i = 0; i < slots; i++) {
        const tt = ((frame * speed) + (x * 0.41 + y * 0.11) + i / slots) % 1;
        travelDot({ x: a.x - 2, y: a.y }, { x: b.x - 2, y: b.y }, tt);
        const tt2 = 1 - (((frame * speed) + (x * 0.19 + y * 0.37) + i / slots) % 1);
        travelDot({ x: a.x + 2, y: a.y }, { x: b.x + 2, y: b.y }, tt2);
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
    // 4-cardinal neighbours in tile space line up with the four EDGES of the
    // iso diamond (not its compass corners): (x-1,y) shares the NW edge,
    // (x,y-1) the NE edge, (x+1,y) the SE edge, (x,y+1) the SW edge.
    const nw = SR.grid.get(x - 1, y);
    const se = SR.grid.get(x + 1, y);
    const ne = SR.grid.get(x, y - 1);
    const sw = SR.grid.get(x, y + 1);
    const isHigh = t.road === 2;
    const isOneway = t.road === 3;
    const isDiag = t.road === 4;
    const isBridge = t.t === 'water';
    const cNW = nw && nw.road;
    const cSE = se && se.road;
    const cNE = ne && ne.road;
    const cSW = sw && sw.road;

    // Asphalt diamond. Bridges get a colder, blued asphalt + faint deck shadow.
    // #66 Wet asphalt during rain has a cyan sheen.
    const wet = SR.game.weather === 'rain';
    if (isBridge) ctx.fillStyle = wet ? '#0a1a26' : '#0e1622';
    else if (isHigh) ctx.fillStyle = wet ? '#1a2a30' : '#211712';
    else ctx.fillStyle = wet ? '#162028' : '#1a1310';
    diamondPath(sx, sy, hw, hh);
    ctx.fill();

    // Edge midpoints — these are where the lane meets each tile boundary.
    const mNW = { x: sx - hw / 2, y: sy - hh / 2 };
    const mNE = { x: sx + hw / 2, y: sy - hh / 2 };
    const mSE = { x: sx + hw / 2, y: sy + hh / 2 };
    const mSW = { x: sx - hw / 2, y: sy + hh / 2 };

    // Asphalt edge stripe (the kerb) — a darker outline of the diamond
    ctx.strokeStyle = isBridge ? '#3a4a6a' : (isHigh ? '#0a0805' : '#0e0a06');
    ctx.lineWidth = isBridge ? 1.5 : 1;
    diamondPath(sx, sy, hw, hh);
    ctx.stroke();

    // Lane stripe — neon, with shadow glow.
    const stripe = isOneway ? '#3ad7ff'
                 : isDiag   ? '#ffaa1f'
                 : isHigh   ? '#ffaa1f'
                 :            '#ff6a00';
    ctx.strokeStyle = stripe;
    ctx.lineWidth = isHigh ? 2 : 1;
    ctx.shadowColor = stripe;
    ctx.shadowBlur = isHigh ? 10 : 5;

    if (isDiag) {
      // #35 Diagonal road — paint a single 45° stripe on whichever axis
      // has any neighbour (or NW↔SE by default). No second axis.
      ctx.beginPath();
      const useA = cNW || cSE || (!cNE && !cSW);
      if (useA) { ctx.moveTo(mNW.x, mNW.y); ctx.lineTo(mSE.x, mSE.y); }
      else      { ctx.moveTo(mNE.x, mNE.y); ctx.lineTo(mSW.x, mSW.y); }
      ctx.stroke();
    } else {
      ctx.beginPath();
      // NW↔SE lane: prefer a straight pass-through if both neighbors are roads;
      // otherwise draw a stub from the centre to whichever side connects.
      if (cNW && cSE) { ctx.moveTo(mNW.x, mNW.y); ctx.lineTo(mSE.x, mSE.y); }
      else {
        if (cNW) { ctx.moveTo(sx, sy); ctx.lineTo(mNW.x, mNW.y); }
        if (cSE) { ctx.moveTo(sx, sy); ctx.lineTo(mSE.x, mSE.y); }
      }
      // NE↔SW lane.
      if (cNE && cSW) { ctx.moveTo(mNE.x, mNE.y); ctx.lineTo(mSW.x, mSW.y); }
      else {
        if (cNE) { ctx.moveTo(sx, sy); ctx.lineTo(mNE.x, mNE.y); }
        if (cSW) { ctx.moveTo(sx, sy); ctx.lineTo(mSW.x, mSW.y); }
      }
      // Isolated tile — short dash so the player can see it.
      if (!cNW && !cNE && !cSE && !cSW) {
        ctx.moveTo(sx - hw * 0.3, sy);
        ctx.lineTo(sx + hw * 0.3, sy);
      }
      ctx.stroke();
    }

    // Highway divider — second thinner inner stripe.
    if (isHigh) {
      ctx.strokeStyle = '#ffe8a0';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      if (cNW && cSE) {
        ctx.moveTo(mNW.x + (mSE.x - mNW.x) * 0.15, mNW.y + (mSE.y - mNW.y) * 0.15);
        ctx.lineTo(mNW.x + (mSE.x - mNW.x) * 0.85, mNW.y + (mSE.y - mNW.y) * 0.85);
      }
      if (cNE && cSW) {
        ctx.moveTo(mNE.x + (mSW.x - mNE.x) * 0.15, mNE.y + (mSW.y - mNE.y) * 0.15);
        ctx.lineTo(mNE.x + (mSW.x - mNE.x) * 0.85, mNE.y + (mSW.y - mNE.y) * 0.85);
      }
      ctx.stroke();
    }

    // One-way arrow — small triangle pointing along the dominant axis.
    if (isOneway) {
      ctx.fillStyle = stripe;
      ctx.shadowColor = stripe;
      ctx.shadowBlur = 6;
      const useA = cNW || cSE || (!cNE && !cSW);
      const a = useA ? mNW : mNE;
      const b = useA ? mSE : mSW;
      const phase = ((frame * 0.012 + (x * 0.13 + y * 0.07)) % 1);
      const px = a.x + (b.x - a.x) * phase;
      const py = a.y + (b.y - a.y) * phase;
      const dx = (b.x - a.x), dy = (b.y - a.y);
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // Two-pixel arrow: 3-point fill
      ctx.beginPath();
      ctx.moveTo(px + ux * 3, py + uy * 3);
      ctx.lineTo(px - ux * 2 - uy * 2, py - uy * 2 + ux * 2);
      ctx.lineTo(px - ux * 2 + uy * 2, py - uy * 2 - ux * 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Bridge girders — short truss strokes under each lane endpoint.
    if (isBridge) {
      ctx.strokeStyle = 'rgba(120,150,200,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const m of [mNW, mNE, mSE, mSW]) {
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x, m.y + hh * 0.45);
      }
      ctx.stroke();
    }
  }

  // #31 Subway — translucent magenta dashed line below the surface, drawn
  // softly at low alpha so it's visible even under roads/zones.
  function drawSubway(sx, sy, hw, hh, x, y) {
    const nw = SR.grid.get(x - 1, y);
    const se = SR.grid.get(x + 1, y);
    const ne = SR.grid.get(x, y - 1);
    const sw = SR.grid.get(x, y + 1);
    const cNW = nw && nw.subway;
    const cSE = se && se.subway;
    const cNE = ne && ne.subway;
    const cSW = sw && sw.subway;
    const mNW = { x: sx - hw / 2, y: sy - hh / 2 };
    const mNE = { x: sx + hw / 2, y: sy - hh / 2 };
    const mSE = { x: sx + hw / 2, y: sy + hh / 2 };
    const mSW = { x: sx - hw / 2, y: sy + hh / 2 };
    ctx.save();
    ctx.strokeStyle = 'rgba(255,42,204,0.55)';
    ctx.shadowColor = '#ff2acc';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -((frame * 0.5) % 7);
    ctx.beginPath();
    if (cNW && cSE) { ctx.moveTo(mNW.x, mNW.y); ctx.lineTo(mSE.x, mSE.y); }
    else { if (cNW) { ctx.moveTo(sx, sy); ctx.lineTo(mNW.x, mNW.y); }
           if (cSE) { ctx.moveTo(sx, sy); ctx.lineTo(mSE.x, mSE.y); } }
    if (cNE && cSW) { ctx.moveTo(mNE.x, mNE.y); ctx.lineTo(mSW.x, mSW.y); }
    else { if (cNE) { ctx.moveTo(sx, sy); ctx.lineTo(mNE.x, mNE.y); }
           if (cSW) { ctx.moveTo(sx, sy); ctx.lineTo(mSW.x, mSW.y); } }
    if (!cNW && !cNE && !cSE && !cSW) {
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
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
    // Magenta neon tube routed along iso edge midpoints (matches roads).
    const nw = SR.grid.get(x - 1, y);
    const se = SR.grid.get(x + 1, y);
    const ne = SR.grid.get(x, y - 1);
    const sw = SR.grid.get(x, y + 1);
    const cNW = nw && nw.maglev;
    const cSE = se && se.maglev;
    const cNE = ne && ne.maglev;
    const cSW = sw && sw.maglev;

    const mNW = { x: sx - hw / 2, y: sy - hh / 2 };
    const mNE = { x: sx + hw / 2, y: sy - hh / 2 };
    const mSE = { x: sx + hw / 2, y: sy + hh / 2 };
    const mSW = { x: sx - hw / 2, y: sy + hh / 2 };

    ctx.strokeStyle = '#ff2acc';
    ctx.shadowColor = '#ff2acc';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (cNW && cSE) { ctx.moveTo(mNW.x, mNW.y); ctx.lineTo(mSE.x, mSE.y); }
    else { if (cNW) { ctx.moveTo(sx, sy); ctx.lineTo(mNW.x, mNW.y); }
           if (cSE) { ctx.moveTo(sx, sy); ctx.lineTo(mSE.x, mSE.y); } }
    if (cNE && cSW) { ctx.moveTo(mNE.x, mNE.y); ctx.lineTo(mSW.x, mSW.y); }
    else { if (cNE) { ctx.moveTo(sx, sy); ctx.lineTo(mNE.x, mNE.y); }
           if (cSW) { ctx.moveTo(sx, sy); ctx.lineTo(mSW.x, mSW.y); } }
    if (!cNW && !cNE && !cSE && !cSW) {
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Pulse along the dominant axis of this tile
    const phase = ((frame + x * 5 + y * 3) % 60) / 60;
    let a, b;
    if (cNW || cSE) { a = cNW ? mNW : { x: sx, y: sy }; b = cSE ? mSE : { x: sx, y: sy }; }
    else            { a = cNE ? mNE : { x: sx, y: sy }; b = cSW ? mSW : { x: sx, y: sy }; }
    const px = a.x + (b.x - a.x) * phase;
    const py = a.y + (b.y - a.y) * phase;
    ctx.fillStyle = '#ffaadc';
    ctx.fillRect((px | 0) - 1, (py | 0) - 1, 2, 2);
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

  // ---- Wave-2 visual passes ----

  // #59 Weather — full-viewport particle overlay
  function drawWeather() {
    const w = SR.game.weather;
    if (!w) return;
    const W = canvas.width, H = canvas.height;
    if (w === 'rain') {
      ctx.strokeStyle = 'rgba(170,210,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const offset = (frame * 18) % 24;
      for (let i = 0; i < 110; i++) {
        const x = ((i * 911 + frame * 7) % W);
        const y = (((i * 53) + offset * 11) % H);
        ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 8);
      }
      ctx.stroke();
    } else if (w === 'snow') {
      ctx.fillStyle = 'rgba(220,235,255,0.7)';
      for (let i = 0; i < 80; i++) {
        const x = ((i * 631 + frame * 1.4) % W);
        const y = ((i * 277 + frame * 0.9) % H);
        const sway = Math.sin(frame * 0.04 + i) * 1.5;
        ctx.fillRect((x + sway) | 0, y | 0, 2, 2);
      }
    } else if (w === 'fog') {
      ctx.fillStyle = 'rgba(120,110,140,0.18)';
      ctx.fillRect(0, 0, W, H);
      // Drifting fog bands
      ctx.fillStyle = 'rgba(180,170,200,0.10)';
      for (let i = 0; i < 4; i++) {
        const y = ((i * 137 + frame * 0.5) % H);
        ctx.fillRect(0, y, W, 24);
      }
    }
  }

  // #60 Seasonal palette tint — applied as an overlay after the world is drawn
  function getSeason() {
    const m = SR.game.month | 0;
    if (m < 3) return 'winter';
    if (m < 6) return 'spring';
    if (m < 9) return 'summer';
    return 'autumn';
  }
  function drawSeasonOverlay() {
    const s = getSeason();
    const W = canvas.width, H = canvas.height;
    let color = null;
    if (s === 'winter') color = 'rgba(140,170,210,0.10)';
    else if (s === 'autumn') color = 'rgba(255,140,40,0.06)';
    else if (s === 'spring') color = 'rgba(120,255,160,0.04)';
    else color = null; // summer = no tint
    if (color) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // #63 Holographic billboards on level-3 commercial zones
  function drawBillboards() {
    const cam = SR.camera;
    const zoom = cam.getZoom();
    if (zoom < 0.7) return; // hide when zoomed way out
    const b = viewBounds();
    const colors = ['#ff2acc', '#3ad7ff', '#ffd23a', '#3aff7a'];
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || t.zone !== 'c' || t.level < 3) continue;
        const seed = ((x * 1234567) ^ (y * 7654321)) >>> 0;
        const color = colors[seed & 3];
        const sc = cam.tileToScreen(x, y, t.z);
        // Hover above the building
        const cy = sc.sy - 56 * zoom - ((seed >> 8) & 7);
        const phase = (frame * 0.06 + (seed & 0xff) * 0.01) % (Math.PI * 2);
        const w = 14 * zoom * (0.6 + 0.4 * Math.cos(phase));
        const h = 4 * zoom;
        ctx.save();
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(frame * 0.1 + (seed & 0xf));
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillRect(sc.sx - w / 2, cy - h / 2, w, h);
        // Tiny scrolling glyph
        ctx.fillStyle = '#000';
        const dotX = sc.sx - w / 2 + ((frame * 1.5) % w);
        ctx.fillRect(dotX | 0, (cy - h / 4) | 0, 1, 2);
        ctx.restore();
      }
    }
  }

  // #64 Searchlight beams on landmark buildings at night
  function drawSearchlights() {
    if (darkness < 0.4) return;
    const cam = SR.camera;
    const zoom = cam.getZoom();
    const hw = (cam.TILE_W / 2) * zoom;
    const hh = (cam.TILE_H / 2) * zoom;
    const b = viewBounds();
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || !t.building || t.bx !== x || t.by !== y) continue;
        const def = SR.BUILDINGS[t.building];
        if (!def || def.category !== 'landmark') continue;
        const sz = def.size;
        const sc = cam.tileToScreen(x + (sz - 1) / 2, y + (sz - 1) / 2, t.z);
        const top = sc.sy - 80 * zoom; // approx top of antenna
        // Two rotating cones (offset 180°)
        for (let k = 0; k < 2; k++) {
          const angle = frame * 0.018 + k * Math.PI;
          const len = 220 * zoom;
          const spread = 0.18;
          const x0 = sc.sx, y0 = top;
          const x1 = x0 + Math.cos(angle - spread) * len;
          const y1 = y0 + Math.sin(angle - spread) * len;
          const x2 = x0 + Math.cos(angle + spread) * len;
          const y2 = y0 + Math.sin(angle + spread) * len;
          const grad = ctx.createLinearGradient(x0, y0, (x1 + x2) / 2, (y1 + y2) / 2);
          grad.addColorStop(0, 'rgba(255,210,80,0.45)');
          grad.addColorStop(1, 'rgba(255,210,80,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // #69 Citizen avatar sprites — tiny dots near the base of L2+ residentials
  function drawCitizens() {
    const cam = SR.camera;
    const zoom = cam.getZoom();
    if (zoom < 0.85) return;
    const b = viewBounds();
    const hh = (cam.TILE_H / 2) * zoom;
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || t.zone !== 'r' || t.level < 2) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        const seed = ((x * 1597) ^ (y * 1009)) >>> 0;
        const count = t.level - 1; // 1 at L2, 2 at L3
        for (let i = 0; i < count; i++) {
          const phase = ((frame * 0.012) + ((seed + i * 31) & 0xff) * 0.0247) % 1;
          const offX = (Math.sin(phase * Math.PI * 2) * 8 - 4) * zoom;
          const offY = (Math.cos(phase * Math.PI * 2) * 4) * zoom + hh * 0.4;
          ctx.fillStyle = ['#ffd28a', '#3ad7ff', '#3aff7a', '#ff8a8a'][(seed + i) & 3];
          ctx.fillRect((sc.sx + offX) | 0, (sc.sy + offY) | 0, 1, 2);
        }
      }
    }
  }

  // #62 Photo capture — pull the canvas to a downloadable PNG
  function capturePNG() {
    try {
      const link = document.createElement('a');
      link.download = 'simrodman-' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      return true;
    } catch (e) {
      console.warn('capture failed', e);
      return false;
    }
  }

  // R2-4 District color overlay — tints every tile assigned to a district
  function drawDistricts() {
    const dists = SR.game.districts || [];
    if (!dists.length) return;
    const cam = SR.camera;
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const b = viewBounds();
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || !t.district) continue;
        const d = dists[t.district - 1];
        if (!d) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        ctx.fillStyle = d.color + '33'; // ~20% alpha
        diamondPath(sc.sx, sc.sy, hw, hh);
        ctx.fill();
      }
    }
  }

  // R2-23 Traffic congestion road tinting — high adjacent-zone-density roads
  // get a red tinge layered over the base asphalt.
  function drawCongestion() {
    const cam = SR.camera;
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const b = viewBounds();
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || !t.road) continue;
        let load = 0;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const n = SR.grid.get(x + dx, y + dy);
          if (n && n.zone && n.level > 0) load += n.level;
        }
        if (load < 4) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        const a = Math.min(0.5, (load - 3) * 0.12);
        ctx.fillStyle = `rgba(255,40,30,${a.toFixed(3)})`;
        diamondPath(sc.sx, sc.sy, hw, hh);
        ctx.fill();
      }
    }
  }

  // R2-24 Service coverage outline — circle around every service building
  function drawCoverage() {
    if (!SR.game.coverageOverlay) return;
    const cam = SR.camera;
    const zoom = cam.getZoom();
    const b = viewBounds();
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || !t.building || t.bx !== x || t.by !== y) continue;
        const def = SR.BUILDINGS[t.building];
        if (!def || !def.range || def.range < 1) continue;
        const sz = def.size;
        const sc = cam.tileToScreen(x + (sz - 1) / 2, y + (sz - 1) / 2, t.z);
        const r = def.range * cam.TILE_W * 0.5 * zoom;
        // Use the building trim color so each service draws in its own hue
        ctx.strokeStyle = (def.trim || '#ffaa1f') + 'a8';
        ctx.beginPath();
        ctx.ellipse(sc.sx, sc.sy, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // R2-39 Rectangle marquee for mass-paint preview
  function drawRectMarquee() {
    const r = SR.input && SR.input.getRectDrag && SR.input.getRectDrag();
    if (!r) return;
    const cam = SR.camera;
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const ax = Math.min(r.x0, r.x1), bx = Math.max(r.x0, r.x1);
    const ay = Math.min(r.y0, r.y1), by = Math.max(r.y0, r.y1);
    ctx.save();
    ctx.strokeStyle = '#ffd23a';
    ctx.shadowColor = '#ffd23a';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    for (let y = ay; y <= by; y++) {
      for (let x = ax; x <= bx; x++) {
        const t = SR.grid.get(x, y);
        if (!t) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        diamondPath(sc.sx, sc.sy, hw, hh);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Heatmap overlay (#74) — translucent tile-by-tile color over the main view
  function drawHeatmap() {
    const mode = SR.game.heatmap;
    if (!mode) return;
    const cam = SR.camera;
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const b = viewBounds();
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t) continue;
        let v = 0, color;
        if (mode === 'pollution') { v = t.pollution / 100; color = `rgba(180,255,80,${(v * 0.6).toFixed(3)})`; }
        else if (mode === 'crime') { v = t.crime / 100; color = `rgba(255,40,80,${(v * 0.6).toFixed(3)})`; }
        else if (mode === 'value') { v = t.land / 100; color = `rgba(255,170,31,${(v * 0.5).toFixed(3)})`; }
        else if (mode === 'density') {
          const k = (t.zone === 'r' ? t.pop : t.jobs) || 0;
          v = Math.min(1, k / 48);
          color = `rgba(58,255,160,${(v * 0.6).toFixed(3)})`;
        }
        if (v < 0.03) continue;
        const sc = cam.tileToScreen(x, y, t.z);
        ctx.fillStyle = color;
        diamondPath(sc.sx, sc.sy, hw, hh);
        ctx.fill();
      }
    }
  }

  // Building search highlight (#73) — pulse halo on every building whose
  // label or key matches SR.game.search (case-insensitive substring).
  function drawSearchHighlight() {
    const q = (SR.game.search || '').toLowerCase();
    if (!q) return;
    const cam = SR.camera;
    const hw = (cam.TILE_W / 2) * cam.getZoom();
    const hh = (cam.TILE_H / 2) * cam.getZoom();
    const b = viewBounds();
    const pulse = 0.6 + 0.4 * Math.sin(frame * 0.15);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,210,58,${pulse.toFixed(3)})`;
    ctx.shadowColor = '#ffd23a';
    ctx.shadowBlur = 14;
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const t = SR.grid.get(x, y);
        if (!t || !t.building || t.bx !== x || t.by !== y) continue;
        const def = SR.BUILDINGS[t.building];
        const key = t.building.toLowerCase();
        const lbl = (def && def.label || '').toLowerCase();
        if (!key.includes(q) && !lbl.includes(q)) continue;
        const sz = (def && def.size) || 1;
        const sc = cam.tileToScreen(x + (sz - 1) / 2, y + (sz - 1) / 2, t.z);
        diamondPath(sc.sx, sc.sy, hw * sz, hh * sz);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function updateDayNight() {
    // #95 perma-night modifier
    if (SR.game.modifiers && SR.game.modifiers.permaNight) {
      darkness = 0.92; dawnDusk = 0; return;
    }
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

        if (t.subway) drawSubway(sc.sx, sc.sy, hw, hh, x, y);
        if (t.road) {
          drawRoad(sc.sx, sc.sy, hw, hh, t, x, y);
          if (t.road === 1 || t.road === 2) drawTraffic(sc.sx, sc.sy, hw, hh, t, x, y);
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

        const hidden = SR.game.hiddenLayers || {};
        if (t.zone && t.level > 0 && !hidden.zone) drawZoneBuilding(sc.sx, sc.sy, hw, hh, t, x, y);
        if (t.building) {
          const def = SR.BUILDINGS[t.building];
          const cat = (def && def.category) || 'service';
          if (!hidden[cat]) {
            gridXFromScreenContext.x = x; gridXFromScreenContext.y = y;
            drawSpecialBuilding(sc.sx, sc.sy, hw, hh, t);
          }
        }
        if (t.onFire > 0) drawFire(sc.sx, sc.sy, hw, hh);
      }
    }

    drawCitizens();         // #69 — small sprites near building bases
    drawBillboards();       // #63 — neon hoverboards on L3 commercial
    drawSearchlights();     // #64 — landmark spotlight beams at night
    drawCongestion();       // R2-23
    drawDistricts();        // R2-4
    drawCoverage();          // R2-24
    drawHeatmap();
    drawSearchHighlight();
    drawSeasonOverlay();    // #60 — seasonal tint
    drawDayNightOverlay();
    drawWeather();          // #59 — rain / snow / fog above scene, below HUD
    drawParticles(performance.now());
    drawRectMarquee();       // R2-39 mass-paint preview
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
    spawnSmoke, spawnFloater, spawnVehicle, spawnDrone, spawnDebris,
    flashScreen, clearParticles,
    capturePNG,
  };
})();

// utils.js — small shared helpers, RNG, math
'use strict';

const SR = window.SR = window.SR || {};

SR.utils = (() => {
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(n) {
    n = Math.round(n);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }
  function fmtCredits(n) { return '₡' + fmt(n); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function dateStr(g) {
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return months[g.month] + ' ' + g.year;
  }

  // Mulberry32 — small fast deterministic RNG so save/load keep the same world feel
  function makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noise2(rng, w, h, scale) {
    // simple value noise: sample a coarse grid and bilinear blend
    scale = scale || 8;
    const cw = Math.ceil(w / scale) + 2;
    const ch = Math.ceil(h / scale) + 2;
    const cells = new Float32Array(cw * ch);
    for (let i = 0; i < cells.length; i++) cells[i] = rng();
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fx = x / scale, fy = y / scale;
        const ix = fx | 0, iy = fy | 0;
        const tx = fx - ix, ty = fy - iy;
        const a = cells[iy * cw + ix];
        const b = cells[iy * cw + ix + 1];
        const c = cells[(iy + 1) * cw + ix];
        const d = cells[(iy + 1) * cw + ix + 1];
        const ux = tx * tx * (3 - 2 * tx);
        const uy = ty * ty * (3 - 2 * ty);
        out[y * w + x] = lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
      }
    }
    return out;
  }

  function fbm(rng, w, h) {
    const a = noise2(rng, w, h, 16);
    const b = noise2(rng, w, h, 8);
    const c = noise2(rng, w, h, 4);
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) {
      out[i] = a[i] * 0.55 + b[i] * 0.3 + c[i] * 0.15;
    }
    return out;
  }

  function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function chance(rng, p) { return rng() < p; }

  return { clamp, lerp, fmt, fmtCredits, pad, dateStr, makeRng, noise2, fbm, manhattan, chance };
})();

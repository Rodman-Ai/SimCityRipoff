// minimap.js — small overview map with multiple visualization modes
'use strict';

SR.minimap = (() => {
  let canvas, ctx;
  let mode = 'terrain';

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#minimap-modes .mm').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === m);
    });
  }

  function getMode() { return mode; }

  function render() {
    const W = SR.GRID_W, H = SR.GRID_H;
    canvas.width = W; canvas.height = H;
    const img = ctx.createImageData(W, H);
    const tiles = SR.grid.tiles;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const o = i * 4;
      let r = 0, g = 0, b = 0, a = 255;

      switch (mode) {
        case 'terrain':
          if (t.t === 'water') { r = 16; g = 38; b = 64; }
          else { const k = 24 + t.z * 8; r = k + 4; g = k * 0.6 | 0; b = k * 0.3 | 0; }
          if (t.road) { r = 200; g = 130; b = 30; }
          if (t.building) { r = 255; g = 170; b = 31; }
          else if (t.zone === 'r' && t.level > 0) { r = 58; g = 200; b = 100; }
          else if (t.zone === 'c' && t.level > 0) { r = 58; g = 200; b = 220; }
          else if (t.zone === 'i' && t.level > 0) { r = 220; g = 200; b = 80; }
          break;
        case 'zones':
          if (t.t === 'water') { r = 8; g = 16; b = 28; }
          else if (t.zone === 'r') { r = 30; g = 200; b = 80; }
          else if (t.zone === 'c') { r = 40; g = 200; b = 230; }
          else if (t.zone === 'i') { r = 230; g = 200; b = 50; }
          else { r = 30; g = 22; b = 14; }
          break;
        case 'power':
          if (t.t === 'water') { r = 0; g = 0; b = 0; }
          else if (t.poweredBy) { r = 255; g = 200; b = 50; }
          else if (t.power || t.building) { r = 90; g = 60; b = 10; }
          else { r = 24; g = 16; b = 8; }
          break;
        case 'crime':
          if (t.t === 'water') { r = 0; g = 0; b = 0; }
          else { r = 30 + t.crime * 2; g = 20; b = 30; }
          break;
        case 'pollution':
          if (t.t === 'water') { r = 0; g = 0; b = 0; }
          else { r = 30 + t.pollution * 2; g = 30 + t.pollution; b = 10; }
          break;
        case 'value':
          if (t.t === 'water') { r = 0; g = 0; b = 0; }
          else { r = 60 + t.land; g = 30 + t.land * 0.5; b = 10; }
          break;
      }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a;
    }
    ctx.putImageData(img, 0, 0);

    // viewport rectangle
    const cam = SR.camera;
    const tl = cam.screenToTile(0, 0);
    const br = cam.screenToTile(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight);
    // estimate based on canvas size
    const view = document.getElementById('viewport-wrap');
    const vW = view.clientWidth, vH = view.clientHeight;
    const corners = [
      cam.screenToTile(0, 0),
      cam.screenToTile(vW, 0),
      cam.screenToTile(vW, vH),
      cam.screenToTile(0, vH),
    ];
    ctx.strokeStyle = 'rgba(255,170,31,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      const x = SR.utils.clamp(c.x, 0, W - 1);
      const y = SR.utils.clamp(c.y, 0, H - 1);
      if (i === 0) ctx.moveTo(x + 0.5, y + 0.5);
      else ctx.lineTo(x + 0.5, y + 0.5);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function attachClick() {
    canvas.addEventListener('mousedown', onClick);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
  }
  function onClick(e) {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SR.GRID_W;
    const y = ((e.clientY - r.top) / r.height) * SR.GRID_H;
    SR.camera.center(x, y);
  }
  function onTouch(e) {
    if (!e.touches[0]) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const x = ((e.touches[0].clientX - r.left) / r.width) * SR.GRID_W;
    const y = ((e.touches[0].clientY - r.top) / r.height) * SR.GRID_H;
    SR.camera.center(x, y);
  }

  return { init, render, setMode, getMode, attachClick };
})();

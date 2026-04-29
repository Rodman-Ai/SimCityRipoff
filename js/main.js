// main.js — bootstraps the game
'use strict';

(() => {
  // Boot screen typewriter
  const lines = [
    '> CONNECTING TO MUNI-NET ........... [OK]',
    '> AUTHENTICATING MAYOR CREDENTIALS . [OK]',
    '> LOADING ZONING DB v2.077 ......... [OK]',
    '> CALIBRATING NEON HUD ............. [OK]',
    '> SPINNING UP TRAFFIC ALGORITHMS ... [OK]',
    '> SUMMONING ROGUE AI MAYOR RODMAN .. [OK]',
    '> READY.  PRESS  J A C K   I N   .   .   .',
  ];
  const log = document.getElementById('boot-log');
  let li = 0;
  function typeLine() {
    if (li >= lines.length) return;
    const line = lines[li++];
    let i = 0;
    const id = setInterval(() => {
      log.textContent += line[i++];
      if (i >= line.length) {
        clearInterval(id);
        log.textContent += '\n';
        log.scrollTop = log.scrollHeight;
        setTimeout(typeLine, 70 + Math.random() * 80);
      }
    }, 6);
  }
  typeLine();

  document.getElementById('boot-start').addEventListener('click', () => {
    SR.audio.ensure();
    SR.audio.sfx.cash();
    document.getElementById('boot').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    boot();
  });

  function boot() {
    const canvas = document.getElementById('game');
    SR.renderer.init(canvas);
    SR.minimap.init(document.getElementById('minimap'));
    SR.minimap.attachClick();
    SR.ui.init();
    SR.input.init(canvas);

    // Try load existing save, otherwise new city
    const loaded = SR.save.load();
    if (!loaded) {
      SR.game.newCity({ name: 'Neo-Rodman', seed: (Math.random() * 1e9) | 0, funds: 20000 });
      SR.ui.alert('NEW CITY: NEO-RODMAN', 'good');
      // Show the tutorial after a short delay so the alert lands first
      setTimeout(() => { if (!SR.game.tutorialDone) SR.ui.openTutorial(); }, 800);
    } else {
      SR.ui.alert('CITY LOADED', 'good');
    }
    SR.camera.center(SR.GRID_W / 2, SR.GRID_H / 2);

    // Autosave every 30s
    setInterval(() => { SR.save.save(); }, 30000);

    // Throttled minimap render
    setInterval(() => SR.minimap.render(), 600);

    // Game loop
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      SR.game.update(dt);
      SR.renderer.render();
      SR.ui.updateStats();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ESC to close panels
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const m = document.getElementById('modal-wrap');
      if (m && !m.classList.contains('hidden')) { m.classList.add('hidden'); }
    }
  });
})();

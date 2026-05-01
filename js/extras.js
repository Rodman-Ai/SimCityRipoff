// extras.js — Wave 4 + Wave 5 long-tail features bundled together so the
// main modules stay focused. Everything here is small or independent.
'use strict';

SR.extras = (() => {

  // ---- #72 Camera bookmarks -------------------------------------------
  // Shift+1..4 stores the current camera (cx, cy, zoom). 1..4 recalls.
  function saveBookmark(slot) {
    const cam = SR.camera;
    SR.game.bookmarks[slot] = { cx: cam.cx, cy: cam.cy, zoom: cam.getZoom() };
    SR.ui.alert('BOOKMARK ' + (slot + 1) + ' SAVED', 'good');
  }
  function recallBookmark(slot) {
    const b = SR.game.bookmarks[slot];
    if (!b) { SR.ui.alert('NO BOOKMARK ' + (slot + 1)); return; }
    SR.camera.cx = b.cx; SR.camera.cy = b.cy;
    SR.camera.setZoom(b.zoom);
  }

  // ---- #77 Local leaderboard ------------------------------------------
  const LB_KEY = 'simrodman.leaderboard.v1';
  function getLeaderboard() {
    try {
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveLeaderboard(list) {
    try { localStorage.setItem(LB_KEY, JSON.stringify(list.slice(0, 20))); } catch (e) {}
  }
  function recordCity() {
    const list = getLeaderboard();
    list.push({
      name: SR.game.cityName,
      seed: SR.game.seed,
      year: SR.game.year,
      pop: SR.game.population,
      funds: Math.round(SR.game.funds),
      approval: SR.game.approval,
      at: Date.now(),
    });
    list.sort((a, b) => b.pop - a.pop);
    saveLeaderboard(list);
  }
  function openLeaderboard() {
    recordCity();
    const list = getLeaderboard();
    const html = '<div class="section-title">TOP CITIES (LOCAL)</div>'
      + '<p style="color:var(--text-d);font-size:12px">Snapshots are saved per visit; sorted by population.</p>'
      + (list.length === 0 ? '<p>No entries yet.</p>'
        : '<div>' + list.slice(0, 15).map((e, i) =>
            `<div class="kv"><span class="k">#${i + 1} ${e.name}</span><span class="v">POP ${SR.utils.fmt(e.pop)} / ${e.year} / ₡${SR.utils.fmt(e.funds)}</span></div>`
          ).join('') + '</div>');
    SR.ui.openModal('LEADERBOARD', html);
  }

  // ---- #78 What's-new patchnotes ---------------------------------------
  const PATCHNOTES_KEY = 'simrodman.patchnotes.seen';
  const VERSION = 'v0.5.0';
  const NOTES = [
    'v0.5.0 — Wave 4 + Wave 5 sweep:',
    '  • 9 new buildings (casino, prison, recycling, cyberclinic, conv ctr, net-cathedral,',
    '    drone airfield, rooftop solar, disaster bunker)',
    '  • 5 new disasters (AI uprising, nano-plague, solar flare, climate refugees, EMP eruption)',
    '  • Specialization perks, difficulty modifiers (perma-night, 2× pollution, no loans)',
    '  • Direct R/C/I subsidies + transit-pass ordinances',
    '  • Camera bookmarks (Shift+1..4 / 1..4), local leaderboard, mayor portrait',
    '  • Accessibility: color-blind palette, large text, reduced motion, haptics',
    '  • Share city via URL hash, weekly seed challenge, time-lapse capture',
    '  • Cheat console (Konami), CSS palette themer, achievement export',
  ];
  function maybeShowPatchnotes() {
    let seen = '';
    try { seen = localStorage.getItem(PATCHNOTES_KEY) || ''; } catch (e) {}
    if (seen === VERSION) return;
    SR.ui.openModal("WHAT'S NEW " + VERSION,
      '<pre style="white-space:pre-wrap;color:var(--text);font-family:inherit">' +
      NOTES.join('\n') + '</pre>' +
      '<div class="btn-row"><button class="pri" id="pn-ok">GOT IT</button></div>');
    setTimeout(() => {
      const ok = document.getElementById('pn-ok');
      if (ok) ok.addEventListener('click', () => {
        try { localStorage.setItem(PATCHNOTES_KEY, VERSION); } catch (e) {}
        SR.ui.closeModal();
      });
    }, 0);
  }

  // ---- #80 Customizable hotkeys ---------------------------------------
  const HK_KEY = 'simrodman.keymap.v1';
  function loadKeymap() {
    try { return JSON.parse(localStorage.getItem(HK_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveKeymap(m) {
    try { localStorage.setItem(HK_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function openHotkeyEditor() {
    const map = loadKeymap();
    const defaults = {
      bulldoze: 'b', road: 'r', highway: 'h', power: 'p', pipe: 'w',
      maglev: 'm', subway: 'u', undo: 'z', save: 's',
    };
    const html = '<div class="section-title">REBIND HOTKEYS</div>'
      + '<p style="color:var(--text-d);font-size:12px">Tap a row, then press the new key. Resets on reload if you bork it.</p>'
      + Object.keys(defaults).map(action => {
          const k = map[action] || defaults[action];
          return `<div class="kv"><span class="k">${action}</span><span class="v"><button class="row-btn" style="display:inline-block;width:60px" data-hk="${action}">${k}</button></span></div>`;
        }).join('')
      + '<div class="btn-row"><button id="hk-reset">RESET</button></div>';
    SR.ui.openModal('HOTKEYS', html);
    setTimeout(() => {
      document.querySelectorAll('[data-hk]').forEach(b => {
        b.addEventListener('click', () => {
          b.textContent = '...';
          const onKey = e => {
            e.preventDefault();
            map[b.dataset.hk] = e.key.toLowerCase();
            saveKeymap(map);
            b.textContent = e.key.toLowerCase();
            window.removeEventListener('keydown', onKey, true);
          };
          window.addEventListener('keydown', onKey, true);
        });
      });
      const r = document.getElementById('hk-reset');
      if (r) r.addEventListener('click', () => {
        saveKeymap({}); SR.ui.alert('RESET', 'good'); SR.ui.closeModal();
      });
    }, 0);
  }
  function getKey(action) {
    const map = loadKeymap();
    const defaults = {
      bulldoze: 'b', road: 'r', highway: 'h', power: 'p', pipe: 'w',
      maglev: 'm', subway: 'u', undo: 'z', save: 's',
    };
    return map[action] || defaults[action];
  }

  // ---- #81–85 Accessibility settings ----------------------------------
  function applyA11y() {
    const a = SR.game.a11y || {};
    document.body.classList.toggle('cb-protan',  a.palette === 'protan');
    document.body.classList.toggle('cb-deutan',  a.palette === 'deutan');
    document.body.classList.toggle('large-text', !!a.largeText);
    document.body.classList.toggle('reduced-motion', !!a.reducedMotion);
  }
  function openA11ySettings() {
    const a = SR.game.a11y;
    const html = `
      <div class="section-title">ACCESSIBILITY</div>
      <div class="kv"><span class="k">Color palette</span><span class="v">
        <select id="a11y-palette" style="background:#0a0504;color:var(--orange-2);border:1px solid var(--line-2);padding:2px">
          <option value="orange" ${a.palette === 'orange' ? 'selected' : ''}>Default neon orange</option>
          <option value="protan" ${a.palette === 'protan' ? 'selected' : ''}>Protanopia-friendly</option>
          <option value="deutan" ${a.palette === 'deutan' ? 'selected' : ''}>Deuteranopia-friendly</option>
          <option value="cyber-blue" ${a.palette === 'cyber-blue' ? 'selected' : ''}>Cyber Blue (theme)</option>
          <option value="retro-green" ${a.palette === 'retro-green' ? 'selected' : ''}>Retro Green (theme)</option>
        </select></span></div>
      <div class="kv"><span class="k">Large text</span><span class="v"><label><input type="checkbox" id="a11y-text" ${a.largeText ? 'checked' : ''}> 1.25× UI</label></span></div>
      <div class="kv"><span class="k">Reduced motion</span><span class="v"><label><input type="checkbox" id="a11y-rm" ${a.reducedMotion ? 'checked' : ''}> Disable glitch / scanlines</label></span></div>
      <div class="kv"><span class="k">Mobile haptics</span><span class="v"><label><input type="checkbox" id="a11y-h" ${a.haptics !== false ? 'checked' : ''}> Vibrate on tool place</label></span></div>
    `;
    SR.ui.openModal('ACCESSIBILITY', html);
    setTimeout(() => {
      document.getElementById('a11y-palette').addEventListener('change', e => {
        SR.game.a11y.palette = e.target.value;
        applyA11y();
        applyTheme();
      });
      document.getElementById('a11y-text').addEventListener('change', e => {
        SR.game.a11y.largeText = e.target.checked; applyA11y();
      });
      document.getElementById('a11y-rm').addEventListener('change', e => {
        SR.game.a11y.reducedMotion = e.target.checked; applyA11y();
      });
      document.getElementById('a11y-h').addEventListener('change', e => {
        SR.game.a11y.haptics = e.target.checked;
      });
    }, 0);
  }
  // #83 Haptic helper for tool placement
  function buzz() {
    if (SR.game.a11y && SR.game.a11y.haptics === false) return;
    if (navigator.vibrate) navigator.vibrate(15);
  }

  // ---- #98 CSS-themable palette ---------------------------------------
  function applyTheme() {
    const root = document.documentElement;
    const p = (SR.game.a11y && SR.game.a11y.palette) || 'orange';
    let palette;
    if (p === 'cyber-blue') {
      palette = { '--orange': '#3ad7ff', '--orange-2': '#9adfff', '--orange-d': '#1668a0' };
    } else if (p === 'retro-green') {
      palette = { '--orange': '#3aff7a', '--orange-2': '#a0ffb0', '--orange-d': '#108028' };
    } else if (p === 'protan') {
      palette = { '--orange': '#ffd23a', '--orange-2': '#ffe88a', '--orange-d': '#a07000' };
    } else if (p === 'deutan') {
      palette = { '--orange': '#3ad7ff', '--orange-2': '#bcefff', '--orange-d': '#1668a0' };
    } else {
      palette = { '--orange': '#ff6a00', '--orange-2': '#ffaa1f', '--orange-d': '#b34800' };
    }
    for (const [k, v] of Object.entries(palette)) root.style.setProperty(k, v);
  }

  // ---- #87 Share city via URL hash -------------------------------------
  function exportToHash() {
    try {
      const json = SR.save.exportJson();
      const compressed = btoa(unescape(encodeURIComponent(json)));
      const url = location.origin + location.pathname + '#city=' + compressed;
      navigator.clipboard && navigator.clipboard.writeText(url);
      SR.ui.alert('URL COPIED TO CLIPBOARD', 'good');
      return url;
    } catch (e) {
      SR.ui.alert('SHARE FAILED', 'bad');
      return null;
    }
  }
  function importFromHash() {
    if (!location.hash || !location.hash.startsWith('#city=')) return false;
    try {
      const compressed = location.hash.slice(6);
      const json = decodeURIComponent(escape(atob(compressed)));
      const ok = SR.save.importJson(json);
      if (ok) { SR.ui.alert('CITY LOADED FROM URL', 'good'); }
      return ok;
    } catch (e) { return false; }
  }

  // ---- #88 Weekly seed challenge ---------------------------------------
  // Deterministic seed derived from the current ISO week. Records best per week.
  function weeklySeed() {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const week = Math.floor((d - start) / 86400000 / 7);
    return (d.getFullYear() * 53 + week) >>> 0;
  }
  function openWeeklyChallenge() {
    const seed = weeklySeed();
    const html = `
      <div class="section-title">WEEKLY CHALLENGE</div>
      <p>Everyone gets the same seed this week. Highest population at 5 game-years wins.</p>
      <div class="kv"><span class="k">Seed</span><span class="v">${seed}</span></div>
      <div class="kv"><span class="k">Difficulty</span><span class="v">NORMAL</span></div>
      <div class="kv"><span class="k">Target</span><span class="v">5 game-years</span></div>
      <div class="btn-row"><button class="pri" id="wc-go">START CHALLENGE</button></div>
    `;
    SR.ui.openModal('WEEKLY CHALLENGE', html);
    setTimeout(() => {
      document.getElementById('wc-go').addEventListener('click', () => {
        SR.game.newCity({ name: 'Weekly-' + seed, seed, mode: 'blank', funds: 20000 });
        SR.ui.closeModal();
      });
    }, 0);
  }

  // ---- #91 Arcology endgame win ---------------------------------------
  function checkArcologyWin() {
    let n = 0;
    for (const t of SR.grid.tiles) if (t.building === 'arcology') n++;
    if (n >= 5 && !SR.game.arcologyWinShown) {
      SR.game.arcologyWinShown = true;
      const html = `
        <div class="section-title glitch">// NET SINGULARITY ACHIEVED</div>
        <p>Five Neon Arcologies. Neo-Rodman has transcended physical city limits.
        The mayor is uploaded. The grid hums.</p>
        <div class="btn-row"><button class="pri" id="arc-ok">CONTINUE BUILDING</button></div>
      `;
      SR.ui.openModal('VICTORY', html);
      setTimeout(() => {
        const b = document.getElementById('arc-ok');
        if (b) b.addEventListener('click', SR.ui.closeModal);
      }, 0);
    }
  }

  // ---- #93 Mayor portrait gallery -------------------------------------
  function openMayorPortrait() {
    const g = SR.game;
    const age = (g.year || 2077) - 2077;
    const seed = g.seed || 0;
    const eye = ['◉','◎','◐','◑'][seed & 3];
    const cyber = age > 6 ? '✚' : '';
    const lines = age > 10 ? '~~~' : age > 4 ? '--' : '';
    const html = `
      <div style="text-align:center;padding:24px">
        <pre style="font-size:18px;color:var(--orange-2);text-shadow:0 0 6px rgba(255,170,31,0.5);line-height:1.1">
   ╭───────╮
   │ ${eye} ${cyber} ${eye} │
   │   ${lines}   │
   │  ┌─┐  │
   ╰───────╯
        </pre>
        <div style="color:var(--orange);letter-spacing:2px">MAYOR ${(g.cityName || 'RODMAN').toUpperCase()}</div>
        <div style="color:var(--text-d)">Term: ${age} year(s) — Approval ${g.approval | 0}%</div>
      </div>
    `;
    SR.ui.openModal('MAYOR', html);
  }

  // ---- #99 Cheat console (Konami code) -------------------------------
  // ↑↑↓↓←→←→ba — enables a global SR.cheats object with helpers.
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiIdx = 0;
  function watchKonami() {
    document.addEventListener('keydown', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === KONAMI[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === KONAMI.length) {
          enableCheats();
          konamiIdx = 0;
        }
      } else {
        konamiIdx = 0;
      }
    });
  }
  function enableCheats() {
    if (SR.game.cheatsEnabled) return;
    SR.game.cheatsEnabled = true;
    window.cheats = SR.cheats = {
      give(n) { SR.game.funds += (n || 100000); SR.ui.markStatsDirty(); },
      pop(n) { for (const t of SR.grid.tiles) if (t.zone === 'r') t.level = 3; },
      unlock() { for (const a of SR.ACHIEVEMENTS) SR.game.achievements[a.key] = { unlocked: true, at: 'cheat' }; },
      noClip(b) { window.SR_NOCLIP = !!b; },
      tokens(n) { SR.game.cryptoTokens = (SR.game.cryptoTokens || 0) + (n || 5); },
      help() { console.log('cheats: give(n), pop(), unlock(), tokens(n)'); },
    };
    SR.ui.alert('★ CHEATS ENABLED — type cheats.help() in console', 'good');
  }

  // ---- #100 Achievement export -----------------------------------------
  function exportAchievements() {
    const list = (SR.ACHIEVEMENTS || []).map(a => ({
      key: a.key,
      name: a.name,
      unlocked: !!(SR.game.achievements[a.key] && SR.game.achievements[a.key].unlocked),
      at: SR.game.achievements[a.key] && SR.game.achievements[a.key].at || null,
    }));
    const json = JSON.stringify({ city: SR.game.cityName, year: SR.game.year, achievements: list }, null, 2);
    const html = '<p>Copy this badge JSON to share your progress.</p>'
      + '<textarea readonly style="height:200px">' + json + '</textarea>'
      + '<div class="btn-row"><button class="pri" id="ach-copy">COPY</button></div>';
    SR.ui.openModal('ACHIEVEMENT BADGE', html);
    setTimeout(() => {
      const ta = document.querySelector('textarea');
      const c = document.getElementById('ach-copy');
      if (c) c.addEventListener('click', () => { ta.select(); document.execCommand('copy'); SR.ui.alert('COPIED', 'good'); });
    }, 0);
  }

  // ---- #65 Fireworks (called on milestones) ---------------------------
  function fireworks() {
    if (!SR.renderer || !SR.renderer.spawnDebris) return;
    const cx = SR.GRID_W / 2, cy = SR.GRID_H / 2;
    for (let n = 0; n < 4; n++) {
      setTimeout(() => SR.renderer.spawnDebris(
        cx + (Math.random() - 0.5) * 16,
        cy + (Math.random() - 0.5) * 16
      ), n * 220);
    }
    SR.renderer.flashScreen(140, 'rgba(255,170,31,0.55)');
  }

  return {
    saveBookmark, recallBookmark,
    openLeaderboard, recordCity,
    maybeShowPatchnotes,
    openHotkeyEditor, getKey, loadKeymap,
    applyA11y, applyTheme, openA11ySettings, buzz,
    exportToHash, importFromHash,
    openWeeklyChallenge, weeklySeed,
    checkArcologyWin, openMayorPortrait,
    watchKonami, enableCheats,
    exportAchievements,
    fireworks,
  };
})();

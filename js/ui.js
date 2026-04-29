// ui.js — toolbar wiring, info panels, modals, alerts, ticker
'use strict';

SR.ui = (() => {
  let statsDirty = true;

  function init() {
    // Tools
    document.querySelectorAll('.tool').forEach(b => {
      b.addEventListener('click', () => SR.tools.select(b.dataset.tool));
    });
    SR.tools.select('select');

    // Speed
    document.querySelectorAll('.spd').forEach(b => {
      b.addEventListener('click', () => {
        const s = parseInt(b.dataset.speed, 10);
        SR.game.setSpeed(s);
        document.querySelectorAll('.spd').forEach(o => o.classList.toggle('active', o === b));
      });
    });

    // Menu
    document.getElementById('menu-btn').addEventListener('click', () => {
      const p = document.getElementById('menu-panel');
      p.classList.toggle('hidden');
    });
    document.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById(b.dataset.close).classList.add('hidden');
      });
    });

    // Menu actions
    document.querySelectorAll('#menu-panel .row-btn').forEach(b => {
      b.addEventListener('click', () => {
        const a = b.dataset.action;
        document.getElementById('menu-panel').classList.add('hidden');
        switch (a) {
          case 'budget': openBudget(); break;
          case 'charts': openCharts(); break;
          case 'news': openNews(); break;
          case 'ordinances': openOrdinances(); break;
          case 'save': SR.save.save(); alert('CITY SAVED', 'good'); break;
          case 'load':
            if (SR.save.load()) alert('CITY LOADED', 'good');
            else alert('NO SAVE FOUND', 'bad');
            break;
          case 'export': openExport(); break;
          case 'import': openImport(); break;
          case 'newcity': openNewCity(); break;
          case 'audio': SR.audio.toggle(); break;
          case 'help': openHelp(); break;
        }
      });
    });
    document.getElementById('audio-state').textContent = SR.audio.isOn() ? 'ON' : 'OFF';

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-wrap').addEventListener('click', e => {
      if (e.target.id === 'modal-wrap') closeModal();
    });

    // Minimap modes
    document.querySelectorAll('#minimap-modes .mm').forEach(b => {
      b.addEventListener('click', () => SR.minimap.setMode(b.dataset.mode));
    });
    SR.minimap.setMode('terrain');
  }

  function markStatsDirty() { statsDirty = true; }

  function updateStats() {
    if (!statsDirty) return;
    statsDirty = false;
    const g = SR.game;
    document.getElementById('stat-date').textContent = SR.utils.dateStr(g);
    document.getElementById('stat-funds').textContent = SR.utils.fmtCredits(g.funds);
    document.getElementById('stat-pop').textContent = SR.utils.fmt(g.population);
    document.getElementById('stat-approval').textContent = (g.approval | 0) + '%';
    document.getElementById('stat-tax').textContent = (g.taxRate * 100).toFixed(1) + '%';

    // RCI bars (-100..100 -> centered 80px bar)
    function setRCI(id, v) {
      const w = SR.utils.clamp(Math.abs(v) / 100, 0, 1) * 40;
      const el = document.getElementById(id);
      el.style.width = w + 'px';
      el.style.left = (v >= 0 ? '50%' : (50 - w / 40 * 50) + '%');
    }
    setRCI('rci-r', g.demand.r);
    setRCI('rci-c', g.demand.c);
    setRCI('rci-i', g.demand.i);
  }

  function alert(msg, kind) {
    const wrap = document.getElementById('alerts');
    const el = document.createElement('div');
    el.className = 'alert ' + (kind || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = 0; }, 2200);
    setTimeout(() => { el.remove(); }, 2800);
  }

  function pushTicker(msg) {
    const t = document.getElementById('ticker-inner');
    if (!t) return;
    t.textContent = '> ' + msg + '   //   ' + t.textContent;
  }

  function updateCursorChip() {
    const c = SR.input.cursor;
    const t = SR.grid.get(c.x, c.y);
    const el = document.getElementById('cursor-info');
    if (!t) { el.textContent = ''; return; }
    let label = '';
    if (t.t === 'water') label = 'WATER';
    else if (t.building) label = (SR.BUILDINGS[t.building] && SR.BUILDINGS[t.building].label) || t.building;
    else if (t.zone) label = SR.ZONE_VIS[t.zone].name + ' L' + t.level;
    else if (t.road) label = t.road === 2 ? 'NEON HIGHWAY' : 'ROAD';
    else if (t.power) label = 'POWER LINE';
    else if (t.pipe) label = 'WATER PIPE';
    else label = 'GROUND z' + t.z;
    el.textContent = '[' + c.x + ',' + c.y + '] ' + label;
  }

  function showTileInfo(x, y) {
    const t = SR.grid.get(x, y);
    const panel = document.getElementById('info-panel');
    const body = document.getElementById('info-body');
    const title = document.getElementById('info-title');
    if (!t) { panel.classList.add('hidden'); return; }
    let html = '';
    let head = 'Tile [' + x + ',' + y + ']';

    if (t.t === 'water') {
      head = 'Water';
      html += '<div class="kv"><span class="k">Elevation</span><span class="v">' + t.z + '</span></div>';
    } else if (t.building) {
      const def = SR.BUILDINGS[t.building];
      head = def.label;
      html += '<div class="kv"><span class="k">Cost</span><span class="v">' + SR.utils.fmtCredits(def.cost) + '</span></div>';
      html += '<div class="kv"><span class="k">Maint</span><span class="v">' + SR.utils.fmtCredits(def.maint) + '/mo</span></div>';
      if (def.power) html += '<div class="kv"><span class="k">Power</span><span class="v">' + (def.power > 0 ? '+' : '') + def.power + ' kW</span></div>';
      if (def.water) html += '<div class="kv"><span class="k">Water</span><span class="v">' + (def.water > 0 ? '+' : '') + def.water + '</span></div>';
      if (def.jobs) html += '<div class="kv"><span class="k">Jobs</span><span class="v">' + def.jobs + '</span></div>';
      if (def.pop) html += '<div class="kv"><span class="k">Residents</span><span class="v">' + def.pop + '</span></div>';
      html += '<div class="kv"><span class="k">Powered</span><span class="v">' + (t.poweredBy ? 'YES' : 'NO') + '</span></div>';
      html += '<div class="kv"><span class="k">Watered</span><span class="v">' + (t.watered ? 'YES' : 'NO') + '</span></div>';
    } else if (t.zone) {
      head = SR.ZONE_VIS[t.zone].name + ' Zone';
      html += '<div class="kv"><span class="k">Density Lvl</span><span class="v">' + t.level + '/3</span></div>';
      if (t.pop) html += '<div class="kv"><span class="k">Pop</span><span class="v">' + t.pop + '</span></div>';
      if (t.jobs) html += '<div class="kv"><span class="k">Jobs</span><span class="v">' + t.jobs + '</span></div>';
      html += '<div class="kv"><span class="k">Power</span><span class="v">' + (t.poweredBy ? 'OK' : 'NONE') + '</span></div>';
      html += '<div class="kv"><span class="k">Water</span><span class="v">' + (t.watered ? 'OK' : 'NONE') + '</span></div>';
      html += '<div class="kv"><span class="k">Crime</span><span class="v">' + t.crime + '</span></div>';
      html += '<div class="kv"><span class="k">Pollution</span><span class="v">' + t.pollution + '</span></div>';
      html += '<div class="kv"><span class="k">Land Value</span><span class="v">' + t.land + '</span></div>';
    } else if (t.road) {
      head = t.road === 2 ? 'Neon Highway' : 'Road';
    } else {
      head = 'Empty Lot';
      html += '<div class="kv"><span class="k">Elevation</span><span class="v">' + t.z + '</span></div>';
      html += '<div class="kv"><span class="k">Land Value</span><span class="v">' + t.land + '</span></div>';
    }
    title.textContent = head;
    body.innerHTML = html;
    panel.classList.remove('hidden');
  }

  // ---- Modals ----
  function openModal(title, html) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-wrap').classList.remove('hidden');
  }
  function closeModal() { document.getElementById('modal-wrap').classList.add('hidden'); }

  function openBudget() {
    const g = SR.game;
    const tax = g.taxRate;
    const html = `
      <div class="section-title">TAXATION</div>
      <div class="slider-row">
        <label>Tax Rate</label>
        <input type="range" id="tax-slider" min="0" max="20" step="0.5" value="${(tax * 100).toFixed(1)}">
        <span class="val" id="tax-val">${(tax * 100).toFixed(1)}%</span>
      </div>
      <div class="section-title">LAST MONTH</div>
      <div class="kv"><span class="k">Income</span><span class="v">${SR.utils.fmtCredits(g.lastIncome || 0)}</span></div>
      <div class="kv"><span class="k">Expense</span><span class="v">${SR.utils.fmtCredits(g.lastExpense || 0)}</span></div>
      <div class="kv"><span class="k">Net</span><span class="v">${SR.utils.fmtCredits((g.lastIncome || 0) - (g.lastExpense || 0))}</span></div>
      <div class="section-title">CITY</div>
      <div class="kv"><span class="k">Population</span><span class="v">${SR.utils.fmt(g.population)}</span></div>
      <div class="kv"><span class="k">Jobs</span><span class="v">${SR.utils.fmt(g.jobs)}</span></div>
      <div class="kv"><span class="k">Power</span><span class="v">${(g.power.demand|0)} / ${(g.power.supply|0)}</span></div>
      <div class="kv"><span class="k">Water</span><span class="v">${(g.water.demand|0)} / ${(g.water.supply|0)}</span></div>
      <div class="kv"><span class="k">Approval</span><span class="v">${g.approval|0}%</span></div>
    `;
    openModal('BUDGET // ' + (g.cityName || 'CITY'), html);
    const slider = document.getElementById('tax-slider');
    const val = document.getElementById('tax-val');
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      g.taxRate = v / 100;
      val.textContent = v.toFixed(1) + '%';
      markStatsDirty();
    });
  }

  function openCharts() {
    const h = SR.game.history;
    if (!h || h.length === 0) { openModal('CHARTS', '<p>No data yet — wait a few months.</p>'); return; }
    const w = 540, ht = 200;
    const maxPop = Math.max(...h.map(x => x.pop || 0), 1);
    const maxFund = Math.max(...h.map(x => Math.abs(x.funds || 0)), 1);
    function path(arr, fn, color) {
      let d = '';
      for (let i = 0; i < arr.length; i++) {
        const x = (i / (arr.length - 1 || 1)) * (w - 20) + 10;
        const y = ht - 10 - fn(arr[i]) * (ht - 20);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      }
      return `<path d="${d}" stroke="${color}" fill="none" stroke-width="1.5" />`;
    }
    const svg = `
      <svg width="100%" viewBox="0 0 ${w} ${ht}" style="background:#0a0604;border:1px solid var(--line-2)">
        <g>${path(h, x => Math.min(1, (x.pop || 0) / maxPop), '#3aff7a')}</g>
        <g>${path(h, x => Math.min(1, Math.max(0, (x.funds || 0)) / maxFund), '#ffaa1f')}</g>
        <g>${path(h, x => Math.min(1, (x.income || 0) / Math.max(1, (x.income || 0) + (x.expense || 0)) ), '#3ad7ff')}</g>
      </svg>`;
    const html = `
      ${svg}
      <p><span style="color:#3aff7a">●</span> Population (max ${SR.utils.fmt(maxPop)})
         <span style="color:#ffaa1f">●</span> Funds (max ${SR.utils.fmtCredits(maxFund)})
         <span style="color:#3ad7ff">●</span> Income share</p>
      <div class="section-title">RECENT</div>
      ${h.slice(-12).reverse().map(x => `<div class="kv"><span class="k">${SR.utils.dateStr(x)}</span><span class="v">POP ${SR.utils.fmt(x.pop)} / ${SR.utils.fmtCredits(x.funds)}</span></div>`).join('')}
    `;
    openModal('CHARTS', html);
  }

  function openNews() {
    const items = SR.game.newsLog.slice(-30).reverse();
    const html = items.length
      ? items.map(n => `<div class="kv"><span class="k">${n.date}</span><span class="v">${n.text}</span></div>`).join('')
      : '<p>No news yet.</p>';
    openModal('NEWS FEED', html);
  }

  function openOrdinances() {
    const o = SR.game.ordinances;
    function row(key, label, desc) {
      const checked = o[key] ? 'checked' : '';
      return `<label style="display:block;padding:6px 0;border-bottom:1px dashed var(--line-2)">
        <input type="checkbox" data-ord="${key}" ${checked} style="accent-color:#ff6a00"> ${label}
        <div style="color:var(--text-d);font-size:13px">${desc}</div></label>`;
    }
    const html = `
      ${row('curfew', 'Neon Curfew', 'Reduces crime, lowers commerce demand.')}
      ${row('promo', 'Megacorp Tax Holiday', 'Boosts industrial demand, costs ₡200/mo.')}
      ${row('clean', 'Air Filtration Mandate', 'Cuts pollution by 25%, costs ₡150/mo.')}
      ${row('rec', 'Cyberware Subsidy', 'Boosts residential demand, costs ₡300/mo.')}
    `;
    openModal('ORDINANCES', html);
    document.querySelectorAll('[data-ord]').forEach(c => {
      c.addEventListener('change', () => { o[c.dataset.ord] = c.checked; });
    });
  }

  function openExport() {
    const txt = SR.save.exportJson();
    const html = `
      <p>Copy and save this JSON to back up your city.</p>
      <textarea id="exp-text" readonly></textarea>
      <div class="btn-row">
        <button class="pri" id="copy-btn">COPY</button>
        <button id="dl-btn">DOWNLOAD</button>
      </div>
    `;
    openModal('EXPORT SAVE', html);
    const ta = document.getElementById('exp-text');
    ta.value = txt;
    document.getElementById('copy-btn').addEventListener('click', () => {
      ta.select(); document.execCommand('copy'); alert('COPIED', 'good');
    });
    document.getElementById('dl-btn').addEventListener('click', () => {
      const blob = new Blob([txt], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = (SR.game.cityName || 'simrodman') + '.simrodman.json';
      a.click(); URL.revokeObjectURL(url);
    });
  }

  function openImport() {
    const html = `
      <p>Paste a SimRodman save JSON below and click LOAD.</p>
      <textarea id="imp-text" placeholder="{...}"></textarea>
      <div class="btn-row"><button class="pri" id="imp-btn">LOAD</button></div>
    `;
    openModal('IMPORT SAVE', html);
    document.getElementById('imp-btn').addEventListener('click', () => {
      const txt = document.getElementById('imp-text').value;
      if (SR.save.importJson(txt)) { alert('CITY LOADED', 'good'); closeModal(); }
      else alert('INVALID SAVE', 'bad');
    });
  }

  function openNewCity() {
    const html = `
      <p>Start a new city. Existing autosave will be overwritten when you save.</p>
      <div class="kv"><span class="k">City Name</span><span class="v"><input type="text" id="new-name" value="${SR.game.cityName || 'Neo-Rodman'}" maxlength="20" style="width:160px"></span></div>
      <div class="kv"><span class="k">Seed</span><span class="v"><input type="text" id="new-seed" value="${(Math.random()*1e9)|0}" style="width:160px"></span></div>
      <div class="kv"><span class="k">Difficulty</span><span class="v">
        <select id="new-diff" style="background:#0a0504;color:var(--orange-2);border:1px solid var(--line-2);padding:2px">
          <option value="easy">EASY (₡40k)</option>
          <option value="normal" selected>NORMAL (₡20k)</option>
          <option value="hard">HARD (₡10k)</option>
        </select></span></div>
      <div class="btn-row"><button class="pri" id="newcity-btn">JACK IN</button></div>
    `;
    openModal('NEW CITY', html);
    document.getElementById('newcity-btn').addEventListener('click', () => {
      const name = document.getElementById('new-name').value || 'Neo-Rodman';
      const seedRaw = document.getElementById('new-seed').value || '0';
      const seed = parseInt(seedRaw, 10) || hashStr(seedRaw);
      const diff = document.getElementById('new-diff').value;
      const funds = diff === 'easy' ? 40000 : diff === 'hard' ? 10000 : 20000;
      SR.game.newCity({ name, seed, funds });
      closeModal();
      alert('NEW CITY: ' + name.toUpperCase(), 'good');
    });
  }

  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function openHelp() {
    const html = `
      <div class="section-title">CONTROLS</div>
      <ul class="tips">
        <li><b>Click / tap</b> a tool, then click/drag the map to apply.</li>
        <li><b>Right-click drag</b> (desktop) or <b>two-finger drag</b> (mobile) to pan.</li>
        <li><b>Wheel</b> or <b>pinch</b> to zoom.</li>
        <li><b>Space</b> pause/play. <b>Esc</b> exits the current tool.</li>
        <li>Hotkeys: <b>B</b> bulldoze, <b>R</b> road, <b>H</b> highway, <b>P</b> power, <b>W</b> water,
          <b>1</b>/<b>2</b>/<b>3</b> R/C/I zone.</li>
      </ul>
      <div class="section-title">FIRST CITY CHEAT-SHEET</div>
      <ul class="tips">
        <li>Build a small power plant (Wind or Solar) and a Water Pump.</li>
        <li>Run Roads from your plants. Power & water spread along roads and pipes.</li>
        <li>Zone <b>R</b>esidential, <b>C</b>ommercial, <b>I</b>ndustrial in clusters touching roads.</li>
        <li>Add Police, Fire, Clinic, School in coverage range. Parks raise Land Value.</li>
        <li>Set tax rate in BUDGET. Watch the RCI bars to see what the city wants.</li>
        <li>Save often. Disasters love cities without service coverage.</li>
      </ul>
      <div class="section-title">TIPS</div>
      <ul class="tips">
        <li>Power and water travel through roads, power lines, pipes, buildings, and built-up zones.</li>
        <li>Industrial zones pollute. Keep them downwind of homes; use Air Filtration Mandate to mitigate.</li>
        <li>Once you hit 3000 pop, build a Megacorp Tower for huge job count. At 5000 pop, an Arcology houses thousands.</li>
        <li>The Rodman Plaza is unique and provides a city-wide morale boost.</li>
      </ul>
    `;
    openModal('HOW TO PLAY', html);
  }

  return {
    init,
    markStatsDirty,
    updateStats,
    alert, pushTicker,
    showTileInfo,
    updateCursorChip,
    openModal, closeModal,
    openHelp, openBudget, openCharts, openNews, openOrdinances,
    openExport, openImport, openNewCity,
  };
})();

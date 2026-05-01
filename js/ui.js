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
    document.getElementById('undo-btn').addEventListener('click', () => {
      SR.tools.undo();
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
          case 'dashboard': openDashboard(); break;
          case 'scenarios': openScenarios(); break;
          case 'search': openSearch(); break;
          case 'heatmap': openHeatmapPicker(); break;
          case 'keymap': openKeymap(); break;
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
          case 'loaddemo':
            SR.game.newCity({ name: 'Neo-Rodman Showcase', funds: 30000, mode: 'demo' });
            alert('DEMO CITY LOADED', 'good');
            break;
          case 'audio': SR.audio.toggle(); break;
          case 'music': SR.audio.toggleMusic(); break;
          case 'help': openHelp(); break;
          case 'achievements': openAchievements(); break;
          case 'tutorial': openTutorial(true); break;
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
    // Compact "9/9/9" display when bands diverge, otherwise the average.
    const r = (g.taxRates.r * 100).toFixed(1);
    const c = (g.taxRates.c * 100).toFixed(1);
    const i = (g.taxRates.i * 100).toFixed(1);
    document.getElementById('stat-tax').textContent =
      (r === c && c === i) ? r + '%' : `${r}/${c}/${i}%`;

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

  function advisor(msg, sev) {
    // Replace any existing advisor toast instead of stacking
    const wrap = document.getElementById('alerts');
    const old = wrap.querySelector('.alert.advisor');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'alert advisor ' + (sev || '');
    el.innerHTML = '<div style="font-size:11px;letter-spacing:2px;color:#ffaa1f">★ ADVISOR</div>'
      + '<div style="font-size:14px">' + msg + '</div>';
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = 0; }, 7000);
    setTimeout(() => { el.remove(); }, 7800);
    pushTicker('ADVISOR :: ' + msg);
  }

  function unlockAchievement(a) {
    const wrap = document.getElementById('alerts');
    const el = document.createElement('div');
    el.className = 'alert achv';
    el.innerHTML = '<div style="font-size:12px;letter-spacing:2px;color:#ffd23a">★ ACHIEVEMENT UNLOCKED</div>'
      + '<div style="font-size:15px">' + a.name + '</div>'
      + '<div style="font-size:12px;color:var(--text-d)">' + a.desc + '</div>';
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = 0; }, 4500);
    setTimeout(() => { el.remove(); }, 5200);
    SR.audio.sfx.levelup();
    pushTicker('★ ' + a.name + ' — ' + a.desc);
  }

  function openAchievements() {
    const list = SR.ACHIEVEMENTS || [];
    let unlocked = 0;
    const rows = list.map(a => {
      const got = SR.game.achievements && SR.game.achievements[a.key] && SR.game.achievements[a.key].unlocked;
      if (got) unlocked++;
      const v = got
        ? `<span class="v" style="color:#ffd23a">UNLOCKED</span>`
        : `<span class="v" style="color:var(--text-dim)">— locked</span>`;
      return `<div class="kv"><span class="k">${got ? '★ ' : '☆ '}${a.name}<div style="font-size:11px;color:var(--text-d)">${a.desc}</div></span>${v}</div>`;
    }).join('');
    openModal('ACHIEVEMENTS  (' + unlocked + ' / ' + list.length + ')', rows);
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
    const taxR = (g.taxRates.r * 100).toFixed(1);
    const taxC = (g.taxRates.c * 100).toFixed(1);
    const taxI = (g.taxRates.i * 100).toFixed(1);
    const loanRows = (g.loans || []).map(l => {
      const tag = l.kind === 'bond' ? 'Bond' : 'Loan';
      return `<div class="kv"><span class="k">${tag} #${l.id}</span><span class="v">${SR.utils.fmtCredits(l.balance|0)} (${l.monthsLeft}mo @ ${SR.utils.fmtCredits(l.monthly)}/mo)</span></div>`;
    }).join('') || '<div class="kv"><span class="k">No active debt</span><span class="v">—</span></div>';
    const totalLoanBal = (g.loans || []).reduce((s, l) => s + l.balance, 0);
    const maxLoan = SR.utils.clamp(20000 - totalLoanBal, 0, 20000);
    const maxBond = SR.utils.clamp(80000 - totalLoanBal, 0, 80000);
    const html = `
      <div class="section-title">TAXATION (R / C / I)</div>
      <div class="slider-row">
        <label>R Tax</label>
        <input type="range" id="tax-r" min="0" max="20" step="0.5" value="${taxR}">
        <span class="val" id="tax-r-val">${taxR}%</span>
      </div>
      <div class="slider-row">
        <label>C Tax</label>
        <input type="range" id="tax-c" min="0" max="20" step="0.5" value="${taxC}">
        <span class="val" id="tax-c-val">${taxC}%</span>
      </div>
      <div class="slider-row">
        <label>I Tax</label>
        <input type="range" id="tax-i" min="0" max="20" step="0.5" value="${taxI}">
        <span class="val" id="tax-i-val">${taxI}%</span>
      </div>
      <div class="section-title">LAST MONTH</div>
      <div class="kv"><span class="k">Income</span><span class="v">${SR.utils.fmtCredits(g.lastIncome || 0)}</span></div>
      <div class="kv"><span class="k">Expense</span><span class="v">${SR.utils.fmtCredits(g.lastExpense || 0)}</span></div>
      <div class="kv"><span class="k">  of which debt</span><span class="v">${SR.utils.fmtCredits(g.lastLoanPayment || 0)}</span></div>
      <div class="kv"><span class="k">Net</span><span class="v">${SR.utils.fmtCredits((g.lastIncome || 0) - (g.lastExpense || 0))}</span></div>
      <div class="section-title">LOANS &amp; BONDS</div>
      ${loanRows}
      <div class="kv"><span class="k">Total balance</span><span class="v">${SR.utils.fmtCredits(totalLoanBal|0)}</span></div>
      <div style="color:var(--text-d);font-size:12px;margin:6px 0 2px 0">SHORT-TERM LOAN — 30 months, ~20% total interest. Cap ₡20,000.</div>
      <div class="btn-row">
        <button id="loan-2k"  ${maxLoan >= 2000  ? '' : 'disabled'}>LOAN ₡2k</button>
        <button id="loan-5k"  ${maxLoan >= 5000  ? '' : 'disabled'}>LOAN ₡5k</button>
        <button id="loan-10k" ${maxLoan >= 10000 ? '' : 'disabled'}>LOAN ₡10k</button>
      </div>
      <div style="color:var(--text-d);font-size:12px;margin:8px 0 2px 0">MUNICIPAL BOND — 60 months, ~10% total interest. Cap ₡80,000 across all debt.</div>
      <div class="btn-row">
        <button id="bond-10k" ${maxBond >= 10000 ? '' : 'disabled'}>BOND ₡10k</button>
        <button id="bond-25k" ${maxBond >= 25000 ? '' : 'disabled'}>BOND ₡25k</button>
        <button id="bond-50k" ${maxBond >= 50000 ? '' : 'disabled'}>BOND ₡50k</button>
      </div>
      <div class="section-title">CITY</div>
      <div class="kv"><span class="k">Population</span><span class="v">${SR.utils.fmt(g.population)}</span></div>
      <div class="kv"><span class="k">Jobs</span><span class="v">${SR.utils.fmt(g.jobs)}</span></div>
      <div class="kv"><span class="k">Power</span><span class="v">${(g.power.demand|0)} / ${(g.power.supply|0)}</span></div>
      <div class="kv"><span class="k">Water</span><span class="v">${(g.water.demand|0)} / ${(g.water.supply|0)}</span></div>
      <div class="kv"><span class="k">Approval</span><span class="v">${g.approval|0}%</span></div>
    `;
    openModal('BUDGET // ' + (g.cityName || 'CITY'), html);
    function bindTax(id, valId, key) {
      const s = document.getElementById(id);
      const v = document.getElementById(valId);
      if (!s) return;
      s.addEventListener('input', () => {
        const n = parseFloat(s.value);
        g.taxRates[key] = n / 100;
        v.textContent = n.toFixed(1) + '%';
        markStatsDirty();
      });
    }
    bindTax('tax-r', 'tax-r-val', 'r');
    bindTax('tax-c', 'tax-c-val', 'c');
    bindTax('tax-i', 'tax-i-val', 'i');

    function takeDebt(amount, kind) {
      const interest = kind === 'bond' ? 0.10 : 0.20;
      const months   = kind === 'bond' ? 60   : 30;
      const principal = amount * (1 + interest);
      const monthly = Math.ceil(principal / months);
      g.loans.push({
        id: g.nextLoanId++, kind: kind || 'loan',
        principal, balance: principal, monthly, monthsLeft: months,
      });
      g.funds += amount;
      markStatsDirty();
      SR.audio.sfx.cash();
      alert((kind === 'bond' ? 'BOND ISSUED: ' : 'LOAN APPROVED: ') + SR.utils.fmtCredits(amount), 'good');
      closeModal();
      openBudget(); // refresh
    }
    const bind = (id, amt, kind) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => takeDebt(amt, kind));
    };
    bind('loan-2k',  2000,  'loan');
    bind('loan-5k',  5000,  'loan');
    bind('loan-10k', 10000, 'loan');
    bind('bond-10k', 10000, 'bond');
    bind('bond-25k', 25000, 'bond');
    bind('bond-50k', 50000, 'bond');
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
      <div class="kv"><span class="k">Layout</span><span class="v" style="text-align:left">
        <label style="display:block;cursor:pointer;padding:2px 0"><input type="radio" name="new-mode" value="starter" checked style="accent-color:#ff6a00"> Starter city (recommended)</label>
        <label style="display:block;cursor:pointer;padding:2px 0"><input type="radio" name="new-mode" value="demo"   style="accent-color:#ff6a00"> Demo city (showcase)</label>
        <label style="display:block;cursor:pointer;padding:2px 0"><input type="radio" name="new-mode" value="blank"   style="accent-color:#ff6a00"> Blank slate</label>
      </span></div>
      <div style="font-size:12px;color:var(--text-d);margin:4px 0 8px 0">
        <b>Starter</b> drops a road cross, wind farm, water pump, holopark and R/C/I zones (free).
        <b>Demo</b> spawns a fully-developed showcase city — multi-block grid, services, megacorp, plaza and pre-grown districts. (Demo uses a fixed map seed.)
        <b>Blank</b> begins on virgin terrain.
      </div>
      <div class="btn-row"><button class="pri" id="newcity-btn">JACK IN</button></div>
    `;
    openModal('NEW CITY', html);
    document.getElementById('newcity-btn').addEventListener('click', () => {
      const name = document.getElementById('new-name').value || 'Neo-Rodman';
      const seedRaw = document.getElementById('new-seed').value || '0';
      const seed = parseInt(seedRaw, 10) || hashStr(seedRaw);
      const diff = document.getElementById('new-diff').value;
      const funds = diff === 'easy' ? 40000 : diff === 'hard' ? 10000 : 20000;
      const sel = document.querySelector('input[name="new-mode"]:checked');
      const mode = (sel && sel.value) || 'starter';
      SR.game.newCity({ name, seed, funds, mode });
      closeModal();
      alert('NEW CITY: ' + name.toUpperCase(), 'good');
    });
  }

  function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function openTutorial(force) {
    if (!force && SR.game.tutorialDone) return;
    const html = `
      <div class="section-title">WELCOME TO NEO-RODMAN, MAYOR</div>
      <p>Your <b>starter city</b> is on the map: a road cross, a wind farm,
      a water pump, a holopark, and one strip each of R/C/I zones. Press
      <span style="color:var(--orange-2)">▶</span> to start time and watch
      it boot. Now expand it.</p>
      <ol class="tips">
        <li><b>Find the city.</b> The camera is centered on the cross of
          orange roads. Two power and water sources sit at its east and west ends.</li>
        <li><b>Add roads.</b> Pick <span style="color:var(--orange-2)">≡ Road</span>
          and drag new streets outward. Power &amp; water travel through them.</li>
        <li><b>Zone more.</b> Use <span style="color:#3aff7a">R</span>,
          <span style="color:#3ad7ff">C</span>,
          <span style="color:#ffd23a">I</span> to paint districts directly next to
          your roads. Zones must touch a carrier (road, wire, building).</li>
        <li><b>Services.</b> Once population grows, add Police, Fire, Cyberclinic,
          Datanet School, and more Holoparks within their coverage radii.</li>
        <li><b>Power up.</b> Wind only outputs 50 kW. Build a Solar Array, then
          Coal, then a Fusion Reactor as your city scales.</li>
        <li><b>Tax &amp; Loans.</b> Use the menu (top-right) to open
          <i>Budget &amp; Taxes</i>. Take a loan if you're stuck.</li>
        <li><b>Camera.</b> Right-click drag (desktop) or two-finger drag (mobile)
          to pan; wheel/pinch to zoom.</li>
      </ol>
      <div class="btn-row">
        <button class="pri" id="tutorial-start">JACK IN, MAYOR</button>
        <button id="tutorial-skip">SKIP</button>
      </div>
    `;
    openModal('NEO-RODMAN ONBOARDING', html);
    function done() { SR.game.tutorialDone = true; closeModal(); SR.save.save(); }
    document.getElementById('tutorial-start').addEventListener('click', done);
    document.getElementById('tutorial-skip').addEventListener('click', done);
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

  // ---- Bankruptcy / game-over (#4) ----
  function gameOver(reason) {
    const html = `
      <div class="section-title glitch">SYSTEM HALTED // INSOLVENT</div>
      <p>The municipal treasury has been below ₡-5,000 for six months. The
      megacorps have foreclosed. Neo-Rodman is in receivership.</p>
      <p>Choose your fate, mayor.</p>
      <div class="btn-row">
        <button class="pri" id="go-bailout">ACCEPT BAILOUT (-25% APPROVAL, +₡20,000)</button>
      </div>
      <div class="btn-row">
        <button id="go-restart">RESTART (DEMO CITY)</button>
        <button id="go-blank">RESTART (BLANK)</button>
      </div>
    `;
    openModal('GAME OVER', html);
    document.getElementById('go-bailout').addEventListener('click', () => {
      SR.game.funds += 20000;
      SR.game.approval = SR.utils.clamp(SR.game.approval - 25, 0, 100);
      SR.game.debtMonths = 0;
      SR.game.gameOver = null;
      markStatsDirty();
      closeModal();
      alert('BAILOUT ACCEPTED', 'good');
    });
    document.getElementById('go-restart').addEventListener('click', () => {
      SR.game.newCity({ mode: 'demo' });
      closeModal();
    });
    document.getElementById('go-blank').addEventListener('click', () => {
      SR.game.newCity({ mode: 'blank' });
      closeModal();
    });
  }

  // ---- Year-end report (#94) ----
  const YEAR_QUOTES = [
    'Another year of neon, smog and rent hikes. Not bad.',
    '"This city never sleeps." — anonymous mayor',
    'Megacorps watching. Citizens posting. Drones humming.',
    'The grid held. Mostly.',
    'Crime is down, rent is up — call it progress.',
  ];
  function yearEndReport(year) {
    const g = SR.game;
    const popDelta = g.population - (g.yearStart.population || 0);
    const fundsDelta = g.funds - (g.yearStart.funds || 0);
    const quote = YEAR_QUOTES[(year + g.population) % YEAR_QUOTES.length];
    const html = `
      <div class="section-title">YEAR ${year} :: ANNUAL REVIEW</div>
      <div class="kv"><span class="k">Population start → end</span><span class="v">${SR.utils.fmt(g.yearStart.population || 0)} → ${SR.utils.fmt(g.population)} (${popDelta >= 0 ? '+' : ''}${SR.utils.fmt(popDelta)})</span></div>
      <div class="kv"><span class="k">Funds start → end</span><span class="v">${SR.utils.fmtCredits(g.yearStart.funds || 0)} → ${SR.utils.fmtCredits(g.funds)} (${fundsDelta >= 0 ? '+' : ''}${SR.utils.fmtCredits(fundsDelta)})</span></div>
      <div class="kv"><span class="k">Approval</span><span class="v">${g.approval | 0}%</span></div>
      <div class="kv"><span class="k">Jobs</span><span class="v">${SR.utils.fmt(g.jobs)}</span></div>
      <div class="kv"><span class="k">Goods (prod / cons)</span><span class="v">${(g.goods.produced)|0} / ${(g.goods.consumed)|0}</span></div>
      <div class="kv"><span class="k">Garbage (prod / handled)</span><span class="v">${(g.garbage.produced)|0} / ${(g.garbage.handled)|0}</span></div>
      <div style="margin-top:10px;color:var(--orange-2);font-style:italic">${quote}</div>
      <div class="btn-row"><button class="pri" id="ye-ok">CONTINUE</button></div>
    `;
    openModal('YEAR END', html);
    document.getElementById('ye-ok').addEventListener('click', closeModal);
  }

  // ---- Keymap overlay (#79) ----
  function openKeymap() {
    const rows = [
      ['B', 'Demolish'], ['R', 'Road'], ['H', 'Highway'],
      ['P', 'Power line'], ['W', 'Water pipe'], ['M', 'Maglev'],
      ['1 / 2 / 3', 'Zone R / C / I'],
      ['4..8', 'Police / Fire / Clinic / School / Park'],
      ['9 / 0', 'Solar / Wind'],
      ['Space', 'Pause / play'],
      ['Esc', 'Cancel tool / close modal'],
      ['Arrows', 'Pan camera'],
      ['+ / -', 'Zoom'],
      ['Ctrl/Cmd+S', 'Quick save'],
      ['Ctrl/Cmd+Z', 'Undo'],
      ['?', 'Show this keymap'],
    ];
    const html = '<div class="section-title">KEYBINDINGS</div>'
      + rows.map(([k, v]) =>
          `<div class="kv"><span class="k" style="color:var(--orange-2)">${k}</span><span class="v">${v}</span></div>`
        ).join('');
    openModal('KEYBOARD CHEAT-SHEET', html);
  }

  // ---- Heatmap overlay picker (#74) ----
  function openHeatmapPicker() {
    const cur = SR.game.heatmap || 'none';
    const opts = [
      ['none',      'OFF'],
      ['pollution', 'Pollution'],
      ['crime',     'Crime'],
      ['value',     'Land Value'],
      ['density',   'Population Density'],
    ];
    const html = '<div class="section-title">HEAT-MAP OVERLAY</div>'
      + '<p>Tints the main viewport with the selected metric.</p>'
      + opts.map(([k, label]) =>
          `<div class="btn-row"><button class="${cur === k ? 'pri' : ''}" data-heat="${k}">${label}</button></div>`
        ).join('');
    openModal('HEAT-MAP', html);
    document.querySelectorAll('[data-heat]').forEach(b => {
      b.addEventListener('click', () => {
        SR.game.heatmap = b.dataset.heat === 'none' ? null : b.dataset.heat;
        closeModal();
      });
    });
  }

  // ---- City health dashboard (#76) ----
  function openDashboard() {
    const g = SR.game;
    // Aggregate averages
    let polTot = 0, crimeTot = 0, valTot = 0, n = 0;
    for (const t of SR.grid.tiles) if (t.zone) { n++; polTot += t.pollution; crimeTot += t.crime; valTot += t.land; }
    n = n || 1;
    const stats = [
      { label: 'Power',    val: g.power.supply > 0 ? Math.min(100, g.power.supply / Math.max(1, g.power.demand) * 50) : 0 },
      { label: 'Water',    val: g.water.supply > 0 ? Math.min(100, g.water.supply / Math.max(1, g.water.demand) * 50) : 0 },
      { label: 'Approval', val: g.approval },
      { label: 'Land',     val: valTot / n },
      { label: 'Air',      val: 100 - polTot / n },     // inverted pollution
      { label: 'Order',    val: 100 - crimeTot / n },   // inverted crime
    ];
    const W = 320, H = 280, cx = W / 2, cy = H / 2, R = 100;
    const N = stats.length;
    function pt(i, val) {
      const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const r = (val / 100) * R;
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
    }
    let polyD = '';
    for (let i = 0; i < N; i++) {
      const p = pt(i, stats[i].val);
      polyD += (i ? ' L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }
    polyD += ' Z';
    let axes = '';
    for (let i = 0; i < N; i++) {
      const o = pt(i, 100);
      axes += `<line x1="${cx}" y1="${cy}" x2="${o.x}" y2="${o.y}" stroke="rgba(255,170,31,0.18)"/>`;
    }
    let rings = '';
    for (let r = 25; r <= 100; r += 25) {
      let d = '';
      for (let i = 0; i < N; i++) {
        const p = pt(i, r);
        d += (i ? ' L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
      }
      d += ' Z';
      rings += `<path d="${d}" stroke="rgba(255,170,31,0.12)" fill="none"/>`;
    }
    let labels = '';
    for (let i = 0; i < N; i++) {
      const o = pt(i, 115);
      labels += `<text x="${o.x}" y="${o.y}" fill="#ffaa1f" text-anchor="middle" font-size="11" font-family="inherit">${stats[i].label}</text>`;
    }
    const svg = `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="background:#0a0604;border:1px solid var(--line-2)">
        ${rings}${axes}${labels}
        <path d="${polyD}" fill="rgba(255,106,0,0.25)" stroke="#ff8a1f" stroke-width="1.5" />
      </svg>`;
    const rows = stats.map(s =>
      `<div class="kv"><span class="k">${s.label}</span><span class="v">${(s.val | 0)}%</span></div>`
    ).join('');
    openModal('CITY HEALTH', svg + rows);
  }

  // ---- Search bar (#73) ----
  function openSearch() {
    const html = `
      <p>Type a building name (or partial match) to highlight all instances on the map.</p>
      <input type="text" id="search-input" placeholder="e.g. police, megacorp, solar" autofocus>
      <div class="btn-row">
        <button class="pri" id="search-apply">HIGHLIGHT</button>
        <button id="search-clear">CLEAR</button>
      </div>
      <div style="font-size:12px;color:var(--text-d);margin-top:6px">Tip: leave blank and press CLEAR to remove the highlight.</div>
    `;
    openModal('FIND BUILDING', html);
    function apply() {
      SR.game.search = document.getElementById('search-input').value.trim().toLowerCase();
      closeModal();
    }
    document.getElementById('search-apply').addEventListener('click', apply);
    document.getElementById('search-clear').addEventListener('click', () => {
      SR.game.search = '';
      closeModal();
    });
    document.getElementById('search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') apply();
    });
  }

  // ---- Scenarios (#71) ----
  function openScenarios() {
    const list = SR.SCENARIOS || [];
    const active = list.find(s => s.key === SR.game.activeScenario);
    let html = '<div class="section-title">SCENARIOS</div>';
    if (active) {
      const prog = active.progress(SR.game);
      const months = (SR.game.year - SR.game.scenarioStartYear) * 12 + (SR.game.month - SR.game.scenarioStartMonth);
      html += `<div class="kv"><span class="k">${active.name} (active)</span><span class="v">${months} / ${active.deadlineMonths} mo</span></div>`;
      html += `<div style="font-size:12px;color:var(--text-d)">${active.desc}</div>`;
      html += `<div class="bar"><span style="width:${(prog * 100) | 0}%"></span></div>`;
      html += `<div class="kv"><span class="k">Progress</span><span class="v">${(prog * 100) | 0}%</span></div>`;
      html += `<div class="btn-row"><button id="scen-cancel">ABANDON SCENARIO</button></div>`;
    } else {
      html += '<p>Pick a goal — the timer starts when you accept.</p>';
      for (const s of list) {
        html += `<div style="border:1px solid var(--line-2);padding:6px;margin:6px 0">
          <div style="color:var(--orange-2)">${s.name}</div>
          <div style="font-size:12px;color:var(--text-d);margin-bottom:4px">${s.desc}</div>
          <div style="font-size:12px">Deadline: ${s.deadlineMonths} months</div>
          <div class="btn-row"><button class="pri" data-scen="${s.key}">ACCEPT</button></div>
        </div>`;
      }
    }
    openModal('SCENARIOS', html);
    document.querySelectorAll('[data-scen]').forEach(b => {
      b.addEventListener('click', () => {
        SR.game.activeScenario = b.dataset.scen;
        SR.game.scenarioStartYear = SR.game.year;
        SR.game.scenarioStartMonth = SR.game.month;
        alert('SCENARIO ACTIVE', 'good');
        closeModal();
      });
    });
    const cancel = document.getElementById('scen-cancel');
    if (cancel) cancel.addEventListener('click', () => {
      SR.game.activeScenario = null;
      closeModal();
    });
  }

  function checkScenarioCompletion() {
    const key = SR.game.activeScenario;
    if (!key || !SR.SCENARIOS) return;
    const scen = SR.SCENARIOS.find(s => s.key === key);
    if (!scen) return;
    const months = (SR.game.year - SR.game.scenarioStartYear) * 12 + (SR.game.month - SR.game.scenarioStartMonth);
    if (scen.test(SR.game)) {
      alert('SCENARIO COMPLETE: ' + scen.name.toUpperCase(), 'good');
      pushTicker('★ Scenario complete: ' + scen.name);
      if (scen.reward) SR.game.funds += scen.reward;
      SR.game.activeScenario = null;
    } else if (months > scen.deadlineMonths) {
      alert('SCENARIO FAILED: ' + scen.name.toUpperCase(), 'bad');
      pushTicker('Scenario expired: ' + scen.name);
      SR.game.activeScenario = null;
    }
  }

  return {
    init,
    markStatsDirty,
    updateStats,
    alert, pushTicker, unlockAchievement, advisor,
    showTileInfo,
    updateCursorChip,
    openModal, closeModal,
    openHelp, openBudget, openCharts, openNews, openOrdinances,
    openExport, openImport, openNewCity,
    openAchievements, openTutorial,
    openKeymap, openDashboard, openSearch, openScenarios,
    yearEndReport, gameOver, checkScenarioCompletion,
  };
})();

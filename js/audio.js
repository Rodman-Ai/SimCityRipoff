// audio.js — minimal cyberpunk SFX synth using WebAudio (no external assets)
'use strict';

SR.audio = (() => {
  let ctx = null;
  let on = true;
  let masterGain = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function setOn(v) {
    on = !!v;
    document.getElementById('audio-state').textContent = on ? 'ON' : 'OFF';
    if (on) ensure();
  }
  function isOn() { return on; }
  function toggle() { setOn(!on); }

  function blip(freq, dur, type, vol) {
    if (!on) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(vol || 0.12, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g).connect(masterGain);
    osc.start();
    osc.stop(c.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lp) {
    if (!on) return;
    const c = ensure();
    if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol || 0.2;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    src.connect(f).connect(g).connect(masterGain);
    src.start();
  }

  // Named SFX
  const SFX = {
    click: () => blip(880, 0.05, 'square', 0.08),
    place: () => { blip(660, 0.06, 'square'); setTimeout(() => blip(990, 0.06, 'square'), 40); },
    bulldoze: () => noise(0.18, 0.18, 600),
    deny: () => blip(160, 0.12, 'sawtooth', 0.18),
    cash: () => { blip(1320, 0.05, 'triangle'); setTimeout(() => blip(1760, 0.06, 'triangle'), 50); },
    alert: () => { blip(440, 0.1, 'sawtooth'); setTimeout(() => blip(330, 0.12, 'sawtooth'), 90); },
    boom: () => noise(0.5, 0.35, 300),
    levelup: () => { [880, 1100, 1320].forEach((f, i) => setTimeout(() => blip(f, 0.07, 'triangle'), i * 60)); },
  };

  return { setOn, isOn, toggle, ensure, sfx: SFX };
})();

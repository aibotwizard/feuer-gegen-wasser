// Töne: alles im Browser erzeugt, keine Dateien. Startet mit dem ersten Tastendruck (vorher sperrt der Browser den Ton).
(function (FW) {
  const audio = FW.audio = { muted: false };
  let ctx = null, master = null, noiseBuf = null, crackle = null, whoosh = null, wind = null, birdT = 3;
  try { audio.muted = localStorage.getItem("fireWaterMuted") === "1"; } catch (_) {}

  audio.unlock = function () {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = audio.muted ? 0 : 0.8; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Knistern: Stille mit zufälligen kurzen Knacksern
    const cb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), c = cb.getChannelData(0);
    for (let n = 0; n < 70; n++) { const at = (Math.random() * (c.length - 900)) | 0, len = 120 + Math.random() * 700, a = 0.3 + Math.random() * 0.7; for (let i = 0; i < len; i++) c[at + i] += (Math.random() * 2 - 1) * a * Math.pow(1 - i / len, 3); }
    crackle = loop(cb, "highpass", 900, 0); whoosh = loop(noiseBuf, "bandpass", 500, 0); wind = loop(noiseBuf, "lowpass", 380, 0.012);
  };
  function loop(buffer, type, freq, gain) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buffer; src.loop = true; f.type = type; f.frequency.value = freq; g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    return { f, g };
  }
  audio.setMuted = function (m) {
    audio.muted = m; try { localStorage.setItem("fireWaterMuted", m ? "1" : "0"); } catch (_) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.03);
  };

  // Bausteine: Ton mit gleitender Tonhöhe, Rauschen mit gleitendem Filter
  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(type, f0, f1, dur, vol, delay = 0, q = 1) {
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const notes = (list, type, step, dur, vol) => list.forEach((f, i) => tone(type, f, f, dur, vol, i * step));

  const SOUNDS = {
    sprout:  () => { tone("sine", 260, 620, 0.09, 0.16); noise("bandpass", 900, 500, 0.08, 0.05); },
    rain:    () => tone("sine", 1500, 520, 0.85, 0.035),
    landed:  () => { tone("sine", 520, 130, 0.14, 0.3); noise("highpass", 1800, 900, 0.22, 0.12); },
    crouch:  () => tone("triangle", 150, 95, 0.13, 0.18),
    lunge:   () => noise("bandpass", 300, 1800, 0.26, 0.2, 0, 2),
    dart:    () => tone("triangle", 220, 480, 0.12, 0.12),
    jump:    () => tone("sine", 300, 760, 0.17, 0.16),
    land:    () => { tone("sine", 130, 60, 0.11, 0.2); noise("lowpass", 500, 200, 0.1, 0.1); },
    dodge:   () => noise("bandpass", 1400, 2600, 0.14, 0.09, 0, 3),
    angry:   () => { tone("sawtooth", 90, 60, 0.35, 0.12); tone("sawtooth", 96, 64, 0.35, 0.1); },
    drunk:   ev => {                                              // Schlucken, dazu ein Ton, der mit der Kombo höher wird
      tone("sine", 240, 110, 0.12, 0.3); tone("sine", 150, 300, 0.14, 0.26, 0.11);
      const f = 523 * Math.pow(1.189, (ev.combo || 1) - 1); tone("triangle", f, f, 0.22, 0.16, 0.16); tone("triangle", f * 1.5, f * 1.5, 0.3, 0.11, 0.24);
    },
    burned:  () => { noise("bandpass", 260, 2400, 0.55, 0.32, 0, 1.2); noise("highpass", 2500, 1200, 0.5, 0.1, 0.1); tone("sine", 180, 60, 0.3, 0.14); },
    doused:  () => { noise("highpass", 5200, 1400, 1.3, 0.34); tone("sine", 140, 40, 0.5, 0.3); },
    lastTree: () => { tone("square", 880, 880, 0.09, 0.07); tone("square", 880, 880, 0.09, 0.07, 0.16); },
    finale:  () => notes([392, 494, 587, 784], "triangle", 0.09, 0.2, 0.14),
    won:     () => notes([523, 659, 784, 1047, 1319], "triangle", 0.11, 0.3, 0.16),
    lost:    () => notes([392, 330, 262, 196], "triangle", 0.17, 0.34, 0.15),
    over:    () => notes([330, 294, 247, 220, 165], "sawtooth", 0.2, 0.42, 0.08),
    life:    () => notes([784, 1047, 1568], "sine", 0.08, 0.22, 0.14),
    start:   () => notes([392, 523, 659], "triangle", 0.07, 0.16, 0.13),
    blip:    () => tone("sine", 660, 880, 0.07, 0.1)
  };
  audio.play = function (name, ev) { if (ctx && !audio.muted && ctx.state === "running" && SOUNDS[name]) SOUNDS[name](ev || {}); };

  // Einmal pro Bild: Knistern und Rauschen folgen dem Feuer, ab und zu ein Vogel
  audio.frame = function (dt, speed, alive, night) {
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    crackle.g.gain.setTargetAtTime(alive ? 0.11 + 0.05 * speed : 0, t, 0.08);
    whoosh.g.gain.setTargetAtTime(alive ? 0.05 * speed : 0, t, 0.06); whoosh.f.frequency.setTargetAtTime(380 + 500 * speed, t, 0.1);
    wind.g.gain.setTargetAtTime(0.012 + 0.006 * Math.sin(t * 0.4), t, 0.5);
    if ((birdT -= dt) <= 0 && !audio.muted) {
      birdT = 3 + Math.random() * 6;
      if (night) { for (let i = 0; i < 4; i++) tone("sine", 4200, 4200, 0.04, 0.012, i * 0.07); }      // Grille
      else { const f = 2200 + Math.random() * 1400; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) tone("sine", f, f * (1.15 + Math.random() * 0.3), 0.09, 0.022, i * 0.13); }
    }
  };
})(globalThis.FW = globalThis.FW || {});

// Spielschleife, Tastatur und Ablauf: Titel -> Level -> gewonnen / Leben verloren -> ... -> Spiel vorbei.
(function (FW) {
  const sim = FW.sim, CFG = FW.CFG, stage = FW.stage, sprites = FW.sprites, fx = FW.fx, audio = FW.audio, hud = FW.hud;
  const $ = id => document.getElementById(id);
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } };
  const save = (k, v) => { if (G.auto) return; try { localStorage.setItem(k, String(v)); } catch (_) {} };   // Tests speichern nichts
  const seed = () => (Math.random() * 0x7fffffff) | 0;
  const over = w => w.phase === "won" || w.phase === "lost";

  // ---------- gespeicherte Werte ----------
  let wins = parseInt(load("fireWaterWins", "0"), 10) || 0;
  let best = { level: 0, score: 0 }; try { best = Object.assign(best, JSON.parse(load("fireWaterBest", "{}"))); } catch (_) {}
  let hintSeen = load("fireWaterHint", "") === "1";

  // state: title | play | pause | won | lost | over.  wait/next: nach wait Sekunden (oder Leertaste) geht es mit next weiter.
  const G = { state: "title", world: null, run: { level: 1, lives: CFG.lives, score: 0, attempt: 1 }, demo: true, pilot: false, auto: /[?&]auto\b/.test(location.search),
              time: 0, acc: 0, timeScale: 1, freeze: 0, wait: 0, since: 0, next: null, hint: false, fpsT: 0, fpsN: 0 };

  // ---------- Eingabe ----------
  const keys = new Set();
  const MOVE = { up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"] };
  const held = n => MOVE[n].some(k => keys.has(k));
  const STILL = { mx: 0, my: 0 }, DIRS = [STILL, ...Array.from({ length: 8 }, (_, i) => ({ mx: Math.cos(i * Math.PI / 4), my: Math.sin(i * Math.PI / 4) }))];
  window.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) { keys.clear(); return; }
    if (G.auto) return;                                    // automatischer Test läuft: Tastatur ignorieren
    audio.unlock();
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    if (!e.repeat) command(e.code);
    keys.add(e.code);
  });
  window.addEventListener("keyup", e => keys.delete(e.code));
  window.addEventListener("blur", () => { keys.clear(); if (G.state === "play" && !G.auto) pause(true); });

  function command(code) {
    if (code === "KeyF") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); return; }
    if (code === "KeyM") { audio.setMuted(!audio.muted); hud.muted(audio.muted); return; }
    if (code === "KeyP" || code === "Escape") { if (G.state === "play") pause(true); else if (G.state === "pause") pause(false); return; }
    if (code === "KeyR" && (G.state === "play" || G.state === "pause")) { restart(); return; }
    if (code === "Space" || code === "Enter") {
      if (G.state === "title" || G.state === "over") startRun();
      else if (G.state === "pause") pause(false);
      else if ((G.state === "won" || G.state === "lost") && G.since > 0.7 && G.next) proceed();
    }
  }
  function proceed() { const f = G.next; G.next = null; G.wait = 0; if (f) f(); }
  function later(seconds, f) { G.wait = seconds; G.since = 0; G.next = f; }

  // ---------- Ablauf ----------
  function newWorld(level, flawless) {
    sprites.clear(); fx.clear(); stage.unfocus(true); stage.setGray(false); stage.setMood(level - 1);
    G.world = sim.create({ level, seed: seed(), flawless }); G.acc = 0; G.timeScale = 1; G.freeze = 0;
    hud.hint(null); hud.arrow(); hud.lastTree(null);
  }
  function showTitle() {
    G.state = "title"; G.demo = true; G.next = null; G.wait = 0;
    hud.screen("title"); hud.playing(false); hud.hideBanner(); hud.title(best, wins);
    newWorld(2 + (Math.random() * 3 | 0), true);
  }
  function startRun() {
    G.run = { level: 1, lives: CFG.lives, score: 0, attempt: 1 }; G.demo = false;
    hud.resetScore(0); hud.screen(null); hud.playing(true); hud.muted(audio.muted); audio.play("start");
    startLevel();
  }
  function startLevel() {
    const r = G.run; newWorld(r.level, r.attempt === 1); G.state = "play"; G.next = null; G.wait = 0;
    const d = G.world.def;
    hud.banner("level", "Level " + r.level, `${d.trees} Bäume · ${d.waters} Wasser · ${stage.mood.name}`, { seconds: 1.8 });
    G.hint = r.level === 1 && !hintSeen;
  }
  function pause(on) { G.state = on ? "pause" : "play"; hud.screen(on ? "pause" : null); audio.play("blip"); }
  // Level neu starten: kostet nichts, solange noch kein Wasser gelandet ist, danach ein Leben
  function restart() {
    const r = G.run; hud.screen(null);
    if (G.world.phase !== "rain") { r.lives--; r.attempt++; if (r.lives <= 0) return gameOver(); }
    startLevel();
  }
  function levelWon(res) {
    const r = G.run, w = G.world; r.score += res.total; wins++; save("fireWaterWins", wins);
    const extra = r.level % CFG.extraLifeEvery === 0 && r.lives < CFG.maxLives; if (extra) r.lives++;
    G.state = "won"; G.timeScale = 0.5; stage.focus(w.fire.x, w.fire.y, 1.22);
    audio.play("won"); if (extra) audio.play("life");
    const parts = [`Zeit ${res.time.toFixed(1).replace(".", ",")} s (Ziel ${res.par} s)`, `+${hud.fmt(res.total)} Punkte`];
    if (res.maxCombo > 1) parts.push("Kombo ×" + res.maxCombo); if (extra) parts.push("+1 Leben");
    hud.banner("win", "Level geschafft!", parts.join(" · "), { stars: res.stars, note: "Leertaste: weiter" });
    updateBest();
    later(7, () => { r.level++; r.attempt = 1; startLevel(); });
  }
  function levelLost(reason) {
    const r = G.run, w = G.world; r.lives--;
    G.state = "lost"; G.timeScale = 0.5; stage.focus(w.fire.x, w.fire.y, 1.22); audio.play("lost");
    const title = reason === "doused" ? "Gelöscht!" : "Letzter Baum verbrannt!";
    const why = reason === "doused" ? "Das Wasser hat dich erwischt." : "Nur Bäume können Wasser trinken.";
    if (r.lives > 0) { hud.banner("lose", title, `${why} Noch ${r.lives} Leben.`, { note: "Leertaste: noch mal" }); later(5, () => { r.attempt++; startLevel(); }); }
    else { hud.banner("lose", title, why); later(2.4, gameOver); }
  }
  function updateBest() {
    const r = G.run, isNew = r.score > best.score || r.level > best.level;
    best = { level: Math.max(best.level, r.level), score: Math.max(best.score, r.score) }; save("fireWaterBest", JSON.stringify(best));
    return isNew;
  }
  function gameOver() {
    const isNew = updateBest() && G.run.score > 0;
    G.state = "over"; G.next = null; G.wait = 0;
    hud.hideBanner(); hud.playing(false); hud.hint(null); hud.arrow(); hud.lastTree(null); hud.over(G.run, best, isNew); hud.screen("over"); audio.play("over");
  }

  // Ereignis der Regeln -> Bild, Effekt, Ton, Anzeige
  function onEvent(ev) {
    const w = G.world;
    sprites.onEvent(ev); fx.onEvent(ev, w);
    if (G.demo) { if (ev.type === "won" || ev.type === "lost") later(1.6, () => newWorld(2 + (Math.random() * 3 | 0), true)); return; }
    switch (ev.type) {
      case "sprout": audio.play("sprout"); break;
      case "rainStart": audio.play("rain"); break;
      case "landed": case "crouch": case "lunge": case "dart": case "dodge": case "angry": case "lastTree": case "finale": audio.play(ev.type); break;
    }
    if (ev.type === "drunk") {
      audio.play("drunk", ev); G.freeze = 0.07; hud.pop(ev.x, ev.y + 34, "+" + ev.points + (ev.combo > 1 ? "  ×" + ev.combo : ""));
      if (G.hint) { G.hint = false; hintSeen = true; save("fireWaterHint", "1"); hud.hint(null); hud.arrow(); }
    } else if (ev.type === "burned") { audio.play("burned"); G.freeze = 0.06; if (ev.points) hud.pop(ev.x, ev.y + 44, "+" + ev.points, "small"); }
    else if (ev.type === "finale") hud.banner("finale", "Die Wiese gehört dir!", "Verbrenne die Bäume!", { seconds: 2 });
    else if (ev.type === "doused") { audio.play("doused"); hud.flash(0.45); stage.setGray(true); }
    else if (ev.type === "won") levelWon(ev.result);
    else if (ev.type === "lost") levelLost(ev.reason);
  }

  // Einfacher Selbstläufer für das Bild hinter dem Titel: weicht dem Wasser aus, verbrennt im Finale die Bäume
  function pilot(w) {
    const f = w.fire, waters = w.waters.filter(sim.landed), px = sim.px(f), py = sim.py(f), b = w.bb.fire;
    if (w.phase === "finale") { const n = sim.nearest(f, w.trees, t => t.state !== "seed"); if (!n) return STILL; const dx = sim.px(n.e) - px, dy = sim.py(n.e) - py, d = Math.hypot(dx, dy) || 1; return { mx: dx / d, my: dy / d }; }
    if (!waters.length) return STILL;
    let bestA = STILL, bs = -Infinity;
    for (const a of DIRS) {
      const x = sim.clamp(px + a.mx * 70, b.minX, b.maxX), y = sim.clamp(py + a.my * 70, b.minY, b.maxY);
      let s = 300;
      for (const o of waters) s = Math.min(s, Math.hypot(x - sim.px(o) - o.vx * 0.3, y - sim.py(o) - o.vy * 0.3));
      for (const t of w.trees) if (Math.hypot(x - sim.px(t), y - sim.py(t)) < 85) s -= 200;
      s += Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y, 120) * 0.3 + (a === G.lastPilot ? 6 : 0);
      if (s > bs) { bs = s; bestA = a; }
    }
    return G.lastPilot = bestA;
  }

  // ---------- ein Bild ----------
  function frame(real) {
    G.time += real;
    if (G.state !== "pause") {
      let dt = real * G.timeScale;
      if (G.freeze > 0) { G.freeze -= real; dt = 0; }                                // kurzer Stillstand bei einem Treffer
      if ((G.state === "play" || G.state === "title") && !over(G.world)) {
        const w = G.world, input = G.demo || G.pilot ? pilot(w) : { mx: (held("right") ? 1 : 0) - (held("left") ? 1 : 0), my: (held("up") ? 1 : 0) - (held("down") ? 1 : 0) };
        G.acc += dt;
        for (let n = 0; G.acc >= sim.DT && n < 12 && !over(w); n++) { sim.step(w, input); G.acc -= sim.DT; }
        if (G.acc > sim.DT) G.acc = 0;
        w.events.splice(0).forEach(onEvent);
      }
      if (G.next) { G.since += real; if ((G.wait -= real) <= 0) proceed(); }
      const w = G.world, playing = G.state === "play" && !G.demo;
      sprites.sync(w, G.time, real * (G.freeze > 0 ? 0.15 : G.timeScale));
      fx.frame(dt, w, G.state !== "over");
      // Hinweis in Level 1 und Schild über dem letzten Baum
      if (playing && G.hint) {
        const o = w.waters.find(sim.landed), n = o && sim.nearest(o, w.trees, t => t.state !== "seed");
        hud.hint("Lock das Wasser zu einem Baum!", "Lauf so an einem Baum vorbei, dass dir das Wasser in seine Nähe folgt.");
        if (n) hud.arrow({ x: o.x, y: o.y }, { x: sim.px(n.e), y: sim.py(n.e) }); else hud.arrow();
      }
      hud.lastTree(playing && w.lastTree !== null ? sprites.pos(w.lastTree) : null);
      const f = w.fire, alive = w.phase !== "lost";
      stage.frame(real, G.time, { x: f.x + FW.GEOM.fire.bx, y: f.y + FW.GEOM.fire.by - 20 }, alive ? 1 : 0);
      audio.frame(real, Math.hypot(f.vx, f.vy) / CFG.fire.speed * (over(w) ? 0 : 1), alive && !G.demo, stage.mood.name === "Nacht");
    } else stage.frame(0, G.time, null, 0);
    hud.frame(real, G.run, G.demo ? null : G.world);

    // zu langsam? Dann einmalig von doppelter auf einfache Auflösung wechseln
    G.fpsT += real; G.fpsN++;
    if (G.fpsT >= 3) { if (!stage.lowRes && G.time > 6 && G.fpsN / G.fpsT < 52) { stage.applyResolution(true); stage.engine.resize(); stage.fitCamera(); } G.fpsT = 0; G.fpsN = 0; }
  }

  (async function main() {
    const canvas = $("c");
    stage.init(canvas);
    await stage.loadKinds();
    fx.init(); hud.init();
    stage.fitCamera(); window.addEventListener("resize", () => { stage.applyResolution(stage.lowRes); stage.engine.resize(); stage.fitCamera(); });
    showTitle();
    stage.scene.onBeforeRenderObservable.add(() => frame(Math.min(stage.engine.getDeltaTime() / 1000, 0.05)));
    stage.engine.runRenderLoop(() => stage.scene.render());
    canvas.focus();
    // Für Tests in der Browser-Konsole
    window.__game = { G, FW, keys, command, startRun, showTitle, level(n) { G.run.level = n; G.run.attempt = 1; startLevel(); },
                      get wins() { return wins; }, get best() { return best; } };
  })();
})(globalThis.FW = globalThis.FW || {});

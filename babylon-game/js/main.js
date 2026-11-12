// Spielschleife, Tastatur und Anzeige.
(function (FW) {
  const sim = FW.sim, CFG = FW.CFG, stage = FW.stage, sprites = FW.sprites;
  const $ = id => document.getElementById(id);

  // ---------- Eingabe ----------
  const keys = new Set();
  const MOVE = { up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"] };
  const held = n => MOVE[n].some(k => keys.has(k));
  window.addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) { keys.clear(); return; }
    if (e.code === "KeyF" && !e.repeat) { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); return; }
    if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener("keyup", e => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  // ---------- Spielzustand ----------
  let wins = 0;
  try { wins = parseInt(localStorage.getItem("fireWaterWins") || "0", 10) || 0; } catch (_) {}
  const G = { world: null, timer: 0, time: 0, acc: 0 };

  function showMsg(kind, title, sub) { const m = $("msg"); m.className = "ui show " + kind; $("msgTitle").textContent = title; $("msgSub").textContent = sub; }
  function hideMsg() { $("msg").className = "ui"; }
  function updateHud() { $("wins").textContent = wins; $("trees").textContent = G.world.trees.length; $("waters").textContent = G.world.waters.length; }

  function resetGame() {
    sprites.clear(); hideMsg();
    G.world = sim.create({ seed: (Math.random() * 0x7fffffff) | 0, wins });
    updateHud();
  }
  function onEvent(ev) {
    if (ev.type === "won") {
      wins++; try { localStorage.setItem("fireWaterWins", String(wins)); } catch (_) {}
      G.timer = CFG.endDelay;
      showMsg("win", "Du hast gewonnen! 🔥", "Du bist als Einziger übrig. Siege: " + wins + " · nächste Runde startet gleich …");
    } else if (ev.type === "lost") {
      G.timer = CFG.endDelay;
      if (ev.reason === "doused") showMsg("lose", "Das Wasser hat dich erwischt! 💧", "Das Spiel startet neu. Siege: " + wins);
      else showMsg("lose", "Keine Bäume mehr! 🌳", "Nur ein Baum kann Wasser töten. Das Spiel startet neu. Siege: " + wins);
    }
  }

  function frame(dt) {
    G.time += dt;
    const w = G.world;
    if (w.phase === "main") {
      const input = { mx: (held("right") ? 1 : 0) - (held("left") ? 1 : 0), my: (held("up") ? 1 : 0) - (held("down") ? 1 : 0) };
      G.acc += dt;
      while (G.acc >= sim.DT && w.phase === "main") { sim.step(w, input); G.acc -= sim.DT; }
      w.events.splice(0).forEach(onEvent);
      updateHud();
    } else { G.timer -= dt; if (G.timer <= 0) resetGame(); }
    sprites.sync(G.world, G.time, dt);
  }

  (async function main() {
    const canvas = $("c");
    stage.init(canvas);
    await stage.loadKinds();
    stage.fitCamera(); window.addEventListener("resize", () => { stage.applyResolution(); stage.engine.resize(); stage.fitCamera(); });
    resetGame();
    stage.scene.onBeforeRenderObservable.add(() => frame(Math.min(stage.engine.getDeltaTime() / 1000, 0.05)));
    stage.engine.runRenderLoop(() => stage.scene.render());
    canvas.focus();
    window.__game = { G, CFG, FW, keys, resetGame, get wins() { return wins; } };
  })();
})(globalThis.FW = globalThis.FW || {});

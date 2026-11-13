// Anzeige über dem Spiel: obere Leiste, Banner, Hinweise, Titel-, Pause- und Ende-Bildschirm.
(function (FW) {
  const hud = FW.hud = {}, stage = FW.stage, CFG = FW.CFG;
  const $ = id => document.getElementById(id);
  const fmt = hud.fmt = n => Math.round(n).toLocaleString("de-DE");
  let icons = {}, shown = 0, bannerT = 0, livesKey = "";

  hud.init = function () {
    icons = FW.ART;
    document.querySelectorAll("img[data-icon]").forEach(img => { img.src = icons[img.dataset.icon]; });
  };

  hud.screen = function (name) { for (const id of ["title", "over", "pause"]) $(id).classList.toggle("on", id === name); };
  hud.playing = function (on) { for (const id of ["hud", "keys", "pauseBtn"]) $(id).classList.toggle("off", !on); };
  hud.muted = function (m) { $("muted").textContent = m ? "(aus)" : ""; $("soundBtn").textContent = m ? "Ton: aus" : "Ton: an"; };

  // Einmal pro Bild
  hud.frame = function (dt, run, world) {
    if (bannerT > 0 && (bannerT -= dt) <= 0) hud.hideBanner();
    if (!world) return;
    const target = run.score + (world.phase === "won" ? 0 : world.score.points);   // nach dem Sieg stecken die Punkte schon in run.score
    shown += (target - shown) * Math.min(1, dt * 10); if (Math.abs(target - shown) < 1) shown = target;
    $("level").textContent = run.level; $("score").textContent = fmt(shown);
    $("trees").textContent = world.trees.length; $("waters").textContent = world.waters.length;
    const key = run.lives + "/" + Math.max(run.lives, CFG.lives);
    if (key !== livesKey) {
      livesKey = key;
      $("lives").innerHTML = Array.from({ length: Math.max(run.lives, CFG.lives) }, (_, i) => `<img src="${icons.fire}" alt="" class="${i < run.lives ? "" : "gone"}">`).join("");
    }
    const sc = world.score, combo = sc.combo >= 2 && world.playTime - sc.lastDrink <= CFG.score.comboWindow;
    $("combo").textContent = combo ? "×" + sc.combo : $("combo").textContent; $("combo").classList.toggle("on", combo);
    $("treesPill").classList.toggle("warn", world.lastTree !== null && world.phase !== "won" && world.phase !== "lost");
  };
  hud.resetScore = v => { shown = v; };

  // Großer Text in der Mitte. seconds = 0: bleibt, bis hideBanner aufgerufen wird.
  hud.banner = function (kind, title, sub, o = {}) {
    $("banner").className = "ui on " + kind; $("bannerTitle").textContent = title; $("bannerSub").textContent = sub || "";
    $("bannerStars").innerHTML = o.stars ? "★".repeat(o.stars) + "<i>" + "★".repeat(3 - o.stars) + "</i>" : "";
    $("bannerNote").textContent = o.note || ""; bannerT = o.seconds || 0;
  };
  hud.hideBanner = function () { $("banner").classList.remove("on"); bannerT = 0; };

  // Kleiner Text, der an einer Stelle des Feldes aufsteigt und verblasst
  hud.pop = function (x, y, text, cls) {
    const p = stage.toScreen(x, y), el = document.createElement("div");
    el.className = "pop " + (cls || ""); el.textContent = text; el.style.left = p.x + "px"; el.style.top = p.y + "px";
    document.body.appendChild(el); setTimeout(() => el.remove(), 1000);
  };

  hud.hint = function (title, sub) { $("hint").classList.toggle("on", !!title); if (title) { $("hintTitle").textContent = title; $("hintSub").textContent = sub || ""; } };
  // Gestrichelter Pfeil von a nach b (Feld-Koordinaten); ohne Argumente ausblenden
  hud.arrow = function (a, b) {
    $("arrow").classList.toggle("on", !!a); if (!a) return;
    const p = stage.toScreen(a.x, a.y), q = stage.toScreen(b.x, b.y), dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const sx = p.x + ux * 34, sy = p.y + uy * 34, ex = q.x - ux * 52, ey = q.y - uy * 52;
    $("arrowLine").setAttribute("d", `M${sx} ${sy} L${ex} ${ey}`);
    $("arrowHead").setAttribute("points", `${ex + ux * 16},${ey + uy * 16} ${ex - uy * 10},${ey + ux * 10} ${ex + uy * 10},${ey - ux * 10}`);
  };
  // Schild über dem letzten Baum
  hud.lastTree = function (pos) {
    const el = $("lastTree"); el.style.display = pos ? "block" : "none"; if (!pos) return;
    const p = stage.toScreen(pos.x, pos.top + 6); el.style.left = p.x + "px"; el.style.top = p.y + "px";
  };
  hud.flash = function (a) { const el = $("flash"); el.style.transition = "none"; el.style.opacity = a; requestAnimationFrame(() => { el.style.transition = "opacity .45s"; el.style.opacity = 0; }); };

  const bestLine = b => b.level ? `Bestleistung: Level ${b.level} · ${fmt(b.score)} Punkte` : "";
  hud.title = function (best, wins) { $("titleBest").textContent = [bestLine(best), wins ? `Siege: ${fmt(wins)}` : ""].filter(Boolean).join(" · "); };
  hud.over = function (run, best, isNew) {
    $("overResult").textContent = `Level ${run.level} erreicht · ${fmt(run.score)} Punkte`;
    $("overNew").textContent = isNew ? "Neue Bestleistung!" : ""; $("overBest").textContent = isNew ? "" : bestLine(best);
  };
})(globalThis.FW = globalThis.FW || {});

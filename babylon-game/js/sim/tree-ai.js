// Baum: ängstlicher Wächter mit tödlichem Sprung. Er jagt nicht selbst: Wasser muss in seine Sprungweite kommen.
// Zustände: seed (noch unsichtbar) -> sprout (wächst) -> roam (läuft) -> crouch (duckt sich) -> lunge (springt) -> rest (erholt sich) -> roam
(function (FW) {
  const sim = FW.sim, st = FW.steer, C = FW.CFG.tree;
  const A = { x: 0, y: 0, cut: 0 }, OUT = { x: 0, y: 0, s: 0 }, AIM = { x: 0, y: 0 };
  const G = FW.GEOM.tree, OX = G.fx - G.bx, OY = G.fy - G.by, FOOT = G.foot;      // vom Trefferkreis zum Fußkreis

  function setState(t, s) { t.state = s; t.t = 0; }

  // Neue Laufrichtung wählen
  function plan(w, t) {
    const fire = w.fire, px = sim.px(t), py = sim.py(t), b = w.bb.tree;
    const fx = sim.px(fire) + fire.vx * 0.15, fy = sim.py(fire) + fire.vy * 0.15, fd0 = Math.hypot(px - fx, py - fy);
    const panic = w.phase === "finale";
    const score = (dx, dy) => {
      st.ahead(px, py, dx, dy, C.look, b, A);
      const fd = Math.hypot(A.x - fx, A.y - fy);
      let s = 0;
      if (panic) s += (fd - fd0) / C.look + 0.4 * Math.min(1, st.room(A.x, A.y, b) / 150);   // weg vom Feuer, hin zum freien Platz
      else {
        s += 0.3 * st.ramp(fd0, 120, 260) * (fd - fd0) / C.look + 0.15 * Math.min(1, st.room(A.x, A.y, b) / 120);   // gemächlich Abstand halten
        s -= 2.2 * st.ramp(fd, C.fearFull, C.fearR);                                         // Angst am Ort, an dem ich landen würde
      }
      s -= 0.8 * A.cut;                                                                      // nicht gegen den Rand laufen
      if (w.stones.length) s -= 1.1 * Math.max(st.blocked(w.stones, px + dx * C.look * 0.5 + OX, py + dy * C.look * 0.5 + OY, FOOT, 16), st.blocked(w.stones, A.x + OX, A.y + OY, FOOT, 16));   // nicht gegen Steine
      for (const o of w.trees) if (o !== t && o.state !== "seed") {
        const od = Math.hypot(A.x - sim.px(o), A.y - sim.py(o)); if (od < C.sep) s -= 0.5 * (1 - od / C.sep);
      }
      return s + 0.06 * (dx * t.dx + dy * t.dy);                                             // bei Gleichstand Richtung halten
    };
    st.best(score, [px - fx, py - fy], OUT);
    t.dx = OUT.x; t.dy = OUT.y;
    // Wie schnell? In Panik rennen, sonst nur weichen, wenn das Feuer näher kommt.
    t.pace = panic ? Math.max(0.4, st.ramp(fd0, 220, 420)) : st.ramp(fd0, C.fearFull, 200);
  }

  // Im Finale: seitlich wegspringen, wenn das Feuer nah ist und näher kommt
  function dart(w, t) {
    const fire = w.fire, px = sim.px(t), py = sim.py(t), b = w.bb.tree;
    const ax = px - sim.px(fire), ay = py - sim.py(fire), d = Math.hypot(ax, ay) || 1;
    if (d > C.dartNear) return;
    if ((fire.vx * ax + fire.vy * ay) / d < 60) return;         // das Feuer kommt nicht auf mich zu
    let best = 0, bs = -Infinity;
    for (const side of [1, -1]) {
      const dx = -ay / d * side * 0.85 + ax / d * 0.5, dy = ax / d * side * 0.85 + ay / d * 0.5;
      st.ahead(px, py, dx, dy, 90, b, A);
      const s = st.room(A.x, A.y, b) / 150 - A.cut * 2 + sim.rand(w) * 0.3;
      if (s > bs) { bs = s; best = side; }
    }
    const dx = -ay / d * best * 0.85 + ax / d * 0.5, dy = ax / d * best * 0.85 + ay / d * 0.5, l = Math.hypot(dx, dy);
    t.dx = dx / l; t.dy = dy / l; t.dartT = C.dartTime; t.dartCd = C.dartCooldown; t.plan = C.dartTime; t.pace = 1;
    sim.emit(w, { type: "dart", id: t.id });
  }

  function update(w, t, dt) {
    const fire = w.fire;
    t.t += dt;
    t.fear = st.ramp(sim.dist(t, fire), C.fearFull, C.fearR);
    if (t.dartCd > 0) t.dartCd -= dt;
    if (t.dartT > 0) t.dartT -= dt;

    if (t.state === "seed") { if (w.time >= t.delay) { setState(t, "sprout"); sim.emit(w, { type: "sprout", id: t.id }); } return; }
    if (t.state === "sprout") { if (t.t >= C.sprout) setState(t, "roam"); return; }
    if (t.state === "crouch") {
      sim.approach(t, 0, 0, 2400, dt); sim.move(w, t, dt);
      if (t.t >= C.crouch) {
        const o = w.waters.find(o => o.id === t.lungeAt);
        if (!o) { setState(t, "roam"); return; }
        const px = sim.px(t), py = sim.py(t);
        st.lead(px, py, sim.px(o), sim.py(o), o.vx, o.vy, C.lungeSpeed, C.lungeTime, AIM);
        const dx = AIM.x - px, dy = AIM.y - py, d = Math.hypot(dx, dy) || 1;
        t.lx = dx / d; t.ly = dy / d; setState(t, "lunge");
        sim.emit(w, { type: "lunge", id: t.id, dx: t.lx, dy: t.ly });
      }
      return;
    }
    if (t.state === "lunge") {                                   // im Sprung zählt nur das Ziel, auch das Feuer nicht
      t.vx = t.lx * C.lungeSpeed; t.vy = t.ly * C.lungeSpeed; sim.move(w, t, dt);
      if (t.t >= C.lungeTime) { setState(t, "rest"); t.plan = 0; }
      return;
    }
    if (t.state === "rest" && t.t >= C.rest) setState(t, "roam");

    // Wasser in Sprungweite? Dann ducken, außer das Feuer ist zu nah.
    if (t.state === "roam" && t.fear < 1) {
      const n = sim.nearest(t, w.waters, sim.landed);
      if (n && n.d <= C.lungeTrigger) {
        t.lungeAt = n.e.id; setState(t, "crouch");
        sim.emit(w, { type: "crouch", id: t.id, target: n.e.id });
        FW.waterAI.onCrouch(w, t, n.e);
        return;
      }
    }
    if (w.phase === "finale" && t.dartCd <= 0) dart(w, t);
    if ((t.plan -= dt) <= 0) { plan(w, t); t.plan = C.replan; }
    let speed = C.speed * t.pace;
    if (t.state === "rest" && t.t < 0.5) speed *= 0.5;
    if (t.dartT > 0) speed = C.speed * C.dartSpeed;
    sim.approach(t, t.dx * speed, t.dy * speed, C.accel, dt); sim.move(w, t, dt);
  }

  FW.treeAI = { update };
})(globalThis.FW = globalThis.FW || {});

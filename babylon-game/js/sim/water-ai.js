// Wasser: schneller, rutschiger Rudeljäger. Jagt das Feuer, hält Abstand zu Bäumen und wird mit der Zeit wütend.
// Zustände: wait (noch nicht da) -> fall (fällt vom Himmel, harmlos) -> hunt
(function (FW) {
  const sim = FW.sim, st = FW.steer, C = FW.CFG.water, FIRE = FW.CFG.fire;
  const A = { x: 0, y: 0, cut: 0 }, OUT = { x: 0, y: 0, s: 0 };
  const SLOTS = [2.094, -2.094, 3.142, 1.047, -1.047, 2.618, -2.618, 0.524];   // Plätze rund ums Feuer, vom Jäger aus gezählt

  // Rollen im Rudel: der Nächste jagt, der Zweite schneidet den Weg ab, die Übrigen kreisen ein
  function roles(w) {
    const pack = w.waters.filter(sim.landed).map(o => ({ o, d: sim.dist(o, w.fire) })).sort((a, b) => a.d - b.d);
    if (!pack.length) return;
    const lead = pack[0].o, base = Math.atan2(sim.py(lead) - sim.py(w.fire), sim.px(lead) - sim.px(w.fire));
    pack.forEach(({ o }, i) => {
      o.role = i === 0 ? "chase" : i === 1 && w.def.roles >= 2 ? "cut" : i >= 2 && w.def.roles >= 3 ? "flank" : "chase";
      if (o.role === "flank") o.slotA = base + SLOTS[(i - 2) % SLOTS.length];
    });
  }

  const speedOf = (w, o) => FIRE.speed * w.def.speed * (1 + C.angerSpeed * o.anger);

  function plan(w, o) {
    const fire = w.fire, px = sim.px(o), py = sim.py(o), b = w.bb.water;
    const fx = sim.px(fire), fy = sim.py(fire), fd = Math.hypot(px - fx, py - fy);
    let ax = fx, ay = fy;                                        // Zielpunkt je nach Rolle
    if (o.role === "cut" && fd > 110) { ax = fx + fire.vx * 0.7; ay = fy + fire.vy * 0.7; }
    else if (o.role === "flank" && fd > 100) {
      const r = sim.clamp(fd * 0.75, 70, 190), sx = fx + Math.cos(o.slotA) * r, sy = fy + Math.sin(o.slotA) * r;
      if (Math.hypot(px - sx, py - sy) > 50) { ax = sx; ay = sy; }
    } else { const t = Math.min(0.35, fd / speedOf(w, o) * 0.5); ax = fx + fire.vx * t; ay = fy + fire.vy * t; }
    ax = sim.clamp(ax, b.minX, b.maxX); ay = sim.clamp(ay, b.minY, b.maxY);
    const d0 = Math.hypot(px - ax, py - ay);
    // Vorsicht vor Bäumen: sinkt nah am Feuer und mit der Wut
    const lust = C.lustMin + (1 - C.lustMin) * sim.clamp((fd - w.def.lustNear) / (w.def.lustFar - w.def.lustNear), 0, 1);
    const caution = lust * Math.max(0, 1 - C.angerCaution * o.anger);
    const score = (dx, dy) => {
      st.ahead(px, py, dx, dy, C.look, b, A);
      let s = (d0 - Math.hypot(A.x - ax, A.y - ay)) / C.look;
      if (caution > 0) {
        let danger = 0;
        for (const t of w.trees) {
          if (t.state === "seed") continue;
          let k = Math.max(0, (C.cautionR - Math.hypot(A.x - sim.px(t) - t.vx * 0.25, A.y - sim.py(t) - t.vy * 0.25)) / (C.cautionR - C.cautionFull));   // näher ist immer schlimmer
          if (t.state === "crouch" || t.state === "lunge") k *= 1.5; else if (t.state === "rest") k *= 0.6;
          if (k > danger) danger = k;
        }
        s -= 2.5 * caution * danger;
      }
      s -= 0.6 * A.cut;
      for (const p of w.waters) if (p !== o && p.state === "hunt") {
        const od = Math.hypot(A.x - sim.px(p), A.y - sim.py(p)); if (od < C.sep) s -= 0.6 * (1 - od / C.sep);
      }
      return s + 0.06 * (dx * o.dx + dy * o.dy);
    };
    st.best(score, [ax - px, ay - py], OUT);
    o.dx = OUT.x; o.dy = OUT.y;
  }

  // Ein Baum duckt sich zum Sprung: mit etwas Glück weicht das Wasser seitlich aus
  function onCrouch(w, tree, o) {
    if (!(sim.rand(w) < w.def.dodge)) return;
    const px = sim.px(o), py = sim.py(o), ax = px - sim.px(tree), ay = py - sim.py(tree), d = Math.hypot(ax, ay) || 1;
    let best = 1, bs = -Infinity;
    for (const side of [1, -1]) {
      st.ahead(px, py, -ay / d * side, ax / d * side, 90, w.bb.water, A);
      const s = -A.cut * 2 + sim.rand(w) * 0.5; if (s > bs) { bs = s; best = side; }
    }
    o.dx = -ay / d * best; o.dy = ax / d * best; o.dodgeT = C.dodgeTime; o.plan = C.dodgeTime;
    sim.emit(w, { type: "dodge", id: o.id });
  }

  function update(w, o, dt) {
    if (o.state !== "hunt") return;
    o.t += dt;
    const lvl = Math.min(C.angerMax, Math.floor((w.time - o.born) * w.def.anger / C.angerStep));
    if (lvl > o.anger) { o.anger = lvl; if (lvl === 4) sim.emit(w, { type: "angry", id: o.id }); }
    let speed = speedOf(w, o), accel = C.accel;
    if (o.dodgeT > 0) { o.dodgeT -= dt; speed *= C.dodgeSpeed; accel *= 3; }
    if ((o.plan -= dt) <= 0) { plan(w, o); o.plan = w.def.replan; }
    sim.approach(o, o.dx * speed, o.dy * speed, accel, dt); sim.move(w, o, dt);
  }

  FW.waterAI = { roles, update, onCrouch };
})(globalThis.FW = globalThis.FW || {});

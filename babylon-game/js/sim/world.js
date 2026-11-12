// Die Spielregeln. Kein Babylon, kein Zugriff auf die Seite: läuft auch in Node.
// Eine Welt besteht nur aus Daten (keine Funktionen), damit man sie kopieren und vorausrechnen kann.
(function (FW) {
  const sim = FW.sim = FW.sim || {};
  const CFG = FW.CFG, GEOM = FW.GEOM;
  sim.DT = 1 / 120;                                    // fester Zeitschritt

  // Zufall mit Startwert: gleicher Startwert = gleiche Runde
  sim.rand = w => { w.rs = w.rs + 0x6D2B79F5 | 0; let t = Math.imul(w.rs ^ w.rs >>> 15, 1 | w.rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const clamp = sim.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // x, y einer Figur ist ihr Drehpunkt (wie in Scratch). px, py ist die Mitte ihres Trefferkreises.
  sim.px = e => e.x + GEOM[e.kind].bx;
  sim.py = e => e.y + GEOM[e.kind].by;
  sim.dist = (a, b) => Math.hypot(sim.px(a) - sim.px(b), sim.py(a) - sim.py(b));
  sim.touching = (a, b) => sim.dist(a, b) < GEOM[a.kind].body.r + GEOM[b.kind].body.r;
  sim.nearest = (e, list, ok) => { let best = null, bd = Infinity; for (const o of list) { if (ok && !ok(o)) continue; const d = sim.dist(e, o); if (d < bd) { bd = d; best = o; } } return best && { e: best, d: bd }; };
  sim.landed = o => o.state === "hunt";
  sim.emit = (w, ev) => { w.events.push(ev); };

  // Geschwindigkeit mit begrenzter Beschleunigung an die Wunsch-Geschwindigkeit angleichen
  sim.approach = function (e, tx, ty, accel, dt) {
    const dx = tx - e.vx, dy = ty - e.vy, d = Math.hypot(dx, dy), m = accel * dt;
    if (d <= m) { e.vx = tx; e.vy = ty; } else { e.vx += dx / d * m; e.vy += dy / d * m; }
  };
  // Bewegen und im Feld halten
  sim.move = function (w, e, dt) {
    const b = w.bounds[e.kind];
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < b.minX) { e.x = b.minX; if (e.vx < 0) e.vx = 0; } else if (e.x > b.maxX) { e.x = b.maxX; if (e.vx > 0) e.vx = 0; }
    if (e.y < b.minY) { e.y = b.minY; if (e.vy < 0) e.vy = 0; } else if (e.y > b.maxY) { e.y = b.maxY; if (e.vy > 0) e.vy = 0; }
  };

  // Zufälliger Platz für eine Figur. clear(x, y) gibt an, wie gut der Platz ist (>= 1 ist gut genug).
  function findSpot(w, kind, clear) {
    const b = w.bounds[kind]; let best = null, bc = -Infinity;
    for (let i = 0; i < 300; i++) {
      const x = b.minX + sim.rand(w) * (b.maxX - b.minX), y = b.minY + sim.rand(w) * (b.maxY - b.minY), c = clear(x + GEOM[kind].bx, y + GEOM[kind].by);
      if (c >= 1) return { x, y };
      if (c > bc) { bc = c; best = { x, y }; }
    }
    return best;
  }

  sim.newTree = (w, x, y, delay) => ({ id: w.nextId++, kind: "tree", x, y, vx: 0, vy: 0, state: "seed", t: 0, delay,
    plan: 0, pace: 0, dx: 0, dy: 0, fear: 0, grow: 0, dartT: 0, dartCd: 0, lungeAt: null, lx: 0, ly: 0 });
  sim.newWater = (w, startAt) => ({ id: w.nextId++, kind: "water", x: 0, y: 0, vx: 0, vy: 0, state: "wait", t: 0, startAt,
    role: "chase", slotA: 0, plan: 0, dx: 0, dy: 0, anger: 0, born: 0, dodgeT: 0 });

  sim.create = function ({ level = 1, seed = 1, flawless = true } = {}) {
    const def = FW.levelDef(level);
    const w = { W: CFG.fieldW, H: CFG.fieldH, rs: seed | 0, nextId: 1, level: def.level, def, flawless,
                time: 0, playTime: 0, phase: "rain", reason: null, fire: null, trees: [], waters: [], events: [],
                roleT: 0, lastTree: null, result: null, bounds: {}, bb: {},
                score: { points: 0, combo: 0, lastDrink: -99, maxCombo: 0, drunk: 0, burned: 0 } };
    for (const [kind, d] of Object.entries(GEOM)) {
      const x = d.ext, b = { minX: -w.W / 2 + x.l, maxX: w.W / 2 - x.r, minY: -w.H / 2 + x.b, maxY: w.H / 2 - x.t };
      w.bounds[kind] = b;                                                                   // Grenzen für den Drehpunkt
      w.bb[kind] = { minX: b.minX + d.bx, maxX: b.maxX + d.bx, minY: b.minY + d.by, maxY: b.maxY + d.by };   // Grenzen für die Kreismitte
    }
    w.fire = { id: w.nextId++, kind: "fire", x: 0, y: 0, vx: 0, vy: 0 };
    const T = CFG.tree, fx = sim.px(w.fire), fy = sim.py(w.fire);
    for (let i = 0; i < def.trees; i++) {
      const p = findSpot(w, "tree", (x, y) => {
        let c = Math.hypot(x - fx, y - fy) / T.spawnFire;
        for (const t of w.trees) c = Math.min(c, Math.hypot(x - sim.px(t), y - sim.py(t)) / T.spawnApart);
        return c;
      });
      w.trees.push(sim.newTree(w, p.x, p.y, 0.15 + i * 0.12));
    }
    const R = CFG.water;
    for (let i = 0; i < def.waters; i++) w.waters.push(sim.newWater(w, R.rainStart + i * R.rainGap));
    return w;
  };

  // Regen: Tropfen suchen sich einen Landeplatz, fallen und werden erst bei der Landung gefährlich
  function rain(w, dt) {
    const R = CFG.water, fire = w.fire;
    for (const o of w.waters) {
      if (o.state === "wait" && w.time >= o.startAt) {
        const fx = sim.px(fire), fy = sim.py(fire);
        const p = findSpot(w, "water", (x, y) => {
          let c = Math.hypot(x - fx, y - fy) / R.landFire;
          for (const t of w.trees) c = Math.min(c, Math.hypot(x - sim.px(t), y - sim.py(t)) / R.landTree);
          for (const q of w.waters) if (q !== o && q.state !== "wait") c = Math.min(c, Math.hypot(x - sim.px(q), y - sim.py(q)) / R.landApart);
          return c;
        });
        o.x = p.x; o.y = p.y; o.state = "fall"; o.t = 0;
        sim.emit(w, { type: "rainStart", id: o.id, x: o.x, y: o.y });
      } else if (o.state === "fall") {
        o.t += dt;
        if (o.t >= R.fall) {
          o.state = "hunt"; o.t = 0; o.born = w.time; o.plan = R.wake;
          sim.emit(w, { type: "landed", id: o.id, x: o.x, y: o.y });
          if (w.phase === "rain") w.phase = "main";
        }
      }
    }
  }

  // Ein Zeitschritt. input = { mx, my } mit Werten von -1 bis 1.
  sim.step = function (w, input) {
    if (w.phase === "won" || w.phase === "lost") return;
    const dt = sim.DT, fire = w.fire, S = CFG.score;
    w.time += dt; if (w.phase !== "rain") w.playTime += dt;

    let mx = input.mx || 0, my = input.my || 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    sim.approach(fire, mx * CFG.fire.speed, my * CFG.fire.speed, CFG.fire.accel, dt); sim.move(w, fire, dt);

    rain(w, dt);
    if ((w.roleT -= dt) <= 0) { FW.waterAI.roles(w); w.roleT = CFG.water.roleEvery; }
    for (const t of w.trees) FW.treeAI.update(w, t, dt);
    for (const o of w.waters) FW.waterAI.update(w, o, dt);

    // Baum trinkt Wasser
    w.waters = w.waters.filter(o => {
      if (o.state !== "hunt") return true;
      const t = w.trees.find(t => t.state !== "seed" && sim.touching(t, o)); if (!t) return true;
      const sc = w.score;
      sc.combo = w.playTime - sc.lastDrink <= S.comboWindow ? Math.min(S.comboMax, sc.combo + 1) : 1;
      sc.lastDrink = w.playTime; sc.maxCombo = Math.max(sc.maxCombo, sc.combo); sc.drunk++;
      const points = S.drunk * sc.combo; sc.points += points; t.grow++;
      sim.emit(w, { type: "drunk", id: o.id, by: t.id, x: o.x, y: o.y, combo: sc.combo, points });
      return false;
    });
    // Feuer verbrennt Baum
    w.trees = w.trees.filter(t => {
      if (t.state === "seed" || !sim.touching(fire, t)) return true;
      const finale = w.phase === "finale", points = finale ? S.finaleTree : 0;
      w.score.points += points; w.score.burned++;
      sim.emit(w, { type: "burned", id: t.id, x: t.x, y: t.y, finale, points });
      return false;
    });
    // Wasser löscht Feuer
    const douser = w.waters.find(o => o.state === "hunt" && sim.touching(fire, o));
    if (douser) { sim.emit(w, { type: "doused", id: douser.id, x: fire.x, y: fire.y }); return end(w, "lost", "doused"); }

    if (w.trees.length === 0) return w.waters.length ? end(w, "lost", "noTrees") : end(w, "won", null);
    if (w.trees.length === 1 && w.waters.length) {
      if (w.lastTree !== w.trees[0].id) { w.lastTree = w.trees[0].id; sim.emit(w, { type: "lastTree", id: w.lastTree }); }
    } else if (w.lastTree !== null) { w.lastTree = null; sim.emit(w, { type: "lastTreeClear" }); }
    if (w.phase === "main" && w.waters.length === 0) { w.phase = "finale"; sim.emit(w, { type: "finale" }); }
  };

  function end(w, phase, reason) {
    w.phase = phase; w.reason = reason;
    if (phase === "won") {
      const S = CFG.score, par = w.def.par, time = w.playTime, fast = time <= par;
      const timeBonus = Math.round(Math.max(0, par - time)) * S.perSecond, flawless = w.flawless ? S.flawless : 0;
      w.result = { time, par, timeBonus, flawless, points: w.score.points, maxCombo: w.score.maxCombo,
                   total: w.score.points + timeBonus + flawless, stars: 1 + (fast ? 1 : 0) + (fast && w.flawless ? 1 : 0) };
    }
    sim.emit(w, { type: phase, reason, time: w.playTime, result: w.result });
  }
})(globalThis.FW = globalThis.FW || {});

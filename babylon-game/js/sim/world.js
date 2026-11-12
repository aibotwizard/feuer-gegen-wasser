// Die Spielregeln. Kein Babylon, kein Zugriff auf die Seite: läuft auch in Node.
(function (FW) {
  const sim = FW.sim = FW.sim || {};
  const CFG = FW.CFG, GEOM = FW.GEOM;
  sim.DT = 1 / 120;                                    // fester Zeitschritt

  // Zufall mit Startwert: gleicher Startwert = gleiche Runde
  sim.rand = w => { w.rs = w.rs + 0x6D2B79F5 | 0; let t = Math.imul(w.rs ^ w.rs >>> 15, 1 | w.rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const clamp = sim.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  sim.bounds = (w, kind) => { const x = GEOM[kind].ext; return { minX: -w.W / 2 + x.l, maxX: w.W / 2 - x.r, minY: -w.H / 2 + x.b, maxY: w.H / 2 - x.t }; };
  sim.body = e => { const d = GEOM[e.kind]; return { x: e.x + d.bx, y: e.y + d.by, r: d.body.r }; };
  sim.touching = (a, b) => { const p = sim.body(a), q = sim.body(b); return Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r; };
  sim.nearest = (e, list) => { let best = null, bd = Infinity; for (const o of list) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } } return best && { e: best, d: bd }; };

  function make(w, kind, x, y) { return { id: w.nextId++, kind, x, y }; }

  sim.create = function ({ seed = 1, wins = 0 } = {}) {
    const w = { W: CFG.fieldW, H: CFG.fieldH, rs: seed | 0, nextId: 1, time: 0, grace: CFG.grace, wins,
                phase: "main", reason: null, fire: null, trees: [], waters: [], events: [] };
    w.fire = make(w, "fire", 0, 0);
    const placed = [{ x: 0, y: 0 }];
    const spawn = (kind, minFire) => {
      const b = sim.bounds(w, kind);
      for (let i = 0; i < 200; i++) {
        const x = b.minX + sim.rand(w) * (b.maxX - b.minX), y = b.minY + sim.rand(w) * (b.maxY - b.minY);
        if (placed.every((p, j) => Math.hypot(p.x - x, p.y - y) > (j === 0 ? minFire : 80))) { placed.push({ x, y }); return make(w, kind, x, y); }
      }
      const x = (sim.rand(w) - .5) * 300, y = (sim.rand(w) - .5) * 200; placed.push({ x, y }); return make(w, kind, x, y);
    };
    for (let i = 0; i < CFG.trees; i++) w.trees.push(spawn("tree", 150));
    for (let i = 0; i < CFG.waters; i++) w.waters.push(spawn("water", 200));
    return w;
  };

  // Ein Zeitschritt. input = { mx, my } mit Werten von -1 bis 1.
  sim.step = function (w, input) {
    if (w.phase !== "main") return;
    const dt = sim.DT; w.time += dt;
    const fire = w.fire, fb = sim.bounds(w, "fire"), step = CFG.fireSpeed * dt;
    let mx = input.mx || 0, my = input.my || 0; const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    fire.x = clamp(fire.x + mx * step, fb.minX, fb.maxX); fire.y = clamp(fire.y + my * step, fb.minY, fb.maxY);

    w.grace = Math.max(0, w.grace - dt);
    for (const t of w.trees) FW.treeAI.update(w, t, dt);
    if (w.grace === 0) for (const o of w.waters) FW.waterAI.update(w, o, dt);

    // Baum tötet Wasser, Feuer zerstört Baum, Wasser tötet Feuer
    w.waters = w.waters.filter(o => { const t = w.trees.find(t => sim.touching(t, o)); if (t) w.events.push({ type: "drunk", id: o.id, by: t.id, x: o.x, y: o.y }); return !t; });
    w.trees = w.trees.filter(t => { const hit = sim.touching(fire, t); if (hit) w.events.push({ type: "burned", id: t.id, x: t.x, y: t.y }); return !hit; });
    const douser = w.waters.find(o => sim.touching(fire, o));
    if (douser) return end(w, "lost", "doused");
    if (w.trees.length === 0 && w.waters.length === 0) return end(w, "won", null);
    if (w.trees.length === 0) return end(w, "lost", "noTrees");
  };
  function end(w, phase, reason) { w.phase = phase; w.reason = reason; w.events.push({ type: phase, reason, time: w.time }); }
})(globalThis.FW = globalThis.FW || {});

// Baum: läuft vor dem Feuer weg, sonst jagt er das nächste Wasser.
(function (FW) {
  const sim = FW.sim, CFG = FW.CFG, clamp = sim.clamp;

  // Weglaufen, am Rand seitlich an der Wand entlang ausweichen
  sim.fleeStep = function (w, e, from, speed, dt) {
    const dx = e.x - from.x, dy = e.y - from.y, dist = Math.hypot(dx, dy);
    let ax, ay;
    if (dist < 1e-3) { const a = sim.rand(w) * 6.28; ax = Math.cos(a); ay = Math.sin(a); } else { ax = dx / dist; ay = dy / dist; }
    const step = speed * dt, b = sim.bounds(w, e.kind);
    let nx = e.x + ax * step, ny = e.y + ay * step;
    const hitX = nx < b.minX || nx > b.maxX, hitY = ny < b.minY || ny > b.maxY;
    nx = clamp(nx, b.minX, b.maxX); ny = clamp(ny, b.minY, b.maxY);
    if (hitX) { const dir = hitY ? -Math.sign(e.y || 1) : (Math.sign(dy) || (e.y > 0 ? -1 : 1)); ny = clamp(e.y + dir * step, b.minY, b.maxY); }
    if (hitY) { const dir = hitX ? -Math.sign(e.x || 1) : (Math.sign(dx) || (e.x > 0 ? -1 : 1)); nx = clamp(e.x + dir * step, b.minX, b.maxX); }
    e.x = nx; e.y = ny;
  };
  sim.chaseStep = function (w, e, target, speed, dt) {
    const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy) || 1, b = sim.bounds(w, e.kind), step = Math.min(speed * dt, d);
    e.x = clamp(e.x + dx / d * step, b.minX, b.maxX); e.y = clamp(e.y + dy / d * step, b.minY, b.maxY);
  };

  FW.treeAI = {
    update(w, t, dt) {
      const fire = w.fire;
      if (Math.hypot(t.x - fire.x, t.y - fire.y) < CFG.fleeDistance) sim.fleeStep(w, t, fire, CFG.treeSpeed, dt);
      else if (w.grace === 0) { const n = sim.nearest(t, w.waters); if (n) sim.chaseStep(w, t, n.e, CFG.treeSpeed, dt); }
    }
  };
})(globalThis.FW = globalThis.FW || {});

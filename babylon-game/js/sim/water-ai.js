// Wasser: rennt vor Bäumen weg, sonst greift es das Feuer an.
(function (FW) {
  const sim = FW.sim, CFG = FW.CFG, clamp = sim.clamp;

  FW.waterAI = {
    update(w, o, dt) {
      const fire = w.fire, speed = Math.min(CFG.waterMax, CFG.waterBase + CFG.waterPerWin * w.wins);
      const n = sim.nearest(o, w.trees);
      if (n && n.d < CFG.waterFear) { sim.fleeStep(w, o, n.e, speed, dt); return; }
      const dx = fire.x - o.x, dy = fire.y - o.y, d = Math.hypot(dx, dy) || 1;
      let vx = dx / d, vy = dy / d;
      for (const p of w.waters) if (p !== o) { const ox = o.x - p.x, oy = o.y - p.y, od = Math.hypot(ox, oy); if (od > 0 && od < 36) { vx += ox / od * 0.8; vy += oy / od * 0.8; } }
      const vl = Math.hypot(vx, vy) || 1, b = sim.bounds(w, "water");
      o.x = clamp(o.x + vx / vl * speed * dt, b.minX, b.maxX); o.y = clamp(o.y + vy / vl * speed * dt, b.minY, b.maxY);
    }
  };
})(globalThis.FW = globalThis.FW || {});

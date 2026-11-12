// Lenkung für Baum und Wasser: 16 Richtungen bewerten und die beste nehmen.
// Wände zählen bei der Bewertung mit, deshalb bleibt niemand an Rand oder Ecke kleben.
(function (FW) {
  const st = FW.steer = {};
  const N = 16, clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const DIRS = st.DIRS = Array.from({ length: N }, (_, i) => ({ x: Math.cos(i / N * Math.PI * 2), y: Math.sin(i / N * Math.PI * 2) }));

  // Beste Richtung laut score(dx, dy). extras: genaue Wunschrichtungen [dx, dy, ...], die zusätzlich geprüft werden.
  st.best = function (score, extras, out) {
    let bs = -Infinity; out.x = 0; out.y = 0;
    for (let i = 0; i < N; i++) { const s = score(DIRS[i].x, DIRS[i].y); if (s > bs) { bs = s; out.x = DIRS[i].x; out.y = DIRS[i].y; } }
    if (extras) for (let i = 0; i < extras.length; i += 2) {
      const l = Math.hypot(extras[i], extras[i + 1]); if (l < 1e-6) continue;
      const dx = extras[i] / l, dy = extras[i + 1] / l, s = score(dx, dy);
      if (s > bs) { bs = s; out.x = dx; out.y = dy; }
    }
    out.s = bs; return out;
  };

  // Wo stehe ich, wenn ich len weit in Richtung (dx, dy) gehe? Der Feldrand stoppt. cut = Anteil, den der Rand abschneidet.
  st.ahead = function (x, y, dx, dy, len, b, out) {
    const nx = clamp(x + dx * len, b.minX, b.maxX), ny = clamp(y + dy * len, b.minY, b.maxY);
    out.x = nx; out.y = ny; out.cut = 1 - Math.hypot(nx - x, ny - y) / len; return out;
  };

  // 1 bei Abstand <= full, 0 bei Abstand >= zero, dazwischen gleichmäßig
  st.ramp = (d, full, zero) => clamp((zero - d) / (zero - full), 0, 1);

  // Abstand zum nächsten Feldrand
  st.room = (x, y, b) => Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y);

  // Vorhalten: wo ist das Ziel, wenn ich mit speed dort ankomme (höchstens maxT voraus)?
  st.lead = function (px, py, tx, ty, tvx, tvy, speed, maxT, out) {
    const t = Math.min(maxT, Math.hypot(tx - px, ty - py) / speed);
    out.x = tx + tvx * t; out.y = ty + tvy * t; return out;
  };
})(globalThis.FW = globalThis.FW || {});

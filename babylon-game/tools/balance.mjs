// Spielt viele Runden ohne Grafik mit einfachen, programmierten Spielern und druckt eine Tabelle.
// Aufruf: node tools/balance.mjs [Runden pro Zeile]
import { sim } from "./load.mjs";

const unit = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; return { mx: dx / d, my: dy / d }; };
const STILL = { mx: 0, my: 0 };
const PLAYERS = {
  "Never moves": () => STILL,
  "Runs from water, then burns trees": w => {
    const f = w.fire;
    if (w.waters.length) { let vx = 0, vy = 0; for (const o of w.waters) { const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 1; vx += dx / d / d; vy += dy / d / d; } return unit(vx, vy); }
    const n = sim.nearest(f, w.trees); return n ? unit(n.e.x - f.x, n.e.y - f.y) : STILL;
  },
  "Always chases the nearest tree": w => { const n = sim.nearest(w.fire, w.trees); return n ? unit(n.e.x - w.fire.x, n.e.y - w.fire.y) : STILL; }
};

function play(player, seed, maxT) {
  const w = sim.create({ seed, wins: 0 });
  while (w.phase === "main" && w.time < maxT) sim.step(w, player(w));
  return w;
}
const median = a => a.length ? a.sort((x, y) => x - y)[a.length >> 1] : NaN;
const N = parseInt(process.argv[2] || "3000", 10), MAX_T = 60;
const pct = v => (v / N * 100).toFixed(0) + "%";

console.log(`${N} rounds per player, undecided after ${MAX_T} s counts as stuck\n`);
console.log("| Scripted player | Won | Doused by water | Burned the last tree | Still undecided |");
console.log("|---|---|---|---|---|");
for (const [name, player] of Object.entries(PLAYERS)) {
  const c = { won: 0, doused: 0, noTrees: 0, stuck: 0 }, wonT = [];
  for (let i = 0; i < N; i++) {
    const w = play(player, 1000 + i, MAX_T);
    if (w.phase === "won") { c.won++; wonT.push(w.time); } else if (w.phase === "lost") c[w.reason]++; else c.stuck++;
  }
  console.log(`| ${name} | ${pct(c.won)}${wonT.length ? ` (median ${median(wonT).toFixed(1)} s)` : ""} | ${pct(c.doused)} | ${pct(c.noTrees)} | ${pct(c.stuck)} |`);
}

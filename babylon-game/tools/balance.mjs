// Spielt viele Runden ohne Grafik mit programmierten Spielern und druckt eine Tabelle.
// Aufruf: node tools/balance.mjs [--n 200] [--levels 1-10] [--players still,greedy,evader,casual,lurer] [--set tree.speed=140,water.accel=600]
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { FW, sim } from "./load.mjs";

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i < 0 ? dflt : process.argv[i + 1]; };
const MAX_T = 90;                                       // danach gilt eine Runde als festgefahren

// --set a.b=1,c=2 überschreibt Stellschrauben in FW.CFG für einen Versuch
for (const kv of (arg("set", "") || "").split(",").filter(Boolean)) {
  const [path, val] = kv.split("="), keys = path.split("."); let o = FW.CFG;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = Number(val);
}

// ---------- programmierte Spieler ----------
const STILL = { mx: 0, my: 0 };
const unit = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; return { mx: dx / d, my: dy / d }; };
const ACTIONS = [STILL, ...Array.from({ length: 8 }, (_, i) => ({ mx: Math.cos(i * Math.PI / 4), my: Math.sin(i * Math.PI / 4) }))];
const visible = t => t.state !== "seed";
// Alle programmierten Spieler springen, sobald direkt vor ihnen ein Stein liegt
const act = (w, a) => sim.stoneAhead(w, a.mx, a.my) ? { mx: a.mx, my: a.my, jump: true } : a;
const toward = (w, e) => unit(sim.px(e) + e.vx * 0.2 - sim.px(w.fire), sim.py(e) + e.vy * 0.2 - sim.py(w.fire));

const PLAYERS = {
  // bewegt sich nie
  still: () => () => STILL,
  // jagt immer den nächsten Baum
  greedy: () => w => { const n = sim.nearest(w.fire, w.trees, visible); return n ? toward(w, n.e) : STILL; },
  // läuft nur vor dem Wasser weg und verbrennt die Bäume erst im Finale
  evader: () => w => {
    const f = w.fire, waters = w.waters.filter(sim.landed);
    if (w.phase === "finale") { const n = sim.nearest(f, w.trees, visible); return n ? toward(w, n.e) : STILL; }
    if (!waters.length) return STILL;
    const px = sim.px(f), py = sim.py(f), b = w.bb.fire; let best = STILL, bs = -Infinity;
    for (const a of ACTIONS) {
      const x = sim.clamp(px + a.mx * 70, b.minX, b.maxX), y = sim.clamp(py + a.my * 70, b.minY, b.maxY);
      let s = 300;
      for (const o of waters) s = Math.min(s, Math.hypot(x - sim.px(o) - o.vx * 0.3, y - sim.py(o) - o.vy * 0.3));
      for (const t of w.trees) { const d = Math.hypot(x - sim.px(t), y - sim.py(t)); if (d < 80) s -= 200; }
      s += Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y, 120) * 0.3;
      if (s > bs) { bs = s; best = a; }
    }
    return best;
  },
  // lockt Wasser zu Bäumen: rechnet für jede Richtung kurz voraus und nimmt die beste. Sieht alles, reagiert sofort.
  lurer: () => lookahead({ every: 18, delay: 0, horizon: 78, slip: 0 }),
  // wie lurer, aber menschlicher: entscheidet seltener, reagiert 0,2 s verspätet, verpasst manchmal eine Entscheidung
  casual: () => lookahead({ every: 24, delay: 24, horizon: 102, slip: 0.1 })
};
function lookahead({ every, delay, horizon, slip }) {
  let hold = 0, action = STILL, pending = STILL, wait = 0, rs = 12345;
  const rnd = () => { rs = Math.imul(rs ^ rs >>> 15, 2246822519) + 0x9E3779B9 | 0; return (rs >>> 0) / 4294967296; };
  return w => {
    if (wait > 0 && --wait === 0) action = pending;
    if (--hold > 0) return action;
    hold = every;
    if (rnd() < slip) return action;
    let bv = -Infinity, best = action;
    for (const a of ACTIONS) {
      const c = structuredClone(w); c.events = [];
      for (let i = 0; i < horizon && c.phase !== "won" && c.phase !== "lost"; i++) sim.step(c, act(c, i < delay ? action : a));
      const v = value(w, c) + (a === action ? 4 : 0);
      if (v > bv) { bv = v; best = a; }
    }
    if (delay) { pending = best; wait = delay; } else action = best;
    return action;
  };
}
// Wie gut steht der lockende Spieler nach dem Vorausrechnen da?
function value(w0, w) {
  if (w.phase === "lost") return -10000 + w.time;
  if (w.phase === "won") return 10000;
  const f = w.fire, burned = w0.trees.length - w.trees.length;
  let v = (w.score.drunk - w0.score.drunk) * 400;
  const nt = sim.nearest(f, w.trees, visible);
  if (w.phase === "finale") return v + burned * 300 - (nt ? nt.d : 0);
  v -= burned * 300;                                    // Bäume sind die einzige Waffe
  if (nt && nt.d < 80) v -= (80 - nt.d) * 3;
  const waters = w.waters.filter(sim.landed);
  if (!waters.length) return v - Math.hypot(f.x, f.y) * 0.05;
  v += Math.min(sim.nearest(f, waters).d, 160) * 1.5;    // Abstand zum Wasser halten
  for (const o of waters) { const n = sim.nearest(o, w.trees, visible); if (n) v -= Math.min(n.d, 400) * 0.25; }   // Wasser soll nah an Bäume
  return v;
}

function run(level, playerName, n) {
  const c = { won: 0, doused: 0, noTrees: 0, stuck: 0 }, wonT = [], stars = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const w = sim.create({ level, seed: 1000 + i * 7919 }), player = PLAYERS[playerName]();
    while (w.phase !== "won" && w.phase !== "lost" && w.time < MAX_T) { sim.step(w, act(w, player(w))); w.events.length = 0; }
    if (w.phase === "won") { c.won++; wonT.push(w.result.time); stars[w.result.stars]++; } else if (w.phase === "lost") c[w.reason]++; else c.stuck++;
  }
  wonT.sort((a, b) => a - b);
  return { level, player: playerName, n, ...c, median: wonT.length ? wonT[wonT.length >> 1] : null, stars };
}

// ---------- ein einzelner Auftrag (Kindprozess) ----------
if (arg("job")) {
  const [level, player, n] = arg("job").split(":");
  console.log(JSON.stringify(run(+level, player, +n)));
  process.exit(0);
}

// ---------- alle Aufträge verteilen und Tabelle drucken ----------
const [lo, hi] = arg("levels", "1-10").split("-").map(Number), levels = []; for (let l = lo; l <= (hi || lo); l++) levels.push(l);
const players = arg("players", "still,greedy,evader,casual,lurer").split(","), N = +arg("n", "200");
const slow = new Set(["lurer", "casual"]);
const jobs = []; for (const p of players) for (const l of levels) jobs.push({ l, p, n: slow.has(p) ? Math.max(20, Math.round(N / 4)) : N });
jobs.sort((a, b) => (slow.has(b.p) ? b.l : 0) - (slow.has(a.p) ? a.l : 0));   // die langsamsten Aufträge zuerst
const results = [], self = fileURLToPath(import.meta.url), extra = arg("set") ? ["--set", arg("set")] : [];
await new Promise(done => {
  let next = 0, active = 0;
  const pump = () => {
    if (next >= jobs.length && active === 0) return done();
    while (active < Math.max(1, cpus().length - 1) && next < jobs.length) {
      const j = jobs[next++]; active++; let out = "";
      const ch = spawn(process.execPath, [self, "--job", `${j.l}:${j.p}:${j.n}`, ...extra], { stdio: ["ignore", "pipe", "inherit"] });
      ch.stdout.on("data", d => out += d);
      ch.on("close", () => { active--; try { results.push(JSON.parse(out)); } catch (_) { console.error("job failed", j); } pump(); });
    }
  };
  pump();
});
const pct = (v, n) => (v / n * 100).toFixed(0).padStart(3) + "%";
console.log(`undecided after ${MAX_T} s counts as stuck${arg("set") ? " · --set " + arg("set") : ""}\n`);
console.log("| Player | Level | Rounds | Won | Median won | Doused | Last tree burned | Stuck | Stars 1/2/3 |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const p of players) for (const l of levels) {
  const r = results.find(r => r.player === p && r.level === l); if (!r) continue;
  console.log(`| ${p} | ${l} | ${r.n} | ${pct(r.won, r.n)} | ${r.median === null ? "–" : r.median.toFixed(1) + " s"} | ${pct(r.doused, r.n)} | ${pct(r.noTrees, r.n)} | ${pct(r.stuck, r.n)} | ${r.stars.slice(1).join("/")} |`);
}

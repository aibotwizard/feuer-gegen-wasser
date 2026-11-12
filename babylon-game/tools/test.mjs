// Tests für die Spielregeln. Aufruf: node tools/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { FW, sim } from "./load.mjs";

const STILL = { mx: 0, my: 0 }, CFG = FW.CFG;
// Eine Welt, in die jeder Test genau die Figuren setzt, die er braucht. Bäume stehen, Wasser ist gelandet.
function world(trees, waters, opts = {}) {
  const w = sim.create({ level: 1, seed: 7, ...opts }); w.phase = "main"; w.time = 5; w.events.length = 0;
  w.trees = trees.map(([x, y]) => Object.assign(sim.newTree(w, x, y, 0), { state: "roam" }));
  w.waters = waters.map(([x, y, state = "hunt"]) => Object.assign(sim.newWater(w, 0), { x, y, state, born: w.time, plan: 9 }));
  return w;
}
const types = w => w.events.map(e => e.type);
const run = (w, seconds, input = STILL) => { for (let i = 0; i < seconds * 120 && w.phase !== "won" && w.phase !== "lost"; i++) sim.step(w, input); return w; };

test("tree touches water: the water dies, the tree grows, 100 points", () => {
  const w = world([[300, -100], [-300, 120]], [[300, -70]]);
  sim.step(w, STILL);
  assert.equal(w.waters.length, 0); assert.equal(w.trees.length, 2); assert.equal(w.trees[0].grow, 1);
  assert.equal(w.score.points, 100); assert.ok(types(w).includes("drunk"));
});
test("fire touches tree: the tree dies", () => {
  const w = world([[0, -40], [300, 120]], [[-400, -200]]);
  sim.step(w, STILL);
  assert.equal(w.trees.length, 1); assert.equal(w.phase, "main"); assert.ok(types(w).includes("burned"));
});
test("water touches fire: the round is lost", () => {
  const w = world([[300, 120]], [[30, 0]]);
  sim.step(w, STILL);
  assert.equal(w.phase, "lost"); assert.equal(w.reason, "doused");
});
test("falling water is harmless until it lands", () => {
  const w = world([[300, 120]], [[30, 0, "fall"]]);
  for (let i = 0; i < 60; i++) sim.step(w, STILL);
  assert.equal(w.phase, "main");
  run(w, 1);
  assert.equal(w.phase, "lost"); assert.ok(types(w).includes("landed"));
});
test("last tree burned while water lives: the round is lost", () => {
  const w = world([[0, -40]], [[-400, -200]]);
  sim.step(w, STILL);
  assert.equal(w.phase, "lost"); assert.equal(w.reason, "noTrees");
});
test("last tree burned while water has not even fallen yet: the round is lost", () => {
  const w = world([[0, -40]], [[0, 0, "wait"]]); w.waters[0].startAt = 99;
  sim.step(w, STILL);
  assert.equal(w.phase, "lost"); assert.equal(w.reason, "noTrees");
});
test("last water drunk starts the finale; burning every tree then wins", () => {
  const w = world([[300, -100], [0, -40]], [[300, -70]]);
  sim.step(w, STILL);                                  // Wasser getrunken, ein Baum verbrannt
  assert.equal(w.phase, "finale"); assert.ok(types(w).includes("finale"));
  w.trees[0].x = 0; w.trees[0].y = -40;
  sim.step(w, STILL);
  assert.equal(w.phase, "won"); assert.equal(w.result.points, 100 + CFG.score.finaleTree);
});
test("combo: a second water within 4 s counts double", () => {
  const w = world([[300, -100], [-300, -100]], [[300, -70], [-300, 150]]);
  sim.step(w, STILL);
  w.waters[0].x = -300; w.waters[0].y = -70; run(w, 0.05);
  assert.equal(w.score.points, 300); assert.equal(w.score.maxCombo, 2);
});
test("result: time bonus, flawless bonus and stars", () => {
  const w = world([[0, -40]], [], { flawless: true }); w.playTime = 10;
  sim.step(w, STILL);
  const r = w.result, par = w.def.par;
  assert.equal(w.phase, "won"); assert.equal(r.stars, 3); assert.equal(r.flawless, 250);
  assert.equal(r.timeBonus, Math.round(par - r.time) * 10); assert.equal(r.total, r.points + r.timeBonus + 250);
  const slow = world([[0, -40]], [], { flawless: false }); slow.playTime = par + 5; sim.step(slow, STILL);
  assert.equal(slow.result.stars, 1); assert.equal(slow.result.timeBonus, 0); assert.equal(slow.result.flawless, 0);
});
test("one tree left while water lives: warning on, and off again when the water is gone", () => {
  const w = world([[300, -100], [0, -40]], [[-400, 200]]);
  sim.step(w, STILL);
  assert.ok(types(w).includes("lastTree")); assert.equal(w.lastTree, w.trees[0].id);
  w.waters[0].x = 300; w.waters[0].y = -70; w.events.length = 0; sim.step(w, STILL);
  assert.ok(types(w).includes("lastTreeClear"));
});
test("water in range: the tree crouches, lunges and catches water that runs past", () => {
  const w = world([[0, 150]], [[-110, 190]]); w.fire.x = 400; w.fire.y = -200;
  Object.assign(w.waters[0], { vx: 170, vy: 0, dx: 1, dy: 0 });
  run(w, 1.2);
  assert.deepEqual(types(w).filter(t => ["crouch", "lunge", "drunk"].includes(t)), ["crouch", "lunge", "drunk"]);
});
test("a tree does not lunge while the fire is right next to it", () => {
  const w = world([[0, 150]], [[-110, 190]]); w.fire.x = 30; w.fire.y = 200; w.waters[0].plan = 0.2;
  run(w, 0.1);
  assert.ok(!types(w).includes("crouch"));
});
test("a careful water stays out of lunge range of a tree far from the fire", () => {
  for (let seed = 1; seed <= 15; seed++) {
    const w = world([[0, 0]], [[-430, 30]], { seed }); w.fire.x = 430; w.fire.y = 40;      // der Baum steht genau im Weg
    w.waters[0].plan = 0;
    for (let i = 0; i < 240; i++) { sim.step(w, { mx: 0, my: i % 240 < 120 ? 1 : -1 }); if (w.phase !== "main") break; }
    assert.ok(!types(w).includes("drunk"), "water walked into the tree (seed " + seed + ")");
  }
});
test("a tree chased along the wall into a corner gets out again", () => {
  const w = world([[0, 0]], []); w.phase = "finale";
  const b = w.bounds.tree, t = w.trees[0]; t.x = b.maxX; t.y = b.maxY;
  w.fire.x = b.maxX - 260; w.fire.y = b.maxY;
  run(w, 2.5, { mx: 0.45, my: 0 });                     // das Feuer kommt langsam an der oberen Wand entlang
  assert.equal(w.trees.length, 1, "the tree let itself be caught");
  assert.ok(t.y < b.maxY - 120, "tree stayed in the corner at y " + t.y.toFixed(0));
});
test("water picks a landing spot at least 250 from a fire in the middle and 150 from every tree", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = sim.create({ level: 4, seed }); let drops = 0;
    for (let i = 0; i < 120 * 3; i++) {
      sim.step(w, STILL);
      for (const e of w.events.splice(0)) if (e.type === "rainStart") {
        const o = w.waters.find(o => o.id === e.id); drops++;
        assert.ok(sim.dist(o, w.fire) >= 250 - 1e-6, "too close to the fire, seed " + seed);
        for (const t of w.trees) assert.ok(sim.dist(o, t) >= 150 - 1e-6, "too close to a tree, seed " + seed);
      }
    }
    assert.equal(drops, 4);
  }
});
test("nobody ever leaves the field", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const w = sim.create({ level: 1 + seed % 8, seed });
    const push = { mx: seed % 2 ? 1 : -1, my: seed % 3 ? 1 : -1 };   // Feuer drückt in eine Ecke
    for (let i = 0; i < 2400 && w.phase !== "won" && w.phase !== "lost"; i++) {
      sim.step(w, i % 600 < 300 ? push : { mx: -push.mx, my: 0 });
      for (const e of [w.fire, ...w.trees, ...w.waters]) {
        if (e.state === "wait") continue;
        const b = w.bounds[e.kind];
        assert.ok(e.x >= b.minX - 1e-6 && e.x <= b.maxX + 1e-6 && e.y >= b.minY - 1e-6 && e.y <= b.maxY + 1e-6, `${e.kind} left the field (seed ${seed})`);
      }
    }
  }
});
test("a player who never moves is doused", () => {
  for (let seed = 1; seed <= 10; seed++) { const w = run(sim.create({ level: 3, seed }), 60); assert.equal(w.reason, "doused", "seed " + seed); }
});
test("same seed and same inputs give the same round", () => {
  const go = () => { const w = sim.create({ level: 6, seed: 99 }), log = []; for (let i = 0; i < 3600 && w.phase !== "won" && w.phase !== "lost"; i++) { sim.step(w, { mx: Math.sin(i / 40), my: Math.cos(i / 55) }); log.push(...w.events.splice(0).map(e => i + ":" + e.type + ":" + e.id)); } return log.join("|") + "#" + w.fire.x + "," + w.fire.y; };
  assert.equal(go(), go());
});
test("a world is plain data: a copy plays on exactly like the original", () => {
  const a = run(sim.create({ level: 5, seed: 3 }), 3, { mx: 1, my: 0 }), b = structuredClone(a);
  run(a, 3, { mx: 0, my: 1 }); run(b, 3, { mx: 0, my: 1 });
  assert.deepEqual(b, a);
});
test("level table", () => {
  const L = FW.levelDef;
  assert.deepEqual([L(1).trees, L(1).waters, L(1).speed], [3, 1, 0.7]);
  assert.deepEqual([L(6).trees, L(6).waters, L(6).speed], [4, 5, 0.9]);
  assert.deepEqual([7, 8, 9, 10].map(n => L(n).trees), [3, 4, 5, 3]);
  assert.deepEqual([7, 8, 9, 10, 11].map(n => L(n).waters), [5, 5, 6, 6, 7]);
  assert.equal(L(60).waters, 10); assert.equal(L(60).speed, 1); assert.equal(L(4).par, 20 + 8 * 4);
});

// Tests für die Spielregeln. Aufruf: node tools/test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { sim } from "./load.mjs";

const STILL = { mx: 0, my: 0 };
// Eine leere Welt, in die jeder Test genau die Figuren setzt, die er braucht
function world(trees, waters) {
  const w = sim.create({ seed: 7 }); w.grace = 0; w.events.length = 0;
  w.trees = trees.map(([x, y]) => ({ id: w.nextId++, kind: "tree", x, y }));
  w.waters = waters.map(([x, y]) => ({ id: w.nextId++, kind: "water", x, y }));
  return w;
}
const types = w => w.events.map(e => e.type);

test("tree touches water: the water dies", () => {
  const w = world([[150, -100], [-200, 120]], [[150, -70]]);
  sim.step(w, STILL);
  assert.equal(w.waters.length, 0); assert.equal(w.trees.length, 2); assert.deepEqual(types(w), ["drunk"]);
});
test("fire touches tree: the tree dies", () => {
  const w = world([[0, -40], [200, 120]], [[-200, -120]]);
  sim.step(w, STILL);
  assert.equal(w.trees.length, 1); assert.equal(w.phase, "main"); assert.ok(types(w).includes("burned"));
});
test("water touches fire: the round is lost", () => {
  const w = world([[200, 120]], [[30, 0]]);
  sim.step(w, STILL);
  assert.equal(w.phase, "lost"); assert.equal(w.reason, "doused");
});
test("last tree burned while water lives: the round is lost", () => {
  const w = world([[0, -40]], [[-200, -120]]);
  sim.step(w, STILL);
  assert.equal(w.phase, "lost"); assert.equal(w.reason, "noTrees");
});
test("fire is the last one left: the round is won", () => {
  const w = world([[0, -40]], []);
  sim.step(w, STILL);
  assert.equal(w.phase, "won");
});
test("nobody ever leaves the field", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = sim.create({ seed });
    const push = { mx: seed % 2 ? 1 : -1, my: seed % 3 ? 1 : -1 };   // Feuer drückt in eine Ecke
    for (let i = 0; i < 1200 && w.phase === "main"; i++) {
      sim.step(w, push);
      for (const e of [w.fire, ...w.trees, ...w.waters]) {
        const b = sim.bounds(w, e.kind);
        assert.ok(e.x >= b.minX - 1e-6 && e.x <= b.maxX + 1e-6 && e.y >= b.minY - 1e-6 && e.y <= b.maxY + 1e-6, `${e.kind} left the field (seed ${seed})`);
      }
    }
  }
});
test("same seed and same inputs give the same round", () => {
  const run = () => { const w = sim.create({ seed: 99 }), log = []; for (let i = 0; i < 2400 && w.phase === "main"; i++) { sim.step(w, { mx: Math.sin(i / 40), my: Math.cos(i / 55) }); log.push(...w.events.splice(0).map(e => i + ":" + e.type + ":" + e.id)); } return log.join("|") + "#" + w.fire.x + "," + w.fire.y; };
  assert.equal(run(), run());
});

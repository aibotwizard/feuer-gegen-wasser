// Die Bilder der Figuren auf der Bühne. Liest nur den Zustand der Regeln, ändert ihn nie.
(function (FW) {
  const GEOM = FW.GEOM, clamp = FW.sim.clamp;
  const sprites = FW.sprites = {};
  const live = new Map();          // id -> Bild einer lebenden Figur
  let dying = [];                  // Bilder, die gerade verschwinden

  function make(e) {
    const d = GEOM[e.kind], s = d.size, scene = FW.stage.scene;
    const mesh = BABYLON.MeshBuilder.CreatePlane(e.kind, { width: d.w * s, height: d.h * s }, scene); mesh.material = d.mat;
    const shadow = BABYLON.MeshBuilder.CreatePlane("sh", { width: d.w * s * 0.8, height: d.w * s * 0.25 }, scene); shadow.material = FW.stage.shadowMat;
    return { kind: e.kind, d, x: e.x, y: e.y, mesh, shadow, t: 0, seed: Math.random() * 6.28 };
  }
  function place(sp, time, k) {
    let sx = 1, sy = 1;
    if (sp.kind === "fire") { sx = 1 + 0.02 * Math.sin(time * 7); sy = 1 + 0.035 * Math.sin(time * 9 + 1); }
    if (sp.kind === "water") { sx = 1 + 0.05 * Math.sin(time * 8 + sp.seed); sy = 1 - 0.05 * Math.sin(time * 8 + sp.seed); }
    sx *= k; sy *= k;
    sp.mesh.scaling.set(sx, sy, 1); sp.mesh.visibility = k; sp.shadow.visibility = k;
    sp.mesh.position.set(sp.x + sp.d.offX * sx, sp.y + sp.d.offY * sy, sp.y * 0.001);
    sp.shadow.position.set(sp.x, sp.y - sp.d.ext.b + 4, 1 + sp.y * 0.001);
  }
  function dispose(sp) { sp.mesh.dispose(); sp.shadow.dispose(); }

  // Jedes Bild einmal pro Bild-Aufbau an den Zustand der Regeln anpassen
  sprites.sync = function (world, time, dt) {
    const seen = new Set();
    for (const e of [world.fire, ...world.trees, ...world.waters]) {
      seen.add(e.id);
      let sp = live.get(e.id); if (!sp) { sp = make(e); live.set(e.id, sp); }
      sp.x = e.x; sp.y = e.y; place(sp, time, 1);
    }
    for (const [id, sp] of live) if (!seen.has(id)) { live.delete(id); sp.t = 0; dying.push(sp); }
    dying = dying.filter(sp => { sp.t += dt; place(sp, time, clamp(1 - sp.t / 0.35, 0, 1)); if (sp.t > 0.4) { dispose(sp); return false; } return true; });
  };
  sprites.clear = function () { for (const sp of live.values()) dispose(sp); live.clear(); dying.forEach(dispose); dying = []; };
})(globalThis.FW = globalThis.FW || {});

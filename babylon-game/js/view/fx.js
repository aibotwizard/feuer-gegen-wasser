// Effekte: Funken, Spritzer, Blätter, Dampf, Spuren auf der Wiese. Reagiert auf Ereignisse der Regeln.
(function (FW) {
  const GEOM = FW.GEOM, CFG = FW.CFG, stage = FW.stage;
  const fx = FW.fx = {};
  const systems = {};              // Name -> Partikel-Art
  const decals = [], DECAL_MAX = 200;
  let decalMats = null, trailT = 0, wetT = 0, pollenT = 0, ready = false;
  const V3 = (x, y) => new BABYLON.Vector3(x, y, 0), C4 = (r, g, b, a) => new BABYLON.Color4(r, g, b, a);

  // Eine Partikel-Art. Positionen kommen aus einer Warteschlange, so kann eine Art an vielen Orten zugleich sprühen.
  function system(name, tex, cap, o) {
    const ps = new BABYLON.ParticleSystem(name, cap, stage.scene), queue = [];
    ps.particleTexture = tex; ps.emitter = V3(0, 0); ps.renderingGroupId = 1; ps.updateSpeed = 1 / 60;   // Zeiten in Sekunden
    ps.blendMode = o.add ? BABYLON.ParticleSystem.BLENDMODE_ADD : BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    ps.minLifeTime = o.life[0]; ps.maxLifeTime = o.life[1]; ps.minEmitPower = 1; ps.maxEmitPower = 1;
    ps.direction1 = V3(o.dir[0], o.dir[1]); ps.direction2 = V3(o.dir[2], o.dir[3]); ps.gravity = V3(0, o.gravity || 0);
    ps.color1 = C4(...o.c1); ps.color2 = C4(...(o.c2 || o.c1)); ps.colorDead = C4(...o.dead);
    if (o.size.length === 4) { ps.addSizeGradient(0, o.size[0], o.size[1]); ps.addSizeGradient(1, o.size[2], o.size[3]); } else { ps.minSize = o.size[0]; ps.maxSize = o.size[1]; }
    if (o.spin) { ps.minAngularSpeed = -o.spin; ps.maxAngularSpeed = o.spin; ps.minInitialRotation = 0; ps.maxInitialRotation = 6.28; }
    ps.emitRate = 0; ps.manualEmitCount = 0;
    ps.startPositionFunction = (m, pos) => { const q = queue.pop(); if (q) { pos.x = q.x + (Math.random() - 0.5) * q.r * 2; pos.y = q.y + (Math.random() - 0.5) * q.r * 2; pos.z = -0.5; } };
    ps.start();
    systems[name] = { ps, queue, cap };
  }

  fx.init = function () {
    const dot = stage.canvasTex(64, 64, (ctx, W) => { const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, W); });
    const puff = stage.canvasTex(64, 64, (ctx, W) => { const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(0.6, "rgba(255,255,255,.4)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, W); });
    const leaf = stage.canvasTex(64, 64, (ctx, W) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(6, W / 2); ctx.quadraticCurveTo(W / 2, 4, W - 6, W / 2); ctx.quadraticCurveTo(W / 2, W - 4, 6, W / 2); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, W / 2); ctx.lineTo(W - 8, W / 2); ctx.stroke(); });
    const drop = stage.canvasTex(64, 64, (ctx, W) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.34, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = "rgba(20,60,140,.5)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.34, 0, 7); ctx.stroke(); });
    const star = stage.canvasTex(64, 64, (ctx, W) => { ctx.fillStyle = "#fff"; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? W * 0.12 : W * 0.46; ctx.lineTo(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r); } ctx.fill(); });

    system("ember",   dot,  300, { add: true, life: [0.5, 1.1], dir: [-22, 34, 22, 92], gravity: 40, size: [4, 7, 1, 2], c1: [1, 0.8, 0.3, 1], c2: [1, 0.45, 0.1, 1], dead: [0.6, 0.1, 0, 0] });
    system("spark",   dot,  300, { add: true, life: [0.25, 0.6], dir: [-70, -30, 70, 90], gravity: -90, size: [2.5, 5, 1, 1.5], c1: [1, 0.95, 0.6, 1], c2: [1, 0.6, 0.2, 1], dead: [1, 0.2, 0, 0] });
    system("smoke",   puff, 160, { life: [0.9, 1.7], dir: [-16, 28, 16, 70], size: [12, 18, 34, 48], c1: [0.2, 0.18, 0.17, 0.6], c2: [0.32, 0.3, 0.28, 0.5], dead: [0.15, 0.15, 0.15, 0] });
    system("leaf",    leaf, 200, { life: [0.7, 1.4], dir: [-150, 30, 150, 200], gravity: -280, size: [6, 11], spin: 7, c1: [0.25, 0.75, 0.3, 1], c2: [0.1, 0.5, 0.2, 1], dead: [0.3, 0.25, 0.1, 0] });
    system("drop",    drop, 300, { life: [0.4, 0.8], dir: [-150, 40, 150, 230], gravity: -440, size: [4, 9], c1: [0.55, 0.85, 1, 1], c2: [0.2, 0.55, 0.95, 1], dead: [0.2, 0.5, 0.9, 0] });
    system("steam",   puff, 200, { life: [0.6, 1.3], dir: [-26, 40, 26, 112], size: [10, 16, 28, 40], c1: [1, 1, 1, 0.55], c2: [0.9, 0.95, 1, 0.4], dead: [1, 1, 1, 0] });
    system("dust",    puff, 150, { life: [0.3, 0.6], dir: [-44, 4, 44, 30], size: [6, 10, 16, 22], c1: [0.78, 0.7, 0.5, 0.4], c2: [0.6, 0.62, 0.4, 0.3], dead: [0.7, 0.7, 0.5, 0] });
    system("sparkle", star, 150, { add: true, life: [0.4, 0.8], dir: [-70, -20, 70, 100], size: [8, 13, 2, 3], spin: 4, c1: [1, 1, 0.7, 1], c2: [0.7, 1, 0.8, 1], dead: [1, 0.9, 0.3, 0] });
    system("pollen",  dot,  120, { add: true, life: [5, 9], dir: [-8, -4, 15, 10], size: [2, 4], c1: [1, 1, 0.8, 0.45], c2: [1, 1, 1, 0.3], dead: [1, 1, 0.8, 0] });

    const blob = (w, h, stops) => stage.makeMaterial(stage.canvasTex(w, h, (ctx, W, H) => {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1, H / W);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W / 2); stops.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; ctx.fillRect(-W / 2, -W / 2, W, W); ctx.restore();
    }));
    decalMats = {
      scorch: blob(64, 64, [[0, "rgba(20,12,4,.62)"], [0.55, "rgba(30,18,6,.34)"], [1, "rgba(30,18,6,0)"]]),
      burnt: blob(128, 80, [[0, "rgba(10,8,6,.85)"], [0.6, "rgba(24,16,8,.55)"], [1, "rgba(24,16,8,0)"]]),
      puddle: blob(128, 64, [[0, "rgba(120,200,255,.75)"], [0.7, "rgba(40,120,220,.55)"], [0.85, "rgba(30,90,200,.3)"], [1, "rgba(30,90,200,0)"]]),
      wet: blob(64, 40, [[0, "rgba(10,50,60,.3)"], [1, "rgba(10,50,60,0)"]])
    };
    stage.scene.onAfterRenderObservable.add(() => { for (const s of Object.values(systems)) s.queue.length = 0; });
    ready = true;
  };

  // n Partikel der Art name rund um (x, y) im Umkreis r
  fx.emit = function (name, x, y, n, r = 0) {
    const s = systems[name]; if (!s) return;
    for (let i = 0; i < n && s.queue.length < s.cap; i++) s.queue.push({ x, y, r });
  };

  // Spur auf der Wiese: verblasst in life Sekunden
  fx.decal = function (kind, x, y, w, h, life, alpha = 1) {
    let d = decals.find(d => d.t >= d.life);
    if (!d) {
      if (decals.length >= DECAL_MAX) d = decals.reduce((a, b) => (a.life - a.t < b.life - b.t ? a : b));
      else { d = { m: BABYLON.MeshBuilder.CreatePlane("decal", { width: 1, height: 1 }, stage.scene), t: 0, life: 0, a: 1 }; d.m.position.z = 4.5; d.m.isPickable = false; decals.push(d); }
    }
    d.m.material = decalMats[kind]; d.m.position.x = x; d.m.position.y = y; d.m.scaling.set(w, h, 1);
    d.m.rotation.z = kind === "scorch" ? Math.random() * 6.28 : 0; d.m.alphaIndex = kind === "puddle" ? 120 : 100;
    d.t = 0; d.life = life; d.a = alpha; d.m.visibility = alpha; d.m.setEnabled(true);
  };

  // Einmal pro Bild: laufende Effekte, die keinen Anlass brauchen
  fx.frame = function (dt, world, running) {
    if (!ready) return;
    for (const d of decals) if (d.t < d.life) { d.t += dt; const k = 1 - d.t / d.life; d.m.visibility = d.a * Math.min(1, k * 2.5); if (d.t >= d.life) d.m.setEnabled(false); }
    if ((pollenT -= dt) <= 0) { pollenT = 0.12; fx.emit("pollen", (Math.random() - 0.5) * CFG.fieldW, (Math.random() - 0.5) * CFG.fieldH, 1); }
    if (world && running) {
      const f = world.fire, fxp = f.x + GEOM.fire.offX, fyp = f.y - GEOM.fire.ext.b, speed = Math.hypot(f.vx, f.vy);
      if (world.phase !== "lost") {
        fx.emit("ember", fxp, fyp + 34, Math.random() < dt * 34 ? 1 : 0, 20);
        if (speed > 60) {
          fx.emit("spark", fxp - f.vx * 0.05, fyp + 16, Math.random() < dt * 40 ? 1 : 0, 12);
          if ((trailT -= dt) <= 0) { trailT = 0.07; fx.decal("scorch", fxp + (Math.random() - 0.5) * 10, fyp + 5, 44, 44, 2.2, 0.5); }
        }
      }
      wetT -= dt;
      for (const o of world.waters) {
        if (o.state !== "hunt") continue;
        const ox = o.x, oy = o.y - GEOM.water.ext.b, v = Math.hypot(o.vx, o.vy);
        if (wetT <= 0 && v > 40) fx.decal("wet", ox, oy + 3, 40, 24, 1.6, 0.9);
        if (v > 150 && Math.random() < dt * 14) fx.emit("drop", ox - o.vx * 0.06, oy + 10, 1, 6);
        const d = Math.hypot(ox - f.x, o.y - f.y);
        if (d < 130 && Math.random() < dt * 22 * (1 - d / 130)) fx.emit("steam", ox, o.y + 14, 1, 10);      // es zischt, wenn Wasser dem Feuer nahe kommt
        if (o.anger >= 4 && Math.random() < dt * 5) fx.emit("steam", ox, o.y + 22, 1, 6);
      }
      if (wetT <= 0) wetT = 0.1;
    }
    for (const s of Object.values(systems)) s.ps.manualEmitCount = s.queue.length;
  };

  // Ereignis der Regeln -> Effekt
  fx.onEvent = function (ev, world) {
    const T = GEOM.tree, Wg = GEOM.water;
    if (ev.type === "sprout") { const t = world.trees.find(t => t.id === ev.id); if (t) { fx.emit("dust", t.x + T.offX, t.y - T.ext.b + 4, 10, 18); fx.emit("leaf", t.x + T.bx, t.y + T.by, 5, 14); } }
    else if (ev.type === "landed") { fx.emit("drop", ev.x, ev.y - Wg.ext.b + 6, 16, 10); fx.decal("puddle", ev.x, ev.y - Wg.ext.b + 2, 58, 24, 2.2, 0.8); stage.shake(0.12); }
    else if (ev.type === "crouch") { const t = world.trees.find(t => t.id === ev.id); if (t) fx.emit("leaf", t.x + T.bx, t.y + T.by, 4, 16); }
    else if (ev.type === "lunge" || ev.type === "dart") { const t = world.trees.find(t => t.id === ev.id); if (t) fx.emit("dust", t.x + T.offX, t.y - T.ext.b + 4, 8, 14); }
    else if (ev.type === "dodge") fx.emit("drop", ...at(world.waters, ev.id), 6, 8);
    else if (ev.type === "drunk") {
      fx.emit("drop", ev.x, ev.y, 22, 12); fx.emit("sparkle", ev.x, ev.y + 10, 10 + 4 * ev.combo, 22);
      fx.decal("puddle", ev.x, ev.y - Wg.ext.b + 2, 74, 30, 7, 0.9); stage.shake(0.22);
    } else if (ev.type === "burned") {
      const x = ev.x + T.bx, y = ev.y + T.by;
      fx.emit("leaf", x, y, 26, 24); fx.emit("ember", x, y, 40, 30); fx.emit("spark", x, y, 30, 26); fx.emit("smoke", x, y - 10, 14, 24);
      fx.decal("burnt", ev.x + T.offX, ev.y - T.ext.b + 6, 104, 56, 1e9, 0.95); stage.shake(0.3);
    } else if (ev.type === "doused") {
      const f = world.fire, x = f.x + GEOM.fire.bx, y = f.y + GEOM.fire.by;
      fx.emit("steam", x, y, 60, 34); fx.emit("drop", x, y, 30, 20); fx.emit("smoke", x, y, 10, 20);
      fx.decal("puddle", f.x + GEOM.fire.offX, f.y - GEOM.fire.ext.b + 4, 120, 46, 1e9, 0.9); stage.shake(0.75);
    } else if (ev.type === "angry") fx.emit("steam", ...at(world.waters, ev.id), 8, 10);
    else if (ev.type === "won") { const f = world.fire; fx.emit("sparkle", f.x, f.y, 50, 70); fx.emit("ember", f.x, f.y, 60, 50); }
  };
  function at(list, id) { const e = list.find(e => e.id === id); return e ? [e.x, e.y] : [0, 9999]; }

  fx.clear = function () { for (const d of decals) { d.t = d.life = 0; d.m.setEnabled(false); } for (const s of Object.values(systems)) { s.queue.length = 0; s.ps.reset(); } };
})(globalThis.FW = globalThis.FW || {});

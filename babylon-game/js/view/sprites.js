// Die Bilder der Figuren auf der Bühne und ihre Bewegung. Liest nur den Zustand der Regeln, ändert ihn nie.
(function (FW) {
  const GEOM = FW.GEOM, CFG = FW.CFG, clamp = FW.sim.clamp, stage = FW.stage;
  const sprites = FW.sprites = {};
  const live = new Map();          // id -> Bild einer lebenden Figur
  let dying = [];                  // Bilder, die gerade verschwinden
  let emoteMats = null, ring = null, heat = null;
  const WARM = [1, 0.95, 0.84];

  function setup() {
    const scene = stage.scene, text = (ch, color) => (ctx, W) => {
      ctx.font = "900 " + W * 0.86 + "px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = W * 0.14; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round"; ctx.strokeText(ch, W / 2, W / 2 + W * 0.04); ctx.fillStyle = color; ctx.fillText(ch, W / 2, W / 2 + W * 0.04);
    };
    emoteMats = {
      bang: stage.makeMaterial(stage.canvasTex(128, 128, text("!", "#e5362a"))),
      sweat: stage.makeMaterial(stage.canvasTex(128, 128, (ctx, W) => {
        const drop = (x, y, s) => { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.bezierCurveTo(x + s * .9, y, x + s * .7, y + s, x, y + s); ctx.bezierCurveTo(x - s * .7, y + s, x - s * .9, y, x, y - s); ctx.fillStyle = "#8fd8ff"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke(); };
        drop(W * .34, W * .42, W * .2); drop(W * .7, W * .62, W * .15);
      })),
      anger: stage.makeMaterial(stage.canvasTex(128, 128, (ctx, W) => {
        ctx.lineCap = "round"; ctx.lineWidth = W * .13; ctx.strokeStyle = "#e5362a";
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.arc(W / 2 + sx * W * .34, W / 2 + sy * W * .34, W * .22, Math.atan2(-sy, -sx) - 0.8, Math.atan2(-sy, -sx) + 0.8); ctx.stroke(); }
      }))
    };
    const ringTex = (lw, color) => stage.canvasTex(256, 256, (ctx, W) => { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - lw - 14, 0, 7); ctx.stroke(); });
    ring = BABYLON.MeshBuilder.CreatePlane("ring", { width: 110, height: 52 }, scene);
    ring.material = stage.makeMaterial(ringTex(16, "#ff3b2f")); ring.alphaIndex = 650; ring.position.z = 4; ring.visibility = 0;
    heat = BABYLON.MeshBuilder.CreatePlane("heat", { width: CFG.tree.fearR * 2 + 14, height: CFG.tree.fearR * 2 + 14 }, scene);
    heat.material = stage.makeMaterial(ringTex(5, "#ffd9a0")); heat.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
    heat.alphaIndex = 620; heat.position.z = 4.2; heat.visibility = 0;
  }

  function make(e) {
    if (!emoteMats) setup();
    const d = GEOM[e.kind], s = d.size, W = d.w * s, H = d.h * s, scene = stage.scene;
    const root = new BABYLON.TransformNode("root", scene);
    const mesh = BABYLON.MeshBuilder.CreatePlane(e.kind, { width: W, height: H }, scene);
    mesh.parent = root; mesh.position.y = H / 2; mesh.material = stage.makeMaterial(d.tex);
    const shadow = BABYLON.MeshBuilder.CreatePlane("sh", { width: W * 0.8, height: W * 0.25 }, scene);
    shadow.material = stage.shadowMat; shadow.alphaIndex = 700; shadow.position.z = 4;
    return { id: e.id, kind: e.kind, d, W, H, root, mesh, shadow, emote: null, emoteKind: null, emoteA: 0,
             x: e.x, y: e.y, lift: 0, seed: Math.random() * 6.28, hop: 0, sq: 0, sqv: 0, lean: 0, state: e.state, bang: 0, out: -1, vis: 1 };
  }
  function dispose(sp) { sp.mesh.material.dispose(); sp.mesh.dispose(); sp.root.dispose(); sp.shadow.dispose(); if (sp.emote) sp.emote.dispose(); }

  function showEmote(sp, kind, dt, top) {
    if (kind && sp.emoteKind !== kind) {
      if (!sp.emote) { sp.emote = BABYLON.MeshBuilder.CreatePlane("emote", { width: 26, height: 26 }, stage.scene); sp.emote.alphaIndex = 4000; sp.emote.position.z = -1; }
      sp.emote.material = emoteMats[kind]; sp.emoteKind = kind;
    }
    sp.emoteA = clamp(sp.emoteA + (kind ? dt * 8 : -dt * 5), 0, 1);
    if (!sp.emote) return;
    if (sp.emoteA <= 0) { sp.emoteKind = null; sp.emote.visibility = 0; return; }
    const k = 0.7 + 0.3 * sp.emoteA;
    sp.emote.visibility = sp.emoteA; sp.emote.scaling.set(k, k, 1);
    sp.emote.position.x = sp.root.position.x + sp.W * 0.3; sp.emote.position.y = top + 8 + 2 * Math.sin(sp.seed + performance.now() / 120);
  }

  // Bild an die richtige Stelle setzen. sx, sy = Streckung, feet = Fußpunkt.
  function place(sp, sx, sy, vis) {
    const fx = sp.x + sp.d.offX, fy = sp.y - sp.d.ext.b;
    sp.root.position.set(fx, fy + sp.lift, 0); sp.root.scaling.set(sx, sy, 1); sp.root.rotation.z = sp.lean;
    sp.mesh.visibility = vis; sp.mesh.alphaIndex = 1000 + Math.round(CFG.fieldH / 2 - fy);
    const k = clamp(1 - sp.lift / 500, 0.25, 1);
    sp.shadow.position.x = fx; sp.shadow.position.y = fy + 4; sp.shadow.scaling.set(k * sx, k, 1); sp.shadow.visibility = vis * k;
  }
  function tint(sp, world, r, g, b) {
    const fire = world.fire, m = stage.mood, a = stage.ambient;
    const d = Math.hypot(sp.x - fire.x, sp.y - fire.y), l = sp.kind === "fire" ? 1 : clamp(m.light * (1 - d / 340), 0, 1);
    sp.mesh.material.emissiveColor.set((a.r + (WARM[0] - a.r) * l) * r, (a.g + (WARM[1] - a.g) * l) * g, (a.b + (WARM[2] - a.b) * l) * b);
  }

  function animate(sp, e, world, time, dt) {
    const speed = Math.hypot(e.vx || 0, e.vy || 0);
    sp.sqv += (-sp.sq * 190 - sp.sqv * 13) * dt; sp.sq += sp.sqv * dt;      // Feder: federt nach einem Stoß zurück auf 0
    let sx = 1 - sp.sq * 0.6, sy = 1 + sp.sq, lean = 0, vis = 1, top;
    sp.lift = 0;
    if (sp.state !== e.state) {                                             // Zustandswechsel: Stoß geben
      if (e.state === "hunt" && sp.state === "fall") { sp.sq = -0.38; sp.bang = 0.9; }
      if (e.state === "crouch") sp.sqv = -5;
      if (e.state === "lunge") sp.sqv = 6;
      if (e.state === "rest") sp.sqv = -3;
      sp.state = e.state;
    }
    if (sp.kind === "fire") {
      sx *= 1 + 0.02 * Math.sin(time * 7) - 0.03 * speed / 240; sy *= 1 + 0.035 * Math.sin(time * 9 + 1) + 0.07 * speed / 240;
      lean = -(e.vx || 0) / 240 * 0.2;
      if (sp.out >= 0) { sp.out += dt; const k = clamp(1 - sp.out / 0.8, 0, 1); sx *= 0.3 + 0.7 * k; sy *= 0.2 + 0.8 * k; vis = k; tint(sp, world, 0.45 + 0.55 * k, 0.5 + 0.5 * k, 0.6 + 0.4 * k); }
      else tint(sp, world, 1, 1, 1);
    } else if (sp.kind === "tree") {
      const grow = 1 + 0.05 * Math.min(e.grow, 5); sx *= grow; sy *= grow;
      if (e.state === "sprout") {                                           // wächst mit Überschwingen aus dem Boden
        const p = clamp(e.t / CFG.tree.sprout, 0, 1), k = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
        sx *= Math.max(0.01, k); sy *= Math.max(0.01, k);
      } else if (e.state === "lunge") { lean = -e.lx * 0.32; sp.lift = 10 * Math.sin(Math.PI * clamp(e.t / CFG.tree.lungeTime, 0, 1)); }
      else {
        const amp = Math.min(7, speed * 0.05);
        if (speed > 12) {
          const before = Math.sin(sp.hop); sp.hop += dt * (5 + speed * 0.05);
          if (before * Math.sin(sp.hop) < 0) { sp.sqv -= 0.9; FW.fx.emit("dust", sp.x + sp.d.offX, sp.y - sp.d.ext.b + 3, 2, 6); }   // Landung
        }
        sp.lift = Math.abs(Math.sin(sp.hop)) * amp;
        lean = -(e.vx || 0) / 150 * 0.13 + (e.state === "rest" ? 0.05 * Math.sin(time * 3 + sp.seed) : 0) + 0.012 * Math.sin(time * 1.7 + sp.seed);
        if (e.fear > 0.05) sp.x += Math.sin(time * 46 + sp.seed) * 1.3 * e.fear;        // zittern
      }
      tint(sp, world, 1, 1, 1);
    } else {                                                                // Wasser
      const fury = e.anger / CFG.water.angerMax, wob = 0.05 * Math.sin(time * (8 + 8 * fury) + sp.seed);
      if (e.state === "fall") {
        const p = clamp(e.t / CFG.water.fall, 0, 1);
        sp.lift = 560 * (1 - p * p); sx *= 0.86; sy *= 1.3; vis = clamp(p * 4, 0, 1);
      } else {
        sx *= 1 + wob - 0.05 * speed / 240; sy *= 1 - wob + 0.09 * speed / 240;
        lean = -(e.vx || 0) / 240 * 0.26;
      }
      tint(sp, world, 1, 1 - 0.34 * fury, 1 - 0.38 * fury);
    }
    sp.lean += (lean - sp.lean) * Math.min(1, dt * 12);
    place(sp, sx, sy, vis);
    top = sp.root.position.y + sp.H * sy;
    sp.bang = Math.max(0, sp.bang - dt);
    showEmote(sp, sp.kind === "tree" && e.fear > 0.3 && e.state !== "lunge" ? "sweat" : sp.kind === "water" && sp.bang > 0 ? "bang" : sp.kind === "water" && e.anger >= 4 ? "anger" : null, dt, top);
  }

  // Jedes Bild einmal pro Bild-Aufbau an den Zustand der Regeln anpassen
  sprites.sync = function (world, time, dt) {
    const seen = new Set(), fire = world.fire;
    for (const e of [fire, ...world.trees, ...world.waters]) {
      if (e.state === "seed" || e.state === "wait") continue;
      seen.add(e.id);
      let sp = live.get(e.id); if (!sp) { sp = make(e); live.set(e.id, sp); }
      sp.x = e.x; sp.y = e.y; animate(sp, e, world, time, dt);
    }
    for (const [id, sp] of live) if (!seen.has(id)) { live.delete(id); die(sp, "fade", 0.3); }

    dying = dying.filter(a => {
      const sp = a.sp, p = clamp((a.t += dt) / a.dur, 0, 1);
      if (a.how === "slurp") {                                              // wird zum Baum hin aufgesogen
        const t = live.get(a.by), tx = t ? t.x + GEOM.tree.bx - sp.d.offX : sp.x, ty = t ? t.y + GEOM.tree.by + sp.d.ext.b - 14 : sp.y, q = p * p;
        sp.x = a.x0 + (tx - a.x0) * q; sp.y = a.y0 + (ty - a.y0) * q; sp.lean = 0;
        place(sp, (1 - 0.8 * p) * 0.8, (1 - 0.8 * p) * 1.3, 1 - p * p * p);
      } else if (a.how === "burn") {                                        // glüht, wird schwarz und zerfällt
        const c = sp.mesh.material.emissiveColor, h = clamp(p / 0.3, 0, 1), k = clamp((p - 0.3) / 0.5, 0, 1);
        c.set(1 - 0.92 * k, 1 - 0.55 * h - 0.39 * k, 1 - 0.9 * h - 0.05 * k);
        sp.lean = 0.25 * k * Math.sin(sp.seed);
        place(sp, 1 + 0.08 * Math.sin(p * 30) * (1 - p), 1 - 0.72 * k * k, 1 - clamp((p - 0.7) / 0.3, 0, 1));
      } else place(sp, 1 - p, 1 - p, 1 - p);
      if (sp.emote) sp.emote.visibility = 0;
      if (p >= 1) { dispose(sp); return false; }
      return true;
    });

    // Warnring unter dem letzten Baum, Hitzering ums Feuer
    const last = world.lastTree !== null && live.get(world.lastTree), on = world.phase !== "won" && world.phase !== "lost";
    if (ring) {
      if (last && on) { const k = 1 + 0.12 * Math.sin(time * 9); ring.position.x = last.root.position.x; ring.position.y = last.root.position.y + 6; ring.scaling.set(k, k, 1); ring.visibility = 0.9; } else ring.visibility = 0;
      const show = on && world.phase !== "finale" && world.trees.length > 0;
      heat.position.x = fire.x + GEOM.fire.bx; heat.position.y = fire.y + GEOM.fire.by;
      heat.visibility += ((show ? 0.2 + 0.07 * Math.sin(time * 4) : 0) - heat.visibility) * Math.min(1, dt * 6);
      const hk = 1 + 0.02 * Math.sin(time * 6); heat.scaling.set(hk, hk, 1);
    }
  };

  function die(sp, how, dur, extra) { dying.push(Object.assign({ sp, how, dur, t: 0, x0: sp.x, y0: sp.y }, extra)); }

  sprites.onEvent = function (ev) {
    if (ev.type === "drunk") {
      const sp = live.get(ev.id); if (sp) { live.delete(ev.id); die(sp, "slurp", 0.28, { by: ev.by }); }
      const t = live.get(ev.by); if (t) t.sqv += 7;                          // der Baum schluckt
    } else if (ev.type === "burned") { const sp = live.get(ev.id); if (sp) { live.delete(ev.id); die(sp, "burn", 0.75); } }
    else if (ev.type === "doused") { for (const sp of live.values()) if (sp.kind === "fire") sp.out = 0; }      // das Feuer erlischt
    else if (ev.type === "dart" || ev.type === "dodge") { const sp = live.get(ev.id); if (sp) sp.sqv += 4; }
  };

  // Wo ist die Figur gerade auf dem Feld? (für Hinweise über dem Spiel)
  sprites.pos = function (id) { const sp = live.get(id); return sp ? { x: sp.root.position.x, y: sp.root.position.y, top: sp.root.position.y + sp.H } : null; };

  sprites.clear = function () {
    for (const sp of live.values()) dispose(sp); live.clear();
    for (const a of dying) dispose(a.sp); dying = [];
    if (ring) { ring.visibility = 0; heat.visibility = 0; }
  };
})(globalThis.FW = globalThis.FW || {});

// Bühne: Babylon-Engine, Kamera, Wiese, Licht, Tageszeit und die Texturen der Figuren.
(function (FW) {
  const CFG = FW.CFG, GEOM = FW.GEOM;
  const stage = FW.stage = {};
  const BORDER = 150;                                   // Wiese rund ums Spielfeld
  const GW = CFG.fieldW + BORDER * 2, GH = CFG.fieldH + BORDER * 2;
  // Tageszeit: Farbe der Wiese, Grundlicht der Figuren, Stärke des Feuerscheins
  const MOODS = stage.MOODS = [
    { name: "Morgen", ground: [1.00, 0.96, 0.88], ambient: [1.00, 1.00, 1.00], light: 0.22 },
    { name: "Mittag", ground: [1.00, 1.00, 1.00], ambient: [1.00, 1.00, 1.00], light: 0.14 },
    { name: "Abend",  ground: [0.98, 0.74, 0.60], ambient: [1.00, 0.88, 0.80], light: 0.55 },
    { name: "Nacht",  ground: [0.34, 0.42, 0.72], ambient: [0.58, 0.66, 0.95], light: 1.00 }
  ];
  const cam = { cx: 0, cy: 0, zoom: 1, tx: 0, ty: 0, tz: 1, trauma: 0, halfW: 1, halfH: 1 };
  let groundMat, lightMesh, lightMat, clouds = [];
  stage.mood = MOODS[1];

  stage.init = function (canvas) {
    stage.canvas = canvas;
    const engine = stage.engine = new BABYLON.Engine(canvas, true, { adaptToDeviceRatio: false, antialias: true, stencil: false });
    stage.applyResolution();
    const scene = stage.scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.06, 1);
    const camera = stage.camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 0, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; camera.minZ = 0.1; camera.maxZ = 50;

    // Wiese
    const ground = BABYLON.MeshBuilder.CreatePlane("ground", { width: GW, height: GH }, scene);
    ground.position.z = 5;
    groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.disableLighting = true; groundMat.emissiveColor = BABYLON.Color3.White(); groundMat.specularColor = BABYLON.Color3.Black();
    ground.material = groundMat;
    const k = Math.max(1, Math.min(3, Math.floor(Math.min(engine.getCaps().maxTextureSize || 4096, 8192) / GW)));
    const tex = new BABYLON.DynamicTexture("grass", { width: GW * k, height: GH * k }, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    drawGround(tex.getContext(), k); tex.update(true); tex.anisotropicFilteringLevel = 16;
    groundMat.diffuseTexture = tex;

    // weicher Schatten unter den Figuren
    stage.shadowMat = stage.makeMaterial(stage.canvasTex(128, 128, (ctx, W) => {
      const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      g.addColorStop(0, "rgba(0,0,0,0.34)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    }));

    // Feuerschein: heller, warmer Fleck auf der Wiese, der dem Feuer folgt
    lightMat = stage.makeMaterial(stage.canvasTex(256, 256, (ctx, W) => {
      const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
      g.addColorStop(0, "rgba(255,255,255,0.85)"); g.addColorStop(0.35, "rgba(255,255,255,0.38)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    }));
    lightMat.alphaMode = BABYLON.Engine.ALPHA_ADD; lightMat.emissiveColor = new BABYLON.Color3(1, 0.62, 0.25);
    lightMesh = BABYLON.MeshBuilder.CreatePlane("light", { width: 620, height: 620 }, scene);
    lightMesh.material = lightMat; lightMesh.position.z = 3.5; lightMesh.alphaIndex = 600; lightMesh.isPickable = false;

    // Wolkenschatten
    const cloudMat = stage.makeMaterial(stage.canvasTex(256, 256, (ctx, W) => {
      for (let i = 0; i < 9; i++) {
        const x = W * (0.3 + Math.random() * 0.4), y = W * (0.3 + Math.random() * 0.4), r = W * (0.16 + Math.random() * 0.14);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,10,20,0.16)"); g.addColorStop(1, "rgba(0,10,20,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
      }
    }));
    for (let i = 0; i < 4; i++) {
      const m = BABYLON.MeshBuilder.CreatePlane("cloud", { width: 620 + i * 90, height: 430 + i * 50 }, scene);
      m.material = cloudMat; m.alphaIndex = 5000 + i; m.isPickable = false;
      m.position.set(-GW / 2 + (i + 0.5) * GW / 4 + Math.random() * 120, (Math.random() - 0.5) * CFG.fieldH, -2);
      clouds.push({ m, v: 7 + Math.random() * 7 });
    }
  };

  // hohe Auflösung: mindestens 2x Supersampling, begrenzt auf 4096 px Breite. low = nur Bildschirmauflösung.
  stage.applyResolution = function (low) {
    let ratio = low ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    ratio = Math.min(ratio, 4096 / Math.max(1, window.innerWidth));
    stage.engine.setHardwareScalingLevel(1 / ratio); stage.lowRes = !!low;
  };
  stage.fitCamera = function () {
    const aspect = stage.engine.getRenderWidth() / stage.engine.getRenderHeight(), m = 26;
    let halfH = CFG.fieldH / 2 + m, halfW = halfH * aspect;
    if (halfW < CFG.fieldW / 2 + m) { halfW = CFG.fieldW / 2 + m; halfH = halfW / aspect; }
    cam.halfW = halfW; cam.halfH = halfH; applyCamera(0, 0);
  };
  function applyCamera(ox, oy) {
    const c = stage.camera, hw = cam.halfW / cam.zoom, hh = cam.halfH / cam.zoom;
    c.orthoLeft = cam.cx + ox - hw; c.orthoRight = cam.cx + ox + hw; c.orthoTop = cam.cy + oy + hh; c.orthoBottom = cam.cy + oy - hh;
  }
  stage.shake = amount => { cam.trauma = Math.min(1, cam.trauma + amount); };
  stage.focus = (x, y, zoom) => { cam.tx = x * (1 - 1 / zoom); cam.ty = y * (1 - 1 / zoom); cam.tz = zoom; };   // sanft auf einen Punkt zoomen
  stage.unfocus = snap => { cam.tx = 0; cam.ty = 0; cam.tz = 1; if (snap) { cam.cx = 0; cam.cy = 0; cam.zoom = 1; } };
  // Feld-Koordinaten -> Bildschirm-Pixel (für Hinweise, die als HTML über dem Spiel liegen)
  stage.toScreen = function (x, y) {
    const c = stage.camera, r = stage.canvas.getBoundingClientRect();
    return { x: r.left + (x - c.orthoLeft) / (c.orthoRight - c.orthoLeft) * r.width, y: r.top + (c.orthoTop - y) / (c.orthoTop - c.orthoBottom) * r.height };
  };

  stage.setMood = function (i) {
    const m = stage.mood = MOODS[((i % MOODS.length) + MOODS.length) % MOODS.length];
    groundMat.emissiveColor.set(m.ground[0], m.ground[1], m.ground[2]);
    stage.ambient = new BABYLON.Color3(m.ambient[0], m.ambient[1], m.ambient[2]);
    stage.scene.clearColor.set(0.05 * m.ground[0], 0.08 * m.ground[1], 0.06 * m.ground[2], 1);
  };

  // Einmal pro Bild: Kamera, Feuerschein, Wolken
  stage.frame = function (dt, time, fire, lit) {
    const e = Math.min(1, dt * 5);
    cam.cx += (cam.tx - cam.cx) * e; cam.cy += (cam.ty - cam.cy) * e; cam.zoom += (cam.tz - cam.zoom) * e;
    cam.trauma = Math.max(0, cam.trauma - dt * 1.7);
    const s = cam.trauma * cam.trauma * 16;
    applyCamera(s * Math.sin(time * 71.3), s * Math.sin(time * 93.7 + 1.3));
    if (fire) {
      const flick = 0.9 + 0.06 * Math.sin(time * 11) + 0.05 * Math.sin(time * 23 + 2);
      lightMesh.position.x = fire.x; lightMesh.position.y = fire.y; lightMesh.scaling.set(flick, flick, 1);
      lightMesh.visibility = Math.max(0, stage.mood.light * lit) * flick;
    } else lightMesh.visibility = 0;
    for (const c of clouds) { c.m.position.x += c.v * dt; if (c.m.position.x > GW / 2 + 400) { c.m.position.x = -GW / 2 - 400; c.m.position.y = (Math.random() - 0.5) * CFG.fieldH; } }
  };

  stage.makeMaterial = function (tex) {
    const m = new BABYLON.StandardMaterial("m", stage.scene);
    m.diffuseTexture = tex; tex.hasAlpha = true; m.useAlphaFromDiffuseTexture = true;
    m.emissiveColor = BABYLON.Color3.White(); m.specularColor = BABYLON.Color3.Black();
    m.disableLighting = true; m.backFaceCulling = false;
    return m;
  };
  stage.dynTex = (w, h) => new BABYLON.DynamicTexture("t", { width: Math.round(w), height: Math.round(h) }, stage.scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  function finishTex(t) { t.update(true); t.anisotropicFilteringLevel = 16; t.wrapU = t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE; return t; }
  // Kleine Textur, mit Canvas-Befehlen gezeichnet
  stage.canvasTex = function (w, h, draw) { const t = stage.dynTex(w, h); draw(t.getContext(), w, h); return finishTex(t); };

  // Texturen der drei Figuren laden: Feuer und Baum aus den eingebetteten Zeichnungen, Wasser gezeichnet
  stage.loadKinds = function () {
    return Promise.all(Object.entries(GEOM).map(([kind, def]) => new Promise(resolve => {
      if (!FW.SVG[kind]) { def.tex = stage.canvasTex(def.w * 10, def.h * 10, drawWater); resolve(); return; }
      const img = new Image();
      img.onload = () => {
        const K = Math.min(8, 4096 / Math.max(def.w, def.h)), tw = Math.round(def.w * K), th = Math.round(def.h * K);
        def.tex = stage.canvasTex(tw, th, ctx => ctx.drawImage(img, 0, 0, tw, th)); resolve();
      };
      img.src = FW.SVG[kind];
    })));
  };

  // ---------- Wiese zeichnen (fester Startwert = jedes Mal dieselbe Wiese) ----------
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function drawGround(ctx, u) {
    const W = GW * u, H = GH * u, R = rng(20260), rr = (a, b) => a + R() * (b - a);
    const fx0 = BORDER * u, fy0 = BORDER * u, fw = CFG.fieldW * u, fh = CFG.fieldH * u;      // das Spielfeld auf der Textur
    const base = ctx.createLinearGradient(0, 0, W, H); base.addColorStop(0, "#4f9d3b"); base.addColorStop(1, "#3d8a30");
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {                       // weiche helle und dunkle Flecken
      const x = rr(0, W), y = rr(0, H), r = rr(24, 80) * u, light = R() < 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, light ? "rgba(150,215,90,.20)" : "rgba(20,80,30,.20)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const blades = ["#2f7a2a", "#3a8a30", "#5fb347", "#78c256", "#8fd06a", "#276b26"];
    ctx.lineCap = "round";
    for (let i = 0; i < 62000; i++) {                     // Grashalme
      const x = rr(0, W), y = rr(0, H), len = rr(3, 8) * u, a = -Math.PI / 2 + rr(-0.5, 0.5);
      ctx.strokeStyle = blades[(R() * blades.length) | 0]; ctx.globalAlpha = rr(0.5, 0.95); ctx.lineWidth = rr(0.4, 0.9) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * .5 + rr(-1, 1) * u, y + Math.sin(a) * len * .5, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 260; i++) {                       // kleine Blumen
      const x = rr(0, W), y = rr(0, H), c = ["#fff7d6", "#ffe066", "#ffffff", "#ffb3d1"][(R() * 4) | 0];
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, rr(0.8, 1.5) * u, 0, 7); ctx.fill();
      ctx.fillStyle = "#f2a900"; ctx.beginPath(); ctx.arc(x, y, 0.4 * u, 0, 7); ctx.fill();
    }
    const stone = (x, y, w, h) => {                       // ein Stein: Schatten, unregelmäßiger Körper, Licht, Risse
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(x + w * .12, y + h * .38, w * .62, h * .3, 0, 0, 7); ctx.fill();
      const n = 10, pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283, j = rr(0.84, 1.08); pts.push([x + Math.cos(a) * w * .5 * j, y + Math.sin(a) * h * .5 * j]); }
      ctx.beginPath(); pts.forEach((p, k) => { const q = pts[(k + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; k ? ctx.quadraticCurveTo(p[0], p[1], mx, my) : ctx.moveTo(mx, my); });
      ctx.closePath();
      const g = ctx.createRadialGradient(x - w * .22, y - h * .28, 0, x, y, w * .65);
      g.addColorStop(0, "#d3d5d9"); g.addColorStop(.55, "#9a9da4"); g.addColorStop(1, "#6a6d74");
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = .5 * u; ctx.strokeStyle = "rgba(50,52,58,.8)"; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = .6 * u; ctx.beginPath(); ctx.arc(x, y, w * .36, 3.5, 4.5); ctx.stroke();
      ctx.strokeStyle = "rgba(60,62,68,.5)"; ctx.lineWidth = .3 * u; ctx.beginPath(); ctx.moveTo(x + w * .05, y - h * .1); ctx.lineTo(x + w * .18, y + h * .12); ctx.stroke();
    };
    for (let i = 0; i < 26; i++) {                        // einzelne Steine auf dem Feld
      const w = rr(10, 22) * u; stone(fx0 + rr(30, CFG.fieldW - 30) * u, fy0 + rr(30, CFG.fieldH - 30) * u, w, w * rr(0.6, 0.8));
    }
    for (let c = 0; c < 16; c++) {                        // Kiesel-Gruppen
      const cx = fx0 + rr(30, CFG.fieldW - 30) * u, cy = fy0 + rr(30, CFG.fieldH - 30) * u;
      for (let k = 0, m = 3 + ((R() * 4) | 0); k < m; k++) { const w = rr(4, 8) * u; stone(cx + rr(-9, 9) * u, cy + rr(-6, 6) * u, w, w * rr(0.6, 0.85)); }
    }
    // außerhalb des Feldes: dunkleres, hohes Gras mit Büschen
    ctx.fillStyle = "rgba(4,34,14,.46)"; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(fx0, fy0, fw, fh); ctx.fill("evenodd");
    const inField = (x, y) => x > fx0 - 14 * u && x < fx0 + fw + 14 * u && y > fy0 - 14 * u && y < fy0 + fh + 14 * u;
    for (let i = 0; i < 150; i++) {
      const x = rr(0, W), y = rr(0, H); if (inField(x, y)) continue;
      const r = rr(12, 26) * u;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x + r * .15, y + r * .5, r * 1.1, r * .45, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 7; k++) {
        const bx = x + rr(-0.6, 0.6) * r, by = y + rr(-0.45, 0.35) * r, br = r * rr(0.45, 0.7);
        const g = ctx.createRadialGradient(bx - br * .3, by - br * .35, 0, bx, by, br);
        g.addColorStop(0, "#3f9a3a"); g.addColorStop(1, "#1d5a24"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
      }
    }
    // Rand des Spielfelds: eine Reihe Steine
    const rim = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / (30 * u));
      for (let i = 0; i <= n; i++) {
        const t = i / n, w = rr(15, 27) * u;
        stone(x0 + (x1 - x0) * t + rr(-4, 4) * u, y0 + (y1 - y0) * t + rr(-4, 4) * u, w, w * rr(0.62, 0.82));
      }
    };
    const o = 9 * u;
    rim(fx0 - o, fy0 - o, fx0 + fw + o, fy0 - o); rim(fx0 - o, fy0 + fh + o, fx0 + fw + o, fy0 + fh + o);
    rim(fx0 - o, fy0 - o, fx0 - o, fy0 + fh + o); rim(fx0 + fw + o, fy0 - o, fx0 + fw + o, fy0 + fh + o);
  }

  // Wassertropfen mit bösem Gesicht, in hoher Auflösung gezeichnet
  function drawWater(ctx, W, H) {
    const sx = W / 48, sy = H / 60; ctx.save(); ctx.scale(sx, sy);
    ctx.beginPath(); ctx.moveTo(24, 2);
    ctx.bezierCurveTo(30, 16, 45, 26, 45, 38); ctx.bezierCurveTo(45, 50, 36, 58, 24, 58);
    ctx.bezierCurveTo(12, 58, 3, 50, 3, 38); ctx.bezierCurveTo(3, 26, 18, 16, 24, 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, 4, 0, 58); g.addColorStop(0, "#7fd6ff"); g.addColorStop(1, "#1c7be0");
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = "#0b4fa8"; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(14, 34, 3, 7, -0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = "#08224a"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(14, 31); ctx.lineTo(21, 35); ctx.moveTo(34, 31); ctx.lineTo(27, 35); ctx.stroke();   // Augenbrauen
    ctx.fillStyle = "#08224a"; ctx.beginPath(); ctx.arc(18, 39, 2.4, 0, 7); ctx.arc(30, 39, 2.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(24, 49, 5, 3.6, 5.8); ctx.stroke(); ctx.restore();
  }
  stage.drawWater = drawWater;
})(globalThis.FW = globalThis.FW || {});

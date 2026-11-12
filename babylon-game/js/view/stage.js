// Bühne: Babylon-Engine, Kamera, Wiese und die Texturen der Figuren.
(function (FW) {
  const CFG = FW.CFG, GEOM = FW.GEOM;
  const stage = FW.stage = {};

  stage.init = function (canvas) {
    const engine = stage.engine = new BABYLON.Engine(canvas, true, { adaptToDeviceRatio: false, antialias: true, stencil: false });
    stage.applyResolution();
    const scene = stage.scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.078, 0.086, 0.11, 1);
    const camera = stage.camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 0, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA; camera.minZ = 0.1; camera.maxZ = 50;

    const ground = BABYLON.MeshBuilder.CreatePlane("stage", { width: CFG.fieldW, height: CFG.fieldH }, scene);
    ground.position.z = 5;
    const mat = new BABYLON.StandardMaterial("stageMat", scene);
    mat.disableLighting = true; mat.emissiveColor = BABYLON.Color3.White(); mat.specularColor = BABYLON.Color3.Black();
    ground.material = mat;
    const k = Math.min(6, Math.floor(Math.min(engine.getCaps().maxTextureSize || 4096, 8192) / CFG.fieldW));
    const tex = new BABYLON.DynamicTexture("grass", { width: CFG.fieldW * k, height: CFG.fieldH * k }, scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    drawGrass(tex.getContext(), CFG.fieldW * k, CFG.fieldH * k); tex.update(true); tex.anisotropicFilteringLevel = 16;
    mat.diffuseTexture = tex;

    const sh = stage.dynTex(256, 256), ctx = sh.getContext(), g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,0.30)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); sh.update();
    stage.shadowMat = stage.makeMaterial(sh);
  };

  // hohe Auflösung: mindestens 2x Supersampling, begrenzt auf 4096 px Breite
  stage.applyResolution = function () {
    let ratio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    ratio = Math.min(ratio, 4096 / Math.max(1, window.innerWidth));
    stage.engine.setHardwareScalingLevel(1 / ratio);
  };
  stage.fitCamera = function () {
    const engine = stage.engine, camera = stage.camera, aspect = engine.getRenderWidth() / engine.getRenderHeight();
    let halfH = CFG.fieldH / 2, halfW = halfH * aspect;
    if (halfW < CFG.fieldW / 2) { halfW = CFG.fieldW / 2; halfH = halfW / aspect; }
    const m = 1.04;
    camera.orthoLeft = -halfW * m; camera.orthoRight = halfW * m; camera.orthoTop = halfH * m; camera.orthoBottom = -halfH * m;
  };
  stage.makeMaterial = function (tex) {
    const m = new BABYLON.StandardMaterial("m", stage.scene);
    m.diffuseTexture = tex; tex.hasAlpha = true; m.useAlphaFromDiffuseTexture = true;
    m.emissiveColor = BABYLON.Color3.White(); m.specularColor = BABYLON.Color3.Black();
    m.disableLighting = true; m.backFaceCulling = false;
    return m;
  };
  stage.dynTex = (w, h) => new BABYLON.DynamicTexture("t", { width: w, height: h }, stage.scene, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  function finishTex(t) { t.update(true); t.anisotropicFilteringLevel = 16; t.wrapU = t.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE; return t; }

  // Texturen der drei Figuren laden: Feuer und Baum aus den eingebetteten Zeichnungen, Wasser gezeichnet
  stage.loadKinds = function () {
    return Promise.all(Object.entries(GEOM).map(([kind, def]) => new Promise(resolve => {
      const done = tex => { def.mat = stage.makeMaterial(tex); resolve(); };
      if (!FW.SVG[kind]) { const K = 10, tex = stage.dynTex(def.w * K, def.h * K); drawWater(tex.getContext(), def.w * K, def.h * K); done(finishTex(tex)); return; }
      const img = new Image();
      img.onload = () => {
        const K = Math.min(8, 4096 / Math.max(def.w, def.h)), tw = Math.round(def.w * K), th = Math.round(def.h * K);
        const tex = stage.dynTex(tw, th); tex.getContext().drawImage(img, 0, 0, tw, th); done(finishTex(tex));
      };
      img.src = FW.SVG[kind];
    })));
  };

  // Gras-Grundkarte mit Steinen, einmal in hoher Auflösung gezeichnet (fester Seed = gleiche Karte jedes Mal)
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function drawGrass(ctx, W, H) {
    const u = W / CFG.fieldW, R = rng(20260), rr = (a, b) => a + R() * (b - a);
    const base = ctx.createLinearGradient(0, 0, W, H); base.addColorStop(0, "#4f9d3b"); base.addColorStop(1, "#3d8a30");
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {                       // weiche helle und dunkle Flecken
      const x = rr(0, W), y = rr(0, H), r = rr(20, 70) * u, light = R() < 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, light ? "rgba(150,215,90,.20)" : "rgba(20,80,30,.20)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const blades = ["#2f7a2a", "#3a8a30", "#5fb347", "#78c256", "#8fd06a", "#276b26"];
    ctx.lineCap = "round";
    for (let i = 0; i < 16000; i++) {                     // Grashalme
      const x = rr(0, W), y = rr(0, H), len = rr(2.5, 7) * u, a = -Math.PI / 2 + rr(-0.5, 0.5);
      ctx.strokeStyle = blades[(R() * blades.length) | 0]; ctx.globalAlpha = rr(0.5, 0.95); ctx.lineWidth = rr(0.35, 0.8) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * .5 + rr(-1, 1) * u, y + Math.sin(a) * len * .5, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 70; i++) {                        // kleine Blumen
      const x = rr(0, W), y = rr(0, H), c = ["#fff7d6", "#ffe066", "#ffffff", "#ffb3d1"][(R() * 4) | 0];
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, rr(0.7, 1.3) * u, 0, 7); ctx.fill();
      ctx.fillStyle = "#f2a900"; ctx.beginPath(); ctx.arc(x, y, 0.35 * u, 0, 7); ctx.fill();
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
    for (let i = 0; i < 16; i++) {                        // einzelne größere Steine
      const w = rr(11, 24) * u; stone(rr(20, CFG.fieldW - 20) * u, rr(20, CFG.fieldH - 20) * u, w, w * rr(0.6, 0.8));
    }
    for (let c = 0; c < 9; c++) {                         // Kiesel-Gruppen
      const cx = rr(20, CFG.fieldW - 20) * u, cy = rr(20, CFG.fieldH - 20) * u;
      for (let k = 0, m = 3 + ((R() * 4) | 0); k < m; k++) { const w = rr(4, 8) * u; stone(cx + rr(-9, 9) * u, cy + rr(-6, 6) * u, w, w * rr(0.6, 0.85)); }
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .85);   // dezente Randabdunkelung
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,30,10,.30)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
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

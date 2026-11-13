// Maße der Figuren und alle Stellschrauben des Spiels.
(function (FW) {
  // Bildgröße (w, h), Drehpunkt (cx, cy) wie in Scratch, Anzeigegröße (size) und Trefferkreis (body)
  const GEOM = FW.GEOM = {
    fire:  { w: 175.9347,  h: 224.77259, cx: 66.53558, cy: 105.2436,  size: 0.5, body: { dx: 0, dy: -4, r: 24 } },
    tree:  { w: 146.34109, h: 206.43249, cx: 76.54109, cy: 125.57491, size: 0.5, body: { dx: 0, dy: 26, r: 26 } },
    water: { w: 48,        h: 60,        cx: 24,       cy: 30,        size: 1,   body: { dx: 0, dy: -4, r: 17 } }
  };
  for (const d of Object.values(GEOM)) {
    const s = d.size;
    d.offX = (d.w / 2 - d.cx) * s; d.offY = -(d.h / 2 - d.cy) * s;                 // Bildmitte relativ zum Drehpunkt
    d.ext = { l: d.cx * s, r: (d.w - d.cx) * s, t: d.cy * s, b: (d.h - d.cy) * s };  // Abstand der Bildränder vom Drehpunkt
    d.bx = d.offX + d.body.dx; d.by = d.offY + d.body.dy;                          // Mitte des Trefferkreises relativ zum Drehpunkt
  }

  // Alle Strecken in Feld-Einheiten, alle Zeiten in Sekunden, Geschwindigkeiten in Einheiten pro Sekunde.
  FW.CFG = {
    fieldW: 960, fieldH: 540,
    fire: { speed: 240, accel: 3000 },
    tree: {
      speed: 150, accel: 900,
      fearR: 120, fearFull: 60,            // Angst vor dem Feuer: beginnt bei fearR, voll ab fearFull
      lungeTrigger: 140, crouch: 0.15, lungeSpeed: 300, lungeTime: 0.4, rest: 1.5,
      sprout: 0.6, replan: 0.1, look: 70, sep: 80,
      dartNear: 95, dartSpeed: 1.35, dartTime: 0.28, dartCooldown: 1.3,
      spawnFire: 180, spawnApart: 130
    },
    water: {
      accel: 520,                          // kleiner als beim Feuer: Wasser rutscht in Kurven
      cautionR: 210, cautionFull: 140,     // Vorsicht vor Bäumen
      lustNear: 100, lustFar: 220, lustMin: 0.2,   // nah am Feuer sinkt die Vorsicht auf lustMin
      angerStep: 6, angerMax: 10, angerSpeed: 0.04, angerCaution: 0.1,
      fall: 0.9, rainStart: 1.2, rainGap: 0.35, landFire: 250, landTree: 150, landApart: 90, wake: 0.3,
      look: 70, sep: 60, roleEvery: 0.5, dodgeTime: 0.35, dodgeSpeed: 1.3
    },
    score: { drunk: 100, comboWindow: 4, comboMax: 5, finaleTree: 50, parBase: 20, parPerWater: 8, perSecond: 10, flawless: 250 },
    lives: 3, maxLives: 5, extraLifeEvery: 5
  };

  // speed: Anteil der Feuer-Geschwindigkeit · replan: Reaktionszeit · roles: 1 alle jagen, 2 einer schneidet den Weg ab,
  // 3 die übrigen kreisen ein · dodge: Chance, einem Sprung auszuweichen · anger: wie schnell die Wut wächst
  // lustNear, lustFar: ab welcher Nähe zum Feuer das Wasser die Bäume vergisst (ohne Angabe gilt CFG.water)
  const FIXED = [null,
    { trees: 3, waters: 1, speed: 0.70, replan: 0.45, roles: 1, dodge: 0,    anger: 1.0, lustNear: 150, lustFar: 300 },   // zum Lernen: Wasser wird früher leichtsinnig
    { trees: 3, waters: 2, speed: 0.75, replan: 0.40, roles: 1, dodge: 0,    anger: 1.0, lustNear: 125, lustFar: 260 },
    { trees: 4, waters: 3, speed: 0.80, replan: 0.35, roles: 2, dodge: 0,    anger: 1.1 },
    { trees: 4, waters: 4, speed: 0.85, replan: 0.30, roles: 3, dodge: 0,    anger: 1.2 },
    { trees: 3, waters: 4, speed: 0.88, replan: 0.27, roles: 3, dodge: 0,    anger: 1.3 },
    { trees: 4, waters: 5, speed: 0.90, replan: 0.24, roles: 3, dodge: 0.35, anger: 1.4 }
  ];
  FW.levelDef = function (n) {
    n = Math.max(1, n | 0);
    const k = n - 6;
    const d = n <= 6 ? Object.assign({}, FIXED[n]) : {
      trees: 3 + (n - 7) % 3, waters: Math.min(10, 5 + ((n - 7) >> 1)),
      speed: Math.min(1, 0.90 + 0.02 * k), replan: Math.max(0.15, 0.24 - 0.02 * k),
      roles: 3, dodge: Math.min(0.7, 0.35 + 0.05 * k), anger: 1.4 + 0.1 * k
    };
    if (!d.lustNear) { d.lustNear = FW.CFG.water.lustNear; d.lustFar = FW.CFG.water.lustFar; }
    d.level = n; d.par = FW.CFG.score.parBase + FW.CFG.score.parPerWater * d.waters;
    return d;
  };
})(globalThis.FW = globalThis.FW || {});

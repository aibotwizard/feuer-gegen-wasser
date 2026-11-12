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

  FW.CFG = {
    fieldW: 480, fieldH: 360,
    trees: 4, waters: 3, fireSpeed: 200, treeSpeed: 160, fleeDistance: 170, waterFear: 130,
    waterBase: 80, waterPerWin: 7, waterMax: 150, grace: 1.5, endDelay: 2.6
  };
})(globalThis.FW = globalThis.FW || {});

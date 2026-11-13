// Finger-Steuerung für Tablet und Handy: Finger auf die Wiese legen und ziehen, das Feuer läuft in diese Richtung.
// Die Rechnung (stick) braucht keine Seite und läuft auch in Node.
(function (FW) {
  const touch = FW.touch = { on: false };
  const R = touch.R = 50, DEAD = touch.DEAD = 8, FULL = touch.FULL = 30;   // Ringradius, toter Bereich, volle Fahrt ab hier (CSS-Pixel)

  // Mitte des Rings o, Finger p (Bildschirm-Pixel) -> neue Mitte und Richtung mit Länge 0 bis 1.
  // Zieht der Finger über den Rand hinaus, wandert der Ring mit. my zeigt nach oben wie auf der Wiese.
  touch.stick = function (o, p) {
    let dx = p.x - o.x, dy = p.y - o.y, len = Math.hypot(dx, dy);
    if (len > R) { o = { x: p.x - dx / len * R, y: p.y - dy / len * R }; dx = p.x - o.x; dy = p.y - o.y; len = R; }
    if (len <= DEAD) return { o, mx: 0, my: 0 };
    const m = Math.min(1, (len - DEAD) / (FULL - DEAD));
    return { o, mx: dx / len * m, my: -dy / len * m };
  };

  let id = null, origin = null, vec = { mx: 0, my: 0 }, ring = null, knob = null, opts = null;
  touch.vector = () => vec;

  // Finger- oder Tastatur-Modus: bestimmt, welche Texte und Knöpfe die Seite zeigt
  touch.setMode = function (on) { if (touch.on === on) return; touch.on = on; document.body.classList.toggle("touch", on); };

  function place(p) {
    const s = touch.stick(origin, p); origin = s.o; vec = { mx: s.mx, my: s.my };
    ring.style.transform = `translate(${origin.x}px, ${origin.y}px)`;
    knob.style.transform = `translate(${p.x - origin.x}px, ${p.y - origin.y}px)`;
  }
  // Ring loslassen: das Feuer bleibt stehen
  touch.release = function () {
    if (id === null) return;
    id = null; origin = null; vec = { mx: 0, my: 0 }; ring.classList.remove("on");
  };

  // o.playing(): läuft gerade ein Level? o.tap(): ein Tipper außerhalb des Spiels (starten, weiter). o.wake(): erste Berührung (Ton freischalten).
  touch.init = function (o) {
    opts = o; ring = document.getElementById("stick"); knob = document.getElementById("knob");
    touch.setMode(!!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
    const fingers = e => e.pointerType !== "mouse";
    window.addEventListener("pointerdown", e => {
      if (!fingers(e)) return;
      touch.setMode(true); opts.wake();
      if (e.target.closest && e.target.closest("button")) return;       // Knöpfe erledigen das selbst
      if (!opts.playing()) opts.tap();
      if (opts.playing() && id === null) {                              // derselbe Finger steuert gleich weiter
        id = e.pointerId; origin = { x: e.clientX, y: e.clientY }; ring.classList.add("on"); place(origin);
      }
    });
    window.addEventListener("pointermove", e => { if (e.pointerId === id) place({ x: e.clientX, y: e.clientY }); });
    const up = e => { if (fingers(e)) opts.wake(); if (e.pointerId === id) touch.release(); };   // Safari gibt den Ton erst beim Loslassen frei
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    // Safari: Zoomen mit zwei Fingern und das Menü bei langem Druck abschalten
    for (const type of ["gesturestart", "contextmenu"]) window.addEventListener(type, e => { if (touch.on) e.preventDefault(); });
  };
})(globalThis.FW = globalThis.FW || {});

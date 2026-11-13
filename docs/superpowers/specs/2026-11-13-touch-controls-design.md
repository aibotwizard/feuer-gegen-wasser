# Feuer gegen Wasser: touch control for tablets and phones

Date: 2026-11-13
Scope: `babylon-game/` only. The rules in `js/sim/` are not changed.
Status: approved on 2026-11-13 ("Drag anywhere", "Yes, build it").

## 1. Goal

The game is playable from start to game over on a tablet or phone with fingers only. Keyboard play on a computer stays exactly as it is. There is no jump on touch: stones are walked around.

## 2. Steering: drag anywhere

- A finger or pen that lands on the meadow during play becomes the centre of a ring. Dragging moves a knob inside the ring, and the fire runs in the drag direction. Lifting the finger stops the fire.
- The ring has a radius of 50 CSS pixels. The first 8 pixels are a dead zone. Speed grows with the drag and is full at 30 pixels.
- If the finger goes past the edge of the ring, the ring follows the finger, so reversing direction never needs more than a ring's width.
- Only the first finger steers. More fingers are ignored. The mouse does not steer.
- The stick is released whenever the game is not in play (pause, banner, game over).
- The stick maths is one pure function, `FW.touch.stick(origin, point)`, so it is tested in Node like the rules.

## 3. Everything Space did, by tap

| Situation | Tap does |
|---|---|
| Title screen, game over screen | starts a run |
| "Level geschafft" / "Gelöscht" banner | continues, after the same 0.7 s guard as Space |
| Pause screen, outside the buttons | resumes |

- If the tap puts the game into play, the same finger starts steering without being lifted.
- A pause button sits top right during play. The pause screen gets three buttons: Weiter, Level neu starten, Ton an/aus.
- The game also pauses when the page is hidden (switching apps or tabs).
- Fullscreen has no touch control.

## 4. Touch mode

The page is in touch mode when the main pointer is coarse at load, and from the first finger or pen contact. A key press switches back to keyboard mode. The mode is the class `touch` on `<body>`.

In touch mode:

- the key hints (bar at the bottom, title, pause screen) are hidden;
- the prompts read "Tippen zum Starten", "Tippen: weiter", "Tippen: noch mal";
- the title says "Leg einen Finger auf die Wiese und zieh";
- the stone sentence ends after "dir und dem Wasser" (no jumping);
- the pause button and the pause screen buttons are shown.

## 5. Layout

- The canvas fills the visible page (`position: fixed; inset: 0`), and the page uses the whole screen including notch areas (`viewport-fit=cover`), with controls kept out of them.
- The page does not scroll, zoom, select text or show the long-press menu under a finger.
- Top bar: below 760 px width the rules pill is hidden and the pills get smaller. Below 520 px they get smaller again.
- Title screen: compact on screens under 520 px height (phone landscape) and under 640 px width (phone portrait), so that everything fits without scrolling.
- Portrait works: the meadow is fitted to the width. The title screen shows "Dreh dein Gerät quer" in touch mode because the figures get small.

## 6. Speed

On a device with a coarse main pointer the meadow texture is drawn at most at 2x instead of 3x. The existing automatic drop to lower resolution stays.

## 7. Files

| File | Change |
|---|---|
| `js/view/touch.js` (new) | stick maths, finger handling, touch mode, the ring |
| `js/main.js` | adds the stick to the keyboard direction; tap, pause button and pause screen buttons; prompt wording |
| `js/view/hud.js` | pause button visibility, label of the Ton button |
| `js/view/stage.js` | smaller meadow texture on coarse pointers |
| `index.html` | viewport, styles for small screens, touch and keyboard wording, pause button, pause screen buttons, ring |
| `tools/test.mjs` | tests for the stick maths |

## 8. Checks

- `node tools/test.mjs` passes, including the new stick tests.
- In the browser with `?auto`, at 844x390, 390x844 and 1024x768, with simulated fingers: a drag moves the fire in the drag direction, lifting stops it, a tap starts a run, the pause button pauses, and the three pause buttons work.
- Keyboard play at desktop size still works and shows the keyboard wording.

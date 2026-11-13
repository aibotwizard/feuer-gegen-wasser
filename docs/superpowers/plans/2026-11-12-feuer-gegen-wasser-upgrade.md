# Feuer gegen Wasser Upgrade Implementation Plan

**Goal:** Turn the Babylon HTML version of "Feuer gegen Wasser" into a levelled game with smarter bots, effects and sound, keeping the core rules and the hand-drawn characters.

**Architecture:** The rules live in plain JavaScript under `babylon-game/js/sim/` and run both in the browser and in Node. They advance in fixed steps of 1/120 s with a seeded random generator and report what happened as events. Display, sound and screens under `babylon-game/js/view/` only react to those events.

**Tech stack:** Babylon.js 7.30 (local file), plain script files loaded in order, no modules, no build step. Node 24 for the rule tests and the balance script.

**Design:** `docs/superpowers/specs/2026-11-12-feuer-gegen-wasser-upgrade-design.md`

## Global constraints

- Only `babylon-game/`, `docs/` and repository housekeeping files change. The `*.sb3` files are never modified.
- Core rules are fixed: fire burns trees, trees kill water, water kills fire; win when the fire is the last one left; lose when doused or when the last tree burns while water lives.
- The fire and tree drawings and the drawn water drop stay as they are.
- German UI. Keyboard only. No network access, no new dependencies.
- Every file wraps its code in `(function (FW) { ... })(globalThis.FW = globalThis.FW || {});` so files share one namespace and nothing else.
- `js/sim/*` never touches `BABYLON`, `document` or `window`.
- One commit per phase.

## Shared interfaces

- `FW.GEOM[kind]`: `{ w, h, cx, cy, size, body: { dx, dy, r }, offX, offY, ext: { l, r, t, b } }` for `fire`, `tree`, `water`.
- `FW.CFG`: all tuning numbers. `FW.levelDef(n)`: the settings of level `n`.
- `FW.sim.create({ level, seed, flawless })` returns a plain-data world. `FW.sim.step(world, { mx, my })` advances one fixed step. `world.events` is the list of events since it was last emptied.
- Events: `sprout`, `rainStart`, `landed`, `crouch`, `lunge`, `drunk`, `burned`, `doused`, `lastTree`, `lastTreeClear`, `finale`, `angry`, `dodge`, `won`, `lost`.
- World phases: `rain`, `main`, `finale`, `won`, `lost`.

## Tasks

### Phase 0: Safety net

- [x] `git init`, `.gitignore` for `.DS_Store` and `.playwright-mcp/`, baseline commit of the project as it is.
- [x] Move the two embedded drawings out of `index.html` into `js/assets.js` with a script, byte for byte.
- [x] Split the remaining code into `js/config.js`, `js/sim/world.js`, `js/sim/tree-ai.js`, `js/sim/water-ai.js`, `js/view/stage.js`, `js/view/sprites.js`, `js/main.js`. Behaviour unchanged. Fixed time step and seeded random generator.
- [x] `tools/balance.mjs` with the three scripted players of the design's section 2. `tools/test.mjs` with tests for the five core rules and for staying inside the field.
- [x] Check: `node tools/test.mjs` passes. `node tools/balance.mjs` reproduces the section 2 table within 3 points. The page loads without console errors and looks as before.
- [x] Commit.

### Phase 1: Rules and feel

- [x] Field 960 × 540, new speeds, velocity and acceleration for all characters.
- [x] Rain-in for water, sprouting for trees, world phases, level time.
- [x] Gradual tree fear, crouch and lunge, water caution that fades near the fire, water anger.
- [x] Last-tree warning, finale, scoring inside the rules (combo, finale points, time bonus, stars).
- [x] Tests for each new rule. Balance script gets the `still` and stuck-round checks.
- [x] Check: the player who never moves loses at least 95% on levels 1 to 10. At least 99% of rounds are decided within 90 s.
- [x] Commit.

### Phase 2: Bot intelligence

- [x] `js/sim/steering.js`: candidate-direction steering with wall handling and aim-ahead.
- [x] Tree brain: target sharing, aim-ahead, two-sided approach, panic with side darts.
- [x] Water brain: pack roles (chase, cut off, surround), slide, sidestep, reaction time by level.
- [x] Balance script gets the luring player (looks a short time ahead by simulating) and the level sweep.
- [x] Check: all balance targets of the design's section 9 on levels 1 to 10, or a documented reason where a target was changed.
- [x] Commit.

### Phase 3: Levels and flow

- [x] `js/main.js`: run state (level, lives, score), screens (title, playing, level won, life lost, game over, pause), keys (Space/Enter, P/Esc, R, M, F).
- [x] `js/view/hud.js`: top bar with level, lives, score, counters and rule triangle; banners; title and game-over screens; level 1 hint; last-tree warning.
- [x] Saved best level and score; `fireWaterWins` keeps counting.
- [x] Check in the browser: a full run from title to game over with the keyboard alone, no console errors.
- [x] Commit.

### Phase 4: Graphics

- [x] Larger ground with field rim; time of day by level; fire light; cloud shadows; pollen.
- [x] `js/view/sprites.js`: lean, hop, squash and stretch, sprout, fall, head signs, depth order.
- [x] `js/view/fx.js`: particle types, ground marks, kill and death sequences, shake, freeze, zoom.
- [x] Check in the browser: every event of the design's section 7 has its effect; frame rate on level 10.
- [x] Commit.

### Phase 5: Sound

- [x] `js/view/audio.js`: generated sounds for every event, fire crackle, meadow background, mute key.
- [x] Check in the browser: no console errors, sounds start after the first key press, mute works.
- [x] Commit.

### Phase 6: Tuning

- [x] Balance sweeps, fix cheap winning tricks, performance pass, final browser run through levels.
- [x] Update the design document where final values differ from the starting values.
- [x] Commit.

# Feuer gegen Wasser: upgrade plan for the Babylon HTML version

Date: 2026-11-12
Scope: `babylon-game/` only. The Scratch files (`*.sb3`) are not touched.
Status: approved on 2026-11-12 and built. Section 13 records what differs from this design.

## 1. What stays the same

This is the core of the game and none of it changes:

- You are the fire. Fire burns trees, trees kill water, water kills fire.
- You win a round when you are the last one left.
- You lose when water touches you, or when you burn the last tree while water is still alive.
- The hand-drawn fire and tree from the Scratch project and the angry blue drop stay the characters.
- German texts, keyboard control (arrow keys or WASD), Babylon.js 7.30 from the local file, no build step, no internet needed.

## 2. What is wrong today

I copied the current rules into a script that plays rounds without graphics and ran 3,000 rounds for each of three simple scripted players. These are bots, not people, so read the numbers as indications.

| Scripted player | Won | Doused by water | Burned the last tree | Still undecided after 60 s |
|---|---|---|---|---|
| Never moves | 0% | 41% | 0% | 59% |
| Runs from water, then burns trees | 34% (median 6.0 s) | 17% | 0% | 49% |
| Always chases the nearest tree | 17% (median 4.6 s) | 39% | 44% | 0% |

What the numbers and the code show:

1. **Rounds are over in seconds.** A won round takes about 5 to 6 seconds. Trees move at 160 and water at 80. In the rounds where the trees reach the water, all of it is dead about half a second after the start pause, without the player doing anything.
2. **Rounds get stuck.** Trees flee whenever the fire is within 170 units, on a field of only 480 × 360. With the fire in the middle, that circle is 53% of the field. Water that is chasing you is inside that circle, so the trees do not dare to reach it: for the two players that do not chase trees, 95% of water kills happened more than about 170 units away from the fire. The player's own presence protects the enemy.
3. **The obvious way to play loses.** Chasing trees loses 83% of rounds. Half of those losses come from burning the last tree, a rule the game only mentions in the small hint text. Many of the rest come from running into water that is still frozen during the 1.5 s start pause.
4. **The bots are one `if` each.** Every tree picks the same nearest water and walks straight at it. Water walks straight at the fire. In corners they jitter against the wall.
5. **Nothing grows.** Every round is 4 trees against 3 waters. Only the water speed rises, and it stops rising after 10 wins.
6. **Nothing reacts.** A death is a 0.35 s shrink. There is no sound, no effect, no warning.
7. **No flow.** The game restarts itself after 2.6 s. There is no title, pause or restart key.

## 3. Decisions already made

| Question | Answer |
|---|---|
| How far may the rules change? | Core plus levels: same rules, rebalanced, with levels, lives, score and stars. No new field elements. |
| Graphics direction? | Keep the drawings and add life: animation, particles, glow, burn marks, screen shake, sound. |
| Who plays, on what? | Older kids or adults on a computer: faster difficulty ramp, harder bots, keyboard only. |

## 4. Approach

Three ways to do this were considered.

- **A. Polish in place.** Keep the single file and the `if`-based bots, tune the numbers, add particles and sound. Quick, but it cannot reliably remove the stuck rounds, and there is no way to check the balance except by feel.
- **B. Separate rules from display, new steering bots, effects layer (chosen).** The rules move into plain JavaScript that also runs without a browser, so a script can play thousands of rounds and report win rates and round lengths. The bots get a proper steering system. Graphics and sound listen to events from the rules. More work than A, but balance is measured instead of guessed, and each part can be changed without breaking the others.
- **C. Rewrite in 3D or another engine.** Rejected. Babylon is already there and is enough, and the drawings are meant to stay.

## 5. Gameplay design

### 5.1 The three roles

The rules stay, but each side gets a clear character so the triangle makes sense when you watch it.

- **Trees are slow, timid guards with a deadly lunge.** They are slower than water, so they cannot simply run it down. When a water comes close, a tree crouches briefly and lunges. A tree that catches a water drinks it and grows a little (visual only).
- **Water is a fast, slippery pack hunter.** It hunts the fire, slides wide when you turn sharply, and keeps away from trees. The closer it gets to you, the less careful it is. The longer a level lasts, the angrier and more reckless it gets.
- **The fire is fast and fragile.** The trees are your only weapon, but they are afraid of you and die when you touch them.

The central skill is the one the first hint text of the game already described: *Lock das Wasser zu einem Baum.* You run past a tree so that the water following you comes within the tree's lunge. When all water is gone, the trees panic and you hunt them down to win.

### 5.2 Changes that fix the measured problems

| Problem | Change |
|---|---|
| Trees kill all water on their own | Trees move slower than water. They kill by lunging, by closing in from two sides, or because the player lured water to them. |
| The fire shields the water | The fear radius shrinks from 170 to about 120 and becomes gradual: weak at the edge, strong only up close. A lunging tree ignores the fire, so it can also jump into you and burn. Its lunge trigger range (about 140) is larger than its fear radius. |
| Rounds get stuck | Water gets angrier over time (faster, less careful), so a standoff always ends. Bots steer around corners instead of sticking to them. |
| Frozen water kills at the start | Water falls from the sky one drop at a time, with a growing shadow on the ground as a warning, and is harmless until it lands. |
| Burning the last tree by accident | When one tree is left and water still lives, that tree gets a pulsing ring and "Letzter Baum!", and the tree counter flashes. |
| The field is cramped | The field grows from 480 × 360 to 960 × 540. It fills a widescreen window, which today has empty bars left and right. Characters appear at two thirds of today's size and the playing area is three times larger. |

### 5.3 Flow of a level

1. **Intro (about 1.5 s).** Banner "Level n". Trees pop out of the ground. The fire starts in the middle.
2. **Rain.** The waters drop in, each at least 250 units from the fire.
3. **Main phase.** Lure every water into a tree.
4. **Finale.** When the last water is drunk: "Die Wiese gehört dir – verbrenne die Bäume!" The trees scatter and a bonus timer runs.
5. **Result.** Win banner with time, combo and stars, then the next level. On a loss: steam, slow motion, one life gone, the level restarts.

### 5.4 Levels, lives, score

Levels 1 to 6 are fixed. From level 7 on they are generated.

| Level | Trees | Waters | Water speed (share of fire speed) | New water behaviour |
|---|---|---|---|---|
| 1 | 3 | 1 | 70% | Chases straight. Teaches luring. |
| 2 | 3 | 2 | 75% | Waters keep apart instead of stacking. |
| 3 | 4 | 3 | 80% | One water cuts you off instead of following. |
| 4 | 4 | 4 | 85% | Waters start to surround you. |
| 5 | 3 | 4 | 88% | Fewer trees, so each one matters. |
| 6 | 4 | 5 | 90% | Waters sidestep a tree that is about to lunge. |
| 7+ | 3, 4, 5, then 3 again | 5 on level 7, then +1 every two levels, at most 10 | +2% per level, at most 100% | Faster reactions, faster anger. |

- **Lives:** 3 per run. Being doused or burning the last tree costs one life and restarts the level. One extra life after every 5th level, at most 5. At zero lives: game over, back to the title.
- **Score:** 100 for each water a tree drinks, multiplied by a combo (one step higher for each further water within 4 s, at most ×5). 50 for each tree burned in the finale. Time bonus of 10 points per second under par, where par is 20 s plus 8 s per water. 250 for a level without losing a life.
- **Stars per level:** one for clearing it, two for clearing it under par, three for under par without losing a life.
- **Saved in the browser:** best level and best score. The existing win counter (`fireWaterWins`) keeps counting and is shown on the title as "Siege".

### 5.5 Teaching the rules on screen

- A small rule triangle is always visible in the top bar: Feuer verbrennt Baum, Baum trinkt Wasser, Wasser löscht Feuer.
- Level 1 shows one hint on the field the first time it is played: an arrow from the water to a tree with "Lock das Wasser zu einem Baum!".
- A faint heat ring around the fire shows the fear radius. Trees inside it show sweat drops.
- A tree crouches for 0.15 s before it lunges. An angry water gets red eyes and steam.

### 5.6 Starting values

These are starting points in field units per second. The final values come out of the balance script in section 9.

| Value | Today | Start value |
|---|---|---|
| Field | 480 × 360 | 960 × 540 |
| Fire speed | 200 | 240, reaching full speed in about 0.08 s |
| Tree speed | 160 | 150 walking, 300 for 0.4 s when lunging, 1.5 s rest after a lunge |
| Tree fear radius | 170, all or nothing | 120, gradual, full strength inside 60 |
| Tree lunge trigger range | none | 140 |
| Water speed | 80 to 150 | 70% to 100% of fire speed by level |
| Water keeps away from trees within | 130 | 130, fading to one fifth when the fire is within 100 |
| Water anger | none | +4% speed and 10% less caution every 10 s, at most +40% |
| Start pause | 1.5 s, water frozen but deadly | Rain-in, water harmless until it lands |

## 6. Bot intelligence

### 6.1 Shared steering

Both bots use the same method, known as context steering. A bot looks in 16 directions around itself. Each wish (hunt that water, reach the fire) scores the directions it likes. Each danger (the fire, a tree, a wall, a corner) scores the directions it dislikes. The bot takes the best-liked direction that is not dangerous and accelerates toward it. Because walls and corners count as danger, bots curve away from them instead of sticking. Because bots accelerate instead of snapping to a new direction, their movement has weight.

### 6.2 Tree brain

- **Choose a target.** Trees share out the waters so they do not all chase the same one. If two trees hunt one water, the second approaches from the opposite side.
- **Hunt.** Aim at where the water will be, not where it is.
- **Fear.** The fire is a danger that grows as it gets closer. A tree keeps hunting at the edge of the fear radius and only runs when the fire is near.
- **Lunge.** Water within trigger range: crouch, then lunge. During the lunge the fire is ignored.
- **Panic (finale).** Flee toward open space, keep apart from other trees, and dart sideways when the fire is close and closing.

### 6.3 Water brain

- **Pack roles**, reassigned twice a second by distance to the fire. The closest water chases. The second aims at the spot the fire is heading for. The others take positions around the fire and close the circle.
- **Caution.** Trees are a danger, and a tree that is hunting or crouching is a bigger one. Caution fades near the fire and with anger. This is what makes luring work.
- **Slide.** Water turns slower than it runs, so a sharp turn by the player makes it overshoot.
- **Sidestep.** From level 6 on, a water that sees a tree crouch may dodge sideways.
- **Reaction time.** Water re-plans every 0.45 s on level 1, shortening to 0.15 s on high levels.

### 6.4 What changes with the level

Water speed, reaction time, which pack roles are active, the chance to sidestep a lunge, and how fast anger builds. Trees behave the same on every level.

## 7. Graphics and sound

The view stays 2D in Babylon with the existing drawings. Everything below is drawn by code or made from the existing pictures. No new art files are needed.

**Characters**
- Lean into the movement direction, squash and stretch on starts, stops and turns.
- Trees hop on their trunk, water slides and wobbles, the fire flickers. All faster at higher speed.
- Small signs above heads: sweat drops on a scared tree, "!" on a water that has picked you, red eyes on an angry one.

**Events**
- Tree drinks water: the drop stretches toward the tree, the tree gulps and grows a little, sparkles, a puddle stays and dries.
- Fire burns tree: it glows orange, turns black and crumbles, with leaves, embers and smoke. A burnt patch stays for the level.
- Water douses fire: steam burst, the picture loses colour, slow motion.
- Rain-in: shadow on the ground, drop falls, splash.

**Particles**
- Fire: rising embers all the time, sparks behind it when moving.
- Water: drips, a spray when fast, steam when close to the fire.
- Trees: dust when hopping, leaves when shaken.
- Field: drifting pollen.

**Light and mood**
- The fire lights the grass around it with a warm flickering glow. Flames and embers get a glow effect.
- The time of day changes with the level: morning, noon, dusk, night. At night the fire's light matters most.
- Soft cloud shadows drift across the field. A few grass tufts sway.

**Ground**
- The fire leaves a short scorched trail that fades. Water leaves a faint wet trail.
- The meadow extends to the window edge. A rim of stones and hedge marks the playing field instead of today's hard rectangle on black.

**Camera**
- Small shake on a kill, strong shake on death. A freeze of under a tenth of a second on each kill. Zoom toward the fire on win and loss.

**Screens (German)**
- Title with the animated characters, the rules in three pictures, best score, "Leertaste zum Starten".
- Top bar: level, lives as small flames, score, tree and water counters, rule triangle.
- Banners for level start, finale, win (time, combo, stars), life lost, game over.

**Sound**
All sounds are generated in the browser, no files. Fire crackle, a whoosh when moving, water plop and splash, the tree's gulp, the burn, the hiss of being doused, short jingles for level won and game over, quiet meadow background. Sound starts with the first key press because browsers block it before that.

**Keys**
Arrow keys or WASD move. Space or Enter starts. P or Esc pauses. R restarts the level (costs no life before the rain has landed, one life after). M mutes. F toggles fullscreen.

**Performance target**
60 frames per second with 10 waters and all effects on. At most 2,000 particles alive and 200 ground marks. Today the game renders at least at double resolution; if the new effects push it below 55 fps, that drops to the screen's own resolution.

## 8. Code structure

Today everything is in `index.html`: 337 lines, of which two are 55 KB of embedded pictures. It will be split into plain script files that the page loads in order. No modules and no build step, so the game still opens the same way.

```
babylon-game/
  index.html        page, styles, script tags
  babylon.js        unchanged
  js/
    assets.js       the two embedded drawings and their measurements, moved as they are
    config.js       all tuning numbers and the level table
    sim/            the rules. No Babylon, no page access. Also runs in Node.
      world.js      field, characters, collisions, win and lose, list of events
      steering.js   the 16-direction steering, wall handling, aim-ahead maths
      tree-ai.js    tree brain
      water-ai.js   water brain
    view/
      stage.js      engine, camera, ground, rim, light, glow
      sprites.js    character pictures and their animation
      fx.js         particles, ground marks, shake, freeze
      audio.js      generated sounds
      hud.js        top bar, banners, title and game-over screens
    main.js         game loop, keyboard, screens (title, intro, playing, finale, won, lost, game over)
  tools/
    balance.mjs     plays thousands of rounds without graphics and prints a table
    test.mjs        tests for the rules
```

Two rules hold this together:

- `sim/` never touches Babylon or the page. It advances in fixed steps of 1/120 s with a seeded random generator, so the same seed and the same key presses always give the same round.
- `sim/` reports what happened as events (water drunk, tree burned, fire doused, tree crouches, last tree warning, level won). `view/`, `audio.js` and `hud.js` only react to those events. They never change the rules.

## 9. Testing and acceptance

**Rule tests** (run in Node)
- Tree touches water: water dies. Fire touches tree: tree dies. Water touches fire: life lost.
- Last tree burned while water lives: life lost. Everything gone: level won.
- No character ever leaves the field. A bot fleeing into a corner gets out again.
- Same seed and inputs give the same list of events.

**Balance script**
Four scripted players play 1,000 rounds on each of levels 1 to 10: one that never moves, one that always chases trees, one that only runs away and then burns trees, and one that lures water past trees.

| Check | Target |
|---|---|
| Player who never moves | loses at least 95% on every level |
| Player who always chases trees | wins at most 10% from level 2 on |
| Player who lures | wins at least 90% on level 1, 55 to 75% on level 3, 25 to 45% on level 6, 10 to 25% on level 10 |
| Length of a won round (luring player) | median 20 to 45 s (today about 6 s) |
| Stuck rounds | at least 99% of rounds decided within 90 s, for every player and level |

The win-rate targets for the luring player are a first guess for a scripted bot. They get adjusted after playing by hand.

**In the browser**
- No errors in the console.
- Title, play, finale, win, life lost and game over can all be reached.
- Frame rate measured on level 10 with all effects.
- Pause, restart, mute and fullscreen keys work.

## 10. Build order

Each phase ends with a game that runs.

| Phase | Size | What happens | Done when |
|---|---|---|---|
| 0. Safety net | small | Put the project under version control (or keep a copy of today's `index.html`). Split the file as in section 8 without changing behaviour. Fixed time step, seeded random. Balance script and rule tests for today's rules. | The game looks and plays as before, and the script reproduces the table in section 2 within 3 points. |
| 1. Rules and feel | medium | Larger field, new speeds, rain-in, gradual fear, lunge, fading caution, anger, last-tree warning, fire acceleration. | The targets for the motionless player and for stuck rounds are met. |
| 2. Bot intelligence | large | 16-direction steering, tree target sharing, aim-ahead, two-sided approach, panic. Water pack roles, slide, sidestep, reaction time. | All balance targets are met on levels 1 to 10. |
| 3. Levels and flow | medium | Level table, lives, score, combo, stars, title, pause, finale, game over, saved best, top bar with rule triangle, level 1 hint. | A full run from title to game over works with the keyboard alone. |
| 4. Graphics | large | In this order, each visible on its own: character animation, particles, kill and death sequences, fire light and glow with time of day, ground marks, field rim and cloud shadows, camera effects. | Every event in section 7 has its effect and the frame-rate target holds. |
| 5. Sound | small to medium | All generated sounds, mute key. | Every event in section 7 has its sound. |
| 6. Tuning | medium | Balance sweeps, playing levels 1 to 10 by hand, removing tactics that break the game, performance pass. | Balance and frame-rate targets hold and no cheap winning trick is known. |

## 11. Not included

Touch or gamepad control, new field elements (ponds, blocking rocks, power-ups, boss water), a second player, 3D, new character drawings, online high scores, any change to the Scratch project.

## 12. Risks

- **Bots can surprise.** Steering bots produce behaviour nobody planned, including cheap ways to win. The balance script and hand play in phase 6 are there to catch this.
- **Smaller characters.** At 960 × 540 the characters are two thirds of today's size on screen. If that looks too small, 800 × 450 is the fallback (80% of today's size, twice the area).
- **Speed of effects.** Glow and particles cost drawing time at today's double resolution. The fallback is in section 7.
- **The luring bot is hard to write.** If the scripted luring player turns out weaker than a person, its targets say little. Then hand play decides and the targets are loosened.

## 13. As built (2026-11-13)

Everything in sections 1 to 11 was built, with the differences below.

### Where the game differs from the design

| Design said | Built | Why |
|---|---|---|
| Trees share out the waters, aim ahead and close in from two sides (6.2). | Trees do not hunt at all. They stand guard, back away from the fire, and lunge at water within range. Only the lunge aims ahead. | With hunting trees, a scripted player who only ran away won 55 to 99% of rounds on levels 1 to 6, depending on the variant tried, in about 12 to 23 s. With guard trees the same player wins 1 to 42% on levels 1 to 10. |
| Water keeps away from trees within 130 (5.6). | Caution starts at 210 and is full at 140, the lunge trigger range, and keeps growing closer in. | At 130 the water walked into lunge range on its own. A caution value that stops growing near the tree let water walk straight through. |
| Water anger: one step every 10 s (5.6). | One step every 6 s, faster on higher levels. | Removes the last rounds that ran past 90 s. |
| Same water behaviour rules on every level apart from the table (6.4). | On levels 1 and 2 water forgets the trees from further away (150 and 125 units from the fire instead of 100). | Makes luring easier to learn. |
| Glow effect on flames and embers (7). | Additive halos and particles, no post-processing pass. | Same look, cheaper, no risk to the frame rate. |
| Field 960 × 540 with 800 × 450 as fallback (12). | 960 × 540. | No reason to fall back. |

### Measured results

Rule tests: 20 of 20 pass (`node tools/test.mjs`).

Balance (`node tools/balance.mjs --n 300 --levels 1-10`): 300 rounds per level for the three simple players, 75 for the two look-ahead players.

| Scripted player | Won, levels 1 to 10 | Median length of a won round | How it loses |
|---|---|---|---|
| Never moves | 0% on every level | none | doused 97 to 100% |
| Always chases the nearest tree | 0 to 1% | none | doused 22 to 79%, burned the last tree 21 to 77% |
| Only runs from water, burns trees in the finale | 1 to 42% | 27 to 35 s | doused |
| Lures, reacts 0.2 s late | 75 to 100% (100% on level 1, 75% on level 10) | 19 to 30 s | doused |
| Lures, reacts at once | 83 to 100% | 15 to 27 s | doused |

Against the targets of section 9:

- Player who never moves loses at least 95%: met on every level. On level 1, 3% of its rounds were still open after 90 s. In those the trees had drunk the single water and the motionless fire never burned the trees, so this is not a standoff.
- Player who always chases trees wins at most 10%: met (0 to 1%).
- Length of a won round 20 to 45 s: met from level 2 on for both luring players. Level 1 is shorter (15 to 19 s) because it has one water.
- Rounds decided within 90 s: 100% for the three players that finish rounds, except one of 75 rounds for the late-reacting luring player on level 2.
- Win rates of the luring player (90% on level 1 falling to 10 to 25% on level 10): not met and no longer used. The look-ahead bots simulate every direction in advance and are stronger than a person, as section 12 warned. Their win rates stay high through level 10. How hard the levels are for people has to be judged by playing.

In the browser (Chrome, 1470 px wide window, rendering at 2940 px): title, play, finale, win, life lost, game over and pause all reached; no console errors; 60 frames per second on level 10 with six waters and all effects.

Not checked: opening `index.html` directly from disk without a local server. The test browser blocks `file://` addresses.

### How to run

From `babylon-game/`: `python3 -m http.server 8765`, then open `http://localhost:8765`. Adding `?auto` to the address makes the game ignore the keyboard and skip saving scores, for automated checks through `window.__game`.

# Naval-Battles — Development Log

Short record of what was done, what went wrong and how it was fixed. Newest entry first. Plan: `naval-game-plan-v0.7-en.md`.

---

## 22 Nov 2026 — M4b step 3: the screen shows only what your ship knows (D68)

### Your test of step 2 (battle log 22 Nov 19:48)
A 1.5-minute battle against 5 bots: nobody lost you (all start within 1000 m), so "lost from view" was 0 and the search is not tested by it. The two logs you named (arena 1817, battle 1425) are the ones of 20 Nov, before steps 8 and 2; there is no new arena log for step 2. A bot that keeps you in view is normal; to see the search, get away behind an island or beyond about 1000 m.

### Done
- `view/knownShips.ts` (`knownShips`): for every ship the viewer's list says "shown" (level 2 or better, or a wreck within the longest sight), "dot" (level 1) or nothing. The arena observer sees everything (step 4 adds the switch).
- `SeaScene`: a ship not shown is not drawn and leaves no wake, has no bars, flag or WANTED label, is no target and does not frame the auto zoom; no arrow for it; a ship at the edge of sight is a dark dot (`ShipBars`) with an arrow; the minimap and the HUD panels do not turn see-through for a ship you cannot see; the chart's "in sight" follows the contact list (`updateSightings` got a `seen` rule).
- Target card: class and distance always; the hull bar within 450 m, sails and crew within 200 m (`TargetInfo.detail`).
- Tests: `knownShips.test.ts` (4), `chart.test.ts` (+1): 478 in all. Browser check (computer and iPhone, no errors): ships at 150 and 500 m drawn, at 800 and 2500 m not. Version `M4b 3`.

### Known limits
The dot at the edge of sight can be seen only in the spyglass (the screen is about 640 m wide at zoom 1). Cannon smoke and balls of an unseen ship are still drawn; a shot revealing the shooter comes in step 5. The hull bar of a ship 200 to 450 m away is the true hull (the bots only know it within 200 m).

## 20 Nov 2026 (night, later) — M4b step 2: bots act on what they know (D67)

### Idea
Until now a bot read its enemy straight from the world: place, course, hull, crew, even through an island and 3 km away. Now the enemy is the bot's *belief*: built from its contact list (`believedShip` in `sim/perception.ts`). In view: the latest place and, as far as the sight level allows, course and speed (silhouette, 600 m) and hull and crew (within 200 m); farther off the enemy is taken as sound. Out of view: it stays at the last known place and does not move.

### Done
- `bot.ts`: the enemy of `thinkBot` is the belief; an enemy out of view is sought at its last known place (mode chase, no broadside, no ram, no finishing blow) and **no shot is fired at what cannot be seen**. With nobody known a sound bot **cruises** (`cruise`: the trade run, like a trader; mode `trade`) instead of lying still; a hurt one goes to a port within `portSeekRange` or mends where it is. A cruising bot that finds an enemy gives chase.
- `arena.ts` (`chooseTargets`): a new target must be a ship in view; the old target may be a last known place; hull is weighed only where known.
- `perception.ts`: `believedShip`, `Contact.levelNow`; a sunk ship leaves a list at once only if the watcher saw it a moment before.
- Tests: `perceptionBots.test.ts` (7: belief, no shot at the unseen, search at the last place, a hidden ship is not chosen) and three old tests changed on purpose: a bot whose enemy is sunk now sails on; a mended bot comes out in `trade` mode.
- Headless arena, 60 game minutes, seed 5150: 27 wins, 28 sinkings, 0 warnings, 14 groundings; a ship sees 3.7 others on average. A solo battle: the ships start within 1000 m of each other, so nothing changes at the start.
- Version `M4b 2`. 473 tests, build and build:test green.

### What to look at in your test
Bots now lose you behind an island or beyond ~1000 m and look for you at the last place they saw you; far from everybody they sail along trade runs. Please check that a bot you slip away from really loses you, and that no bot stands idle.

## 20 Nov 2026 (night, later) — M4b step 1: what a ship sees (D66)

### Idea
Every ship keeps a list of the ships it has seen (a *contact*): the best level reached (1 something is there, 2 silhouette, 3 flag, 4 hull / sails / crew), the last place, course and speed, when it was seen first and last. The list is updated 3 times a second. Land hides ships: the line from the watcher's lookout to the other's masthead is checked against the land height (the same terrain grid that stops cannon balls).

### Done
- `sim/perception.ts` (`levelAt`, `mastScale`, `lineOfSightClear`, `stepPerception`, `contactOf`, `visibleContacts`), `data/sight.json`, types `Contact`, `ShipSight`, `world.sight`, events `sighted`, `lostSight`, `forgotten`; called at the end of `stepWorld`. No random numbers.
- 12 tests (`perception.test.ts`): ranges, tall masts, bad visibility, what stays known, lost and forgotten after 60 s, a sunk ship, an island hides a ship.
- Arena log: one line "sight (M4b)" in the summary (counts and the mean number of ships in view). In a 30-minute headless run (seed 5150): 265 first sightings, 243 losses from view, a ship sees 4.2 others on average, 0 warnings; 30 game minutes in 16 s.
- Nothing reads the lists yet: bots and screen behave as before. Version `M4b 1`. 466 tests, build and build:test green.

### Next
Step 2: bots choose targets, aim, chase and flee only from their contacts; a lost enemy is searched for at its last known place.

## 20 Nov 2026 (night) — M3 step 8b: your test of 8

### Your test (battle log 1925, arena log 1949, iPad screenshot)
- Arena, 3 h 17 min, 10 bots: **0 warnings**, 49 groundings in 3 h 17 min (about 15 an hour; 25 before step 8). Frigates 52 wins, caravels 0 wins (23 losses): the caravel is the weakest; a balance note for M5, not changed now (D37).
- Battle: 4 bots, you were sunk by a brigantine after 4 min; the log is normal.
- **iPad:** the arena buttons (NEXT, x8, LOG) sat at a fixed y = 66 and covered the bottom bars of my ship panel (the panel is 64 px high plus the 8 px margin). Now the buttons go under the real ship panel (`Hud.shipRect()`, also when the phone panel is open).
- **Brainbox:** `step8.test.ts` (brigantine) took 5.7 s and hit the 5 s default. The two slow tests now have a 30 s timeout.

### Changes
`ArenaHud.ts` (`ArenaScreen.ship`), `Hud.ts` (`shipRect`), `SeaScene.ts`, `step8.test.ts`, version `M3 8b`. 454 tests, build green.

### Decision
D64 (survivors join the winner) **confirmed** by the developer; first version in M4.

## 20 Nov 2026 (evening) — M3 step 8: your test of 7f; the inlet; **M3 closed**

### Your test (battle log 1425, arena log 1817)

Battle: you sank a sloop and a brigantine (2% hull left!); the caravel ran. Arena (1 h 21 min, 10 bots): frigates 18 wins / 13 losses, sloops 11 / 10 (11 escapes), brigantine 7 / 2, fluyt 0 / 10, caravel 0 / 1 (2 escapes); 225 bow chaser shots, 109 stern salvos, 0 warnings. **64 groundings, 42 of them at the Isla Verde inlet** (a brigantine 23 times, a caravel 19). (The "arena" file you named, battle log 1127, is the old one from the morning; I read arena log 1817, the newest in your folder.)

### What changed (D65)

- **Camera:** your ship (or the watched bot) stays in the middle of the screen; under way the view looks ahead along the heading, at most one hull length at full speed (`leadOffset` in `view/combatCamera.ts`, `view.json` `cameraLeadHulls` 1). The lead is smoothed; the ship itself is never left behind. Replaces the camera circle (D43). Panel: "camera looks ahead" off = exactly in the middle.
- **Gun smoke** of black powder: 3 puffs a gun (was 2), bigger (15 px), lasting about 7 s (was 3.6), spreading to 4.5 times its size, thicker (0.6).
- **Fire in the gun ports:** each gun shows a flash in its port and a tongue of fire out of it (0.16 s), turned to the side that fired.
- **Space fires the bow chaser** in a battle (Z no more); in the arena Space is still NEXT.
- **The inlet (step 8):** the causes were (1) ships leaving the harbour cut straight from the harbour to the mouth, across the inside of the inlet's bend, and ground there; (2) inside the inlet they tacked and hit the banks; (3) traders on a trade run headed for the Isla Verde anchorage inside the inlet but were kept out of harbours they do not use, so they ground at the mouth. Now: on the inlet a ship sails along its middle line toward the mouth (`inletWayOut`, used by every way out: `portExit`); where the harbour boats tow a bot needs no tacks and heads straight for its goal; the boats tow along the whole width of the channel (`towPathM` 40 → 60) and a little faster (`towMps` 1.5 → 2.5, for you too); a trade stop at a port up an inlet lies 200 m off its mouth (`traderMouthOffM`). Headless, same seed: inlet groundings 14 → 4 an hour (your log: 42 in 81 min).

### Packs and allies (your question)

There are no allies yet: every bot fights for himself (each ship is its own team). "Pack" (D60) only means a bot likes to join a hunt that others have started, "loner" one that avoids it, so you see several bots on one victim, but they may turn on each other afterwards. Real groups (pairs, packs with a leader, convoys) with shared names or a short union tag are the **Squadrons** milestone (D54). A tag now would show alliances that do not exist.

### Checks

454 tests (new: `step8.test.ts`: the way out along the inlet, a brigantine and a caravel leave the harbour with almost no grounding, trade stops off the mouth; the camera lead); `tsc`; build; test build; headless arena 60 min, 0 warnings; browser computer and iPhone (Space fires the bow chaser, smoke and port fire, camera), no errors.

---

## M3 review (16–20 Nov 2026)

**Done when** (plan): "a pirate and a navy bot fight each other with no help from you, a trader runs and sometimes gets away, and the bot scenarios pass" — **met**: the arena runs for hours without help (10 bots, 0 warnings in all recent logs); traders run, throw cargo and get away (escapes 2–13 an hour); bot scenarios run in Vitest (`botStep6*.test.ts`, `step7*.test.ts`, `step8.test.ts`, headless arena).

**Built:** bigger ships (D39); port law and shore guns (D40); sails, crew, three kinds of shot; collisions v2 and ramming (D44); bot seamanship (D45), ways round the land (A*), harbour boats; fluyt and caravel (D52, D53); courage, fear, running and stern chasers (D55, D56); a battle against bots with classes, flags and bars by distance and a battle log (D57); bow chasers (D58, by hand since D63); pause, END GAME and the winner (D59); bot skills (D60); the headless arena (D46) and the test build; speed work (6e); many screen fixes from your tests (D61–D63, D65).

**Numbers now:** 454 tests; the arena 20–37 sinkings an hour with 10 bots; frigates and sloops win most, the fluyt never (by design it runs); hits per ball 0.3–0.5.

**Moved out of M3:** crew fatigue → M6 (captain and crew); gun wear → M5 (shipyard); `tools/validate_data.py` → M3b (with the map tool); "a small random speed factor per ship" is done by seamanship (D60).

**Known and left:** groundings along other shores (about 25 an hour, short); skills show little in wins and losses yet (few lives per level); the frigate is the strongest ship. Survivors joining the winner (D64) waits for M4.

**Time:** about 6 weeks planned, built in 5 days (16–20 Nov) with long days.

**Next:** your choice between **M3b "Caribbean Sea"** (D48, the new map, proposed) and **M4b "Eyes at Sea"** (D54: before M4). My advice: M4b first (it changes the bots, the map does not depend on it), then M3b, then M4.

---

## 20 Nov 2026 (later) — M3 step 7f: your test of 7e; chasers by hand, arena table in one line, arena size

### Your test (battle logs 1212, 1219)

Clean: no warnings; you sank the sloop; traders ran and threw cargo; 7 bow chaser shots. Wishes done (D63):

- **Chasers are not trained any more** (all ships, the same rule for you and the bots): they fire along the centre line; you aim by turning the ship. Bots fire a chaser only when the aim point lies on its line, like a broadside (`STERN_TRAIN_DEG` 0; `sternArcDeg` removed from `bots.json`). Spread and accuracy unchanged. Headless 60 min: 161 bow chaser shots, 61 stern salvos (they still fire: a hunter points its bow at its prey, a runner its stern at the hunter).
- **Stern chaser bar at the very bottom** of the guns panel (bow bar stays at the top); the version moved to the panel's bottom right corner.
- **Arena table in one line:** "ARENA 10:35 SPEED x8 WINS 20 +"; a tap (click) opens the full table, another closes it. NEXT / x8 / LOG / LEAVE above it. The help (H) goes to the right of the table. Fixed on the way: names over ships stopped at 8 bots (`MAX_SHIPS` 12 now).
- **Arena size** in the tuning panel (Auto-bot → "bots (next arena)", 4–10, default 10): the first 6 from the list, then random traders and warships; at least 30% traders (the last warships become random traders when needed; `arenaLineup`, `arena.json` minBots / maxBots / minTraderShare).

### Proposed, not built: survivors join the winner (D64, for M4)

Your idea: the winner may take 3–5% of the loser's crew if at least 5% was left. It is good and true to the time: pirates took on men from prizes (volunteers and forced men, often carpenters, surgeons, sailors), and men in the water were picked up. It belongs to M4 (boarding, surrender, prisoners), which has not started, so D37 puts it there: a small first version in M4 — after a sinking or a surrender the winner gets up to 5% of the loser's men who were still alive (at most its own full crew), and the log shows it. Waiting for your yes.

### Checks

446 tests; `tsc`; build; test build; headless arena 60 min (10 bots), 0 warnings; browser computer and iPhone (arena line and open table, H to the right, caravel with both bars, 7-bot arena), no errors.

### Next

Your test of 7f. Then the last M3 step: groundings at the Isla Verde inlet mouth and the M3 review; then M4b (D54).

---

## 20 Nov 2026 (afternoon) — M3 step 7e: your test of 7c2; chaser bars, 10 bots, phone layout, version

### Your test

Solo speed × 1.15 stays. Wrecks: fine. Wishes done in this step (D62): bot arrows only within 1000 m (`sightingRange`); reload bars for the bow and stern chasers at the top of the guns panel (computer; half the panel long, bow above stern, grey while loading, yellow when loaded, no bar if the ship has no such gun: `view/chaserBar.ts`; it works for the bot you watch in the arena too); arena of **10 bots**: the first 6 as before, then 2 random traders (fluyt / caravel) and 2 random warships (sloop / brigantine / frigate), seeded (`arenaClass`, `arena.json`); **safe water 300 → 255 m** (−15%; the law's pardon distance stays 450 m through `leaveFactor`); the mouse wheel rolled out at the lowest zoom opens the spyglass look-out for a few seconds, rolled in puts it away (`view/wheelZoom.ts`); the **version** (`view/version.ts`, "M3 7e") at the bottom of the guns panel (computer), bottom middle (phone) and the first line of the help (H), in the battle and in the arena.

### Phone layout

- My ship panel is a small one by default (84 × 28: a mini compass, the speed, the hull bar); a **tap on it opens** the full panel with the compass in its usual size (`shipOpen` in `Hud`; the target card moves with it).
- The minimap sits in the top right corner (4 px from the edges); the tuning gear is see-through (40%) and lies half over the minimap's lower edge near the right edge (`TuningPanel.placeGear`).
- Buttons: **L B R are the bottom row, the rudder `<` `>` above them**; the words and icons on the buttons are fainter (alpha 0.55).

### Checks

445 tests (new: chaser bars, wheel action, arena classes); `tsc`; build; test build; headless arena 60 min with 10 bots: 37 wins, 0 warnings; browser computer and iPhone (bars, version, mini panel and its tap, button rows, gear, wheel look-out), no errors. Not checked on the real iPhone: the gear place (CSS pixels) and how the mini panel feels.

### Next

Your test of 7e. Open from before: groundings at the Isla Verde inlet mouth. Then M4b before M4 (D54).

---

## 20 Nov 2026 — M3 step 7c2: your test of 7c; wrecks, solo speed

### Your test (5 logs: PC arena 0853 and 1143, PC battle 1127; iPhone battle 0813 and arena 0823)

All five logs run clean: 0 warnings, no ship on land. Arena (about 2 h 15 min, 6 bots): frigate 14 wins / 2 escapes / 4 losses, sloops 13 / 16 / 9, brigantine 6 / 3 / 7, fluyt 0 / 2 / 8, caravel 0 / 4 / 5. Bow chaser shots 153 / 347 / 147 an hour-run, stern salvos 100 / 155 / 62, desperate rams 6 / 8 / 5. Battles: you sank 3 of 3 (PC, 26 min) and 1 of 3 (iPhone, 9 min); the traders ran and threw their cargo over the side as designed. Skills: wins and losses are still close by level (few lives per level). Your two findings: the swimming speed in a solo battle should be a little higher; a wreck keeps a ghost picture on the screen for ever, and a HUD panel over it turns see-through.

### Causes and changes (D61)

- **See-through panels over wrecks:** the arena already passed only floating ships to the HUD fading; the battle passed every ship, sunk ones too (`ships: shipsOnScreen` in `SeaScene`), and so did the minimap. Now `shipsOnScreen` holds floating ships only, so a wreck never makes a panel see-through (you were right: there is no reason for it).
- **Wrecks:** the picture fades to 0.2 in the first seconds, stays 30 s, melts away in 5 s and is hidden (`view/wreck.ts`: `wreckAlpha`, `wreckGone`; numbers in `view.json` `wreck`). The chart mark ("sunk") goes with it (`forget` in `view/chart.ts`). The sunk ship itself **stays in the world's list**: the ship numbers (pictures, bars, log, arena respawn) are indexes into that list, and the battle summary, the END GAME verdict and the "sunk by" lines need it. So memory for a wreck is one entry of plain data; only the picture and the marks are removed. I did not delete the list entry: it would shift every index (a risk with no gain).
- **Solo speed (D61):** `view.json` `soloSpeedScale` 1.15 multiplies the speed of every ship in a battle against bots (you and the bots, so the chase stays as it was); the arena stays at 1.0, so the arena logs remain comparable (`speedScaleFor` in `view/wreck.ts`; the panel's "speed scale" slider still multiplies on top). Change the number to taste; if you want only your ship faster, tell me.

### Seen in the logs, not changed (for the next test)

- Isla Verde inlet: ships still run aground there (sloops 11–13 times per run, the caravel 65–75 times in 1143/0853, mostly at (-1730, 1038) and near (-1904, 1022), with `mode trade`, i.e. a trader running its trade route past the inlet mouth). Caravel and fluyt are not allowed in that harbour (D49) but their route and flight still pass the mouth. A real finding for a small fix (a trade route and flight keep clear of the inlet's mouth) — not done in this step, since it is not in your list.
- One sloop sunk by the shore guns of Isla Verde as an outlaw (arena 1143, "shore deaths 1"): as designed.
- "balls stopped by the land" 12 / 59 / 22: working.

### Checks

437 tests (5 new: wreck alpha, wreck gone, solo speed scale, chart `forget`); `tsc`; build; test build; headless browser: a bot sunk next to the ship fades 1 → 0.7 → 0.2, stays, is hidden after 35 s and its chart mark goes; speed scale 1.15 in a battle; no errors.

### Next

Your test of this fix. Then M4b before M4 (D54), then Squadrons.

---

## 19 Nov 2026 (night) — M3 step 7c: bow chasers, pause, minimap view, bot skills

### Your test of 7b / 7d (battle log 2056, arena log 2127, 4 h)

The battle works: flags, the runners' stern chasers, SAVE LOG. The arena: sloop 28 wins / 22 escapes / 16 losses, brigantine 11 / 3 / 16, frigate 12 / 4 / 6, fluyt 2 / 4 / 9, caravel 0 / 4 / 7; 78 fights left on poor odds, traders ran 71 times, 382 stern salvos, 0 warnings. Your wishes: a bow chaser for the hunter (and for you), ESC pause with statistics and END GAME, a minimap click that moves the arena view, names and classes in the H window with a lighter plate; then 7c.

### What was built

- **Bow chasers (D58)** on every ship: 1 gun at the bow, 2 on the frigate (`ships.json bowGuns`, `Side` 'bow'). Round shot only (chain and grape are useless at chase range and would make the chase too easy), full range, trained up to 30° off the bow, its own reload (`reloadBow`). Bots pick the battery that faces the enemy best, loaded ones first. You: **Z** fires it; the gun crew trains it on the nearest ship within 30° of the bow; a small diamond shows where it lands. Zoom moved to **Shift + / Shift −** (the wheel still works; + / − alone still raise and lower the guns; in the arena + / − zoom). Touch: a **B** button between L and R.
- **Pause (D59):** ESC (touch: the "II" button at the top) stops the simulation. ESC closes the chart or the arena results first. The window shows the statistics (battle: every ship with hull / sails / crew, SUNK or GOT AWAY; arena: the table with W / E / L / score) and RESUME / SAVE LOG / END GAME. END GAME in the arena opens the results; in a battle the end banner names the winner: your ship sunk → the enemy; all enemies sunk or gone → you; otherwise damage done (a sunk enemy 1, a hurt one its lost hull share) against damage taken, closer than 0.1 → a draw. The battle stays still under the banner; the log gets an "END GAME pressed" line.
- **Arena minimap:** a click moves the free view to that place (C still opens the chart).
- **H window:** each bot line shows its name (arena pilot, or flag and number in a battle), class and skills; the plate is see-through (0.3).
- **Bot skills (D60, `sim/skills.ts`, `data/skills.json`):** drawn at birth (every arena life, every battle bot). Seamanship 0.85–1.2: top speed × it, turning × (1 + 0.5 × (it − 1)). Gunnery 1–8: the ship's `battleSkill` in the accuracy formula and the reload (× 1 − 0.025 × (skill − 4)). Courage (7b) now drawn at birth. Loner 40%: loners count other hunters 1.5× against an enemy, pack bots −0.5× (they like to join). Most bots are average (the mean of two random numbers). The log shows them ("sea 1.08 gun 6 heart 0.62 pack") at the start, at each respawn and for battle bots, and a summary of wins / losses by skill level.
- **Runners pick their course:** `fleeHeading` adds how much faster the runner is than its pursuer on each course (the pursuer's rig, hull and sails, as anyone sees them), counted only for courses that open the distance.

### Problems and fixes

- The test hunter at 330 m never fired: the bow chaser reaches about 235 m (10° elevation). The test now starts at 200 m; that is the right range for a chase gun.
- The pause table's columns slid on "fluyt": the canvas joins a lower-case "fl" into one letter. The table is in capitals now.

### Numbers

Headless 4 × 60 min (seeds 43790–43793): 9–16 sinkings an hour (7b: 8–14), bow chaser shots 80–137 an hour, stern salvos 30–73, desperate rams 3–5, 0 warnings. Over the 4 h: sloop 23 wins / 26 escapes / 15 losses, frigate 20 / 2 / 7, brigantine 7 / 4 / 13, fluyt 1 / 2 / 11, caravel 0 / 3 / 5. Skill levels are close so far (few lives per level); watch the "skills (wins/losses)" line in long runs. 432 tests; build and test build; browser on computer and iPhone (bow shot, Shift + zoom, pause in battle and arena, END GAME, minimap click, H text).

### Next

Your test of 7c. Then M4b before M4 (D54), then Squadrons (the loner / pack flag is ready for it).

---

## 19 Nov 2026 (late) — M3 steps 7b and 7d: crew spirit, traders that run, the land stops balls; a battle against bots

### Your test of 7a and the 1949 log (4 h)

Fluyt 2 wins / 0 escapes / 31 losses, caravel 11 / 4 / 17; escapes were almost all "into safe water" (31 of 32). In a battle against bots nothing had changed (all sloops, no bars, no flags), and the "class" option did not work for a new battle. Your wishes: more guns and stern chasers for the traders, more for a trader that reaches port alive, a quarter for one that only gets away at sea; balls must not fly through hills; fire as a future mechanic; more objects on islands.

### Four new ideas in the code

- **Courage and fear** (`sim/morale.ts`): each bot draws its courage once; hits, men lost and near misses add fear (a black flag 1.5x), fear fades. Every 3–6 s (a random moment) the bot weighs its chances: fear above courage, or hurt with odds below 0.45 and a roll, and it leaves the fight; running, caught by a faster enemy that comes at it bow first, badly hurt: a desperate ram (a roll).
- **The trader's life:** a trade run between the usable ports and places off the big islands, chosen at random; an enemy within 700 m: run (a brave trader with the odds on its side fights); running until the enemy is 900 m away, then mend or go back to the run; hurt: to port; the enemy gaining: cargo over the side (`jettison` command). A trader on its run does not fire.
- **Stern chasers** (`Side` 'stern'): 2 on each trader, fire astern and can be trained ± 30°; bots pick the battery that faces the enemy best.
- **Heights of the land** (`sim/terrain.ts`): a grid of heights, built once like the water grid; a ball whose step goes below the land stops (`landHit`, a dust puff); bots check the arc before firing (`shotClear`).

### Battle against bots (7d)

Panel → Target → "bot classes (next battle)": mix (sloop 3, brigantine 2, caravel 2, fluyt 2, frigate 1) or one class; "class of ship 2 (now)" swaps ship 2 at once. You sail under the black flag; bots under random flags. From your ship: the flag up to 400 m, the hull bar up to 450 m, sails and crew up to 200 m. A battle log like the arena's (`battle log (you against bots)`, battle summary per ship: balls, hits, hull lost, mode, fear, courage); SAVE LOG on the banner and key L; the last battle's log is kept in the browser. Victory when every warship is sunk and every trader sunk or more than 1.5 km away.

### Results

Headless 4 × 60 min: 8–14 sinkings an hour (about 30 before: the traders run and the hunters chase them); by class over 4 h: sloop 21 wins / 16 escapes / 12 losses, brigantine 7 / 8 / 8, frigate 15 / 4 / 4, caravel 0 / 2 / 4, fluyt 0 / 1 / 15. An hour: left a fight on fear 2–15, on poor odds 6–15, traders ran 12–20, cargo over the side 4–7, stern salvos 72–128, desperate rams 1–6, balls into the land 2–24. A sloop that had escaped into the Isla Verde harbour ground along the inlet's bank (108 times aground in one run): bots in a harbour up an inlet now sail out through the mouth first. 412 tests; build and test build; browser computer and iPhone (battle with mixed classes, flags and bars, banner with SAVE LOG; arena 40 s at × 8), no errors.

### Next

7c bot skills (seamanship with speed × 0.85–1.2, gunnery, courage, loner or pack). Then M4b (D54).

---

## 19 Nov 2026 (evening) — M3 step 7a: the fluyt and the caravel

### Why

Your 6e logs (3 h of arena): the merchantman won 1 fight and lost 16, lay aground 25 times (half of all groundings), worked free 23 times and once spent 15 minutes on the West reef in the north-west corner while running from a fight. It charged into 111 fights like a warship, and grape killed its 40 men while it kept sailing at full speed. Your answer: two traders of the time, the arena counts getting away alive as half a win, crew losses should cost little speed but much handiness.

### What changed

- **Two traders instead of the merchantman (D52):** the fluyt (62 m, 14.1 m/s = 0.7 of a sloop, 1 gun a side, 18 men, hold 30–100% full, a full hold −15% speed; tall masts: her own polar `squareTall`, as fast dead before the wind as on a broad reach) and the caravel (46 m, 16.1 m/s = 0.8, 4 guns a side, 45 men, hull 400, sides 9 m high). Sprites from `render_ship.py`: a new lateen sail and a hull whose sides lean in (the fluyt). The merchantman's pictures are gone.
- **Sailing crew (D53):** with its sailing crew aboard a ship keeps 95–100% of its speed; below that the speed falls to half with nobody left. Losses still slow turning (to 0.4) and reloading, and now also gathering way and losing it (up to 2× slower).
- **How many men a ball kills:** times the crowding of the deck (men per metre of hull against a full sloop) and, for grape, the cover of the sides (6 m ÷ side height). A full sloop as before; a fluyt about 0.17; grape on the caravel 0.4. A share of a man is a seeded chance.
- **Arena:** sloop, brigantine, fluyt, frigate, sloop, caravel. Score = wins + ½ × escapes. An escape: the ship was hit, is hurt (hull, sails or crew below 70%), and reaches a port's safe water, or nobody hits it for 60 s and the enemy is more than 1.5 km away; once per enemy and life. The table shows W / E / L; the log writes "ESCAPED ..." lines and an escapes column per class; the hold of a trader is in the log.
- **Flags 12 × 8:** a bold, ragged red Burgundy cross with a gold centre for Spain; St George two pixels thick; a big gold lily for France; the Dutch Prince's flag; skull and crossbones.
- **Fixes:** a runner judges each heading by the sea room 500 m along it and turns along the edge instead of into a corner (`seaRoom`, up to 135° off "straight away"); "finishing attacks ... sank their enemy" now counts a kill even when the killer was already marked an offender in the same step.

### Results

Headless 4 × 60 min (seeds 43790–43793): sunk 26–34 an hour, aground 7–15, works free 6–11, no warnings. By class over the 4 hours: sloop (2 ships) 40 wins / 10 escapes / 34 losses, brigantine 31 / 6 / 19, frigate 34 / 4 / 11, caravel 7 / 2 / 21, fluyt 3 / 2 / 30. The traders still go into every fight: running away is step 7b. 392 tests; build and test build; arena checked in the browser (computer).

### Next

7b crew spirit and running; 7c bot skills; 7d bars and flags in battle. Then M4b before M4 (D54).

---

## 19 Nov 2026 (late night) — M3 step 6e: speed

### Measured first

CPU profiles of the simulation (Node, headless arena) and of the game in headless Chrome (software graphics), before and after. The game did not leak: over 17 game minutes of arena at ×8 the heap stayed at 59–65 MB and the number of objects did not grow.

| | Before (6d) | After (6e) |
|---|---|---|
| Headless arena, 60 game minutes | 18.9 s | 6.7 s |
| Worst simulation tick (20 min arena) | 11.5 ms | about 7.6 ms |
| Arena in the browser: work per frame, average / worst | 4.3 / 25.7 ms | 3.4 / 13.5 ms |
| Battle (5 bots): work per frame, average / worst | 2.4 / 6.6 ms | 2.2 / 5.5 ms |
| Texts drawn again per frame (battle / arena) | 6.7 / 14 | 0.7 / 4.3 |
| Drawing commands for the arena flags per frame | about 2,900 | 0 (pictures) |

### What was slow, and what changed

- **Land checks** (about 30% of the simulation): every bot asked "land ahead?" up to 50 times a think, each time testing every island. New: the water grid also keeps each cell's distance to land (`landDist`, two sweeps over the grid); `touchesLand` and `landAhead` answer "no" at once when there is more open water round the ship than the hull and the look-ahead can reach. The distance is measured so that it can only be too small, never too large, so no answer changes.
- **A\*** made four arrays of 240,000 cells for every search (about 4 MB for the garbage collector each time). Now they are made once and reused (a stamp per cell says which search wrote it); the search leans 1.4× toward the goal (far fewer cells looked at; the way is pulled tight afterwards); bots replan at slightly different moments (by ship number).
- **Aiming**: the bisection flew 21 test balls each time a bot aimed. Now a table of 401 landing distances per ship size and kind of shot, made once.
- **Harbour test**: ports farther than their harbour reaches are skipped at once.
- **Screen**: `paint()` changes a text only when its words or colour change (Phaser draws a text again and sends it to the graphics card on every `setColor`); flags are pictures made once; range rings, port rings and the shore-gun ring are drawn once per zoom and moved / turned each frame; the minimap redraws its islands only when you discover one; the tuning panel's width comes from a ResizeObserver (reading `offsetWidth` made the browser lay out the page twice a frame).
- **Speed meter** in the help (H): "fps · frame ms (max) · sim ms (max)".

### Checks

379 tests; the same seed gives the same arena log, line for line; headless arena 6 × 60 min with the same results as 6d (24–36 sinkings an hour, aground 1–34, works free 5–22); build; `build:test`; headless browser computer and iPhone, the test file from the disk.

---

## 19 Nov 2026 (night) — M3 step 6d: your test of 6c; a test build for testers

### Your test and log (2057, 4 h 12 min)

116 wins (27.6 an hour); the merchantman 0 wins, 30 losses. "Works free" 46 times in mode port, 38 at the West reef. Your observation: a wreck runs to the edge of the sea, twitching by 5–10°. Causes found: (1) a badly hit bot ran for a port only within 2,500 m; the merchantman (since 6c only Empty Barrel Land is its port) fled into the open, and when out of reach it "repaired" by drifting straight away from the enemy, onto the reef, where `avoidLand` turned it back and forth; (2) a brigantine sailing for port against an east wind lay against the West reef: slow, it tried to wear, and the long turn put its bow on the reef again and again (a lee shore); (3) in the headless arena a merchantman broke off straight into the Isla Verde inlet and stuck in the harbour; (4) a sloop beside the inlet, behind its bank, counted as "up the inlet" (within 90 m of its middle line) and steered straight at it across the land; (5) hard by a shore the "fat" land test found land on every heading, and `avoidLand` then turned the ship round, onto the bank.

### Changes

- A badly hit bot (flee or repair) goes to a port it can use, at any distance (`portSeekRange` 7000); running and drifting look 150 m ahead for land and pick the fastest open course (up to 90° off).
- `onLeeShore`: land close downwind → no wearing, tack instead.
- `avoidHarbour`: outside a harbour, a bot not going to port there does not sail into one; a big ship waits off a small harbour its enemy is in (`enemyInSmallHarbour`).
- `harbourSails`: at most 4 m/s in a harbour (the boats still tow).
- "Up the inlet" only when the next point of the inlet is in plain sight.
- `avoidLand`: when every heading looks blocked, a slim test (the hull, 30 m); never "turn round" onto the bank.

### Test build (`npm run build:test`)

One HTML file in `client/dist-test/` (`naval-battles-test-<date>.html`, about 6.4 MB): the code, the pictures, the sounds and the fonts are inside as data URLs (`vite-plugin-singlefile`; `src/assets.ts` swaps every asset path for its data URL in this build). It opens with a double click, no web server, Node or Python. No tuning panel (so no arena either); "TEST BUILD M3 step 6d · date" in the lower right corner. The code is minified (no comments, no types, short names, no source maps), not hidden.

### Checks

378 tests (new: `botStep6d.test.ts`, `assets.test.ts`); build; headless browser computer and iPhone; the test file opened from the disk in headless Chrome on computer and iPhone: game, ship pictures and fonts load, no panel, version shown, no errors. Headless arena 6 × 60 min: aground 13/13/40/15/9/12 (6c: 50–260), works free 20/10/27/12/15/11, Isla Verde 0–4, nobody flees to the edge any more (all go to port); 22–31 sinkings an hour.

### WANTED and rammers

Both are rare by design: bots become offenders only by a stray ball, and rammers only after a ram that struck (your log: 16 rammers in 4 h, see the "is a RAMMER now" lines). To see WANTED yourself: fire a broadside inside a port's safe water.

---

## 19 Nov 2026 (evening) — M3 steps 6c and 6b: your test of 6a; camera circle, arena flags

### Your logs (18 Nov, 1928 local and 1945 Linux)

149 and 111 "works free" in about 2 h each, 109 and 70 of them at Isla Verde. Three causes: (1) a bot repaired in the harbour turned to chase or wait and steered straight at the enemy or straight "away from the port" — into the shore of the round harbour; (2) bots in the bay north-west of the island sailed straight at the inlet's mouth through the island; (3) the frigate and merchantman (84 and 67 m long) went for repairs into a harbour of radius 85 m and could not turn there, and a square rig beating upwind in the south-west corner (wind from the north-east) wore again and again onto the reef.

### Three new ideas in the code

- **A water grid and A*** (`sim/path.ts`): the sea in 10 m cells; a cell is open if it is at least 16 m from land. A* is the classic shortest-path search: it grows a chain of open cells from the ship, always first where "steps taken + straight distance left" is smallest, until it reaches the goal. The chain is then pulled tight into a few straight legs. Used only when the straight line is blocked; a route is planned again every 4 s or when the goal moved 60 m.
- **Harbour boats** (`inHarbour`, `towMps`): in a harbour a ship with sails set moves at least 1.5 m/s, even into the wind (boats tow it). A rule of the game, so you get it too.
- **A lead point**: the bot turns its side toward where the enemy will be after the ball's flight (own motion counted), not where it is.

### Changes

- Bots: ways round the land; the way out of a port (`portExit`); small harbours only for ships up to 0.7 × the harbour radius (`portsFor`); go about early when land is ahead on a tack; square rigs tack at ≥ 6 m/s, wear when slower; unstick also accepts 30 m of open water (a small harbour).
- Gunnery: broadside to the lead point; a loaded side within 25° of the beam turns onto the shot; 25 s without a broadside → close in.
- Rammer (your idea): a ram that struck makes the bot a rammer for the rest of its life: preferred range ≤ 100 m, chain shot at middle range, grape < 80 m, ram chance 50%, a "no" stands 12 s. Log: "... is a RAMMER now", summary counts rammers.
- WANTED: a red "WANTED: name" over an offender until pardoned (arena names; in a battle "YOU" or "SLOOP 3").
- A battle has 3–5 bots (panel "bots": 0 = random; `world.json` enemiesMin/Max).
- 6b: camera circle (D43), spyglass centred, auto zoom fit from your ship, fainter rings; arena sails/crew bars and flags (`view/flags.ts`), names above the bars, help below the table and shorter; results: SAVE LOG and whole-pixel text; Spanish port flag and bigger shore guns (`make_islands.py`, shapes unchanged).

### Checks

371 tests (new: `path.test.ts`, `botStep6c.test.ts`, `wanted.test.ts`, `flags.test.ts`, camera circle, enemiesFor); `tsc`; build; headless browser computer and iPhone (WANTED, spyglass, arena flags, results with SAVE LOG; no errors). Headless arena 4 × 60 min (seeds 100–103): "works free" 45/19/79/58 → 28/30/5/23, aground 105/111/231/170 → 107/93/26/79, Isla Verde stuck 1/10/9/24 → 4/11/0/0; 24–37 sinkings an hour (was 12–24): the bots shoot better. Still seen: fights pressed against shores (a crippled merchantman pinned by a frigate's rams).

---

## 19 Nov 2026 — M3 step 6a: collisions and ramming v2, bot seamanship part 2, headless arena

### Three new ideas in the code

- **A memory of collisions in the world** (`world.contacts`): after a damaging contact the pair is written down with two times (in steps): until when it takes no new damage (2 s) and until when its bots steer clear of each other (6 s). Plain data, so saves and tests repeat.
- **Wearing ship** (`rudderFor`): the rudder for a heading normally takes the short way. A square-rigged ship (and a slow brigantine) whose short way would take the bow through the wind turns the long way, through downwind, so it never stops in irons. That was the frigate's "works free" in open water.
- **A Node build of the game rules** (`headless/arena.ts`, `vite.headless.config.ts`): Vite bundles the arena with `src/sim` and the JSON data into one file that Node runs, without Phaser or a browser.

### Collisions (D44)

damage = 1.2 × (closing − 1)² × 2 × other mass / both masses × place × (0.5 + 0.5 × own speed / closing), at most 30% of the ship's hull. Place: struck amidships 1, near bow or stern 0.6, struck with its own bow 0.25, side against side 0.3. Example, a sloop at 8 m/s rams a sloop lying still amidships: the struck one loses 29 (was 48), the rammer 15 (was 24); at 13 m/s: 86 and 43.

### Bots (D45)

- Chase toward the point where the enemy will be (at most 30 s ahead): no more parallel runs behind it.
- Bear away 20° from a ship alongside closer than 25 m of water; after a contact turn 50° away and ease sail for 6 s.
- Ram on purpose: within 150 m, heavier (or the enemy crippled), faster (or it is almost stopped), its side toward us, our hull above 50%; then a 20% roll; a ram lasts at most 15 s; a "no" stands 30 s. Log: "RAM? … RAMS / keeps firing", a summary line.

### Headless arena (D46)

`npm run headless-arena` (options `--minutes 60 --runs 0 --seed N --port 4180 --dir arena-logs`): run after run, the log written every 10 game minutes, a page on port 4180 lists the logs, `/current` shows the running one. 60 game minutes take about 10 s. Linux: `bash scripts/run-linux.sh arena` (open port 4180 once: `sudo ufw allow 4180/tcp`).

### Checks

354 tests (new: 7 in `botStep6.test.ts`, collisions: place, own speed, pause, cap); `tsc`; build; headless browser computer and iPhone (a ram seen in the arena, no errors). Headless arena 4 × 60 min: 22.8 wins an hour (step 5: 25); a first try with ram chance 30% and k 2 gave 19.5 an hour and 3,300 hull points lost in collisions, most of them accidental head-on crashes; with the cap, the side-on rule and 20%: 40 rams tried in 226 chances, 11 hit. Still seen: many small pushes in the crowded Isla Verde harbour (a map matter, M3b), the merchantman stuck at the West reef now and then.

---

## 18 Nov 2026 (evening) — Your test of steps 4c and 5; plan v0.7

### Test

Arena view after a sinking, LEAVE and results, tall PC window, upright iPhone: all work. Wishes: a save-log button on the results screen; the results text shimmers.

### Arena log (3 h 51 min, build "M3 step 5")

106 wins (27.5 an hour, up from 20–21); sloop 37 / 33, brigantine 41 / 32, merchantman 2 / 32, frigate 26 / 9 (wins / losses). 111 collisions cost 1,900 hull points. 188 "works free" (49 an hour): 68 in mode port, 67 chase, 39 engage; the frigate 47 times, often in open water 350–450 m from land and right after a respawn: a square-rigged ship that starts at speed 0 or tries to tack loses all way (it turns at 0.12 rad/s when slow). Remedy in D45: square rigs wear instead of tacking. 9 finishing attacks in 27 chances, 2 sank their enemy. 0 berth waits (no port was full this time).

### Your suggestions → plan v0.7

Written as decisions in **plan v0.7** (EN and RU; v0.6 stays in `docs/` as history):

| Suggestion | Decision | Where |
|---|---|---|
| Two bots sail side by side and hurt each other again and again; damage pause; ramming by bow costs less, speed counts, a ship lying still takes less | D44 collisions and ramming v2 (4.7b) | M3 step 6 |
| Bots keep distance from allies, turn away after a contact; pursue to a broadside or cut off instead of running parallel; ram when it pays, with randomness | D45 bot seamanship part 2 | M3 step 6 |
| The camera slides toward the enemy; keep your ship in a central circle; spyglass centred | D43 | M3 step 6 |
| Range rings fainter; H help over the arena table; bars and random flags over every ship in the arena | D47 and the step 6 list | M3 step 6 |
| `npm run headless-arena` with logs kept on the server | D46 (files now; SQLite with the backend, O7) | M3 step 6 |
| Spanish flag in port; clearer shore guns | pictures only, early | M3 step 6 |
| Central port, Isla Verde (pocket, bigger port, move south-west) | on the new map, not the test sea | M3b |
| A map of the central Caribbean (your mockup) | D48: new milestone M3b after M3 (O6) | M3b |

Also in v0.7: the status line, key constants and the ship table brought up to date; the M2b and M3 checklists shortened (the details stay in this log); a new risk (the map delays boarding).

---

## 19 Nov 2026 — M3 step 4c (your test of 4b) and step 5: bots finish in safe water, berths

### Your test and logs (18 Nov, 6 h and 9 h of arena)

Steps 4b: all checks passed (controls lock, slower damaged ships, icons, ball colours, minimap acceptable). Logs: 20.8–21.6 wins an hour; frigate and brigantines win, the merchantman almost never (4 wins, 47 losses); 2 "stuck aground" warnings, and one brigantine ran aground 311 times, half of them on the West reef, bumping the same spot every few seconds (the watchdog reset each time it floated free for a moment). Your screenshots: a fresh brigantine could not catch a wreck (it kept its usual fighting speed of 7.5 m/s at 173 m); the target card covered the key hints; a tall PC window piled the panels up; an upright iPhone was unplayable.

### Step 4c (fixes)

- Arena: after the watched ship sinks the view goes back to the best bot (it went to the next number); a wobbling tap no longer unhooks the view (8 px before a drag counts); the table fades over ships, lighter on touch screens; LEAVE opens the results: places I / II / III with ship pictures, the rest below, EXIT / BACK (also once at peace).
- Computer: target card top right (left of an open tuning panel); ammunition as three icons with counts and a yellow frame; a tall window keeps at least 300 logical px across and stacks the guns panel above the ship panel.
- Touch screens held upright: "TURN YOUR DEVICE SIDEWAYS", the game waits.
- Bots: a runner (or a nearly sunk enemy) sets the pace: sails for its speed + 1.5 m/s, straight at a nearly sunk one beyond the preferred range. Working free: less than 15 m of way in 20 s while wanting to move → 8 s on the fastest open heading. The first try (net distance 30 m in 15 s) fired 100+ times an hour, because a ship circling in a fight ends near where it began; now the way made through the water counts.
- New concept: **bot events**. The bots' own events (works free, finishing decision, berth wait) are made while they think, before the world step that clears the event list; `Simulation` now keeps them and adds them to the step's events (log only).

### Step 5 (plan)

- Finishing attack in safe water: a calculation (`finishPlan`) and a roll (70% when it can sink the enemy, 8% when it cannot), at most 25 s, it becomes an offender and leaves afterwards. The arena keeps the enemy as target until the bot has decided (before, it dropped any ship in safe water at once, so the bot never had the chance).
- Berths: 3 per port, 2 in the inlet harbour; a bot waits 200 m off (or off the inlet's mouth) while they are full.

### Checks

342 tests (31 new: ammo icons, results, tall windows, portrait, layout, finishPlan, finishing scenarios, berths, working free, chasing a runner, log lines); `tsc`; build. Headless arena 4 × 60 min: 25 wins an hour (step 4b: 22.8); worked free about 12 times an hour per ship; 8 finishing attacks in 29 chances, 2 sank their enemy, then ran from the shore guns and were pardoned. Headless browser: computer wide and tall (961 × 1280), iPhone 13 landscape and upright; the view follows the best bot after a sinking; no errors.

---

## 18 Nov 2026 — M3 step 4b: fixes after your test of step 4

### What the logs showed (two step-3 logs, one step-4 log of 3 h 53 min)

| | Step 3 (17 Nov) | Step 3 (18 Nov, PC) | Step 4 (server) |
|---|---|---|---|
| Wins an hour | 19.4 | 20.5 | 17.5 |
| Frigate wins / losses | 21 / 8 | 16 / 7 | 20 / 7 |
| Merchantman wins / losses | 3 / 21 | 0 / 10 | 1 / 17 |
| Collisions | 1333 | 53 | 312 |
| Times aground | 309 | 102 | 109 |

- Damage barely slowed ships: at the sinking a ship still had 71–92% of its sails (round shot tore little, chain shot was rare: 115 hits against 2063), crew losses did not touch speed or turning, and the hull slowdown started only below 50%.
- **My log bug:** "speed 0.0, sails set 0%" in almost every sinking line; the sinking zeroes them before the log reads them.
- Grape counted every small ball as a hit but the gun as one ball ("hits/ball 5.00").
- 56 of 68 sinkings were ships already sailing to port; ships pile up at the Empty Barrel Land berths.

### What changed

1. **A sunk ship takes no orders** until it is placed again ("Sail again", a respawn): `applyCommand` ignores all but `placeShip`; the screen does not read the ship keys (rudder, sails, guns, elevation, ammunition) and drops presses made while sunk, so nothing fires after "Sail again". View keys (zoom, chart, spyglass, sound) still work.
2. **Damage slows more** (new numbers, tune them in JSON):
   - round shot tears sails twice as much (`ammo.json` round `sails` 0.2 → 0.4);
   - crew: speed × (0.7 + 0.3 × crew share), turning × (0.4 + 0.6 × crew share) (`damage.json` `crew`), also aground;
   - hull: down to 45% at hull 0 instead of 60% (`slowdown.minFactor`).
   Example: 30% hull, 80% sails, 60% crew → about 58% of the speed (it was about 75%) and 76% of the turn rate.
3. **Bar icons:** a brown hull, a canvas sail and a blue sailor in front of the bars, in my panel and the target card (`view/barIcons.ts`, rows of `#` and `.`).
4. **Ball colours:** round shot black, chain shot two brown halves that tumble, grape red and black (`view/ballLook.ts`; textures in `Cannonballs.ts`).
5. **Minimap:** on touch screens 2.4 buttons wide at the top right, left of the right button column (iPhone about 98 × 65 instead of 41 × 27); the chart button keeps its old small place when the minimap is off. Everywhere a thin white box shows what the screen shows (`view/chart.ts` `viewFrame`).
6. **Arena log:** the `sunk` event carries the speed and sails set **before** the sinking; "speed left N%" (hull × sails × crew, `damageSpeedFactor`) in the sink line and in "sails to port" / "flees" lines, with sails and crew; a grape gun counts 8 balls.

### Checks

- 322 tests (12 new: crew speed and turn, the worked example, commands of a sunk ship, the sunk event, grape counting, `viewFrame`, bar icons, ball looks, a big minimap under no button), `tsc`, build.
- Headless arena 4 × 60 min, old numbers against new: 75 → 91 wins (18.8 → 22.8 an hour); ships turning for port keep about 55% of their speed (mean of 111 lines); sail points torn about twice as many.
- Headless browser, computer and iPhone 13: icons and colours visible; after `damageHull` sank my ship, keys 1 / 3 / W / D / R and the touch buttons changed nothing (ammunition, sails, rudder and elevation the same).

### Your other ideas (recorded in the plan, not in this step, D37)

- Finishing shot in a port's safe water with a roll, then leave for 45 s; port capacity (bots wait outside when the berths are full): the next M3 bot step.
- Detail by distance (200 m / 450 m), national flags up to 400 m, random nations for bots: M4b (perception).
- Damage on the ship picture; random island placement: M5.

---

## 17 Nov 2026 (night, 2) — M3 step 4: sails, crew and three kinds of shot

### Two new ideas in the code

- **"Absent means new":** the new ship fields (`sails`, `crew`, `ammo`, `ammoLeft`) may be missing; then the ship is as good as new. Every rule reads them through `sim/condition.ts` and `sim/ammo.ts`, so the default lives in one place, old tests and saves keep working, and a refit is just deleting the fields.
- **Gun numbers per ammunition:** `ammoGuns(type)` gives a copy of `guns.json` with a lower muzzle speed (√rangeShare, so chain flies 60% and grape 30% of the range). The landing cross, the bots' aim and the real balls all use it, so they always agree.

### Rules (plan 4.4–4.6)

| | Round | Chain | Grape |
|---|---|---|---|
| range | 100% | 60% | 30% |
| spread | × 1 | × 1.5 | × 2 |
| balls per gun | 1 | 1 | 8 |
| hull (hull zone) | 27 | 2.7 | 0 |
| men (hull zone) | 2 | 1 | 1 per ball |
| sails (rigging zone) | 3 | 15 | 0.75 per ball |

- Sails slow the ship: speed × (0.2 + 0.8 × sails). The crew: reload × min(2.5, full / crew); a gun needs 4 men; a short crew widens the gun error.
- Chain and grape: 6 broadsides each; when out, the guns load round shot. Round shot is not counted until gold exists (M5).
- Repair at sea also mends sails (to 90%); men lost stay lost. A port mends all sails, signs on 1 man a second and refills chain and grape (free until M5).
- Bots: grape under 70 m (round again beyond 90 m), chain at an enemy 1 m/s faster whose sails still draw.
- Screen: keys 1 / 2 / 3; on touch screens a button above "L" (RND / CHN 6 / GRP 6) cycles them. My ship panel and the target card: two short bars over the hull bar, sails (canvas colour) and crew (blue). Computer: the loaded shot above the guns panel. The same sound is not started twice within 30 ms (grape fires 32 balls).
- Arena log: hits by ammunition, men lost, sail points torn; the sink line shows sails left, crew and the loaded shot.

### Checks

310 tests (18 new); build clean; headless arena, 4 × 20 min: 13.5 wins an hour (13–20 before), hits 730 round, 441 grape, 55 chain. Headless browser computer and iPhone 13: keys 1–3 and the touch button switch the shot, grape fires 8 balls a gun, chain range 89 m at 5°; no errors. Your `islands.json` from GitHub was used this time.

**Not tuned yet:** whether grape is too strong in ramming fights (most grape hits came from bots close together), and chain is rare because bots fight at 115–165 m, beyond its reach. The arena log will show it.

---

## 17 Nov 2026 (night) — Your answers on the world ideas: D41, D42, item 10

- **O5 closed → D42:** a game day lasts **12 real minutes** (1 game hour = 30 s at ×1); morning 05:00–07:30, day to 18:00, evening to 20:30, night to 05:00. Plan 4.0 and 4.1 updated; provisions (30 days = 6 hours now) are re-tuned in M5.
- **D41:** perception is its own milestone **M4b "Eyes at Sea"** right after M4; checklist in the plan, detailed design in `world-ideas-en.md` section 9 (contacts with three levels, sight ranges, islands and fog block sight, memory and a `search` mode for bots, the screen shows only what your ship knows, arena switch "what the bot sees", tests).
- **Item 10:** a crew that has lost more than 60% surrenders more easily: added to plan 4.7 and the M4 checklist (M4 has not started, so it may go in); proposed curve in section 8. A hireling who finds no loot breaks the contract and demands a fine; pay or fight, the winner takes the loser's ship: section 5.1, with hiring in R4.
- New in `world-ideas`: section 10, the day-and-night plan for M5 with numbers (clock, light factors for sight, gunnery, repair, market and dock hours, picture).

No code changed. M3 continues: sail and crew damage, 3 ammunition types.

---

## 17 Nov 2026 (late) — Updating the Linux server; ideas for the world

### How to update the Linux server (Brainbox) after new code

`scripts/setup-linux.sh` is the **one-time installer** (system packages, Node, uv, firewall). Do not run it for an update; it is only for a fresh server or if Node or uv was removed (safe to re-run, but slow).

A normal update, from the repository root:

```bash
cd ~/naval-battles                       # the repository folder
git status                               # no local changes? (else: git stash, or commit)
bash scripts/run-linux.sh update         # git pull, npm ci, make_islands.py, npm test
bash scripts/run-linux.sh preview        # build and serve on port 4173 (or: dev, port 5173)
```

- `update` runs `git pull` itself (harmless if you already pulled), reinstalls the game's packages exactly from `package-lock.json` (`npm ci`, quick), regenerates the island pictures and ports (`make_islands.py`) and runs the tests.
- If the game is running (for example in `tmux attach -t naval`), stop it with Ctrl+C first and start it again after the update.
- After `make_islands.py`, check `git status` before committing from the server: `islands.json` is generated and differs between machines.
- In the browser, hard-refresh after a rebuild (Ctrl+Shift+R; on iOS close and reopen the tab).

### Ideas for the world

Your list of 17 Nov (day and night, repair and trade by the clock, night theft, night gunnery, sight / silhouette / flag, weather, hidden reefs and currents, cities that trade and grow rich, caravans, hiring pirate bots, learning from strategy games) is written up with my conclusions in the new document **`world-ideas-en.md`** (and `world-ideas-ru.md`). Main points: one foundation, **perception** (bots see only their contacts), comes first, as its own step after M4; no time zones; the plan's 2-minute game day is too short for night (16 minutes recommended, open decision O5); most parts fit M5 (which brings the clock, ports and market anyway), theft, caravans and hirelings fit R4, storms and false flags Stage 2. Nothing enters M3 (D37). Item 10 of your list was empty.

---

## 17 Nov 2026 — M3 step 3b: no ship on land at the start, and arena log v2

### What you asked

Check that a bot can never appear on an island, and think what else the log should collect.

### What I found (the spawn check)

- The normal ways are safe: `openWaterSpot` (duels, arena respawns) asks `isOpenWater` (60 m of free water, away from the reef). 400 arenas × 6 bots (2400 ships): 0 on land.
- **Three holes**, all in rarely used paths: (1) the arena start had a fixed fallback place (`-2000 + 700·i, 0`) if 40 random tries failed: on my islands 3 of those 24 places (x = 2200, 2900) are land, on yours it can differ; (2) the command `placeShip` had no check, so the test buttons "target abeam / upwind" put the target on land in 15 of 360 trial places; (3) there was no watchdog: nothing would tell us if a ship ever stood on land.

### What changed

- `sim/spawn.ts`: `isOpenWater` (the one question every spawn asks), `nearestOpenWater` (rings of 16 points every 40 m, no random numbers), `gridSpot` (the last resort: the whole sea in a 250 m grid from a seeded start).
- Arena: random tries, then the grid; if there is no room at all the bot is left out (the log header lists who came). **No fixed places any more.**
- `placeShip`: a place on land becomes the nearest open water within 800 m; if there is none the command is ignored.
- `sim/land.ts`: `distanceToLand` (for the log only); `sim/geometry.ts`: `distanceToSegment`.

### Arena log v2 (`view/arenaLog.ts`)

- Header: build label, **fingerprints of the data** (islands, ships, guns, damage, bots, shore, arena, wind, world: if yours differ from mine the hash differs), sea and wind, ports, seed.
- Every bot line and respawn: position, distance to the nearest land (and its name) and port; WARNING if a respawn is closer than 60 m to land.
- Every SUNK line gets a detail line: place, how the loser was sailing (mode, speed, sails, wind angle, aground, offender) and the killer (mode, distance, hull, speed).
- Watchdog, once a game second: **ON LAND** (not aground), aground start / floats free / **STUCK > 20 s**.
- Wind line at the start and at every turn of 15° (or 0.1 strength); flee / port / outlaw lines carry hull % and place.
- Summary table by class (wins, losses, mean life, balls, hits/ball, shore deaths, aground, stuck) and collisions; warning count.
- First findings in a 20-minute run: the merchantman and the frigate ran aground 11–13 times each near Isla Verde's port (the inlet), 126 collisions in 20 minutes (ramming), 0 warnings on land.

### Hull bars over the ships (your request, a small view-only step)

- `view/shipBar.ts` (where the bar goes, how wide, how full; 4 tests) and `scenes/ShipBars.ts` (one Graphics, redrawn every frame, above the ships, below the HUD). Picture only: nothing in `sim/` changed.
- A 3 px bar over every floating ship, centred, placed above the masts or the bow / stern for the current heading, 16–48 px wide by ship size and zoom, on whole pixels. Colours as in the HUD (green above 50%, yellow above 25%, red below; at least 1 px while afloat). Hidden for a sunk ship and, in a duel, for your own ship (it has its panel); in the arena every ship has one.
- Tuning → View → "ship bars" switches them off. Checked in the headless browser (computer; the arena shows the bar under the name label); the phone layout was not checked by eye.

Tests: 292 (273 + 15 + 4). Not verified: your own `islands.json` (the log header and the WARNING lines will show it).

## 16 Nov 2026 (night, 3) — M3 step 3: port law (D40) and the shore guns

### Before the code

New chat, code taken from GitHub (`2fc0db4`): 242 tests (241 + your angle test), build clean. Your arena log (79 game minutes) read: 42 wins; 37 of the 42 sunk ships had turned for a port less than 2 minutes before; frigate 19 wins, merchantman 1 win / 9 losses; ramming in chains. The "broadsides" column really counted balls. Your answers: a shot from outside at a ship in port = half damage and the shooter is an offender; pardon after a wait beyond 450 m (45 s chosen); the log label and the mode reset go into this step.

### Two new ideas in the code

- **The offender flag** (`ShipState.offender = { port, forgiveLeft }`): a ship that broke a port's peace. It is plain data on the ship, so saves and tests repeat exactly.
- **A gun owner that is not a ship** (`sim/shore.ts`): a port's battery has its own timers in the world (`world.shore`); its balls go into the same `world.balls` list with an owner id below 0 (port 0 = −1), so flight, hits, splashes and pictures need no second copy.

### The rules (`sim/law.ts`)

- Fire rule: a broadside fired in safe water costs the shooter 2% of its full hull (never the last point) and makes it an offender. It is free when an offender of that port is within 450 m (you are helping the port).
- Hit rule: a ball on a law-abiding ship in safe water does half damage and makes the shooter an offender, wherever he fired from. Ramming still does nothing to a law-abiding ship there.
- An offender: full damage in port, no repair (port or sea), a legal target for everybody, fired at by the shore guns within 450 m of the anchorage. Pardon after 45 s beyond 450 m; coming back starts the clock again.
- Shore guns (`data/shore.json`): 3 per port, 105 m/s, −8…18°, reach about 660 m (every place inside the 450 m ring of both ports; a test checks it), reload 10 s, one gun about every 3.3 s, damage 40, spread 1.0° with the same sigma formula as ships, plus the gunners' misjudgement (0.6°). They lead a moving ship. Their balls hurt offenders only.
- Bots: no fire from safe water or at a protected ship; no fire when the balls would come down in safe water (an enemy just slipping into port); an offender is attacked even in port; an offender bot sails straight out (mode `outlaw`) until pardoned.

### Also

- Arena log: "balls" and "hits/ball"; lines "PORT LAW: … an offender …", "… is pardoned …", "sunk by the shore guns of …" (nobody's win).
- Mode reset: `chooseTargets` set every bot with a new target to `chase`. A bot in `port` or `repair` with 30–90% hull then left its repair and went back to fight. Now such a bot only notes the new enemy. Three headless hours: 13–20 wins an hour before and after, so the pace did not drop.
- `maxBallSeconds` 6 → 8: a shore ball at 18° flies 6.7 s.
- `make_islands.py`: three gun platforms per port, drawn without random numbers (island shapes unchanged; checked).

### Measured

Sloop, 8 seeds: lying in port after one broadside = sunk in 43–101 s (7 hits); sailing straight out under full sail = 8 shots, 0–4 hits, pardon 70 s after the broadside. Frigate: sunk in about 1.5–2 min if it stays (18 hits); 2–5 hits if it leaves.

273 tests (31 new: `law.test.ts`, `shore.test.ts`); build clean; headless computer and iPhone 13 landscape: broadside in port → "OFFENDER!", shore guns fire and hit, sailing out → "PARDON 44s" → pardoned; no errors (only the old missing favicon).

**Not checked:** your own `islands.json` (the gun places are computed from your village island; if a place falls in the water the tool moves it inland or leaves it out and says so). An offender bot inside the inlet harbour steers "away from the port", not along the inlet; bots become offenders only by a stray ball, so this waits.

**Next:** sail and crew damage, 3 ammunition types.

---

## 16 Nov 2026 (evening, 2) — M3 step 1b (fixes) and step 2: the auto-bot arena

### Your test of step 1

Ships × 1.5: the frigate is too big; stop at × 1.2 for now. The inlet: hard to get out against the wind, big ships and bots got stuck (screenshot); idea: a port at its end. The solid port works, but a ship can wedge itself between the piers (screenshot). Hull points × 1.5: fine. The combat zoom is now too close: smaller, a button to cancel it on every screen, the spyglass on the computer too, the mouse wheel for zoom and spyglass. New: a damaged ship (< 50%) sails slower, the wind should change now and then, and an auto-bot test mode. Your choices: auto-bot = M3 step 2 (port law → step 3), 6 bots with respawn, time x1–x8, a second port at the end of the inlet.

### Step 1b

- Ships × 1.2 (sprites re-rendered), hull points × 1.2.
- Zoom: combat zoom at most × 1.5 (detail sprites from × 1.5); auto-zoom button (magnifier with "A", crossed when off) on computer and touch; spyglass icon on the computer; wheel = zoom steps 1 / 1.5 / 2 / 3 and auto zoom off; wheel click = spyglass.
- Port: an invisible wall ("berths") over the water between the outer piers.
- Inlet: 150 m wide, bend 40 m, ends in a round harbour (r 85 m) with a quay, houses and the flag; that harbour is the second neutral port. Bots sailing to it follow the inlet's middle line (`portWaypoint`); a test sends a badly hurt bot from outside into the harbour.
- Damage slows: below 50% hull the target speed falls in a line to 60% at hull 0; up to 3 m/s never cut.
- Wind shifts: every 150–300 s the base direction turns 30–90° to a random side; the wind follows at most 6° per drift.

### Step 2: the auto-bot arena

- `sim/arena.ts` (rules) and `view/arenaLog.ts` (the log); screen: `scenes/ArenaHud.ts` and the arena part of `SeaScene`.
- A first 30-minute headless run: 3 wins only. The bots flee at 30% hull and repair in port, so few fights end in a sinking; the frigate won all three. 500 wins will take many hours even at x8 — the log will show where the bots lose their time (chases, ports).

241 tests; build clean; headless computer and iPhone: arena runs at x8, NEXT / drag / log download work, no errors.

**Next:** step 3 — port law (D40).

---

## 16 Nov 2026 (night) — Package C4 and M3 step 1: ships × 1.5

### Your test of C3

Spyglass: good. Wishes: the port's piers and boats must be solid; the inlet looked like a pipe. Go on to M3.

### C4

- Solid port: `make_islands.py` writes the quay, three piers and five boats as polygons (`solids`); `data.ts` turns them into islands of kind `structure` (no picture, not on the chart). `touchesLand` now also checks land corners inside the hull's rectangle and land edges crossing it, so a thin pier between the bow and the middle point counts.
- Winding inlet: S-shaped, swinging 70 m, ragged banks, faces a little south of the middle of the sea; the tool checks that the shore does not cross itself. Tests: a 1.5 × sloop fits along the whole middle line; a ship lying across a pier touches it.

### M3 step 1 (D39)

- `ships.json`: length, beam, hull height, mast height × 1.5; hull points × 1.5 (the bigger target is hit more often; `hit_table.py`: 3.6 / 2.2 / 1.8 / 1.4 hull hits per salvo at 50 / 100 / 150 / 200 m, salvos to sink at 150 m ≈ 7 as before).
- `render_ship.py`: `SIZE = 1.5`, bigger frames; all sheets re-rendered (4 min).
- Bot: when steering clear of an enemy it keeps 40 m from its hull (with 130 m it shied away from its own fighting range).
- HUD: panels fade 26 px round a ship (was 18).

225 tests; build clean; headless computer and iPhone without errors.

**Next:** M3 step 2 — port law (D40).

---

## 16 Nov 2026 (evening) — Your test of C2; package C3: port, inlet, spyglass, Linux server

### Your test

Phone layout, getting off the reef and the fog: fine. Wishes: a bigger port along the shore, an invented flag, 4–5 bigger boats; a river a ship can enter; the touch zoom button seemed to do nothing. Decisions: ships × 1.5 (D39) and the port law (D40) both in M3. Question: running the game on an Ubuntu server.

### Done (C3)

- Port picture: 100 m quay along the shore, three piers, five boats (two sloops, a ketch, two rowing boats), four warehouses, 16 houses, an invented flag. Anchorage now 70 m off the main pier.
- Inlet on Isla Verde: `carve_inlet()` in `make_islands.py` cuts a 110 m wide, 300 m deep channel toward the middle of the sea, with a wide river at its head. A test checks that a sloop, and one 1.5 × bigger, fits all along it.
- Spyglass: the zoom button did change the zoom, but in a fight the automatic combat zoom overrode it. Now it is a spyglass: tap (touch) or V (keyboard) → view x0.5 for 12 s with a dark round ring, the button frame lit; again to put it away. Z / X still zoom on a computer.
- Linux: `scripts/setup-linux.sh` (git, curl, Node 22+ from Ubuntu or NodeSource 24, uv, `npm ci`, islands, tests, build, ufw ports 5173 / 4173) and `scripts/run-linux.sh dev | preview | test | update`.

223 tests (1 new: the inlet); build clean; headless computer and iPhone without errors; `run-linux.sh test` and `preview` checked here (Ubuntu itself not tested).

**Next:** M3 step 1 — ships × 1.5.

---

## 16 Nov 2026 (later) — Your test of package C; package C2

### Your test

Port, safe water, repair and bots waiting outside: all work. Wishes: big islands on the chart from the start; more and longer fog; wider shoals; more rivers to find; L R back where they were; zoom and sound to the top middle; a shorter, lighter target card; a port that looks like a port; ships get stuck on the reef and islands. Wake accepted; the volcano waits for a later stage. New idea: port law with shore guns.

### Done (C2)

- Touch: L R above the rudder again, gun buttons at the right edge again; zoom and sound in the middle of the top edge; target card 112 × 22 in the narrow font, plate at 12%. Distance labels at the edge are not written over buttons.
- Chart: big islands and the port island known from the start (`newChart(ISLANDS)`).
- Fog: 5 bands of 16 puffs, 0.9–1.6 km long, lying along the wind.
- `make_islands.py`: shoal 56 m; rivers 3 per big island, 1 per medium (2–3 px wide), river mouths printed; port: bigger village, two plank piers with posts, a sloop and a rowing boat, a warehouse, a flag; anchorage 70 m off the main pier. Each island picture has its own random numbers (shapes are stable from now on; this time the generated islands moved once).
- Grounding: an aground ship turns at the full turn rate (the crew warps it round), the push-off tries 0.15, 0.45 and 0.9 m.
- Port law with shore guns: recorded as D40 (proposed) in the plan.

222 tests in the sandbox (2 new: aground turning, getting off the reef); build clean; headless computer and iPhone without errors.

---

## 16 Nov 2026 (afternoon) — Fixes after your test of B2; package C: port, fog, shoal water. M2b complete

### Your test of B2

"pixels / metre" 1.5 is too tight; bigger ships in the world are the better way (D39, M3). Speed: 1.5–2.0 felt right; wind 0.8 with slow changes (D38). Phone: better; wishes for the minimap, the target card, a smaller ship panel, L and R at the screen edges. The wake was too heavy at the bow; the volcano looked flat.

### Fixes

- **D38**: `maxSpeed` × 1.75 in `ships.json`; wind starts at 0.8 and drifts between 0.6 and 1.0 (`wind.json`); bots fight at 7.5 m/s and keep 130 m clear of other ships.
- **Touch layout**: L above "<" at the left edge, R above "+" at the right edge, gun up / down in the column beside R, angle and range above R; minimap at the right edge under the gear; target card under my ship, lighter; phone: ship panel 112 × 44 with a small compass and the speed in the 8 px font.
- **Wake**: small foam specks behind the stern (each a little different), bow waves faint and short.
- **Volcano**: `make_islands.py` draws a mountain over the whole island as seen a little from the south (heights lifted up the picture, nearer slopes cover farther ones), gullies, wooded foot, crater with lava and smoke.

### Package C

- **Port** (`sim/port.ts`): the village island. Safe water 300 m round the anchorage: no ship inside can fire, none takes damage. A ship lying still (≤ 2 m/s) within 90 m of the anchorage is repaired to 90% at 2% per second. Bots: under 30% hull and a port within 2500 m → mode `port` (sail there, stop, leave at 90%); an enemy in safe water is not attacked, the bot waits outside (`idle`).
- At sea: a dotted green ring round the safe water, a buoy at the anchorage; the port on the chart and the minimap; HUD "SAFE WATER", a second tick (90%) on the hull bar.
- **Fog** (`scenes/Fog.ts`): six banks drift down the wind. Picture only; "fog" check box.
- **Shoal water**: every island picture now has paler water with wave crests round it and muddy water at river mouths.

### Checks

220 tests (221 with your angle test): 9 new for the port, among them a bot that sails in, is repaired and comes out. Build clean; headless on computer, iPad, iPhone without errors.

**Not checked:** your own `islands.json` (the port's anchorage is computed from your second island; in my copy it lies in open water).

**Next:** M3 — starts with D39 (bigger ships, new sprites) and class balance.

---

## 16 Nov 2026 — Your test of package B; package B2: lighter phone HUD, minimap, wake, island pictures

### Your test results

All of package B works on computer, iPad and iPhone; a battle with three bots is more fun than a duel. Fonts on the real iPhone are right. Wishes: a see-through minimap, smaller on a computer and bottom right on the phone; slower repair; bots closer at the start; too many things on the iPhone screen; the two old islands are bare; ships look small on a computer; a stronger wake; a faster game; a sea shaped like the Caribbean; a port; different water near the shore.

### Done in B2

- **Touch HUD**: the guns panel is gone. The L / R fire buttons are yellow when loaded and count the seconds while reloading; the gun angle and range are two short lines next to the gun buttons. The target card shows only when the enemy is within 400 m. No distance labels on the rings. Plates are lighter.
- **Minimap**: no dark plate (a faint tint and a thin frame); computer 108 × 72 px; touch: bottom right, above the "sails less" button. It is still the chart button.
- Distance labels of far enemies are no longer written over a HUD panel.
- **Numbers**: repair 0.7 → 0.5% of the hull per second; bots start 400–800 m away.
- **Wake** (`scenes/Wake.ts`): every ship leaves two bow waves that spread into a "V" and foam behind the stern; brighter and longer at speed.
- **Hand-made islands**: `tools/make_islands.py` now also paints the islands of `islands.json` (the first a volcano, the second a village with a pier; `"theme"` in the JSON overrides). The zip does not contain `islands.json` (yours differs from mine), so run the tool once.
- Words: "battle" instead of "duel" in the tuning panel.

### Answers

- All three sunk: the VICTORY banner with "All 3 enemies sunk", time and hits, then SAIL AGAIN.
- The old islands were bare because they are polygons from M1 drawn by simple code; the generator painted only its own islands.
- Ramming with bigger ships can be tried with the target class in the tuning panel; real class balance is M3.

### Open (your choice needed)

Ship size on the screen and game speed: see the plan (M2b, open questions). Caribbean-shaped sea: recorded for M5.

211 tests (212 with your angle test); build clean; headless on computer, iPad and iPhone without errors.

**Next:** package C (port on the village island, fog, shoal water).

---

## 15 Nov 2026 (late night) — Package B: collisions, fleeing, repair, three bots; minimap and your UI wishes

### Your test of package A

Computer: all good. Wishes: close the chart with ESC; on iOS the Tuning panel covered the chart button; start the next duel near the place where the last one ended; a minimap that can be switched off. Your iPhone screenshot also showed plain letters instead of the pixel fonts.

### Package B (rules, all in `sim/`)

- **Collisions** (`sim/collide.ts`): a hull is a turned rectangle; two hulls that overlap are pushed apart (the lighter ship moves more; never onto land) and keep 20% of their speed. Damage = closing speed × 6 × the other ship's share of the weight; below 1 m/s nothing; the ship that strikes with its bow takes half. New `mass` in `ships.json` (sloop 100, brigantine 170, merchantman 420, frigate 600). All hull damage now goes through one function (`sim/damage.ts`), so ramming can sink a ship too.
- **Repair at sea** (`sim/repair.ts`): sails at 25% or less, no enemy within 500 m, hull below 75% → +0.7% of the hull per second up to 75%. The same rule for bots. HUD: green "REPAIRING", a tick at 75% on the hull bar.
- **Bot**: new modes `flee` (hull under 30%: sails away from the nearest enemy, still around land) and `repair` (safe → lowers sails and repairs, then comes back). Bots steer around other ships (`avoidShips`).
- **Three bots** ("bots (next duel)" 1–3 in the tuning panel): placed at random open-water spots 600–1200 m away (`sim/spawn.ts`, from the world's seeded RNG). Victory = all enemies sunk. A new duel starts where the last one ended, with a new seed.
- Numbers: `data/damage.json`, `data/bots.json` (`fleeHullShare`, `shipAvoidM`, `shipAvoidTurnDeg`).

### UI

- **Minimap** (`scenes/Minimap.ts`): the whole sea with what you know from the chart. Computer: bottom right (it steps left when the tuning panel is open); touch: in the top row in place of the chart button. A click or tap opens the chart. "minimap" check box in the tuning panel.
- **ESC** closes the chart. **Tuning** on touch screens is a small gear button in the top right corner; opened, it is the usual panel and scrolls.
- **Fonts on iOS**: the game now loads both pixel fonts itself (`FontFace`) and waits for them before Phaser draws any text. Checked only in iPhone emulation, so please check on the real iPhone.

### Checks

211 tests in the sandbox (212 with your angle test); build clean; headless on computer and iPhone: three bots chase, ramming damages both ships and they do not overlap, repair works, C / ESC, restart near the old place, no errors.

**Known, small:** distance labels of far enemies at the screen edge can sit on top of a HUD panel or of each other.

**Next:** package C (neutral port, fog).

---

## 15 Nov 2026 (night) — New plan step "Open Sea" (D37, proposed); package A: sea, islands, chart

**Your answers to the main question:** the approach can be long; there are few decisions in a duel; the bot is strong, and boarding, ammunition types and a stronger wind are missing. Your proposals for the next update: a chart, borders of the sea, fog, ship collisions, fleeing, repair at sea, more islands (bays, mountains, trees, rivers, islets), two more bots, a neutral port.

**Plan:** M2 is closed as R1 "First Duel" (you confirmed you can win and lose on computer and iPhone). New milestone **M2b "Open Sea"** (decision D37, confirmed by you the same evening) in three packages; this is package A.

### Package A

- **The sea** (`data/world.json`): 6 × 4 km, closed by a **reef** 60 m wide along the four edges. For the rules the reef is land, so ships ground on it and bots avoid it with the rules that already exist; the picture is pale water with rocks and foam.
- **Islands by code** (`tools/make_islands.py`, numpy + Pillow, about 3 s): 3 big islands with a mountain (height bands lit from the west), a small river and one or two bays deep enough to sail into; 6 medium islands, some with a bay; 9 small islets with palms. Each island has a shore polygon (40 corners, for collisions) and a picture at 1 px per metre, made from the same numbers, so they always fit. Kept clear of the start, of your islands and of the reef; at least 170 m of water between islands. `docs/art/world-preview.png` shows the whole sea.
- **The chart** (key **C** or the map button next to the sound button): parchment over the screen; the reef, the islands **you have seen** (big names written), a 1 km grid and scale bar, the wind; your ship as a yellow arrow; other ships red while on your screen, pale with "?" at the place you saw them last. A click or tap on the chart closes it; the game goes on behind it.
- New: `sim/types.ts` (`Island.kind`, `Island.picture`, `WorldBounds`), `sim/data.ts` (`WORLD`, `reefs`, all land in `ISLANDS`), `scenes/Islands.ts` (pictures, reef tiles), `view/chart.ts` (what you know: `discover`, `updateSightings`, `chartFit`; 4 tests), `scenes/Chart.ts`, chart icon, `sim/worldData.test.ts` (4 tests: reef on all sides, islands inside and apart, open water at the start, a ship cannot leave the sea).
- 187 tests in the sandbox (188 with your angle test); build clean; headless: islands, reef, chart on computer and iPhone, no errors.

---

## 15 Nov 2026 (evening) — Your test of steps 4–7; UI fixes, pixel fonts, bot closes in

### Your test results

| Area | Result |
|---|---|
| Bot | Closes in to about 160–180 m, turns its side, fires when lined up; tacks upwind; gives up a long chase; turns to keep you off its bow and stern; avoids islands well |
| Problem | With you stuck at an island, the bot stayed to leeward at about 180 m, firing badly, and never closed in |
| Difficulty | The bot feels quite accurate; frigate broadsides are almost always fatal |
| Duels | You can win against a sloop; against a big ship almost never. A duel lasts **about 5 minutes** |
| Banner | Works (button, Enter, restart); **the font looked jagged and the text shook** on the computer (much less on the iPhone) |
| Sound | All events have sounds; hull hits a bit loud, hits on your own ship much too loud; **M mutes but nothing shows it** |
| Effects | Shake, ghost cross, hit flash, sinking: good; **gun smoke drifts too little** |
| Classes | Look fine; most should be even bigger; a merchantman could be frigate-sized, but heavy, few guns, small crew |
| 16 or 32 | 32 looks a little more natural → **D33 decided: 32** |
| iPhone/iPad | Everything works; a mute button on the screen would help; text hard to read on the iPhone; panels sometimes cover a ship |
| Fun check 1 | Your mark: **2 to 3** |
| Hours | Not recorded; this log keeps a short account of the work instead |

### What changed

- **Pixel fonts (the jagged, shaking text).** The game draws in logical pixels and scales the whole picture by a whole number (x3 on your computer, x4 on the iPhone). Text was drawn 4 times larger and squeezed into that grid; at x3 that broke the letters and made them shimmer. Now: two real pixel fonts drawn exactly on the grid (resolution 1): **Press Start 2P** (main, 8/16/24 px) and **Silkscreen** (dense text, 8 px), both SIL Open Font License, in `client/public/assets/fonts` with their licence files; loaded before the game starts (`scenes/text.ts`, `loadFonts`). The game also uses `roundPixels`, so nothing is drawn between two pixels. A browser test found the sizes at which each font has no blurred pixels.
- **Sound button** (a speaker icon; red cross when muted): top left on the computer, next to the zoom button on touch screens; click or tap to switch; M still works.
- **Panels never hide a ship:** when a ship's centre comes within 18 px of a panel, the panel fades to 25% (smoothly). Touch screens use lighter plates (0.42). The target card moved under the zoom and sound buttons on touch screens (the collapsed Tuning panel covered it on the iPhone). Layout tests extended.
- **Banner** shows the duel in numbers: time and hull hits ("3:42 hits: you 9 enemy 4"); this measures fun check 1.
- **Sounds:** hull hits softer (0.6), hits on your own ship about half as loud again.
- **Gun smoke** now leaves the gun port outward and drifts with the wind 8 m/s at full strength, lasts 3.6 s, grows less (it no longer hides the ship).
- **Bot closes in:** the range bend is now smooth (no dead band, which let it sit at the band edge, about 180 m, for ever), and when it is much too far (more than preferred + 60 m) it sails straight at you under full sail, beating if needed. Headless: from 240 m to leeward it reaches its preferred range in about 50 s and stays there (new test).
- **Bot accuracy** a little lower: judgement error 0.5–1.1° and it fires when the aim point is within 16 m of its line of fire. Headless against a ship lying still: about 0.8 hull hits per salvo, the same as your 0.82 by hand. Its edge is the perfect lead; skill tiers (green/regular/veteran) come in M3.
- **Frigate too strong:** by design for now: 12 guns against 4. Class sizes and balance go to M3 (plan updated).
- **32 directions** are the default now.

### Open

- Fun check 1 at 2–3: what made it boring or frustrating? (Long approach? Too few decisions? Bot too strong?) Your answer decides the tuning week before M3.

179 tests in the sandbox (180 with your angle test); build clean; headless on the computer and iPhone: crisp text, mute icon, fading panel, banner with numbers; no errors.

---

## 15 Nov 2026 (later afternoon) — Bot gives up; win/lose; step 6 juice; step 7 ship classes

Built while you test the bot. Your question: *a bot on the same course chases me for ever — how can we add chance and variety?*

### Bot: giving up and personality (part of step 4)

- **Giving up:** in a chase the bot checks its progress. If it has not gained at least 50 m in its *patience* time, it **breaks off** for 90 s (sails away), then may chase again. Within 250 m it always fights. So an equal or faster ship can escape, and that is part of the game. Headless test: two sloops running before the wind on the same course: the bot breaks off and you get away.
- **Personality:** each bot draws its own values once, from the seeded generator: preferred range 115–165 m, patience 45–90 s, aim judgement σ 0.3–0.8°. Bots differ, and the same seed still gives the same game.
- **Your idea of ship variety** (weight, a fouled bottom, a tired or short crew) went into the plan, not into M2 (rule: a new idea never enters a milestone that has started): **M3** small random speed factor (±3–5%) per ship, crew shortage and fatigue slow speed and reloading; **M5** hull fouling over the days, careening or the shipyard in port, cargo weight.

### Win and lose (rest of step 5)

`scenes/Banner.ts`: 1.5 s after a ship sinks, "VICTORY! Enemy sloop sunk" or "YOUR SHIP IS LOST", with **SAIL AGAIN** (tap, click or Enter).

### Step 6: juice

| Effect | How |
|---|---|
| Sound | `tools/make_sounds.py` makes 5 sounds **by code** (noise, filters, falling sine "thump"; no recordings, no licences): cannon, splash, hull hit, sail hit, sinking → `client/public/assets/sounds/*.wav` (about 300 KB). `scenes/Sounds.ts` plays them quieter with distance, left/right by screen position, each shot a little different in pitch. Key **M** or the panel: sound on/off and volume |
| Screen shake | small when you fire, stronger when your hull is hit, a long one when a ship sinks (panel switch) |
| Gun smoke | two grey puffs per gun drift downwind with the real wind and fade |
| Ghost cross | a faint cross stays where your salvo was aimed while the balls fly, so you can see how far the target moved |
| Hit flash | the hit ship flashes white for 0.1 s |
| Sinking | a big ring and bubbles for two seconds |

Effects now live in game metres (before, they stayed put on the screen when the zoom changed).

### Step 7: the other ship classes

`tools/render_ship.py` now draws **brigantine** (40 m: square sails on the foremast, gaff mainsail), **merchantman** (56 m: broad, three masts, high stern, cargo on deck) and **frigate** (70 m: full square rig, a row of 12 gun ports a side, gold on the stern). The sloop code was not touched; its sheets are pixel-for-pixel the same.

- One hull builder (`Hull`, `HullSpec`) and rigging helpers (`square_sail`, `gaff_sail`, `jibs`, `shrouds`).
- **Square sails seen from above:** a flat sail seen edge-on is only a line, so the sails are *filled*: the foot is pushed forward (most in the middle), and the yards are braced 30°. Ships heading away from the camera still show the sails thin (draft art; final art in M8).
- A frame size per class (64/80/96/112 px, in `shipArt.json` `frames`); the downsampling is vectorised with numpy (the whole set renders in about 2.5 min). `python tools/render_ship.py frigate` renders one class.
- Preview: `docs/art/ship-classes-preview.png`. Try them in the game: panel → Target → class.

### Open

- **Your choice: 16 or 32 directions** (panel "Art (test)"), then the M2 "done when" check and fun check 1.

176 tests in the sandbox (177 with your angle test); build clean; headless: sounds load, smoke and ghost cross show, banner and Enter restart work, all classes show; no errors.

---

## 15 Nov 2026 (afternoon) — HUD liked; M2 step 4 built: the bot

**Your feedback on the HUD:** the panels and icons look professional; the enemy hull bar helps; hidden debug text accepted. iPad test running.

### The bot (waiting for your test)

- **`sim/bot.ts`**, a small **state machine**: *chase* (far: sail toward you, beating against the wind if needed), *engage* (within 250 m: turn a broadside to you and keep about 140 m), *idle* (you are sunk: lie still). Gap between 250 and 300 m so the mode does not flip.
- **Fair play:** the bot sees only positions, headings and speeds, and acts only through commands (`setRudder`, `setSails`, `setElevation`, `fire`), like you. Its balls get the same random errors as yours (Battle 4). It raises the guns at 4°/s (your key speed) and misjudges the elevation a little (σ 0.5°, new after each shot).
- **Sails by the wind** (your idea): while fighting it sets the sails so it moves at about 4.5 m/s on any course (`sailsForSpeed`).
- **Tacking:** a course into the wind becomes close-hauled (15° outside the no-go zone); it stays on a tack at least 20 s (hysteresis), then goes about if needed.
- **Aiming:** where you will be after the flight time, using your motion relative to its own (the ball keeps the bot's speed). It fires only when that point lies within 10 m of its line of fire (the guns fire straight abeam).
- **Land:** looks 60 m or 10 s ahead with a "fat" hull (15 m clearance) and turns to the first free heading.
- **Memory** (`BotState`) lives in `world.bots`, so a save or a test repeats exactly. `thinkBots` runs in `Simulation` after your commands, every 3 steps (reaction time 0.1 s). All numbers in `data/bots.json`.
- **Panel → Target:** *behaviour* bot (default) / circle / moored; **restart duel** (fresh world, panel settings kept); **put 400 m upwind**. The game starts with the bot 400 m to windward, so it comes down on you at once. Debug text (H) shows the bot's mode and side.

### Problems found and fixed

| Problem | Cause | Fix |
|---|---|---|
| Headless: the bot scraped an island's corner and stuck there for a minute | It looked for land only straight ahead; the corner was beside the hull | Look ahead with a hull 15 m wider and longer, at three points (near, middle, far) |
| Only 0.1–0.4 hits per salvo | It fired whenever you were within 20° of its beam; the guns fire straight abeam, so 20° off at 150 m is a 55 m miss | Fire only when the aim point is within 10 m of the line of fire → 0.6–1.0 hits per salvo, like a player |
| Few salvos | After each salvo it turned almost round to use the loaded side | Change sides only if the turn is under 90°; now one salvo per reload |

- Headless numbers (you lying still, bot from 400 m to leeward, 5 min): first shot after 90–140 s (it must beat up to you), then one salvo about every 15 s, about 0.6 hull hits per salvo.
- 172 tests in the sandbox (173 with your angle test); build clean; headless browser: the bot closes in, turns its port side, hits you; restart works; no errors.

---

## 15 Nov 2026 — Step 3 tested; new HUD

**Your test of step 3:** at 150 m by hand **0.82 hull hits per salvo** (9 / 44 balls; perfect aim in the script gives 1.2); wind 1.0 makes the ellipse longer, the target sank after 9 hits / 24 balls; the moving target sank in about **2–2.5 min** (target 2–4 min). Gun sigma between 1.2 and 2.0–2.5 feels right; **1.8 stays**. Your idea: the target should set its sails by the wind → the bot (step 4) does that.

### Your UI review → new HUD (part of step 5, built before the bot)

| Your point | What changed |
|---|---|
| Computer: text covers the picture, hard to read at x2 and in motion | Three small panels on dark plates: **my ship** bottom left (compass, speed, sail pips, hull bar, IN IRONS / AGROUND), **target** top centre (class, distance, hull bar), **guns** bottom centre (port / starboard discs: yellow = loaded, a grey pie fills while reloading; elevation gauge, angle, range). All the numbers and keys moved into the **debug text**, hidden until **H** (or "debug text (H)" in the panel) |
| iPad: the compass under the rudder buttons | My ship panel (with the compass) is now top left on touch screens; guns bottom centre between the button groups. A test checks on four screen sizes that no panel lies under a button |
| Elevation buttons: better symbols | Option A: **pixel gun icons** (barrel up + arrow up, barrel down + arrow down), **stacked**: up above down, above "+" |
| Computer: the same icons as a reminder, keys + and - | The gun icons with "+" / "-" are in the guns panel (they can be clicked too). Keys **+ / -** on the main keyboard and on the number pad; R / F still work |

- New: `view/hudLayout.ts` (panel and button places, hull bar colour; 9 tests), `scenes/icons.ts`, new `scenes/Hud.ts`, `TouchControls.ts` by named places, `Compass.place`. Range ring labels moved to the upper left (the target card is at the top centre).
- 157 tests in the sandbox (158 with your angle test); build clean; headless computer, iPad, iPhone: no errors.

---

## 15 Nov 2026 (after midnight) — M2 step 3 built: accuracy and spread; moving target

### What was built (waiting for your test)

- **Two random errors (plan 4.4)** in `sim/accuracy.ts`:
  - *salvo error*: the ship's roll; one number per broadside, in elevation, so the whole salvo lands long or short together; drawn when you fire and kept in each `PendingShot` (`salvoErrorDeg`);
  - *gun error*: each ball, in elevation and in direction.
  - Formulas unchanged from the plan: `σ_gun = 1.8° × (1.4 − 0.06 × Battle) × …`, `σ_salvo = 0.6° × (1 + wind) × (1.2 − 0.04 × Battle)`. Crew shortage, gun wear and ammunition stay neutral (M3). New `ShipState.battleSkill` = 4 for both ships until captains (M6).
  - Random numbers from the seeded generator: `nextGaussian` (normal distribution, "bell curve") in `sim/random.ts`. The same seed gives the same shots.
- **`tools/hit_table.py`**: Monte Carlo in Python (same flight steps and same box test as the game). Perfect aim, Battle 4, wind 0.7: **3.2 / 1.8 / 1.2 / 0.9** hull hits per salvo at 50 / 100 / 150 / 200 m. D28 wants 1–2 at 150 m and 0–1 at 200 m, so base σ is **gun 1.8°, salvo 0.6°** (`guns.json`). Try `python tools/hit_table.py --gun 1.5 --battle 8`.
- **Guard test** `accuracy.test.ts`: 300 salvos with the real TypeScript code at 150 m must give 1–2 hits. Old exact tests (balls land on the cross) run with `withPerfectGuns()` (`sim/testing.ts`).
- **Landing ellipse** around each cross (`LandingMarkers.ts`, `landingSpread` in `sim/guns.ts`): long along the line of fire (elevation error, about ±40 m at 150 m), narrow across it (direction error, about ±5 m). 1 sigma (`view.json` `landingEllipseSigmas`).
- **Moving target** (`sim/circle.ts`): with 30% sails (about 1.3–2.8 m/s) it sails clockwise round a 150 m circle that starts to its starboard. A circle runs into the wind somewhere, so there it tacks and sails close-hauled across the circle, then follows the circle again. It is steered by commands like every ship. lil-gui *Target*: "moving (circle)", "sails %", "circle radius (m)"; "put at …" starts a new circle.
- **Hit count** in the computer HUD: "hits 5 / 24 balls = 0.83 per salvo of 4"; lil-gui *Accuracy*: both σ sliders and "reset hit count".
- 148 tests in the sandbox (149 with your angle test); build clean; headless computer and iPhone, no errors.

### Problem found and fixed

| Problem | Cause | Fix |
|---|---|---|
| First version: the target drifted away and stalled near the wind for over a minute | It turned at speed / radius; close to the wind the speed fell, so the turn became very slow | Fixed circle centre, steer along the tangent; where the circle points into the wind, tack and sail close-hauled |
| Then it flipped between two courses near the wind | The choice "follow the circle or tack" had no memory | `tacking` memory (hysteresis): the tack ends only when the circle can be followed with the wind on the other side |

---

## 14 Nov 2026 (late night) — Touch fire buttons; art settings kept

**Your test on iPhone and iPad:** there was no way to fire the guns. My mistake: touch buttons for the guns were planned for step 5, but the phone could not test steps 1–2 without them. Fixed now.

- **Second button row** (`scenes/TouchControls.ts`): **L** and **R** fire the port / starboard broadside (one tap = one salvo); **v** and **^** lower / raise the guns (held). Button size is now `min(48, 17% of height)` so two rows fit on the 240 px phone screen.
- **Phone panel** (`Hud.ts`): two new lines, e.g. `5 deg 130 m` (elevation and range) and `L 14s  R ok` (reload).
- `SeaScene.ts` sends the same `fire` and `setElevation` commands as the keys. 133 tests in the sandbox; headless iPhone and iPad emulation: a tap on **L** fires, no errors. Checked by you on the devices: all OK.
- **Art decisions:** `HEIGHT_SCALE` stays **0.65** for now (may change later); **16 directions** stay the default. Final choice 16 vs 32 is still part of the art spike (D33).
- Final touch controls with an assisted-aim option remain M8 (D24).

---

## 14 Nov 2026 (evening, later) — M2 step 2 tested; sloop art version 2

**Step 2 tested by you:** hits, damage and sinking work; shots aimed beyond the hull do little or no damage, as designed. The art in the game: you liked it and asked for more detail and a more tilted (less side-on) look when the ship heads east or west.

- **More from above:** new `HEIGHT_SCALE` 0.65 in `tools/render_ship.py` (screen pixels up per metre of height; was 1). The masts are shorter on screen and more deck shows. The number is written to `shipArt.json` (`heightScale`) and `Cannonballs.ts` uses it too, so balls, hit effects and ship pictures still share one projection. The mainsail swings out 28° (was 18°).
- **More detail:** hull side in three strips (dark planks, owner's band, top strake); the **rail in the owner's colour** (yellow = you, red = enemy), visible from every side; deck guns on carriages; gun ports; lit stern windows and a lantern; helm; hatch with grating; barrels; anchors; mast platform; sails made of cloth panels; a bigger black flag.
- **Fine parts only in the double-detail sheet** (`min_detail = 2`): gun barrels, deck plank seams, shrouds and stay. In the small pictures they would only make broken dots.
- Same file names and frame size, so the game code did not change apart from `Cannonballs.ts`. 133 tests in the sandbox.

---

## 14 Nov 2026 (evening) — Art test: pseudo-3D sloop drawn by code

You asked whether I can draw ship sprites. Answer: not by hand, but by code. You chose that path and **accepted the style as draft art**.

- `tools/render_ship.py` (Python, numpy + Pillow): the sloop is a 3D shape of coloured triangles in game metres (hull with a painted band, deck, mast, bowsprit, mainsail, jib, flag, gun ports). For each direction the model is turned and drawn with the **same projection as the cannonballs** (screen y = world y − height), so the hull keeps its true top-down size and a ball that hits the sail on screen hits the rigging in the sim. Brightness comes from the angle to the light in 5 steps; then a dark outline and a shadow on the water.
- Output: 8 sheets in `client/public/assets/ships/` (owner player = yellow band, enemy = red band; 16 and 32 directions; detail 1 and 2 pixels per metre), `client/src/data/shipArt.json`, and `docs/art/ship-art-preview.png`.
- In the game: `scenes/ShipArt.ts` loads the sheets and `showShip` picks the frame for the heading (`view/shipFrame.ts`, 3 tests); the image is not turned. At zoom ×2 the double-detail sheet is used at its own size. Classes without pictures (brigantine, merchantman, frigate) still use the plain boxes. lil-gui "Art (test)": boxes / 16 / 32 directions, "detail at zoom x2".
- Fix found on the way: after a click on a panel **button** ("put at …") the keys did not steer; the panel now releases the focus after clicks on buttons and check boxes too.
- Limits: details are small at 1 px per metre; the sails do not turn with the wind; 16 directions turn in 22.5° steps (compare with 32 in motion).
- 133 tests in the sandbox (134 with your angle test). This is the first half of the M2 art spike (D33); the Blender path stays as the later option for final art.

---

## 14 Nov 2026 (night, 01:00+) — M2 step 1 tested; M2 step 2 built

**Step 1 tested by you:** firing works; at high speed the balls land behind the cross. That is expected: the cross shows where a shot fired *now* would land and moves on with the ship while the balls fly (11 m/s × 2 s ≈ 22 m). Idea for step 6 (juice): leave a faint ghost cross where the salvo was aimed.

### Step 2: hits, damage, sinking (waiting for your test)

- `sim/hits.ts`: `segmentBoxEntry` (slab method), `toShipLocal`, `ballHit`. Each ship is two boxes: hull (water to `hullHeight`) and rigging (`hullHeight` to `mastHeight`). Each step tests the ball's whole segment, so a fast ball cannot jump through a ship; your own balls never hit you.
- `ships.json`: `hullPoints`, `hullHeight`, `mastHeight` (sloop 220 / 5 m / 22 m; frigate 600 / 8 m / 45 m). `guns.json`: `damage` 27 → 9 hull hits sink a sloop (target 6–10, D28).
- At 0 hull points the ship is **sunk**: it stops, cannot fire, takes no hits and fades to a faint wreck; camera, auto zoom and edge markers ignore it. `placeShip` (the "put at" buttons) brings the target back with a full hull.
- Effects: brown splinters for hull hits, a white puff for rigging hits, a big splash when a ship sinks. HUD: target hull ("hull 139/220", "SUNK!").
- Without random errors (step 3) the right elevation hits with every ball; this is why accuracy comes next.
- 130 tests in the sandbox (131 with your angle test); headless: 3 hits with the first salvo, sunk after the third.

---

## 14 Nov 2026 (night, later) — M1 done; stuck-on-the-shore fix; M2 step 1 built

**M1 tested by you, all OK; M1 is done.** You added a second island (x + 600) without changing code.

### Your question: a ship in irons on a lee shore

You found that a sloop that runs aground and then turns into the wind can stay stuck. Real ships feared a lee shore, and sailing physics should stay honest: in irons the sails give no drive. But the game must never leave you without a way out. Two separate things were going on:

| Problem | Cause | Fix |
|---|---|---|
| Fully stuck while turning through the wind with the stern on the sand | The push-off only slid the ship **backward**, and backward was the shore | The push-off now tries back, forward, port and starboard and takes the first free place. A test reproduces the case (fails with the old push-off, passes now) |
| In irons the sails give no drive | Intended: the polar has a no-go zone | Keep turning until the compass needle leaves the red wedge (a reach), then sail away. Rotating on the spot still works at 30% of the turn rate |

Idea for later (Stage 2 backlog): **kedging off**: the crew rows an anchor out and hauls the ship off the shore; slow and costs time. Hull damage from grounding comes with hull points in M3.

### M2 step 1: guns and ballistics (waiting for your test)

- `data/guns.json`: muzzle speed 75 m/s, gravity 9.81, gun height 3 m, elevation 0–10°, ripple 0.4 s, `inheritVelocity` 1.0. `ships.json`: `gunsPerSide` (sloop 4) and `reloadSeconds` (sloop 15).
- `sim/guns.ts`: gun positions along the hull; ball launch (ship velocity + muzzle velocity, raised by the elevation); ball steps with gravity; `predictLanding` runs the same steps, so marker and shot always agree; ripple fire via `pendingShots`; reload timers.
- New world data: `balls`, `pendingShots`, `nextBallId`, `events` (`gunFired`, `splash`); `ShipState.elevationDeg`, `reloadPort`, `reloadStarboard`; commands `fire` and `setElevation`. `Simulation.takeEvents()` hands the events to the screen.
- Screen: balls drawn above their shadow by their height; splashes and muzzle flashes; a landing cross for each side (yellow = loaded, grey = reloading); HUD line with elevation, range and reload. Keys: Q / E fire port / starboard, R / F raise / lower.
- `tools/range_table.py`: your first Python script; it prints range, flight time and highest point for 0–10° with the same steps as the game (10° → 212 m, 2.87 s).
- 117 tests in the sandbox (118 with your angle test). No hits yet: balls fly through ships until step 2.

---

## 14 Nov 2026 (night) — Step 3b tested and pushed; M1 step 4 built

**Step 3b:** tested by you, all OK; committed and pushed.

### Step 4: island and wind drift (waiting for your test)

- **Pelican Cay** (`data/islands.json`): a polygon of 10 corners about 450 m south of the start. Drawn once into a texture (shallow rim, sand, trees) at 1 px per metre and scaled like the ships.
- **Collision** (`sim/geometry.ts`, `sim/land.ts`): point-in-polygon by ray casting; five hull points (bow, stern, middle, both sides). A ship that would touch land goes back to its last position, stops and is **aground** (HUD: "AGROUND"). It keeps a turn that does not touch land; if the turn touches land too, the crew **pushes off** 0.1 m per step (3 m/s). Hull damage comes with hull points in M3.
- **Seeded random generator** (`sim/random.ts`, mulberry32): its state `rngState` lives in the world; the same seed gives the same game. Never `Math.random()` in `sim/`.
- **Wind drift** (`sim/wind.ts`, `data/wind.json`): every 10 s the wind turns by up to ±3° (never more than 25° from its base direction) and its strength changes by up to ±0.05 (limits 0.4–0.9). lil-gui: "drift" checkbox; the direction slider now sets the base direction.
- New types: `WindNow` (what a ship feels) and `Wind` (plus `baseFromRad`); `ShipState.aground`; `World.rngState`; `Tuning.windDrift`.

### Problem found and fixed

| Problem | Cause | Fix |
|---|---|---|
| Headless: after a second aground with sails set, turning to starboard did nothing | The bow creeps right up to the sand; the shore is not square to the bow, so every small turn touched land and was undone | Push-off: if the turn alone touches land, the ship slides back 0.1 m per step while turning. A test reproduces the case (fails without the fix, passes with it) |

107 tests in the sandbox (108 with your angle test).

---

## 14 Nov 2026 — Step 3 tested; fixes (step 3b)

**Your test of step 3:** turning into the wind slows the ship and stops it in the no-go zone; the sloop is fastest at 135° to the wind; the wind sliders move the compass and change the speed. The 5 s speed-up feel is not judged yet. **Your tuning:** fore-and-aft polar share at 180° changed from 0.65 to 0.8 (more speed with the wind from astern).

| Problem | Cause | Fix |
|---|---|---|
| The computer started at zoom ×2, too close | The target now starts 150 m to the west, along the wide screen side, so auto combat zoom found that both ships fit at ×2 | New **close-fight range** (120 m, lil-gui slider "close fight (m)"): ×2 only when the enemy is that close; stays ×2 up to 20 m farther (no flip-flop). 2 new tests |
| After changing the target class you could not steer | The drop-down list kept the keyboard focus, and lil-gui keeps those keys from the game | After any panel change, focus goes back to the game; a click or tap on the sea does the same (`releaseFocus`). Checked headless with and without the fix |

89 tests in the sandbox (90 with your angle test).

---

## 13 Nov 2026 (late evening) — Scale test closed (O3); M1 step 3 built

**Scale test result:** step 2b (auto combat zoom) works on the computer, iPad and iPhone; the iPad view is the most comfortable. O3 closed: D26 and D27 confirmed with logical height 400 (computer and tablet) and 240 (phone), ×1 for sailing, ×2 for close fights with auto combat zoom. Plan 4.0, 4.1 and the summary are updated.

### Step 3: wind and sailing (waiting for your test)

- **Wind** in the world state: `wind: { fromRad, strength }`; start: trade wind from the ENE (67.5°), strength 0.7 (`data/wind.json`). `setWind` command; lil-gui "Wind" folder.
- **Polar tables** in `data/polars.json` (fore-and-aft, mixed, square) and `sim/polar.ts` (no-go zone, straight lines between points).
- **Plan 4.3 formulas** in `sim/step.ts`: target speed = maxSpeed × polar(TWA) × sails × (0.4 + 0.6 × wind); speed approaches it exponentially (`speedTimeConstant`, sloop 5 s); a slow ship keeps 30% of its turn rate (`minSteerShare`), full steering from half of top speed. `acceleration` and `steerSpeed` were removed from `ships.json`.
- **Angle module** (D34): `headingRadToBearingDeg`, `bearingDegToHeadingRad`, `twaDeg`, `compassPoint`; `heading` renamed `headingRad` everywhere.
- **Compass**: red no-go wedge, blue wind arrow, white heading needle (red when in irons). HUD text on the computer: heading, wind, wind angle, sail power, "IN IRONS".
- Start course is now south (a beam reach), the target 150 m to starboard (west).
- 87 tests in the sandbox (88 with your angle test); build clean; headless check on computer and iPhone, no errors.

### Next

Your test of step 3. Then step 4: an island with collision and slow wind drift with a seeded random generator.

---

## 13 Nov 2026 (evening) — O2 and O4 confirmed; M1 step 2 (scale test) built

**Decisions:** O2 → **D29 confirmed**: the player is a Pirate in Stage 1; the English captain comes in Stage 2 with Spain. O4 → **D30 confirmed**: score = net gold gained + ships; manual saves in port, autosave on entering port, suspend at sea. Plan v0.6 (EN + RU) and the project summary are updated. No code depends on them before M5/M6.

### What was built (waiting for your device checks)

- **Integer pixel scaling** (`scenes/ScreenFit.ts`, `view/pixelLayout.ts`): every logical pixel is a whole number of device pixels; the logical height is about 360 px on a computer and tablet, about 240 px on a phone; the width follows the screen. Phaser runs in `Scale.NONE` mode; we set the canvas size and CSS zoom ourselves.
- **Ship data in game metres** (`data/ships.json`): all four classes with `length` and `beam`; sloop 30 m, 11.5 m/s, acceleration 1.5, turn 0.8, steerSpeed 3.
- **Moored target** (ship 2) on your starboard beam at 150 m; `placeShip` command (test setup only).
- **Range rings** 100/150/200 m and a light preview of the ±25° broadside arcs.
- **Combat camera** (`view/combatCamera.ts`): pulled toward the nearest ship within 400 m; your ship stays in the middle 80%.
- **Edge markers** (`view/edgeMarker.ts`): red triangle and distance for ships off the screen within 1,500 m.
- **lil-gui panel**: pixels per metre, zoom 1–4, logical height, combat camera, rings, speed scale, target class and distance.
- **Phaser pinned** to exactly 4.2.1; lil-gui 0.21.0.
- 62 tests in the sandbox (63 with your own angle test); build clean; headless check on a computer window and an iPhone 13 landscape emulation, no errors.

### Problem found and fixed

| Problem | Cause | Fix |
|---|---|---|
| In about 1 of 4 frames, the rotated player ship was drawn as half a triangle | In the headless test with Phaser 4.2.1, a Text drawn right after a Graphics broke the next sprite (only in the full scene; a small repro did not show it) | Ring labels moved above the ships (depth 3). Rule: don't put text directly between a Graphics and sprites; watch for it on real devices |

### Your test results (computer and iPhone)

| Check | Computer (Chrome) | iPhone |
|---|---|---|
| Both ships at 150 m visible at x1 | Yes | Yes (logical height 240) |
| Ship size at x1 | Small; wanted 2–3x bigger | Not too small, but details hard to see; wanted 1.5–2x |
| Target at 200 m, x1 | Still on screen | Only part of the hull; red marker shown |
| Logical height | 400 good; 240 too big and close | 240 good; 400 too small for combat, fine for overview |
| 1 px/m vs 2 px/m | 1 for sailing, 2 for combat | Same |
| Combat camera motion | No discomfort | No discomfort |
| Pixel sharpness | — | Fine |

**Conclusion:** 1 px/m is the base (zoom x1 for sailing); combat wants x2. At x2 a 200 m broadside does not fit, so we added step 2b.

### Step 2b: auto combat zoom

- `view/autoZoom.ts` (6 tests): when an enemy is within 400 m, the view takes the **largest whole zoom step that still shows both ships**; zooming in needs extra room (no flip-flop); the change is smoothed over about 0.25 s.
- `view.json`: computer logical height 400; `autoZoom`, `autoZoomMarginPx` 36, `autoZoomSpareInPx` 24, `zoomSmoothing` 0.25. Panel: "auto combat zoom" checkbox and "zoom now".
- Headless: computer (384 px high) x2 at 100 and 150 m, x1 at 200 m. iPhone (234 px high): x1 at 100 m abeam; x2 only below about 70 m abeam, or farther when the enemy lies along the long screen side.
- 68 tests in the sandbox (69 with your angle test).

### Next

Try step 2b on the computer, iPhone and iPad (the iPad is still untested). Then we fix the values in plan section 4.0 and close O3. Then M1 step 3 (wind and polars).

---

## 13 Nov 2026 — External review of plan v0.5; plan v0.6

**Result:** the review (`Project_plan_v.0.5_Review`) was checked point by point. Its main finding was right: at 2 px/m the screen shows 320 × 180 m, but the guns reached 250 m, so in a broadside the enemy was off-screen. Plan v0.6 (EN + RU) answers every finding (Appendix B of the plan). No code changed today.

### What we checked with numbers

| Claim in the review | Our check | Verdict |
|---|---|---|
| Range at 10° with 85 m/s is about 250 m; dR/dθ ≈ 24 m per degree | 252 m; 24.2 m/deg | Correct |
| 10–25% of balls hit at long range | Simulation of the plan formulas (Battle 4, wind 0.5): 0.9 hits per 4-gun salvo at 150 m, 0.8 at 200 m (v0.5 ship sizes) | Correct |
| — (not in the review) | With ships 2× larger, the hit rate roughly doubles (2.0 per salvo at 150 m) | New finding: accuracy must be tuned **after** the scale decision |
| The canvas is scaled by non-whole factors | Phaser `Scale.FIT` on a phone gives factors like 1.37 | Correct, and the review did not mention it; covered by D27 |

### Decisions

- **Adopted:** combat targets and hit table (D28), economy guards (D31), Phaser 4.2.1 pinned (D32), 16 directions for draft art (D33), one angle module with unit names (D34), fun checks with criteria (D35), likely dates and hour logging (D36), corrected determinism wording (D23).
- **Confirmed by you the same evening:** O2 → D29, Pirate only in Stage 1; O4 → D30, net-gold score, saves in port and suspend at sea.
- **Answered by the next step:** O3 world scale and display, by the M1 scale test.
- **Where we did not follow the review:** the 1,000-day economy simulation runs the real TypeScript code (Python only plots the CSV), so the rules exist once; no second sprite size, because the zoomed-out view uses icons.

### New estimate

Stage 1 is likely about 44 weeks (range 38–55), R1 in mid January 2027. From now on, please add your hours to each entry (see the table below).

### Next

M1 step 2: the scale test (lil-gui, integer pixel scaling, ship data in game metres, a moored target with range rings, first combat camera and edge markers), checked on the computer, iPhone and iPad.

### Hours log

| Date | Hours | What |
|---|---|---|
| 12 Nov 2026 | (please fill in) | Planning, repository, M0, M1 steps 1–1c |
| 13 Nov 2026 | (please fill in) | Review, plan v0.6 |

---

## 12 Nov 2026 — M0 done, M1 steps 1, 1b and 1c done

**Result:** the game runs on a desktop browser and on an iPhone. A sloop sails under the player's control; the simulation runs at a fixed 30 steps per second; 37 unit tests pass; `npm run build` passes. Everything is pushed to `alxz/naval-battles` (branch `main`).

### What was done

| Part | Result |
|---|---|
| Planning | Plans v0.1 → v0.4 (EN + RU), art guide v0.2 (EN + RU), project summary. All decisions D1–D21 confirmed |
| Repository | GitHub repo `naval-battles`, cloned on the Windows PC (folder `D:\projects\Phaser\NavalBattle\naval-battles`); starter files, `.gitignore` (includes `ext_resources/`), `.gitattributes` (LF) |
| M0 | Vite + TypeScript (strict) + Phaser 4.2.1 in `client/`; placeholder ship on blue water; Vitest with the first real function `normalizeAngle` (5 tests); checked on desktop Chrome and iPhone Safari |
| M1 step 1 | `sim/` module without Phaser: types, `world`, commands (`setRudder`, `setSails`), `stepShip` (inertia, rudder, movement), `Simulation` (fixed 30 Hz step, command queue, interpolation, protection after long pauses). Ship numbers in `data/ships.json`. `SeaScene` only reads input, sends commands and draws |
| M1 step 1b | Temporary touch buttons: `<` `>` rudder (held), `-` `+` sails (25% per tap), multi-touch, no page scroll or zoom |
| M1 step 1c | Zoom (keys Z / X: ×1, ×1.5, ×2, ×3; phones start at ×2), foam wake behind the ship, large HUD for phones (speed number, sail icon with four pips), crisp text on high-resolution screens |

### Tuned values (in `client/src/data/ships.json`, sloop)

| Number | Value | Note |
|---|---|---|
| `maxSpeed` | 8 m/s | about 16 knots; default kept |
| `acceleration` | 1 m/s² | default kept |
| `turnRate` | **0.8** rad/s | you changed it from 0.4 for quicker turning |
| `steerSpeed` | 2 m/s | at this speed the rudder works at full strength |

The wake is a little too visible on the phone: lower the `0.7` in `Wake.ts` (`setAlpha(0.7 * (1 - t))`) to about `0.45`.

### Problems and how they were solved

| # | Problem | Cause | Fix |
|---|---|---|---|
| 1 | `git push` failed: "Password authentication is not supported" | GitHub no longer accepts passwords | Log in with GitHub CLI or a fine-grained personal access token (one repository, Contents: read and write). Never paste a token in chat |
| 2 | `npm create @phaserjs/game` quit with "Canceled" | The installer quits when the recording question is answered "No" | Created the project by hand: `npm create vite@latest client -- --template vanilla-ts`, then `npm install phaser`. Decision D22 |
| 3 | TypeScript errors in Phaser 4 code | `Phaser.Geom.Point` does not exist in Phaser 4; `fillPoints` needs `Phaser.Math.Vector2` | Use `Phaser.Math.Vector2` (notes in plan section 5.9) |
| 4 | `ls src` showed no `sim` folder | My instructions assumed the folder existed | Create folders first: `mkdir -p src/sim`. From now on each step lists the `mkdir` line |
| 5 | `git add .` in the **parent** folder `NavalBattle` staged all folders, including `ext_resources` | `NavalBattle` had its own `.git` (an old `git init` with the same remote). Nothing was committed or pushed | `git rm -r --cached -f .` cleared the index; `.git` renamed to `.git-outer-unused` (delete it later). Real repo checked: `main` equals `origin/main` |
| 6 | No keyboard on the iPhone, so the ship could not be steered | Phones have no keys | Temporary touch buttons (D24); `touch-action: none` in CSS so Safari does not scroll or zoom |
| 7 | On the phone the ship, waves and text were tiny | The 640 × 360 picture is small on a phone; 10 px text is about 2 mm high | Our own scale (pixels per metre × zoom), larger HUD, text with higher resolution, foam wake to show motion (D25). Checked that the water moves at the ship's speed |
| 8 | TypeScript could not import `ships.json` | `resolveJsonModule` was off | Added `"resolveJsonModule": true` to `tsconfig.json` |
| 9 | A scripted key tap did not change the sails | A tap shorter than one frame is missed by `JustDown`; real key presses last longer | Test only; no code change. Automated tests hold a key for about 80 ms |
| 10 | The old project instructions still said "JavaScript" | The instructions panel is a separate copy | Paste the current `docs/project-summary.md` into the Project instructions after each plan change |

### Rules we adopted

- **Git:** run `pwd` and `git rev-parse --show-toplevel` before `git add`. Work only inside `naval-battles`. Add explicit paths (`git add client`), not `git add .`, unless `git status` has been checked.
- **Folders:** every instruction includes `mkdir -p` for new folders.
- **Delivery:** larger changes arrive as a zip that is unpacked into the repository root; the developer runs `npm test`, `npm run dev`, then commits.
- **Python:** for the backend use Python 3.13 through `uv`. Python 3.15 is too new for some libraries. Update `uv` with `winget upgrade astral-sh.uv`.
- **Tests:** every formula in `sim/` has a unit test.

### Next (M1, continued)

1. Step 2: wind in the world state, three polar tables (fore-and-aft, mixed, square) in JSON, speed formula, wind arrow, compass and heading in the HUD (text on desktop, icons on phone).
2. Step 3: one island with collision.
3. Step 4: lil-gui panel for live tuning.
4. Test on the iPad over the local network (not yet done).

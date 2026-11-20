# Naval-Battles — Project Plan v0.7

*Solo hobby project · v0.7 of 18 Nov 2026 (v0.6: 13 Nov) · Replaces plans v0.1–v0.6 and the web draft "Sails & Powder"*

*Companion documents: `art-and-tools-guide-v0.2.md` (sprite specifications, art pipeline, tools; its parts on scale and direction count are under review, see D26, D27, D33) `dev-log-en.md` (what was done, problems and fixes, in detail) and `world-ideas-en.md` (ideas for the world, not yet scheduled). This plan keeps the decisions and the checklists short; the dev log has the details. The external review of v0.5 (`Project_plan_v.0.5_Review`) and our response to each finding are in Appendix B.*

**Status (18 Nov 2026, v0.7):** M0, M1 done · M2 done (R1 "First Duel") · M2b "Open Sea" done · **M3 in progress**: steps 1–5 built (bigger ships, auto-bot arena, port law, sails / crew / three kinds of shot, bot seamanship part 1, arena results); step 6a built (collisions and ramming v2, bot seamanship part 2, headless arena); 6b + 6c + 6d built 19 Nov (camera circle, arena flags and bars, Spanish flag; ways round the land, harbour boats, lead aiming, rammers, WANTED, 3–5 bots; wrecks run for port, lee shores; `npm run build:test`; 6e speed work); **steps 7a–7d built** (fluyt and caravel; crew spirit, traders that run, stern chasers, the land stops balls; bow chasers, ESC pause, bot skills; a battle against bots with mixed classes, bars and flags by distance, a battle log); next: the developer's test of 7c · then **M4b before M4** (D54) · proposed: **M3b "Caribbean Sea"** (D48) · open decisions: O1, O6, O7 (section 9).

---

## 0. How to read this plan

| Section | What it gives you |
|---|---|
| 1 | The game in one page |
| 2 | Decision log: what is fixed, and why |
| 3 | Scope: what is in the first version and what waits |
| 4 | Game rules for the first version (the design spec) |
| 5 | Technical architecture |
| 6 | **Roadmap: releases, milestones, checklists** |
| 7 | How we work together |
| 8 | Risks |
| 9 | Open decisions (4 items, each with a default and a deadline) |
| A, B | Glossary of sailing terms · change history |

All numbers in this plan are **starting values**. They live in JSON data files and are tuned by playing.

**Section 4.0 is the single source of the key constants.** The project summary and the art guide copy them from there; if they disagree, this plan wins.

---

## 1. The game in brief

**Naval-Battles** is a top-down pixel-art naval game set in the Caribbean in 1650–1720, the Golden Age of Piracy. You command one armed sailing ship. You read the wind, fight with broadsides, board and capture enemy ships, trade in ports and grow your captain. The campaign is open-ended; you save in port and can suspend the game at sea (D30).

- **Side:** in Stage 1 you play a **Pirate** (D29). The English captain (pirate hunter) arrives in Stage 2 together with Spain, which gives him real targets.
- **Goal:** the highest score: gold gained (net: loot, prizes, bounties and trade profit) plus ships sunk and captured (D30).
- **Platforms:** web browser first, then iPhone and iPad from the same code.
- **Stages:** Stage 1 is single player against bots (this plan). Stage 2 adds nations, fleets and weather. Stage 3 is multiplayer.

**Core loop:** sail → find a target → fight → sink or capture → take the loot → return to port → sell, repair, recruit, rearm → improve the captain → hunt bigger ships.

**Design principle:** simple first, deeper later. Each system starts as the smallest version that is fun.

---

## 2. Decision log

Status **Confirmed** means you approved it. Do not change these without a new discussion.

| # | Topic | Decision | Why | Status |
|---|---|---|---|---|
| D1 | Title | **Naval-Battles** (working title); repository `naval-battles` | Your choice | Confirmed 12 Nov |
| D2 | Engine | **Phaser 4** (2D) | Pixel art is 2D; Phaser supports it directly and is the easiest to learn. Version 4 is stable (4.2.x) | Confirmed 12 Nov |
| D3 | Camera | **Top-down world.** Ships start as one rotating sprite; later they use pre-rendered direction frames for a 3D look (D18) | The game math stays simple in both cases | Confirmed 12 Nov |
| D4 | 3D feel | Simulation tracks height `z`; the ball is drawn above its shadow | Real gravity arcs without a 3D engine | Confirmed 12 Nov |
| D5 | Backend | **Python + FastAPI + SQLite**; stores accounts, cloud saves, leaderboard | The game runs in the browser; Node.js is not needed in Stage 1 | Confirmed 12 Nov |
| D6 | Game rules | All rules in a separate `sim/` module with no Phaser code | Testable, and can move to a server for multiplayer | Confirmed 12 Nov |
| D7 | Setting | **Caribbean, 1650–1720** | Pirates against navies; ships of all nations were similar | Confirmed 12 Nov |
| D8 | Factions | **England + Pirates**; player picks a side | Covers both scenarios with the least content | Confirmed 12 Nov · changed 13 Nov by D29: Pirate only in Stage 1 |
| D9 | Score | Total gold **earned** + ships sunk + ships captured | Your answer | Confirmed 12 Nov · "earned" defined 13 Nov by D30 as net gold gained |
| D10 | Losing your ship | Captain survives, loses part of the gold, restarts with a sloop | Your answer | Confirmed 12 Nov |
| D11 | Captured ships | You can **take a captured ship as your own**, or sell it as a prize | Main way to get a bigger ship; no shipyard purchases needed | Confirmed 12 Nov |
| D12 | Work style | **Mix:** I write the larger pieces and explain them; you write small parts and tune numbers | Your answer | Confirmed 12 Nov |
| D13 | Pace | 8–10 hours per week; **a first playable version as early as possible** | Your answer | Confirmed 12 Nov |
| D14 | Hardware | Develop on Windows/Linux; build iOS on the MacBook Pro; test on iPad and iPhone | Your equipment | Confirmed 12 Nov |
| D15 | Roadmap order | Game first, **backend after the web alpha** | Gets you a playable game sooner; Python learning starts early through helper scripts (5.6) | Proposed (open decision O1) |
| D16 | Aiming | **Manual gun elevation** with a landing marker, plus random factors so that no shot is certain. The same rules apply to bots | Your note: aiming must stay partly a matter of luck after the player has learned it | Confirmed 12 Nov |
| D17 | Client language | **TypeScript** (compiled by Vite), using the gentle rules in 5.8 | You want to learn better practices; you know Java and C#, so types feel familiar. The gentle rules keep the cost low | Confirmed 12 Nov |
| D18 | Art path | Step 1: Kenney Pirate Pack placeholders. Step 2: **3D look from pre-rendered sprites** (Kenney Pirate Kit or your own models), as a **pixel look at 640 × 360** | You want a 3D look without a 3D engine. Small files, hides modelling flaws, easy to retouch by hand. The art spike in M2 may still change the camera angle, and we can revisit the style if the spike looks wrong | Confirmed 12 Nov · refined by D27 (13 Nov) |
| D19 | Living world | Your new ideas are staged (section 3.3). The cheapest, most valuable parts form their own release **R4 "Living Sea"**, after the campaign works | Sailing must not be boring, but R1–R3 must stay fast | Confirmed 12 Nov |
| D20 | Quests | One small **contract system** carries all quest ideas; new quest types are added as data and small scripts | Bounties, treasure, person hunts, ghost ships and guild jobs share one structure | Proposed |
| D21 | Apple Developer Program | Join at milestone **M10**; until then a free Apple ID is enough to test on your own devices | Saves about 99 USD per year for months | Confirmed 12 Nov |
| D22 | Project setup | The client project is created **by hand**: Vite `vanilla-ts` template + `npm install phaser`; `host: true` in the Vite config so phones can reach the dev server | `npm create @phaserjs/game` quits when its recording question is answered "No"; the manual setup is short and we control every file | Confirmed 12 Nov |
| D23 | Simulation loop | Fixed step of 30 per second, with **interpolation** for drawing. Commands wait in a queue and are applied at the start of the next step. A pause longer than 10 steps is dropped. **Deterministic for the same inputs on the same browser engine.** Chrome (V8) and Safari (JavaScriptCore) may differ in the last digits of `Math.sin` and similar functions, so saves store the whole world state, tests compare with tolerances, and multiplayer (Stage 3) runs the simulation on the server | The same result at every frame rate; bots and tests can be repeated; no jumps after a tab switch | Confirmed 12 Nov · wording corrected 13 Nov (review) |
| D24 | Touch controls | A **temporary** set of four buttons (rudder `<` `>`, sails `-` `+`) arrives in M1 so that phones can be tested early. The final touch controls stay in M8 | The iPhone has no keyboard; the test devices are part of the plan (D14) | Confirmed 12 Nov |
| D25 | View scale and phone HUD | Zoom is our own scale (pixels per metre × zoom: ×1, ×1.5, ×2, ×3; Z / X keys; phones start at ×2), not the Phaser camera zoom. Phones get a separate large HUD: big numbers and icons instead of small text. A foam wake shows motion | A 640 × 360 picture is small on a phone; the HUD stays sharp and unscaled | Confirmed 12 Nov · zoom steps replaced by D26 (13 Nov) |
| D26 | World scale and camera | **Game metres:** ship lengths and speeds are about 2× real (sloop 30 m, frigate 70 m). At zoom ×1, 1 game metre = 1 px. Whole zoom steps: **×1 for sailing and long-range fights, ×2 for close fights.** When an enemy is within the **close-fight range** (120 m, tunable), **auto combat zoom** picks the largest step that still shows both ships (with spare room before zooming in, smoothed over about 0.25 s). A **combat camera** shifts toward the nearest enemy, and ships outside the view get edge markers. The zoomed-out tactical view shows icons, not shrunk sprites | Scale test 13 Nov on computer, iPhone and iPad: 1 px/m is right for sailing, 2 px/m for combat; at ×2 a 200 m broadside does not fit, so the zoom follows the distance. On a phone ×2 applies only to close fights (about 70 m abeam); edge markers cover the rest | Confirmed 13 Nov (O3) |
| D27 | Display | Integer pixel scaling on every device, no blurry scaling (`Scale.NONE`; we set canvas size and CSS zoom). The logical **height** is about **400 px on a computer and tablet** and about **240 px on a phone** in landscape; the width follows the screen shape (no black bars). The HUD is anchored to the screen edges | A fixed 640 × 360 picture is scaled by non-whole factors on most screens (uneven pixels) and is too small on a phone. Scale test: 400 suits the computer, 240 the iPhone; the iPad is comfortable | Confirmed 13 Nov (O3) · refines D18 |
| D28 | Combat tuning | Set **targets first** (duel 2–4 min; 1–2 hits per 4-gun salvo at 150 m), then measure hit rates with a Monte Carlo script (`tools/hit_table.py`), then derive damage per hit | Hit rates depend strongly on ship size and range; damage chosen by feel would be unbalanced | Adopted 13 Nov (review) |
| D29 | Player side in Stage 1 | **Pirate only.** The English captain becomes the first Stage 2 role, together with Spain as the enemy nation | An English captain has only pirate bots as targets, and their loot is thin. One side removes the side choice, a set of port types and the admiralty screen; saves about 1 week in M5 | Confirmed 13 Nov (O2) · changes D8 |
| D30 | Score and saving | The score counts **net gold gained**: loot, prize money, bounties and trade profit (sale price minus purchase cost). Manual saves in port; at sea you can **suspend** (save and quit; the save is deleted when loaded). Autosave on entering port | "Gold earned" counted every sale, so buying and selling the same goods inflated the score. Unlimited saves at sea remove the risk of losing the ship | Confirmed 13 Nov (O4) · clarifies D9 |
| D31 | Economy guards | Prices change **per unit** as you buy or sell; the sell price is 10–15% below the buy price (spread); off-map imports slowly refill each stock to at least 30% of its target. A headless run of 1,000 game days checks the market before R3 | Stops endless profit on one route, and stops the market from emptying when many merchants are sunk | Adopted 13 Nov (review) |
| D32 | Phaser version | Phaser **4.2.1** pinned exactly (no `^` in `package.json`); upgrades are deliberate. Phaser calls only in `scenes/` and `render/`. The notes in 5.9 are copied into the project summary | Phaser 4 is new; most tutorials and AI answers describe Phaser 3 | Adopted 13 Nov (review) |
| D33 | Ship directions | Draft art uses **16 directions**. The art spike (a full day, M2) compares 16, 16 plus a small rotation, and 32, and fixes the number | Half the rendering and file size; at 30–70 px the difference may not show. The spike decides by looking | Adopted 13 Nov (review) · **decided 15 Nov: 32 directions** (the developer found 32 a little more natural; the sheets cost only memory, not speed) |
| D34 | Angles and units | One tested module (`sim/angles.ts`) converts between the three angle systems: sim heading (radians, 0 = east, clockwise), compass bearing (degrees, 0 = north) and wind angle (TWA, degrees off the wind). Angle fields carry their unit in the name (`headingRad`, `bearingDeg`, `twaDeg`) | Three conventions are easy to mix up; the compiler cannot catch it, a field name can | Adopted 13 Nov (review) |
| D35 | Fun checks | Two fun checks with written pass/fail criteria: after R1 (combat) and after R3 (campaign). The second one sets the scope of R4 | "Is it fun?" needs a clear answer, or it gets skipped | Adopted 13 Nov (review) |
| D36 | Schedule | Dates are **likely** estimates, not promises. You log hours per session in the dev log; after each release we recompute the remaining dates | The first estimate (30 weeks) was optimistic; measured hours give the real pace | Adopted 13 Nov (review) |
| D37 | Open Sea before M3 | M2 is closed as R1 "First Duel". A new milestone **M2b "Open Sea"** brings small first versions of the developer's ideas of 15 Nov (map, chart, bigger sea, collisions, fleeing and repair, more bots, a neutral port, fog). Deep versions (economy, many ports, saves) stay in M5–M6 | The duel alone gives few decisions (fun check 1: 2–3); escape, repair, ramming and a safe port add them. Keeps the rule "new ideas never enter a started milestone" | **Confirmed 15 Nov** |
| D38 | Game speed | All ships sail **1.75× faster** (`maxSpeed` in `ships.json`: sloop 20.1, brigantine 18.4, merchantman 10.5, frigate 16.6 m/s); turning stays as it was. The wind starts at 0.8 and wanders slowly between 0.6 and 1.0. Bots fight at 7.5 m/s | The developer's test of 16 Nov: the game felt slow; "speed scale" 1.5–2.0 felt right. An arcade pace matters more than true speeds | **Confirmed 16 Nov** |
| D39 | Ship size on screen | Not by zoom ("pixels / metre" 1.5 made the screen too tight). Instead **bigger ships in the world: × 1.2** (sloop 36 m; × 1.5 was tried on 16 Nov and made big ships too big on the screen) with new, more detailed sprites, the first step of M3, together with class sizes and balance | Developer's test of 16 Nov | **Confirmed 16 Nov: × 1.5, first step of M3** |
| D40 | Port law | A port is neutral ground that defends its peace. Firing in a port's safe water (300 m) is **allowed but punished**: an unlawful broadside costs the shooter 2% of its full hull; a ball that hits a law-abiding ship in safe water does half damage, and the shooter becomes an **offender** wherever he fired from. An offender loses the port's protection and repair, anybody may fire at him, and **3 shore guns** per port fire at him within 450 m (1.5 × the safe range) of the anchorage. Pardon: 45 s spent beyond 450 m. Bots keep the law and attack offenders | The developer's idea of 16 Nov: a port where nobody can ever shoot is too safe; the choice to break the peace should exist and cost something | **Confirmed 16 Nov; built as M3 step 3** |
| D41 | Perception | A milestone **M4b "Eyes at Sea"** right after M4: every ship keeps a list of the ships it has seen (level: contact, silhouette, flag; last place, heading and time). Bots decide only from that list; your screen shows only what your ship knows. Night, fog and weather then work on bots too | Nearly every world idea of 17 Nov (night, flags, weather, caravans) needs it; it ends "fog is a picture only" and keeps the rule "bots do not cheat" | **Confirmed 17 Nov** |
| D42 | Length of a day | A game day lasts **12 real minutes** at ×1 (1.5 min at ×8): morning 10%, day 45%, evening 10%, night 35%. Replaces "2 real minutes" (4.0). Provisions and the economy are tuned to it in M5 | With a 2-minute day a night would last 40 s. 12 minutes first (the developer's choice; 16 was suggested), then tuned by play | **Confirmed 17 Nov (O5)** |
| D43 | Camera in battle | Your ship always stays inside a **central circle** of the screen (radius about 2.5 of its hull lengths); the view no longer slides toward the nearest enemy. Enemies off the screen keep their edge markers; the auto combat zoom (at most × 1.5) still decides how much fits. The spyglass is centred on your ship (in the arena: on the watched bot) | Developer's test 18 Nov: the slide toward the enemy pulled your own ship away from the centre | **Confirmed 18 Nov** (developer's request) · changes the combat camera of D26 |
| D44 | Collisions and ramming v2 | Damage depends on **where** and **how hard**: bow into the middle of a side hurts the struck ship most and the rammer about a quarter; side against side hurts both little; each ship's own speed toward the contact counts (a ship lying still takes less than one sailing into the blow); damage grows with the square of the closing speed, so a fast ram hurts everybody. The same two ships take no new damage for 2 s after a contact and are pushed apart until clear (rules in 4.7b) | Arena 18 Nov: 111 collisions cost 1,900 hull points in 4 h; pairs scraped along each other and lost hull again and again | Proposed 18 Nov; numbers tuned in M3 step 6 |
| D45 | Bot seamanship | Bots keep about 1.5 hull lengths from ships they do not mean to ram (more from friends after the same target), turn away and ease sail after a contact; square-rigged ships wear (turn downwind) instead of tacking when slow; in a chase they luff up for a broadside or cut the target off instead of running parallel; they **ram on purpose** when it pays (heavier, faster, the target crippled), with a personal chance, so they stay a little unpredictable and sloppy | Developer's test 18 Nov; arena log 18 Nov: 188 "works free" in 4 h, often a frigate in open water | Proposed 18 Nov (developer's request) |
| D46 | Headless arena | `npm run headless-arena`: Node runs the arena with the real `sim/` code, without Phaser or a browser, as fast as the computer allows, with default settings; each run writes its log to a file on that machine (`arena-logs/`); a small web page lists the logs for download. A database (SQLite) only with the backend (M9) | Long balance runs without a browser tab; the Linux server can run it day and night. Fits rule 1 (rules in `sim/`, no Phaser) | **Confirmed 18 Nov** (developer's request), a test tool inside M3 (open question O7: files or SQLite) |
| D47 | The arena observer sees everything | In the arena: hull, sails and crew bars over every ship and a small flag of a random nation (England, Spain, France, the Netherlands, pirates) for now; the results screen gets a "save log" button. In a battle against bots, what you may see stays limited as planned for M4b (perception) | The arena is a test tool; its observer is not a ship | **Confirmed 18 Nov** |
| D49 | Ways round the land, harbour boats | Bots plan a way round land on a 10 m water grid (A*, 16 m from the shore) whenever the straight line to their goal is blocked; in a harbour (along an inlet, or within the dock range) boats tow a ship with any sail set at ≥ 1.5 m/s, you too; a small harbour up an inlet takes only ships up to 0.7 × its radius long (sloop, brigantine) | Developer's test 18 Nov: bots stuck for minutes in and round the Isla Verde harbour | **Confirmed 19 Nov** |
| D50 | Bot gunnery and tactics | Bots turn their broadside toward the lead point (where the enemy will be when the balls land) and, with a loaded side within 25°, put it exactly on the beam; 25 s in a fight without a broadside → close in. A bot whose deliberate ram struck becomes a **rammer**: fights closer (100 m), chain shot to tear the sails, grape under 80 m, ram chance 50% | Developer's test 18 Nov (parallel runs, no lead; ram + sails + grape as an aggressive tactic) | **Confirmed 19 Nov** (small first version, D37 exception asked by the developer) |
| D52 | Two traders | The merchantman is replaced by two traders of the time: the **fluyt** (Dutch cargo ship: 0.7 of a sloop's speed, tall masts that run well before the wind, 1 gun a side, 18 men, a big hold that slows her when full) and the **caravel** (an old-fashioned armed trader: 0.8 of a sloop, 4 guns a side, higher and stronger sides that shelter her men from grape). A captain's experience (7c) multiplies a class's speed by 0.85–1.2. In the arena a hurt ship that gets away alive scores half a win | Developer's request and the 6e arena logs (the merchantman: 1 win, 16 losses); history: merchant crews were small and their ships lightly armed | **Confirmed 19 Nov** |
| D53 | Sailing crew | A ship keeps almost its full speed while its sailing crew is aboard (sloop 10, caravel 12, fluyt 10, brigantine 16, frigate 30 men); below that the speed falls to half. Losses slow turning (to 0.4), gathering way (up to 2× slower) and reloading. A ball kills fewer men on an emptier deck, and grape fewer behind high sides | Developer's idea: a small crew can keep sails set; hands are needed for manoeuvres | **Confirmed 19 Nov** |
| D54 | Order after M3 | M3 ends with steps 7a–7d (traders, crew spirit and running, bot skills, bars and flags in battle). **M4b "Eyes at Sea" comes before M4** (patrol routes, renegades, sudden fear and false flags all need sight). A new milestone **"Squadrons"** after M4b: pairs, packs, loners, convoys guarding a trader. Skills that grow with time come with M6 | Developer's ideas of 19 Nov, staged by D37 | **Confirmed 19 Nov** |
| D55 | Crew spirit, traders | Every bot has courage (warships 0.45–0.95, traders 0.1–0.6) and fear (hits, men lost, near misses; a black flag × 1.5; fades slowly). Every 3–6 s (random) it weighs its chances: fear above courage → it leaves; hurt and outmatched → it may leave (roll); caught while running → a desperate ram (roll). Traders sail a trade run (ports and big islands), run from enemies, throw cargo over the side, fire 2 stern chasers (trainable ± 30°). Guns: caravel 2 a side + 2 astern, fluyt 1 + 2. Escapes: trader into port 1, at sea 0.25; warship 0.5 | Developer's test of 7a (traders always lost) | **Confirmed 19 Nov** |
| D56 | The land stops balls | Islands have heights (2 m at the beach, + 0.3 m per metre inland, at most 40 m; reef, piers and boats 1.5 m); a ball that flies into the land stops there; bots do not fire into a hill | Developer's idea of 19 Nov | **Confirmed 19 Nov** (simple first version) |
| D57 | A battle against bots | Bot classes: a mix by weights (sloop 3, brigantine 2, caravel 2, fluyt 2, frigate 1) or one class for all (panel "bot classes"); you sail under the black flag, bots under random flags; from your ship: flag up to 400 m, hull bar up to 450 m, sails and crew up to 200 m (D41 numbers, before perception); a battle log like the arena's (SAVE LOG on the banner, key L); a trader 1.5 km away does not keep the battle going | Developer's test of 7a | **Confirmed 19 Nov** |
| D58 | Bow chasers for all | Every ship carries a bow chaser (1 gun, the frigate 2): round shot only, full range, trained up to 30° off the bow, its own reload. The player fires it with Z (the crew trains it on the nearest ship in the arc); zoom moves to Shift + / Shift −; touch: a B button between L and R | Developer's test of 7b: the runners shoot back with stern chasers, the hunters had nothing ahead | **Confirmed 19 Nov** |
| D59 | Pause and END GAME | ESC (touch "II") pauses a battle or the arena: statistics, RESUME, SAVE LOG, END GAME. END GAME: the arena results; in a battle a banner with the winner (sunk / all enemies gone, else damage done against damage taken, within 0.1 a draw) | Developer's request 19 Nov | **Confirmed 19 Nov** |
| D60 | Bot skills | Drawn at birth: seamanship 0.85–1.2 (speed ×, turning × 1 + 0.5 × (s − 1)), gunnery 1–8 (accuracy and reload), courage, loner (40%) or pack; most bots average; shown in the log and the H window. A runner picks the course where it is faster than its pursuer | Plan step 7c; developer's wishes after 6e | **Confirmed 19 Nov** |
| D61 | Wrecks and solo speed | A wreck never turns HUD panels see-through; its picture stays 30 s, melts in 5 s; the chart mark goes; the ship entry stays in the list (indexes, log, verdict). In a battle against bots all ships are × 1.15 (`soloSpeedScale`); the arena × 1.0 | Developer's test of 7c (20 Nov) | **Confirmed 20 Nov** |
| D51 | WANTED; 3–5 bots | An offender of a port's peace carries a red "WANTED: name" label until pardoned (you and bots). A battle against bots has 3–5 bots at random (the panel can still fix a number) | Developer's request 18 Nov | **Confirmed 19 Nov** |
| D48 | A Caribbean map | The test sea (6 × 4 km, generated islands) is replaced by a map of the **central Caribbean** from the developer's mockup, in its own milestone **M3b "Caribbean Sea"** after M3, using the mask tool planned for M5 (`tools/build_map.py`). The fixes asked for the test sea (move the central port so ships can sail round its island, the Isla Verde safe-water pocket, a bigger port town, a Spanish port) are made on the new map, not on the test sea. Only cheap picture changes come earlier (the port flag of Spain, clearer shore-gun sprites) | Developer's proposal 18 Nov; island tweaks on the test sea would be thrown away | Proposed 18 Nov (open decision O6) |

**Two plans existed.** The folder `web_claude` holds a different draft ("Sails & Powder": Three.js, TypeScript, Spain, 1700–1725). Your confirmed decisions above override it. Its best ideas are merged into this plan; Appendix B lists them. Please use only the latest plan version from now on, and replace the old `PROJECT_INSTRUCTIONS.md` with the new `project-summary.md`.

---

## 3. Scope

### In the first version (Stage 1)

| Area | Included |
|---|---|
| Sailing | One global wind, rudder, sail slider 0–100%, three rig types |
| Combat | Port and starboard broadsides, gravity ballistics, 3 ammunition types |
| Damage | Hull, sails, crew |
| Capture | Surrender, boarding, loot, take the ship or sell it |
| World | One Caribbean map, 6 ports, time acceleration |
| Ports | Market (5 goods), repairs, crew, ammunition, prize sales |
| Captain | 3 skills: Navigation, Battle, Morale |
| Ships | Sloop, brigantine, merchantman, frigate |
| Bots | Merchant, navy patrol, pirate; three skill tiers |
| Living sea | Provisions and fishing, contracts and rumours, sea events, outlaw rule, trade that reacts to sunk ships |
| Saving | Local saves with export to file; cloud saves in release R6 |

### Later (the "parking lot")

New ideas go here, not into the current milestone. The developer's ideas of 17 Nov for the world (day and night, sight and flags, weather, cities that grow rich, caravans, hired pirates) and their suggested order are in **`world-ideas-en.md`**.

- **Stage 2:** Spain, France, the Dutch; full reputation and letters of marque; fleets; crew morale and experience, rum rations; buying and upgrading ships; storms, fog, regional wind, shallows, day and night; seasons; merchant guilds; more quest types; playable merchant role; fire, flooding, mast loss; repairs at sea; bow and stern guns; treasure fleets and galleons; new maps (Mediterranean, Atlantic); Ironman mode; kedging off (the crew rows an anchor out and hauls the ship off a shore; slow, costs time).
- **Stage 3:** real-time multiplayer.

### 3.3 Your ideas, staged

Each idea is split into a small first version and a deeper later version.

| Idea | Stage 1 (release) | Stage 2 |
|---|---|---|
| **Sailing is never boring** | Time acceleration (R3). Sea events and contracts (R4) | Weather, day and night |
| **Side quests** | Contract system with 2 types: **Bounty** and **Treasure map** (R4) | Find a person, lost ship, ghost ship, hidden island, escort, smuggling |
| **Shooting stays partly luck** | Per-salvo and per-gun error, crew, wind, **gun wear** (R2) | Sea state and weather |
| **More kinds of enemies** | Bot skill tiers, armed merchantman, navy sloop-of-war (R2). **Outlaw rule** (R4) | Full reputation with every faction |
| **Food and water** | **Provisions** bought in port; **fishing** at sea (R4) | Fresh water on islands, rum rations and crew morale |
| **Meaningful trade** | Port stocks set prices; merchants carry real goods; a sunk merchant causes a shortage (R3) | Guilds that hire pirates, seasons, convoys |
| **Player roles** | Pirate (D29) | English captain together with Spain; merchant |

---

## 4. Game rules — first version

### 4.0 Key constants

The single source for the numbers that other documents repeat. Scale and display values were confirmed by the M1 scale test on 13 Nov (O3).

| Constant | Value | Where it lives |
|---|---|---|
| Simulation step | 30 per second | `sim/step.ts` |
| World unit | game metre; ship sizes and speeds about 2× real (D26) | `data/*.json` |
| Pixels per game metre at zoom ×1 | 1 (was 2) | `data/view.json` |
| Zoom steps | ×1 sailing; auto combat zoom up to ×1.5 within the close-fight range (120 m); manual 1 / 1.5 / 2 / 3 (keys, wheel); spyglass ×0.5 centred on your ship (D43); tactical view with icons (M5) | `data/view.json` |
| Logical screen height | about 400 px on a computer and tablet, about 240 px on a phone (D27) | `data/view.json` |
| Tile | 32 × 32 px (32 game metres at ×1) | Tiled map |
| Map | about 6 × 4 km | Tiled map |
| Muzzle speed / max elevation / gravity | 75 m/s / 10° / 9.81 m/s² → max range about 200 m, flight about 2.7 s | `data/guns.json` |
| Fire arc | ±25° from the beam | `data/guns.json` |
| Sighting range | 1,500 m | `data/view.json` |
| Sloop (player start) | 36 m, 20.1 m/s, turn 0.8 rad/s (D38, D39) | `data/ships.json` |
| Time acceleration | ×1, ×2, ×4, ×8; pause | `data/view.json` |
| Game day | 12 real minutes at ×1, with morning, day, evening and night (D42) | `data/world.json` |

### 4.1 Scale, camera and time

| Item | Starting value |
|---|---|
| World scale | Game metres: ship lengths and speeds about 2× real (D26) |
| Pixels per game metre | 1 at zoom ×1 |
| Logical screen | Height about 400 px on a computer and tablet, about 240 px on a phone; the width follows the screen; integer pixel scale (D27) |
| View at zoom ×1 | Computer about 700 × 400 m; iPhone in landscape about 500 × 240 m |
| Zoom | Whole steps: ×1 (sailing, long-range fights) and ×2 (close fights), keys Z / X and a touch button. Auto combat zoom within 400 m (D26). A tactical view (key V) shows icons on a zoomed-out sea |
| Combat camera | Your ship stays inside a central circle of about 2.5 hull lengths (D43); enemies off the screen get edge markers. (Until v0.7 the camera slid toward the nearest enemy within 400 m.) |
| Contacts | Ships within the sighting range (1,500 m) but outside the view get a marker at the screen edge with their distance |
| Map size | About 6 × 4 km (test sea); the Caribbean map in M3b (D48) |
| Time acceleration | ×1, ×2, ×4, ×8; drops to ×1 when a ship comes into view |
| Pause | Always available |
| Game day | 12 real minutes at ×1 (D42) |
| Speed feel | A global `speedScale` (start 1.0) stays as a live slider for tuning |

**Finding from the v0.5 review:** at 2 px/m the screen shows 320 × 180 m, but the guns reached 250 m. In a broadside the enemy is abeam, so it was off-screen in most fights, even with the zoom-out. v0.6 fixes this from three sides: bigger ships in game metres with 1 px/m at zoom ×1 (the sprites keep their pixel size), a shorter maximum gun range (about 200 m), and a combat camera with edge markers. The **M1 scale test** checks the numbers on the computer, the iPhone and the iPad before any art is made.

### 4.2 Wind

- One global wind with a direction and a strength from 0 to 1.
- Default: the Caribbean **trade wind from the east-north-east**. Sailing west is easy; coming back east needs tacking.
- The wind drifts slowly in small random steps. The HUD shows an arrow and the strength.

### 4.3 Sailing

You control the **rudder** and the **sail level** (0–100%).

`α` is the angle between your heading and the direction the wind comes **from**. At 0° the bow points into the wind.

**Polar table** (share of top speed at each angle; values between points are interpolated):

| Rig | No-go zone | 50° | 70° | 90° | 135° | 180° | Ships |
|---|---|---|---|---|---|---|---|
| Fore-and-aft | below 40° | 0.40 | 0.65 | 0.90 | 1.00 | 0.65 | Sloop |
| Mixed | below 48° | 0.10 | 0.50 | 0.80 | 1.00 | 0.75 | Brigantine |
| Square | below 55° | 0 | 0.30 | 0.70 | 1.00 | 0.85 | Frigate, merchantman |

Sloops sail closer to the wind, so a small ship can escape upwind from a frigate.

```
targetSpeed = maxSpeed × polar(α) × sailLevel × (0.4 + 0.6 × wind)
              × (0.2 + 0.8 × sailCondition) × (1 + 0.015 × Navigation)

speed    += (targetSpeed − speed) × (1 − e^(−dt / 5 s))        // heavy ships change speed slowly
turnRate  = baseTurnRate × (0.3 + 0.7 × min(1, speed / (0.5 × maxSpeed)))
            × (1 + 0.02 × Navigation)                           // a slow ship steers badly
```

Inside the no-go zone the ship slows and stops ("in irons"). Touching land stops the ship and damages the hull a little.

**Current code.** Since M1 step 3 (13 Nov) the code uses these formulas (`sim/step.ts`, `sim/polar.ts`), with the time constant (`speedTimeConstant`, sloop 5 s) and the minimum steering share (`minSteerShare`, 0.3) per class in `ships.json` and the polar tables in `polars.json`. Sail condition (M3) and the Navigation skill (M6) join the formula later. Wind drift arrives in M1 step 4 together with the seeded random generator.

### 4.4 Guns and ballistics

- **Broadsides only.** Port and starboard batteries, each with its own reload timer.
- **Fire arc:** ±25° around the line at a right angle to the hull.
- **Aiming:** you set the gun **elevation from 0° to 10°**. A marker on the water shows where the shot will land.
- **Ripple fire:** the guns of one side fire one after another within about 0.4 s.
- **Crew:** each gun needs 4 sailors. With too few sailors, fewer guns fire.

**Ball physics** (30 steps per second):

```
start:     gun position on the hull side, height 3 m
velocity:  inheritVelocity × ship velocity + 75 m/s at a right angle to the hull, raised by the elevation
each step: vz −= 9.81 × dt;  position += velocity × dt
range ≈ v0² × sin(2 × elevation) / g        →  about 200 m at 10°, flight time about 2.7 s
```

Real muzzle speed was about 400 m/s. The game uses **75 m/s** so that arcs are visible and the longest shot (about 200 m) fits the combat view (4.1). `inheritVelocity` (start 1.0) is the share of the ship's velocity that the ball keeps; a moving ship shifts its shot by up to about 30 m, and the landing marker shows this. If it feels unfair, we lower the share. Air drag is left out of the first version.

**Hit test.** A ball moves about 2.5 m per step. Each step tests the **segment** from the previous position to the new one against the hull, so a fast ball never jumps through a ship.

**Hit zones.** A ship is a rectangle with two height zones:

| Zone | Height | A hit damages |
|---|---|---|
| Hull | water to deck edge (about 5 m on a sloop; per class in `ships.json`) | hull and crew |
| Rigging | deck edge to mast top | sails |
| Miss | ball reaches the water | splash only |

So aiming low hits the hull, and aiming high hits the sails.

**Accuracy: skill plus luck.** A player who has learned to aim must still miss sometimes. Two random errors are added to every broadside:

| Error | Applies to | Represents |
|---|---|---|
| **Salvo error** | The whole broadside, in elevation | The roll of the ship at the moment of firing. The whole salvo lands long or short together |
| **Gun error** | Each ball, in direction and elevation | The gun crew and the state of the gun |

```
σ_gun   = 1.5° × ammoSpread × (1.4 − 0.06 × Battle) × (1 + crewShortage) × (1 + 0.5 × gunWear)
σ_salvo = 0.6° × (1 + wind) × (1.2 − 0.04 × Battle)
```

- **Gun wear** goes from 0 to 1. Each broadside adds a little; the shipyard resets it for gold. Worn guns scatter more.
- **The landing marker is an ellipse**, not a point. Its size shows the current uncertainty, so the player sees why a shot may miss.
- **Bots use the same formulas.** A bot's skill tier sets its Battle skill and adds an aiming delay.
- Weather and sea state join the formula in Stage 2.
- The random numbers come from a seeded generator, so results can be repeated in tests.

**Reload time** = `baseReload × min(2.5, maxCrew / crew) × (1 − 0.03 × Battle)`.

**Combat targets (D28).** We tune towards these numbers, not by feel:

| Target | Value |
|---|---|
| Duel length, sloop against sloop, equal skill | 2–4 minutes |
| Hits per 4-gun salvo at 150 m (round shot, Battle 4) | 1–2 |
| Hits per salvo at 50 m | 2–3 |
| Hits per salvo at 200 m (a long shot) | 0–1 |
| Hits to sink a sloop | 6–10 |
| Starting reload (sloop guns) | 15 s |

```
damagePerHit = hullPoints / hitsToSink          // sloop: 220 / 8 ≈ 27
```

**First estimate** (13 Nov; a quick simulation of the formulas above, Battle 4, wind 0.5), hits per 4-gun salvo:

| Geometry | 50 m | 100 m | 150 m | 200 m |
|---|---|---|---|---|
| v0.5 sizes (beam 6 m, hull 2.5 m, 85 m/s) | 2.2 | 1.3 | 0.9 | 0.8 |
| 2× ships (beam 12 m, hull 5 m, 75 m/s) | 3.5 | 2.5 | 2.0 | 1.6 |

The review's estimate (10–25% per ball at long range) is confirmed. Doubling the ships doubles the hit rate, so the accuracy numbers (σ) are tuned **after** the scale test. `tools/hit_table.py` (M2) repeats this with the final numbers and sets σ and damage.

**Tuned (15 Nov, M2 step 3, `tools/hit_table.py`).** Base values in `guns.json`: `gunSigmaDeg` **1.8**, `salvoSigmaDeg` **0.6** (the formulas above unchanged). Perfect aim (cross on the target centre), target lying still beam-on, Battle 4, wind 0.7, hull hits per 4-gun salvo:

| | 50 m | 100 m | 150 m | 200 m |
|---|---|---|---|---|
| Battle 4 | 3.2 | 1.8 | **1.2** | 0.9 |
| Battle 8 | 3.5 | 2.0 | 1.5 | 1.1 |
| Battle 0 | 3.0 | 1.5 | 1.0 | 0.7 |

150 m and 200 m meet D28; 50 m is a little above "2–3" (at point-blank range the gun cannot aim lower than 0°, which lands at about 58 m); accepted. Real play will hit less (aim is never perfect, ships move). A Vitest test (`accuracy.test.ts`) fires 300 salvos with the real TypeScript code and checks 1–2 hits at 150 m, so the script and the game cannot drift apart. The fun check after R1 verifies it in play (the HUD counts your hits per salvo).

### 4.5 Ammunition

| Type | Range | Spread | Hull | Sails | Crew | Use it to |
|---|---|---|---|---|---|---|
| Round shot | 100% | ×1.0 | 100% | 10% | 15% | sink |
| Chain shot | 60% | ×1.5 | 10% | 100% | 10% | stop a ship that runs |
| Grape shot | 30%, 8 pellets | ×2.0 | 0% | 10% | 100% | clear the deck before boarding |

Percentages multiply the base gun damage. Ammunition is bought in ports and is limited. The numbers in use (M3 step 4, 18 Nov) are in `data/ammo.json`: chain and grape 6 broadsides each, refilled in port; round shot is not counted until gold exists (M5).

### 4.6 Ship state

| Value | Effect |
|---|---|
| Hull points | At 0 the ship sinks and leaves a floating loot crate |
| Sail condition 0–100% | Multiplies speed (4.3) |
| Crew | Fewer sailors: slower reload, fewer guns, weaker boarding |
| Ammunition | Three counters |
| Gun wear 0–1 | Worn guns are less accurate (4.4) |
| Provisions | Days of food and water for the crew (4.16) |
| Cargo and gold | Limited by the hold |

Repairs: at sea by the crew up to 75% of the hull and 90% of the sails (sails down, no enemy within 500 m); in a neutral port up to 90% of the hull, all sails, new men and chain and grape shot (M2b, M3). Men lost at sea stay lost.

### 4.7 Capture and boarding

Your rule is kept: a ship can be captured when 80% of its crew is down or 80% of its sails are destroyed. One refinement is added so that chain shot alone does not win every fight.

| Enemy state | What happens |
|---|---|
| **Crew at 20% or less** | The enemy **strikes its colours**: it surrenders with no fight when you come alongside |
| **Sails at 20% or less** | The enemy cannot escape. You can board, but the crew **fights** |
| Merchant with heavy damage | May surrender early |

**Boarding:** come within 15 m hull to hull at a relative speed under 5 m/s (game units) and press **Board**. One roll decides the fight:

```
attack  = yourCrew  × (1 + 0.04 × Battle + 0.03 × Morale) × random(0.8 … 1.2)
defence = theirCrew × 1.1                                  × random(0.8 … 1.2)
```

- **You win:** the ship is captured. Both sides lose crew in proportion to the strength ratio.
- **You lose:** you lose crew and must wait 30 s before a new attempt.
- Pirate bots can board you in the same way.
- **Refinement for M4 (developer's idea, 17 Nov):** a crew that has lost more than 60% of its men gives up sooner. From 40% of the crew left, every time it is raked or boarded there is a growing chance it strikes its colours (about 0 at 40% left, certain at 20%), higher for merchants and low morale, lower while the hull is sound. A beaten crew also fights worse in the boarding roll. The curve is set when M4 starts (`data/boarding.json`).

**After a capture** you take the gold and as much cargo as your hold allows. Then you choose:

| Choice | Result |
|---|---|
| **Take the ship** | It becomes your ship. Your crew, cargo and gold move over. The old ship is left behind |
| **Send as prize** | Costs 10 sailors as a prize crew. You receive 50% of the ship's value at your next friendly port |
| **Sink** | Counts as a ship sunk |
| **Release** | No reward; kept for the reputation system in Stage 2 |

### 4.7b Collisions and ramming (D44, proposed)

Today (M2b): damage = closing speed × 6 × the other ship's share of the weight, below 1 m/s nothing, the ship that strikes with its bow takes half. v0.7 proposes:

```
v       = closing speed along the line between the two hulls (m/s)
own     = this ship's own speed toward the other (0 for a ship lying still)
damage  = k × max(0, v − 1)² × (other mass / both masses) × place × (0.5 + 0.5 × own / v)
place:  struck in the middle third of a side 1.0 · struck near bow or stern 0.6
        it struck with its own bow 0.25 · side against side (hulls within 30°) 0.3
after a contact: no new damage between the same two ships for 2 s; they are pushed apart until clear
```

- A fast ram hurts both ships; a slow bump hurts little; ramming a ship that lies still costs the rammer more than the target's own share.
- Bots ram on purpose only when it pays (D45). Boarding by ramming stays for M4 (a ram can end alongside: the start of a boarding).
- `k` and the factors live in `data/damage.json` and are tuned from the arena log (collisions, hull lost).

### 4.8 Captain

Levels 1–10. Each level gives 1 skill point. Each skill goes from 0 to 10.

| Skill | Effect per point |
|---|---|
| **Navigation** | +1.5% speed, +2% turn rate |
| **Battle** | −3% reload time, better accuracy, +4% boarding strength |
| **Morale** | +3% boarding strength, −3% crew hire cost, enemies surrender sooner |

Experience comes from ships sunk and captured, prizes sold and trade profit.

**If your ship sinks:** the captain reaches the nearest friendly port, receives a basic sloop with a small crew, and loses 50% of the gold on hand and all cargo. Skills and score stay.

### 4.9 World and ports

One tile map built in the **Tiled** editor: sea, islands, 6 ports. The geography is simplified.

| Port | Owner | Open to |
|---|---|---|
| Port Royal | England | English captain |
| Bridgetown | England | English captain |
| St. John's | England | English captain |
| Nassau | Pirates | Pirate |
| Tortuga | Pirates | Pirate |
| Curaçao | Neutral free port | Both |

Sail slowly into the harbour zone and choose **Enter port**. The port screen offers:

| Service | Details |
|---|---|
| **Market** | 5 goods: sugar, rum, tobacco, cocoa, cloth. Prices follow each port's stock (see below) |
| **Shipyard** | Repair hull and sails, service the guns, sell prize ships |
| **Tavern** | Hire sailors from a limited daily pool; buy provisions; hear rumours (R4) |
| **Armory** | Buy round, chain and grape shot |
| **Admiralty / Pirate council** | Collect bounties; take contracts (R4); view score and statistics |

**Trade with a purpose.** Each port produces some goods and consumes others, and keeps a stock of each.

```
price = basePrice × (targetStock / currentStock), limited to 0.4 … 2.5 × basePrice
```

- Production and consumption change the stocks every game day.
- A merchant bot picks the route with the best profit, loads real goods and delivers them. Its arrival changes the stocks at both ports.
- If the merchant is sunk or plundered, the goods never arrive and the price at the destination rises. Pirate activity therefore moves the market, with no extra system.
- **Guards against exploits (D31):** the price changes with every unit you buy or sell, so a big deal moves the price against you; the sell price is 10–15% below the buy price; off-map imports slowly refill each stock towards at least 30% of the target, so sinking merchants causes shortages but never an empty market.
- A headless run of 1,000 game days (TypeScript, the real `sim/` code) writes a CSV file; `tools/plot_economy.py` (Python) draws prices and stocks. We check it before R3.

### 4.10 Ships

Game units (D26): lengths about 2.4× real (D39), speeds faster still (D38, an arcade pace). Speeds in m/s and turn rates in rad/s, as in `ships.json`.

| Class | Length | Rig | Guns per side | Crew | Hold | Top speed | Turn rate | Hull | Sails | Role |
|---|---|---|---|---|---|---|---|---|---|---|
| Sloop | 36 m | fore-and-aft | 4 | 60 | 40 | 20.1 m/s | 0.80 | 264 | 100 | Your first ship; pirates |
| Brigantine | 48 m | mixed | 6 | 90 | 80 | 18.4 m/s | 0.63 | 384 | 140 | Pirates, patrols |
| Caravel (7a) | 46 m | mixed (lateen) | 4 | 45 (sailing 12) | 100 | 16.1 m/s | 0.55 | 400 | 130 | Old-fashioned armed trader; high sides |
| Fluyt (7a) | 62 m | square, tall masts | 1 | 18 (sailing 10) | 300 | 14.1 m/s | 0.32 | 440 | 170 | Dutch cargo ship: rich, almost unarmed, good before the wind |
| Frigate | 84 m | square | 12 | 180 | 120 | 16.6 m/s | 0.40 | 720 | 240 | Royal Navy; the "boss" |

- Values of 18 Nov (`ships.json`): ships × 1.2 (D39) and 1.75 × faster (D38) than in v0.6. On 19 Nov (D52) the merchantman gave way to the fluyt and the caravel; a trader's hold is 20–100% full when she comes to sea (`cargoMin`, `cargoMax`) and a full hold costs the fluyt 15% of her speed (`ladenSlowdown`). The fluyt sails by her own polar `squareTall` (as fast dead before the wind as on a broad reach).
- Real equivalents: sloop 15 m and 11 knots, frigate 35 m and 9 knots (1 knot = 0.514 m/s).
- The sloop's turn rate (0.8 rad/s) is your tuning from M1; the other classes keep the v0.5 ratios. **Turning circle radius = speed ÷ turn rate:** the sloop turns on a circle of about 14 m, less than half its length. It felt good alone on the sea; we check it again in the first duel.
- Hull and mast heights are per class in `ships.json` (starting values: sloop 5 m and 22 m, frigate 8 m and 45 m).
- The traders are weakly armed, so new players have a fair first target; in the arena they are meant to run, not to win (D52).

**Variants** are data only and need no new art:

| Variant | Change | Purpose |
|---|---|---|
| Armed fluyt | 6 guns per side, crew 50 | A merchant that fights back |
| Navy sloop-of-war | Sloop with crew 90 and a better captain | A fast patrol that can catch you |
| Skill tier: green / regular / veteran | Captain skills 1 / 4 / 8 | The same ship can be easy or dangerous |

### 4.11 Bots

| Bot | Behaviour |
|---|---|
| **Merchant** | Carries goods on the most profitable route (4.9), runs from enemies, surrenders when beaten. Armed merchantmen fight |
| **Navy patrol** | Patrols an area; attacks pirates and a pirate player |
| **Pirate** | Hunts merchants and an English player; runs when its hull is below 30%. Also attacks an **outlaw** pirate player (4.16) |

Each bot is a simple state machine:

```
Travel / Patrol → (enemy seen) → Chase → Engage
Engage → (hull low)       → Flee
Engage → (target beaten)  → Board → Travel / Patrol
Any state → (land ahead)  → Avoid land
```

- **Bots follow the same rules as you.** They send the same commands (rudder, sails, fire, board) and feel the same wind.
- If the target lies inside the no-go zone, the bot tacks towards it.
- In **Engage** the bot turns its side to the target, computes the elevation from the range formula, adds an aiming error and fires when the target is inside the fire arc.
- A spawner keeps 8–15 bots alive and creates new ones outside your view.
- **Difficulty** changes the mix of skill tiers and the bots' reaction time.
- **A pirate bot keeps what it takes.** Cargo and gold from plundered merchants stay in its hold, so a successful pirate becomes a rich target for the navy (and for a pirate player who is willing to become an outlaw).
- **Built in M3 (steps 2–5):** flee at 30% hull and run for a port; keep the port law (D40); work free when stuck (no way made for 20 s → the fastest open heading for 8 s); chase a runner at its pace; a finishing attack in a port's safe water after a calculation and a roll, then leave as an offender; wait off a port whose berths are full; choose round, chain or grape shot.
- **Seamanship part 2 (D45, M3 step 6):** keep distance from ships they do not mean to ram, turn away after a contact, square rigs wear instead of tacking when slow, pursue to a broadside or cut the target off, ram on purpose with a personal chance.
- **Tacking without dithering:** the bot keeps the chosen tack until it reaches the layline or a cooldown (about 20 s) ends. This hysteresis stops it from turning back and forth. Headless tests check scenarios such as "the bot reaches a waypoint 1 km upwind within 6 minutes".

### 4.12 Score

*Confirmed (D30):*

```
score = net gold gained + (500 × ships sunk + 1000 × ships captured) × class multiplier
net gold gained = loot + prize money + bounties + trade profit (sale price − purchase cost, per cargo lot)
class multiplier: sloop 1 · brigantine 1.5 · merchantman 1.5 · frigate 3
```

Gold lost when your ship sinks does not reduce the score; it only reduces what you can spend.

### 4.13 Saving

A save is one JSON file with a `version` field. It holds the **whole world state**, not a list of commands (see D23). *Confirmed (D30):*

- **In port:** save by hand at any time; the game also autosaves when you enter port.
- **At sea:** **Suspend** saves and closes the game; loading the suspend save deletes it. You can stop at any moment, but you cannot reload to undo a lost fight.
- Saves live in the browser, with **Export** and **Import** to a file. Cloud saves arrive in release R6.

### 4.14 Controls

| Action | Keyboard | Touch |
|---|---|---|
| Rudder | A / D | Wheel on the left |
| Sails | W / S | Slider on the right |
| Fire port / starboard | Q / E | Two fire buttons |
| Gun elevation | R / F | Up and down buttons |
| Ammunition | 1 / 2 / 3 | Ammunition button |
| Board | B | Board button |
| Zoom | Z | Pinch or button |
| Time speed / pause | T / Space | Buttons |
| Map / menu | M / Esc | Buttons |

**Current test version (M1):** keyboard A / D, W / S, Z / X. Touch: four buttons, `<` `>` for the rudder (held) and `-` `+` for the sails (25% per tap); several fingers work at once. The wheel, slider, pinch and the other buttons in the table come in M8 (D24).

**Phone controls need care.** Rudder, sails, elevation, two fire buttons, ammunition, board and zoom are too many buttons for a phone. M8 adds an **assisted aim** option: tap a target and the game sets the elevation for it; you still choose when to fire, and all random errors still apply.

### 4.15 HUD and visual style

- **HUD:** wind arrow and compass, speed, sail slider, bars for hull / sails / crew, ammunition, two reload indicators, target panel with the enemy's bars, minimap, time-speed buttons.
- **Contacts:** ships outside the view get a marker at the screen edge with their distance (D26).
- **Juice from M2:** muzzle flash, a short screen shake on hits, splashes and placeholder sounds. A silent duel feels flat in the fun check.
- **Ships:** 30–70 px long at zoom ×1 (1 px per game metre), with three sail states and a wake behind.
- **Effects:** ball with shadow, splashes, splinters, gun smoke, animated water, foam on coasts.
- **Art path:** Kenney Pirate Pack placeholders first; a 3D look from pre-rendered sprites later (D18).
- **Phone HUD (M1):** a separate layout with large numbers: speed, and the sails as an icon with four pips. Heading and the wind arrow come together as one compass in M1 step 2. The computer HUD keeps the small text with all details (D25).
- **Sprite sizes, frame counts, file sizes, pipeline and tools:** see `art-and-tools-guide-v0.2.md`.

### 4.16 Living sea (release R4)

These rules make the time between fights interesting. All of them reuse systems that exist by R3.

**Provisions**

- One value: **days of food and water** for the current crew. A ship carries up to 30 days.
- One day is used per game day. Provisions are bought in the tavern; the price grows with crew size. (With the 12-minute day of D42, 30 days are 6 real hours at ×1; the numbers are re-tuned in M5.)
- At zero, the ship loses 5% of its crew each day and reloads 25% slower.
- **Fishing:** when the ship is nearly stopped, the wind is not strong and no enemy is in sight, choose **Fish**. Time runs fast; every 6 game hours add 1 day of provisions, up to 5 days per stop.

**Contracts and rumours** (the quest system)

A contract is plain data: who gives it, the type, the target, the steps and the reward.

| Type | Given by | What you do |
|---|---|---|
| **Bounty** | Admiralty or Pirate council | Find a named ship and sink or capture it. Tavern rumours tell where it was last seen |
| **Treasure map** | Tavern, or loot from a captured ship | Sail to the marked spot on an island, stop and dig. Another ship may be after the same treasure |

Stage 2 adds types on the same system: find a person, lost ship, ghost ship, hidden island, guild jobs.

**Sea events**

When nothing is in sight for a while, the game may place one event near your course: floating wreckage with loot, castaways who join your crew, a merchant under attack, a derelict ship.

**Outlaw rule**

A pirate player who attacks another pirate ship becomes an **outlaw** for 20 game days. Pirate bots attack on sight and the pirate havens are closed; the neutral port stays open. Each new attack restarts the count. The full reputation system replaces this rule in Stage 2.

---

## 5. Technical architecture

### 5.1 Overview

```
 Keyboard / touch ──▶ commands ──┐
                                 ▼
 Bot AI ────────────▶ commands ─▶ sim/  (pure TypeScript, no Phaser)
                                 │  wind · ships · guns · damage · boarding · economy
                                 ▼
                          world state (plain data)
                 ┌───────────────┼────────────────┐
                 ▼               ▼                ▼
          Phaser scenes         HUD          save file (JSON)
                                                  │  HTTPS, from release R6
                                                  ▼
                                   Python FastAPI ── SQLite
```

### 5.2 Five architecture rules

1. **`sim/` has no Phaser code.** It holds data and math only. Phaser scenes read the state and draw it.
2. **Fixed time step:** 30 simulation steps per second on every device. Drawing runs at the screen's frame rate.
3. **The world state is plain data** (numbers, strings, arrays). A save is `JSON.stringify(state)`.
4. **Everything is a command.** The player and the bots change the world only through commands such as `setRudder`, `setSails`, `fire`, `board`.
5. **All balance numbers live in JSON files**, never in code.

### 5.3 Repository

```
naval-battles/
├── client/
│   ├── public/assets/        # sprites/, tiles/, maps/, audio/
│   ├── src/
│   │   ├── main.ts           # Phaser configuration
│   │   ├── sim/              # world, wind, sailing, ballistics, damage,
│   │   │                     # boarding, captain, economy, contracts,
│   │   │                     # events, rng, ai/
│   │   ├── scenes/           # Boot, Preload, Menu, Sea, Hud, Port (.ts)
│   │   ├── render/           # ShipView, ProjectileView, effects
│   │   ├── input/            # keyboard, touch → commands
│   │   ├── data/             # ships, polars, ammo, goods, ports (JSON)
│   │   └── save/             # saveManager, api
│   └── tests/                # headless scenario runs (bots, economy); unit tests sit next to the code as *.test.ts
├── tools/                    # Python helper scripts
├── server/                   # Python FastAPI (release R6)
└── docs/                     # this plan, summary, notes
```

**Files that exist at the end of M1 step 1c:**

- `client/src/data/ships.json`: ship numbers (sloop).
- `client/src/sim/`: `types.ts`, `data.ts`, `world.ts`, `commands.ts`, `step.ts`, `simulation.ts`, `math.ts`, `angles.ts`, `interpolate.ts`, each with a `.test.ts` where it has formulas.
- `client/src/scenes/`: `SeaScene.ts`, `Hud.ts`, `Wake.ts`, `TouchControls.ts`.
- Scenes may only read `sim/`; `sim/` never imports Phaser.

### 5.4 Tech stack

| Area | Choice |
|---|---|
| Game engine | Phaser **4.2.1**, exact version pinned (D32) |
| Client language | **TypeScript** (strict mode, gentle rules in 5.8), compiled by Vite |
| Build and dev server | Vite |
| Tests | Vitest (client), pytest (Python) |
| Live tuning panel | lil-gui |
| Maps / art | Tiled / Aseprite or a free editor |
| Backend | Python 3.12–3.13 (chosen with uv; 3.15 is too new for some libraries), FastAPI, SQLModel, SQLite (PostgreSQL later) |
| Login | Argon2 password hashing + JWT |
| Python tools | uv, ruff, Pydantic, Pillow |
| iOS | Installable web app first, then Capacitor + Xcode |
| Version control | Git + GitHub |

### 5.5 Conventions

- Units: game metres and seconds (D26). `x` points east, `y` points south, the same as the screen.
- **Three angle systems** (D34), all converted in one tested file, `sim/angles.ts`:

| System | Unit | Zero | Direction | Used for | Field names |
|---|---|---|---|---|---|
| Sim heading | radians | east | clockwise | all physics; the same as Phaser | `headingRad` |
| Compass bearing | degrees | north | clockwise | HUD, map, wind arrow | `bearingDeg` |
| Wind angle (TWA) | degrees, 0–180 | wind from ahead | either side | polar tables | `twaDeg` |

- Wind direction always means where the wind comes **from** (`windFromRad`).
- The M1 step 1 code still uses `heading`; step 3 renames angle fields with their unit.

### 5.6 Python from the first weeks

The backend comes late, so these small scripts give you Python practice early:

| Script | Milestone | What it does |
|---|---|---|
| `tools/range_table.py` | M2 | Prints gun range and flight time for each elevation |
| `tools/hit_table.py` | M2 | Monte Carlo: hits per salvo by range, skill and ship class; sets accuracy and damage (D28) |
| `tools/render_directions.py` | M2 (art spike) | Blender script: renders a 3D ship model in 16 or 32 directions |
| `tools/make_spritesheet.py` | M2, M8 | Packs PNG frames into a sprite sheet with Pillow |
| `tools/validate_data.py` | M3 | Checks all JSON data files with Pydantic |
| `tools/build_map.py` | M3b (D48) | Turns a small land/sea mask image into the Tiled map (auto-tiling) and the bots' navigation grid |
| `tools/plot_economy.py` | M5 | Reads the CSV of the 1,000-day headless economy run and draws prices and stocks |
| Speed meter in the help text (H) | M3 step 6e | fps, frame time and simulation time (averages and the worst of the last 2 s), for reports from your devices |
| `npm run build:test` (TypeScript, Vite) | M3 step 6d | One HTML file for testers (`client/dist-test/`): everything inside, opens from the disk, no tuning panel, version shown. The code is minified, not hidden |
| `npm run headless-arena` (TypeScript, Node) | M3 (D46) | Runs the bot arena without a browser and writes logs to `arena-logs/`; a small page lists them for download |

`hit_table.py` copies the gun formulas from TypeScript, so a Vitest test compares a few of its results with the real code. The economy run itself uses the real `sim/` code; Python only reads its output.

### 5.7 Server API (release R6)

| Method | Path | Purpose |
|---|---|---|
| GET | /api/health | Server check |
| POST | /api/auth/register, /api/auth/login | Account and token |
| GET, PUT | /api/saves/{slot} | Load and store a save |
| POST | /api/scores | Submit a score |
| GET | /api/leaderboard | Top scores |

Tables: `users`, `saves`, `scores`.

### 5.8 TypeScript rules (gentle start)

TypeScript adds a type check on top of JavaScript. Vite compiles it without extra setup, so the daily workflow stays the same. These rules keep the learning cost small:

1. **Plain data types first.** Describe the world with `interface` and `type`, like Java or C# records. Example: `interface ShipState { x: number; y: number; heading: number; hull: number }`. No generics, no clever types until we need them.
2. **`strict` mode on from day one.** It is much harder to turn on later. We fix the first red lines together.
3. **Avoid `any`.** If a type is unclear, use `unknown` and ask.
4. **Data files get types.** Each JSON file has a matching `type`, so a typo in `ships.json` is caught early. `tools/validate_data.py` checks the same files from the Python side.
5. **Tests are TypeScript too** (Vitest runs them directly).
6. **Escape hatch.** If types cost more time than they save in one milestone, we loosen the rule for that file and write down why. We do not drop the whole language.
7. **Project settings.** `tsconfig.json` has `strict`, `resolveJsonModule` (so JSON data files can be imported), `verbatimModuleSyntax` (use `import type` for types) and `erasableSyntaxOnly` (no enums and no constructor parameter shortcuts; write fields out).

Expected cost: about 10% more time in M0–M2, mostly spent reading type errors. Later it saves time, because the compiler finds mistakes that would otherwise show up as odd behaviour in the game. This extra time is already inside the release dates; if R1 slips by more than a week we will reassess.

### 5.9 Phaser 4 notes (found by testing)

- Version 4.2.x ships its own types (`types/phaser.d.ts`); no extra package is needed.
- `Phaser.Geom.Point` does not exist. `Graphics.fillPoints` wants `Phaser.Math.Vector2` objects.
- `Graphics.generateTexture` works for placeholder art; call `destroy()` on the graphics object afterwards.
- With `pixelArt: true` text is scaled up and looks soft; give text a `resolution` of 2 or 3 to keep it sharp.
- `TileSprite` with `setScrollFactor(0)` makes endless water; set `setTileScale(zoom)` and `tilePosition = camera scroll / zoom`.
- Touch: call `input.addPointer(2)` for several fingers; `sys.game.device.input.touch` tells whether to show buttons; CSS `touch-action: none` stops page scrolling.
- Automated key tests must hold a key for about 80 ms; a shorter tap is missed by `JustDown`.
- **Most tutorials and AI answers describe Phaser 3.** Check every Phaser call against the 4.x types in `node_modules/phaser/types`. Keep Phaser code in `scenes/` and `render/`, so an upgrade touches few files (D32).
- **iOS Safari:** sound starts only after the first touch (unlock audio on the first tap); the iPhone has no fullscreen API (the installed web app runs without browser bars); keep buttons inside the safe area (`env(safe-area-inset-*)`).

---

## 6. Roadmap

Based on 8–10 hours per week. Each release is a version you can play.

**How to read the dates (D36).** Plan v0.5 said about 30 weeks for Stage 1. The review showed that this was optimistic: M5 (map, ports, economy), M7 (living sea) and especially M8 (final art, sound, touch, balance) need more time. The table shows **likely** dates for 8–10 hours a week, including the winter holidays. A best case is about 20% sooner. You log your hours per session in the dev log, and after each release we recompute. If another project runs in parallel, the dates stretch in proportion to the hours it takes.

### 6.1 Releases at a glance

| Release | Name | What you can do | Milestones | Effort | Likely target |
|---|---|---|---|---|---|
| **R1 · v0.1** | **First Duel** | Sail with the wind and sink one enemy ship | M0–M2 | 7–8 weeks | mid Jan 2027 |
| **R2 · v0.2** | Skirmish | Fight bots of different skill, use 3 ammunition types, board, capture and take ships | M3, M3b, M4 | 6 weeks | early Mar 2027 |
| **R3 · v0.3** | Campaign | Sail the map, trade in a market that reacts, grow the captain, save and continue | M5–M6 | 8 weeks (9 with both sides) | early May 2027 |
| **R4 · v0.4** | **Living Sea** | The parts of provisions, contracts, treasure maps and sea events that pass fun check 2 | M7 | 4 weeks | early Jun 2027 |
| **R5 · v0.5** | Web Alpha | 3D-look art, sound, touch controls, balance; installable on iPhone and iPad | M8 | 7 weeks | late Jul 2027 |
| **R6 · v0.6** | Online | Accounts, cloud saves, leaderboard | M9 | 4 weeks | late Aug 2027 |
| **R7 · v0.7** | iOS | Native app on iPhone and iPad through TestFlight | M10 | 3 weeks | mid Sep 2027 |

**R1 stays the fast first version you asked for.** It uses placeholder art and one bot, and it answers the most important question: is the sailing and shooting fun?

**Stage 1 is now estimated at about 44 weeks** (likely; range about 38–55). The review estimated 45–55 weeks for the v0.5 scope; v0.6 cuts some work (the Pirate side only, 16 ship directions, a map built by script, no second sprite size).

### 6.2 Milestones

#### M0 — Setup (1 week) — **done 12 Nov 2026**
- [x] Install VS Code, Git, Node.js LTS, Python, uv. (Python 3.15.2 is installed; for the backend use 3.13 through uv.)
- [x] Create the GitHub repository `naval-battles` with the folders from 5.3.
- [x] Create the Phaser project. `npm create @phaserjs/game@latest` quit at its recording question, so the project was created by hand with Vite `vanilla-ts` and `npm install phaser` (D22).
- [x] Show a placeholder ship on blue water and move it with the keys.
- [x] Open the game on a phone over the local network (iPhone done; the iPad test is still to do).
- [x] `npm run build` and the type check pass; Vitest runs (first function `normalizeAngle`, 5 tests).
- **You learn:** scenes, the game loop, sprites, Git basics, how TypeScript is checked.
- **Done when:** `npm run dev` shows a moving ship on the PC and on a phone. **Reached.**

#### M1 — Sailing (3 weeks) — **done 14 Nov**
- [x] Step 1: fixed-step loop (30 Hz) with interpolation; `sim/` with world, commands (`setRudder`, `setSails`), ship step with inertia; ship numbers in `data/ships.json`; tests (D23).
- [x] Step 1b: temporary touch buttons (D24).
- [x] Step 1c: zoom keys Z / X, foam wake, large phone HUD (D25).
- [x] **Step 2: scale test (new; decides O3).** lil-gui panel (moved here from step 4) with live sliders for pixels per metre, zoom, logical height and `speedScale`; integer pixel scaling with a logical height per device (D27); ship data in game metres (D26); a moored target ship with range rings at 100, 150 and 200 m; a first combat camera and edge markers. Test on the computer, the iPhone and the iPad, then fix the values in 4.0. **Done 13 Nov:** values in 4.0; step 2b added auto combat zoom.
- [x] Step 3: wind in the world state; three polar tables in JSON; the speed and turn formulas from 4.3; the angle module with bearings and wind angle, fields named with units (D34); compass with wind arrow and heading in the HUD (text on a computer, icons on a phone). **Done 14 Nov** (plus 3b: close-fight range 120 m for auto zoom; the panel gives the keyboard back).
- [x] Step 4: one island with collision (polygon in `data/islands.json`, five hull points, aground = back to the last position, speed 0; the crew pushes off while turning away); slow wind drift (4.2) with a seeded random generator in the world state. **Done 14 Nov.** The push-off tries back, forward and both sides, so a ship in irons with its stern on the sand can still turn free.
- [x] A unit test for every new formula (polar interpolation, speed formula, angle conversions).
- **You learn:** vectors, angles, sin and cos, delta time, unit tests, how screen scaling works.
- **Done when:** you can tack upwind, the ship stops in irons, sailing feels good, and on every device you can see a target 150 m abeam.

#### M2 — Guns and the first duel (3.5 weeks) — **done 15 Nov, released as R1**

Steps: 1 guns and ballistics · 2 hit test, hit zones, damage, sinking · 3 accuracy (salvo and gun error, ellipse) and `tools/hit_table.py` · 4 the bot · 5 HUD bars, win and lose, restart, touch buttons · 6 juice · 7 art spike.
- [x] Broadsides, reload timers, elevation control, landing marker (it includes your ship's own velocity). **Step 1, 14 Nov:** `data/guns.json`, commands `fire` and `setElevation`, ripple fire, balls with height and shadow, splashes; keys Q / E fire, R / F elevation; `tools/range_table.py`.
- [ ] Ball physics with height; shadow and arc; splashes; hit test along the segment of each step.
- [x] Hit zones; hull damage; sinking. **Step 2, 14 Nov:** `sim/hits.ts` (segment against two boxes: hull and rigging), damage 27 per hull hit (`guns.json`), `hullPoints` / `hullHeight` / `mastHeight` per class; a sunk ship stays as a fading wreck; events `hit` and `sunk`. Rigging hits do no damage until sails in M3.
- [x] Accuracy. **Step 3, 15 Nov:** salvo error (one per broadside, elevation) and gun error (each ball, elevation and direction) by the 4.4 formulas with a seeded normal distribution (`sim/accuracy.ts`, `nextGaussian`); `ShipState.battleSkill` (4 for now); crew shortage, gun wear and ammunition stay neutral until M3. Landing ellipse (1 sigma) around each cross. `tools/hit_table.py` set σ (gun 1.8°, salvo 0.6°). Practice target sails slowly round a circle (`sim/circle.ts`; 30% sails; it tacks across the upwind part). HUD counts your hull hits per salvo; lil-gui sliders for both σ.
- [x] One simple bot: chase, turn its side, fire. Edge marker when it is outside the view; combat camera. **Step 4, 15 Nov:** `sim/bot.ts`, state machine chase / engage / idle; memory `BotState` in the world (`world.bots`); acts only through commands (`thinkBots` runs in `Simulation` after the player's commands, every 3 steps). Beats against the wind close-hauled with a 20 s tack cooldown; sets its sails for 4.5 m/s while fighting (your idea: sails by the wind); keeps about 140 m; aims at the enemy's position after the flight time (relative motion), with a judgement error σ 0.5° and the same gun errors as yours; raises the guns at 4°/s like your keys; fires only when the aim point is within 10 m of its line of fire; keeps 15 m clear of land. Numbers in `data/bots.json`. Headless scenarios: it closes from 400 m and hits, beats upwind with tacks and no flip-flop, keeps clear of an island, lies still when you are sunk, repeats exactly with the same seed. Against a ship lying still: about 0.6 hull hits per salvo, one salvo per reload. Panel: behaviour bot / circle / moored, "restart duel", "put 400 m upwind".
- [x] **New HUD (15 Nov, ahead of the bot, after your UI review):** three panels on dark plates, same layout on every device (`view/hudLayout.ts`, tested): my ship (compass, speed, sail pips, hull bar, IN IRONS / AGROUND), target card (class, distance, hull bar), guns (port / starboard discs: yellow = loaded, a pie fills while reloading; elevation gauge, angle and range; on a computer the gun icons with + / -). Debug text hidden, H or the panel switch shows it. Touch: my ship top left (the compass is no longer under the buttons on the iPad), guns bottom centre, gun up / gun down icon buttons stacked above "+". Keys + / - (main keyboard and number pad) for the guns; R / F still work.
- [x] Win and lose messages; restart. **15 Nov:** banner "VICTORY!" / "YOUR SHIP IS LOST" 1.5 s after a sinking, button "SAIL AGAIN" (tap, click or Enter); panel "restart duel".
- [x] Temporary touch buttons for the two broadsides and the elevation, so that a duel can be played on the iPhone. **Done early, 14 Nov:** L / R fire, v / ^ elevation; phone panel shows elevation, range and reload.
- [x] **Juice:** muzzle flash, a short screen shake, placeholder sounds (CC0). **Step 6, 15 Nov:** sounds made by code (`tools/make_sounds.py`, numpy synthesis, no licences: cannon, splash, hull hit, sail hit, sinking), played with distance, left/right pan and random pitch (`scenes/Sounds.ts`); screen shake when you fire, are hit or a ship sinks; gun smoke drifting downwind; ghost cross where a salvo was aimed; white hit flash on the ship; bubbles when a ship sinks. Panel "Sound & effects": sound (M), volume, screen shake.
- [x] `tools/range_table.py` and `tools/hit_table.py` (your first Python scripts); set accuracy and damage from the combat targets (D28). **Done 15 Nov** (table in 4.4).
- [ ] **Art spike (a full day, in two sessions):** render one Kenney Pirate Kit ship in 16 and in 32 directions and show both in the game. Decide the direction count (D33) and confirm the art style (D18, D27). **Step 7, 15 Nov:** instead of a Kenney model, all four classes are rendered by code (`tools/render_ship.py`, style accepted 14 Nov): brigantine (square foresails, gaff mainsail), merchantman (broad, three masts, cargo), frigate (full square rig, 12 ports a side); filled, bellied square sails so they show from above; a frame size per class (64/80/96/112). Open: **your choice of 16 or 32 directions** (panel "Art (test)").
- **You learn:** ballistics, collision tests, a first state machine, Monte Carlo simulation in Python.
- **Done when:** you can win and lose a duel against the bot on the computer and on the iPhone. **→ Release R1 "First Duel".**

**Fun check 1 (after R1).** Play 5 duels against the bot and write down the results.

| Criterion | Pass |
|---|---|
| Duel length | 2–4 minutes in at least 4 of 5 duels |
| Hits per salvo at about 150 m | 1–2 on average (the game logs it) |
| Readable aiming | You can tell why a salvo missed (long, short, ahead, behind) |
| Fair result | You win some and lose some; no duel feels decided by luck alone |
| Sailing | No unexplained stop in irons; tacking upwind works |
| Wish to continue | You want to play a sixth duel |

If a criterion fails, we tune for up to one week before M3. If the core is still not fun, we change the combat model (range, view, aiming) before adding content.

#### M2b — Open Sea (new, D37) — **done 16 Nov**
- [x] Package A: a closed sea 6 × 4 km with a reef border; 18 islands made by `tools/make_islands.py`; the chart (C).
- [x] Package B: ship collisions; bots flee and repair; repair at sea; up to three bots; minimap; ESC; tuning gear on touch screens; fonts on iOS.
- [x] Package B2 and fixes: lighter touch HUD; wake; the hand-made islands painted; D38 (speed, wind), D39 (ship size → M3).
- [x] Package C: a neutral port (safe water, repair, bots use it); fog banks (picture only); shoal water.
- [x] Packages C2–C4: a port that looks like a port, solid piers and boats; the Isla Verde inlet; the spyglass; Linux server scripts.
- **Done when** reached: sail round the sea with the chart, fight two bots, flee, repair, come back. **→ Release R1b "Open Sea".** Details: dev log, 15–16 Nov.

#### M3 — Damage, ammunition and bots (4–5 weeks; now about 6) — **in progress**
Built (details in the dev log, 16–19 Nov):
- [x] **Steps 1/1b (D39):** ships × 1.2 with new sprites; combat zoom at most × 1.5, auto-zoom button, spyglass, mouse wheel; a hidden wall between the port's piers; the inlet ends in a round harbour with the **second port**; below 50% hull a ship slows; the wind swings every 2.5–5 min.
- [x] **Step 2:** the auto-bot arena (six bots, respawns, time ×1–×8, the log).
- [x] **Step 3 (D40):** port law with shore guns, offenders and pardon.
- [x] **Step 3b:** no ship ever placed on land; arena log v2 (data fingerprints, sink details, watchdog, class table); hull bars over ships.
- [x] **Steps 4 and 4b:** sails and crew take damage; round, chain and grape shot (keys 1–3, a touch button); damage slows more (sails, crew, hull); controls lock while sunk; bar icons; ball colours; a bigger touch minimap with a view box.
- [x] **Steps 4c and 5:** arena results (the best three), ammunition icons, tall computer windows, "turn your device" on upright touch screens; bots chase runners, work free, make a finishing attack in safe water, wait for a berth.

**Findings from the arena logs (16–18 Nov, about 30 game hours):** 20–27 wins an hour; the frigate wins most, the merchantman almost never (2 wins, 32 losses in 4 h); most sinkings are of ships already running for port; 111 collisions cost 1,900 hull points in 4 h; chain shot is rare (166 hits against 2,502 round shot); 9 finishing attacks in 27 chances, 2 sank their enemy.

Next — **step 6** (your test of 18 Nov):
- [x] **6a, 19 Nov — collisions and ramming v2 (D44, 4.7b):** damage by place and own speed, × the square of the closing speed (`hullPerMps2` 1.2), at most 30% of a ship's hull per collision, a 2 s pause per pair, the pair's bots steer clear for 6 s.
- [x] **6a, 19 Nov — bot seamanship part 2 (D45):** steer for where the enemy will be (cut-off); square rigs (and slow brigantines) wear instead of tacking; bear away from a ship alongside; turn away and ease sail after a contact; a deliberate ram (heavier or the enemy crippled, faster, its side toward us, our hull sound, 20% roll).
- [x] **6b, 19 Nov — camera circle (D43):** the ship sails freely inside a circle of 2.5 hull lengths (at most 40% of the shorter half-view); the spyglass centres on the ship; auto zoom now checks the fit from your ship; range rings fainter (0.2).
- [x] **6b, 19 Nov — arena (D47):** sails and crew bars and a random flag (England, Spain, France, Netherlands, pirates) over every ship; names above the bars; the help text (H) below the bot table and shorter; the results screen: SAVE LOG, text on whole pixels (no shimmer).
- [x] **6a, 19 Nov — headless arena (D46):** `npm run headless-arena` (Vite bundles `headless/arena.ts` for Node), logs in `client/arena-logs/`, page on port 4180; on Linux `bash scripts/run-linux.sh arena`. Headless 4 × 60 min: 22.8 wins an hour; accidental collisions mostly gone; 40 rams tried in 226 chances, 11 hit.
- [x] **6b, 19 Nov — pictures:** port flag of Spain (the Cross of Burgundy) and bigger shore guns with a rim, carriage and long barrel (`make_islands.py`; shapes unchanged; the port stays neutral, D29).
- [x] **6c, 19 Nov — your test of 6a (D49–D51):** ways round the land (`sim/path.ts`), harbour boats, small harbours for small ships, going about early along a shore, square rigs tack at ≥ 6 m/s; lead aiming and closing in; rammers; WANTED labels; 3–5 bots. Headless 4 × 60 min: "works free" 45/19/79/58 → 28/30/5/23, aground down by a third, Isla Verde stuck 0–11 an hour (was up to 24); pace about 28 wins an hour (better gunnery).
- [x] **6d, 19 Nov — your test of 6c:** a badly hit bot always runs for a port it can use (no more running along the edge of the sea), and its run is land-aware; a big ship does not follow its enemy into a small harbour and no bot sails into a harbour unless it goes to port there; no wearing on a lee shore; in a harbour bots sail at most 4 m/s; "up the inlet" only with the inlet in sight; hard by a shore no "turn round" onto the bank. Headless 6 × 60 min: aground 9–40 an hour (was 50–260), works free 10–27, Isla Verde 0–4. **Test build** `npm run build:test`: one HTML file (≈6.4 MB) with code, pictures, sounds and fonts inside, opens from the disk without a server; no tuning panel; version in a corner.
- [x] **6e, 19 Nov — speed (your report: the game felt slow):** measured first (CPU profiles of the simulation and the browser). Simulation: a distance-to-land grid answers "no land near" at once for most land checks; A* reuses its arrays (no 4 MB of garbage per search) and leans toward the goal; the aim angle is read from a table instead of 21 test balls; the harbour test skips far ports. Screen: texts are drawn again only when their words or colour change; flags are small pictures; range rings and port rings are drawn once per zoom and only moved; the minimap draws its islands only when you discover one; the tuning panel's width is no longer read twice a frame. Result: headless arena 2.8× faster (60 game min in 6.7 s), worst arena frame 25.7 → 13.5 ms, text redraws per frame 7–14 → 1–4; same seed, same game. Help (H) shows fps, frame and simulation times.

Next — **step 7** (traders and bot behaviour, D52–D54):
- [x] **7a, 19 Nov — fluyt and caravel (D52, D53):** two traders instead of the merchantman (data, sprites from `render_ship.py` with a lateen sail and a tumblehome hull), the fluyt's own polar, cargo at birth; sailing crew (speed almost kept, turning / gathering way / reloading suffer); fewer men killed on an emptier deck and by grape behind high sides; the arena: sloop, brigantine, fluyt, frigate, sloop, caravel, score = wins + ½ × escapes ("got away alive": hurt, into safe water or 1.5 km clear for 60 s; once per enemy and life); flags 12 × 8 with a bold Burgundy cross; a runner keeps sea room (no more running into a corner); the "finishing attack sank its enemy" count fixed. Headless 4 × 60 min: aground 7–15 an hour, works free 6–11; the traders still fight (that is 7b): fluyt 3 wins, 2 escapes, 30 losses; caravel 7 / 2 / 21.
- [x] **7b, 19 Nov — crew spirit and running (D55, D56):** courage and fear, weighing every 3–6 s (leave on fear or poor odds, a desperate ram when caught); traders: trade run, run from enemies, cargo over the side, 2 stern chasers each (caravel 2 + 2, fluyt 1 + 2); escape points (trader port 1, at sea 0.25); the land stops balls (`sim/terrain.ts`), bots hold fire into a hill; out of a harbour up an inlet through its mouth. Headless 4 × 60 min: 8–14 sinkings an hour (was about 30: traders now run, and long chases follow); traders ran 12–20 times an hour, cargo over the side 4–7, stern salvos 72–128, desperate rams 1–6, balls stopped by the land 2–24. Still open: runners do not yet pick the course where they are faster (7c or later).
- [x] **7c, 19 Nov — bow chasers, pause, bot skills (D58–D60):** a bow chaser on every ship (round shot, ±30°, Z / touch B; zoom on Shift + / −); ESC pause with statistics, SAVE LOG and END GAME (arena results, or a battle banner with the winner); a minimap click moves the arena view; the H window shows bot names, classes and skills on a lighter plate; skills drawn at birth (seamanship 0.85–1.2, gunnery 1–8, courage, loner / pack), shown in the log with wins / losses by level; a runner picks the course where it is faster than its pursuer. Headless 4 × 60 min: 9–16 sinkings an hour, bow chaser shots 80–137 an hour, 0 warnings. Was in the plan: seamanship (speed × 0.85–1.2, steering, way-finding), gunnery (accuracy, reload), courage, loner or pack; drawn at birth, shown in the arena log and table.
- [x] **7c2, 20 Nov — your test of 7c (D61):** a wreck never makes a HUD panel or the minimap see-through; the wreck picture stays 30 s and melts away in 5 s, its chart mark goes with it (the sunk ship stays in the world's list for indexes, log and verdict); in a battle against bots every ship is 15% faster (`soloSpeedScale`, the arena stays at 1.0). Open from the logs: ships and traders still run aground at the Isla Verde inlet mouth (a small fix for the next step).
- [x] **7d, 19 Nov — a battle against bots (D57):** bot classes (mix or one class, panel "bot classes"; the old "class" changes ship 2 at once), flags and bars by distance, a battle log with SAVE LOG on the banner and key L, victory when the warships are sunk and the traders sunk or 1.5 km away.
- [ ] Still open from the old list: a small random speed factor per ship; crew fatigue; gun wear in accuracy; headless bot scenarios in Vitest; `tools/validate_data.py`.
- **Done when:** a pirate and a navy bot fight each other with no help from you, a trader runs and sometimes gets away, and the bot scenarios pass.

#### M3b — Caribbean Sea (D48, proposed; about 2–3 weeks)
- [ ] Your mockup of the central Caribbean → a land / sea mask → `tools/build_map.py` (moved here from M5): coasts, islands, shoals; the map edge instead of the reef border.
- [ ] Ports placed so that a ship of any size can sail round their island; the safe water never reaches past the land into pockets; a large port is a large town; flags by owner (Spain first).
- [ ] Bots find their way on the new map (a navigation grid for long trips round islands); the arena and the headless arena run on it.
- **Done when:** the headless arena runs 4 hours on the new map with no "stuck" warnings and about the same wins an hour as on the test sea.

#### M4b — Eyes at Sea: perception (D41, about 2 weeks; before M4 by D54)
- [ ] **Also (D54):** each bot gets a default route at birth (island to island or port to port, not always the shortest); renegades hunt across the whole map; false flags (a pirate shows another flag and hoists the black one late).
- [ ] `sim/perception.ts`: each ship's known contacts (level contact / silhouette / flag, place, heading, speed, last seen), updated 3 times a second; sight ranges by level, light, fog, lanterns and mast height (`data/sight.json`). Details: `world-ideas-en.md`, section 9.
- [ ] Bots choose targets, aim, chase and flee only from their contacts; a lost enemy is searched for at its last known place, then forgotten.
- [ ] Your view: ships your ship does not see are not drawn; edge markers, the target card and hull bars only for known ships; the chart shows "last seen".
- [ ] Fog banks hide for the rules too (no longer a picture only); a broadside reveals the shooter for a few seconds.
- [ ] Arena: switch "what the watched bot sees" / "everything"; the log writes "sighted" and "lost sight".
- [ ] **Detail by distance (your test, 18 Nov):** up to 200 m you see hull, sails and crew of a ship; 200–450 m one overall bar; beyond that nothing. A small national flag next to the bar up to 400 m (ships and you). Bots read the same levels (honest game).
- [ ] **Nations (simple first):** each bot gets a random flag (England, Spain, France, the Netherlands, pirates) for the picture and the contact level 3; what a flag means (allies, wars) comes with M5 and Stage 2.
- [ ] Headless tests: a bot does not attack what it cannot see; it searches where it lost you; the same seed gives the same game.
- **Done when:** you can slip away from a bot behind an island or in a fog bank, and it looks for you where it saw you last.

#### M4 — Boarding and capture (2 weeks)
- [ ] Surrender rule; boarding roll; battle report.
- [ ] Loot crates; plunder screen; take ship / prize / sink / release.
- [ ] Ship-loss rule.
- [ ] A crew that has lost more than 60% of its men surrenders more easily (developer's idea, 17 Nov; see 4.7).
- **Done when:** you start in a sloop and end the session in a captured brigantine. **→ Release R2 "Skirmish".**

#### Squadrons (D54, new; about 2 weeks, after M4b)
- [ ] Bots in pairs and packs that sail and fight together; loners chosen at birth that keep their own course and targets; escorts that pick a trader and sail near her, guarding her route.
- **Done when:** in the arena a convoy of a fluyt and an escort reaches its port more often than a lone fluyt.

#### M5 — World and ports (5 weeks; 6 with both sides)
- [ ] The map itself comes in M3b (D48); here: port details and the tactical view.
- [ ] 6 ports (fewer port types: no admiralty screen in Stage 1); harbour zones; minimap; tactical view with icons.
- [ ] Port screen: market, shipyard, tavern, armory, admiralty or council.
- [ ] Game clock; port stocks, production, consumption and off-map imports; per-unit prices with a spread (D31); cargo.
- [ ] **Hull fouling and cargo weight (your idea, 15 Nov):** the bottom fouls with weeds and barnacles over game days (up to about 10% slower); careening or the shipyard in port cleans it; a full hold makes a ship slower.
- [ ] **Damage on the ship picture (your test, 18 Nov):** torn sails and a battered hull drawn as extra frames by `render_ship.py` (2–3 levels); chosen by sail and hull share.
- [ ] **Island placement (your test, 18 Nov):** small islands at random places from the seed, large ones moved a little; checks: open water around ports, no blocked passages, every place reachable.
- [ ] Bot spawner; merchants that carry real goods; pirate bots that keep their loot; time acceleration and pause.
- [ ] Headless economy run over 1,000 game days and `tools/plot_economy.py`; no route gives endless profit.
- **Done when:** the full loop works: sail, fight, loot, sell, repair, recruit.

#### M6 — Captain, score and saves (3 weeks)
- [ ] Experience, levels, 3 skills connected to the formulas; captain screen.
- [ ] Score as net gold gained (D30) and a statistics screen.
- [ ] Save in port, autosave, suspend at sea (D30), export and import; main menu with Continue.
- [ ] Difficulty setting.
- **Done when:** you close the browser, return the next day and continue. **→ Release R3 "Campaign".**

**Fun check 2 (after R3, before M7).** Play two campaign sessions of about 45 minutes each.

| Criterion | Pass |
|---|---|
| Time between interesting moments | Usually under 4 real minutes (with time acceleration) |
| Trade | At least one real decision per session (which route, what to carry); no exploit found |
| Waiting | Never more than 2 minutes with nothing to decide |
| Progress | You end each session with something better: gold, a skill point, a bigger ship |

Your notes decide **which R4 parts we build**: only those that fix a boring moment you actually had. Provisions are built only if they create decisions, not chores.

#### M7 — Living sea (4 weeks)
- [ ] Scope set by fun check 2; the list below is the maximum.
- [ ] Provisions: daily use, purchase in the tavern, effects at zero; fishing.
- [ ] Contract system; Bounty and Treasure map contracts; tavern rumours; contract list in the HUD.
- [ ] Sea events: wreckage, castaways, merchant under attack, derelict.
- [ ] Outlaw rule (pirate player).
- **You learn:** data-driven design: new content as data, not as new code.
- **Done when:** in one session you take a contract, follow a rumour, find the target and return with the reward. **→ Release R4 "Living Sea".**

#### M8 — Art, sound and polish (7 weeks)
- [ ] Final art replaces the placeholders: 4 ship sheets (16 or 32 directions per D33, 3 sail states), tiles, island objects, effects (see the art guide).
- [ ] Water animation, wake, smoke, splinters; sounds and music.
- [ ] Final touch controls with assisted aim; settings menu.
- [ ] iOS details: audio unlock on the first tap, safe areas, the installed web app without browser bars.
- [ ] Balance pass; performance check on iPad and iPhone.
- [ ] Installable web app (add to the home screen).
- **Done when:** a friend can play for 30 minutes without your help. **→ Release R5 "Web Alpha".**

#### M9 — Python backend (4 weeks)
- [ ] FastAPI project; SQLite with SQLModel; register and login.
- [ ] Saves API and leaderboard API; pytest tests.
- [ ] Client connection; deployment with HTTPS.
- [ ] Privacy: collect the minimum (user name and password; no email unless needed). Before opening accounts to the public, check the Canadian privacy rules (PIPEDA and, for users in Quebec, Law 25). This is a reminder, not legal advice.
- **Done when:** you log in on the PC and continue the same campaign on the iPad. **→ Release R6 "Online".**

#### M10 — iOS app (3 weeks)
- [ ] Capacitor project; Xcode build on the MacBook; app icon and splash screen.
- [ ] Test on the iPhone and iPad; TestFlight.
- [ ] Check the App Store review guidelines (minimum functionality, guideline 4.2) before submitting.
- **Done when:** the app is installed from TestFlight. **→ Release R7 "iOS".**

### 6.3 Rules that keep the project on track

1. Do not start a milestone until the previous one is playable.
2. A new idea goes to the parking lot (section 3).
3. Placeholder art until R4. Draw the final ships only after the fights are fun.
4. If a milestone takes twice its estimate, we cut scope instead of extending it.
5. Every new idea gets a small first version and a release. It never enters a milestone that has already started.
6. **Log your hours** in the dev log after each session; we recompute the dates after each release (D36).
7. **One source of truth:** this plan. Section 4.0 holds the key constants; the project summary and the art guide copy them.

**What we cut first if time is short:** sea events, fishing, the outlaw rule, prize crews (keep "take ship" and "sink"), the neutral port, the mixed rig, the difficulty setting, the tactical view.

### 6.4 After Stage 1

- **Stage 2, suggested order:** Spain and France with full reputation → more contract types (person hunt, lost ship, ghost ship, hidden island) → merchant guilds that hire pirates → weather, seasons, day and night → crew morale, rum and fresh water → fleets and prize ships → buying ships → playable merchant → new maps.
- **A warning about the economy.** A full trading simulation with guilds and seasons is the most common place where solo projects stall. The Stage 1 stock model already gives purposeful trade. Guilds and seasons are added one at a time, and each must show a visible effect for the player before the next begins.
- **Stage 3, multiplayer:** the server must run the simulation. Option A: a small Node.js match server runs the same `sim/` code, and Python keeps accounts and saves. Option B: port `sim/` to Python. We decide after R7.

---

## 7. How we work together

- **One milestone at a time.** Each session starts from the milestone checklist.
- **Mix mode:** I write the larger pieces as complete, runnable files and explain each new concept first. You write small parts (data files, HUD elements, Python tools) and tune the numbers.
- **Small steps.** After each step you run the game and see a change.
- **Every formula in `sim/` gets a test.**
- **Commit to Git after every working step.**
- **Language:** we talk in Russian or English; the plan and the dev log exist in both languages and are updated together.
- **Other AI tools:** give them `project-summary.md` as context.

---

## 8. Risks

| Risk | Level | What we do |
|---|---|---|
| Scope grows | High | Parking lot, cut list (6.3), one milestone at a time |
| The new map delays boarding (M4) | Medium | M3b keeps a small first version; the mask tool does most of the work; boarding rules do not depend on the map |
| The schedule is optimistic | High | Likely dates (6.1), hours logged per session, recompute after each release (D36) |
| The view is smaller than the fight | High → Medium | World scale and combat camera (D26); scale test in M1 step 2 |
| Combat is not fun | Medium | Combat targets and hit table (D28), juice in M2, fun check 1 with criteria |
| Aiming is hard to read | Medium | Landing marker, visible splashes, edge markers, combat camera |
| Art takes too long | High | Placeholders until R4; 16 directions; a full-day art spike; rendering by script |
| Pixel art looks uneven on phones | Medium | Integer pixel scaling (D27); whole zoom steps only |
| Economy exploits or collapse | Medium | Per-unit prices, spread, imports (D31); 1,000-day headless run |
| The English side has little to do | Medium | Pirate only in Stage 1 (D29) |
| Bots get stuck when tacking | Medium | Hysteresis and cooldown; headless bot scenarios (M3) |
| The map takes weeks to paint | Medium | Mask plus `tools/build_map.py` (M5) |
| Phaser 4 is new; AI tools suggest Phaser 3 code | Medium | Exact version pinned; notes in 5.9 and in the summary (D32) |
| Results differ slightly between Chrome and Safari | Low | Saves hold the full state; tests with tolerances (D23) |
| Safari and touch problems | Medium | Test on the iPhone and the iPad in every milestone |
| Motivation over about 10 months | Medium | A playable release every 4–8 weeks; fun checks |
| The living world grows without limit | High | Fun check 2 sets the R4 scope; the economy warning in 6.4 |
| Leaderboard cheating | Low | Accepted for a hobby game; solved with a server simulation in Stage 3 |
| Privacy rules for accounts | Low | Minimum data; check before accounts go public (M9) |

---

## 9. Open decisions

Three decisions are open (O1, O6, O7). O2, O3 and O4 were closed on 13 Nov, O5 on 17 Nov.

| # | Question | Recommended default | Alternative | Decide by |
|---|---|---|---|---|
| **O1** | When is the Python backend built? (D15) | After the web alpha (M9) | Right after the campaign (R3); R4 and R5 move about 3 weeks later | Before M7 |
| **O2** | Which side does the player take in Stage 1? (D29 against D8) | **Pirate only.** The English captain becomes the first Stage 2 role, together with Spain | Keep both sides (D8). Pirate bots that keep their loot (4.11) and Admiralty bounties give the English captain an income; M5 takes about 1 week longer | **Closed 13 Nov: Pirate only (D29)** |
| **O3** | World scale and display (D26, D27) | Game metres with 1 px/m at zoom ×1; whole zoom steps; logical height about 360 (computer) and 240 (phone) with integer scaling | Keep 2 px/m and real ship sizes, shorten the gun range to about 120 m and rely on the combat camera | **Closed 13 Nov: scale test (D26, D27)** |
| **O4** | Score and saving (D30 against D9) | Net gold gained; save in port, suspend at sea | Keep "gold earned" and saving anywhere, and accept that the score can be inflated | **Closed 13 Nov: accepted (D30)** |
| **O5** | Length of a game day (world ideas, 17 Nov) | 16 real minutes | 12 or 24 minutes | **Closed 17 Nov: 12 minutes (D42)** |
| **O6** | When does the Caribbean map come? (D48) | **M3b**, right after M3 and before boarding (M4) | Keep it in M5 with ports and trade | When your mockup is ready |
| **O7** | Where does the headless arena keep its logs? (D46) | Files on the machine that runs it (`arena-logs/`), listed on a small web page | SQLite now (it comes with the backend in M9 anyway) | M3 step 6 |

O2 and O4 change no code yet: the side matters only from M5, the score and saves only from M6.

Closed earlier: side in Stage 1 (D29, 13 Nov), score and saving (D30, 13 Nov), aiming (D16), client language TypeScript (D17), art style (D18), Living Sea as its own release (D19), Apple Developer Program at M10 (D21).

---

## Appendix A — Sailing terms

| Term | Meaning |
|---|---|
| Port / starboard | Left / right side of the ship, looking forward |
| Broadside | All guns of one side firing |
| Beam | The direction at a right angle to the hull |
| Heading | The direction the bow points |
| Tack | Turn the bow through the wind; sail a zigzag upwind |
| In irons | Stopped, with the bow pointing into the wind |
| No-go zone | The angles near the wind where a ship cannot sail |
| Rig | The sail arrangement: fore-and-aft, square or mixed |
| Strike the colours | Lower the flag: surrender |
| Prize | A captured ship |
| Round / chain / grape shot | Ball / two halves on a chain / a bag of small balls |

## Appendix B — Change history

### v0.7 (18 Nov 2026) — decisions from the M3 tests, a shorter plan

| Change | Section |
|---|---|
| 19 Nov (late): D55 (crew spirit, traders), D56 (the land stops balls), D57 (a battle against bots) | 2 |
| 19 Nov (night): D58 (bow chasers), D59 (pause and END GAME), D60 (bot skills); step 7c done | 2, 8 |
| 20 Nov: D61 (wrecks fade and leave the screen; solo speed × 1.15); step 7c2 done | 2, 8 |
| 19 Nov (evening): D52 (fluyt and caravel), D53 (sailing crew), D54 (M3 steps 7a–7d, M4b before M4, a "Squadrons" milestone) | 2 |
| New decisions D43 (camera circle, spyglass centred), D44 (collisions and ramming v2), D45 (bot seamanship), D46 (headless arena), D47 (the arena observer sees everything), D48 (a Caribbean map in M3b); on 19 Nov D49 (ways round the land, harbour boats), D50 (lead aiming, rammers), D51 (WANTED, 3–5 bots) | 2 |
| Status, key constants and the ship table brought up to date (D38, D39, sails) | top, 4.0, 4.10 |
| Camera: no slide toward the enemy | 4.1 |
| New 4.7b: collisions and ramming | 4.7b |
| Bots: what M3 built, seamanship part 2 | 4.11 |
| Headless arena in the tools; `build_map.py` moves to M3b | 5.6 |
| M2b and M3 checklists shortened (details in the dev log); M3 step 6; new milestone M3b | 6.2 |
| New risk (the map delays boarding); open decisions O6, O7 | 8, 9 |

### v0.6 (13 Nov 2026) — response to the external review of v0.5

| Review finding | Our response | Section |
|---|---|---|
| The view (320 × 180 m) is smaller than the gun range (250 m); D25 contradicts 4.1 | **Agreed; critical.** World scale in game metres, 1 px/m at ×1, max range about 200 m, combat camera, edge markers; the M1 scale test decides (O3). D25 zoom steps replaced | 4.0, 4.1, 4.4, D26, M1 |
| Pixel art shimmers at ×1.5 | **Agreed.** Whole zoom steps; integer pixel scaling with a logical height per device. This also fixes the non-whole canvas scaling, which the review did not mention | D27 |
| Two sprite sizes (LODs) | **Partly.** Zoom-in reuses the same sprite at a whole step; the zoomed-out view uses icons, so a second sprite size is not needed | D26 |
| 16 directions instead of 32; art spike a full day | **Agreed.** The spike compares 16, 16 plus rotation, and 32 | D33, M2 |
| The timeline is optimistic (45–55 weeks) | **Agreed in direction.** New estimate about 44 weeks (range 38–55) after cuts; hours logged; recompute after each release | 6, 6.1, D36 |
| The English captain has no targets | **Agreed.** Decided: Pirate only in Stage 1 (D29). For either option, pirate bots now keep their loot | D29, 4.11, 9 |
| Combat has no tuning targets; 10–25% hits per ball | **Confirmed by our own simulation** (0.9 hits per salvo at 150 m with v0.5 sizes). We also found that doubling ship size doubles the hit rate, so σ is tuned after the scale test | 4.4, D28 |
| Score and economy exploits | **Agreed.** Net gold score and suspend save at sea (D30); per-unit prices, spread, imports (D31) | 4.9, 4.12, 4.13 |
| 1,000-day economy simulation in Python | **Changed:** the run uses the real TypeScript `sim/` code, so there is no second copy of the rules to drift apart; Python reads and plots the CSV | 4.9, 5.6 |
| Determinism across browser engines | **Agreed.** D23 wording corrected; saves hold the full state | D23, 4.13 |
| Off-screen contacts | **Agreed.** Edge markers, sighting range 1,500 m | 4.1, 4.15 |
| Swept hit test | **Agreed** | 4.4, M2 |
| Bot tacking | **Agreed.** Hysteresis, cooldown, headless scenarios | 4.11, M3 |
| Map painting workload | **Agreed.** Mask plus `build_map.py`, reused for the navigation grid | 5.6, M5 |
| Too many touch controls | **Agreed.** Assisted aim option in M8 | 4.14, M8 |
| Provisions may become a chore | **Agreed.** Fun check 2 sets the R4 scope | M6, M7 |
| Phaser 4 is new; pin the version | **Agreed.** 4.2.1 was npm's `latest` version when we installed it (12 Nov 2026); now pinned exactly | D32, 5.4, 5.9 |
| iOS: audio unlock, safe areas, no fullscreen API, App Store review | **Agreed** | 5.9, M8, M10 |
| Privacy law for accounts | **Agreed,** as a reminder in M9 | M9 |
| No early sound or "juice" | **Agreed.** Placeholder sound, flash and shake in M2 | 4.15, M2 |
| Documents drift; three angle systems; fun-check criteria | **Agreed.** Section 4.0 as the single source; `sim/angles.ts` with unit names; written criteria | 4.0, 5.5, D34, D35 |
| *Our own findings* | The 4.3 formulas differ from the M1 step 1 code (noted; step 3 aligns them). Section 7 still said we talk in English (fixed). 5.3 showed a `tests/` folder, but unit tests sit next to the code (fixed). M1 gains one step (the scale test): not a new idea, but the "scale feels wrong" risk that the plan already assigned to M1 | 4.3, 5.3, 7, M1 |

### v0.5 (12 Nov 2026)

| Change | Section |
|---|---|
| New decisions D22 (manual project setup), D23 (fixed step with interpolation and command queue), D24 (temporary touch buttons), D25 (zoom scale and large phone HUD) | 2 |
| Controls: current test version described | 4.14 |
| HUD: separate phone layout | 4.15 |
| Repository: list of real files at the end of M1 step 1c | 5.3 |
| Backend Python version: 3.12–3.13 chosen with uv | 5.4 |
| TypeScript project settings (rule 7); new section 5.9 Phaser 4 notes | 5.8, 5.9 |
| M0 marked done; M1 split into steps with progress | 6.2 |
| New companion document: `dev-log-en.md` (problems and fixes) | top |

### v0.4 (12 Nov 2026)

| Change | Section |
|---|---|
| Client language is **TypeScript** with gentle rules (D17); new section 5.8; M0 checks the type setup | 2, 5.4, 5.8, 6.2 |
| Art style confirmed: pixel look at 640 × 360 (D18) | 2 |
| "Living Sea" confirmed as its own release R4 (D19) | 2 |
| Apple Developer Program at M10 (D21) | 2 |
| Open decisions reduced to one (O1: backend order) | 9 |

### v0.3 (12 Nov 2026)

| Change | Section |
|---|---|
| Your new ideas staged into small first versions and later versions | 3.3 |
| New release R4 "Living Sea": provisions, fishing, contracts, sea events, outlaw rule | 4.16, 6 |
| Shooting keeps a share of luck: salvo error, gun error, gun wear, marker ellipse | 4.4 |
| Trade with a purpose: port stocks, merchants carrying real goods | 4.9 |
| Bot variety: skill tiers, armed merchantman, navy sloop-of-war | 4.10, 4.11 |
| Art path to a 3D look with pre-rendered sprites; art spike in M2 | 2 (D18), art guide |
| Aiming decision closed (D16); new open decisions O4 and O5 | 2, 9 |
| Stage 1 length: about 30 weeks (was 27) | 6.1 |

### v0.2 (12 Nov 2026)

**From your answers**

| Change | Section |
|---|---|
| Title is Naval-Battles | 1, 5.3 |
| Captured ships can become your ship | 4.7 |
| Ship-loss rule fixed: 50% of gold, restart in a sloop | 4.8 |
| A first playable release in 6 weeks; roadmap regrouped into 6 releases | 6 |
| Backend moved after the web alpha | 6 |
| Mix work style; hardware noted | 2, 7 |

**Adopted from the web draft "Sails & Powder"**

| Idea | Section |
|---|---|
| Time acceleration and pause | 4.1 |
| Trade wind as the default wind | 4.2 |
| Different polars per rig | 4.3 |
| Hull and rigging hit zones | 4.4 |
| Surrender at low crew; destroyed sails allow boarding but the crew fights | 4.7 |
| Bots use the same commands as the player; plain-data world state | 4.11, 5.2 |
| lil-gui tuning panel | 5.4 |
| Python helper scripts from the first weeks | 5.6 |
| Save export and import; installable web app before Capacitor | 4.13, 5.4 |
| Early "first duel" fun check | 6.2 |

**Not adopted from the web draft**

| Idea | Reason |
|---|---|
| Three.js and a tilted 3D camera | You confirmed Phaser 4 and top-down |
| Spain as the enemy, 1700–1725 | You confirmed England + pirates, 1650–1720 |
| Ship morale value, three boarding rounds, air drag | Simpler first; on the Stage 2 list |
| Treasure galleon | Arrives with Spain in Stage 2 |
| Automatic gun elevation | Closed in v0.3: manual elevation (D16) |

**Fixes found in the review**

| Problem in v0.1 | Fix |
|---|---|
| Gun range (500 m) was larger than the screen (320 m) | Range about 250 m; tactical zoom |
| The merchantman had 14 guns per side | 3 guns per side: a fair first target |
| Crossing the map took too long | Smaller map; time acceleration |
| One polar for all ships | Three rig types |

# Naval-Battles — Art and Tools Guide v0.2

*12 Nov 2026 · Companion to plan v0.4 · All sizes are starting values*

---

## 1. Art direction: two steps

You want objects that look 3D, like the Kenney Pirate Kit sample, while the game stays 2D. The standard way to do this is **pre-rendered sprites**: a 3D model is rendered to small pictures from a fixed camera, once for each direction, and the game shows those pictures. Phaser stays a 2D engine and the game rules do not change.

| Step | When | Ships | Islands and objects | Source |
|---|---|---|---|---|
| **1. Placeholders** | R1–R4 | One top-down picture, rotated by the engine | Flat top-down tiles | Kenney **Pirate Pack** (2D) |
| **2. 3D look** | Art spike in M2, full pass in M8 | 32 pre-rendered directions per ship | Tiles plus tall pre-rendered objects | Kenney **Pirate Kit** (3D models) or your own models |

**Why this order:** the fights must be fun before you spend time on art. The code hides the difference inside one replaceable part (`ShipView`), so switching from step 1 to step 2 does not touch the game rules.

**Art spike (2–3 hours, during M2):** we render one Pirate Kit ship in 32 directions with a Blender script and put it in the game. You look at it and decide on the camera angle, and confirm the pixel look (decision D18), before drawing anything.

**One limit to know:** the world math is top-down, but step-2 sprites are seen from an angle. This small mismatch is normal in games of this type and is rarely noticed. The spike will show whether it bothers you.

---

## 2. Global rules

| Item | Value |
|---|---|
| Logical resolution | 640 × 360 px (16:9), scaled ×2 / ×3 / ×4 with sharp pixels |
| World scale | 1 m = 2 px |
| Tile size | **32 × 32 px** = 16 × 16 m |
| File format | PNG, 32-bit RGBA, sRGB, transparent background |
| Sprite sheets | Uniform grid, or atlas PNG + JSON; **at most 2048 × 2048 px** per sheet |
| Padding | 1 px transparent border around each frame; tiles extruded by 1 px |
| Light direction | From the top-left (north-west) in every sprite |
| Shadows | Not baked into ship sprites; the game draws them |
| Outline | None, or 1 px dark outline; choose one and keep it everywhere |
| Palette | One shared palette of 32–64 colours (for example from lospec.com) |
| Ship facing in the file | Bow points **right** (east) in frame 0 |
| Anchor point | Ships: centre of the hull. Tall objects: bottom centre |
| File names | lower-case, hyphens: `ship-sloop.png`, `fx-splash.png`, `tiles-caribbean.png` |
| Art budget | Each sheet under 500 KB; all art under 10 MB; all audio under 10 MB |

The pixel look at 640 × 360 is confirmed (D18). If we ever switch to a smooth HD look at 1280 × 720, multiply every pixel size in this guide by 2.

---

## 3. Sprite specifications

### 3.1 Ships — step 1 (top-down, rotated by the engine)

One PNG per ship class. The hit box comes from the data file (length and beam in metres), not from the picture.

| Class | Real length | Sprite size (length × width) | Frames | File size |
|---|---|---|---|---|
| Sloop | 15 m | 30 × 14 px | 3 (sails furled / half / full) | under 5 KB |
| Brigantine | 20 m | 40 × 18 px | 3 | under 5 KB |
| Merchantman | 28 m | 56 × 24 px | 3 | under 10 KB |
| Frigate | 35 m | 70 × 28 px | 3 | under 10 KB |

The width includes the sails, which are wider than the hull.

### 3.2 Ships — step 2 (pre-rendered 3D look)

| Item | Value |
|---|---|
| Camera | Orthographic, 55° above the horizon (we test 45°–65° in the spike) |
| Directions | **32** (one every 11.25°), frame 0 = bow east, then clockwise |
| Sail states | 3: furled, half, full (optional 4th: torn) |
| Frames per ship | 32 × 3 = **96** |
| Rendering | Render at 4× size, scale down, reduce to the shared palette |

| Class | Frame size | Sheet layout | Sheet size | File size (estimate) |
|---|---|---|---|---|
| Sloop | 48 × 48 px | 12 × 8 | 576 × 384 px | 40–80 KB |
| Brigantine | 64 × 64 px | 12 × 8 | 768 × 512 px | 60–120 KB |
| Merchantman | 80 × 80 px | 12 × 8 | 960 × 640 px | 100–200 KB |
| Frigate | 112 × 112 px | 12 × 8 | 1344 × 896 px | 150–300 KB |

Flags and faction colours: a separate small overlay (8 × 6 px, 4 frames) so one ship sheet serves England, pirates and merchants.

### 3.3 Sea and land tiles

| Tile group | Size | Count | Notes |
|---|---|---|---|
| Deep water | 32 × 32 | 1 tile × 4 animation frames | Seamless on all sides |
| Shallow water | 32 × 32 | 1 × 4 frames | Lighter colour near coasts |
| Sand, grass, rock | 32 × 32 | 2–4 variants each | |
| Coast transitions (water ↔ sand) | 32 × 32 | 16 (minimum) or 47 (full set) | Tiled places them with its Terrain tool |
| Transitions sand ↔ grass | 32 × 32 | 16 | |
| **Whole tile sheet** | 512 × 512 px or smaller | about 100–150 tiles | under 150 KB |

### 3.4 Island objects (3D look)

Pre-rendered or hand-drawn, anchored at the bottom centre, sorted by their y position so that ships pass behind tall objects.

| Object | Size | Frames |
|---|---|---|
| Palm, rocks, barrels | 16 × 24 to 32 × 48 px | 1 (palms: optional 4 sway frames) |
| House, dock, watch tower | 48 × 48 to 64 × 80 px | 1 |
| Fort, port town | 96 × 96 to 128 × 128 px | 1 |
| Shipwreck, ghost ship | as the ship class | 1 direction is enough for a wreck |

### 3.5 Effects

| Effect | Frame size | Frames | Plays |
|---|---|---|---|
| Cannonball | 4 × 4 px | 1 | — |
| Ball shadow | 4 × 2 px | 1 | — |
| Muzzle flash and smoke | 16 × 16 px | 6 | once, 12 frames/s |
| Water splash | 16 × 24 px | 6 | once |
| Hull hit (splinters) | 24 × 24 px | 6 | once |
| Fire | 16 × 24 px | 6 | loop |
| Smoke puff (particle) | 8 × 8 px | 4 | loop |
| Wake and foam (particle) | 8 × 8 px | 2 | fades out |
| Loot crate | 12 × 12 px | 2 | bobbing loop |
| Fishing boat or net | 16 × 16 px | 2 | loop |

### 3.6 Interface

| Element | Size |
|---|---|
| HUD icons (ammunition, crew, food, gold, wind) | 16 × 16 px |
| Buttons (touch) | 32 × 32 px minimum; 48 × 48 px for fire buttons |
| Compass and wind rose | 48 × 48 px |
| Bars (hull, sails, crew) | 48 × 6 px, drawn by code |
| Port screen background | 640 × 360 px, one per port type (English, pirate, neutral) |
| Captain and character portraits | 48 × 48 px |
| World map (parchment) | 640 × 360 px |
| Font | Bitmap pixel font, 8 px high for text, 16 px for titles |

### 3.7 Sound

| Type | Format | Notes |
|---|---|---|
| Effects (cannon, splash, hit, creak, bell) | MP3, mono, 44.1 kHz | under 100 KB each; about 20 sounds |
| Ambient loops (sea, wind, port) | MP3, stereo | 20–40 s, seamless loop |
| Music | MP3, stereo | 2–3 tracks, under 2 MB each |

---

## 4. What is in your `ext_resources` folder

I checked all five packs: they are CC0 or public domain (free for any use, no credit required; credit to Kenney is welcome).

| Pack | Content | Use |
|---|---|---|
| **kenney_pirate-pack** (2D) | 24 ships of 66 × 113 px, hulls, sails, 3 explosions, 2 fires, 96 land and sea tiles of 64 × 64 px. Also a ×2 "Retina" set | **Step-1 placeholders.** The art is smooth cartoon style, not pixel art, and twice our scale |
| **kenney_pirate-kit** (3D) | 72 models in GLB, FBX and OBJ: `ship-small`, `ship-medium`, `ship-large`, three pirate ships, `ship-ghost`, `ship-wreck`, row boats, towers, castle parts, docks, palms, rocks, chests, cannons, flags | **Step-2 source.** `ship-ghost` and `ship-wreck` fit your ghost-ship and lost-ship ideas |
| **kenney_monochrome-pirates** (2D) | **Real pixel art**, 16 × 16 px tiles, one packed sheet of 136 tiles (272 × 128 px), plus a Tiled tileset file. Sea and sand tiles, top-down ship parts (deck, hull, masts), cannon, anchor, flag, skull, chests, barrels, fish, characters. One colour per theme (monochrome; also a "Default" colour set) | **Best match for the pixel look.** Use it for HUD icons and for early placeholder tiles. A 16 px tile shown at 2× fills our 32 px grid exactly |
| **kenney_cartography-pack** (2D) | Hand-drawn line-art map symbols: castles, houses, lighthouse, ship, palms, mountains, trees, compass, plus five parchment textures. Not pixel art | **World-map screen and treasure maps** (R4). Textures can be shrunk and posterised to match the pixel look |
| **kenney_map-pack** (2D) | Cartoon land tiles in several biomes (sand, grass, stone, snow, dirt), trees and small objects. Public domain. Not pixel art and not sea tiles | Low priority: only the sand and grass tiles might serve for island placeholders |
| `ships_1650-1720.txt` and rig pictures | Your reference notes | They match the plan's ship classes. One addition taken from them: navy patrols also use small sloops-of-war |

**How to use the Pirate Pack as placeholders**

1. Tiles: shrink `tiles_sheet.png` to 50% once, which gives 32 × 32 px tiles that fit this guide.
2. Ships: use the "Default size" ships and set a scale per class: sloop 0.30, brigantine 0.40, merchantman 0.50, frigate 0.65.
3. The sprite sheet's `.xml` file is in a format Phaser reads directly.

**Open question for the M1–M2 art test:** the Pirate Pack is smooth cartoon art, while the Monochrome Pirates pack is true pixel art. We will try both for the first sea scene and keep the one that looks closer to your goal. If the pixel look wins, the Pirate Pack is used only for ship shapes.

---

## 5. Pipeline for the 3D look

```
3D model (.glb) ──▶ Blender script: 32 directions × 3 sail states, rendered at 4× size
                 ──▶ scale down + shared palette      (tools/make_spritesheet.py)
                 ──▶ sprite sheet PNG                 (client/public/assets/sprites/)
                 ──▶ optional hand retouch in the pixel editor
```

- The Blender step is a Python script, so it is also Python practice.
- Kenney models have no separate sail states. For the spike we render them as they are; for the final art we hide or scale the sail parts, or you build your own models.
- Simple ways to make your own models: **Blockbench** (low-poly) or **MagicaVoxel** (voxel blocks).

---

## 6. Recommended tools

| Purpose | Tool | Cost | Note |
|---|---|---|---|
| Code editor | **VS Code** with ESLint, Prettier, Python and Ruff extensions | Free | |
| Version control | **Git** + GitHub; GitHub Desktop if you prefer buttons | Free | |
| JavaScript runtime | **Node.js LTS** | Free | Runs Vite and the tests. TypeScript is added by the project template |
| Python | **Python 3.12+** with **uv** | Free | Helper scripts now, backend later |
| Debugging | Chrome DevTools; Safari Web Inspector on the Mac for the iPad and iPhone | Free | |
| Live tuning | **lil-gui** | Free | Sliders for game numbers |
| Maps | **Tiled** | Free | Phaser reads its JSON maps directly |
| Pixel art | **Aseprite** | about 20 USD | The standard tool; animation and sheet export. Runs on Windows, Linux and macOS, so it works on both of your computers |
| Pixel art, free | **LibreSprite**, **Pixelorama**, **Piskel** | Free | Good enough to start |
| 3D rendering to sprites | **Blender** | Free | Batch rendering by script |
| Simple 3D modelling | **Blockbench**, **MagicaVoxel** | Free | Much easier than modelling in Blender |
| Kenney's model builder | **Asset Forge** | Paid | Builds models from blocks in the Kenney style; check that the edition you buy exports sprites |
| Sprite sheet packing | **Free Texture Packer**, or our own `make_spritesheet.py` | Free | |
| Tile edge fix | **tile-extruder** (npm) | Free | Removes thin lines between tiles |
| Palettes | **lospec.com** palette list | Free | |
| Sound editing | **Audacity** | Free | |
| Sound effects | **jsfxr**, **ChipTone** | Free | Retro effect generators |
| Free sounds and music | Kenney audio packs, OpenGameArt, freesound.org | Free | Check each licence |
| Bitmap fonts | Kenney Fonts; **SnowB BMFont** to build font sheets | Free | |
| Balance tables | LibreOffice Calc or Excel | Free | Plus the Python range-table script |
| Task tracking | Trello or GitHub Issues | Free | One card per milestone checklist item |

Not needed now: Phaser Editor (paid visual editor), TexturePacker (paid), a game server.

---

## 7. Art work by release

| Release | Art needed |
|---|---|
| R1 First Duel | Kenney placeholders only: 2 ships, water tile, 1 island, ball, splash (Pirate Pack or Monochrome Pirates, decided in the M1 test) |
| R2 Skirmish | Placeholders for 4 ship classes, smoke, hit effect, HUD icons. **Art spike** result decides the 3D-look settings |
| R3 Campaign | Placeholder tile map, port screen sketches, world map (Cartography Pack) |
| R4 Living Sea | Icons for food and contracts (Monochrome Pirates icons), wreck and crate sprites, treasure map picture |
| R5 Web Alpha | **Final art pass:** 4 ship sheets, tile sheet, island objects, effects, interface, sound |

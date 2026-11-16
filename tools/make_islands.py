"""The sea and its islands, made by code ("Open Sea" milestone, package A).

For every island this script makes two things that always fit together:
  - the shore line as a polygon in game metres (the game uses it for collisions,
    for the bots and for the chart), and
  - a picture at 1 pixel per game metre (sand, grass, trees, a mountain, a small river).

How an island gets its shape: walk once round its centre and ask "how far is the shore
in this direction?". A few sine waves of different lengths make the answer wobble, which
gives capes; a "bay" pulls the shore in over a range of directions, deep enough to sail into.

The same seed always gives the same sea. Your own islands in
client/src/data/islands.json are not touched: the script reads them and keeps clear of them.

Run from the repository root (about 10 seconds):
    uv run --with numpy --with pillow tools/make_islands.py
It writes
    client/src/data/islandsGenerated.json     shore polygons and where each picture goes
    client/public/assets/islands/<name>.png   the pictures
    docs/art/world-preview.png                the whole sea, 1 pixel = 5 metres
"""

import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "client" / "src" / "data"
PICTURES = ROOT / "client" / "public" / "assets" / "islands"
PREVIEW = ROOT / "docs" / "art" / "world-preview.png"

SEED = 1650
RIM = 14  # metres of pale shallow water drawn round the sand (picture only)
CORNERS = 40  # corners of a shore polygon
START = (160.0, 90.0)  # where the player starts; keep the sea open here
START_CLEAR = 520.0
GAP = 170.0  # free water between two islands, metres (room to sail and to fight)
EDGE_CLEAR = 260.0  # free water between an island and the reef at the edge of the chart

# Colours (the same family as the first island drawn by the game).
SHALLOW = (79, 159, 207)
SAND = (232, 210, 154)
SAND_DARK = (214, 190, 132)
GRASS = (95, 158, 75)
GRASS_DARK = (76, 138, 60)
TREE = (47, 107, 47)
TREE_LIGHT = (70, 138, 62)
TREE_SHADE = (38, 84, 44)
PALM = (58, 128, 58)
ROCK = [(126, 112, 88), (148, 134, 106), (172, 160, 134), (206, 198, 180)]  # low to high
ROCK_SHADE = [(102, 90, 72), (122, 110, 88), (144, 134, 112), (178, 170, 154)]
RIVER = (79, 159, 207)
REEF = (58, 92, 110)

NAMES_BIG = ["Isla Verde", "Hawk's Nest", "Blackwater Island", "Tortoise Head"]
NAMES_MEDIUM = ["Turtle Island", "Mango Cay", "Parrot Island", "Smuggler's Cay", "Windward Cay", "Three Palms", "Rum Key", "Coral Cay"]
NAMES_SMALL = ["Gull Rock", "Crab Rock", "Shark Tooth", "Sandy Islet", "Dead Man's Key", "Lone Palm", "Cutlass Rock", "Pearl Islet", "Drift Cay", "The Twins", "Barnacle Rock", "Mermaid's Stool"]


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def shore(rng, radius: float, stretch: float, bays: list[tuple[float, float, float]]) -> np.ndarray:
    """
    The shore as CORNERS points around (0, 0).
      radius   average distance from the centre to the shore
      stretch  1 = round, 2 = twice as long as wide
      bays     (direction in radians, half-width in radians, depth 0..1) for each bay
    """
    angles = np.linspace(0, 2 * math.pi, CORNERS, endpoint=False)
    r = np.full(CORNERS, radius)
    for waves, strength in ((2, 0.16), (3, 0.12), (5, 0.07), (7, 0.04)):
        r += radius * strength * rng.uniform(0.4, 1.0) * np.cos(waves * angles + rng.uniform(0, 2 * math.pi))
    for direction, half_width, depth in bays:
        off = np.abs((angles - direction + math.pi) % (2 * math.pi) - math.pi)
        pull = np.clip(1 - off / half_width, 0, 1)
        r *= 1 - depth * (pull * pull * (3 - 2 * pull))  # a smooth dip, deepest in the middle of the bay
    turn = rng.uniform(0, math.pi)
    x = np.cos(angles) * r * stretch
    y = np.sin(angles) * r
    return np.stack([x * math.cos(turn) - y * math.sin(turn), x * math.sin(turn) + y * math.cos(turn)], axis=1)


def distance_inside(mask: np.ndarray, most: int) -> np.ndarray:
    """For every land pixel: how many pixels to the shore (up to `most`). Peel the land layer by layer."""
    dist = np.zeros(mask.shape, dtype=np.int32)
    land = mask.copy()
    for _ in range(most):
        dist += land
        inner = land.copy()
        inner[1:, :] &= land[:-1, :]
        inner[:-1, :] &= land[1:, :]
        inner[:, 1:] &= land[:, :-1]
        inner[:, :-1] &= land[:, 1:]
        inner[0, :] = inner[-1, :] = False
        inner[:, 0] = inner[:, -1] = False
        if not inner.any():
            break
        land = inner
    return dist


def grow(mask: np.ndarray, pixels: int) -> np.ndarray:
    """The mask made `pixels` wider all round."""
    out = mask.copy()
    for _ in range(pixels):
        wider = out.copy()
        wider[1:, :] |= out[:-1, :]
        wider[:-1, :] |= out[1:, :]
        wider[:, 1:] |= out[:, :-1]
        wider[:, :-1] |= out[:, 1:]
        out = wider
    return out


def soft_noise(rng, shape: tuple[int, int], cell: int) -> np.ndarray:
    """Smooth random values 0..1 (a coarse random grid, blown up and blurred by the resize)."""
    coarse = rng.uniform(0, 1, (shape[0] // cell + 2, shape[1] // cell + 2)).astype(np.float32)
    image = Image.fromarray((coarse * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.BICUBIC)
    return np.asarray(image, dtype=np.float32) / 255


def paint(rng, points: np.ndarray, kind: str) -> tuple[Image.Image, float, float]:
    """The island's picture and the world position of its top left corner."""
    min_x = math.floor(points[:, 0].min()) - RIM
    min_y = math.floor(points[:, 1].min()) - RIM
    w = math.ceil(points[:, 0].max()) + RIM - min_x
    h = math.ceil(points[:, 1].max()) + RIM - min_y
    mask_image = Image.new("1", (w, h), 0)
    ImageDraw.Draw(mask_image).polygon([(float(x - min_x), float(y - min_y)) for x, y in points], fill=1)
    land = np.asarray(mask_image, dtype=bool)
    dist = distance_inside(land, 400)
    wobble = (soft_noise(rng, (h, w), 18) - 0.5) * 10  # the edges of the colour bands are not ruler-straight

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[grow(land, RIM)] = (*SHALLOW, 255)
    rgba[land] = (*SAND, 255)
    rgba[land & (soft_noise(rng, (h, w), 5) > 0.72)] = (*SAND_DARK, 255)
    grass = dist + wobble > (11 if kind != "small" else 16)
    rgba[grass] = (*GRASS, 255)
    rgba[dist + wobble > 30] = (*GRASS_DARK, 255)

    # A mountain on big islands: height bands, lit from the west like the ships.
    high = np.zeros((h, w), dtype=np.float32)
    if kind == "big":
        cy, cx = np.unravel_index(np.argmax(dist), dist.shape)  # the point farthest from the sea
        reach = dist[cy, cx] * 0.75
        yy, xx = np.mgrid[0:h, 0:w]
        ridge = rng.uniform(0, math.pi)
        dx = (xx - cx) * math.cos(ridge) + (yy - cy) * math.sin(ridge)
        dy = -(xx - cx) * math.sin(ridge) + (yy - cy) * math.cos(ridge)
        high = np.clip(1 - np.hypot(dx / 1.5, dy) / reach, 0, 1) + (soft_noise(rng, (h, w), 12) - 0.5) * 0.22
        high[dist < 26] = 0
        slope_east = np.zeros_like(high)
        slope_east[:, 1:-1] = high[:, 2:] - high[:, :-2]
        for level, limit in enumerate((0.22, 0.42, 0.62, 0.82)):
            band = high > limit
            rgba[band & (slope_east >= 0)] = (*ROCK[level], 255)  # rising toward the east = facing the west light
            rgba[band & (slope_east < 0)] = (*ROCK_SHADE[level], 255)

        # A small river from the foot of the mountain down to the sea: always step toward the shore.
        angle = rng.uniform(0, 2 * math.pi)
        y, x = int(cy + math.sin(angle) * reach * 0.8), int(cx + math.cos(angle) * reach * 0.8)
        for _ in range(2000):
            if not (1 <= y < h - 1 and 1 <= x < w - 1) or not land[y, x]:
                break
            rgba[y, x] = rgba[y, x + 1] = (*RIVER, 255)
            steps = [(dy_, dx_) for dy_ in (-1, 0, 1) for dx_ in (-1, 0, 1) if (dy_, dx_) != (0, 0)]
            lower = [s for s in steps if dist[y + s[0], x + s[1]] < dist[y, x]]
            level_ = [s for s in steps if dist[y + s[0], x + s[1]] == dist[y, x]]
            choice = lower if (lower and rng.uniform() < 0.8) or not level_ else level_
            step = choice[rng.integers(len(choice))]
            y, x = y + step[0], x + step[1]

    # Trees: round crowns with a light spot and a shadow; palms on small sandy islets.
    spacing = {"big": 9, "medium": 10, "small": 14}[kind]
    draw_on = Image.fromarray(rgba)
    pen = ImageDraw.Draw(draw_on)
    for gy in range(0, h, spacing):
        for gx in range(0, w, spacing):
            x = gx + int(rng.integers(-3, 4))
            y = gy + int(rng.integers(-3, 4))
            if not (3 <= x < w - 3 and 3 <= y < h - 3) or high[y, x] > 0.2:
                continue
            if tuple(rgba[y, x, :3]) == RIVER:
                continue
            if kind == "small":
                if dist[y, x] < 7 or rng.uniform() > 0.5:
                    continue
                pen.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(*PALM, 255))
                pen.point((x - 1, y - 1), fill=(*TREE_LIGHT, 255))
                continue
            if dist[y, x] + wobble[y, x] < 16 or rng.uniform() > 0.72:
                continue
            size = int(rng.integers(2, 5))
            pen.ellipse((x - size + 1, y - size + 2, x + size + 1, y + size + 2), fill=(*TREE_SHADE, 255))
            pen.ellipse((x - size, y - size, x + size, y + size), fill=(*TREE, 255))
            pen.ellipse((x - size + 1, y - size + 1, x, y), fill=(*TREE_LIGHT, 255))
    return draw_on, float(min_x), float(min_y)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    rng = np.random.default_rng(SEED)
    world = read_json(DATA / "world.json")
    handmade = read_json(DATA / "islands.json")["islands"]
    # Circles to keep clear of: the start, and every island you made by hand.
    taken: list[tuple[float, float, float]] = [(START[0], START[1], START_CLEAR)]
    for island in handmade:
        xs = [p["x"] for p in island["points"]]
        ys = [p["y"] for p in island["points"]]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        taken.append((cx, cy, math.hypot(max(xs) - min(xs), max(ys) - min(ys)) / 2))
    # Your second island (Pelican Cay moved 600 m east) is only in your copy of islands.json:
    taken.append((762.0, 622.0, 200.0))

    plan: list[tuple[str, str]] = (
        [("big", n) for n in NAMES_BIG[:3]] + [("medium", n) for n in NAMES_MEDIUM[:6]] + [("small", n) for n in NAMES_SMALL[:9]]
    )
    islands = []
    PICTURES.mkdir(parents=True, exist_ok=True)
    for kind, name in plan:
        if kind == "big":
            radius, stretch = rng.uniform(260, 360), rng.uniform(1.1, 1.5)
            bays = [(rng.uniform(0, 2 * math.pi), rng.uniform(0.45, 0.6), rng.uniform(0.55, 0.72))]
            if rng.uniform() < 0.6:
                bays.append(((bays[0][0] + rng.uniform(2.0, 4.2)) % (2 * math.pi), rng.uniform(0.3, 0.4), rng.uniform(0.3, 0.45)))
        elif kind == "medium":
            radius, stretch = rng.uniform(110, 190), rng.uniform(1.0, 2.2)
            bays = [(rng.uniform(0, 2 * math.pi), rng.uniform(0.5, 0.7), rng.uniform(0.4, 0.6))] if rng.uniform() < 0.5 else []
        else:
            radius, stretch = rng.uniform(18, 46), rng.uniform(1.0, 1.8)
            bays = []
        shape = shore(rng, radius, stretch, bays)
        reach = float(np.hypot(shape[:, 0], shape[:, 1]).max())
        for _ in range(4000):  # find a free place
            cx = rng.uniform(world["minX"] + world["reefWidth"] + EDGE_CLEAR + reach, world["maxX"] - world["reefWidth"] - EDGE_CLEAR - reach)
            cy = rng.uniform(world["minY"] + world["reefWidth"] + EDGE_CLEAR + reach, world["maxY"] - world["reefWidth"] - EDGE_CLEAR - reach)
            if all(math.hypot(cx - tx, cy - ty) > reach + tr + GAP for tx, ty, tr in taken):
                break
        else:
            raise SystemExit(f"no room for {name}")
        taken.append((cx, cy, reach))
        points = np.round(shape + [cx, cy])
        picture, px, py = paint(rng, points, kind)
        file = f"{slug(name)}.png"
        picture.save(PICTURES / file)
        islands.append(
            {
                "name": name,
                "kind": kind,
                "points": [{"x": float(x), "y": float(y)} for x, y in points],
                "picture": {"file": file, "x": px, "y": py},
            }
        )
        print(f"{name:20} {kind:6} centre ({cx:6.0f}, {cy:6.0f})  about {2 * reach:4.0f} m across  {picture.width} x {picture.height} px")

    (DATA / "islandsGenerated.json").write_text(json.dumps({"seed": SEED, "islands": islands}, indent=1) + "\n", encoding="utf-8")
    print("written islandsGenerated.json")

    # The whole sea at 1 pixel = 5 metres.
    k = 5
    w = (world["maxX"] - world["minX"]) // k
    h = (world["maxY"] - world["minY"]) // k
    preview = Image.new("RGBA", (w, h), (29, 91, 143, 255))
    pen = ImageDraw.Draw(preview)
    reef = world["reefWidth"] // k
    pen.rectangle((0, 0, w - 1, h - 1), outline=(*REEF, 255), width=reef)
    for island in islands:
        picture = Image.open(PICTURES / island["picture"]["file"])
        small = picture.resize((max(1, picture.width // k), max(1, picture.height // k)), Image.NEAREST)
        preview.alpha_composite(small, (int((island["picture"]["x"] - world["minX"]) / k), int((island["picture"]["y"] - world["minY"]) / k)))
    for island in handmade:
        pen.polygon([((p["x"] - world["minX"]) / k, (p["y"] - world["minY"]) / k) for p in island["points"]], fill=(*SAND, 255))
    sx, sy = (START[0] - world["minX"]) / k, (START[1] - world["minY"]) / k
    pen.ellipse((sx - 4, sy - 4, sx + 4, sy + 4), outline=(255, 224, 102, 255), width=2)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(PREVIEW)
    print("written", PREVIEW.name)


if __name__ == "__main__":
    main()

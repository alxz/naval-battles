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
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "client" / "src" / "data"
PICTURES = ROOT / "client" / "public" / "assets" / "islands"
PREVIEW = ROOT / "docs" / "art" / "world-preview.png"

SEED = 1650
RIM = 14  # metres of pale shallow water drawn round the sand (picture only)
INLET_ISLAND = "Isla Verde"  # this big island gets a river mouth that ships can sail into
INLET_WIDTH = 150  # metres at the mouth (a little narrower inside)
INLET_LENGTH = 240  # metres from the shore to the harbour
INLET_BEND = 40  # metres the inlet swings to the side and back
HARBOUR_RADIUS = 85  # metres: the round harbour at the end of the inlet, with the second port
INLET_TURN = 0.45  # radians: the inlet faces a little south of the middle of the sea (away from the big bay)
SHOAL = 56  # metres from the sand where the water is still a little paler, with small breaking waves (picture only)
SHOAL_WATER = (70, 140, 190)
RIVER_WATER = (112, 176, 168)  # muddy green water where a river meets the sea
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
LAVA_ROCK = [(92, 80, 72), (78, 66, 60), (64, 54, 50), (50, 42, 40)]  # a volcano: darker toward the top
LAVA_ROCK_SHADE = [(72, 62, 56), (60, 50, 46), (48, 40, 38), (38, 32, 30)]
LAVA = (236, 110, 40)
LAVA_HOT = (255, 208, 96)
ROOF = (176, 112, 62)
ROOF_SHADE = (132, 80, 46)
WALL = (226, 208, 170)
PLANK = (122, 86, 52)
PATH = (206, 184, 132)
# Looks for the islands you drew by hand (islands.json), in their order. An island may also carry its own "theme".
ANCHORAGE = 70  # metres from the end of the pier to the port's anchorage (where ships stop to repair)
LAST_PIER: dict[str, float] = {}
SHORE_GUNS: list[dict] = []  # set by paint() for a port: where its shore guns stand, in world metres (port law, D40)
SOLIDS: list[dict] = []  # set by paint() for a village: quay, piers and boats as polygons in world metres
MOUTHS: list[tuple[float, float]] = []  # set by paint(): river mouths in world metres, printed for testing  # set by paint() for a village: the world position of the end of its pier
HANDMADE_THEMES = ["volcano", "village"]

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


def crosses_itself(points: np.ndarray) -> bool:
    """Does the shore cross itself anywhere? (Then the polygon would be broken.)"""
    n = len(points)

    def side(p, q, r) -> float:
        return float((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))

    for i in range(n):
        a, b = points[i], points[(i + 1) % n]
        for j in range(i + 2, n):
            if (j + 1) % n == i:
                continue
            c, d = points[j], points[(j + 1) % n]
            if side(c, d, a) * side(c, d, b) < 0 and side(a, b, c) * side(a, b, d) < 0:
                return True
    return False


def carve_inlet(
    rng, points: np.ndarray, centre: tuple[float, float], direction: float, width: float, length: float, bend: float
) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """
    Cut a winding river mouth a ship can sail into. It runs from the shore toward the centre
    along `direction` (radians, from the centre out to the sea), `length` metres deep, and swings
    `bend` metres to one side and back (an S); it is `width` metres wide at the mouth, narrower
    inside, with ragged banks and a round end. Returns the new shore and the middle line of the
    inlet from the mouth to the head.
    """
    cx, cy = centre
    ux, uy = math.cos(direction), math.sin(direction)
    rel = points - [cx, cy]
    along = rel[:, 0] * ux + rel[:, 1] * uy  # out toward the sea
    side = -rel[:, 0] * uy + rel[:, 1] * ux  # across
    cut = (along > 0) & (np.abs(side) < width / 2 + 14)
    n = len(points)
    start = next(i for i in range(n) if cut[i] and not cut[i - 1])
    points, along, side, cut = (np.roll(a, -start, axis=0) for a in (points, along, side, cut))
    m = int(np.argmin(cut))  # the first corner after the cut
    a_side = 1 if side[-1] > 0 else -1  # the corner before the cut lies on this side of the inlet
    shore_at = float(max(along[:m].max(), along[-1], along[m]))
    steps = 18
    phases = rng.uniform(0, 2 * math.pi, 4)

    def middle(t: float) -> float:  # how far the middle line swings to the side, 0 at the mouth
        return bend * math.sin(1.5 * math.pi * t) * (1 - 0.3 * t)

    def half(t: float, k: int) -> float:  # half the width, with ragged banks
        rough = 7 * math.sin(9 * t + phases[k]) + 4 * math.sin(23 * t + phases[k + 2])
        return width / 2 * (1 - 0.3 * t) + rough * min(1.0, t * 4)

    def at(t: float, q: float) -> tuple[float, float]:
        s_ = shore_at - t * length
        return cx + ux * s_ - uy * q, cy + uy * s_ + ux * q

    wall = [at(k / steps, middle(k / steps) + a_side * half(k / steps, 0)) for k in range(steps + 1)]
    # The end: a round harbour (HARBOUR_RADIUS) that the two banks run into.
    end_a = half(1.0, 0)
    end_b = half(1.0, 1)
    r = HARBOUR_RADIUS
    depth = math.sqrt(max(1.0, r * r - max(end_a, end_b) ** 2))  # the banks meet the circle
    centre_t = 1 + depth / length
    first = math.atan2(a_side * end_a, -depth)  # angle 0 = deeper into the island
    last = math.atan2(-a_side * end_b, -depth)
    for k in range(1, 24):
        u = first + (last - first) * k / 24
        wall.append(at(centre_t + r * math.cos(u) / length, middle(1.0) + r * math.sin(u)))
    wall += [at(k / steps, middle(k / steps) - a_side * half(k / steps, 1)) for k in range(steps, -1, -1)]
    new = np.round(np.concatenate([np.array(wall), points[m:]]))
    path = [at(k / steps, middle(k / steps)) for k in range(steps + 1)] + [at(centre_t, middle(1.0))]
    return new, path


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


def shore_gun(pen, land: np.ndarray, x: float, y: float, toward: tuple[float, float], min_x: float, min_y: float) -> None:
    """One shore gun: a small stone platform with a dark barrel that points at the water (toward).
    Drawn without random numbers, so the islands' shapes stay as they are. Its place goes to SHORE_GUNS."""
    h, w = land.shape
    x, y = int(round(x)), int(round(y))
    if not (5 <= x < w - 5 and 5 <= y < h - 5):
        print(f"  shore gun at ({x}, {y}) is off the picture: left out")
        return
    if not land[y, x]:
        # Not on land: walk away from the water until we are (at most 30 px).
        dx, dy = x - toward[0], y - toward[1]
        n = math.hypot(dx, dy) or 1.0
        for k in range(1, 31):
            nx, ny = int(round(x + dx / n * k)), int(round(y + dy / n * k))
            if 5 <= nx < w - 5 and 5 <= ny < h - 5 and land[ny, nx]:
                x, y = nx, ny
                break
        else:
            print(f"  shore gun at ({x}, {y}) is not on land: left out")
            return
    pen.rectangle((x - 4, y - 3, x + 5, y + 4), fill=(96, 92, 88, 255))  # shadow
    pen.rectangle((x - 5, y - 4, x + 4, y + 3), fill=(168, 164, 154, 255))  # stone platform
    pen.rectangle((x - 4, y - 3, x + 3, y + 2), fill=(196, 192, 180, 255))
    dx, dy = toward[0] - x, toward[1] - y
    n = math.hypot(dx, dy) or 1.0
    pen.line((x, y, x + dx / n * 6, y + dy / n * 6), fill=(34, 34, 40, 255), width=2)  # the barrel
    pen.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(92, 62, 40, 255))  # the carriage
    SHORE_GUNS.append({"x": float(min_x + x), "y": float(min_y + y)})


def paint(
    rng, points: np.ndarray, kind: str, theme: str = "", river_from: tuple[float, float] | None = None, harbour: tuple[float, float, float] | None = None
) -> tuple[Image.Image, float, float]:
    """The island's picture and the world position of its top left corner.
    theme: "" (plain), "volcano" (a dark cone with a glowing crater) or "village" (huts, a path and a pier)."""
    min_x = math.floor(points[:, 0].min()) - SHOAL
    min_y = math.floor(points[:, 1].min()) - SHOAL
    w = math.ceil(points[:, 0].max()) + SHOAL - min_x
    h = math.ceil(points[:, 1].max()) + SHOAL - min_y
    mask_image = Image.new("1", (w, h), 0)
    ImageDraw.Draw(mask_image).polygon([(float(x - min_x), float(y - min_y)) for x, y in points], fill=1)
    land = np.asarray(mask_image, dtype=bool)
    dist = distance_inside(land, 400)
    wobble = (soft_noise(rng, (h, w), 18) - 0.5) * 10  # the edges of the colour bands are not ruler-straight

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    # The shoal: paler, half see-through water with a dotted outer edge and small white wave crests.
    yy0, xx0 = np.mgrid[0:h, 0:w]
    near = grow(land, SHOAL - 12)
    edge = grow(near, 10) & ~near & ((yy0 + xx0) % 2 == 0)
    rgba[near] = (*SHOAL_WATER, 120)
    rgba[edge] = (*SHOAL_WATER, 90)
    crests = (near | edge) & ~grow(land, RIM + 2)
    for _ in range(int(crests.sum() / 45)):
        y, x = int(rng.integers(1, h - 1)), int(rng.integers(4, w - 4))
        if crests[y, x]:
            rgba[y, x - 3 : x + 3] = (255, 255, 255, 110)
            rgba[y - 1, x - 1 : x + 1] = (255, 255, 255, 70)
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

    # Rivers: three on a big island (from the foot of the mountain), one on a medium island.
    # Each steps toward the shore and ends in a fan of muddy water.
    cy, cx = np.unravel_index(np.argmax(dist), dist.shape)
    top = float(dist[cy, cx])
    rivers = {"big": 3, "medium": 1}.get(kind, 0) if theme == "" else 0
    first = rng.uniform(0, 2 * math.pi)
    starts = []
    for n in range(rivers):
        angle = first + n * 2 * math.pi / max(1, rivers) + rng.uniform(-0.4, 0.4)
        share = 0.6 if kind == "big" else 0.25
        starts.append((int(cy + math.sin(angle) * top * share), int(cx + math.cos(angle) * top * share)))
    if river_from:  # the river that runs into the inlet: wider, from inland down to the head of the inlet
        starts.insert(0, (int(river_from[1] - min_y), int(river_from[0] - min_x)))
    for n, (y, x) in enumerate(starts):
        wide = river_from is not None and n == 0
        for _ in range(2000):
            if not (1 <= y < h - 1 and 1 <= x < w - 1) or not land[y, x]:
                # The river mouth: a fan of muddy water in the sea.
                fan = (np.hypot(yy0 - y, xx0 - x) < 22 + soft_noise(rng, (h, w), 6) * 12) & ~land
                rgba[fan] = (*RIVER_WATER, 200)
                rgba[fan & ((yy0 + xx0) % 3 == 0)] = (*SHALLOW, 230)
                MOUTHS.append((float(min_x + x), float(min_y + y)))
                break
            rgba[y, x] = rgba[y, x + 1] = rgba[y + 1, x] = (*RIVER, 255)  # 2-3 px wide
            if wide:
                rgba[y - 1 : y + 3, x - 1 : x + 3] = (*RIVER, 255)  # the big river: 4-5 px
            steps = [(dy_, dx_) for dy_ in (-1, 0, 1) for dx_ in (-1, 0, 1) if (dy_, dx_) != (0, 0)]
            lower = [s for s in steps if dist[y + s[0], x + s[1]] < dist[y, x]]
            level_ = [s for s in steps if dist[y + s[0], x + s[1]] == dist[y, x]]
            choice = lower if (lower and rng.uniform() < 0.8) or not level_ else level_
            step = choice[rng.integers(len(choice))]
            y, x = y + step[0], x + step[1]

    blocked = np.zeros((h, w), dtype=bool)  # pixels a mountain picture covers: no trees there
    if theme == "volcano":
        # A mountain over nearly the whole island, drawn as if seen a little from the south
        # ("pseudo-3D"): every point of the ground is lifted up the picture by its height, and
        # we paint from the north to the south, so nearer slopes cover farther ones.
        cy, cx = np.unravel_index(np.argmax(dist), dist.shape)
        top = float(dist[cy, cx])
        yy, xx = np.mgrid[0:h, 0:w]
        away = np.hypot(xx - cx, yy - cy)
        angle = np.arctan2(yy - cy, xx - cx)
        high = np.clip((dist - 12) / (top - 12), 0, 1) ** 0.85
        high = high * (1 + 0.1 * np.sin(angle * 7 + soft_noise(rng, (h, w), 20) * 5))  # gullies down the slopes
        high = np.clip(high + (soft_noise(rng, (h, w), 7) - 0.5) * 0.07, 0, 1.05) * (dist > 12)
        crater = max(5.0, top * 0.16)
        bowl = away < crater
        high[bowl] = high[bowl] * 0.0 + 0.72 + 0.1 * (away[bowl] / crater)  # a hollow in the top
        lift = min(40.0, top * 0.5)  # pixels the summit is lifted
        slope_east = np.zeros_like(high)
        slope_east[:, 2:-2] = high[:, 4:] - high[:, :-4]
        light = 0.5 + np.clip(slope_east * 7, -0.45, 0.4) + (soft_noise(rng, (h, w), 4) - 0.5) * 0.12
        rock = np.array([(60, 50, 48), (84, 70, 62), (108, 92, 78), (134, 116, 96), (160, 142, 116)], dtype=np.uint8)
        wood = np.array([(38, 84, 44), (48, 104, 52), (60, 124, 58), (76, 142, 66), (96, 160, 76)], dtype=np.uint8)
        level = np.clip((light * 5).astype(int), 0, 4)
        colour = np.where((high < 0.3 + (soft_noise(rng, (h, w), 10) - 0.5) * 0.2)[..., None], wood[level], rock[level])
        colour[bowl] = (34, 26, 26)
        colour[away < crater * 0.62] = LAVA
        colour[away < crater * 0.3] = LAVA_HOT
        colour[(away >= crater) & (away < crater + 1.6)] = (176, 158, 130)  # the lit rim of the crater
        for y in range(h):
            rise = (high[y] * lift).astype(int)
            on = high[y] > 0.02
            for k in range(int(rise.max()) + 1 if on.any() else 0):
                cols = on & (rise >= k)
                if y - k < 0 or not cols.any():
                    break
                rgba[y - k, cols, :3] = colour[y, cols]
                rgba[y - k, cols, 3] = 255
                blocked[y - k, cols] = True
        blocked |= high > 0.02
        # Smoke from the crater, drifting down the trade wind (to the west-south-west).
        smoke = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        smoke_pen = ImageDraw.Draw(smoke)
        sy = cy - int(0.75 * lift)
        for i in range(7):
            r = 3 + i * 1.3
            px, py = cx - i * 6 + rng.uniform(-2, 2), sy - 4 - i * 2.5 + rng.uniform(-2, 2)
            smoke_pen.ellipse((px - r, py - r * 0.7, px + r, py + r * 0.7), fill=(214, 208, 200, max(40, 150 - i * 18)))
        rgba = np.asarray(Image.alpha_composite(Image.fromarray(rgba, "RGBA"), smoke)).copy()

    # A village: an open place near the shore that looks south, kept free of trees.
    village: tuple[int, int] | None = None
    if theme == "village":
        ring = np.argwhere((dist > 26) & (dist < 30))
        vy, vx = ring[np.argmax(ring[:, 0] - 0.4 * np.abs(ring[:, 1] - w / 2))]  # far south, near the middle
        village = (int(vy), int(vx))

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
            if blocked[y, x]:
                continue
            if village and abs(x - village[1]) < 58 and -36 < y - village[0] < 40:
                continue
            if theme == "village" and dist[y, x] < 16:
                if dist[y, x] > 5 and rng.uniform() < 0.45:  # palms along the beach
                    pen.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(*PALM, 255))
                    pen.point((x - 1, y - 1), fill=(*TREE_LIGHT, 255))
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

    if harbour:
        # A small river port round the far side of the harbour: a quay on the shore (on land, so
        # ships cannot run onto it), warehouses, houses, and the same invented flag.
        hx, hy, direction = harbour[0] - min_x, harbour[1] - min_y, harbour[2]
        r = HARBOUR_RADIUS
        for k in range(-40, 41):
            a = direction + math.pi + math.radians(k * 2)  # round the inland side
            for d in range(r + 1, r + 7):
                x, y = int(hx + math.cos(a) * d), int(hy + math.sin(a) * d)
                if 0 <= y < h and 0 <= x < w and land[y, x]:
                    rgba[y, x] = (*PLANK, 255) if d < r + 6 else (96, 66, 40, 255)
        for k, (a_deg, d) in enumerate(((-50, 18), (-25, 16), (0, 18), (25, 16), (50, 18), (-38, 32), (-12, 34), (12, 34), (38, 32), (0, 48))):
            a = direction + math.pi + math.radians(a_deg)
            x0, y0 = int(hx + math.cos(a) * (r + d)), int(hy + math.sin(a) * (r + d))
            size = 10 if k < 5 else 6
            pen.rectangle((x0 + 1, y0 + 1, x0 + size + 1, y0 + 6), fill=(150, 130, 92, 255))
            pen.rectangle((x0, y0, x0 + size, y0 + 4), fill=(*ROOF, 255))
            pen.rectangle((x0 + size // 2, y0, x0 + size, y0 + 4), fill=(*ROOF_SHADE, 255))
            pen.line((x0, y0 + 5, x0 + size, y0 + 5), fill=(*WALL, 255))
        a = direction + math.pi
        fx, fy = int(hx + math.cos(a) * (r + 10)), int(hy + math.sin(a) * (r + 10))
        pen.line((fx, fy - 16, fx, fy), fill=(60, 42, 28, 255))
        pen.rectangle((fx + 1, fy - 16, fx + 10, fy - 13), fill=(42, 157, 143, 255))
        pen.rectangle((fx + 1, fy - 12, fx + 10, fy - 10), fill=(233, 196, 106, 255))
        pen.rectangle((fx + 1, fy - 16, fx + 3, fy - 10), fill=(192, 57, 43, 255))
        for py in (fy - 14, fy - 13, fy - 12):
            pen.point((fx + 2, py), fill=(255, 255, 255, 255))
        # Three shore guns round the harbour (port law): one each side of the town, one behind it.
        for a_deg, d in ((-72, 12), (72, 12), (-20, 58)):
            a = direction + math.pi + math.radians(a_deg)
            shore_gun(pen, land, hx + math.cos(a) * (r + d), hy + math.sin(a) * (r + d), (hx, hy), min_x, min_y)

    if village:
        vy, vx = village
        dark_plank = (96, 66, 40, 255)
        post = (60, 42, 28, 255)

        def shore_y(x: int) -> int:
            """The first water pixel below the village in this column (the south shore)."""
            y = vy
            while y < h - 1 and land[y, x]:
                y += 1
            return y

        def solid(name: str, corners: list[tuple[float, float]]) -> None:
            """Something ships cannot sail through: a polygon in picture pixels, kept in world metres."""
            SOLIDS.append({"name": name, "points": [{"x": float(min_x + x), "y": float(min_y + y)} for x, y in corners]})

        def boat(bx: int, by: int, length: int, beam: int, masts: int) -> None:
            """A boat seen from above, bow up (north): shadow, dark hull, planked deck, furled sails."""
            hl, hb = length / 2, beam / 2
            solid("boat", [(bx, by - hl), (bx + hb, by - hl / 2), (bx + hb, by + hl * 0.6), (bx, by + hl), (bx - hb, by + hl * 0.6), (bx - hb, by - hl / 2)])
            pen.ellipse((bx - beam // 2 + 1, by - length // 2 + 1, bx + beam // 2 + 2, by + length // 2 + 2), fill=(30, 52, 74, 255))
            pen.ellipse((bx - beam // 2, by - length // 2, bx + beam // 2, by + length // 2), fill=(58, 38, 24, 255))
            pen.ellipse((bx - beam // 2 + 1, by - length // 2 + 2, bx + beam // 2 - 1, by + length // 2 - 1), fill=(156, 110, 66, 255))
            for k in range(masts):  # a mast with the sail furled on its yard
                my = by - length // 4 + k * (length // 3)
                pen.rectangle((bx - beam // 2 - 1, my, bx + beam // 2 + 1, my + 1), fill=(236, 228, 206, 255))
                pen.point((bx, my), fill=(40, 28, 20, 255))

        pen.ellipse((vx - 46, vy - 30, vx + 46, vy + 16), fill=(*PATH, 255))  # the town square and lanes
        # The quay: a plank wharf along the shore, 100 m long, with posts on the water side.
        for x in range(vx - 50, vx + 51):
            y = shore_y(x)
            pen.rectangle((x, y - 4, x, y + 5), fill=(*PLANK, 255))
            if x % 3 == 0:
                pen.point((x, y - 4), fill=dark_plank)
            if x % 8 == 0:
                pen.point((x, y + 6), fill=post)
        quay_top = min(shore_y(x) for x in range(vx - 50, vx + 51)) - 4
        solid("quay", [(vx - 50, quay_top), (vx + 51, quay_top)] + [(x, shore_y(x) + 6) for x in range(vx + 50, vx - 51, -5)])
        # Three piers out from the quay; the middle one is the long main pier.
        piers = []
        for px_, extra in ((vx - 32, 8), (vx, 20), (vx + 32, 12)):
            y = shore_y(px_) + 5
            end = min(h - 1, y + RIM + extra)
            pen.rectangle((px_ - 2, y, px_ + 2, end), fill=(*PLANK, 255))
            pen.rectangle((px_ + 3, y + 1, px_ + 3, end + 1), fill=(46, 70, 92, 255))  # shadow on the water
            for py in range(y, end, 3):
                pen.line((px_ - 2, py, px_ + 2, py), fill=dark_plank)
            for py in range(y + 4, end + 1, 6):  # posts
                pen.point((px_ - 3, py), fill=post)
                pen.point((px_ + 3, py), fill=post)
            piers.append((px_, end))
            solid("pier", [(px_ - 2.5, y), (px_ + 3, y), (px_ + 3, end + 1), (px_ - 2.5, end + 1)])
        # An invisible wall over the water between the outer piers, so no ship squeezes in
        # between the piers and the moored boats and gets stuck there.
        far_end = max(end for _, end in piers)
        solid("berths", [(vx - 38, quay_top), (vx + 48, quay_top), (vx + 48, far_end + 2), (vx - 38, far_end + 2)])
        main_x, main_end = piers[1]
        LAST_PIER.update(x=float(min_x + main_x), y=float(min_y + main_end))
        # Five boats: two sloops and a ketch along the piers, two rowing boats at the quay.
        boat(piers[0][0] + 9, piers[0][1] - 7, 24, 8, 1)
        boat(piers[1][0] - 9, piers[1][1] - 12, 30, 9, 2)
        boat(piers[2][0] + 9, piers[2][1] - 9, 24, 8, 1)
        boat(vx - 16, shore_y(vx - 16) + 12, 11, 5, 0)
        boat(vx + 17, shore_y(vx + 17) + 11, 10, 5, 0)
        # Warehouses along the quay (long roofs) and a harbour office.
        for wx, length in ((vx - 44, 18), (vx - 20, 14), (vx + 8, 18), (vx + 32, 14)):
            wy = shore_y(wx + length // 2) - 15
            pen.rectangle((wx + 1, wy + 1, wx + length + 1, wy + 10), fill=(150, 130, 92, 255))
            pen.rectangle((wx, wy, wx + length, wy + 7), fill=(*ROOF, 255))
            pen.rectangle((wx, wy + 4, wx + length, wy + 7), fill=(*ROOF_SHADE, 255))
            pen.line((wx, wy + 8, wx + length, wy + 8), fill=(*WALL, 255))
        # A flag of our own invention on a tall pole by the main pier:
        # teal over gold, with a white anchor-cross in the red hoist.
        fx, fy = vx + 5, shore_y(vx + 5) - 3
        pen.line((fx, fy - 16, fx, fy), fill=post)
        pen.rectangle((fx + 1, fy - 16, fx + 10, fy - 13), fill=(42, 157, 143, 255))
        pen.rectangle((fx + 1, fy - 12, fx + 10, fy - 10), fill=(233, 196, 106, 255))
        pen.rectangle((fx + 1, fy - 16, fx + 3, fy - 10), fill=(192, 57, 43, 255))
        pen.point((fx + 2, fy - 14), fill=(255, 255, 255, 255))
        pen.point((fx + 2, fy - 12), fill=(255, 255, 255, 255))
        pen.point((fx + 2, fy - 13), fill=(255, 255, 255, 255))
        # Three shore guns (port law): one at each end of the quay, one on the rise behind the town.
        for gx, gy in ((vx - 60, shore_y(vx - 60) - 8), (vx + 62, shore_y(vx + 62) - 8), (vx, vy - 36)):
            shore_gun(pen, land, gx, gy, (gx if gy != vy - 36 else vx, h), min_x, min_y)
        # Houses of the town behind the warehouses.
        for hx, hy in ((-40, -12), (-30, -22), (-18, -27), (-6, -29), (6, -28), (18, -25), (30, -20), (40, -12),
                       (-34, -8), (-22, -15), (-9, -18), (4, -17), (16, -14), (28, -9), (-14, -6), (10, -5)):
            x0, y0 = vx + hx + int(rng.integers(-1, 2)), vy + hy + int(rng.integers(-1, 2))
            pen.rectangle((x0 + 1, y0 + 1, x0 + 7, y0 + 6), fill=(150, 130, 92, 255))  # shadow
            pen.rectangle((x0, y0, x0 + 6, y0 + 4), fill=(*ROOF, 255))
            pen.rectangle((x0 + 3, y0, x0 + 6, y0 + 4), fill=(*ROOF_SHADE, 255))
            pen.line((x0, y0 + 5, x0 + 6, y0 + 5), fill=(*WALL, 255))
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
        inlet = None
        river_from = None
        if name == INLET_ISLAND:
            # A river mouth a ship can sail into, on the side that faces the middle of the sea.
            direction = math.atan2(-cy, -cx) + INLET_TURN
            inlet_rng = np.random.default_rng([SEED, 7])
            for bend in (-INLET_BEND, INLET_BEND):  # swing to the side where the shore stays whole
                carved, path = carve_inlet(inlet_rng, points, (cx, cy), direction, INLET_WIDTH, INLET_LENGTH, bend)
                if not crosses_itself(carved):
                    break
            else:
                raise SystemExit("the inlet breaks the shore of " + name)
            points = carved
            mouth, tip = path[0], path[-2]  # the last point is the middle of the harbour
            inlet = {
                "x": round(mouth[0]),
                "y": round(mouth[1]),
                "headX": round(tip[0]),
                "headY": round(tip[1]),
                "path": [{"x": round(x), "y": round(y)} for x, y in path],
            }
            harbour = path[-1]
            inlet["harbour"] = {"x": round(harbour[0]), "y": round(harbour[1]), "r": HARBOUR_RADIUS}
            river_from = (harbour[0] - math.cos(direction) * 240, harbour[1] - math.sin(direction) * 240)
        harbour_town = (inlet["harbour"]["x"], inlet["harbour"]["y"], direction) if inlet else None
        picture, px, py = paint(np.random.default_rng([SEED, zlib.crc32(name.encode())]), points, kind, river_from=river_from, harbour=harbour_town)
        file = f"{slug(name)}.png"
        picture.save(PICTURES / file)
        islands.append(
            {
                "name": name,
                "kind": kind,
                "points": [{"x": float(x), "y": float(y)} for x, y in points],
                "picture": {"file": file, "x": px, "y": py},
                **({"inlet": inlet, "port": {"x": inlet["harbour"]["x"], "y": inlet["harbour"]["y"], "guns": list(SHORE_GUNS)}} if inlet else {}),
            }
        )
        SHORE_GUNS.clear()
        if inlet:
            print(f"{name:20} inlet: mouth ({inlet['x']}, {inlet['y']}), head ({inlet['headX']}, {inlet['headY']})")
        mouths = ", ".join(f"({x:.0f}, {y:.0f})" for x, y in MOUTHS)
        MOUTHS.clear()
        print(f"{name:20} {kind:6} centre ({cx:6.0f}, {cy:6.0f})  about {2 * reach:4.0f} m across  {picture.width} x {picture.height} px" + (f"  river mouths {mouths}" if mouths else ""))

    # The islands you drew by hand get a picture too: the first a volcano, the second a village
    # (or what their own "theme" says). Their own random numbers, so the generated islands stay the same.
    for i, island in enumerate(handmade):
        theme = island.get("theme") or (HANDMADE_THEMES[i] if i < len(HANDMADE_THEMES) else "")
        points = np.array([[p["x"], p["y"]] for p in island["points"]], dtype=float)
        picture, px, py = paint(np.random.default_rng(SEED + 1 + i), points, "medium", theme)
        file = f"handmade-{i + 1}-{slug(island['name'])}.png"
        picture.save(PICTURES / file)
        island["picture"] = {"file": file, "x": px, "y": py}
        island.pop("port", None)
        island.pop("solids", None)
        if SOLIDS:
            island["solids"] = list(SOLIDS)
            SOLIDS.clear()
        if theme == "village":
            # The village is the neutral port: its anchorage lies in open water, south of the pier.
            island["port"] = {"x": LAST_PIER["x"], "y": LAST_PIER["y"] + ANCHORAGE, "guns": list(SHORE_GUNS)}
        SHORE_GUNS.clear()
        print(f"{island['name']:20} hand-made, {theme or 'plain'}  {picture.width} x {picture.height} px")
    (DATA / "islands.json").write_text(json.dumps({"islands": handmade}, indent=2) + "\n", encoding="utf-8")
    print("written islands.json (pictures added)")

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
    for island in islands + handmade:
        picture = Image.open(PICTURES / island["picture"]["file"])
        small = picture.resize((max(1, picture.width // k), max(1, picture.height // k)), Image.NEAREST)
        preview.alpha_composite(small, (int((island["picture"]["x"] - world["minX"]) / k), int((island["picture"]["y"] - world["minY"]) / k)))
    sx, sy = (START[0] - world["minX"]) / k, (START[1] - world["minY"]) / k
    pen.ellipse((sx - 4, sy - 4, sx + 4, sy + 4), outline=(255, 224, 102, 255), width=2)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(PREVIEW)
    print("written", PREVIEW.name)


if __name__ == "__main__":
    main()

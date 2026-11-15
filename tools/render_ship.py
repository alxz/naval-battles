"""Draws pseudo-3D ship sprites from a simple 3D model (art test for M2).

How it works, in four steps:
  1. build_sloop() describes the ship as coloured triangles in game metres
     (x forward along the keel, y to starboard, z up from the water).
  2. For every direction the model is turned and "photographed" from above.
     The projection is the same one the game uses for cannonballs:
         screen x = world x,   screen y = world y - HEIGHT_SCALE x height
     so the hull keeps its true top-down size and the masts stand up the screen.
     A smaller HEIGHT_SCALE looks more from above (more deck, shorter masts).
  3. Each triangle gets a brightness from the angle between its surface and the light,
     in a few fixed steps (this gives the flat, pixel-art look).
  4. The picture is drawn 4x too big, shrunk by picking the most common colour in
     each block of 4 x 4, and then gets a dark outline and a soft shadow on the water.

Run from the repository root (needs numpy and Pillow):
    uv run --with numpy --with pillow tools/render_ship.py
or, if both are installed:
    python tools/render_ship.py

Output:
  client/public/assets/ships/<class>_<owner>_<directions>_<detail>x.png   sprite sheets, 8 frames per row
  client/src/data/shipArt.json                                            what the game needs to know about them
  docs/art/ship-art-preview.png                                           a picture to look at (not part of the game)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "client" / "public" / "assets" / "ships"
META_FILE = ROOT / "client" / "src" / "data" / "shipArt.json"
PREVIEW_FILE = ROOT / "docs" / "art" / "ship-art-preview.png"

FRAME = 64  # frame size in pixels at detail 1 (1 pixel per game metre)
ANCHOR = (0.5, 0.6)  # where the middle of the hull at the water sits in the frame (share of the frame)
COLUMNS = 8  # frames per row in a sheet
DIRECTIONS = (16, 32)
DETAILS = (1, 2)  # pixels per game metre: 1 for zoom x1, 2 for zoom x2
HEIGHT_SCALE = 0.65  # screen pixels up per metre of height (x detail). 1 = side-on look, 0 = straight from above
# The painted band on the hull shows whose ship it is.
OWNERS = {"player": (232, 168, 28), "enemy": (190, 52, 44)}

SUPERSAMPLE = 4  # draw this many times too big, then shrink
SHADE_STEPS = 5  # how many brightness steps a colour can have
OUTLINE = (38, 26, 22)
SHADOW = (8, 28, 52)
SHADOW_ALPHA = 80  # 0..255
LIGHT = np.array([-0.6, 0.3, 0.74])  # direction TO the light: from the west, a little south, above
LIGHT = LIGHT / np.linalg.norm(LIGHT)
TO_CAMERA = np.array([0.0, 1.0, 1.0]) / math.sqrt(2)  # the camera is south of the ship and above it

# Colours (red, green, blue).
HULL_DARK = (70, 42, 28)
DECK = (212, 190, 152)
DECK_AFT = (186, 160, 122)
WOOD = (110, 74, 42)
DECK_LINE = (176, 150, 112)
WOOD_DARK = (84, 54, 32)
SAIL = (250, 244, 224)
SAIL_SEAM = (232, 222, 196)
SAIL_JIB = (240, 232, 208)
BRIGHT = {SAIL, SAIL_SEAM, SAIL_JIB}  # cloth stays light even when turned away from the sun
PORT_HOLE = (26, 18, 14)
FLAG = (30, 30, 34)
IRON = (58, 58, 66)
IRON_DARK = (36, 36, 42)
ROPE = (64, 50, 40)
WINDOW = (255, 214, 96)
BARREL = (150, 96, 52)

# Corners a, b, c, the colour, and the smallest detail level that shows this triangle.
Triangle = tuple[np.ndarray, np.ndarray, np.ndarray, tuple[int, int, int], int]


class Model:
    """A list of coloured triangles."""

    def __init__(self) -> None:
        self.triangles: list[Triangle] = []
        # Set to 2 before adding fine parts (ropes, planks): they are left out of the small pictures,
        # where they would only make broken dots.
        self.min_detail = 1

    def tri(self, a, b, c, colour) -> None:
        self.triangles.append((np.array(a, float), np.array(b, float), np.array(c, float), colour, self.min_detail))

    def quad(self, a, b, c, d, colour) -> None:
        """Four corners in order around the edge."""
        self.tri(a, b, c, colour)
        self.tri(a, c, d, colour)

    def box(self, lo, hi, colour) -> None:
        """A box with sides along the axes, from corner lo to corner hi."""
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        self.quad((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), colour)  # top
        self.quad((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), colour)
        self.quad((x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1), colour)
        self.quad((x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1), colour)
        self.quad((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1), colour)

    def spar(self, a, b, thickness, colour) -> None:
        """A thin square beam from point a to point b (mast, boom, bowsprit)."""
        a = np.array(a, float)
        b = np.array(b, float)
        along = (b - a) / np.linalg.norm(b - a)
        side = np.cross(along, [0.0, 0.0, 1.0])
        if np.linalg.norm(side) < 1e-6:  # a vertical beam
            side = np.array([0.0, 1.0, 0.0])
        side = side / np.linalg.norm(side) * thickness / 2
        up = np.cross(side, along)
        up = up / np.linalg.norm(up) * thickness / 2
        corners = [side + up, -side + up, -side - up, side - up]
        for i in range(4):
            c0, c1 = corners[i], corners[(i + 1) % 4]
            self.quad(a + c0, b + c0, b + c1, a + c1, colour)
        self.quad(*(b + c for c in corners), colour)  # the end cap


def build_sloop(band: tuple[int, int, int]) -> Model:
    """A one-masted sloop, 30 m long and 10 m wide, with fore-and-aft sails."""
    m = Model()
    length, half_beam = 30.0, 5.0
    sections = 16
    aft_end = 0.27  # the raised quarterdeck covers this share of the hull from the stern

    def half_width(t: float) -> float:
        """Half the hull width at t = 0 (stern) .. 1 (bow)."""
        if t < 0.35:
            return half_beam * (0.62 + 0.38 * math.sin(math.pi / 2 * t / 0.35))
        if t < 0.55:
            return half_beam
        u = (t - 0.55) / 0.45
        return half_beam * max(0.0, 1 - u**2.2)

    def sheer(t: float) -> float:
        """Height of the deck edge: higher at bow and stern."""
        return 3.2 + 1.2 * (2 * t - 1) ** 2

    def at(x: float) -> float:
        """Position along the hull, 0 (stern) .. 1 (bow), for a model x."""
        return (x + length / 2) / length

    def deck_height(x: float) -> float:
        return sheer(at(x)) - 0.9 + (1.0 if at(x) < aft_end else 0.0)

    ring = []  # for each section: x, half width, deck edge height, t
    for i in range(sections + 1):
        t = i / sections
        ring.append((-length / 2 + length * t, half_width(t), sheer(t), t))

    for (x0, w0, h0, t0), (x1, w1, h1, _t1) in zip(ring, ring[1:]):
        aft = t0 < aft_end
        deck0, deck1 = h0 - 0.9 + (1.0 if aft else 0), h1 - 0.9 + (1.0 if aft else 0)
        for side in (1, -1):
            # The hull side in three strips: dark planks, the painted band, a dark top strake.
            water0, water1 = (x0, side * w0 * 0.8, 0), (x1, side * w1 * 0.8, 0)
            low0, low1 = (x0, side * w0 * 0.9, h0 * 0.5), (x1, side * w1 * 0.9, h1 * 0.5)
            high0, high1 = (x0, side * w0 * 0.97, h0 * 0.84), (x1, side * w1 * 0.97, h1 * 0.84)
            top0, top1 = (x0, side * w0, h0), (x1, side * w1, h1)
            m.quad(water0, water1, low1, low0, HULL_DARK)
            m.quad(low0, low1, high1, high0, band)
            m.quad(high0, high1, top1, top0, WOOD_DARK)
            # The rail on top of the side, then the inside wall down to the deck.
            in0, in1 = (x0, side * max(0, w0 - 0.7), h0), (x1, side * max(0, w1 - 0.7), h1)
            m.quad(top0, top1, in1, in0, band)  # the rail carries the owner's colour: seen from every side
            m.quad(in0, in1, (in1[0], in1[1], deck1), (in0[0], in0[1], deck0), HULL_DARK)
        # The deck between the two inside walls.
        inner0, inner1 = max(0, w0 - 0.7), max(0, w1 - 0.7)
        m.quad((x0, -inner0, deck0), (x1, -inner1, deck1), (x1, inner1, deck1), (x0, inner0, deck0), DECK_AFT if aft else DECK)
        # Fine: plank seams along the deck.
        m.min_detail = 2
        for share in (-0.5, 0.0, 0.5):
            lift = 0.03
            m.quad(
                (x0, share * inner0 - 0.12, deck0 + lift),
                (x1, share * inner1 - 0.12, deck1 + lift),
                (x1, share * inner1 + 0.12, deck1 + lift),
                (x0, share * inner0 + 0.12, deck0 + lift),
                DECK_LINE,
            )
        m.min_detail = 1

    # The flat stern with three lit cabin windows, a lantern, and the step up to the quarterdeck.
    x0, w0, h0, _ = ring[0]
    m.quad((x0, -w0 * 0.8, 0), (x0, w0 * 0.8, 0), (x0, w0, h0), (x0, -w0, h0), HULL_DARK)
    for wy in (-1.7, 0.0, 1.7):
        m.quad((x0 - 0.06, wy - 0.55, 2.0), (x0 - 0.06, wy + 0.55, 2.0), (x0 - 0.06, wy + 0.55, 3.3), (x0 - 0.06, wy - 0.55, 3.3), WINDOW)
    m.box((x0 - 0.5, -0.4, h0), (x0 + 0.3, 0.4, h0 + 1.3), WINDOW)
    step_x = -length / 2 + length * aft_end
    step_w = half_width(aft_end) - 0.7
    step_h = sheer(aft_end) - 0.9
    m.quad((step_x, -step_w, step_h), (step_x, step_w, step_h), (step_x, step_w, step_h + 1), (step_x, -step_w, step_h + 1), WOOD)
    # The helm on the quarterdeck: a small stand with the wheel.
    m.box((-11.4, -0.5, deck_height(-11)), (-10.6, 0.5, deck_height(-11) + 1.4), WOOD_DARK)
    m.box((-10.6, -0.9, deck_height(-11) + 0.5), (-10.4, 0.9, deck_height(-11) + 1.6), WOOD)

    # Guns: four on each side. A dark port in the band, and on deck a carriage with the barrel over the rail.
    for gx in (-9, -3, 3, 9):
        w = half_width(at(gx))
        h = sheer(at(gx))
        d = deck_height(gx)
        for side in (1, -1):
            y_low, y_high = side * (w * 0.92 + 0.1), side * (w * 0.96 + 0.1)
            m.quad((gx - 0.8, y_low, h * 0.56), (gx + 0.8, y_low, h * 0.56), (gx + 0.8, y_high, h * 0.8), (gx - 0.8, y_high, h * 0.8), PORT_HOLE)
            lo_y, hi_y = sorted((side * (w - 2.6), side * (w - 1.1)))
            m.box((gx - 0.7, lo_y, d), (gx + 0.7, hi_y, d + 0.7), IRON_DARK)
            m.min_detail = 2  # the barrels are too thin for the small pictures
            m.spar((gx, side * (w - 2.2), d + 0.95), (gx, side * (w + 0.7), d + 0.95), 0.6, IRON)
            m.min_detail = 1

    # On deck: a hatch with a grating, two barrels, an anchor at the bow.
    hatch = deck_height(7)
    m.box((5.5, -1.3, hatch), (8.5, 1.3, hatch + 0.5), WOOD_DARK)
    m.box((5.9, -0.9, hatch + 0.5), (8.1, 0.9, hatch + 0.56), WOOD)
    for bx, by in ((-3.6, 1.3), (-4.9, 0.4)):
        m.box((bx - 0.5, by - 0.5, deck_height(bx)), (bx + 0.5, by + 0.5, deck_height(bx) + 1.1), BARREL)
    m.box((11.0, -1.6, deck_height(11)), (12.2, -1.2, deck_height(11) + 0.5), IRON)
    m.box((11.0, 1.2, deck_height(11)), (12.2, 1.6, deck_height(11) + 0.5), IRON)

    # The mast with a small platform, and the bowsprit.
    mast_x, mast_top = 2.0, 22.0
    m.spar((mast_x, 0, deck_height(mast_x)), (mast_x, 0, mast_top), 1.3, WOOD)
    m.box((mast_x - 1.0, -1.0, 16.4), (mast_x + 1.0, 1.0, 16.8), WOOD_DARK)
    bowsprit_end = (25.0, 0.0, 8.5)
    m.spar((12.5, 0, 4.4), bowsprit_end, 0.9, WOOD)

    # The mainsail hangs behind the mast, swung out to starboard so the deck shows beside it.
    # It is made of cloth panels: strips in two close colours.
    swing = math.radians(28)
    out = np.array([-math.cos(swing), math.sin(swing), 0.0])
    tack = np.array([mast_x, 0.0, 7.0])
    throat = np.array([mast_x, 0.0, 18.0])
    clew = tack + out * 15.0
    peak = throat + out * 9.5 + np.array([0, 0, 3.5])
    panels = 6
    for i in range(panels):
        a, b = i / panels, (i + 1) / panels
        m.quad(tack + (clew - tack) * a, tack + (clew - tack) * b, throat + (peak - throat) * b, throat + (peak - throat) * a, SAIL if i % 2 == 0 else SAIL_SEAM)
    m.spar(tack - [0, 0, 0.5], clew - [0, 0, 0.5], 0.8, WOOD)  # boom
    m.spar(throat, peak, 0.7, WOOD)  # gaff

    # The jib: a triangle from the bowsprit end up to the mast, in two panels.
    head = np.array([mast_x + 0.6, 0, 20.5])
    jib_tack = np.array(bowsprit_end)
    jib_clew = np.array([6.5, 3.4, 6.0])
    middle = (jib_tack + jib_clew) / 2
    m.tri(jib_tack, head, middle, SAIL_JIB)
    m.tri(middle, head, jib_clew, SAIL_SEAM)

    # Fine: the ropes that hold the mast (shrouds to both sides, a stay to the bowsprit).
    m.min_detail = 2
    for sx in (0.4, -1.6):
        for side in (1, -1):
            m.spar((mast_x, 0, 16.4), (sx, side * half_width(at(sx)), sheer(at(sx))), 0.3, ROPE)
    m.spar((mast_x, 0, mast_top - 0.5), bowsprit_end, 0.25, ROPE)
    m.min_detail = 1

    # A black flag at the mast top.
    m.quad((mast_x, 0, mast_top - 0.2), (mast_x, 0, mast_top + 2.4), (mast_x - 3.6, 1.0, mast_top + 2.0), (mast_x - 3.6, 1.0, mast_top + 0.4), FLAG)
    return m


def shade(colour: tuple[int, int, int], normal: np.ndarray) -> tuple[int, int, int]:
    """Brightness from the angle to the light, in a few steps."""
    if np.dot(normal, TO_CAMERA) < 0:  # we see the back of this triangle
        normal = -normal
    lit = max(0.0, float(np.dot(normal, LIGHT)))
    level = round(lit * (SHADE_STEPS - 1)) / (SHADE_STEPS - 1)
    brightness = (0.8 + 0.2 * level) if colour in BRIGHT else (0.55 + 0.5 * level)
    return tuple(min(255, int(c * brightness)) for c in colour)  # type: ignore[return-value]


def fill_triangle(points: np.ndarray, depth: np.ndarray, colour_index: int, image: np.ndarray, zbuffer: np.ndarray) -> None:
    """Fill one triangle on the big picture; nearer pixels win (z-buffer)."""
    h, w = image.shape
    min_x = max(0, int(math.floor(points[:, 0].min())))
    max_x = min(w - 1, int(math.ceil(points[:, 0].max())))
    min_y = max(0, int(math.floor(points[:, 1].min())))
    max_y = min(h - 1, int(math.ceil(points[:, 1].max())))
    if min_x > max_x or min_y > max_y:
        return
    (x0, y0), (x1, y1), (x2, y2) = points
    area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    if abs(area) < 1e-9:
        return
    ys, xs = np.mgrid[min_y : max_y + 1, min_x : max_x + 1]
    px, py = xs + 0.5, ys + 0.5
    # Barycentric weights: how close the pixel is to each corner.
    w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area
    w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area
    w2 = 1 - w0 - w1
    inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
    z = w0 * depth[0] + w1 * depth[1] + w2 * depth[2]
    region_z = zbuffer[min_y : max_y + 1, min_x : max_x + 1]
    region_c = image[min_y : max_y + 1, min_x : max_x + 1]
    win = inside & (z > region_z)
    region_z[win] = z[win]
    region_c[win] = colour_index


def render_frame(model: Model, heading_rad: float, frame: int, anchor: tuple[float, float], pixels_per_metre: float) -> Image.Image:
    """One picture of the ship pointing at heading_rad (0 = east, clockwise, like the game)."""
    big = frame * SUPERSAMPLE
    scale = pixels_per_metre * SUPERSAMPLE
    cos, sin = math.cos(heading_rad), math.sin(heading_rad)
    turn = np.array([[cos, -sin, 0], [sin, cos, 0], [0, 0, 1]])

    image = np.zeros((big, big), dtype=np.int32)  # 0 = empty, else colour number
    zbuffer = np.full((big, big), -1e9)
    shadow = np.zeros((big, big), dtype=np.int32)
    shadow_z = np.full((big, big), -1e9)
    palette: list[tuple[int, int, int]] = [(0, 0, 0)]

    for a, b, c, colour, min_detail in model.triangles:
        if pixels_per_metre < min_detail:
            continue
        world = np.array([turn @ a, turn @ b, turn @ c])
        normal = np.cross(world[1] - world[0], world[2] - world[0])
        length = np.linalg.norm(normal)
        if length < 1e-9:
            continue
        shaded = shade(colour, normal / length)
        if shaded not in palette:
            palette.append(shaded)
        # The game's projection: screen y = world y - HEIGHT_SCALE x height. Nearer to the camera = bigger y + z.
        screen = np.stack([anchor[0] * SUPERSAMPLE + world[:, 0] * scale, anchor[1] * SUPERSAMPLE + (world[:, 1] - HEIGHT_SCALE * world[:, 2]) * scale], axis=1)
        fill_triangle(screen, world[:, 1] + world[:, 2], palette.index(shaded), image, zbuffer)
        # The shadow: slide every corner along the light down to the water (z = 0).
        ground = world[:, :2] - LIGHT[:2] * (world[:, 2:3] / LIGHT[2])
        flat = np.stack([anchor[0] * SUPERSAMPLE + ground[:, 0] * scale, anchor[1] * SUPERSAMPLE + ground[:, 1] * scale], axis=1)
        fill_triangle(flat, np.zeros(3), 1, shadow, shadow_z)

    # Shrink: each block of SUPERSAMPLE x SUPERSAMPLE becomes one pixel.
    out = np.zeros((frame, frame, 4), dtype=np.uint8)
    solid = np.zeros((frame, frame), dtype=bool)
    need = SUPERSAMPLE * SUPERSAMPLE * 0.35
    for y in range(frame):
        for x in range(frame):
            block = image[y * SUPERSAMPLE : (y + 1) * SUPERSAMPLE, x * SUPERSAMPLE : (x + 1) * SUPERSAMPLE].ravel()
            used = block[block > 0]
            if used.size >= need:
                values, counts = np.unique(used, return_counts=True)
                out[y, x, :3] = palette[int(values[counts.argmax()])]
                out[y, x, 3] = 255
                solid[y, x] = True
            elif shadow[y * SUPERSAMPLE : (y + 1) * SUPERSAMPLE, x * SUPERSAMPLE : (x + 1) * SUPERSAMPLE].mean() >= 0.5:
                out[y, x] = (*SHADOW, SHADOW_ALPHA)

    # A dark outline: every empty pixel that touches the ship.
    padded = np.pad(solid, 1)
    touches = padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    out[touches & ~solid] = (*OUTLINE, 255)
    return Image.fromarray(out, "RGBA")


def render_sheet(model: Model, name: str, directions: int, detail: int) -> Path:
    """All directions of one ship in one picture: COLUMNS frames per row, direction 0 (east) first, clockwise."""
    frame = FRAME * detail
    anchor = (frame * ANCHOR[0], frame * ANCHOR[1])
    sheet = Image.new("RGBA", (frame * COLUMNS, frame * math.ceil(directions / COLUMNS)))
    for i in range(directions):
        picture = render_frame(model, 2 * math.pi * i / directions, frame, anchor, detail)
        sheet.paste(picture, ((i % COLUMNS) * frame, (i // COLUMNS) * frame))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}_{directions}_{detail}x.png"
    sheet.save(path)
    return path


def preview(sheets: list[tuple[Path, int, int]], target: Path) -> None:
    """Sheets on sea blue, enlarged so the pixels are easy to judge. Each entry: (sheet, frame size, enlargement)."""
    rows = []
    for path, _frame, zoom in sheets:
        sheet = Image.open(path)
        sea = Image.new("RGBA", sheet.size, (29, 91, 143, 255))
        sea.alpha_composite(sheet)
        rows.append(sea.resize((sea.width * zoom, sea.height * zoom), Image.NEAREST))
    canvas = Image.new("RGBA", (max(r.width for r in rows), sum(r.height for r in rows) + 8 * (len(rows) - 1)), (12, 40, 70, 255))
    y = 0
    for r in rows:
        canvas.paste(r, (0, y))
        y += r.height + 8
    canvas.convert("RGB").save(target)


def main() -> None:
    models = {"sloop": build_sloop}  # more classes come later: add a build_... function here
    for ship_class, build in models.items():
        for owner, band in OWNERS.items():
            model = build(band)
            for directions in DIRECTIONS:
                for detail in DETAILS:
                    path = render_sheet(model, f"{ship_class}_{owner}", directions, detail)
                    print("written", path.name)

    meta = {
        "frame": FRAME,
        "anchorX": ANCHOR[0],
        "anchorY": ANCHOR[1],
        "heightScale": HEIGHT_SCALE,
        "columns": COLUMNS,
        "classes": list(models),
        "owners": list(OWNERS),
        "directions": list(DIRECTIONS),
        "details": list(DETAILS),
    }
    META_FILE.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print("written", META_FILE.name)

    target = PREVIEW_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    preview([(OUT_DIR / "sloop_player_16_1x.png", FRAME, 4), (OUT_DIR / "sloop_enemy_16_2x.png", FRAME * 2, 2)], target)
    print("written", target.name)


if __name__ == "__main__":
    main()

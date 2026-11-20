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
import sys
from dataclasses import dataclass, field
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "client" / "public" / "assets" / "ships"
META_FILE = ROOT / "client" / "src" / "data" / "shipArt.json"
ART_DIR = ROOT / "docs" / "art"
PREVIEW_FILE = ART_DIR / "ship-art-preview.png"

# D39 (M3 step 1, then 1b): every ship is 1.2 times bigger in the world than the models below were drawn
# (sloop 30 -> 36 m; x1.5 was tried and made the big ships too big on the screen). The models keep their old measurements; the whole model is scaled by SIZE
# when it is drawn, so ships.json (length, beam, heights) must be scaled by the same factor.
SIZE = 1.2
FRAME = 80  # frame size in pixels at detail 1 (1 pixel per game metre) for the sloop
# Bigger ships need bigger frames (bowsprit and booms included; height x HEIGHT_SCALE above the anchor).
FRAMES = {"sloop": 80, "brigantine": 96, "caravel": 96, "fluyt": 120, "frigate": 136}
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


# ---------------------------------------------------------------------------------------------
# The other classes (M2 step 7). They share one hull builder and a few rigging helpers.
# The sloop above keeps its own code: its look was accepted as it is.
# ---------------------------------------------------------------------------------------------

STERN_GOLD = (196, 150, 58)  # carved decoration on a frigate's stern
CARGO = (138, 104, 64)  # crates and bales on a merchant's deck


@dataclass
class HullSpec:
    """The shape of a hull. All lengths in game metres."""

    length: float
    half_beam: float
    sheer_mid: float  # height of the deck edge amidships
    sheer_rise: float  # how much higher the deck edge is at bow and stern
    aft_end: float  # share of the length (from the stern) under the raised quarterdeck
    aft_rise: float  # how much higher the quarterdeck is than the main deck
    fore_end: float  # share of the length (from the bow) under a forecastle, 0 = none
    fore_rise: float
    stern_share: float  # stern width as a share of the beam
    bow_start: float  # where the bow starts to narrow (share from the stern)
    bow_power: float  # bigger = fuller, blunter bow
    guns: list[float] = field(default_factory=list)  # x of each gun (both sides)
    deck_guns: bool = True  # guns on the open deck (small ships) or only behind ports (a gun deck below)
    windows: int = 3
    tumble: float = 1.0  # M3 step 7a: deck width as a share of the widest hull (the fluyt's sides lean in: < 1)


class Hull:
    """Builds a hull into a model and answers questions about it (widths and heights along the length)."""

    def __init__(self, m: Model, spec: HullSpec, band: tuple[int, int, int]) -> None:
        self.m = m
        self.s = spec
        self.band = band
        self.build()

    def at(self, x: float) -> float:
        return (x + self.s.length / 2) / self.s.length

    def half_width(self, t: float) -> float:
        s = self.s
        if t < 0.35:
            return s.half_beam * (s.stern_share + (1 - s.stern_share) * math.sin(math.pi / 2 * t / 0.35))
        if t < s.bow_start:
            return s.half_beam
        u = (t - s.bow_start) / (1 - s.bow_start)
        return s.half_beam * max(0.0, 1 - u**s.bow_power)

    def sheer(self, t: float) -> float:
        return self.s.sheer_mid + self.s.sheer_rise * (2 * t - 1) ** 2

    def raise_at(self, t: float) -> float:
        s = self.s
        if t < s.aft_end:
            return s.aft_rise
        if s.fore_end > 0 and t > 1 - s.fore_end:
            return s.fore_rise
        return 0.0

    def deck(self, x: float) -> float:
        t = self.at(x)
        return self.sheer(t) - 0.9 + self.raise_at(t)

    def width_at(self, x: float) -> float:
        return self.half_width(self.at(x))

    def build(self) -> None:
        m, s, band = self.m, self.s, self.band
        sections = max(16, int(s.length / 2))
        ring = []
        for i in range(sections + 1):
            t = i / sections
            ring.append((-s.length / 2 + s.length * t, self.half_width(t), self.sheer(t) + self.raise_at(t) * 0.8, t))
        for (x0, w0, h0, t0), (x1, w1, h1, _t1) in zip(ring, ring[1:]):
            lift = self.raise_at(t0)
            deck0 = self.sheer(t0) - 0.9 + lift
            deck1 = self.sheer(_t1) - 0.9 + lift
            # Widths at the water, the low and high strakes, and the rail (a "tumblehome" hull is widest low down).
            tb = s.tumble
            k_low, k_high, k_top = (0.9, 0.97, 1.0) if tb >= 1 else (1.0, (1.0 + tb) / 2, tb)
            for side in (1, -1):
                water0, water1 = (x0, side * w0 * 0.8, 0), (x1, side * w1 * 0.8, 0)
                low0, low1 = (x0, side * w0 * k_low, h0 * 0.45), (x1, side * w1 * k_low, h1 * 0.45)
                high0, high1 = (x0, side * w0 * k_high, h0 * 0.8), (x1, side * w1 * k_high, h1 * 0.8)
                top0, top1 = (x0, side * w0 * k_top, h0), (x1, side * w1 * k_top, h1)
                m.quad(water0, water1, low1, low0, HULL_DARK)
                m.quad(low0, low1, high1, high0, band)
                m.quad(high0, high1, top1, top0, WOOD_DARK)
                in0, in1 = (x0, side * max(0, w0 * k_top - 0.8), h0), (x1, side * max(0, w1 * k_top - 0.8), h1)
                m.quad(top0, top1, in1, in0, band)
                m.quad(in0, in1, (in1[0], in1[1], deck1), (in0[0], in0[1], deck0), HULL_DARK)
            inner0, inner1 = max(0, w0 * k_top - 0.8), max(0, w1 * k_top - 0.8)
            colour = DECK_AFT if lift > 0 else DECK
            m.quad((x0, -inner0, deck0), (x1, -inner1, deck1), (x1, inner1, deck1), (x0, inner0, deck0), colour)
            m.min_detail = 2
            for share in (-0.6, -0.2, 0.2, 0.6):
                m.quad(
                    (x0, share * inner0 - 0.12, deck0 + 0.03),
                    (x1, share * inner1 - 0.12, deck1 + 0.03),
                    (x1, share * inner1 + 0.12, deck1 + 0.03),
                    (x0, share * inner0 + 0.12, deck0 + 0.03),
                    DECK_LINE,
                )
            m.min_detail = 1

        # Walls where the quarterdeck and the forecastle step up from the main deck.
        for t, rise in ((s.aft_end, s.aft_rise), (1 - s.fore_end, s.fore_rise)):
            if rise <= 0 or t <= 0 or t >= 1:
                continue
            x = -s.length / 2 + s.length * t
            w = self.half_width(t) - 0.8
            h = self.sheer(t) - 0.9
            m.quad((x, -w, h), (x, w, h), (x, w, h + rise), (x, -w, h + rise), WOOD)

        # The stern: lit windows (and gold carving on a big ship), a lantern.
        x0, w0, h0, _ = ring[0]
        m.quad((x0, -w0 * 0.8, 0), (x0, w0 * 0.8, 0), (x0, w0, h0), (x0, -w0, h0), HULL_DARK)
        n = s.windows
        for i in range(n):
            wy = (i - (n - 1) / 2) * (2 * w0 * 0.8 / max(n, 1))
            m.quad((x0 - 0.06, wy - 0.6, h0 * 0.55), (x0 - 0.06, wy + 0.6, h0 * 0.55), (x0 - 0.06, wy + 0.6, h0 * 0.8), (x0 - 0.06, wy - 0.6, h0 * 0.8), WINDOW)
        if s.length >= 60:
            m.quad((x0 - 0.08, -w0 * 0.85, h0 * 0.84), (x0 - 0.08, w0 * 0.85, h0 * 0.84), (x0 - 0.08, w0 * 0.85, h0 * 0.95), (x0 - 0.08, -w0 * 0.85, h0 * 0.95), STERN_GOLD)
        m.box((x0 - 0.5, -0.45, h0), (x0 + 0.3, 0.45, h0 + 1.4), WINDOW)

        # Guns: a dark port in the band; deck guns on carriages, or barrels through the ports.
        for gx in s.guns:
            t = self.at(gx)
            w = self.half_width(t)
            h = self.sheer(t) + self.raise_at(t) * 0.8
            d = self.deck(gx)
            for side in (1, -1):
                y_low, y_high = side * (w * 0.92 + 0.1), side * (w * 0.96 + 0.1)
                m.quad((gx - 0.8, y_low, h * 0.5), (gx + 0.8, y_low, h * 0.5), (gx + 0.8, y_high, h * 0.74), (gx - 0.8, y_high, h * 0.74), PORT_HOLE)
                if s.deck_guns:
                    lo_y, hi_y = sorted((side * (w - 2.6), side * (w - 1.1)))
                    m.box((gx - 0.7, lo_y, d), (gx + 0.7, hi_y, d + 0.7), IRON_DARK)
                    m.min_detail = 2
                    m.spar((gx, side * (w - 2.2), d + 0.95), (gx, side * (w + 0.7), d + 0.95), 0.6, IRON)
                    m.min_detail = 1
                else:
                    m.min_detail = 2
                    m.spar((gx, side * (w * 0.9), h * 0.62), (gx, side * (w + 1.0), h * 0.62), 0.6, IRON)
                    m.min_detail = 1


def mast(m: Model, x: float, base: float, top: float, thickness: float, tops: list[float]) -> None:
    """A mast with a platform (top) at each given height."""
    m.spar((x, 0, base), (x, 0, top), thickness, WOOD)
    for i, h in enumerate(tops):
        size = 1.6 - 0.4 * i
        m.box((x - size, -size, h), (x + size, size, h + 0.35), WOOD_DARK)


def square_sail(m: Model, x: float, bottom: float, top: float, half_width: float, brace_deg: float, belly: float = 3.5) -> None:
    """
    A square sail hanging from a yard across the ship. The yard is braced (turned) by brace_deg,
    so from above the sail lies at an angle and the deck shows beside it.
    The wind fills the cloth: the foot is pushed forward ("belly"), most in the middle. Seen from
    above, that curved, filled shape is what shows a square sail; a flat sail seen edge-on would be
    only a line. Cloth in vertical panels of two close colours.
    """
    a = math.radians(brace_deg)
    across = np.array([math.sin(a), math.cos(a), 0.0])  # along the yard
    ahead = np.array([math.cos(a), -math.sin(a), 0.0])  # the way the wind pushes the cloth
    centre_top = np.array([x, 0.0, top])
    centre_middle = np.array([x, 0.0, (top + bottom) / 2])
    centre_bottom = np.array([x, 0.0, bottom])
    panels = 6
    foot = 0.92  # the foot is a little narrower than the head

    def fill(share: float, k: float) -> np.ndarray:
        """How far forward the cloth is at this point: k = 0 at the yard, 1 at the foot; most in the middle."""
        return ahead * belly * (0.45 + 0.55 * (1 - share * share)) * (k * (2 - k))

    for i in range(panels):
        a0 = -1 + 2 * i / panels
        a1 = -1 + 2 * (i + 1) / panels
        colour = SAIL if i % 2 == 0 else SAIL_SEAM
        head0, head1 = centre_top + across * half_width * a0, centre_top + across * half_width * a1
        mid0 = centre_middle + across * half_width * (1 + foot) / 2 * a0 + fill(a0, 0.6)
        mid1 = centre_middle + across * half_width * (1 + foot) / 2 * a1 + fill(a1, 0.6)
        foot0 = centre_bottom + across * half_width * foot * a0 + fill(a0, 1.0)
        foot1 = centre_bottom + across * half_width * foot * a1 + fill(a1, 1.0)
        m.quad(head0, head1, mid1, mid0, colour)
        m.quad(mid0, mid1, foot1, foot0, colour)
    m.spar(centre_top - across * (half_width + 0.6), centre_top + across * (half_width + 0.6), 0.6, WOOD)  # the yard


def gaff_sail(m: Model, x: float, foot: float, head: float, boom: float, gaff: float, swing_deg: float) -> None:
    """A fore-and-aft sail behind a mast (like the sloop's mainsail), swung out to starboard."""
    swing = math.radians(swing_deg)
    out = np.array([-math.cos(swing), math.sin(swing), 0.0])
    tack = np.array([x, 0.0, foot])
    throat = np.array([x, 0.0, head])
    clew = tack + out * boom
    peak = throat + out * gaff + np.array([0, 0, 3.0])
    panels = 5
    for i in range(panels):
        a, b = i / panels, (i + 1) / panels
        m.quad(tack + (clew - tack) * a, tack + (clew - tack) * b, throat + (peak - throat) * b, throat + (peak - throat) * a, SAIL if i % 2 == 0 else SAIL_SEAM)
    m.spar(tack - [0, 0, 0.5], clew - [0, 0, 0.5], 0.8, WOOD)
    m.spar(throat, peak, 0.7, WOOD)


def jibs(m: Model, bowsprit_end: np.ndarray, heads: list[np.ndarray], tack_x: float, side_out: float) -> None:
    """Triangular head sails from the bowsprit to the foremast."""
    for i, head in enumerate(heads):
        tack = bowsprit_end + np.array([-3.0 * i, 0, -0.5 * i])
        clew = np.array([tack_x - 2.0 * i, side_out, head[2] * 0.3])
        middle = (tack + clew) / 2
        m.tri(tack, head, middle, SAIL_JIB)
        m.tri(middle, head, clew, SAIL_SEAM)


def shrouds(m: Model, hull: Hull, x: float, top: float) -> None:
    """Fine: the ropes from a mast top to both sides of the hull."""
    m.min_detail = 2
    for dx in (1.0, -1.5):
        for side in (1, -1):
            sx = x + dx
            m.spar((x, 0, top), (sx, side * hull.width_at(sx), hull.sheer(hull.at(sx))), 0.3, ROPE)
    m.min_detail = 1


def flag(m: Model, x: float, top: float, size: float) -> None:
    m.quad((x, 0, top - 0.2), (x, 0, top + size * 0.7), (x - size, size * 0.28, top + size * 0.55), (x - size, size * 0.28, top + size * 0.1), FLAG)


def build_brigantine(band: tuple[int, int, int]) -> Model:
    """Two masts, 40 m: square sails on the foremast, a big fore-and-aft mainsail; 6 guns a side."""
    m = Model()
    hull = Hull(m, HullSpec(40, 6.0, 3.5, 1.3, 0.25, 1.0, 0.0, 0.0, 0.6, 0.55, 2.2, guns=[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]), band)
    bowsprit_end = np.array([31.0, 0.0, 9.0])
    m.spar((17.0, 0, 4.6), bowsprit_end, 1.0, WOOD)
    fore_x, main_x = 9.0, -4.0
    mast(m, fore_x, hull.deck(fore_x), 29.0, 1.3, [15.0, 23.0])
    mast(m, main_x, hull.deck(main_x), 30.0, 1.4, [21.0])
    for bottom, top, hw in ((8.0, 14.5, 7.5), (15.5, 21.5, 6.0), (22.5, 26.5, 4.2)):
        square_sail(m, fore_x, bottom, top, hw, 30)
    gaff_sail(m, main_x, 6.5, 21.5, 15.0, 10.0, 26)
    jibs(m, bowsprit_end, [np.array([fore_x + 0.6, 0, 19.0]), np.array([fore_x + 0.6, 0, 15.0])], 16.0, 3.0)
    for x, top in ((fore_x, 23.0), (main_x, 21.0)):
        shrouds(m, hull, x, top)
    # On deck: a hatch, barrels, the helm.
    m.box((1.0, -1.5, hull.deck(2)), (4.5, 1.5, hull.deck(2) + 0.5), WOOD_DARK)
    for bx, by in ((-9.0, 1.6), (-10.2, 0.6)):
        m.box((bx - 0.5, by - 0.5, hull.deck(bx)), (bx + 0.5, by + 0.5, hull.deck(bx) + 1.1), BARREL)
    m.box((-16.0, -0.5, hull.deck(-16)), (-15.2, 0.5, hull.deck(-16) + 1.4), WOOD_DARK)
    flag(m, main_x, 30.0, 4.5)
    return m


def lateen_sail(m: Model, x: float, deck: float, height: float, yard: float, swing_deg: float) -> None:
    """
    A lateen sail (M3 step 7a, the caravel): a triangle hung from a long slanting yard that crosses
    the mast, its fore end low, its aft end high; the foot is sheeted aft, swung out to starboard.
    """
    a = math.radians(32)
    swing = math.radians(swing_deg)

    def place(dx: float, z: float, out: float = 0.0) -> np.ndarray:
        """dx: along the ship from the mast (+ forward); swung round the mast by the swing angle."""
        return np.array([x + dx * math.cos(swing), -dx * math.sin(swing) + out, z])

    pivot_z = deck + height * 0.6
    fore = place(yard * 0.38 * math.cos(a), pivot_z - yard * 0.38 * math.sin(a))
    aft = place(-yard * 0.62 * math.cos(a), pivot_z + yard * 0.62 * math.sin(a))
    clew = place(-yard * 0.5 * math.cos(a), deck + 2.2, 1.5)
    panels = 5
    for i in range(panels):
        p0 = fore + (aft - fore) * (i / panels)
        p1 = fore + (aft - fore) * ((i + 1) / panels)
        m.tri(p0, p1, clew, SAIL if i % 2 == 0 else SAIL_SEAM)
    m.spar(fore, aft, 0.6, WOOD)  # the yard


def build_caravel(band: tuple[int, int, int]) -> Model:
    """
    M3 step 7a: a caravel, 38 m: an old-fashioned armed trader with high sides and a tall stern
    castle; a square-rigged foremast and two lateen masts; 4 guns a side on deck.
    """
    m = Model()
    hull = Hull(m, HullSpec(38, 5.6, 4.0, 2.0, 0.3, 2.4, 0.12, 1.0, 0.62, 0.55, 1.9, guns=[-9.0, -3.0, 3.0, 9.0], windows=2), band)
    bowsprit_end = np.array([26.0, 0.0, 8.5])
    m.spar((15.5, 0, 5.4), bowsprit_end, 0.9, WOOD)
    fore_x, main_x, mizzen_x = 11.0, 0.5, -10.5
    mast(m, fore_x, hull.deck(fore_x), 24.0, 1.2, [16.5])
    mast(m, main_x, hull.deck(main_x), 26.0, 1.4, [21.0])
    mast(m, mizzen_x, hull.deck(mizzen_x), 21.0, 1.0, [])
    for bottom, top, hw in ((8.5, 15.5, 7.0), (17.0, 22.0, 5.0)):
        square_sail(m, fore_x, bottom, top, hw, 28)
    lateen_sail(m, main_x, hull.deck(main_x), 20.0, 26.0, 24)
    lateen_sail(m, mizzen_x, hull.deck(mizzen_x), 14.0, 17.0, 20)
    jibs(m, bowsprit_end, [np.array([fore_x + 0.6, 0, 15.0])], 15.0, 2.8)
    for x, top in ((fore_x, 16.5), (main_x, 21.0)):
        shrouds(m, hull, x, top)
    # On deck: a hatch, a few bales, the tiller under the stern castle.
    m.box((3.5, -1.4, hull.deck(4)), (6.5, 1.4, hull.deck(4) + 0.5), WOOD_DARK)
    for cx, cy, size in ((-5.0, 2.0, 1.3), (-5.5, -1.8, 1.1)):
        m.box((cx - size / 2, cy - size / 2, hull.deck(cx)), (cx + size / 2, cy + size / 2, hull.deck(cx) + size), CARGO)
    m.box((-15.5, -0.5, hull.deck(-15)), (-14.7, 0.5, hull.deck(-15) + 1.4), WOOD_DARK)
    flag(m, main_x, 26.0, 4.2)
    return m


def build_fluyt(band: tuple[int, int, int]) -> Model:
    """
    M3 step 7a: a Dutch fluyt, 52 m: a big round-bellied hold with sides leaning in (a narrow deck),
    a narrow rounded stern, very tall masts with narrow square sails and a lateen mizzen,
    cargo on deck; only one gun a side.
    """
    m = Model()
    hull = Hull(m, HullSpec(52, 7.6, 3.8, 1.5, 0.2, 2.2, 0.1, 0.8, 0.45, 0.62, 1.5, guns=[2.0], windows=2, tumble=0.78), band)
    bowsprit_end = np.array([35.0, 0.0, 10.0])
    m.spar((22.0, 0, 5.4), bowsprit_end, 1.1, WOOD)
    fore_x, main_x, mizzen_x = 14.0, 0.0, -15.0
    mast(m, fore_x, hull.deck(fore_x), 36.0, 1.4, [18.0, 28.0])
    mast(m, main_x, hull.deck(main_x), 41.0, 1.6, [20.0, 31.0])
    mast(m, mizzen_x, hull.deck(mizzen_x), 25.0, 1.1, [])
    for bottom, top, hw in ((8.5, 17.0, 7.5), (19.0, 27.0, 5.8), (29.0, 34.0, 3.8)):
        square_sail(m, fore_x, bottom, top, hw, 26)
    for bottom, top, hw in ((9.5, 19.0, 8.5), (21.0, 30.0, 6.5), (32.0, 38.5, 4.2)):
        square_sail(m, main_x, bottom, top, hw, 26)
    lateen_sail(m, mizzen_x, hull.deck(mizzen_x), 16.0, 18.0, 20)
    jibs(m, bowsprit_end, [np.array([fore_x + 0.8, 0, 18.0])], 21.0, 3.0)
    for x, top in ((fore_x, 28.0), (main_x, 31.0)):
        shrouds(m, hull, x, top)
    # The hold: two big hatches and cargo stacked on deck.
    for hx in (-6.0, 7.0):
        m.box((hx - 2.4, -2.0, hull.deck(hx)), (hx + 2.4, 2.0, hull.deck(hx) + 0.6), WOOD_DARK)
    for cx, cy, size in ((-9.5, 2.0, 1.5), (-9.0, -2.1, 1.3), (-3.0, 2.1, 1.2), (4.0, -2.1, 1.4), (10.0, 1.8, 1.2), (10.5, -1.6, 1.0)):
        m.box((cx - size / 2, cy - size / 2, hull.deck(cx)), (cx + size / 2, cy + size / 2, hull.deck(cx) + size), CARGO)
    m.box((-20.5, -0.5, hull.deck(-20)), (-19.7, 0.5, hull.deck(-20) + 1.4), WOOD_DARK)  # helm
    flag(m, mizzen_x, 25.0, 4.2)
    return m


def build_frigate(band: tuple[int, int, int]) -> Model:
    """A fast warship, 70 m: three masts with full square rig, a row of 12 gun ports a side."""
    m = Model()
    guns = [-26.0 + i * (52.0 / 11) for i in range(12)]
    hull = Hull(
        m,
        HullSpec(70, 9.0, 4.4, 1.2, 0.28, 1.2, 0.17, 1.0, 0.66, 0.6, 2.4, guns=guns, deck_guns=False, windows=5),
        band,
    )
    bowsprit_end = np.array([51.0, 0.0, 13.0])
    m.spar((30.0, 0, 6.4), bowsprit_end, 1.3, WOOD)
    fore_x, main_x, mizzen_x = 19.0, 2.0, -17.0
    mast(m, fore_x, hull.deck(fore_x), 41.0, 1.6, [19.0, 31.0])
    mast(m, main_x, hull.deck(main_x), 45.0, 1.8, [21.0, 34.0])
    mast(m, mizzen_x, hull.deck(mizzen_x), 35.0, 1.3, [19.0, 28.0])
    for bottom, top, hw in ((10.0, 18.0, 11.5), (19.5, 29.5, 9.0), (31.0, 37.5, 6.0)):
        square_sail(m, fore_x, bottom, top, hw, 30)
    for bottom, top, hw in ((11.0, 20.0, 13.0), (21.5, 32.5, 10.0), (34.0, 41.5, 6.8)):
        square_sail(m, main_x, bottom, top, hw, 30)
    for bottom, top, hw in ((20.0, 27.0, 7.0), (28.5, 33.5, 5.0)):
        square_sail(m, mizzen_x, bottom, top, hw, 30)
    gaff_sail(m, mizzen_x, 9.0, 18.5, 16.0, 10.0, 20)  # the spanker
    jibs(m, bowsprit_end, [np.array([fore_x + 0.8, 0, 24.0]), np.array([fore_x + 0.8, 0, 19.0])], 30.0, 4.0)
    for x, top in ((fore_x, 31.0), (main_x, 34.0), (mizzen_x, 28.0)):
        shrouds(m, hull, x, top)
    # On deck: boats on the waist, the capstan, the big double helm.
    for by in (-2.2, 2.2):
        m.box((-6.0, by - 1.2, hull.deck(-4) + 0.4), (-1.0, by + 1.2, hull.deck(-4) + 1.2), WOOD)
    m.box((-10.0, -0.9, hull.deck(-10)), (-8.2, 0.9, hull.deck(-10) + 1.0), WOOD_DARK)
    m.box((-28.5, -0.6, hull.deck(-28)), (-27.5, 0.6, hull.deck(-28) + 1.6), WOOD_DARK)
    flag(m, main_x, 45.0, 6.0)
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

    # Shrink: each block of SUPERSAMPLE x SUPERSAMPLE becomes one pixel, in the colour most of the
    # block has (a "majority vote"). Done for all blocks at once with numpy (no Python loop per pixel).
    n = SUPERSAMPLE
    blocks = image.reshape(frame, n, frame, n).transpose(0, 2, 1, 3).reshape(frame, frame, n * n)
    shadow_share = shadow.reshape(frame, n, frame, n).mean(axis=(1, 3))
    filled = (blocks > 0).sum(axis=-1)
    votes = np.stack([(blocks == k).sum(axis=-1) for k in range(1, len(palette))]) if len(palette) > 1 else np.zeros((1, frame, frame))
    winner = votes.argmax(axis=0) + 1
    solid = filled >= n * n * 0.35
    colours = np.array(palette, dtype=np.uint8)
    out = np.zeros((frame, frame, 4), dtype=np.uint8)
    out[solid, :3] = colours[winner[solid]]
    out[solid, 3] = 255
    in_shadow = ~solid & (shadow_share >= 0.5)
    out[in_shadow] = (*SHADOW, SHADOW_ALPHA)

    # A dark outline: every empty pixel that touches the ship.
    padded = np.pad(solid, 1)
    touches = padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    out[touches & ~solid] = (*OUTLINE, 255)
    return Image.fromarray(out, "RGBA")


def render_sheet(model: Model, name: str, directions: int, detail: int, frame_size: int = FRAME) -> Path:
    """All directions of one ship in one picture: COLUMNS frames per row, direction 0 (east) first, clockwise."""
    frame = frame_size * detail
    anchor = (frame * ANCHOR[0], frame * ANCHOR[1])
    sheet = Image.new("RGBA", (frame * COLUMNS, frame * math.ceil(directions / COLUMNS)))
    for i in range(directions):
        picture = render_frame(model, 2 * math.pi * i / directions, frame, anchor, detail * SIZE)
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
    models = {"sloop": build_sloop, "brigantine": build_brigantine, "caravel": build_caravel, "fluyt": build_fluyt, "frigate": build_frigate}
    only = sys.argv[1:]  # e.g. "python tools/render_ship.py frigate" renders only the frigate (faster while tuning)
    for ship_class, build in models.items():
        if only and ship_class not in only:
            continue
        for owner, band in OWNERS.items():
            model = build(band)
            for directions in DIRECTIONS:
                for detail in DETAILS:
                    path = render_sheet(model, f"{ship_class}_{owner}", directions, detail, FRAMES[ship_class])
                    print("written", path.name)

    meta = {
        "frame": FRAME,
        "size": SIZE,
        "frames": {name: FRAMES[name] for name in models},
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
    classes = ART_DIR / "ship-classes-preview.png"
    preview([(OUT_DIR / f"{name}_enemy_16_2x.png", FRAMES[name] * 2, 1) for name in models], classes)
    print("written", classes.name)


if __name__ == "__main__":
    main()

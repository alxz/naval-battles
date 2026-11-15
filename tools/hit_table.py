"""Hit table for the ship guns (plan 4.4, decision D28).

A Monte Carlo simulation: it fires thousands of broadsides with random errors at a
target sloop lying still, beam-on, and counts how many balls hit. "Monte Carlo"
means: instead of a clever formula we just try it many times and count.

It uses the same rules as the game:
  - flight: 30 steps per second, first gravity changes the climb speed, then the ball moves;
  - errors: sigma_salvo (one per broadside, elevation) and sigma_gun (each ball,
    elevation and direction), the formulas from plan 4.4 with the numbers in guns.json;
  - hit test: the ball's path in each step against two boxes (hull, rigging).
The aim is perfect: the elevation puts the middle ball exactly on the target's centre,
like a player who has put the cross right on the target.

The game's own Vitest test (accuracy.test.ts) checks the 150 m number with the real
TypeScript code, so this script and the game cannot drift apart unnoticed.

Run from the repository root:
    python tools/hit_table.py
    python tools/hit_table.py --gun 1.2 --salvo 0.5      try other base sigmas
    python tools/hit_table.py --battle 8 --wind 0.3      a better captain, a calmer day
"""

import argparse
import json
import math
import random
from pathlib import Path

STEP_SECONDS = 1 / 30
ROOT = Path(__file__).resolve().parent.parent
GUNS_FILE = ROOT / "client" / "src" / "data" / "guns.json"
SHIPS_FILE = ROOT / "client" / "src" / "data" / "ships.json"

# Targets from plan 4.4 (D28): hull hits per 4-gun salvo.
TARGETS = {50: "2-3", 100: "-", 150: "1-2", 200: "0-1"}


def sigmas(guns: dict, battle: float, wind: float) -> tuple[float, float]:
    """(sigma_gun, sigma_salvo) in degrees, plan 4.4. Crew, gun wear and ammunition are neutral for now."""
    gun = guns["gunSigmaDeg"] * (1.4 - 0.06 * battle)
    salvo = guns["salvoSigmaDeg"] * (1 + wind) * (1.2 - 0.04 * battle)
    return gun, salvo


def segment_box(p0, p1, box) -> float | None:
    """Where the segment p0 -> p1 first enters the box (t from 0 to 1), or None. Same slab method as hits.ts."""
    t_min, t_max = 0.0, 1.0
    for a, b, lo, hi in zip(p0, p1, box[0], box[1]):
        d = b - a
        if abs(d) < 1e-9:
            if a < lo or a > hi:
                return None
            continue
        t1, t2 = (lo - a) / d, (hi - a) / d
        if t1 > t2:
            t1, t2 = t2, t1
        t_min, t_max = max(t_min, t1), min(t_max, t2)
        if t_min > t_max:
            return None
    return t_min


def fly(x, y, elevation_deg, direction_deg, guns, target=None):
    """Fly one ball. Our ship looks east (+x); starboard guns fire south (+y).
    Returns 'hull', 'rigging' or 'miss' if a target is given, else the landing point."""
    elev = math.radians(elevation_deg)
    out = math.pi / 2 + math.radians(direction_deg)
    speed = guns["muzzleSpeed"]
    vx = math.cos(out) * speed * math.cos(elev)
    vy = math.sin(out) * speed * math.cos(elev)
    vz = speed * math.sin(elev)
    z = guns["gunHeight"]
    t = 0.0
    while z > 0 and t < guns["maxBallSeconds"]:
        vz -= guns["gravity"] * STEP_SECONDS
        p0 = (x, y, z)
        x += vx * STEP_SECONDS
        y += vy * STEP_SECONDS
        z += vz * STEP_SECONDS
        t += STEP_SECONDS
        if target:
            hull = segment_box(p0, (x, y, z), target["hull"])
            rig = segment_box(p0, (x, y, z), target["rigging"])
            if hull is not None and (rig is None or hull <= rig):
                return "hull"
            if rig is not None:
                return "rigging"
    return "miss" if target else (x, y)


def aim(distance, ship, guns) -> float:
    """The elevation that puts the middle ball on the target centre (bisection: halve the interval until it fits)."""
    lo, hi = 0.0, float(guns["maxElevationDeg"])
    for _ in range(40):
        mid = (lo + hi) / 2
        _, land_y = fly(0.0, ship["beam"] / 2, mid, 0.0, guns)
        if land_y < distance:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def target_boxes(distance, ship) -> dict:
    """The target sloop lies parallel to us, its centre `distance` metres to starboard."""
    half_l, half_b = ship["length"] / 2, ship["beam"] / 2
    lo = (-half_l, distance - half_b)
    hi = (half_l, distance + half_b)
    return {
        "hull": ((lo[0], lo[1], 0.0), (hi[0], hi[1], ship["hullHeight"])),
        "rigging": ((lo[0], lo[1], ship["hullHeight"]), (hi[0], hi[1], ship["mastHeight"])),
    }


def hits_per_salvo(distance, ship, guns, battle, wind, salvos, rng) -> tuple[float, float, float]:
    """(hull hits, rigging hits, elevation used) per broadside at this distance."""
    sigma_gun, sigma_salvo = sigmas(guns, battle, wind)
    elevation = aim(distance, ship, guns)
    target = target_boxes(distance, ship)
    n = ship["gunsPerSide"]
    hull = rigging = 0
    for _ in range(salvos):
        roll = rng.gauss(0, sigma_salvo)
        for gun in range(n):
            along = (gun / (n - 1) - 0.5) * guns["gunSpreadShare"] * ship["length"] if n > 1 else 0.0
            result = fly(
                along,
                ship["beam"] / 2,
                elevation + roll + rng.gauss(0, sigma_gun),
                rng.gauss(0, sigma_gun),
                guns,
                target,
            )
            hull += result == "hull"
            rigging += result == "rigging"
    return hull / salvos, rigging / salvos, elevation


def main() -> None:
    guns = json.loads(GUNS_FILE.read_text(encoding="utf-8"))
    ships = json.loads(SHIPS_FILE.read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description="Hits per broadside, sloop against a sloop lying still")
    parser.add_argument("--gun", type=float, default=guns["gunSigmaDeg"], help="base gun sigma, degrees")
    parser.add_argument("--salvo", type=float, default=guns["salvoSigmaDeg"], help="base salvo sigma, degrees")
    parser.add_argument("--battle", type=float, default=4, help="Battle skill 0..10")
    parser.add_argument("--wind", type=float, default=0.7, help="wind strength 0..1 (start of the game: 0.7)")
    parser.add_argument("--salvos", type=int, default=2000, help="broadsides per distance")
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()
    guns = {**guns, "gunSigmaDeg": args.gun, "salvoSigmaDeg": args.salvo}
    ship = ships["sloop"]
    rng = random.Random(args.seed)

    sigma_gun, sigma_salvo = sigmas(guns, args.battle, args.wind)
    print(f"base sigma: gun {args.gun} deg, salvo {args.salvo} deg   Battle {args.battle:g}, wind {args.wind:g}")
    print(f"-> sigma_gun {sigma_gun:.2f} deg, sigma_salvo {sigma_salvo:.2f} deg, {args.salvos} salvos per distance\n")
    print(f"{'distance':>8} | {'elev':>5} | {'hull hits':>9} | {'rigging':>7} | {'target':>6} | {'salvos to sink':>14} | {'minutes':>7}")
    print("-" * 75)
    for distance in (50, 100, 150, 200):
        hull, rig, elevation = hits_per_salvo(distance, ship, guns, args.battle, args.wind, args.salvos, rng)
        to_sink = math.ceil(ship["hullPoints"] / guns["damage"]) / hull if hull > 0 else float("inf")
        # Rough duel length: one salvo per reload, plus about as much time again for turning and aiming.
        minutes = to_sink * ship["reloadSeconds"] * 2 / 60
        print(
            f"{distance:>6} m | {elevation:>4.1f}° | {hull:>9.2f} | {rig:>7.2f} | {TARGETS[distance]:>6} | {to_sink:>14.1f} | {minutes:>7.1f}"
        )
    print("\nminutes = salvos to sink x reload x 2 (half the time goes into turning and aiming); a rough guide only.")


if __name__ == "__main__":
    main()

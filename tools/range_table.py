"""Range table for the ship guns (plan 4.4).

Reads the gun numbers from client/src/data/guns.json and flies one ball for every
elevation from 0 to the maximum, with exactly the same steps as the game
(30 steps per second: first gravity changes the climb speed, then the ball moves).

Run from the repository root:
    python tools/range_table.py
"""

import json
import math
from pathlib import Path

STEP_SECONDS = 1 / 30
GUNS_FILE = Path(__file__).resolve().parent.parent / "client" / "src" / "data" / "guns.json"


def fly(elevation_deg: float, guns: dict) -> tuple[float, float, float]:
    """Return (range in metres, flight time in seconds, highest point in metres)."""
    elevation = math.radians(elevation_deg)
    speed = guns["muzzleSpeed"]
    vx = speed * math.cos(elevation)  # sideways, away from the ship
    vz = speed * math.sin(elevation)  # up
    x = 0.0
    z = guns["gunHeight"]
    t = 0.0
    top = z
    while z > 0 and t < guns["maxBallSeconds"]:
        vz -= guns["gravity"] * STEP_SECONDS
        x += vx * STEP_SECONDS
        z += vz * STEP_SECONDS
        t += STEP_SECONDS
        top = max(top, z)
    return x, t, top


def main() -> None:
    guns = json.loads(GUNS_FILE.read_text(encoding="utf-8"))
    print(f"muzzle speed {guns['muzzleSpeed']} m/s, gun height {guns['gunHeight']} m")
    print(f"{'elevation':>9} | {'range':>7} | {'flight':>7} | {'highest':>7}")
    print("-" * 40)
    for elevation in range(0, guns["maxElevationDeg"] + 1):
        distance, seconds, top = fly(elevation, guns)
        print(f"{elevation:>7} ° | {distance:>5.0f} m | {seconds:>5.2f} s | {top:>5.1f} m")


if __name__ == "__main__":
    main()

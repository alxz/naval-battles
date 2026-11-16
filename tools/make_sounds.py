"""Placeholder sound effects, made by code (M2 step 6, "juice").

No recordings and no licences: every sound is built from noise and sine waves.
That is called synthesis. The tools are simple:
  - white noise: random numbers, sounds like "shhh";
  - a filter: keep only some frequencies of the noise (low = rumble, high = hiss);
  - an envelope: how loud the sound is over time (a fast attack, then a decay);
  - a sine wave with a falling pitch: the "thump" of a boom.

Run from the repository root (about 2 seconds):
    uv run --with numpy tools/make_sounds.py
It writes WAV files to client/public/assets/sounds/. WAV plays in every browser,
including Safari on the iPhone. Change a number, run it again, reload the game.
The same seed gives the same files.
"""

import wave
from pathlib import Path

import numpy as np

RATE = 22050  # samples per second (enough for effects, half the size of CD quality)
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "client" / "public" / "assets" / "sounds"
rng = np.random.default_rng(1650)


def seconds(length: float) -> np.ndarray:
    """Time of every sample, in seconds."""
    return np.arange(int(RATE * length)) / RATE


def noise(length: float) -> np.ndarray:
    return rng.uniform(-1.0, 1.0, int(RATE * length))


def band(signal: np.ndarray, low_hz: float, high_hz: float) -> np.ndarray:
    """Keep only the frequencies between low and high (a band-pass filter, done with an FFT)."""
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1 / RATE)
    # A soft edge instead of a hard cut, so the filter does not ring.
    mask = 1 / (1 + (low_hz / np.maximum(freqs, 1)) ** 4) / (1 + (freqs / high_hz) ** 4)
    return np.fft.irfft(spectrum * mask, len(signal))


def envelope(t: np.ndarray, attack: float, decay: float) -> np.ndarray:
    """Rise in `attack` seconds, then fall away exponentially (`decay` = time to about a third)."""
    rise = np.clip(t / max(attack, 1e-4), 0, 1)
    return rise * np.exp(-np.maximum(t - attack, 0) / decay)


def thump(t: np.ndarray, start_hz: float, end_hz: float, drop: float) -> np.ndarray:
    """A sine wave whose pitch falls from start to end (like the body of an explosion)."""
    hz = end_hz + (start_hz - end_hz) * np.exp(-t / drop)
    phase = 2 * np.pi * np.cumsum(hz) / RATE
    return np.sin(phase)


def normalise(signal: np.ndarray, peak: float) -> np.ndarray:
    signal = signal - np.mean(signal)
    return signal / (np.max(np.abs(signal)) + 1e-9) * peak


def fade_out(signal: np.ndarray, length: float = 0.05) -> np.ndarray:
    n = min(len(signal), int(RATE * length))
    signal[-n:] *= np.linspace(1, 0, n)
    return signal


def cannon() -> np.ndarray:
    """A gun: a sharp crack, a deep falling boom and a rolling rumble."""
    length = 1.8
    t = seconds(length)
    crack = band(noise(length), 1500, 7000) * envelope(t, 0.001, 0.015)
    boom = thump(t, 110, 38, 0.08) * envelope(t, 0.004, 0.25)
    body = band(noise(length), 40, 400) * envelope(t, 0.006, 0.35)
    rumble = band(noise(length), 30, 160) * envelope(t, 0.05, 0.7) * 0.6
    return fade_out(normalise(0.3 * crack + 1.0 * boom + 0.9 * body + rumble, 0.9))


def splash() -> np.ndarray:
    """A ball falling into the sea: a hissing burst of water, then droplets."""
    length = 0.9
    t = seconds(length)
    burst = band(noise(length), 500, 5000) * envelope(t, 0.01, 0.12)
    plop = thump(t, 220, 90, 0.05) * envelope(t, 0.002, 0.06) * 0.6
    drops = band(noise(length), 2500, 8000) * envelope(t, 0.08, 0.25) * (rng.uniform(0, 1, len(t)) > 0.995) * 3
    return fade_out(normalise(burst + plop + drops, 0.7))


def hit_wood() -> np.ndarray:
    """A ball smashing into planks: a crack, a hollow knock and splinters."""
    length = 0.7
    t = seconds(length)
    crack = band(noise(length), 800, 6000) * envelope(t, 0.0005, 0.02)
    knock = sum(np.sin(2 * np.pi * hz * t) * envelope(t, 0.001, d) for hz, d in [(160, 0.12), (390, 0.07), (870, 0.04)])
    crackle = band(noise(length), 1500, 6000) * envelope(t, 0.02, 0.15) * (rng.uniform(0, 1, len(t)) > 0.97) * 2
    return fade_out(normalise(crack + 0.8 * knock + crackle, 0.85))


def hit_canvas() -> np.ndarray:
    """A ball through the sails: a dull flap and a short rip."""
    length = 0.5
    t = seconds(length)
    flap = band(noise(length), 80, 600) * envelope(t, 0.005, 0.06)
    rip = band(noise(length), 1200, 4500) * envelope(t, 0.02, 0.09) * (0.6 + 0.4 * np.sin(2 * np.pi * 35 * t))
    return fade_out(normalise(flap + 0.5 * rip, 0.6))


def sink() -> np.ndarray:
    """A ship going down: groaning timber, a deep rush of water and bubbles."""
    length = 3.5
    t = seconds(length)
    rush = band(noise(length), 60, 900) * envelope(t, 0.3, 1.4)
    pitch = 70 + 25 * np.sin(2 * np.pi * 0.6 * t) + 10 * np.sin(2 * np.pi * 1.7 * t)
    creak = np.sign(np.sin(2 * np.pi * np.cumsum(pitch) / RATE)) * envelope(t, 0.4, 1.0) * 0.25
    creak = band(creak, 80, 1200)
    bubbles = np.zeros_like(t)
    for start in rng.uniform(0.3, 3.0, 40):
        n = int(RATE * 0.06)
        i = int(RATE * start)
        if i + n >= len(t):
            continue
        local = np.arange(n) / RATE
        hz = rng.uniform(250, 700) * (1 + 3 * local)  # a bubble rises in pitch
        bubbles[i : i + n] += np.sin(2 * np.pi * np.cumsum(hz) / RATE) * np.exp(-local / 0.02) * 0.5
    return fade_out(normalise(rush + creak + bubbles, 0.8), 0.4)


def write(name: str, signal: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = (np.clip(signal, -1, 1) * 32767).astype("<i2")
    with wave.open(str(OUT / f"{name}.wav"), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(data.tobytes())
    print(f"{name + '.wav':16} {len(signal) / RATE:4.1f} s  {len(data) * 2 // 1024:4d} KB")


def main() -> None:
    for name, make in [("cannon", cannon), ("splash", splash), ("hit_wood", hit_wood), ("hit_canvas", hit_canvas), ("sink", sink)]:
        write(name, make())


if __name__ == "__main__":
    main()

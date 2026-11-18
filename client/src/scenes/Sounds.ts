import Phaser from 'phaser';

/** The placeholder sounds made by tools/make_sounds.py (client/public/assets/sounds/). */
/** The same sound is not started again within this many milliseconds. */
const SAME_SOUND_GAP_MS = 30;

export const SOUND_KEYS = ['cannon', 'splash', 'hit_wood', 'hit_canvas', 'sink'] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

/** Half the loudness at this distance from the listener (metres). */
const HALF_VOLUME_DISTANCE = 220;

export function loadSounds(scene: Phaser.Scene): void {
  for (const key of SOUND_KEYS) scene.load.audio(key, `assets/sounds/${key}.wav`);
}

/**
 * Plays a sound at a place in the sea, heard from the listener (the middle of the view):
 *   - farther away = quieter, and a little lower (distant guns sound duller);
 *   - left or right on the screen = more in the left or right speaker (pan);
 *   - every shot slightly different (random detune), so a broadside does not sound like a machine.
 * Random numbers here only change the sound, never the game, so Math.random is fine (not in sim/).
 * Browsers start sound only after the first tap or click; Phaser waits for it by itself.
 */
export class Sounds {
  enabled = true;
  volume = 0.7;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * @param x, y          where the sound happens, metres
   * @param listener      where we hear from, metres
   * @param halfWidthM    half the view width in metres (for the left/right pan)
   * @param loudness      0..1 for this kind of sound
   * @param detuneCents   random pitch spread, +- cents (100 cents = one semitone)
   */
  private readonly lastPlayed = new Map<SoundKey, number>();

  play(key: SoundKey, x: number, y: number, listener: { x: number; y: number }, halfWidthM: number, loudness: number, detuneCents = 100): void {
    if (!this.enabled || !this.scene.cache.audio.exists(key)) return;
    // Grape shot (8 balls a gun) would start dozens of the same sound at once: one per key every 30 ms.
    const now = this.scene.time.now;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < SAME_SOUND_GAP_MS) return;
    this.lastPlayed.set(key, now);
    const d = Math.hypot(x - listener.x, y - listener.y);
    const volume = (this.volume * loudness) / (1 + d / HALF_VOLUME_DISTANCE);
    if (volume < 0.02) return;
    this.scene.sound.play(key, {
      volume,
      pan: Math.max(-0.8, Math.min(0.8, (x - listener.x) / Math.max(1, halfWidthM * 1.2))),
      rate: 1 - Math.min(0.15, d / 3000),
      detune: (Math.random() * 2 - 1) * detuneCents,
    });
  }
}

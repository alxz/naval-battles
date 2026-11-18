import { describe, expect, it } from 'vitest';
import { ballSpinTurnsPerSecond, ballTexture } from './ballLook';

describe('ballLook (M3 step 4b)', () => {
  it('each kind of shot has its own picture; absent = round shot', () => {
    expect(ballTexture(undefined)).toBe('ball');
    expect(ballTexture('round')).toBe('ball');
    expect(ballTexture('chain')).toBe('ball-chain');
    expect(ballTexture('grape')).toBe('ball-grape');
    expect(new Set([ballTexture('round'), ballTexture('chain'), ballTexture('grape')]).size).toBe(3);
  });

  it('only chain shot tumbles', () => {
    expect(ballSpinTurnsPerSecond('chain')).toBeGreaterThan(0);
    expect(ballSpinTurnsPerSecond('round')).toBe(0);
    expect(ballSpinTurnsPerSecond('grape')).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { createWorld } from '../sim/world';
import { ammoLabel, nextAmmo } from './ammoLabel';

describe('ammoLabel', () => {
  it('names the loaded kind; chain and grape with the broadsides left; an empty choice says so', () => {
    const s = createWorld(1).ships[0]!;
    expect(ammoLabel(s, false)).toBe('ROUND');
    expect(ammoLabel(s, true)).toBe('RND');
    s.ammo = 'chain';
    expect(ammoLabel(s, false)).toBe('CHAIN 6');
    expect(ammoLabel(s, true)).toBe('CHN 6');
    s.ammoLeft = { chain: 0, grape: 2 };
    expect(ammoLabel(s, false)).toBe('ROUND (no chain)');
    expect(ammoLabel(s, true)).toBe('RND!');
  });

  it('the touch button cycles round, chain, grape', () => {
    expect(nextAmmo('round')).toBe('chain');
    expect(nextAmmo('chain')).toBe('grape');
    expect(nextAmmo('grape')).toBe('round');
  });
});

// TEST switch "bots hunt me" (M4b step 5b-2).
import { describe, expect, it } from 'vitest';
import { contactOf, rumourOfPlayer } from './perception';
import { createWorld } from './world';

function world() {
  const w = createWorld(3, 4);
  w.sight = w.ships.map((s) => ({ shipId: s.id, contacts: [] }));
  return w;
}

describe('rumourOfPlayer', () => {
  it('tells warships and pirates where the player is, not traders, and only every 20 s', () => {
    const w = world();
    const player = w.ships[0]!;
    player.x = 123;
    player.y = -45;
    w.tick = 1;
    expect(rumourOfPlayer(w, player.id)).toBe(0);
    w.tick = 600;
    const told = rumourOfPlayer(w, player.id);
    expect(told).toBeGreaterThan(0);
    for (const s of w.ships.slice(1)) {
      const c = contactOf(w, s.id, player.id);
      if (c) {
        expect(c.visible).toBe(false);
        expect(c.x).toBe(123);
        expect(c.y).toBe(-45);
      }
    }
  });

  it('a bot that sees the player itself is left alone; a sunk player tells nothing', () => {
    const w = world();
    const player = w.ships[0]!;
    const other = w.ships[1]!;
    w.sight!.find((s) => s.shipId === other.id)!.contacts.push({ id: player.id, level: 3, levelNow: 3, visible: true, x: 5, y: 5, seenTick: 0, firstTick: 0 });
    w.tick = 600;
    rumourOfPlayer(w, player.id);
    expect(contactOf(w, other.id, player.id)!.x).toBe(5);
    player.sunk = true;
    expect(rumourOfPlayer(w, player.id)).toBe(0);
  });
});

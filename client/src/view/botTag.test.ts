import { describe, expect, it } from 'vitest';
import { botTag } from './botTag';
import { newBot } from './../sim/bot';
import type { Pilot } from '../sim/types';

const pilot = (shipId: number, number: number): Pilot => ({ shipId, number, name: 'x', wins: 0, losses: 0, balls: 0, hullHits: 0, sinceSeconds: 0 });

describe('botTag', () => {
  const pilots = [pilot(5, 3), pilot(9, 7)];
  it('a fighting mode names the enemy by its arena number', () => {
    const bot = newBot(5, 9, { rngState: 1 });
    bot.mode = 'chase';
    expect(botTag(bot, pilots)).toBe('chase #7');
    bot.mode = 'flee';
    expect(botTag(bot, pilots)).toBe('flee #7');
  });
  it('a mode without an enemy is just the mode; no bot, nothing', () => {
    const bot = newBot(5, 9, { rngState: 1 });
    bot.mode = 'port';
    expect(botTag(bot, pilots)).toBe('port');
    expect(botTag(undefined, pilots)).toBe('');
  });
  it('an enemy that is not a pilot: the mode only', () => {
    const bot = newBot(5, 99, { rngState: 1 });
    bot.mode = 'engage';
    expect(botTag(bot, pilots)).toBe('engage');
  });
});

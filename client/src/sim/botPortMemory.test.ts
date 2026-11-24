// M4b step 5d (D74): a bot remembers a port it cannot get into and tries another.
import { describe, expect, it } from 'vitest';
import { newBot, notePortTrouble, portsForBot } from './bot';
import { BOTS, SHIP_CLASSES } from './data';
import { portsOf } from './port';
import type { Island, ShipState } from './types';

const params = SHIP_CLASSES['sloop']!;
const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
const islands: Island[] = [
  { name: 'Near', points: square, port: { x: 1000, y: 0 } },
  { name: 'Far', points: square, port: { x: 5000, y: 0 } },
];

function ship(x: number, y: number): ShipState {
  return { id: 1, shipClass: 'sloop', x, y, headingRad: 0, speed: 0, rudder: 0, sailLevel: 0, aground: true, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: 10, sunk: false, battleSkill: 4, team: 1, repairing: false };
}

function portBot() {
  const bot = newBot(1, 2, { rngState: 5 });
  bot.mode = 'port';
  return bot;
}

describe('notePortTrouble', () => {
  it('portFailCount failures near one port close it for the bot; the other port stays open', () => {
    const bot = portBot();
    const s = ship(1000 - 300, 0);
    for (let i = 0; i < BOTS.portFailCount - 1; i++) notePortTrouble(bot, s, params, islands);
    expect(bot.blockedPorts).toBeUndefined();
    notePortTrouble(bot, s, params, islands);
    expect(bot.blockedPorts).toEqual([{ port: 'Near', seconds: BOTS.portBlockSeconds }]);
    expect(portsForBot(bot, portsOf(islands), params).map((p) => p.name)).toEqual(['Far']);
  });

  it('failures far from the port (beyond portFailRadiusM) or outside port mode do not count', () => {
    const bot = portBot();
    for (let i = 0; i < 10; i++) notePortTrouble(bot, ship(1000 - BOTS.portFailRadiusM - 100, 0), params, islands);
    expect(bot.blockedPorts).toBeUndefined();
    const fighter = newBot(1, 2, { rngState: 5 }); // mode 'chase'
    for (let i = 0; i < 10; i++) notePortTrouble(fighter, ship(900, 0), params, islands);
    expect(fighter.blockedPorts).toBeUndefined();
  });

  it('without the block the bot sees both ports', () => {
    expect(portsForBot(portBot(), portsOf(islands), params).map((p) => p.name)).toEqual(['Near', 'Far']);
  });
});

// M4b step 5d: what a bot is doing, as a short tag over its name in the arena: "chase #7", "flee #2", "port".
// Only for the observer who sees everything (SEE ALL): a bot's mode is nothing the watched bot knows. Pure.
import type { BotState, Pilot } from '../sim/types';

/** Modes that have an enemy to name. */
const WITH_TARGET: ReadonlySet<string> = new Set(['chase', 'engage', 'flee', 'breakOff', 'finish', 'ram']);

export function botTag(bot: BotState | undefined, pilots: readonly Pilot[]): string {
  if (!bot) return '';
  if (!WITH_TARGET.has(bot.mode)) return bot.mode;
  const target = pilots.find((p) => p.shipId === bot.enemyId);
  return target ? `${bot.mode} #${target.number}` : bot.mode;
}

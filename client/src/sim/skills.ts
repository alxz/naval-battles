// M3 step 7c: bot skills, drawn once when a bot is born (a new life in the arena, a new battle).
//   seamanship  0.85 .. 1.2: top speed x seamanship, turning x (1 + turnPerSeamanship x (seamanship - 1))
//   gunnery     1 .. 8: the ship's battleSkill (the accuracy formula, plan 4.4) and the reload time
//   courage     0 .. 1: drawn as in step 7b (morale.ts), now at birth so the log can show it
//   loner/pack  a loner avoids enemies other bots already hunt; a pack bot likes to join them
// Seamanship and gunnery are drawn as the mean of two random numbers: most bots are average,
// a few are very good or very poor. The numbers live in data/skills.json.
// The skills belong to the ship's crew (like the player's captain skills in M6), not to the bot's
// knowledge: a bot still knows only what it sees.

import { BOTS, SHIP_CLASSES, SKILLS } from './data';
import { courageOf } from './morale';
import { nextRandom } from './random';
import type { BotState, ShipState, SkillParams } from './types';

/** A number between lo and hi, most often near the middle (the mean of two random numbers). */
function middling(rng: { rngState: number }, lo: number, hi: number): number {
  return lo + ((hi - lo) * (nextRandom(rng) + nextRandom(rng))) / 2;
}

/** Draw the skills of a new bot and its ship. */
export function rollSkills(ship: ShipState, bot: BotState, rng: { rngState: number }, s: SkillParams = SKILLS): void {
  ship.seamanship = Math.round(middling(rng, s.seamanshipMin, s.seamanshipMax) * 100) / 100;
  ship.battleSkill = Math.round(middling(rng, s.gunneryMin, s.gunneryMax));
  bot.personality.loner = nextRandom(rng) < s.lonerShare;
  bot.personality.courage = undefined;
  courageOf(bot, SHIP_CLASSES[ship.shipClass], rng, BOTS);
}

/** The speed factor of the ship's seamanship (1 without skills). */
export function seamanshipSpeed(ship: ShipState): number {
  return ship.seamanship ?? 1;
}

/** The turning factor of the ship's seamanship: a good crew handles the sails and the helm faster. */
export function seamanshipTurn(ship: ShipState, s: SkillParams = SKILLS): number {
  return 1 + s.turnPerSeamanship * ((ship.seamanship ?? 1) - 1);
}

/** The reload factor of the gunners' skill: skill 4 (everybody until step 7c) = 1; 8 = 0.9; 1 = 1.075. */
export function gunneryReload(ship: ShipState, s: SkillParams = SKILLS): number {
  return 1 - s.reloadPerGunnery * (ship.battleSkill - s.neutralGunnery);
}

/** How much other hunters count against an enemy when this bot picks a target (arena targetScore). */
export function crowdWeight(bot: BotState, s: SkillParams = SKILLS): number {
  if (bot.personality.loner === undefined) return 1;
  return bot.personality.loner ? s.lonerCrowd : s.packCrowd;
}

/** A short text of the skills for the log and the debug text: "sea 1.08 gun 6 heart 0.62 pack". */
export function skillsText(ship: ShipState | undefined, bot: BotState | undefined): string {
  if (!ship || ship.seamanship === undefined) return '';
  const courage = bot?.personality.courage;
  const kind = bot?.personality.loner === undefined ? '' : bot.personality.loner ? ' loner' : ' pack';
  return `sea ${ship.seamanship.toFixed(2)} gun ${ship.battleSkill}${courage === undefined ? '' : ` heart ${courage.toFixed(2)}`}${kind}`;
}

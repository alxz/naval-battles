import botsJson from '../data/bots.json';
import damageJson from '../data/damage.json';
import gunsJson from '../data/guns.json';
import islandsJson from '../data/islands.json';
import generatedJson from '../data/islandsGenerated.json';
import polarsJson from '../data/polars.json';
import shipsJson from '../data/ships.json';
import windJson from '../data/wind.json';
import worldJson from '../data/world.json';
import type { BotParams, DamageParams, GunParams, Island, Polar, ShipParams, WorldBounds } from './types';

/** All ship classes, by id. Balance numbers live in JSON, not in code. */
export const SHIP_CLASSES: Record<string, ShipParams> = shipsJson;

/** The three polar tables, by rig name. */
export const POLARS: Record<string, Polar> = polarsJson;

/** The wind at the start of a new game, and how it drifts. */
export const WIND = windJson;

/** The edges of the sea. */
export const WORLD: WorldBounds = worldJson;

/**
 * The reef that closes the sea: four long strips of "land" along the edges.
 * Because a reef is just land, ships ground on it, bots steer clear of it and the chart
 * shows it, all with the rules that already exist for islands.
 */
export function reefs(w: WorldBounds): Island[] {
  const strip = (name: string, x0: number, y0: number, x1: number, y1: number): Island => ({
    name,
    kind: 'reef',
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  });
  const r = w.reefWidth;
  return [
    strip('North reef', w.minX, w.minY, w.maxX, w.minY + r),
    strip('South reef', w.minX, w.maxY - r, w.maxX, w.maxY),
    strip('West reef', w.minX, w.minY + r, w.minX + r, w.maxY - r),
    strip('East reef', w.maxX - r, w.minY + r, w.maxX, w.maxY - r),
  ];
}

/** All land: your hand-made islands, the generated ones, and the reef round the sea. */
export const ISLANDS: Island[] = [...islandsJson.islands, ...generatedJson.islands, ...reefs(WORLD)];

/** Guns and balls (plan 4.4). */
export const GUNS: GunParams = gunsJson;

/** How bots behave (plan 4.9). */
export const BOTS: BotParams = botsJson;

/** Collisions between ships and repair at sea. */
export const DAMAGE: DamageParams = damageJson;

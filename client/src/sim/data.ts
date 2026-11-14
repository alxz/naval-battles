import gunsJson from '../data/guns.json';
import islandsJson from '../data/islands.json';
import polarsJson from '../data/polars.json';
import shipsJson from '../data/ships.json';
import windJson from '../data/wind.json';
import type { GunParams, Island, Polar, ShipParams } from './types';

/** All ship classes, by id. Balance numbers live in JSON, not in code. */
export const SHIP_CLASSES: Record<string, ShipParams> = shipsJson;

/** The three polar tables, by rig name. */
export const POLARS: Record<string, Polar> = polarsJson;

/** The wind at the start of a new game, and how it drifts. */
export const WIND = windJson;

/** The islands of the test sea. Later the map comes from Tiled (M5). */
export const ISLANDS: Island[] = islandsJson.islands;

/** Guns and balls (plan 4.4). */
export const GUNS: GunParams = gunsJson;

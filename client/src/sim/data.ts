import polarsJson from '../data/polars.json';
import shipsJson from '../data/ships.json';
import windJson from '../data/wind.json';
import type { Polar, ShipParams } from './types';

/** All ship classes, by id. Balance numbers live in JSON, not in code. */
export const SHIP_CLASSES: Record<string, ShipParams> = shipsJson;

/** The three polar tables, by rig name. */
export const POLARS: Record<string, Polar> = polarsJson;

/** The wind at the start of a new game. */
export const WIND_START = windJson;

import shipsJson from '../data/ships.json';
import type { ShipParams } from './types';

/** All ship classes, by id. Balance numbers live in JSON, not in code. */
export const SHIP_CLASSES: Record<string, ShipParams> = shipsJson;

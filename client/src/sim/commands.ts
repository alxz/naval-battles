import { onBroadsideFired } from './law';
import { normalizeAngle } from './angles';
import { refitShip, rollCargo } from './condition';
import { nextRandom } from './random';
import { AMMO, AUTOPILOT, GUNS, ISLANDS, SHIP_CLASSES, WORLD } from './data';
import { newBot } from './bot';
import { rollSkills } from './skills';
import { orderBroadside } from './guns';
import { clamp } from './math';
import { nearestOpenWater } from './spawn';
import { STEP_SECONDS } from './step';
import type { Command, World } from './types';

/** Change the world according to one command. Unknown ships are ignored. */
export function applyCommand(world: World, command: Command): void {
  // The wind belongs to the whole sea, not to one ship.
  if (command.type === 'setWind') {
    world.wind.fromRad = normalizeAngle(command.fromRad);
    world.wind.baseFromRad = world.wind.fromRad; // the drift now wanders around the new direction
    world.wind.strength = clamp(command.strength, 0, 1);
    return;
  }

  // Test setup: hand a ship to the computer (a new bot with fresh memory), or take it back.
  if (command.type === 'setBot') {
    world.bots = world.bots.filter((b) => b.shipId !== command.shipId);
    if (command.enemyId !== null) {
      const bot = newBot(command.shipId, command.enemyId, world);
      const ship = world.ships.find((s) => s.id === command.shipId);
      if (command.skilled && ship) {
        rollSkills(ship, bot, world); // M3 step 7c: a battle's bots get their skills
        world.events.push({ type: 'skills', shipId: ship.id });
      }
      world.bots.push(bot);
    }
    return;
  }

  const ship = world.ships.find((s) => s.id === command.shipId);
  if (!ship) return;
  // A sunk ship takes no orders (M3 step 4b): no rudder, sails, guns or ammunition until it is placed again.
  if (ship.sunk && command.type !== 'placeShip') return;

  switch (command.type) {
    case 'setRudder':
      ship.rudder = clamp(command.value, -1, 1);
      if (!command.auto && world.routes) world.routes = world.routes.filter((r) => r.shipId !== ship.id); // D73: your hand on the helm ends the autopilot
      break;
    case 'setRoute': {
      const points = command.points.slice(-AUTOPILOT.maxPoints).map((pt) => ({ x: pt.x, y: pt.y }));
      world.routes = (world.routes ?? []).filter((r) => r.shipId !== ship.id);
      if (points.length > 0) world.routes.push({ shipId: ship.id, points, tack: 0, tackSeconds: 0 });
      break;
    }
    case 'clearRoute':
      if (world.routes) world.routes = world.routes.filter((r) => r.shipId !== ship.id);
      break;
    case 'setSails':
      ship.sailLevel = clamp(command.value, 0, 1);
      if (!command.auto) for (const r of world.routes ?? []) if (r.shipId === ship.id) r.handSails = true;
      break;
    case 'placeShip': {
      // Never on land: if the asked place is land (or the reef), the nearest open water is used;
      // if there is none within 800 m the command is ignored and the ship stays where it is.
      const kind = command.shipClass !== undefined && SHIP_CLASSES[command.shipClass] ? command.shipClass : ship.shipClass;
      const params = SHIP_CLASSES[kind];
      const spot = params ? nearestOpenWater(command.x, command.y, params, ISLANDS, WORLD) : { x: command.x, y: command.y };
      if (!spot) return;
      ship.x = spot.x;
      ship.y = spot.y;
      ship.headingRad = command.headingRad;
      ship.speed = 0;
      ship.aground = false;
      if (command.shipClass !== undefined && SHIP_CLASSES[command.shipClass]) {
        ship.shipClass = command.shipClass;
      }
      // A placed ship starts fresh: full hull, afloat (the test target comes back this way).
      ship.hull = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? ship.hull;
      ship.sunk = false;
      ship.offender = undefined;
      refitShip(ship);
      // A trader (M3 step 7b) comes with a load in its hold.
      const load = SHIP_CLASSES[ship.shipClass]?.cargoMax !== undefined ? rollCargo(SHIP_CLASSES[ship.shipClass]!, nextRandom(world)) : undefined;
      if (load !== undefined) ship.cargo = load;
      break;
    }
    case 'setElevation':
      ship.elevationDeg = clamp(command.valueDeg, 0, GUNS.maxElevationDeg);
      break;
    case 'setAmmo':
      if (AMMO.types[command.ammo]) ship.ammo = command.ammo;
      break;
    case 'fire':
      // Port law (D40): firing in a port's safe water is allowed, but it has its price (sim/law.ts).
      if (orderBroadside(world, ship, command.side, STEP_SECONDS, undefined, command.trainDeg ?? 0)) onBroadsideFired(world, ship);
      break;
    case 'jettison':
      // M3 step 7b: a trader throws its cargo over the side to run faster (the hold is empty afterwards).
      if ((ship.cargo ?? 0) > 0) {
        world.events.push({ type: 'jettison', shipId: ship.id, cargo: ship.cargo ?? 0 });
        ship.cargo = 0;
      }
      break;
  }
}

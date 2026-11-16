import { normalizeAngle } from './angles';
import { GUNS, SHIP_CLASSES } from './data';
import { newBot } from './bot';
import { orderBroadside } from './guns';
import { clamp } from './math';
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
    if (command.enemyId !== null) world.bots.push(newBot(command.shipId, command.enemyId, world));
    return;
  }

  const ship = world.ships.find((s) => s.id === command.shipId);
  if (!ship) return;

  switch (command.type) {
    case 'setRudder':
      ship.rudder = clamp(command.value, -1, 1);
      break;
    case 'setSails':
      ship.sailLevel = clamp(command.value, 0, 1);
      break;
    case 'placeShip':
      ship.x = command.x;
      ship.y = command.y;
      ship.headingRad = command.headingRad;
      ship.speed = 0;
      ship.aground = false;
      if (command.shipClass !== undefined && SHIP_CLASSES[command.shipClass]) {
        ship.shipClass = command.shipClass;
      }
      // A placed ship starts fresh: full hull, afloat (the test target comes back this way).
      ship.hull = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? ship.hull;
      ship.sunk = false;
      break;
    case 'setElevation':
      ship.elevationDeg = clamp(command.valueDeg, 0, GUNS.maxElevationDeg);
      break;
    case 'fire':
      orderBroadside(world, ship, command.side, STEP_SECONDS);
      break;
  }
}

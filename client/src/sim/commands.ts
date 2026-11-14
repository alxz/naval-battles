import { normalizeAngle } from './angles';
import { GUNS, SHIP_CLASSES } from './data';
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
      break;
    case 'setElevation':
      ship.elevationDeg = clamp(command.valueDeg, 0, GUNS.maxElevationDeg);
      break;
    case 'fire':
      orderBroadside(world, ship, command.side, STEP_SECONDS);
      break;
  }
}

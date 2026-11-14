import { normalizeAngle } from './angles';
import { SHIP_CLASSES } from './data';
import { clamp } from './math';
import type { Command, World } from './types';

/** Change the world according to one command. Unknown ships are ignored. */
export function applyCommand(world: World, command: Command): void {
  // The wind belongs to the whole sea, not to one ship.
  if (command.type === 'setWind') {
    world.wind.fromRad = normalizeAngle(command.fromRad);
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
      if (command.shipClass !== undefined && SHIP_CLASSES[command.shipClass]) {
        ship.shipClass = command.shipClass;
      }
      break;
  }
}

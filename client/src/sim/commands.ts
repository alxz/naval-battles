import { SHIP_CLASSES } from './data';
import { clamp } from './math';
import type { Command, World } from './types';

/** Change the world according to one command. Unknown ships are ignored. */
export function applyCommand(world: World, command: Command): void {
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
      ship.heading = command.heading;
      ship.speed = 0;
      if (command.shipClass !== undefined && SHIP_CLASSES[command.shipClass]) {
        ship.shipClass = command.shipClass;
      }
      break;
  }
}

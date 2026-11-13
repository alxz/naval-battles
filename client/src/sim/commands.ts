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
  }
}

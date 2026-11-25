// D73: the player's route and the autopilot. The helmsman steers the ship through the route's points, one after
// another, with the rudder; the sails he sets once (full), and leaves them to you as soon as you touch them. When a leg lies in the no-go zone, at any moment
// (the wind shifts), it beats toward the point in tacks like a bot (steerWithTacks). No land avoidance: the ship
// runs aground or into an island by the usual rules. It acts through commands (setRudder with auto: true), like a bot.
import { BOTS, AUTOPILOT, SHIP_CLASSES } from './data';
import { rudderFor, steerWithTacks } from './bot';
import { STEP_SECONDS } from './step';
import type { AutopilotParams, AutoRoute, BotParams, Command, World } from './types';

/** The route of this ship, if it has one. */
export function routeOf(world: World, shipId: number): AutoRoute | undefined {
  return world.routes?.find((r) => r.shipId === shipId);
}

/** Beating against the wind toward the next point right now (the HUD shows HEADWIND - TACKING). */
export function routeTacking(route: AutoRoute | undefined): boolean {
  return !!route && route.tack !== 0;
}

/** A route with one more point at the end: a fifth point wipes the oldest (D73). Pure, for the screen. */
export function withPoint(points: readonly { x: number; y: number }[], pt: { x: number; y: number }, p: AutopilotParams = AUTOPILOT): { x: number; y: number }[] {
  return [...points, { x: pt.x, y: pt.y }].slice(-p.maxPoints);
}

/** The helmsman's rudder commands for every ship with a route, every thinkEveryTicks steps. */
export function thinkAutopilot(world: World, p: AutopilotParams = AUTOPILOT, bp: BotParams = BOTS): Command[] {
  if (!world.routes || world.routes.length === 0) return [];
  if (world.tick % p.thinkEveryTicks !== 0) return [];
  const thinkSeconds = p.thinkEveryTicks * STEP_SECONDS;
  const commands: Command[] = [];
  const keep: AutoRoute[] = [];
  for (const route of world.routes) {
    const ship = world.ships.find((s) => s.id === route.shipId);
    const params = ship ? SHIP_CLASSES[ship.shipClass] : undefined;
    if (!ship || !params || ship.sunk) continue; // a sunk ship loses its route
    // Points reached are crossed off (a point within arriveM).
    while (route.points.length > 0 && Math.hypot(route.points[0]!.x - ship.x, route.points[0]!.y - ship.y) <= p.arriveM) {
      route.points.shift();
      route.tack = 0;
      route.tackSeconds = 0;
      world.events.push({ type: 'routePoint', shipId: ship.id, left: route.points.length });
    }
    const next = route.points[0];
    if (!next) {
      commands.push({ type: 'setRudder', shipId: ship.id, value: 0, auto: true }); // the last point: it holds its course
      continue;
    }
    if (!route.handSails && Math.abs(ship.sailLevel - p.sails) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: p.sails, auto: true }); // M4b 5b-2: the helmsman sets sail too, until you do
    route.tackSeconds += thinkSeconds;
    const goal = Math.atan2(next.y - ship.y, next.x - ship.x);
    const heading = steerWithTacks(goal, params, world.wind, route, bp);
    commands.push({ type: 'setRudder', shipId: ship.id, value: rudderFor(ship, params, heading, world.wind, bp), auto: true });
    keep.push(route);
  }
  world.routes = keep;
  return commands;
}

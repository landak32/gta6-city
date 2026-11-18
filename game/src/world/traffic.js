// Traffic: cars that belong to the road network. Each one is given a route of intersections, a
// lane to hold, a cruising speed and the law. It stops at a red light, queues behind whatever is
// in front of it, honks when it has waited too long, and swerves for a while after gunfire.

import { clamp, TAU, wrapAngle } from '../core/math2d.js';
import { createVehicle, stepVehicle, VEHICLE_TYPES } from './vehicles.js';

const LANE_PULL = 22;
const WAYPOINT_REACH = 46;

/** Right-hand side of a heading, in direction-index terms. */
function rightOf(direction) {
  return (direction + 1) % 4;
}

function nodeColumn(roads, index) {
  return index % roads.cols;
}

function nodeRow(roads, index) {
  return Math.floor(index / roads.cols);
}

function directionBetween(roads, from, to) {
  if (to === from + 1) return 0;
  if (to === from - 1) return 2;
  if (to === from + roads.cols) return 1;
  return 3;
}

/** The world point a car should hold on a leg, at the start or the end of it. */
function lanePoint(roads, nodeIndex, direction, atStart) {
  const node = roads.nodes[nodeIndex];
  const vector = [[1, 0], [0, 1], [-1, 0], [0, -1]][direction];
  const right = [[1, 0], [0, 1], [-1, 0], [0, -1]][rightOf(direction)];
  const push = atStart ? roads.half + 8 : -(roads.half + 8);
  return {
    x: node.x + vector[0] * push + right[0] * LANE_PULL,
    y: node.y + vector[1] * push + right[1] * LANE_PULL,
  };
}

/**
 * Build a route of `legs` intersections from a start node and heading. Directions prefer to go
 * straight, then turn, and never double back, so traffic looks like it is going somewhere.
 */
export function buildRoute(game, startNode, startDirection, legs, random) {
  const roads = game.city.roads;
  const route = [];
  let node = startNode;
  let direction = startDirection;
  for (let leg = 0; leg < legs; leg += 1) {
    const column = nodeColumn(roads, node);
    const row = nodeRow(roads, node);
    const options = [];
    const straight = direction;
    const left = (direction + 3) % 4;
    const right = (direction + 1) % 4;
    const allowed = (dir) => {
      if (dir === 0) return column < roads.cols - 1;
      if (dir === 2) return column > 0;
      if (dir === 1) return row < roads.rows - 1;
      return row > 0;
    };
    if (allowed(straight)) options.push(straight, straight, straight);
    if (allowed(right)) options.push(right);
    if (allowed(left)) options.push(left);
    if (options.length === 0) break;
    direction = random ? random.pick(options) : options[0];
    const next = node + [1, roads.cols, -1, -roads.cols][direction];
    const axis = direction === 0 || direction === 2 ? 'ew' : 'ns';
    route.push({
      from: node,
      to: next,
      direction,
      axis,
      entry: lanePoint(roads, node, direction, true),
      exit: lanePoint(roads, next, direction, false),
    });
    node = next;
  }
  return route;
}

export function makeWaypoints(route) {
  const points = [];
  for (let index = 0; index < route.length; index += 1) {
    const leg = route[index];
    points.push({ x: leg.entry.x, y: leg.entry.y, leg: index, atEnd: false });
    points.push({ x: leg.exit.x, y: leg.exit.y, leg: index, atEnd: true });
  }
  return points;
}

/** A car dropped on the network, already holding a lane and a route. */
export function spawnTrafficCar(game, options = {}) {
  const random = game.random;
  const roads = game.city.roads;
  const node = options.node ?? random.int(0, roads.nodes.length - 1);
  const direction = options.direction ?? random.int(0, 3);
  const typeId = options.typeId ?? pickTrafficType(random);
  const start = lanePoint(roads, node, direction, true);
  const vehicle = createVehicle(typeId, start.x, start.y, headingFor(direction), random, {});
  vehicle.ai = 'traffic';
  vehicle.route = buildRoute(game, node, direction, options.legs ?? random.int(3, 6), random);
  vehicle.waypoints = makeWaypoints(vehicle.route);
  vehicle.waypointIndex = 0;
  vehicle.cruise = vehicle.type.maxSpeed * (options.speedScale ?? 0.46);
  vehicle.waitTimer = 0;
  vehicle.honkCooldown = 0;
  vehicle.blockedTimer = 0;
  if (vehicle.route.length === 0) return null;
  game.vehicles.push(vehicle);
  return vehicle;
}

export function headingFor(direction) {
  return direction === 0 ? 0 : direction === 1 ? Math.PI / 2 : direction === 2 ? Math.PI : -Math.PI / 2;
}

function pickTrafficType(random) {
  const entries = Object.values(VEHICLE_TYPES).filter((type) => type.id !== 'police');
  const total = entries.reduce((sum, type) => sum + (type.weight ?? 0.1), 0);
  let roll = random.next() * total;
  for (const type of entries) {
    roll -= type.weight ?? 0.1;
    if (roll <= 0) return type.id;
  }
  return 'sedan';
}

/** Is anything solid directly in the car's path, within `reach` pixels? */
function obstacleAhead(game, vehicle, reach) {
  const cosine = Math.cos(vehicle.angle);
  const sine = Math.sin(vehicle.angle);
  for (let distance = 34; distance <= reach; distance += 22) {
    const x = vehicle.x + cosine * distance;
    const y = vehicle.y + sine * distance;
    for (const other of game.vehicles) {
      if (other === vehicle) continue;
      if (Math.hypot(other.x - x, other.y - y) < other.type.width * 0.9 + 10) return other;
    }
    const player = game.player;
    if (!player.inVehicle && Math.hypot(player.x - x, player.y - y) < 26) return { player: true };
    for (const ped of game.peds) {
      if (ped.state === 'down' || ped.state === 'gone') continue;
      if (Math.hypot(ped.x - x, ped.y - y) < 20) return { ped: true };
    }
  }
  return null;
}

/** One traffic car: hold the lane, obey the lights, queue, and occasionally lose its temper. */
export function driveTraffic(game, vehicle, dt) {
  if (vehicle.wrecked) {
    stepVehicle(vehicle, { throttle: 0, steer: 0, brake: 0.6, handbrake: 0 }, dt, game.city, game.trails);
    return;
  }
  const waypoints = vehicle.waypoints;
  if (!waypoints || vehicle.waypointIndex >= waypoints.length) {
    recycleTraffic(game, vehicle);
    return;
  }
  let target = waypoints[vehicle.waypointIndex];
  let gap = Math.hypot(target.x - vehicle.x, target.y - vehicle.y);
  while (gap < WAYPOINT_REACH && vehicle.waypointIndex < waypoints.length - 1) {
    vehicle.waypointIndex += 1;
    target = waypoints[vehicle.waypointIndex];
    gap = Math.hypot(target.x - vehicle.x, target.y - vehicle.y);
  }

  const bearing = Math.atan2(target.y - vehicle.y, target.x - vehicle.x);
  const error = wrapAngle(bearing - vehicle.angle);
  const steer = clamp(error * 2.4, -1, 1);

  // A red light at the end of this leg holds the car at the stop line.
  let targetSpeed = vehicle.cruise;
  const leg = vehicle.route[target.leg];
  let stopping = false;
  if (leg && target.atEnd) {
    const node = game.city.roads.nodes[leg.to];
    const light = game.city.roads.lightState(node, leg.axis, game.clock.time);
    const distanceToNode = Math.hypot(node.x - vehicle.x, node.y - vehicle.y);
    if ((light === 'red' || light === 'amber') && distanceToNode < 170) {
      stopping = true;
    }
  }
  if (Math.abs(error) > 0.55) targetSpeed *= 0.45;

  const blocked = obstacleAhead(game, vehicle, 96);
  if (blocked) {
    targetSpeed = Math.min(targetSpeed, 30);
    vehicle.blockedTimer += dt;
  } else {
    vehicle.blockedTimer = Math.max(0, vehicle.blockedTimer - dt * 2);
  }
  if (stopping) targetSpeed = 0;

  const speed = vehicle.speed;
  let throttle = 0;
  let brake = 0;
  if (targetSpeed > speed + 12) throttle = 1;
  else if (targetSpeed < speed - 14) brake = clamp((speed - targetSpeed) / 160, 0.25, 1);

  if (vehicle.blockedTimer > 2.4 && vehicle.honkCooldown <= 0) {
    vehicle.honkCooldown = 4.5;
    if (game.audio && Math.random() < 0.5) game.audio.honk();
  }
  vehicle.honkCooldown = Math.max(0, vehicle.honkCooldown - dt);

  if (vehicle.panicTimer > 0) {
    vehicle.panicTimer -= dt;
    vehicle.angle += Math.sin(game.clock.time * 3.1 + vehicle.id) * dt * 0.5;
    throttle = 1;
    brake = 0;
  }

  stepVehicle(vehicle, { throttle, steer, brake, handbrake: 0 }, dt, game.city, game.trails);

  // Nudge a stuck car free so the avenue never locks up.
  if (Math.abs(vehicle.speed) < 6 && vehicle.blockedTimer > 7) {
    vehicle.blockedTimer = 0;
    vehicle.waypointIndex = Math.min(vehicle.waypoints.length - 1, vehicle.waypointIndex + 1);
    vehicle.x += Math.cos(vehicle.angle) * 2;
    vehicle.y += Math.sin(vehicle.angle) * 2;
  }
}

/** Move a car that has finished its route, or wandered too far, back near the player. */
export function recycleTraffic(game, vehicle) {
  const random = game.random;
  const roads = game.city.roads;
  const player = game.player;
  let best = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const node = random.int(0, roads.nodes.length - 1);
    const point = roads.nodes[node];
    const gap = Math.hypot(point.x - player.x, point.y - player.y);
    if (gap < 420 || gap > 1250) continue;
    best = { node, direction: random.int(0, 3) };
    break;
  }
  if (!best) return;
  const start = lanePoint(roads, best.node, best.direction, true);
  vehicle.x = start.x;
  vehicle.y = start.y;
  vehicle.angle = headingFor(best.direction);
  vehicle.vx = 0;
  vehicle.vy = 0;
  vehicle.speed = 0;
  vehicle.route = buildRoute(game, best.node, best.direction, random.int(3, 6), random);
  vehicle.waypoints = makeWaypoints(vehicle.route);
  vehicle.waypointIndex = 0;
  vehicle.blockedTimer = 0;
}

export function stepTraffic(game, dt) {
  for (const vehicle of game.vehicles) {
    if (vehicle.ai !== 'traffic') continue;
    driveTraffic(game, vehicle, dt);
  }
}

/** Top traffic up to its target, always spawning off the edge of the screen. */
export function maintainTraffic(game) {
  const alive = game.vehicles.filter((vehicle) => vehicle.ai === 'traffic').length;
  const wanted = game.trafficTarget ?? 18;
  if (alive >= wanted) return;
  for (let index = alive; index < wanted; index += 1) {
    spawnTrafficCar(game, {});
  }
}

export { LANE_PULL, TAU };

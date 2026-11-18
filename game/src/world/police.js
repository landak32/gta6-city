// The police: cruisers that route through the grid toward the player and foot officers who get
// out and shoot. They arrive from off the screen, they know roughly where the player is while the
// stars are up, and they give up if the player stays out of sight long enough for the level to drop.

import { clamp, TAU, wrapAngle } from '../core/math2d.js';
import { createVehicle, stepVehicle } from './vehicles.js';
import { hasLineOfSight, fireWeapon } from './combat.js';
import { buildRoute, headingFor, makeWaypoints } from './traffic.js';

let nextOfficerId = 1;

export function createOfficer(game, x, y) {
  return {
    id: nextOfficerId++,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: game.random.range(0, TAU),
    health: 65,
    maxHealth: 65,
    fireCooldown: game.random.range(0.3, 1.1),
    phase: game.random.range(0, TAU),
    state: 'chase',
    sightTimer: 0,
  };
}

/** A point on the road network at a comfortable distance from the player, out of the frame. */
function offscreenRoadPoint(game, minGap = 620, maxGap = 1150) {
  const roads = game.city.roads;
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  let best = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const node = roads.nodes[game.random.int(0, roads.nodes.length - 1)];
    const gap = Math.hypot(node.x - px, node.y - py);
    if (gap < minGap || gap > maxGap) continue;
    const onScreen = Math.abs(node.x - px) < 760 && Math.abs(node.y - py) < 470;
    if (onScreen) continue;
    best = node;
    break;
  }
  if (!best) best = roads.nodes[game.random.int(0, roads.nodes.length - 1)];
  return best;
}

export function spawnFootOfficer(game, near) {
  const anchor = near ?? offscreenRoadPoint(game, 300, 900);
  const officer = createOfficer(game, anchor.x + game.random.range(-60, 60), anchor.y + game.random.range(-60, 60));
  game.cops.push(officer);
  return officer;
}

export function spawnCruiser(game) {
  const node = offscreenRoadPoint(game);
  const direction = game.random.int(0, 3);
  const cruiser = createVehicle('police', node.x, node.y, headingFor(direction), game.random, {});
  cruiser.ai = 'police';
  cruiser.siren = true;
  cruiser.waypoints = [];
  cruiser.routeTimer = 0;
  cruiser.targetSpeed = 320;
  cruiser.speed = 0;
  cruiser.cruise = cruiser.type.maxSpeed * 0.78;
  game.vehicles.push(cruiser);
  return cruiser;
}

function retargetCruiser(game, cruiser) {
  const roads = game.city.roads;
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  const from = roads.nearestNode(cruiser.x, cruiser.y).node.index;
  const to = roads.nearestNode(px, py).node.index;
  const path = roads.route(from, to);
  const route = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index];
    const b = path[index + 1];
    const direction = b === a + 1 ? 0 : b === a - 1 ? 2 : b === a + roads.cols ? 1 : 3;
    const nodeA = roads.nodes[a];
    const nodeB = roads.nodes[b];
    route.push({
      from: a,
      to: b,
      direction,
      axis: direction === 0 || direction === 2 ? 'ew' : 'ns',
      entry: { x: nodeA.x, y: nodeA.y },
      exit: { x: nodeB.x, y: nodeB.y },
    });
  }
  cruiser.route = route;
  cruiser.waypoints = makeWaypoints(route);
  cruiser.waypointIndex = 0;
}

function driveCruiser(game, cruiser, dt) {
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  cruiser.routeTimer -= dt;
  if (cruiser.routeTimer <= 0 || !cruiser.waypoints || cruiser.waypointIndex >= cruiser.waypoints.length) {
    cruiser.routeTimer = 1.4;
    retargetCruiser(game, cruiser);
  }
  const waypoints = cruiser.waypoints ?? [];
  const gapToPlayer = Math.hypot(px - cruiser.x, py - cruiser.y);
  let target;
  if (waypoints.length && cruiser.waypointIndex < waypoints.length) {
    target = waypoints[cruiser.waypointIndex];
    while (Math.hypot(target.x - cruiser.x, target.y - cruiser.y) < 60 && cruiser.waypointIndex < waypoints.length - 1) {
      cruiser.waypointIndex += 1;
      target = waypoints[cruiser.waypointIndex];
    }
  } else {
    target = { x: px, y: py };
  }

  const bearing = Math.atan2(target.y - cruiser.y, target.x - cruiser.x);
  const error = wrapAngle(bearing - cruiser.angle);
  const steer = clamp(error * 2.6, -1, 1);
  let throttle = 1;
  let brake = 0;
  if (Math.abs(error) > 0.6) throttle = 0.35;
  if (gapToPlayer < 120 && player.inVehicle) {
    throttle = 1;
  } else if (gapToPlayer < 90) {
    throttle = 0;
    brake = 0.8;
  }

  // At three stars and up, the passenger leans out and shoots.
  cruiser.fireCooldown = Math.max(0, (cruiser.fireCooldown ?? 1) - dt);
  if (game.wanted.level >= 3 && gapToPlayer < 430 && cruiser.fireCooldown <= 0) {
    if (hasLineOfSight(game.city, cruiser.x, cruiser.y, px, py)) {
      cruiser.fireCooldown = 1.25;
      fireWeapon(game, {
        x: cruiser.x,
        y: cruiser.y,
        angle: Math.atan2(py - cruiser.y, px - cruiser.x),
        weaponId: 'pistol',
        owner: 'cop',
      });
    }
  }

  stepVehicle(cruiser, { throttle, steer, brake, handbrake: 0 }, dt, game.city, game.trails);
  cruiser.siren = true;
}

function stepOfficer(game, officer, dt) {
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  const gap = Math.hypot(px - officer.x, py - officer.y);
  officer.phase += dt * 6;
  officer.fireCooldown = Math.max(0, officer.fireCooldown - dt);

  const sight = hasLineOfSight(game.city, officer.x, officer.y, px, py);
  if (sight && gap < 900) {
    game.wanted.seen = true;
    officer.sightTimer = 1.2;
  } else {
    officer.sightTimer = Math.max(0, officer.sightTimer - dt);
  }

  const wantsToShoot = game.wanted.level >= 2 && sight && gap < 330;
  officer.state = wantsToShoot ? 'shoot' : 'chase';
  officer.angle = Math.atan2(py - officer.y, px - officer.x);

  if (wantsToShoot) {
    if (officer.fireCooldown <= 0) {
      officer.fireCooldown = game.wanted.level >= 4 ? 0.55 : 0.95;
      fireWeapon(game, { x: officer.x, y: officer.y, angle: officer.angle, weaponId: 'pistol', owner: 'cop' });
    }
    officer.vx *= 0.82;
    officer.vy *= 0.82;
  } else if (gap > 34) {
    const speed = gap > 260 ? 165 : 120;
    officer.vx = Math.cos(officer.angle) * speed;
    officer.vy = Math.sin(officer.angle) * speed;
  } else {
    officer.vx *= 0.7;
    officer.vy *= 0.7;
    // Close enough to make an arrest at one star.
    if (game.wanted.level <= 1 && !player.inVehicle && !player.dead) {
      officer.arrestTimer = (officer.arrestTimer ?? 0) + dt;
      if (officer.arrestTimer > 1.6) game.bustPlayer();
    }
  }
  if (!wantsToShoot) officer.arrestTimer = 0;

  officer.x += officer.vx * dt;
  officer.y += officer.vy * dt;
  for (const rect of game.city.solidsNear(officer.x, officer.y, 12)) {
    if (rect.kind === 'awning') continue;
    if (officer.x > rect.x - 9 && officer.x < rect.x + rect.w + 9 && officer.y > rect.y - 9 && officer.y < rect.y + rect.h + 9) {
      officer.x -= officer.vx * dt * 1.5;
      officer.y -= officer.vy * dt * 1.5;
      break;
    }
  }
}

export function stepPolice(game, dt) {
  for (const cruiser of game.vehicles) {
    if (cruiser.ai !== 'police') continue;
    driveCruiser(game, cruiser, dt);
  }
  for (const officer of game.cops) {
    if (officer.health <= 0) continue;
    stepOfficer(game, officer, dt);
  }
  // Clear the bodies and the abandoned cars once they are far away.
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  game.cops = game.cops.filter((officer) => officer.health > 0 || Math.hypot(officer.x - px, officer.y - py) < 700);
}

/** Keep as many officers on the street as the stars call for. */
export function maintainPolice(game) {
  const level = game.wanted.level;
  const desiredCruisers = level === 0 ? 0 : Math.min(4, level);
  const desiredFoot = level === 0 ? 0 : Math.min(4, Math.max(0, level - 1));
  let cruisers = 0;
  for (const vehicle of game.vehicles) if (vehicle.ai === 'police') cruisers += 1;
  let foot = 0;
  for (const officer of game.cops) if (officer.health > 0) foot += 1;
  for (let index = cruisers; index < desiredCruisers; index += 1) spawnCruiser(game);
  for (let index = foot; index < desiredFoot; index += 1) spawnFootOfficer(game);
}

/** Bring in a couple of units at once, for the moments the story wants them. */
export function callBackup(game, count = 2) {
  for (let index = 0; index < count; index += 1) {
    spawnCruiser(game);
    spawnFootOfficer(game);
  }
}

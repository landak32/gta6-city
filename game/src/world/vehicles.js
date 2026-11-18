// Vehicles: six kinds of car, each with its own length, mass, top speed, grip and paint, and the
// arcade physics that moves them. A car is a pair of circles riding its centre line, so it
// collides with walls and other cars as a body rather than a point, and it leaves tyre marks
// when it drifts, smokes when it is wrecked and catches fire when it is finished.

import { clamp, TAU, resolveCircleRect } from '../core/math2d.js';

export const VEHICLE_TYPES = {
  sport: {
    id: 'sport',
    name: 'Vesper GT',
    length: 48,
    width: 24,
    mass: 1,
    maxSpeed: 560,
    accel: 640,
    brake: 1050,
    grip: 5.2,
    turn: 3.1,
    health: 100,
    colours: ['#b8392f', '#1f6f8b', '#e0c341', '#efefe6', '#2a2a33'],
    weight: 0.1,
  },
  sedan: {
    id: 'sedan',
    name: 'Marlowe 400',
    length: 50,
    width: 26,
    mass: 1.25,
    maxSpeed: 420,
    accel: 430,
    brake: 880,
    grip: 6.2,
    turn: 2.7,
    health: 110,
    colours: ['#b9c3c9', '#6f7f8c', '#8d3c3a', '#2f4a5c', '#ddd6c6', '#4a5f4c'],
    weight: 0.34,
  },
  van: {
    id: 'van',
    name: 'Bramble Van',
    length: 60,
    width: 30,
    mass: 1.9,
    maxSpeed: 330,
    accel: 330,
    brake: 720,
    grip: 5.4,
    turn: 2.2,
    health: 150,
    colours: ['#e8e2d4', '#7b8f6d', '#c07a4a', '#5d6f7d'],
    weight: 0.16,
  },
  taxi: {
    id: 'taxi',
    name: 'Checker Cab',
    length: 50,
    width: 26,
    mass: 1.3,
    maxSpeed: 440,
    accel: 460,
    brake: 880,
    grip: 6,
    turn: 2.8,
    health: 110,
    colours: ['#efc132'],
    weight: 0.16,
  },
  police: {
    id: 'police',
    name: 'Harbor Cruiser',
    length: 52,
    width: 27,
    mass: 1.45,
    maxSpeed: 505,
    accel: 560,
    brake: 980,
    grip: 6.4,
    turn: 2.9,
    health: 140,
    colours: ['#eceff2'],
    weight: 0,
    siren: true,
  },
  truck: {
    id: 'truck',
    name: 'Bulk Hauler',
    length: 82,
    width: 36,
    mass: 3.4,
    maxSpeed: 280,
    accel: 270,
    brake: 640,
    grip: 4.6,
    turn: 1.7,
    health: 210,
    colours: ['#8c6b47', '#6d7d86', '#a34b35', '#4e6b57'],
    weight: 0.08,
  },
};

export const VEHICLE_IDS = Object.keys(VEHICLE_TYPES);

let nextVehicleId = 1;

/** A fresh car standing at (x, y) pointing along `angle`. */
export function createVehicle(typeId, x, y, angle, random, options = {}) {
  const type = VEHICLE_TYPES[typeId] ?? VEHICLE_TYPES.sedan;
  const colour = options.color ?? (type.colours.length > 1 && random ? random.pick(type.colours) : type.colours[0]);
  return {
    id: nextVehicleId++,
    type,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    steer: 0,
    speed: 0,
    colour,
    health: type.health,
    maxHealth: type.health,
    driver: null,
    isPolice: Boolean(type.siren),
    siren: false,
    sirenPhase: random ? random.range(0, TAU) : 0,
    wrecked: false,
    burning: 0,
    enginePower: 1,
    braking: false,
    drifting: 0,
    distance: 0,
    route: null,
    routeIndex: 0,
    honk: 0,
    panicTimer: 0,
    parked: Boolean(options.parked),
    mission: options.mission ?? null,
    bulletsHit: 0,
    lastHit: 0,
  };
}

/** Where the two collision discs of a car sit. */
export function vehiclePoints(vehicle) {
  const cosine = Math.cos(vehicle.angle);
  const sine = Math.sin(vehicle.angle);
  const offset = vehicle.type.length * 0.26;
  return [
    { x: vehicle.x + cosine * offset, y: vehicle.y + sine * offset },
    { x: vehicle.x - cosine * offset, y: vehicle.y - sine * offset },
  ];
}

/**
 * Drive one car for a step. `control` holds throttle and steer in [-1, 1], brake and handbrake
 * in [0, 1]. The car keeps its sideways momentum as drift that tyre grip bleeds away, which is
 * what makes a sports car slide through a corner and a truck plough straight on.
 */
export function stepVehicle(vehicle, control, dt, world, trails) {
  const type = vehicle.type;
  const throttle = vehicle.wrecked ? 0 : control.throttle;
  const brakeAmount = vehicle.wrecked ? 0.4 : control.brake;
  const steerInput = vehicle.wrecked ? control.steer * 0.4 : control.steer;

  const cosine = Math.cos(vehicle.angle);
  const sine = Math.sin(vehicle.angle);
  const forward = vehicle.vx * cosine + vehicle.vy * sine;
  const lateral = -vehicle.vx * sine + vehicle.vy * cosine;

  let nextForward = forward;
  if (throttle !== 0) nextForward += throttle * type.accel * vehicle.enginePower * dt;
  if (brakeAmount > 0) nextForward -= Math.sign(forward || 1) * type.brake * brakeAmount * dt;
  // Engine braking and the air itself.
  nextForward *= 1 - (vehicle.wrecked ? 1.6 : 0.55) * dt;
  const reverseLimit = type.maxSpeed * 0.38;
  const topSpeed = type.maxSpeed * (vehicle.enginePower < 1 ? 0.45 : 1);
  nextForward = clamp(nextForward, -reverseLimit, topSpeed);
  if (Math.abs(nextForward) < 4 && throttle === 0) nextForward = 0;

  let nextLateral = lateral * Math.exp(-type.grip * dt);
  const handbrake = control.handbrake ? 0.55 : 1;
  const drift = Math.abs(lateral) > 46 || control.handbrake > 0;
  if (drift) {
    nextLateral = lateral * Math.exp(-type.grip * handbrake * 0.42 * dt);
    vehicle.drifting = Math.min(1, vehicle.drifting + dt * 3);
  } else {
    vehicle.drifting = Math.max(0, vehicle.drifting - dt * 3);
  }

  const speedFactor = clamp(Math.abs(nextForward) / 130, 0, 1) * (1 - Math.min(0.45, Math.abs(nextForward) / (type.maxSpeed * 2.4)));
  const turnRate = type.turn * steerInput * speedFactor * Math.sign(nextForward || 1);
  vehicle.angle += turnRate * dt;
  vehicle.angle = ((vehicle.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;

  vehicle.vx = cosine * nextForward - sine * nextLateral;
  vehicle.vy = sine * nextForward + cosine * nextLateral;
  vehicle.steer = steerInput;
  vehicle.braking = brakeAmount > 0 || control.handbrake > 0;
  vehicle.speed = nextForward;

  const moveX = vehicle.vx * dt;
  const moveY = vehicle.vy * dt;
  vehicle.x += moveX;
  vehicle.y += moveY;
  vehicle.distance += Math.hypot(moveX, moveY);

  if (trails && vehicle.drifting > 0.35 && Math.abs(vehicle.speed) > 60 && trails.count < trails.capacity) {
    trails.push(vehicle.x - cosine * type.length * 0.3, vehicle.y - sine * type.length * 0.3, vehicle.angle, 0.5, type.width);
    trails.push(vehicle.x + cosine * type.length * 0.3, vehicle.y + sine * type.length * 0.3, vehicle.angle, 0.5, type.width);
  }

  // Walls, buildings and heavy street furniture.
  const radius = type.width * 0.52;
  for (const point of vehiclePoints(vehicle)) {
    for (const rect of world.solidsNear(point.x, point.y, radius + 6)) {
      if (!rect.kind || rect.kind === 'awning') continue;
      const fixed = resolveCircleRect(point.x, point.y, radius, rect);
      if (!fixed) continue;
      const offsetX = fixed.x - point.x;
      const offsetY = fixed.y - point.y;
      vehicle.x += offsetX;
      vehicle.y += offsetY;
      const dot = (vehicle.vx * offsetX + vehicle.vy * offsetY) / (Math.hypot(offsetX, offsetY) || 1);
      if (dot < 0) {
        const impact = Math.abs(dot);
        vehicle.vx -= (offsetX / (Math.hypot(offsetX, offsetY) || 1)) * impact * 1.2;
        vehicle.vy -= (offsetY / (Math.hypot(offsetX, offsetY) || 1)) * impact * 1.2;
        if (impact > 90) damageVehicle(vehicle, (impact - 90) * 0.09);
      }
    }
  }

  if (world.inWater(vehicle.x, vehicle.y)) {
    vehicle.vx *= 0.4;
    vehicle.vy *= 0.4;
    vehicle.x -= vehicle.vx * dt * 4;
    vehicle.y -= vehicle.vy * dt * 4;
    damageVehicle(vehicle, 4 * dt);
  }

  vehicle.x = clamp(vehicle.x, 30, world.width - 30);
  vehicle.y = clamp(vehicle.y, 30, world.height - 30);

  if (vehicle.burning > 0) {
    vehicle.burning += dt;
    damageVehicle(vehicle, 9 * dt);
  }
  return vehicle;
}

export function damageVehicle(vehicle, amount) {
  if (vehicle.health <= 0) return;
  vehicle.health -= amount;
  if (vehicle.health <= 0) {
    vehicle.health = 0;
    vehicle.wrecked = true;
    vehicle.enginePower = 0.35;
    vehicle.burning = 0.01;
    vehicle.vx *= 0.5;
    vehicle.vy *= 0.5;
  }
}

/** Push two cars apart and trade momentum, so a heavy truck nudges a sports car aside. */
export function resolveVehicleCollision(a, b, onImpact) {
  const gapX = b.x - a.x;
  const gapY = b.y - a.y;
  const minGap = (a.type.length + b.type.length) * 0.31;
  const distance = Math.hypot(gapX, gapY);
  if (distance > minGap || distance < 0.001) return false;
  const overlap = (minGap - distance) / distance;
  const normalX = gapX / distance;
  const normalY = gapY / distance;
  const massA = a.type.mass;
  const massB = b.type.mass;
  const shareA = massB / (massA + massB);
  const shareB = massA / (massA + massB);
  a.x -= normalX * (minGap - distance) * shareA;
  a.y -= normalY * (minGap - distance) * shareB;
  b.x += normalX * (minGap - distance) * shareB;
  b.y += normalY * (minGap - distance) * shareA;

  const relative = (b.vx - a.vx) * normalX + (b.vy - a.vy) * normalY;
  if (relative < 0) {
    const impulse = relative * 0.85;
    a.vx += normalX * impulse * shareA;
    a.vy += normalY * impulse * shareA;
    b.vx -= normalX * impulse * shareB;
    b.vy -= normalY * impulse * shareB;
    const force = Math.abs(relative);
    damageVehicle(a, force * 0.06 * shareA);
    damageVehicle(b, force * 0.06 * shareB);
    if (onImpact && force > 55) onImpact(a, b, force);
  }
  return overlap > 0;
}

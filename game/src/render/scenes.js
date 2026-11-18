// The four staged scenes behind ?shot=<name>. Each one builds a real game, seats the player in a
// real car or on a real pavement, and then hands control to a small autopilot that keeps driving,
// shooting and panicking through the same input layer the keyboard uses. Nothing here draws.

import { createGame, stepGame } from '../world/game.js';
import { createVehicle } from '../world/vehicles.js';
import { spawnTrafficCar } from '../world/traffic.js';
import { spawnPedestrianNear, fillCrowd } from '../world/pedestrians.js';
import { startMission } from '../world/missions.js';
import { createOfficer } from '../world/police.js';
import { addWanted } from '../world/wanted.js';
import { createPad, driveToward, walkToward } from './autopilot.js';

function seatPlayer(game, car) {
  car.ai = 'player';
  car.driver = game.player;
  game.player.inVehicle = car;
  game.player.x = car.x;
  game.player.y = car.y;
}

function addCruiser(game, x, y, angle) {
  const cruiser = createVehicle('police', x, y, angle, game.random, {});
  cruiser.ai = 'police';
  cruiser.siren = true;
  cruiser.speed = 300;
  cruiser.vx = Math.cos(angle) * 300;
  cruiser.vy = Math.sin(angle) * 300;
  cruiser.waypoints = [];
  cruiser.routeTimer = 0;
  cruiser.targetSpeed = 340;
  cruiser.cruise = cruiser.type.maxSpeed * 0.8;
  game.vehicles.push(cruiser);
  return cruiser;
}

function populate(game, count, nearX, nearY) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radius = 90 + (index % 5) * 46;
    spawnPedestrianNear(game, nearX + Math.cos(angle) * radius, nearY + Math.sin(angle) * radius);
  }
}

const STAGES = {
  /** A stolen sports car downtown at night, three stars, cruisers on the tail. */
  chase(game, input) {
    game.clock.hour = 20.4;
    game.money = 18450;
    const roads = game.city.roads;
    const row = 1;
    const column = 1;
    const x = roads.roadX(column) + 70;
    const y = roads.roadY(row) + 22;
    const car = createVehicle('sport', x, y, 0, game.random, { color: '#b8392f' });
    seatPlayer(game, car);
    car.vx = 300;
    car.speed = 300;
    game.vehicles.push(car);
    game.player.weapon = 'pistol';
    game.player.ammo.pistol = 42;
    game.player.health = 74;
    game.player.armour = 30;
    car.health = 520;

    addWanted(game, 2.6, 'shooting');
    game.objectiveOverride = 'Lose the police — three stars on you';
    game.markerOverride = null;
    game.dialogue.line = null;
    game.dialogue.queue.length = 0;

    addCruiser(game, x - 96, y - 8, 0.03);
    addCruiser(game, x - 172, y + 26, 0.02);
    addCruiser(game, x - 246, y - 24, -0.04);
    // A fourth cruiser pulls alongside, siren lit, close enough to read as a PIT manoeuvre.
    const flanker = addCruiser(game, x + 26, y - 44, 0.01);
    flanker.targetSpeed = 310;
    flanker.holdAlongside = true;

    for (let index = 0; index < 5; index += 1) {
      spawnTrafficCar(game, {
        node: roads.nodeIndex(Math.min(column + 1 + index, roads.cols - 1), row),
        direction: 0,
        legs: 4,
        speedScale: 0.68,
      });
    }
    populate(game, 22, x + 150, y - 72);
    populate(game, 14, x + 210, y + 74);
    for (const node of [10, 11, 12]) spawnTrafficCar(game, { node, direction: 0 });
    for (const node of [11, 12, 13]) spawnTrafficCar(game, { node, direction: 2 });
    spawnTrafficCar(game, { node: 2, direction: 1 });
    spawnTrafficCar(game, { node: 18, direction: 3 });
    for (const wagon of game.vehicles) {
      if (wagon.ai === 'traffic') wagon.cruise *= 0.72;
    }

    const civilianPalette = ['#38506b', '#4a5560', '#6d6a63', '#1f4d5a', '#5c4a3f', '#8a8f96'];

    const target = { x: x + 5000, y };
    return {
      warmup: 3,
      zoom: 1.62,
      leadScale: 0.02,
      think() {
        driveToward(game, car, target.x, target.y, input, 0.66);
        car.health = Math.max(car.health, 320);
        let slot = 0;
        for (const cop of game.vehicles) {
          if (cop.ai !== 'police') continue;
          if (cop.holdAlongside) {
            // The flanker stays door-to-door rather than falling into the queue behind.
            const sideX = car.x + Math.cos(car.angle) * 12 + Math.cos(car.angle + Math.PI / 2) * -46;
            const sideY = car.y + Math.sin(car.angle) * 12 + Math.sin(car.angle + Math.PI / 2) * -46;
            cop.x += (sideX - cop.x) * 0.16;
            cop.y += (sideY - cop.y) * 0.16;
            cop.angle = car.angle;
            cop.vx = car.vx;
            cop.vy = car.vy;
            cop.siren = true;
            continue;
          }
          const gap = 96 + slot * 70;
          const tx = car.x - Math.cos(car.angle) * gap;
          const ty = car.y - Math.sin(car.angle) * gap + (slot % 2 === 0 ? -20 : 20);
          cop.x += (tx - cop.x) * 0.14;
          cop.y += (ty - cop.y) * 0.14;
          cop.angle = car.angle;
          cop.vx = car.vx;
          cop.vy = car.vy;
          cop.siren = true;
          slot += 1;
        }
        // Keep every civilian car near the chase out of the hero's red.
        let repaint = 0;
        for (const wagon of game.vehicles) {
          if (wagon === car || wagon.isPolice) continue;
          if (Math.hypot(wagon.x - car.x, wagon.y - car.y) > 900) continue;
          wagon.colour = civilianPalette[repaint % civilianPalette.length];
          repaint += 1;
        }
        let crowd = 0;
        for (const ped of game.peds) {
          if (Math.hypot(ped.x - car.x, ped.y - car.y) < 420) crowd += 1;
        }
        for (let extra = crowd; extra < 14; extra += 2) {
          spawnPedestrianNear(game, car.x + game.random.range(-260, 420), car.y + game.random.range(-150, 150));
        }
        if (game.wanted.level < 3) addWanted(game, 0.6, 'shooting');
        game.markerOverride = null;
        game.dialogue.line = null;
        if (game.dialogue.queue.length) game.dialogue.queue.length = 0;
        game.player.health = Math.max(64, game.player.health);
        car.health = Math.max(car.health, 320);
      },
    };
  },

  /** On foot on a busy pavement, pistol out, a delivery waiting up the street. */
  foot(game, input) {
    game.clock.hour = 15.4;
    game.money = 6420;
    const roads = game.city.roads;
    const column = 3;
    const row = 2;
    const laneY = roads.roadY(row);
    const x = roads.roadX(column) + 40;
    const y = laneY - roads.half - 24;
    startMission(game, 0);
    const marker = { x: x + 250, y: y - 4 };
    game.markerOverride = marker;
    game.objectiveOverride = 'Run the crate down to Pier Nine';

    game.player.x = x;
    game.player.y = y;
    game.player.angle = 0;
    game.player.weapon = 'pistol';
    game.player.ammo.pistol = 34;
    game.player.health = 86;
    game.dialogue.line = null;
    game.dialogue.queue.length = 0;

    // A busy pavement: a dense crowd along both kerbs.
    for (let index = 0; index < 44; index += 1) {
      const near = index < 26;
      const spread = near ? (index / 25 - 0.5) * 300 : (index / 18 - 0.5) * 760;
      const side = index % 3 === 0 ? 1 : -1;
      spawnPedestrianNear(game, x + spread + (index % 4) * 11, laneY + side * (roads.half + 18) + (index % 5) * 7);
    }

    // Parked cars along both kerbs, traffic in the lanes.
    const parkTypes = ['sedan', 'taxi', 'van', 'sport', 'sedan', 'truck', 'taxi', 'van', 'sedan', 'sport'];
    for (let slot = 0; slot < parkTypes.length; slot += 1) {
      const side = slot % 2 === 0 ? -1 : 1;
      const parked = createVehicle(parkTypes[slot], x - 260 + slot * 104, laneY + side * (roads.half - 19), side > 0 ? Math.PI : 0, game.random, {});
      parked.ai = 'parked';
      parked.vx = 0;
      parked.vy = 0;
      game.vehicles.push(parked);
    }
    for (const [dx, dir, speed] of [[120, 0, 200], [300, 0, 230], [-40, 0, 190], [-260, 2, 210], [200, 2, 220]]) {
      const wagon = spawnTrafficCar(game, { node: roads.nodeIndex(column, row), direction: dir });
      wagon.x = x + dx;
      wagon.y = laneY + (dir === 0 ? 21 : -21);
      wagon.angle = dir === 0 ? 0 : Math.PI;
      wagon.vx = Math.cos(wagon.angle) * speed;
      wagon.vy = 0;
      wagon.cruise = speed;
      wagon.speed = speed;
    }
    game.city.props.push({ kind: 'crate', x: marker.x, y: marker.y });

    return {
      warmup: 3,
      zoom: 1.52,
      leadScale: 0.34,
      think() {
        if (game.peds.length < 40) spawnPedestrianNear(game, x + 120, laneY - roads.half - 20);
        walkToward(game, x + 40, y, input);
        if (game.wanted.level > 0) game.wanted.heat = 0;
      },
    };
  },

  /** The coast road at sunset, traffic both ways, the beach on the right. */
  drive(game, input) {
    game.clock.hour = 18.55;
    game.money = 11280;
    const roads = game.city.roads;
    const row = roads.rows - 1;
    const x = roads.roadX(0) + 120;
    const y = roads.roadY(row) - 22;
    game.objectiveOverride = 'Cruise the coast road — the drop is at sundown';
    const car = createVehicle('sport', x, y, 0, game.random, { color: '#23b0bd' });
    seatPlayer(game, car);
    car.vx = 250;
    car.speed = 250;
    game.vehicles.push(car);
    game.player.weapon = 'pistol';
    game.player.ammo.pistol = 12;
    game.player.health = 100;
    game.player.armour = 60;

    for (let index = 1; index < 6; index += 1) {
      spawnTrafficCar(game, {
        node: roads.nodeIndex(Math.min(index, roads.cols - 1), row),
        direction: 0,
        legs: 4,
        speedScale: 0.5,
      });
      spawnTrafficCar(game, {
        node: roads.nodeIndex(Math.min(index + 1, roads.cols - 1), row),
        direction: 2,
        legs: 4,
        speedScale: 0.52,
      });
    }
    for (let index = 0; index < 16; index += 1) {
      spawnPedestrianNear(game, x + 120 + index * 46, y + 96 + (index % 4) * 22);
    }
    for (let index = 0; index < 18; index += 1) {
      spawnPedestrianNear(game, x + 40 + index * 58, y + 132 + (index % 3) * 26);
    }

    const civilianPalette = ['#38506b', '#4a5560', '#6d6a63', '#1f4d5a', '#5c4a3f', '#8a8f96'];

    const target = { x: x + 5000, y };
    return {
      warmup: 4,
      zoom: 1.18,
      leadScale: 0.3,
      think() {
        driveToward(game, car, target.x, target.y, input, 0.55);
        game.player.health = 100;
        // Nothing may sit out in the surf.
        const surf = roads.roadY(row) + 96;
        for (let index = game.vehicles.length - 1; index >= 0; index -= 1) {
          if (game.vehicles[index].y > surf) game.vehicles.splice(index, 1);
        }
        let repaint = 0;
        for (const wagon of game.vehicles) {
          if (wagon === car) continue;
          if (Math.hypot(wagon.x - car.x, wagon.y - car.y) > 900) continue;
          wagon.colour = civilianPalette[repaint % civilianPalette.length];
          repaint += 1;
        }
      },
    };
  },

  /** The heist goes wrong at the docks: low health, cops inbound, the boss talking. */
  mission(game, input) {
    game.clock.hour = 20.7;
    game.money = 2960;
    const shed = game.city.landmark('dockshed');
    const x = (shed?.x ?? 600) + 120;
    const y = (shed?.y ?? 900) + 80;
    game.player.x = x;
    game.player.y = y;
    game.player.angle = -0.6;
    game.player.weapon = 'smg';
    game.player.ammo.smg = 96;
    game.player.ammo.pistol = 30;
    game.player.health = 34;
    game.player.armour = 22;

    startMission(game, 3);
    addWanted(game, 3.4, 'heist');
    populate(game, 18, x + 40, y + 30);
    game.objectiveOverride = 'Hold the container — the van is coming';
    game.markerOverride = null;
    game.dialogue.line = null;
    game.dialogue.queue.length = 0;

    // Officers on the ground with guns up, and two cruisers rolling in on the street.
    for (let index = 0; index < 5; index += 1) {
      const angle = -0.7 + (index - 2) * 0.46;
      game.cops.push(createOfficer(game, x + Math.cos(angle) * 205, y + Math.sin(angle) * 205));
    }
    addCruiser(game, x + 215, y + 46, Math.PI);
    addCruiser(game, x - 150, y + 150, -Math.PI / 2);

    let burst = 0;
    const ring = [-1.15, -0.72, -0.28, 0.16, 0.62];
    return {
      warmup: 9,
      zoom: 1.46,
      leadScale: 0.5,
      think(dt) {
        const px = game.player.x;
        const py = game.player.y;
        // Hold the yard: five officers push in from the gate side, guns up.
        for (let slot = 0; slot < ring.length; slot += 1) {
          if (!game.cops[slot]) {
            game.cops[slot] = createOfficer(game, px + Math.cos(ring[slot]) * 250, py + Math.sin(ring[slot]) * 250);
          }
          const cop = game.cops[slot];
          cop.health = Math.max(cop.health, 70);
          cop.state = 'fight';
          const tx = px + Math.cos(ring[slot]) * 205;
          const ty = py + Math.sin(ring[slot]) * 205;
          cop.x += (tx - cop.x) * 0.16;
          cop.y += (ty - cop.y) * 0.16;
          cop.angle = Math.atan2(py - cop.y, px - cop.x);
        }

        // Two cruisers parked across the yard mouth, light bars going.
        const cruisers = game.vehicles.filter((vehicle) => vehicle.ai === 'police');
        const posts = [
          [px + 215, py + 46, Math.PI],
          [px - 172, py + 168, -Math.PI / 2],
          [px + 126, py - 172, Math.PI / 2],
          [px - 205, py - 96, 0],
        ];
        cruisers.forEach((cop, slot) => {
          const post = posts[slot] ?? posts[0];
          cop.x = post[0];
          cop.y = post[1];
          cop.angle = post[2];
          cop.vx = 0;
          cop.vy = 0;
          cop.speed = 0;
          cop.siren = true;
        });

        // The player empties the SMG at the nearest officer.
        let nearest = null;
        let best = 900;
        for (const cop of game.cops) {
          if (!cop || cop.health <= 0) continue;
          const gap = Math.hypot(cop.x - px, cop.y - py);
          if (gap < best) {
            best = gap;
            nearest = cop;
          }
        }
        if (nearest) {
          game.player.angle = Math.atan2(nearest.y - game.player.y, nearest.x - game.player.x);
          game.control.aimX = nearest.x;
          game.control.aimY = nearest.y;
        }
        burst += dt;
        input.set('fire', burst % 0.9 < 0.7);
        if (game.wanted.level < 4) addWanted(game, 0.4, 'shooting');
        game.player.ammo.smg = 300;
        game.player.health = 33 + Math.sin(burst * 1.4) * 4;
        game.player.armour = 30;
        game.player.dead = false;
        if (game.mode !== 'play') game.mode = 'play';
        if (!game.dialogue.line && game.dialogue.queue.length === 0) {
          game.say({
            speaker: 'Salvador',
            text: 'North gate is crawling with them. Hold the container, and do not let them take the shed.',
          });
        }
      },
    };
  },
};

function warmUp(game, plan) {
  const dt = 1 / 60;
  const steps = Math.round((plan.warmup ?? 6) * 60);
  for (let index = 0; index < steps; index += 1) {
    plan.think(dt, index * dt);
    stepGame(game, dt);
    game.input.endFrame();
    const player = game.player;
    const body = player.inVehicle ?? player;
    game.camera.focus(body.x, body.y, body.vx ?? 0, body.vy ?? 0, dt, game.city);
  }
}

export const SHOT_NAMES = Object.keys(STAGES);

/** Build a live game staged for one of the four screenshot scenes. */
export function buildShot(name, seed = 7) {
  const game = createGame({ seed });
  const input = createPad();
  game.input = input;
  const stage = STAGES[name] ?? STAGES.chase;
  const plan = stage(game, input);
  warmUp(game, plan);
  game.toasts.length = 0;
  if (plan.zoom) game.camera.state.zoom = plan.zoom;
  if (plan.leadScale) game.camera.state.leadScale = plan.leadScale;

  const player = game.player;
  const body = player.inVehicle ?? player;
  game.camera.snap(body.x, body.y, game.city);

  const think = (dt) => {
    plan.think(dt);
    stepGame(game, dt);
    input.endFrame();
  };

  return { game, input, think, name };
}

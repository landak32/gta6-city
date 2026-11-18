// The world's spine. One game object owns the city, the player, every car and pedestrian, the
// police response, the story, the clock and the money. `stepGame` advances all of it by one fixed
// step in a deliberate order: input, the player, the traffic, the crowd, the police, the story,
// the bullets, then the contacts between them. Nothing in here touches the canvas.

import { clamp, TAU, wrapAngle } from '../core/math2d.js';
import { createRandom } from '../core/rng.js';
import { createCity } from '../world/city.js';
import { createCamera } from '../render/camera.js';
import { createPlayer, stepPlayerOnFoot } from '../world/player.js';
import { createVehicle, stepVehicle, damageVehicle, resolveVehicleCollision } from '../world/vehicles.js';
import { stepTraffic, maintainTraffic } from '../world/traffic.js';
import { stepPedestrians, panicCrowd, hurtPedestrian, blockCorners, fillCrowd } from '../world/pedestrians.js';
import { stepPolice, maintainPolice } from '../world/police.js';
import { createWanted, addWanted, stepWanted, clearWanted, CRIMES } from '../world/wanted.js';
import { WEAPONS, WEAPON_ORDER, fireWeapon, meleeAttack, stepBullets } from '../world/combat.js';
import { createParticles } from '../world/particles.js';
import { createTrails } from '../world/trails.js';
import { createMissionState, stepMission, startMission, retryMission, MISSIONS } from '../world/missions.js';
import { createJobState, stepJob, startTaxiFare, startCourierRun, activeObjectiveMarker } from '../world/side-jobs.js';
import { loadProgress, saveProgress as writeProfile, hasProgress } from '../core/save.js';

const HOURS_PER_SECOND = 0.02;
const MAX_VEHICLES = 52;

/** A clear patch of ground near (x, y): the pavement, never inside a wall or the harbour. */
export function safeSpot(game, x, y) {
  const city = game.city;
  const test = (px, py) => {
    if (px < 60 || py < 60 || px > city.width - 60 || py > city.height - 60) return false;
    if (city.inWater(px, py)) return false;
    for (const rect of city.solidsNear(px, py, 16)) {
      if (rect.kind === 'awning' || rect.kind === 'lamp' || rect.kind === 'bin') continue;
      if (px > rect.x - 14 && px < rect.x + rect.w + 14 && py > rect.y - 14 && py < rect.y + rect.h + 14) return false;
    }
    return true;
  };
  if (test(x, y)) return { x, y };
  for (let ring = 1; ring <= 5; ring += 1) {
    const radius = ring * 46;
    for (let step = 0; step < 14; step += 1) {
      const angle = (step / 14) * TAU + ring * 0.4;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (test(px, py)) return { x: px, y: py };
    }
  }
  return { x: clamp(x, 80, city.width - 80), y: clamp(y, 80, city.height - 80) };
}

function landmarkSpot(game, id, offsetX = 0, offsetY = 0) {
  const landmark = game.city.landmark(id);
  if (!landmark) return safeSpot(game, game.city.width / 2, game.city.height / 2);
  return safeSpot(game, landmark.x + offsetX, landmark.y + offsetY);
}

function makePickups(game) {
  const spots = [
    { id: 'pawnshop', kind: 'weapon', weapon: 'pistol', ammo: 60, offset: [70, 40] },
    { id: 'dockshed', kind: 'weapon', weapon: 'smg', ammo: 120, offset: [-70, -50] },
    { id: 'hospital', kind: 'health', offset: [60, 60] },
    { id: 'precinct', kind: 'armour', offset: [0, 70] },
    { id: 'club', kind: 'weapon', weapon: 'pistol', ammo: 40, offset: [60, -50] },
    { id: 'park', kind: 'health', offset: [0, 0] },
    { id: 'marina', kind: 'armour', offset: [50, 40] },
  ];
  return spots.map((spot, index) => {
    const point = landmarkSpot(game, spot.id, spot.offset?.[0] ?? 0, spot.offset?.[1] ?? 0);
    return {
      id: `pickup-${index}`,
      x: point.x,
      y: point.y,
      kind: spot.kind,
      weapon: spot.weapon ?? null,
      ammo: spot.ammo ?? 0,
      taken: false,
      phase: game.random.range(0, TAU),
    };
  });
}

export function createGame(options = {}) {
  const seed = options.seed ?? 1337;
  const random = createRandom(seed);
  const city = createCity(seed);
  const game = {
    seed,
    random,
    city,
    camera: createCamera(),
    particles: createParticles(700),
    trails: createTrails(900),
    bullets: [],
    vehicles: [],
    peds: [],
    cops: [],
    pickups: [],
    wanted: createWanted(),
    mission: createMissionState(),
    job: createJobState(),
    dialogue: { queue: [], line: null, timer: 0, hold: false },
    toasts: [],
    clock: { time: 0, hour: 16.4, day: 1 },
    money: 1250,
    control: {
      moveX: 0,
      moveY: 0,
      sprint: false,
      throttle: 0,
      steer: 0,
      brake: 0,
      handbrake: false,
      fire: false,
      aimX: null,
      aimY: null,
      interactPressed: false,
      confirmPressed: false,
      weaponSwitch: 0,
      enterPressed: false,
      hornPressed: false,
    },
    stats: {
      shotsFired: 0,
      pedsDowned: 0,
      copsDowned: 0,
      carsStolen: 0,
      crashes: 0,
      distanceWalked: 0,
      distanceDriven: 0,
      missionsDone: 0,
      fares: 0,
      couriers: 0,
      moneyEarned: 0,
    },
    trafficTarget: 34,
    crowdTarget: 96,
    musicStep: 0,
    musicTimer: 0,
    mode: 'play',
    objective: '',
    input: options.input ?? null,
    audio: options.audio ?? null,
    autopilot: options.autopilot ?? null,
    sceneName: options.scene ?? null,
    freezeHour: false,
    deathTimer: 0,
    lastRespawn: null,
    profile: loadProgress(),
  };

  const start = landmarkSpot(game, 'taxistand', 40, 80);
  const player = createPlayer(start.x, start.y);
  player.weapon = 'pistol';
  player.ammo = { pistol: 48, smg: 0 };
  player.owned = { fists: true, pistol: true, smg: false };
  game.player = player;

  game.camera.snap(player.x, player.y, city);
  game.pickups = makePickups(game);
  fillCrowd(game, game.crowdTarget);

  // Park a few cars so the streets are alive before the traffic manager fills them.
  for (let index = 0; index < 6; index += 1) {
    maintainTraffic(game);
  }
  maintainPolice(game);

  game.addToast = (text, tone = 'info') => {
    game.toasts.push({ text, tone, age: 0, life: 3.4 });
    if (game.toasts.length > 5) game.toasts.shift();
  };
  game.say = (line) => {
    game.dialogue.queue.push({ ...line, age: 0 });
  };
  game.reportCrime = (kind, x, y) => {
    const amount = CRIMES[kind] ?? 0.4;
    addWanted(game, amount, kind);
    if (typeof x === 'number' && typeof y === 'number') panicCrowd(game, x, y, 240, 1);
  };
  game.hurtPed = (ped, damage, angle, owner) => hurtPedestrian(game, ped, damage, angle, owner);
  game.hurtCop = (cop, damage, angle) => {
    if (cop.health <= 0) return;
    cop.health -= damage;
    game.particles.burst(cop.x, cop.y, 4, {
      angle: angle ?? 0,
      spread: 1.3,
      speed: 110,
      life: 0.24,
      size: 2,
      color: '#bcd7ea',
    });
    if (cop.health <= 0) {
      game.stats.copsDowned += 1;
      addWanted(game, CRIMES.copKill, 'cop');
      game.addToast('Officer down', 'bad');
    } else {
      addWanted(game, CRIMES.cop * 0.35, 'cop');
    }
  };
  game.hurtPlayer = (amount, source) => {
    if (game.mode !== 'play') return false;
    const died = requireDamage(game, amount, source);
    if (died) startDeath(game);
    return died;
  };
  game.bustPlayer = () => startBust(game);
  game.saveProgress = () => {
    writeProfile({
      money: Math.round(game.money),
      missionsDone: game.mission.index,
      missionStep: game.mission.step,
      owned: game.player.owned,
      ammo: game.player.ammo,
      health: Math.round(game.player.health),
      stats: game.stats,
      hour: game.clock.hour,
      day: game.clock.day,
    });
  };
  game.onShotFired = (spec) => {
    if (spec.owner !== 'player') return;
    game.stats.shotsFired += 1;
    game.reportCrime('shot', spec.x, spec.y);
    for (const vehicle of game.vehicles) {
      if (Math.hypot(vehicle.x - spec.x, vehicle.y - spec.y) < 420) vehicle.panicTimer = 2.2;
    }
  };
  game.continueFromProfile = () => {
    const profile = game.profile;
    if (!profile) return false;
    game.money = Math.max(0, Math.round(profile.money ?? game.money));
    game.mission.index = clamp(profile.missionsDone ?? 0, 0, MISSIONS.length);
    game.mission.step = 0;
    game.player.owned = { ...game.player.owned, ...(profile.owned ?? {}) };
    game.player.ammo = { ...game.player.ammo, ...(profile.ammo ?? {}) };
    if (game.player.owned.smg) game.player.weapon = 'smg';
    if (profile.stats) Object.assign(game.stats, profile.stats);
    if (typeof profile.hour === 'number') game.clock.hour = profile.hour;
    game.addToast('Welcome back to Vice Harbor', 'good');
    return true;
  };

  return game;
}

/** Damage through the player's armour; true when it is fatal. */
function requireDamage(game, amount, source) {
  const player = game.player;
  if (player.dead || player.invuln > 0) return false;
  let remaining = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, remaining * 0.7);
    player.armour -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  player.lastDamageFrom = source ?? null;
  player.invuln = 0.18;
  game.camera.addShake(Math.min(10, amount * 0.6));
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

function startDeath(game) {
  game.mode = 'dead';
  game.deathTimer = 2.6;
  game.lastRespawn = 'hospital';
  game.audio?.fail();
  const player = game.player;
  if (player.inVehicle) {
    player.inVehicle.ai = 'abandoned';
    player.inVehicle = null;
  }
}

function startBust(game) {
  if (game.mode !== 'play') return;
  game.mode = 'busted';
  game.deathTimer = 2.4;
  game.lastRespawn = 'precinct';
  game.audio?.fail();
  const player = game.player;
  if (player.inVehicle) {
    player.inVehicle.ai = 'abandoned';
    player.inVehicle = null;
  }
}

function respawnPlayer(game, landmarkId) {
  const spot = landmarkSpot(game, landmarkId, 50, 50);
  const fee = landmarkId === 'precinct' ? 300 : 600;
  const paid = Math.min(game.money, fee);
  game.money -= paid;
  game.stats.moneyLost = (game.stats.moneyLost ?? 0) + paid;
  game.addToast(`${landmarkId === 'precinct' ? 'Bail' : 'Hospital bill'}  -$${paid}`, 'bad');
  const player = game.player;
  player.x = spot.x;
  player.y = spot.y;
  player.vx = 0;
  player.vy = 0;
  player.health = 100;
  player.armour = 0;
  player.dead = false;
  player.invuln = 1.2;
  player.knocked = 0;
  clearWanted(game);
  game.cops.length = 0;
  game.mode = 'play';
  game.deathTimer = 0;
  game.camera.snap(player.x, player.y, game.city);
  if (game.mission.active) {
    game.mission.active = false;
    game.mission.failed = game.lastRespawn === 'precinct' ? 'Arrested' : 'You died';
  }
}

export function applyInput(game) {
  const control = game.control;
  const input = game.input;
  control.moveX = 0;
  control.moveY = 0;
  control.sprint = false;
  control.throttle = 0;
  control.steer = 0;
  control.brake = 0;
  control.handbrake = false;
  control.fire = false;
  control.enterPressed = false;
  control.interactPressed = false;
  control.confirmPressed = false;
  control.weaponSwitch = 0;
  control.aimX = null;
  control.aimY = null;
  if (!input) return;
  const left = input.down('left');
  const right = input.down('right');
  const up = input.down('up');
  const down = input.down('down');
  control.moveX = (right ? 1 : 0) - (left ? 1 : 0);
  control.moveY = (down ? 1 : 0) - (up ? 1 : 0);
  control.sprint = input.down('sprint');
  control.throttle = (input.down('accelerate') ? 1 : 0) - (input.down('reverse') ? 1 : 0);
  control.steer = (input.down('steerRight') ? 1 : 0) - (input.down('steerLeft') ? 1 : 0);
  control.brake = input.down('handbrake') ? 0 : input.down('reverse') ? 1 : 0;
  control.handbrake = input.down('handbrake');
  control.fire = input.down('fire') || Boolean(input.mouse && input.mouse.down);
  control.enterPressed = input.justPressed('enterCar');
  control.interactPressed = input.justPressed('interact');
  control.confirmPressed = input.justPressed('confirm');
  control.weaponSwitch = input.justPressed('weapon1') ? 1 : input.justPressed('weapon2') ? 2 : input.justPressed('weapon3') ? 3 : 0;
  control.hornPressed = input.justPressed('horn');
  if (input.mouse && input.mouse.inside) {
    control.aimX = input.mouse.x;
    control.aimY = input.mouse.y;
  }
}

function nearestVehicle(game, radius) {
  const player = game.player;
  let best = null;
  let bestGap = radius;
  for (const vehicle of game.vehicles) {
    const gap = Math.hypot(vehicle.x - player.x, vehicle.y - player.y);
    if (gap < bestGap) {
      bestGap = gap;
      best = vehicle;
    }
  }
  return best;
}

function enterVehicle(game, vehicle) {
  const player = game.player;
  if (!vehicle || vehicle.wrecked) return;
  const wasTraffic = vehicle.ai === 'traffic' || vehicle.ai === 'flee';
  const wasPolice = vehicle.ai === 'police';
  vehicle.ai = 'player';
  vehicle.driver = player;
  vehicle.panicTimer = 0;
  player.inVehicle = vehicle;
  player.x = vehicle.x;
  player.y = vehicle.y;
  if (wasTraffic) {
    game.stats.carsStolen += 1;
    game.reportCrime('carjack', vehicle.x, vehicle.y);
    game.addToast('Carjacked', 'bad');
  }
  if (wasPolice) {
    addWanted(game, 2, 'carjack');
    game.addToast('Police cruiser stolen', 'bad');
  }
  game.audio?.pickup();
}

function exitVehicle(game) {
  const player = game.player;
  const vehicle = player.inVehicle;
  if (!vehicle) return;
  const angle = vehicle.angle + Math.PI / 2;
  const spot = safeSpot(game, vehicle.x + Math.cos(angle) * 40, vehicle.y + Math.sin(angle) * 40);
  player.x = spot.x;
  player.y = spot.y;
  player.vx = 0;
  player.vy = 0;
  player.inVehicle = null;
  vehicle.driver = null;
  vehicle.ai = 'abandoned';
}

function meleeOrShoot(game) {
  const player = game.player;
  if (player.inVehicle || player.fireCooldown > 0) return;
  const weapon = WEAPONS[player.weapon] ?? WEAPONS.fists;
  let angle = player.angle;
  if (game.control.aimX !== null && game.camera) {
    const centre = game.camera.drawnCentre();
    const zoom = game.camera.state.zoom;
    const worldX = (game.control.aimX - 640) / zoom + centre.x;
    const worldY = (game.control.aimY - 360) / zoom + centre.y;
    angle = Math.atan2(worldY - player.y, worldX - player.x);
  }
  player.angle = angle;
  if (weapon.melee) {
    player.fireCooldown = weapon.rate;
    player.punchTimer = 0.22;
    meleeAttack(game, { x: player.x, y: player.y, angle, owner: 'player' });
    game.audio?.punch();
    return;
  }
  if ((player.ammo[weapon.id] ?? 0) <= 0) {
    game.addToast('Out of ammunition', 'bad');
    player.fireCooldown = 0.5;
    return;
  }
  player.ammo[weapon.id] -= 1;
  player.fireCooldown = weapon.rate;
  player.muzzleFlash = 0.09;
  fireWeapon(game, { x: player.x, y: player.y, angle, weaponId: weapon.id, owner: 'player' });
}

function switchWeapon(game, index) {
  const player = game.player;
  const order = WEAPON_ORDER.filter((id) => player.owned[id]);
  const current = order.indexOf(player.weapon);
  const next = order[(current + index + order.length) % order.length];
  player.weapon = next;
  game.addToast(WEAPONS[next].name, 'info');
}

function updatePickups(game) {
  const player = game.player;
  const px = player.inVehicle ? player.inVehicle.x : player.x;
  const py = player.inVehicle ? player.inVehicle.y : player.y;
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(px - pickup.x, py - pickup.y) > 30) continue;
    if (pickup.kind === 'weapon') {
      player.owned[pickup.weapon] = true;
      player.ammo[pickup.weapon] = Math.min(WEAPONS[pickup.weapon].ammoMax, (player.ammo[pickup.weapon] ?? 0) + pickup.ammo);
      player.weapon = pickup.weapon;
      game.addToast(`${WEAPONS[pickup.weapon].name}  +${pickup.ammo} rounds`, 'good');
    } else if (pickup.kind === 'health') {
      if (player.health >= 100) continue;
      player.health = Math.min(100, player.health + 45);
      game.addToast('Patched up', 'good');
    } else if (pickup.kind === 'armour') {
      if (player.armour >= 100) continue;
      player.armour = Math.min(100, player.armour + 60);
      game.addToast('Body armour', 'good');
    }
    pickup.taken = true;
    player.invuln = Math.max(player.invuln, 0.4);
    game.audio?.pickup();
  }
}

function updateDialogue(game, dt) {
  const dialogue = game.dialogue;
  if (!dialogue.line) {
    if (dialogue.queue.length === 0) return;
    dialogue.line = dialogue.queue.shift();
    dialogue.line.age = 0;
    dialogue.timer = 0;
  }
  dialogue.timer += dt;
  const line = dialogue.line;
  line.age = dialogue.timer;
  const complete = line.text.length / 42 + 1.4;
  if (dialogue.hold) return;
  if (game.control.confirmPressed || dialogue.timer > complete + 2.6) {
    if (dialogue.queue.length) {
      dialogue.line = dialogue.queue.shift();
      dialogue.line.age = 0;
      dialogue.timer = 0;
    } else {
      dialogue.line = null;
      dialogue.timer = 0;
    }
  }
}

function vehicleContacts(game, dt) {
  const vehicles = game.vehicles;
  for (let a = 0; a < vehicles.length; a += 1) {
    const carA = vehicles[a];
    for (let b = a + 1; b < vehicles.length; b += 1) {
      const carB = vehicles[b];
      if (Math.abs(carA.x - carB.x) > 130 || Math.abs(carA.y - carB.y) > 130) continue;
      resolveVehicleCollision(carA, carB, (first, second, force) => {
        if (force > 160) game.camera.addShake(Math.min(7, force * 0.01));
        if (force > 120) game.audio?.impact(Math.min(1, force / 420));
        game.particles.burst((first.x + second.x) / 2, (first.y + second.y) / 2, 6, {
          speed: 130,
          life: 0.3,
          size: 2,
          color: '#ffd9a0',
        });
        if (first.ai === 'player' || second.ai === 'player') game.stats.crashes += 1;
      });
    }
  }

  const player = game.player;
  for (const vehicle of vehicles) {
    const speed = Math.abs(vehicle.speed);
    if (speed < 45) continue;
    for (const ped of game.peds) {
      if (ped.state === 'down' || ped.state === 'gone') continue;
      if (Math.hypot(ped.x - vehicle.x, ped.y - vehicle.y) > vehicle.type.length * 0.5 + 8) continue;
      const damage = 40 + speed * 0.16;
      const owner = vehicle.ai === 'player' ? 'player' : vehicle.ai === 'police' ? 'cop' : 'traffic';
      hurtPedestrian(game, ped, damage, vehicle.angle, owner);
      vehicle.speed *= 0.72;
      game.camera.addShake(3);
      game.audio?.impact(0.6);
      game.particles.burst(ped.x, ped.y, 8, { speed: 120, life: 0.35, size: 2, color: '#e8dcc8' });
    }
    if (!player.inVehicle && !player.dead && player.knocked <= 0) {
      if (Math.hypot(player.x - vehicle.x, player.y - vehicle.y) < vehicle.type.length * 0.5 + 10) {
        player.knocked = 0.8;
        player.vx = vehicle.vx * 0.9;
        player.vy = vehicle.vy * 0.9;
        requireDamage(game, 22 + speed * 0.1, vehicle.ai);
        game.camera.addShake(8);
        game.audio?.impact(0.9);
        if (player.dead) startDeath(game);
      }
    }
  }

  // Keep the fleet bounded: the oldest abandoned cars far from the player are dropped.
  if (vehicles.length > MAX_VEHICLES) {
    const px = player.inVehicle ? player.inVehicle.x : player.x;
    const py = player.inVehicle ? player.inVehicle.y : player.y;
    for (let index = vehicles.length - 1; index >= 0 && vehicles.length > MAX_VEHICLES; index -= 1) {
      const car = vehicles[index];
      if (car.ai === 'player' || car.ai === 'police' || car === player.inVehicle) continue;
      if (Math.hypot(car.x - px, car.y - py) > 1500) vehicles.splice(index, 1);
    }
  }
}

function updateAudio(game, dt) {
  const audio = game.audio;
  if (!audio) return;
  const player = game.player;
  audio.engineNote(player.inVehicle ? player.inVehicle.speed : 0, Boolean(player.inVehicle));
  if (game.wanted.level > 0) {
    audio.sirenTone(true, Math.floor(game.clock.time * 2.2) % 2);
  } else {
    audio.sirenTone(false, 0);
  }
  game.musicTimer -= dt;
  if (game.musicTimer <= 0) {
    game.musicTimer = 0.16;
    game.musicStep += 1;
    audio.beat(game.musicStep, game.wanted.level);
  }
}

export function stepGame(game, dt) {
  if (game.mode !== 'play') {
    game.deathTimer -= dt;
    game.camera.update(dt);
    game.particles.step(dt);
    if (game.deathTimer <= 0) respawnPlayer(game, game.lastRespawn ?? 'hospital');
    return;
  }

  game.clock.time += dt;
  if (!game.freezeHour) {
    game.clock.hour = (game.clock.hour + dt * HOURS_PER_SECOND) % 24;
    if (game.clock.hour < dt * HOURS_PER_SECOND) game.clock.day += 1;
  }

  applyInput(game);
  if (game.autopilot) game.autopilot(game, dt);

  updateDialogue(game, dt);
  for (const toast of game.toasts) toast.age += dt;
  game.toasts = game.toasts.filter((toast) => toast.age < toast.life);

  const player = game.player;
  player.muzzleFlash = Math.max(0, (player.muzzleFlash ?? 0) - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.knocked = Math.max(0, (player.knocked ?? 0) - dt);

  if (player.inVehicle) {
    const vehicle = player.inVehicle;
    stepVehicle(
      vehicle,
      {
        throttle: game.control.throttle,
        steer: game.control.steer,
        brake: game.control.brake,
        handbrake: game.control.handbrake ? 1 : 0,
      },
      dt,
      game.city,
      game.trails,
    );
    player.x = vehicle.x;
    player.y = vehicle.y;
    player.angle = vehicle.angle;
    game.stats.distanceDriven += Math.abs(vehicle.speed) * dt;
    if (vehicle.wrecked && !vehicle.wreckedNotified) {
      vehicle.wreckedNotified = true;
      game.addToast('The engine is dead', 'bad');
      exitVehicle(game);
    }
  } else {
    const before = { x: player.x, y: player.y };
    stepPlayerOnFoot(player, game, dt);
    game.stats.distanceWalked += Math.hypot(player.x - before.x, player.y - before.y);
    if (game.control.fire) meleeOrShoot(game);
    if (game.control.enterPressed) {
      const vehicle = nearestVehicle(game, 76);
      if (vehicle) {
        enterVehicle(game, vehicle);
        game.control.enterPressed = false;
      }
    }
  }
  if (player.inVehicle && game.control.enterPressed) exitVehicle(game);
  player.fireCooldown = Math.max(0, player.fireCooldown);
  if (game.control.weaponSwitch) switchWeapon(game, game.control.weaponSwitch);

  if (game.control.interactPressed) {
    const inTaxi = player.inVehicle && player.inVehicle.type.id === 'taxi';
    const depot = game.city.landmark('depot');
    const nearDepot = depot && Math.hypot(player.x - depot.x, player.y - depot.y) < 220;
    if (inTaxi) startTaxiFare(game);
    else if (nearDepot) startCourierRun(game);
    else if (game.mission.failed) retryMission(game);
    else if (!game.mission.active && game.mission.index < MISSIONS.length) {
      const mission = MISSIONS[game.mission.index];
      if (Math.hypot(player.x - (game.city.landmark(mission.steps[0].place ?? 'club')?.x ?? 0), player.y - (game.city.landmark(mission.steps[0].place ?? 'club')?.y ?? 0)) < 150) {
        startMission(game, game.mission.index);
      } else {
        game.addToast('Find the mission marker', 'info');
      }
    }
  }

  stepTraffic(game, dt);
  if (game.peds.length < game.crowdTarget && game.random.chance(dt * 0.9)) {
    fillCrowd(game, Math.min(4, game.crowdTarget - game.peds.length));
  }
  stepPedestrians(game, dt);
  stepPolice(game, dt);
  stepMission(game, dt);
  stepJob(game, dt);
  stepBullets(game, dt);
  vehicleContacts(game, dt);
  maintainTraffic(game);
  maintainPolice(game);
  stepWanted(game, dt);
  updatePickups(game);

  game.marker = game.markerOverride === undefined ? activeObjectiveMarker(game) : game.markerOverride;
  game.objective = game.objectiveOverride ?? (game.mission.active
    ? game.mission.line
    : game.job.active
      ? game.job.line
      : game.mission.index < MISSIONS.length
        ? `Next job: ${MISSIONS[game.mission.index].title}`
        : 'Vice Harbor is yours');

  game.particles.step(dt);
  game.trails.step(dt);
  const focusX = player.inVehicle ? player.inVehicle.x : player.x;
  const focusY = player.inVehicle ? player.inVehicle.y : player.y;
  game.camera.focus(focusX, focusY, player.inVehicle ? player.inVehicle.vx : player.vx, player.inVehicle ? player.inVehicle.vy : player.vy, dt, game.city);
  game.camera.update(dt);
  updateAudio(game, dt);

  if (game.toasts.length === 0 && game.dialogue.queue.length === 0 && !game.dialogue.line) {
    game.objective = game.mission.active ? game.mission.line : game.objective;
  }
}

export { hasProgress, blockCorners, damageVehicle, wrapAngle, WEAPON_ORDER };

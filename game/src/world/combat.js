// Weapons and the projectiles they throw. A bullet is a real object that travels, can be stopped
// by a wall, dents a car, drops a pedestrian or hits an officer — nothing is hitscan and nothing
// is decided by a dice roll at the trigger. Each weapon differs in rate, spread, reach and punch.

import { clamp, TAU } from '../core/math2d.js';
import { damageVehicle } from './vehicles.js';

export const WEAPONS = {
  fists: {
    id: 'fists',
    name: 'Fists',
    short: 'FIST',
    melee: true,
    damage: 14,
    rate: 0.4,
    reach: 30,
    ammoMax: 0,
    spread: 0,
  },
  pistol: {
    id: 'pistol',
    name: 'Kessler 9',
    short: '9MM',
    melee: false,
    damage: 24,
    rate: 0.26,
    speed: 1550,
    range: 620,
    spread: 0.03,
    ammoMax: 150,
    recoil: 2.2,
  },
  smg: {
    id: 'smg',
    name: 'Marlin SMG',
    short: 'SMG',
    melee: false,
    damage: 13,
    rate: 0.082,
    speed: 1650,
    range: 520,
    spread: 0.115,
    ammoMax: 300,
    recoil: 1.3,
  },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

/** Pickups laid around the city: a crate with a weapon silhouette on it. */
export const WEAPON_PICKUPS = [
  { weapon: 'pistol', ammo: 40, x: 0, y: 0 },
  { weapon: 'smg', ammo: 90, x: 0, y: 0 },
];

export function createBullet(x, y, angle, weapon, owner) {
  const spread = (Math.random() - 0.5) * weapon.spread * 2;
  const heading = angle + spread;
  return {
    x,
    y,
    vx: Math.cos(heading) * weapon.speed,
    vy: Math.sin(heading) * weapon.speed,
    damage: weapon.damage,
    life: weapon.range / weapon.speed,
    age: 0,
    owner,
    angle: heading,
    alive: true,
  };
}

/** Pull the trigger: a muzzle flash, a puff of smoke and the round itself. */
export function fireWeapon(game, spec) {
  const weapon = WEAPONS[spec.weaponId] ?? WEAPONS.pistol;
  if (weapon.melee) return false;
  const muzzleX = spec.x + Math.cos(spec.angle) * 16;
  const muzzleY = spec.y + Math.sin(spec.angle) * 16;
  game.bullets.push(createBullet(muzzleX, muzzleY, spec.angle, weapon, spec.owner));

  game.particles.burst(muzzleX, muzzleY, weapon.id === 'smg' ? 4 : 6, {
    angle: spec.angle,
    spread: 0.5,
    speed: 190,
    life: 0.14,
    size: 3,
    color: '#ffd9a0',
    glow: true,
  });
  game.particles.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(spec.angle) * 30,
    vy: Math.sin(spec.angle) * 30,
    life: 0.3,
    size: 7,
    grow: 26,
    color: 'rgba(220, 210, 190, 0.35)',
    drag: 2,
    glow: false,
    kind: 'smoke',
  });
  if (game.audio) game.audio.gunshot(weapon.id);
  if (game.camera) game.camera.addShake(spec.owner === 'player' ? weapon.recoil : 1.2);
  game.onShotFired(spec);
  return true;
}

/** A short swing: everything in a narrow cone in front of the fist takes the hit. */
export function meleeAttack(game, spec) {
  const reach = WEAPONS.fists.reach;
  let connected = false;
  for (const ped of game.peds) {
    if (ped.state === 'down' || ped.state === 'gone') continue;
    const gap = Math.hypot(ped.x - spec.x, ped.y - spec.y);
    if (gap > reach + 8) continue;
    const bearing = Math.atan2(ped.y - spec.y, ped.x - spec.x);
    if (Math.abs(((bearing - spec.angle + Math.PI * 3) % TAU) - Math.PI) > 1.1) continue;
    game.hurtPed(ped, WEAPONS.fists.damage, spec.angle, spec.owner);
    connected = true;
  }
  for (const cop of game.cops) {
    if (cop.health <= 0) continue;
    const gap = Math.hypot(cop.x - spec.x, cop.y - spec.y);
    if (gap > reach + 8) continue;
    const bearing = Math.atan2(cop.y - spec.y, cop.x - spec.x);
    if (Math.abs(((bearing - spec.angle + Math.PI * 3) % TAU) - Math.PI) > 1.1) continue;
    game.hurtCop(cop, WEAPONS.fists.damage * 1.4, spec.angle);
    connected = true;
  }
  if (game.audio) game.audio.punch();
  game.particles.burst(spec.x + Math.cos(spec.angle) * 20, spec.y + Math.sin(spec.angle) * 20, 4, {
    angle: spec.angle,
    spread: 1.2,
    speed: 90,
    life: 0.18,
    size: 2,
    color: '#ffffff',
  });
  return connected;
}

/** Step every round, with a short sweep so a fast bullet cannot tunnel through a car. */
export function stepBullets(game, dt) {
  const { city } = game;
  for (let index = game.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = game.bullets[index];
    bullet.age += dt;
    if (bullet.age > bullet.life) {
      game.bullets.splice(index, 1);
      continue;
    }
    const steps = 2;
    let dead = false;
    for (let sub = 0; sub < steps && !dead; sub += 1) {
      bullet.x += (bullet.vx * dt) / steps;
      bullet.y += (bullet.vy * dt) / steps;

      if (!city.inBounds(bullet.x, bullet.y) || city.inWater(bullet.x, bullet.y)) {
        dead = true;
        break;
      }
      for (const rect of city.solidsNear(bullet.x, bullet.y, 6)) {
        if (rect.kind === 'awning') continue;
        if (bullet.x >= rect.x && bullet.x <= rect.x + rect.w && bullet.y >= rect.y && bullet.y <= rect.y + rect.h) {
          game.particles.burst(bullet.x, bullet.y, 5, { speed: 150, life: 0.25, size: 2, color: '#ffe0a8' });
          dead = true;
          break;
        }
      }
      if (dead) break;

      for (const vehicle of game.vehicles) {
        const gap = Math.hypot(vehicle.x - bullet.x, vehicle.y - bullet.y);
        if (gap > vehicle.type.length * 0.55) continue;
        const local = Math.atan2(bullet.y - vehicle.y, bullet.x - vehicle.x) - vehicle.angle;
        const along = Math.cos(local) * gap;
        const across = Math.sin(local) * gap;
        if (Math.abs(along) > vehicle.type.length * 0.55 || Math.abs(across) > vehicle.type.width * 0.55) continue;
        damageVehicle(vehicle, bullet.damage * 0.55);
        vehicle.panicTimer = 2.4;
        vehicle.bulletsHit += 1;
        game.particles.burst(bullet.x, bullet.y, 5, { speed: 140, life: 0.22, size: 2, color: '#ffcf7a' });
        if (game.audio) game.audio.impact(0.25);
        dead = true;
        break;
      }
      if (dead) break;

      for (const ped of game.peds) {
        if (ped.state === 'down' || ped.state === 'gone') continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) > 13) continue;
        game.hurtPed(ped, bullet.damage, bullet.angle, bullet.owner);
        dead = true;
        break;
      }
      if (dead) break;

      for (const cop of game.cops) {
        if (cop.health <= 0) continue;
        if (Math.hypot(cop.x - bullet.x, cop.y - bullet.y) > 14) continue;
        game.hurtCop(cop, bullet.damage, bullet.angle);
        dead = true;
        break;
      }
      if (dead) break;

      const player = game.player;
      if (bullet.owner !== 'player' && !player.inVehicle && !player.dead) {
        if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < 14) {
          game.hurtPlayer(bullet.damage, bullet.owner);
          dead = true;
          break;
        }
      }
      if (bullet.owner !== 'player' && player.inVehicle) {
        const car = player.inVehicle;
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < car.type.length * 0.5) {
          damageVehicle(car, bullet.damage * 0.5);
          game.particles.burst(bullet.x, bullet.y, 4, { speed: 130, life: 0.2, size: 2, color: '#ffcf7a' });
          dead = true;
          break;
        }
      }
    }
    if (dead) game.bullets.splice(index, 1);
  }
  if (game.bullets.length > 220) game.bullets.splice(0, game.bullets.length - 220);
}

/** The nearest target in front of a shooter, used by the police and by the aim assist on foot. */
export function nearestTarget(game, x, y, angle, reach, cone) {
  let best = null;
  let bestScore = Infinity;
  const consider = (target) => {
    const gap = Math.hypot(target.x - x, target.y - y);
    if (gap > reach) return;
    const bearing = Math.atan2(target.y - y, target.x - x);
    const offset = Math.abs(((bearing - angle + Math.PI * 3) % TAU) - Math.PI);
    if (offset > cone) return;
    const score = gap * (1 + offset);
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  };
  for (const ped of game.peds) if (ped.state !== 'down' && ped.state !== 'gone') consider(ped);
  for (const cop of game.cops) if (cop.health > 0) consider(cop);
  return best;
}

/** Line of sight over the city's solids, sampled every 26 px. */
export function hasLineOfSight(city, ax, ay, bx, by) {
  const gap = Math.hypot(bx - ax, by - ay);
  const steps = clamp(Math.ceil(gap / 26), 1, 60);
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const rect of city.solidsNear(x, y, 4)) {
      if (rect.kind === 'awning') continue;
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return false;
    }
  }
  return true;
}

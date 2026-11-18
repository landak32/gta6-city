// The player on foot: acceleration toward the stick, friction when it is released, a sprint that
// costs nothing but distance, eight-way facing for the art, and a footstep bob the renderer and
// the audio both read. Walking into walls slides along them instead of sticking.

import { PLAYER } from '../core/config.js';
import { clamp, resolveCircleRect, TAU } from '../core/math2d.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    facing: 0,
    health: PLAYER.maxHealth,
    armour: 0,
    weapon: 'fists',
    ammo: { pistol: 0, smg: 0 },
    inVehicle: null,
    stepPhase: 0,
    moving: false,
    sprinting: false,
    fireCooldown: 0,
    punchTimer: 0,
    invuln: PLAYER.respawnInvuln,
    dead: false,
    knocked: 0,
    lastDamageFrom: null,
    footfalls: 0,
  };
}

/** Eight directions, clockwise from east. */
export function facingIndex(angle) {
  return Math.round((((angle % TAU) + TAU) % TAU) / (TAU / 8)) % 8;
}

export function stepPlayerOnFoot(player, game, dt) {
  const control = game.control;
  const moveX = control.moveX;
  const moveY = control.moveY;
  const magnitude = Math.hypot(moveX, moveY);
  const sprinting = control.sprint && magnitude > 0.2;
  const top = sprinting ? PLAYER.sprint : magnitude > 0.55 ? PLAYER.run : PLAYER.walk;

  let wishX = 0;
  let wishY = 0;
  if (magnitude > 0.01) {
    wishX = (moveX / magnitude) * top;
    wishY = (moveY / magnitude) * top;
  }

  // Accelerate toward the wished velocity, then bleed it with friction.
  const accel = PLAYER.accel * dt;
  const deltaX = wishX - player.vx;
  const deltaY = wishY - player.vy;
  const deltaLength = Math.hypot(deltaX, deltaY);
  if (deltaLength > 0.001) {
    const step = Math.min(deltaLength, accel);
    player.vx += (deltaX / deltaLength) * step;
    player.vy += (deltaY / deltaLength) * step;
  }
  if (magnitude <= 0.01) {
    const speed = Math.hypot(player.vx, player.vy);
    const drop = PLAYER.friction * dt;
    const next = Math.max(0, speed - drop);
    if (speed > 0.001) {
      player.vx = (player.vx / speed) * next;
      player.vy = (player.vy / speed) * next;
    }
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Walls: buildings and heavy furniture. Two passes settle a corner.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const rect of game.city.solidsNear(player.x, player.y, PLAYER.radius + 4)) {
      if (!rect.kind || rect.kind === 'awning') continue;
      const fixed = resolveCircleRect(player.x, player.y, PLAYER.radius, rect);
      if (!fixed) continue;
      player.x = fixed.x;
      player.y = fixed.y;
    }
  }

  player.x = clamp(player.x, 30, game.city.width - 30);
  player.y = clamp(player.y, 30, game.city.height - 30);

  const speed = Math.hypot(player.vx, player.vy);
  player.moving = speed > 12;
  player.sprinting = sprinting && speed > PLAYER.run * 0.9;
  if (speed > 8) {
    player.angle = Math.atan2(player.vy, player.vx);
    player.facing = facingIndex(player.angle);
  }

  // Footstep bob: a sine the art leans on and a tick the audio plays.
  player.stepPhase += speed * dt * 0.055;
  if (player.stepPhase > player.footfalls + 1) {
    player.footfalls = Math.floor(player.stepPhase);
    if (game.audio) game.audio.footstep(sprinting);
    if (speed > 40) {
      game.particles.push({
        x: player.x - Math.cos(player.angle) * 6,
        y: player.y + 6,
        vx: (Math.random() - 0.5) * 20,
        vy: -8,
        life: 0.4,
        size: 2.4,
        color: 'rgba(210, 200, 180, 0.5)',
        drag: 4,
        glow: false,
      });
    }
  }

  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.knocked = Math.max(0, player.knocked - dt);
  if (player.knocked > 0) {
    player.vx *= Math.exp(-3 * dt);
    player.vy *= Math.exp(-3 * dt);
  }
}

/** Where the muzzle of the drawn weapon sits, in world space. */
export function playerMuzzle(player) {
  const reach = 18;
  return {
    x: player.x + Math.cos(player.angle) * reach,
    y: player.y + Math.sin(player.angle) * reach,
  };
}

export function damagePlayer(game, player, amount, source) {
  if (player.dead || player.invuln > 0) return false;
  let remaining = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, remaining * 0.7);
    player.armour -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  player.lastDamageFrom = source ?? null;
  game.camera.addShake(Math.min(9, amount * 0.5));
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

// Pedestrians: people walking the pavement around each block, crossing at the corners where the
// crosswalks are, fleeing when something frightening happens, and going down when a car or a
// bullet catches them. A few of them work for the wrong people and shoot back.

import { clamp, TAU, wrapAngle } from '../core/math2d.js';
import { fireWeapon, hasLineOfSight } from './combat.js';

const SHIRTS = ['#c95b4a', '#3f7f8c', '#d8b45c', '#6f8f56', '#8a5f9e', '#d07a3f', '#4f6f9e', '#b8474f', '#e0d7c3', '#5c6b7a'];
const PANTS = ['#3a4250', '#4d4438', '#2f3a44', '#5a5145', '#404a56', '#6b5b46'];
const SKINS = ['#e8b78f', '#c98f66', '#8d5f43', '#5f3f2e', '#f0c9a4', '#a9724c'];
const HAIRS = ['#2b2118', '#4a3524', '#6b4a2a', '#141414', '#8a6a44', '#b9b0a0'];

let nextPedId = 1;

export function blockCorners(block, inset = 16) {
  return [
    { x: block.x + inset, y: block.y + inset },
    { x: block.x + block.w - inset, y: block.y + inset },
    { x: block.x + block.w - inset, y: block.y + block.h - inset },
    { x: block.x + inset, y: block.y + block.h - inset },
  ];
}

export function createPedestrian(game, block, cornerIndex, direction) {
  const random = game.random;
  const corners = blockCorners(block);
  const start = corners[cornerIndex % 4];
  const ped = {
    id: nextPedId++,
    x: start.x + random.range(-4, 4),
    y: start.y + random.range(-4, 4),
    vx: 0,
    vy: 0,
    angle: random.range(0, TAU),
    block,
    corner: cornerIndex % 4,
    direction: direction ?? (random.chance(0.5) ? 1 : -1),
    state: 'walk',
    speed: random.range(38, 62),
    phase: random.range(0, TAU),
    health: 34,
    downTimer: 0,
    panic: 0,
    fireCooldown: 0,
    hostile: false,
    shirt: random.pick(SHIRTS),
    pants: random.pick(PANTS),
    skin: random.pick(SKINS),
    hair: random.pick(HAIRS),
    hat: random.chance(0.18),
    bag: random.chance(0.22),
    target: null,
    fleeAngle: random.range(0, TAU),
    fleeTimer: 0,
  };
  return ped;
}

/** Drop a pedestrian on a block near a point, on its pavement. */
export function spawnPedestrianNear(game, x, y) {
  const blocks = game.city.roads.blocks;
  let best = null;
  let bestGap = Infinity;
  for (const block of blocks) {
    const gap = Math.hypot(block.centerX - x, block.centerY - y);
    if (gap < bestGap) {
      bestGap = gap;
      best = block;
    }
  }
  if (!best) return null;
  const ped = createPedestrian(game, best, game.random.int(0, 3), game.random.chance(0.5) ? 1 : -1);
  game.peds.push(ped);
  return ped;
}

export function fillCrowd(game, count) {
  while (game.peds.length < count) {
    const block = game.random.pick(game.city.roads.blocks);
    game.peds.push(createPedestrian(game, block, game.random.int(0, 3), game.random.chance(0.5) ? 1 : -1));
  }
}

function nextCornerTarget(game, ped) {
  const block = ped.block;
  const corners = blockCorners(block);
  ped.corner = (ped.corner + ped.direction + 4) % 4;
  const target = corners[ped.corner];
  ped.target = { x: target.x, y: target.y, cross: false };
  ped.state = 'walk';
}

/** At a corner, sometimes step off the kerb and cross to the block opposite. */
function maybeCross(game, ped) {
  if (!game.random.chance(0.28)) return false;
  const roads = game.city.roads;
  const block = ped.block;
  const index = roads.blocks.indexOf(block);
  if (index < 0) return false;
  // Corner 0 is the north-west of the block, 2 the south-east: the crossing depends on which side.
  let targetBlock = null;
  if (ped.corner === 0) targetBlock = roads.blocks.find((b) => b.row === block.row - 1 && b.column === block.column);
  else if (ped.corner === 1) targetBlock = roads.blocks.find((b) => b.row === block.row - 1 && b.column === block.column);
  else if (ped.corner === 2) targetBlock = roads.blocks.find((b) => b.row === block.row + 1 && b.column === block.column);
  else targetBlock = roads.blocks.find((b) => b.row === block.row + 1 && b.column === block.column);
  if (!targetBlock) return false;
  const corners = blockCorners(targetBlock);
  const target = corners[ped.corner];
  ped.target = { x: target.x, y: target.y, cross: true, block: targetBlock };
  ped.state = 'cross';
  return true;
}

export function panicCrowd(game, x, y, radius, strength = 1) {
  for (const ped of game.peds) {
    if (ped.state === 'down' || ped.state === 'gone' || ped.hostile) continue;
    const gap = Math.hypot(ped.x - x, ped.y - y);
    if (gap > radius) continue;
    ped.panic = Math.max(ped.panic, 2.4 + strength * 1.6);
    ped.state = 'flee';
    ped.fleeAngle = Math.atan2(ped.y - y, ped.x - x) + (Math.random() - 0.5) * 0.6;
    ped.fleeTimer = 0;
  }
}

export function hurtPedestrian(game, ped, damage, angle, owner) {
  if (ped.state === 'gone') return;
  ped.health -= damage;
  ped.panic = 3;
  game.particles.burst(ped.x, ped.y, 4, {
    angle: angle ?? 0,
    spread: 1.2,
    speed: 90,
    life: 0.22,
    size: 1.8,
    color: '#e8e0d0',
    glow: false,
  });
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.downTimer = 5 + game.random.range(0, 3);
    ped.vx = Math.cos(angle ?? 0) * 40;
    ped.vy = Math.sin(angle ?? 0) * 40;
    if (owner === 'player') {
      game.reportCrime('kill', ped.x, ped.y);
      game.stats.pedsDowned += 1;
    }
  } else {
    ped.state = 'flee';
    ped.fleeAngle = (angle ?? 0) + Math.PI + (Math.random() - 0.5);
    ped.fleeTimer = 0;
  }
  panicCrowd(game, ped.x, ped.y, 190, 0.6);
}

export function stepPedestrians(game, dt) {
  const player = game.player;
  const playerX = player.inVehicle ? player.inVehicle.x : player.x;
  const playerY = player.inVehicle ? player.inVehicle.y : player.y;

  for (const ped of game.peds) {
    if (ped.state === 'gone') continue;

    // Recycle the ones that have wandered off, and the corpses after a while.
    if (Math.hypot(ped.x - playerX, ped.y - playerY) > 1500 && ped.state !== 'down') {
      const block = game.random.pick(game.city.roads.blocks);
      const corners = blockCorners(block);
      const corner = game.random.int(0, 3);
      ped.block = block;
      ped.corner = corner;
      ped.x = corners[corner].x;
      ped.y = corners[corner].y;
      ped.target = null;
      ped.state = 'walk';
      continue;
    }

    if (ped.state === 'down') {
      ped.downTimer -= dt;
      ped.vx *= Math.exp(-6 * dt);
      ped.vy *= Math.exp(-6 * dt);
      ped.x += ped.vx * dt;
      ped.y += ped.vy * dt;
      if (ped.downTimer <= 0) {
        if (ped.health <= 0) {
          ped.state = 'gone';
        } else {
          ped.state = 'walk';
          ped.target = null;
          ped.health = Math.max(12, ped.health);
        }
      }
      continue;
    }

    ped.phase += dt * (ped.state === 'flee' ? 9 : 4.4);
    ped.fireCooldown = Math.max(0, ped.fireCooldown - dt);

    let targetX = ped.target ? ped.target.x : ped.x;
    let targetY = ped.target ? ped.target.y : ped.y;
    let speed = ped.speed;

    if (ped.hostile) {
      const gap = Math.hypot(playerX - ped.x, playerY - ped.y);
      targetX = playerX;
      targetY = playerY;
      speed = gap > 180 ? 128 : 34;
      ped.angle = Math.atan2(playerY - ped.y, playerX - ped.x);
      if (gap < 330 && ped.fireCooldown <= 0 && hasLineOfSight(game.city, ped.x, ped.y, playerX, playerY)) {
        ped.fireCooldown = 1.15 + game.random.range(0, 0.5);
        fireWeapon(game, { x: ped.x, y: ped.y, angle: ped.angle, weaponId: 'pistol', owner: 'ped' });
      }
    } else if (ped.state === 'flee' || ped.panic > 0) {
      ped.panic = Math.max(0, ped.panic - dt);
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) {
        ped.fleeTimer = 0.7;
        ped.fleeAngle = Math.atan2(ped.y - playerY, ped.x - playerX) + (game.random.range(-0.5, 0.5));
      }
      const far = Math.hypot(ped.x - playerX, ped.y - playerY) > 520;
      if (ped.panic <= 0 && far) {
        ped.state = 'walk';
        ped.target = null;
      } else {
        speed = ped.speed * 2.15;
        targetX = ped.x + Math.cos(ped.fleeAngle) * 120;
        targetY = ped.y + Math.sin(ped.fleeAngle) * 120;
        ped.angle = ped.fleeAngle;
      }
    } else {
      if (!ped.target) nextCornerTarget(game, ped);
      targetX = ped.target.x;
      targetY = ped.target.y;
      const gap = Math.hypot(targetX - ped.x, targetY - ped.y);
      if (gap < 10) {
        if (ped.state === 'cross') {
          ped.block = ped.target.block;
          ped.state = 'walk';
          ped.target = null;
          ped.corner = (ped.corner + 2) % 4;
        } else if (!maybeCross(game, ped)) {
          nextCornerTarget(game, ped);
        }
      }
      if (ped.target) {
        ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      }
    }

    // Move, but never through a building.
    const toX = targetX - ped.x;
    const toY = targetY - ped.y;
    const gap = Math.hypot(toX, toY) || 1;
    if (gap > 4 && !ped.hostile) {
      ped.vx = (toX / gap) * speed;
      ped.vy = (toY / gap) * speed;
      ped.angle = Math.atan2(ped.vy, ped.vx);
    } else if (ped.hostile && gap > 4) {
      ped.vx = (toX / gap) * speed;
      ped.vy = (toY / gap) * speed;
    } else {
      ped.vx *= 0.8;
      ped.vy *= 0.8;
    }
    ped.x += ped.vx * dt;
    ped.y += ped.vy * dt;

    for (const rect of game.city.solidsNear(ped.x, ped.y, 12)) {
      if (rect.kind === 'awning') continue;
      if (ped.x > rect.x - 10 && ped.x < rect.x + rect.w + 10 && ped.y > rect.y - 10 && ped.y < rect.y + rect.h + 10) {
        ped.x -= ped.vx * dt * 1.4;
        ped.y -= ped.vy * dt * 1.4;
        if (!ped.hostile) ped.target = null;
        break;
      }
    }
    ped.x = clamp(ped.x, 40, game.city.width - 40);
    ped.y = clamp(ped.y, 40, game.city.height - 40);
  }

  // Keep the crowd dense around the player rather than spread over the whole map.
  let visible = 0;
  for (const ped of game.peds) {
    if (ped.state === 'gone') continue;
    if (Math.hypot(ped.x - playerX, ped.y - playerY) < 1400) visible += 1;
  }
  const target = game.crowdTarget ?? 54;
  if (visible < target) {
    for (let index = visible; index < target; index += 1) {
      spawnPedestrianNear(game, playerX + game.random.range(-700, 700), playerY + game.random.range(-500, 500));
    }
  }
  if (game.peds.length > 260) game.peds.splice(0, game.peds.length - 260);
}

export { wrapAngle };

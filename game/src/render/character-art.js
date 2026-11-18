// People, drawn small but readable from above: a shadow, swinging legs, a torso with shoulders,
// a head with hair and a hint of a face direction, and arms that carry whatever is in the hand.
// Pedestrians, officers and the player all come through here with different palettes.

import { TAU } from '../core/math2d.js';
import { roundedRectPath } from './vehicle-art.js';

function drawShadow(ctx, x, y, radius) {
  ctx.fillStyle = 'rgba(6, 10, 16, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, radius * 1.05, radius * 0.62, 0, 0, TAU);
  ctx.fill();
}

export function drawPerson(ctx, person, frame, palette, options = {}) {
  const scale = options.scale ?? 1;
  const phase = person.phase ?? person.walkPhase ?? person.stepPhase ?? 0;
  const speed = Math.hypot(person.vx ?? 0, person.vy ?? 0);
  const swing = Math.sin(phase * (speed > 150 ? 1.5 : 1)) * (speed > 6 ? 2.6 : 0.7);
  const down = options.down || person.state === 'down';

  ctx.save();
  ctx.translate(person.x, person.y);
  drawShadow(ctx, 0, 0, 9 * scale);
  ctx.rotate(person.angle ?? 0);
  ctx.scale(scale, scale);
  if (down) ctx.rotate(1.15);

  // Legs: two capsules behind the torso, alternating with the stride.
  ctx.fillStyle = palette.pants;
  roundedRectPath(ctx, -8 + swing, -5.4, 10, 4.6, 2.2);
  ctx.fill();
  roundedRectPath(ctx, -8 - swing, 0.8, 10, 4.6, 2.2);
  ctx.fill();
  // Shoes.
  ctx.fillStyle = palette.shoes ?? '#20242a';
  roundedRectPath(ctx, 0.6 + swing, -5.2, 3.4, 4.2, 1.6);
  ctx.fill();
  roundedRectPath(ctx, 0.6 - swing, 1, 3.4, 4.2, 1.6);
  ctx.fill();

  // Torso, shoulders across the facing direction.
  ctx.fillStyle = palette.shirt;
  roundedRectPath(ctx, -7.5, -6.6, 13, 13.2, 5.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  roundedRectPath(ctx, -6.6, -5.6, 7, 11.2, 4);
  ctx.fill();

  if (palette.stripe) {
    ctx.fillStyle = palette.stripe;
    ctx.fillRect(-7.5, -1.7, 13, 2.5);
  }

  if (palette.belt) {
    ctx.fillStyle = palette.belt;
    ctx.fillRect(-7.4, -6.4, 3.2, 12.8);
  }

  // Arms.
  ctx.fillStyle = palette.shirt;
  roundedRectPath(ctx, -1 + swing * 0.6, -9.4, 7, 4.2, 2);
  ctx.fill();
  roundedRectPath(ctx, -1 - swing * 0.6, 5.2, 7, 4.2, 2);
  ctx.fill();

  // Head.
  const headX = 3.4;
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(headX, 0, 5.1, 0, TAU);
  ctx.fill();
  // Hair, a cap or a hat: a crescent over the back of the head.
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.arc(headX - 0.8, 0, 4.9, Math.PI * 0.55, Math.PI * 1.45);
  ctx.fill();
  if (palette.hat) {
    ctx.fillStyle = palette.hat;
    ctx.beginPath();
    ctx.arc(headX + 0.4, 0, 5.3, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.fill();
    ctx.fillRect(headX + 3.6, -3.4, 2.6, 6.8);
  }
  // Face: a shade lighter toward the front, so you can read which way somebody looks.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.arc(headX + 1.4, 0, 2.6, 0, TAU);
  ctx.fill();

  if (options.bag) {
    ctx.fillStyle = palette.bag ?? '#4a3a2c';
    roundedRectPath(ctx, -5.5, 5.6, 6.4, 4.4, 1.6);
    ctx.fill();
  }

  if (options.armed && !down) {
    // A pistol held out along the aim, with the muzzle flash when it fires.
    ctx.fillStyle = '#1a1d22';
    roundedRectPath(ctx, 5.4, 3.2, 9.4, 3, 1.2);
    ctx.fill();
    ctx.fillStyle = '#2b3038';
    roundedRectPath(ctx, 4.4, 2.2, 4, 5, 1.4);
    ctx.fill();
    if ((person.muzzleFlash ?? 0) > 0) {
      ctx.fillStyle = 'rgba(255, 236, 170, 0.95)';
      ctx.beginPath();
      ctx.arc(15.5, 4.7, 3.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 200, 90, 0.5)';
      ctx.beginPath();
      ctx.arc(16, 4.7, 5.4, 0, TAU);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function drawPedestrian(ctx, ped, frame) {
  const down = ped.state === 'down' || ped.state === 'gone';
  drawPerson(
    ctx,
    ped,
    frame,
    {
      shirt: ped.shirt,
      pants: ped.pants,
      skin: ped.skin,
      hair: ped.hair,
      hat: ped.hat ? '#2f3338' : null,
      bag: ped.bag ? '#4a3a2c' : null,
    },
    { down, armed: ped.hostile, bag: ped.bag },
  );
}

export function drawOfficer(ctx, cop, frame) {
  drawPerson(
    ctx,
    cop,
    frame,
    {
      shirt: '#22375f',
      pants: '#161d2c',
      stripe: '#a9c8f2',
      skin: cop.skin ?? '#c99a74',
      hair: '#1a1a1e',
      hat: '#141b2b',
      belt: '#0f1520',
      shoes: '#101418',
    },
    { down: cop.state === 'down', armed: true },
  );
}

export function drawPlayerCharacter(ctx, player, frame) {
  if (player.dead) return;
  // A soft ring underfoot, so the eye finds the player in a crowd at a glance.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 232, 176, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 5, 13, 8.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawPerson(
    ctx,
    player,
    frame,
    {
      shirt: '#d8622c',
      pants: '#232e38',
      skin: '#d8a179',
      hair: '#241d18',
      shoes: '#1b1f24',
      belt: '#16202a',
    },
    {
      armed: player.weapon !== 'fists',
      scale: 1.14,
      down: player.knocked > 0 && player.knocked < 0.3,
    },
  );
}

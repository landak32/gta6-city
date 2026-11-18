// Cars, drawn from above with a hint of depth: a soft shadow on the asphalt, a body with a lit
// roof, glass, wheels that turn with the steering, headlights and tail lights, and the details
// that tell a taxi from a cruiser from a truck at a glance. Six silhouettes, one function.

import { clamp } from '../core/math2d.js';
import { rgba, shade } from './palette.js';

function rounded(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wheels(ctx, length, width, steer) {
  const wheelLength = 9;
  const wheelWidth = 5;
  ctx.fillStyle = '#15171c';
  for (const side of [-1, 1]) {
    rounded(ctx, -length * 0.34, side * (width / 2) - wheelWidth / 2, wheelLength, wheelWidth, 2);
    ctx.fill();
    ctx.save();
    ctx.translate(length * 0.32, side * (width / 2));
    ctx.rotate(steer * 0.5);
    rounded(ctx, -wheelLength / 2, -wheelWidth / 2, wheelLength, wheelWidth, 2);
    ctx.fill();
    ctx.restore();
  }
}

function glass(ctx, x, y, w, h, radius) {
  ctx.fillStyle = 'rgba(26, 42, 54, 0.92)';
  rounded(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 205, 220, 0.18)';
  rounded(ctx, x + 1, y + 1, w - 2, h * 0.42, radius * 0.7);
  ctx.fill();
}

export function drawVehicle(ctx, vehicle, frame) {
  const type = vehicle.type;
  const length = type.length;
  const width = type.width;
  const base = vehicle.colour;
  const wrecked = vehicle.wrecked;
  const body = base;
  const time = frame.time;

  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);

  // Shadow on the asphalt, offset with the sun and slightly stretched.
  ctx.save();
  ctx.translate(5, 8);
  ctx.rotate(vehicle.angle);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.34)';
  rounded(ctx, -length / 2, -width / 2, length, width, 7);
  ctx.fill();
  ctx.restore();

  ctx.rotate(vehicle.angle);

  wheels(ctx, length, width, vehicle.steer ?? 0);

  // Chassis.
  const gradient = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
  gradient.addColorStop(0, shade(body, wrecked ? -0.34 : 0.22));
  gradient.addColorStop(0.45, wrecked ? shade(body, -0.56) : body);
  gradient.addColorStop(1, shade(body, wrecked ? -0.72 : -0.3));
  ctx.fillStyle = gradient;
  rounded(ctx, -length / 2, -width / 2, length, width, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bonnet and boot shading.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  rounded(ctx, -length / 2 + 2, -width / 2 + 2, length * 0.3, width - 4, 4);
  ctx.fill();

  if (type.id === 'truck') {
    // Long cargo box behind a short cab.
    ctx.fillStyle = shade(body, -0.18);
    rounded(ctx, -length / 2 + 2, -width / 2 + 1, length * 0.62, width - 2, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    for (let rib = 0; rib < 5; rib += 1) {
      const x = -length / 2 + 6 + rib * (length * 0.58) / 5;
      ctx.beginPath();
      ctx.moveTo(x, -width / 2 + 2);
      ctx.lineTo(x, width / 2 - 2);
      ctx.stroke();
    }
    glass(ctx, length * 0.16, -width / 2 + 4, 10, width - 8, 2);
  } else if (type.id === 'van') {
    ctx.fillStyle = shade(body, -0.12);
    rounded(ctx, -length / 2 + 2, -width / 2 + 2, length * 0.58, width - 4, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    for (let rib = 0; rib < 3; rib += 1) {
      ctx.beginPath();
      ctx.moveTo(-length * 0.18 + rib * 8, -width / 2 + 3);
      ctx.lineTo(-length * 0.18 + rib * 8, width / 2 - 3);
      ctx.stroke();
    }
    glass(ctx, length * 0.2, -width / 2 + 5, 9, width - 10, 2);
  } else if (type.id === 'sport') {
    // Cabin pushed back, low nose, a wing at the tail.
    glass(ctx, -length * 0.16, -width / 2 + 4, 16, width - 8, 4);
    ctx.fillStyle = shade(body, -0.45);
    rounded(ctx, -length / 2 - 1, -width / 2 + 3, 4, width - 6, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    rounded(ctx, length * 0.05, -width / 2 + 3, length * 0.32, 2, 1);
    ctx.fill();
  } else {
    glass(ctx, -length * 0.2, -width / 2 + 4, 15, width - 8, 3);
    glass(ctx, length * 0.16, -width / 2 + 4, 9, width - 8, 3);
  }

  if (type.id === 'taxi') {
    // Roof sign and the chequer band down each flank.
    ctx.fillStyle = '#f6f2e4';
    rounded(ctx, -6, -6, 12, 12, 2);
    ctx.fill();
    ctx.fillStyle = '#20242a';
    ctx.fillRect(-5, -3.5, 10, 1.6);
    ctx.fillRect(-5, 0.4, 10, 1.6);
    ctx.fillStyle = 'rgba(20, 20, 24, 0.85)';
    for (let square = 0; square < 6; square += 1) {
      ctx.fillRect(-length / 2 + 10 + square * 5, -width / 2 + 1, 2.6, 2.6);
      ctx.fillRect(-length / 2 + 10 + square * 5, width / 2 - 3.6, 2.6, 2.6);
    }
  }

  if (type.id === 'police') {
    ctx.fillStyle = '#16233a';
    ctx.fillRect(-length / 2 + 3, -width / 2 + 3, length * 0.55, width - 6);
    ctx.fillStyle = '#f0f2f4';
    ctx.fillRect(-length / 2 + 3, -2.5, length * 0.55, 5);
    // Light bar: a full-width bar of red and blue pods flashing out of phase.
    const phase = Math.sin(time * 9 + (vehicle.sirenPhase ?? 0));
    const red = phase > 0 ? 1 : 0.3;
    const blue = phase > 0 ? 0.3 : 1;
    ctx.fillStyle = '#101018';
    rounded(ctx, -7.5, -width / 2 + 2, 15, width - 4, 2.5);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 54, 54, ${red})`;
    rounded(ctx, -6.5, -width / 2 + 3, 6.5, width - 6, 2);
    ctx.fill();
    ctx.fillStyle = `rgba(64, 128, 255, ${blue})`;
    rounded(ctx, 0, -width / 2 + 3, 6.5, width - 6, 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + 0.35 * Math.abs(phase)})`;
    ctx.fillRect(-1.6, -width / 2 + 3, 1.1, width - 6);
  }

  // Lights.
  ctx.fillStyle = wrecked ? 'rgba(90, 90, 90, 0.7)' : 'rgba(255, 244, 210, 0.95)';
  rounded(ctx, length / 2 - 3, -width / 2 + 3, 3, 5, 1.4);
  ctx.fill();
  rounded(ctx, length / 2 - 3, width / 2 - 8, 3, 5, 1.4);
  ctx.fill();
  const braking = vehicle.braking || vehicle.brakeLights;
  ctx.fillStyle = braking ? '#ff5a4a' : 'rgba(150, 34, 30, 0.9)';
  rounded(ctx, -length / 2, -width / 2 + 3, 3, 5, 1.4);
  ctx.fill();
  rounded(ctx, -length / 2, width / 2 - 8, 3, 5, 1.4);
  ctx.fill();

  // Damage: scorch marks that grow as the body gives up.
  const hurt = 1 - clamp(vehicle.health / vehicle.maxHealth, 0, 1);
  if (hurt > 0.45) {
    ctx.fillStyle = `rgba(18, 16, 15, ${clamp((hurt - 0.45) * 0.9, 0, 0.6)})`;
    rounded(ctx, -length * 0.1, -width * 0.3, length * 0.4, width * 0.5, 4);
    ctx.fill();
  }
  if (vehicle.ai === 'player') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    rounded(ctx, -length / 2 + 1, -width / 2 + 1, length - 2, width - 2, 6);
    ctx.stroke();
  }
  ctx.restore();
}

/** The glow the light bar throws on the road, drawn in the additive lighting pass. */
export function policeGlow(ctx, vehicle, time) {
  const phase = Math.sin(time * 9 + (vehicle.sirenPhase ?? 0));
  const colour = phase > 0 ? 'rgba(255, 70, 70,' : 'rgba(90, 150, 255,';
  const gradient = ctx.createRadialGradient(vehicle.x, vehicle.y, 4, vehicle.x, vehicle.y, 66);
  gradient.addColorStop(0, `${colour} 0.17)`);
  gradient.addColorStop(0.45, `${colour} 0.06)`);
  gradient.addColorStop(1, `${colour} 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(vehicle.x, vehicle.y, 66, 0, Math.PI * 2);
  ctx.fill();
}

export { rounded as roundedRectPath, rgba };

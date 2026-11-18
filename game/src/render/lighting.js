// Time of day, done as a lighting pass over the finished world: a blue multiply for night, a warm
// one for the hour before it, then every light in the city added back on top — lamp pools, the
// wedge of headlights, tail lights, and the red-and-blue wash off a cruiser's bar.

import { clamp } from '../core/math2d.js';
import { policeGlow } from './vehicle-art.js';

export function nightAmount(hour) {
  return clamp(0.5 + 0.5 * Math.cos((hour / 24) * Math.PI * 2), 0, 1);
}

export function sunsetAmount(hour) {
  const distance = Math.abs(hour - 18.4);
  return clamp(1 - distance / 2.2, 0, 1);
}

export function drawLighting(ctx, game, frame, view) {
  const night = frame.night;
  const sunset = frame.sunset;

  if (sunset > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(255, 158, 96, ${0.42 * sunset * (1 - night * 0.55)})`;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.restore();
  }

  if (night > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const gradient = ctx.createLinearGradient(view.x, view.y, view.x, view.y + view.h);
    gradient.addColorStop(0, `rgba(26, 34, 70, ${0.5 * night})`);
    gradient.addColorStop(1, `rgba(16, 22, 50, ${0.6 * night})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.restore();
  }

  if (night < 0.05 && sunset < 0.05) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Street lamps: warm pools under every post in view.
  for (const prop of game.city.props) {
    if (prop.kind !== 'lamp') continue;
    if (prop.x < view.x - 120 || prop.x > view.x + view.w + 120) continue;
    if (prop.y < view.y - 120 || prop.y > view.y + view.h + 120) continue;
    const strength = 0.035 + night * 0.085;
    const glow = ctx.createRadialGradient(prop.x, prop.y, 6, prop.x, prop.y, 78);
    glow.addColorStop(0, `rgba(255, 214, 150, ${strength})`);
    glow.addColorStop(0.5, `rgba(255, 190, 120, ${strength * 0.3})`);
    glow.addColorStop(1, 'rgba(255, 180, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 78, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vehicles: headlight wedges, tail lights, sirens.
  for (const vehicle of game.vehicles) {
    if (vehicle.x < view.x - 260 || vehicle.x > view.x + view.w + 260) continue;
    if (vehicle.y < view.y - 260 || vehicle.y > view.y + view.h + 260) continue;
    if (vehicle.isPolice && vehicle.siren) policeGlow(ctx, vehicle, frame.time);
    if (vehicle.wrecked) continue;

    const lit = 0.18 + night * 0.82;
    const beam = 120 + night * 70;
    const spread = 0.24 + night * 0.05;
    const noseX = vehicle.x + Math.cos(vehicle.angle) * 22;
    const noseY = vehicle.y + Math.sin(vehicle.angle) * 22;
    const light = ctx.createRadialGradient(noseX, noseY, 6, noseX, noseY, beam);
    light.addColorStop(0, `rgba(255, 240, 200, ${(0.01 + night * 0.045) * lit})`);
    light.addColorStop(0.55, `rgba(255, 236, 190, ${(0.006 + night * 0.03) * lit})`);
    light.addColorStop(1, 'rgba(255, 230, 180, 0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(noseX, noseY);
    ctx.arc(noseX, noseY, beam, vehicle.angle - spread, vehicle.angle + spread);
    ctx.closePath();
    ctx.fill();

    const tail = ctx.createRadialGradient(vehicle.x, vehicle.y, 2, vehicle.x, vehicle.y, 34);
    tail.addColorStop(0, 'rgba(255, 70, 50, 0.16)');
    tail.addColorStop(1, 'rgba(255, 60, 40, 0)');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.arc(vehicle.x - Math.cos(vehicle.angle) * 22, vehicle.y - Math.sin(vehicle.angle) * 22, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Muzzle flashes and explosions read as light, not as sprites. Kept deliberately faint: a burst
  // spawns several overlapping glows, and additive blending saturates to flat white past ~0.15 each.
  for (const particle of game.particles.items) {
    if (!particle.glow) continue;
    const fade = 1 - particle.age / particle.life;
    const radius = 18 + fade * 6;
    const glow = ctx.createRadialGradient(particle.x, particle.y, 1, particle.x, particle.y, radius);
    glow.addColorStop(0, `rgba(255, 214, 150, ${0.07 * fade})`);
    glow.addColorStop(0.45, `rgba(255, 190, 110, ${0.035 * fade})`);
    glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

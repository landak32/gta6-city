// The transient layer: tyre marks fading on the asphalt, sparks and smoke, and the bright
// tracers of bullets in flight. All of it additive where it should glow, none of it on the HUD.

import { TAU } from '../core/math2d.js';

export function drawTrails(ctx, trails) {
  for (const mark of trails.items) {
    const fade = 1 - mark.age / mark.life;
    ctx.save();
    ctx.translate(mark.x, mark.y);
    ctx.rotate(mark.angle);
    ctx.fillStyle = `rgba(18, 16, 15, ${0.32 * fade * (mark.alpha ?? 1)})`;
    ctx.fillRect(-4, -(mark.width ?? 3) / 2, 8, mark.width ?? 3);
    ctx.restore();
  }
}

export function drawParticles(ctx, particles) {
  ctx.save();
  for (const particle of particles.items) {
    const fade = 1 - particle.age / particle.life;
    if (particle.kind === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(58, 56, 54, ${0.34 * fade})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 + (1 - fade) * 1.6), 0, TAU);
      ctx.fill();
      continue;
    }
    if (particle.kind === 'dust') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(198, 186, 160, ${0.3 * fade})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 + (1 - fade)), 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.globalCompositeOperation = particle.glow ? 'lighter' : 'source-over';
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, fade);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * (0.4 + fade * 0.8), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const bullet of bullets) {
    const tailX = bullet.x - bullet.vx * 0.022;
    const tailY = bullet.y - bullet.vy * 0.022;
    const gradient = ctx.createLinearGradient(tailX, tailY, bullet.x, bullet.y);
    gradient.addColorStop(0, 'rgba(255, 190, 90, 0)');
    gradient.addColorStop(1, 'rgba(255, 244, 190, 0.95)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 252, 226, 1)';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A puff of smoke from a wrecked engine, called by the simulation each step. */
export function drawWreckSmoke(ctx, vehicles, time) {
  for (const vehicle of vehicles) {
    if (!vehicle.wrecked) continue;
    const pulse = (Math.sin(time * 2.4 + vehicle.id) + 1) * 0.5;
    ctx.fillStyle = `rgba(40, 38, 36, ${0.18 + pulse * 0.16})`;
    ctx.beginPath();
    ctx.arc(vehicle.x - 4, vehicle.y - 6 - pulse * 8, 12 + pulse * 8, 0, TAU);
    ctx.fill();
  }
}

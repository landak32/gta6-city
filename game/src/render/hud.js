// The heads-up display: health and armour over the minimap, money and the wanted stars in the
// opposite corner, the weapon in hand, the current objective, and short toasts for everything
// that just happened. Drawn in screen space, after the world, in one flat pass.

import { clamp, TAU } from '../core/math2d.js';
import { districtAt, districtLabel } from '../world/districts.js';
import { drawMinimap } from './minimap.js';
import { WEAPONS } from '../world/combat.js';
import { MISSIONS } from '../world/missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function panel(ctx, x, y, w, h, radius = 8, fill = 'rgba(10, 16, 20, 0.72)') {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function bar(ctx, x, y, w, h, ratio, colour, back = 'rgba(0, 0, 0, 0.55)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, w * clamp(ratio, 0, 1)), h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function star(ctx, cx, cy, radius, filled, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const r = point % 2 === 0 ? radius : radius * 0.45;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = filled ? '#ffcb52' : 'rgba(20, 26, 32, 0.75)';
  ctx.fill();
  ctx.strokeStyle = filled ? 'rgba(90, 60, 10, 0.9)' : 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function money(value) {
  return `$${Math.max(0, Math.round(value)).toLocaleString('en-US')}`;
}

export function drawHud(ctx, game, frame) {
  const player = game.player;
  const width = frame.width;
  const height = frame.height;

  // ---- Objective, top left ------------------------------------------------------------
  const district = districtAt(player.x, player.y, game.city);
  panel(ctx, 24, 22, 420, 62, 8);
  ctx.fillStyle = '#ffc44a';
  ctx.fillRect(24, 22, 4, 62);
  ctx.fillStyle = 'rgba(255, 196, 74, 0.9)';
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('OBJECTIVE', 40, 40);
  ctx.fillStyle = '#f2f6f9';
  ctx.font = `600 15px ${FONT}`;
  const objective = game.objective ?? 'Free roam';
  ctx.fillText(objective.length > 46 ? `${objective.slice(0, 44)}…` : objective, 40, 60);
  ctx.fillStyle = 'rgba(198, 214, 224, 0.65)';
  ctx.font = `500 11px ${FONT}`;
  ctx.fillText(districtLabel(district), 40, 76);

  // ---- Money, clock and wanted stars, top right ----------------------------------------
  const cashNow = game.money;
  ctx.textAlign = 'right';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = 'rgba(6, 10, 14, 0.75)';
  ctx.fillText(money(cashNow), width - 23, 47);
  ctx.fillStyle = '#c8f0a8';
  ctx.fillText(money(cashNow), width - 24, 46);

  ctx.font = `500 11px ${FONT}`;
  ctx.fillStyle = 'rgba(226, 236, 242, 0.6)';
  ctx.fillText(clockLabel(game.clock), width - 24, 64);

  const level = game.wanted.level;
  for (let index = 0; index < 5; index += 1) {
    const cx = width - 32 - index * 26;
    const flash = level > 0 ? 0.55 + Math.sin(frame.time * 7 - index) * 0.45 : 1;
    star(ctx, cx, 88, 10, index < level, index < level ? flash : 0.55);
  }

  // ---- Weapon and ammo, under the stars -------------------------------------------------
  const weapon = WEAPONS[player.weapon] ?? WEAPONS.fists;
  ctx.textAlign = 'right';
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = 'rgba(226, 236, 242, 0.9)';
  const rounds = weapon.melee ? null : (player.ammo[player.weapon] ?? 0);
  const ammoText = weapon.melee ? 'FISTS' : `${rounds} / ${weapon.ammoMax}`;
  ctx.fillText(weapon.name.toUpperCase(), width - 24, 128);
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = rounds === 0 ? '#ff6b5c' : 'rgba(198, 214, 224, 0.72)';
  ctx.fillText(ammoText, width - 24, 146);

  // ---- Health, armour and the minimap, bottom left ---------------------------------------
  const mapX = 118;
  const mapY = height - 118;
  const mapRadius = 84;
  drawMinimap(ctx, game, frame, mapX, mapY, mapRadius);

  const healthRatio = player.health / 100;
  const armourRatio = player.armour / 100;
  bar(ctx, mapX - mapRadius, mapY - mapRadius - 40, 168, 9, healthRatio, healthRatio > 0.35 ? '#5ad07a' : '#e8534a');
  bar(ctx, mapX - mapRadius, mapY - mapRadius - 26, 168, 7, armourRatio, '#5aa8e8');
  ctx.textAlign = 'left';
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = 'rgba(226, 236, 242, 0.65)';
  ctx.fillText('HEALTH', mapX - mapRadius, mapY - mapRadius - 46);
  ctx.fillText('ARMOUR', mapX - mapRadius + 86, mapY - mapRadius - 46);

  // ---- Toasts, right side ---------------------------------------------------------------
  ctx.textAlign = 'right';
  let toastY = 178;
  for (let index = game.toasts.length - 1; index >= 0; index -= 1) {
    const toast = game.toasts[index];
    const fade = clamp(1 - (toast.age - toast.life + 0.6) / 0.6, 0, 1);
    ctx.globalAlpha = fade;
    ctx.font = `600 13px ${FONT}`;
    const textWidth = ctx.measureText(toast.text).width;
    panel(ctx, width - 24 - textWidth - 24, toastY - 16, textWidth + 24, 26, 6, 'rgba(10, 16, 20, 0.78)');
    ctx.fillStyle = toast.tone === 'bad' ? '#ff8a7a' : toast.tone === 'good' ? '#9ce8a8' : '#e8f2f8';
    ctx.fillText(toast.text, width - 36, toastY + 1);
    ctx.globalAlpha = 1;
    toastY += 32;
  }

  // ---- Low health: a red vignette that tightens as the bar empties -----------------------
  if (healthRatio < 0.62) {
    const strength = (0.62 - healthRatio) / 0.62;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.78);
    gradient.addColorStop(0, 'rgba(160, 20, 20, 0)');
    gradient.addColorStop(1, `rgba(168, 14, 14, ${0.9 * strength})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // ---- Wanted level flash on the whole screen -------------------------------------------
  if (level > 0) {
    const pulse = (Math.sin(frame.time * 4) + 1) * 0.5;
    ctx.fillStyle = `rgba(90, 130, 255, ${0.05 + pulse * 0.03})`;
    ctx.fillRect(0, 0, width, 4);
    ctx.fillStyle = `rgba(255, 70, 60, ${0.05 + (1 - pulse) * 0.03})`;
    ctx.fillRect(0, height - 4, width, 4);
  }

  ctx.textAlign = 'left';
}

function clockLabel(clock) {
  const hours = Math.floor(clock.hour) % 24;
  const minutes = Math.floor((clock.hour % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export { TAU };

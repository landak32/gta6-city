// Dialogue: a box along the bottom with a portrait drawn from the speaker's name, a typewriter
// reveal and a prompt when the line is finished. The portrait is all shapes — hair, brow, eyes,
// nose, mouth, collar — so every character in the story has a face without a single image file.

import { clamp, TAU } from '../core/math2d.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function hashName(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

const SKINS = ['#e2b48c', '#c98f68', '#9a6440', '#6f452c', '#f0cba6'];
const HAIRS = ['#221b16', '#3b2a1e', '#6b4a2a', '#141414', '#8c8c8c', '#a33a2a'];
const SHIRTS = ['#2f5f6f', '#5a3b52', '#3d4b2c', '#7a4a2c', '#2a2f3a', '#6d2f2f'];

/** A face assembled from the speaker's name, so it is the same face every time they speak. */
export function drawPortrait(ctx, name, x, y, size) {
  const hash = hashName(name);
  const skin = SKINS[hash % SKINS.length];
  const hair = HAIRS[(hash >> 3) % HAIRS.length];
  const shirt = SHIRTS[(hash >> 7) % SHIRTS.length];
  const hasBeard = (hash >> 11) % 3 === 0;
  const hasGlasses = (hash >> 13) % 4 === 0;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();

  // Backdrop.
  const backdrop = ctx.createLinearGradient(x, y, x, y + size);
  backdrop.addColorStop(0, '#22303c');
  backdrop.addColorStop(1, '#141c24');
  ctx.fillStyle = backdrop;
  ctx.fillRect(x, y, size, size);

  const cx = x + size / 2;
  const headR = size * 0.3;

  // Shoulders.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 1.06, size * 0.46, size * 0.3, 0, 0, TAU);
  ctx.fill();

  // Neck.
  ctx.fillStyle = skin;
  ctx.fillRect(cx - size * 0.08, y + size * 0.62, size * 0.16, size * 0.2);

  // Head.
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 0.46, headR, headR * 1.16, 0, 0, TAU);
  ctx.fill();

  // Hair.
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 0.32, headR * 1.02, headR * 0.78, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillRect(cx - headR * 1.02, y + size * 0.3, headR * 0.26, headR * 0.8);

  // Brows, eyes, nose, mouth.
  ctx.fillStyle = hair;
  ctx.fillRect(cx - headR * 0.62, y + size * 0.42, headR * 0.44, 2.2);
  ctx.fillRect(cx + headR * 0.18, y + size * 0.42, headR * 0.44, 2.2);
  ctx.fillStyle = '#1a1a1e';
  ctx.beginPath();
  ctx.arc(cx - headR * 0.36, y + size * 0.5, size * 0.028, 0, TAU);
  ctx.arc(cx + headR * 0.36, y + size * 0.5, size * 0.028, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.fillRect(cx - 1, y + size * 0.52, 2, size * 0.08);
  ctx.strokeStyle = 'rgba(60, 24, 24, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.3, y + size * 0.63);
  ctx.quadraticCurveTo(cx, y + size * 0.67, cx + headR * 0.3, y + size * 0.63);
  ctx.stroke();

  if (hasBeard) {
    ctx.fillStyle = hair;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, y + size * 0.66, headR * 0.62, headR * 0.34, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (hasGlasses) {
    ctx.strokeStyle = 'rgba(20, 24, 28, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - headR * 0.62, y + size * 0.46, headR * 0.52, headR * 0.24);
    ctx.strokeRect(cx + headR * 0.1, y + size * 0.46, headR * 0.52, headR * 0.24);
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.1, y + size * 0.5);
    ctx.lineTo(cx + headR * 0.1, y + size * 0.5);
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 196, 74, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, size - 1.5, size - 1.5);
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawDialogue(ctx, game, frame) {
  const line = game.dialogue.line;
  if (!line) return;
  const width = frame.width;
  const height = frame.height;
  const boxW = 860;
  const boxH = 148;
  const boxX = (width - boxW) / 2;
  const boxY = height - boxH - 26;
  const portraitSize = 108;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 18, 0.9)';
  ctx.beginPath();
  ctx.moveTo(boxX + 10, boxY);
  ctx.lineTo(boxX + boxW - 10, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + 10);
  ctx.lineTo(boxX + boxW, boxY + boxH - 10);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - 10, boxY + boxH);
  ctx.lineTo(boxX + 10, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - 10);
  ctx.lineTo(boxX, boxY + 10);
  ctx.quadraticCurveTo(boxX, boxY, boxX + 10, boxY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 196, 74, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawPortrait(ctx, line.speaker ?? 'Unknown', boxX + 20, boxY + 20, portraitSize);

  const textX = boxX + 20 + portraitSize + 22;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffc44a';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText((line.speaker ?? '').toUpperCase(), textX, boxY + 38);

  const revealed = (line.text ?? '').slice(0, Math.floor((line.age ?? 0) * 52));
  ctx.fillStyle = '#eef4f8';
  ctx.font = `400 16px ${FONT}`;
  const lines = wrap(ctx, revealed, boxW - (textX - boxX) - 44);
  lines.slice(0, 3).forEach((text, index) => {
    ctx.fillText(text, textX, boxY + 64 + index * 24);
  });

  const complete = revealed.length >= (line.text ?? '').length;
  if (complete) {
    const bounce = Math.sin(frame.time * 6) * 2;
    ctx.fillStyle = 'rgba(255, 196, 74, 0.9)';
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - 34, boxY + boxH - 26 + bounce);
    ctx.lineTo(boxX + boxW - 22, boxY + boxH - 26 + bounce);
    ctx.lineTo(boxX + boxW - 28, boxY + boxH - 18 + bounce);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(226, 236, 242, 0.5)';
    ctx.font = `500 10px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('SPACE', boxX + boxW - 44, boxY + boxH - 19 + bounce);
  }
  ctx.restore();
}

export { clamp };

// Menus and end screens: the title card, the pause menu, the controls sheet, the stats page and
// the two ways a run ends. Same system font, same amber accent, all of it drawn on the canvas.

import { TAU } from '../core/math2d.js';
import { MISSIONS } from '../world/missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function dim(ctx, width, height, alpha = 0.72) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `rgba(6, 11, 16, ${alpha * 0.86})`);
  gradient.addColorStop(0.55, `rgba(6, 11, 16, ${alpha})`);
  gradient.addColorStop(1, `rgba(3, 6, 9, ${Math.min(1, alpha * 1.15)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function rule(ctx, x, y, width) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, 'rgba(255, 196, 74, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 196, 74, 0.75)');
  gradient.addColorStop(1, 'rgba(255, 196, 74, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, 1.5);
}

function menu(ctx, items, index, x, y, gap) {
  ctx.textAlign = 'center';
  items.forEach((item, position) => {
    const selected = position === index;
    const itemY = y + position * gap;
    if (selected) {
      ctx.fillStyle = 'rgba(255, 196, 74, 0.12)';
      ctx.fillRect(x - 150, itemY - 20, 300, 34);
      ctx.fillStyle = '#ffc44a';
      ctx.fillRect(x - 150, itemY - 20, 3, 34);
    }
    ctx.font = `${selected ? 700 : 500} ${selected ? 21 : 19}px ${FONT}`;
    ctx.fillStyle = selected ? '#fff6e2' : 'rgba(214, 228, 236, 0.62)';
    ctx.fillText(item, x, itemY);
  });
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, ui, frame) {
  const width = frame.width;
  const height = frame.height;
  dim(ctx, width, height, 0.62);

  const centre = width / 2;
  ctx.textAlign = 'center';

  // The name, with a warm gradient and a long shadow.
  ctx.save();
  ctx.font = `800 86px ${FONT}`;
  ctx.letterSpacing = '10px';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillText('VICE HARBOR', centre + 4, 214);
  const title = ctx.createLinearGradient(centre - 300, 140, centre + 300, 210);
  title.addColorStop(0, '#ffd479');
  title.addColorStop(0.5, '#fff3d6');
  title.addColorStop(1, '#ff8f5e');
  ctx.fillStyle = title;
  ctx.fillText('VICE HARBOR', centre, 210);
  ctx.letterSpacing = '0px';
  ctx.restore();

  rule(ctx, centre - 260, 236, 520);

  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = 'rgba(222, 234, 242, 0.72)';
  ctx.fillText('Six districts. One stolen car. Every light in the city drawn by hand.', centre, 268);
  ctx.fillStyle = 'rgba(255, 196, 74, 0.85)';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME STORY', centre, 292);

  menu(ctx, ui.items, ui.index, centre, 372, 46);

  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = 'rgba(214, 228, 236, 0.42)';
  ctx.fillText('↑ ↓ choose      ENTER select', centre, height - 74);
  ctx.fillStyle = 'rgba(214, 228, 236, 0.28)';
  ctx.fillText('Runs from static files · no network · no external assets', centre, height - 48);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, ui, frame) {
  const width = frame.width;
  const height = frame.height;
  dim(ctx, width, height, 0.7);
  const centre = width / 2;
  ctx.textAlign = 'center';
  ctx.font = `800 44px ${FONT}`;
  ctx.letterSpacing = '6px';
  ctx.fillStyle = '#f2f6f9';
  ctx.fillText('PAUSED', centre, 190);
  ctx.letterSpacing = '0px';
  rule(ctx, centre - 150, 212, 300);
  menu(ctx, ui.items, ui.index, centre, 290, 48);
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = 'rgba(214, 228, 236, 0.42)';
  ctx.fillText('ESC resume', centre, height - 60);
  ctx.textAlign = 'left';
}

const CONTROL_ROWS = [
  ['W A S D', 'walk · drive'],
  ['SHIFT', 'sprint on foot'],
  ['E', 'enter or leave a car'],
  ['Q / wheel', 'change weapon'],
  ['MOUSE / CLICK', 'aim and fire'],
  ['SPACE', 'handbrake · skip dialogue'],
  ['TAB', 'stats'],
  ['ESC', 'pause'],
];

export function drawControls(ctx, frame) {
  const width = frame.width;
  const height = frame.height;
  dim(ctx, width, height, 0.82);
  const centre = width / 2;
  ctx.textAlign = 'center';
  ctx.font = `800 34px ${FONT}`;
  ctx.letterSpacing = '5px';
  ctx.fillStyle = '#f2f6f9';
  ctx.fillText('CONTROLS', centre, 150);
  ctx.letterSpacing = '0px';
  rule(ctx, centre - 180, 170, 360);

  ctx.textAlign = 'left';
  const left = centre - 250;
  CONTROL_ROWS.forEach(([key, action], index) => {
    const y = 236 + index * 42;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = '#ffc44a';
    ctx.fillText(key, left, y);
    ctx.font = `400 15px ${FONT}`;
    ctx.fillStyle = 'rgba(228, 238, 244, 0.82)';
    ctx.fillText(action, left + 200, y);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(left, y + 14, 420, 1);
  });

  ctx.textAlign = 'center';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = 'rgba(214, 228, 236, 0.45)';
  ctx.fillText('ESC or ENTER to go back', centre, height - 56);
  ctx.textAlign = 'left';
}

export function drawStats(ctx, game, frame) {
  const width = frame.width;
  const height = frame.height;
  dim(ctx, width, height, 0.85);
  const centre = width / 2;
  ctx.textAlign = 'center';
  ctx.font = `800 34px ${FONT}`;
  ctx.letterSpacing = '5px';
  ctx.fillStyle = '#f2f6f9';
  ctx.fillText('STATISTICS', centre, 150);
  ctx.letterSpacing = '0px';
  rule(ctx, centre - 180, 170, 360);

  const stats = game.stats;
  const rows = [
    ['Money', `$${game.money.toLocaleString('en-US')}`],
    ['Missions passed', `${game.mission.index} / ${MISSIONS.length}`],
    ['Distance on foot', `${(stats.distanceWalked / 1000).toFixed(2)} km`],
    ['Distance driven', `${(stats.distanceDriven / 1000).toFixed(2)} km`],
    ['Cars stolen', String(stats.carsStolen)],
    ['Shots fired', String(stats.shotsFired)],
    ['Pedestrians downed', String(stats.pedsDowned ?? 0)],
    ['Officers down', String(stats.copsDowned ?? 0)],
    ['Times arrested', String(stats.arrests ?? 0)],
    ['Times hospitalised', String(stats.deaths ?? 0)],
  ];

  ctx.textAlign = 'left';
  const left = centre - 230;
  rows.forEach(([label, value], index) => {
    const y = 226 + index * 34;
    ctx.font = `400 14px ${FONT}`;
    ctx.fillStyle = 'rgba(214, 228, 236, 0.68)';
    ctx.fillText(label, left, y);
    ctx.textAlign = 'right';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = '#f2f6f9';
    ctx.fillText(value, left + 460, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(left, y + 10, 460, 1);
  });

  ctx.textAlign = 'center';
  ctx.font = `500 12px ${FONT}`;
  ctx.fillStyle = 'rgba(214, 228, 236, 0.45)';
  ctx.fillText('ESC to go back', centre, height - 50);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, game, frame, mode, cost) {
  const width = frame.width;
  const height = frame.height;
  const dead = mode === 'dead';
  const pulse = 0.72 + Math.sin(frame.time * 2.4) * 0.1;
  ctx.fillStyle = dead ? `rgba(70, 8, 8, ${0.55 * pulse})` : `rgba(8, 20, 60, ${0.55 * pulse})`;
  ctx.fillRect(0, 0, width, height);
  dim(ctx, width, height, 0.45);

  const centre = width / 2;
  ctx.textAlign = 'center';
  ctx.font = `800 78px ${FONT}`;
  ctx.letterSpacing = '12px';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(dead ? 'WASTED' : 'BUSTED', centre + 3, 313);
  ctx.fillStyle = dead ? '#e8443a' : '#5c8dff';
  ctx.fillText(dead ? 'WASTED' : 'BUSTED', centre, 310);
  ctx.letterSpacing = '0px';

  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = 'rgba(240, 244, 248, 0.86)';
  ctx.fillText(
    dead ? 'You wake up in St. Brigid Hospital.' : 'You wake up in a cell at the Fifth Precinct.',
    centre,
    360,
  );
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = '#ff9a8a';
  ctx.fillText(`Hospital bill  −$${cost.toLocaleString('en-US')}`, centre, 398);

  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = 'rgba(226, 236, 242, 0.6)';
  ctx.fillText('ENTER to get back out there', centre, 470);
  ctx.textAlign = 'left';
}

export { TAU };

// The minimap: a circular window on the real city, drawn from the same road network and shoreline
// the world uses. Roads, sand, sea, the mission marker, police blips and the player's arrow.

import { TAU } from '../core/math2d.js';

const SCALE = 0.058;

export function drawMinimap(ctx, game, frame, centreX, centreY, radius) {
  const city = game.city;
  const roads = city.roads;
  const player = game.player;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius, 0, TAU);
  ctx.clip();

  ctx.fillStyle = '#0d161c';
  ctx.fillRect(centreX - radius, centreY - radius, radius * 2, radius * 2);

  const mapX = (x) => centreX + (x - player.x) * SCALE;
  const mapY = (y) => centreY + (y - player.y) * SCALE;

  // Sea, then the sand strip along it.
  ctx.fillStyle = '#173a4d';
  ctx.beginPath();
  ctx.moveTo(centreX - radius, centreY - radius);
  for (let x = player.x - radius / SCALE; x <= player.x + radius / SCALE; x += 30) {
    ctx.lineTo(mapX(x), mapY(city.water.edgeAt(x)));
  }
  ctx.lineTo(centreX + radius, centreY + radius);
  ctx.lineTo(centreX - radius, centreY + radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#3d3a30';
  ctx.beginPath();
  ctx.moveTo(centreX - radius, mapY(city.water.shoreY));
  for (let x = player.x - radius / SCALE; x <= player.x + radius / SCALE; x += 30) {
    ctx.lineTo(mapX(x), mapY(city.water.shoreY));
  }
  ctx.lineTo(centreX + radius, mapY(city.water.edgeAt(player.x)));
  ctx.lineTo(centreX - radius, mapY(city.water.edgeAt(player.x)));
  ctx.closePath();
  ctx.fill();

  // City blocks.
  ctx.fillStyle = '#1b242b';
  for (const block of roads.blocks) {
    const x = mapX(block.x);
    const y = mapY(block.y);
    const w = block.w * SCALE;
    const h = block.h * SCALE;
    if (x + w < centreX - radius || x > centreX + radius) continue;
    if (y + h < centreY - radius || y > centreY + radius) continue;
    ctx.fillRect(x, y, w, h);
  }

  // Roads.
  ctx.strokeStyle = '#4b5862';
  ctx.lineWidth = Math.max(2, roads.road * SCALE);
  ctx.lineCap = 'butt';
  for (let column = 0; column < roads.cols; column += 1) {
    const x = mapX(roads.roadX(column));
    ctx.beginPath();
    ctx.moveTo(x, centreY - radius);
    ctx.lineTo(x, centreY + radius);
    ctx.stroke();
  }
  for (let row = 0; row < roads.rows; row += 1) {
    const y = mapY(roads.roadY(row));
    ctx.beginPath();
    ctx.moveTo(centreX - radius, y);
    ctx.lineTo(centreX + radius, y);
    ctx.stroke();
  }

  // The mission marker, ringed so it reads at a glance.
  const marker = game.marker;
  if (marker) {
    const x = mapX(marker.x);
    const y = mapY(marker.y);
    const pulse = 4 + Math.sin(frame.time * 5) * 1.6;
    ctx.fillStyle = 'rgba(255, 196, 74, 0.28)';
    ctx.beginPath();
    ctx.arc(x, y, pulse + 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffc44a';
    ctx.beginPath();
    ctx.moveTo(x, y - pulse);
    ctx.lineTo(x + pulse, y);
    ctx.lineTo(x, y + pulse);
    ctx.lineTo(x - pulse, y);
    ctx.closePath();
    ctx.fill();
  }

  // Police: flashing dots, brighter the closer they are.
  for (const car of game.vehicles) {
    if (car.ai !== 'police') continue;
    const x = mapX(car.x);
    const y = mapY(car.y);
    const flash = Math.sin(frame.time * 9 + (car.sirenPhase ?? 0)) > 0;
    ctx.fillStyle = flash ? '#ff5a52' : '#5c8dff';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, TAU);
    ctx.fill();
  }
  for (const officer of game.cops) {
    if (officer.health <= 0) continue;
    ctx.fillStyle = 'rgba(120, 170, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(mapX(officer.x), mapY(officer.y), 2.2, 0, TAU);
    ctx.fill();
  }

  // Player arrow at the centre, pointing where they face.
  const angle = player.inVehicle && player.vehicle ? player.vehicle.angle : player.angle;
  ctx.save();
  ctx.translate(centreX, centreY);
  ctx.rotate(angle);
  ctx.fillStyle = '#f4f7fa';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, 4.6);
  ctx.lineTo(-2.4, 0);
  ctx.lineTo(-5, -4.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // Frame and a north tick.
  ctx.save();
  ctx.strokeStyle = 'rgba(12, 18, 22, 0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(236, 244, 248, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius - 2, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(236, 244, 248, 0.8)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', centreX, centreY - radius + 13);
  ctx.restore();
}

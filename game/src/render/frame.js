// The frame composer: apply the camera, lay down the city in layers, then everything that moves
// sorted by depth, then the lighting pass. The HUD and the menus are drawn afterwards in screen
// space by hud.js and screens.js, so nothing here knows about UI.

import { TAU } from '../core/math2d.js';
import {
  drawGroundAndWater,
  drawRoadGrid,
  drawBlockPaving,
  drawBuildings,
  drawProps,
} from './city-art.js';
import { drawVehicle } from './vehicle-art.js';
import { drawPedestrian, drawOfficer, drawPlayerCharacter } from './character-art.js';
import { drawTrails, drawParticles, drawBullets, drawWreckSmoke } from './effects-art.js';
import { drawLighting } from './lighting.js';

function drawObjectiveMarker(ctx, marker, time) {
  const pulse = 0.6 + Math.sin(time * 3) * 0.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const beam = ctx.createRadialGradient(marker.x, marker.y, 4, marker.x, marker.y, 52);
  beam.addColorStop(0, `rgba(255, 196, 74, ${0.2 * pulse})`);
  beam.addColorStop(0.6, `rgba(255, 168, 40, ${0.07 * pulse})`);
  beam.addColorStop(1, 'rgba(255, 150, 20, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 52, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.strokeStyle = `rgba(255, 210, 110, ${0.55 + pulse * 0.35})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26 + pulse * 6, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 196, 74, 0.22)';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9, 0);
  ctx.lineTo(0, 11);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderWorld(ctx, game, camera, frame) {
  const width = frame.width;
  const height = frame.height;
  const view = camera.viewRect(180);
  const centre = camera.drawnCentre();

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(camera.state.zoom, camera.state.zoom);
  ctx.translate(-centre.x, -centre.y);

  drawGroundAndWater(ctx, game.city, view, frame);
  drawRoadGrid(ctx, game.city, view, frame);
  drawBlockPaving(ctx, game.city, view);
  drawTrails(ctx, game.trails);
  drawBuildings(ctx, game.city, view, frame);
  drawProps(ctx, game.city, view, frame);
  drawWreckSmoke(ctx, game.vehicles, frame.time);

  if (game.marker) drawObjectiveMarker(ctx, game.marker, frame.time);

  // Depth sort: everything that stands up is drawn back to front by its foot line.
  const actors = [];
  for (const vehicle of game.vehicles) {
    if (vehicle.x < view.x - 80 || vehicle.x > view.x + view.w + 80) continue;
    if (vehicle.y < view.y - 80 || vehicle.y > view.y + view.h + 80) continue;
    actors.push({ y: vehicle.y, kind: 'vehicle', ref: vehicle });
  }
  for (const ped of game.peds) {
    if (ped.state === 'gone') continue;
    if (ped.x < view.x - 40 || ped.x > view.x + view.w + 40) continue;
    if (ped.y < view.y - 40 || ped.y > view.y + view.h + 40) continue;
    actors.push({ y: ped.y, kind: 'ped', ref: ped });
  }
  for (const officer of game.cops) {
    if (officer.health <= 0) continue;
    if (officer.x < view.x - 40 || officer.x > view.x + view.w + 40) continue;
    if (officer.y < view.y - 40 || officer.y > view.y + view.h + 40) continue;
    actors.push({ y: officer.y, kind: 'cop', ref: officer });
  }
  if (!game.player.inVehicle && !game.player.dead) {
    actors.push({ y: game.player.y, kind: 'player', ref: game.player });
  }
  actors.sort((a, b) => a.y - b.y);

  for (const actor of actors) {
    if (actor.kind === 'vehicle') drawVehicle(ctx, actor.ref, frame);
    else if (actor.kind === 'ped') drawPedestrian(ctx, actor.ref, frame);
    else if (actor.kind === 'cop') drawOfficer(ctx, actor.ref, frame);
    else drawPlayerCharacter(ctx, actor.ref, frame);
  }

  drawBullets(ctx, game.bullets);
  drawParticles(ctx, game.particles);
  drawLighting(ctx, game, frame, view);

  ctx.restore();
}

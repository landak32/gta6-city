// The city as pixels: sand and water, the asphalt grid with its paint and crosswalks, the
// blocks with their pavements, then every building lifted a little out of the ground with a
// shadow and lit windows, and finally the street furniture on top. Everything is culled to the
// camera's view before it is drawn, so a frame costs what the screen shows, not what the map holds.

import { clamp, hash2, TAU } from '../core/math2d.js';
import { mix, rgba, shade } from './palette.js';

const WAVE = '#1d6f7d';

function visible(view, x, y, w, h, pad = 0) {
  return x + w > view.x - pad && x < view.x + view.w + pad && y + h > view.y - pad && y < view.y + view.h + pad;
}

/** Ground, sea and sand: the whole map is painted before the streets go down on top. */
export function drawGroundAndWater(ctx, city, view, frame) {
  const { water } = city;
  ctx.fillStyle = '#6b7a4e';
  ctx.fillRect(view.x, view.y, view.w, view.h);

  const left = view.x;
  const right = view.x + view.w;
  const step = 36;

  // The sea, deep toward the horizon of the map's lower edge.
  const seaTop = water.edgeAt(left);
  const gradient = ctx.createLinearGradient(0, seaTop - 40, 0, city.height);
  gradient.addColorStop(0, '#2f9099');
  gradient.addColorStop(0.35, WAVE);
  gradient.addColorStop(1, '#0d4a58');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(left, water.edgeAt(left));
  for (let x = left; x <= right; x += step) ctx.lineTo(x, water.edgeAt(x));
  ctx.lineTo(right, city.height);
  ctx.lineTo(left, city.height);
  ctx.closePath();
  ctx.fill();

  // Long swells, drifting with the clock.
  ctx.strokeStyle = 'rgba(214, 245, 240, 0.16)';
  ctx.lineWidth = 1.6;
  for (let band = 0; band < 7; band += 1) {
    const baseY = city.height - 8 - band * 42;
    ctx.beginPath();
    for (let x = left; x <= right; x += 26) {
      const y = baseY + Math.sin(x * 0.011 + frame.time * 0.7 + band) * 5;
      if (x === left) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Glitter on the water, a few specks per frame.
  for (let index = 0; index < 90; index += 1) {
    const x = left + hash2(index, 7) * view.w;
    const y = water.edgeAt(x) + 20 + hash2(index, 31) * (city.height - water.edgeAt(x) - 30);
    if (y > city.height) continue;
    ctx.fillStyle = `rgba(255, 248, 214, ${0.12 + 0.2 * Math.abs(Math.sin(frame.time * 1.3 + index))})`;
    ctx.fillRect(x, y, 3, 1.4);
  }

  // Wet sand, dry sand, and a foam line that breathes.
  ctx.beginPath();
  ctx.moveTo(left, water.edgeAt(left));
  for (let x = left; x <= right; x += step) ctx.lineTo(x, water.edgeAt(x));
  for (let x = right; x >= left; x -= step) ctx.lineTo(x, water.edgeAt(x) - 26);
  ctx.closePath();
  ctx.fillStyle = '#cbb389';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(left, city.shoreY);
  ctx.lineTo(right, city.shoreY);
  for (let x = right; x >= left; x -= step) ctx.lineTo(x, water.edgeAt(x) - 26);
  ctx.closePath();
  const sandGradient = ctx.createLinearGradient(0, city.shoreY, 0, city.shoreY + 200);
  sandGradient.addColorStop(0, '#efe0bd');
  sandGradient.addColorStop(1, '#e0c99d');
  ctx.fillStyle = sandGradient;
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = left; x <= right; x += 20) {
    const y = water.edgeAt(x) + Math.sin(frame.time * 1.6 + x * 0.01) * 2;
    if (x === left) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // The promenade and its railing along the sand.
  ctx.fillStyle = '#ded2b6';
  ctx.fillRect(left, city.shoreY - 26, view.w, 26);
  ctx.fillStyle = 'rgba(120, 110, 92, 0.35)';
  ctx.fillRect(left, city.shoreY - 4, view.w, 4);
}

/** The asphalt grid: road beds, intersections, kerbs, lane paint, crosswalks and stop bars. */
export function drawRoadGrid(ctx, city, view, frame) {
  const roads = city.roads;
  const { half, roadX, roadY, cols, rows } = roads;
  const asphalt = '#3d3c39';
  const startX = roadX(0) - half;
  const endX = roadX(cols - 1) + half;
  const startY = roadY(0) - half;
  const endY = roadY(rows - 1) + half;

  ctx.fillStyle = asphalt;
  for (let row = 0; row < rows; row += 1) {
    const y = roadY(row);
    if (y + half < view.y || y - half > view.y + view.h) continue;
    ctx.fillRect(startX, y - half, endX - startX, half * 2);
  }
  for (let column = 0; column < cols; column += 1) {
    const x = roadX(column);
    if (x + half < view.x || x - half > view.x + view.w) continue;
    ctx.fillRect(x - half, startY, half * 2, endY - startY);
  }

  // Intersections are a shade darker and the paint around them follows the light.
  ctx.fillStyle = '#373633';
  for (const node of roads.nodes) {
    if (!visible(view, node.x - half, node.y - half, half * 2, half * 2)) continue;
    ctx.fillRect(node.x - half, node.y - half, half * 2, half * 2);
  }

  // Kerbs.
  ctx.strokeStyle = '#b8b1a2';
  ctx.lineWidth = 2;
  for (let row = 0; row < rows; row += 1) {
    const y = roadY(row);
    if (y + half < view.y - 10 || y - half > view.y + view.h + 10) continue;
    ctx.beginPath();
    ctx.moveTo(startX, y - half);
    ctx.lineTo(endX, y - half);
    ctx.moveTo(startX, y + half);
    ctx.lineTo(endX, y + half);
    ctx.stroke();
  }
  for (let column = 0; column < cols; column += 1) {
    const x = roadX(column);
    if (x + half < view.x - 10 || x - half > view.x + view.w + 10) continue;
    ctx.beginPath();
    ctx.moveTo(x - half, startY);
    ctx.lineTo(x - half, endY);
    ctx.moveTo(x + half, startY);
    ctx.lineTo(x + half, endY);
    ctx.stroke();
  }

  drawLanePaint(ctx, city, view, frame);
}

function drawLanePaint(ctx, city, view, frame) {
  const roads = city.roads;
  const { half, roadX, roadY, cols, rows, cell } = roads;
  const dash = 26;
  const gap = 20;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(233, 216, 165, 0.85)';

  // Double yellow down the middle of every avenue, broken at the junctions.
  for (let row = 0; row < rows; row += 1) {
    const y = roadY(row);
    if (y + half < view.y || y - half > view.y + view.h) continue;
    for (let column = 0; column < cols - 1; column += 1) {
      const from = roadX(column) + half + 12;
      const to = roadX(column + 1) - half - 12;
      ctx.beginPath();
      ctx.moveTo(from, y - 2);
      ctx.lineTo(to, y - 2);
      ctx.moveTo(from, y + 2);
      ctx.lineTo(to, y + 2);
      ctx.stroke();
    }
  }
  for (let column = 0; column < cols; column += 1) {
    const x = roadX(column);
    if (x + half < view.x || x - half > view.x + view.w) continue;
    for (let row = 0; row < rows - 1; row += 1) {
      const from = roadY(row) + half + 12;
      const to = roadY(row + 1) - half - 12;
      ctx.beginPath();
      ctx.moveTo(x - 2, from);
      ctx.lineTo(x - 2, to);
      ctx.moveTo(x + 2, from);
      ctx.lineTo(x + 2, to);
      ctx.stroke();
    }
  }

  // Dashed lane lines and the solid edge lines at the kerb.
  ctx.strokeStyle = 'rgba(238, 236, 226, 0.5)';
  ctx.lineWidth = 2;
  for (let row = 0; row < rows; row += 1) {
    const y = roadY(row);
    if (y + half < view.y || y - half > view.y + view.h) continue;
    for (let column = 0; column < cols - 1; column += 1) {
      const from = roadX(column) + half + 14;
      const to = roadX(column + 1) - half - 14;
      for (let x = from + ((frame.time * 0) % (dash + gap)); x < to - dash; x += dash + gap) {
        ctx.beginPath();
        ctx.moveTo(x, y - half * 0.5);
        ctx.lineTo(x + dash, y - half * 0.5);
        ctx.moveTo(x, y + half * 0.5);
        ctx.lineTo(x + dash, y + half * 0.5);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(238, 236, 226, 0.35)';
    ctx.beginPath();
    ctx.moveTo(roadX(0) + half - 5, y - half + 5);
    ctx.lineTo(roadX(cols - 1) - half + 5, y - half + 5);
    ctx.moveTo(roadX(0) + half - 5, y + half - 5);
    ctx.lineTo(roadX(cols - 1) - half + 5, y + half - 5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238, 236, 226, 0.5)';
  }
  for (let column = 0; column < cols; column += 1) {
    const x = roadX(column);
    if (x + half < view.x || x - half > view.x + view.w) continue;
    for (let row = 0; row < rows - 1; row += 1) {
      const from = roadY(row) + half + 14;
      const to = roadY(row + 1) - half - 14;
      for (let y = from; y < to - dash; y += dash + gap) {
        ctx.beginPath();
        ctx.moveTo(x - half * 0.5, y);
        ctx.lineTo(x - half * 0.5, y + dash);
        ctx.moveTo(x + half * 0.5, y);
        ctx.lineTo(x + half * 0.5, y + dash);
        ctx.stroke();
      }
    }
  }

  // Crosswalks, stop bars and the odd manhole cover.
  for (const node of roads.nodes) {
    if (!visible(view, node.x - half, node.y - half, half * 2, half * 2, 60)) continue;
    ctx.fillStyle = 'rgba(240, 238, 226, 0.8)';
    for (let stripe = -half + 8; stripe < half - 8; stripe += 12) {
      ctx.fillRect(node.x + stripe, node.y - half - 26, 6, 22);
      ctx.fillRect(node.x + stripe, node.y + half + 4, 6, 22);
      ctx.fillRect(node.x - half - 26, node.y + stripe, 22, 6);
      ctx.fillRect(node.x + half + 4, node.y + stripe, 22, 6);
    }
    ctx.fillStyle = 'rgba(240, 238, 226, 0.55)';
    ctx.fillRect(node.x - half + 4, node.y + half + 30, half - 8, 4);
    ctx.fillRect(node.x + 4, node.y - half - 34, half - 8, 4);
    ctx.fillRect(node.x - half - 34, node.y - half + 4, 4, half - 8);
    ctx.fillRect(node.x + half + 30, node.y + 4, 4, half - 8);
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols - 1; column += 1) {
      for (let n = 0; n < 2; n += 1) {
        const x = roadX(column) + cell * (0.3 + 0.4 * n);
        const y = roadY(row) + (n === 0 ? -18 : 18);
        if (!visible(view, x, y, 20, 20)) continue;
        ctx.fillStyle = 'rgba(30, 30, 30, 0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 118, 108, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
  }
}

/** The paving of each block, with a kerb line and the district's own ground. */
export function drawBlockPaving(ctx, city, view) {
  for (const block of city.roads.blocks) {
    if (!visible(view, block.x, block.y, block.w, block.h, 20)) continue;
    const district = block.district;
    ctx.fillStyle = district.sidewalk;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.fillStyle = district.sidewalkEdge;
    ctx.fillRect(block.x, block.y, block.w, 3);
    ctx.fillRect(block.x, block.y, 3, block.h);
    ctx.fillStyle = district.ground;
    ctx.fillRect(block.x + block.sidewalk, block.y + block.sidewalk, block.w - block.sidewalk * 2, block.h - block.sidewalk * 2);

    // Pavement joints.
    ctx.strokeStyle = rgba('#6d6558', 0.13);
    ctx.lineWidth = 1;
    for (let x = block.x + block.sidewalk; x < block.x + block.w; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, block.y);
      ctx.lineTo(x, block.y + block.sidewalk);
      ctx.moveTo(x, block.y + block.h - block.sidewalk);
      ctx.lineTo(x, block.y + block.h);
      ctx.stroke();
    }
    for (let y = block.y + block.sidewalk; y < block.y + block.h; y += 46) {
      ctx.beginPath();
      ctx.moveTo(block.x, y);
      ctx.lineTo(block.x + block.sidewalk, y);
      ctx.moveTo(block.x + block.w - block.sidewalk, y);
      ctx.lineTo(block.x + block.w, y);
      ctx.stroke();
    }

    if (district.id === 'park') {
      // Gravel walks crossing the green.
      ctx.strokeStyle = '#d8cfb4';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(block.x + block.w / 2, block.y + block.sidewalk);
      ctx.lineTo(block.x + block.w / 2, block.y + block.h - block.sidewalk);
      ctx.moveTo(block.x + block.sidewalk, block.y + block.h / 2);
      ctx.lineTo(block.x + block.w - block.sidewalk, block.y + block.h / 2);
      ctx.stroke();
      ctx.strokeStyle = '#c6bda2';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

/** One building: its shadow, the two walls the camera can see, and the roof it is capped with. */
export function drawBuilding(ctx, building, frame) {
  const lift = clamp(building.height * 0.34, 7, 66);
  const ox = lift * 0.18;
  const oy = -lift;
  const { x, y, w, h } = building;
  const night = frame.night;

  // Shadow cast down and to the right.
  ctx.fillStyle = 'rgba(18, 20, 26, 0.22)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w + lift * 0.42, y + h + lift * 0.14);
  ctx.lineTo(x + w + lift * 0.5, y + h + lift * 0.34);
  ctx.lineTo(x + w * 0.1, y + h + lift * 0.2);
  ctx.closePath();
  ctx.fill();

  // The south wall, facing the street.
  ctx.fillStyle = shade(building.wall, -0.16);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w + ox, y + h + oy);
  ctx.lineTo(x + ox, y + h + oy);
  ctx.closePath();
  ctx.fill();

  // The east wall.
  ctx.fillStyle = shade(building.wall, -0.34);
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w + ox, y + h + oy);
  ctx.lineTo(x + w + ox, y + oy);
  ctx.closePath();
  ctx.fill();

  // Windows, in a grid scaled to the wall.
  const rowsOfGlass = Math.max(1, Math.min(6, Math.floor(lift / 11)));
  const lit = night > 0.25;
  for (let row = 0; row < rowsOfGlass; row += 1) {
    const t0 = (row + 0.35) / rowsOfGlass;
    const t1 = (row + 0.75) / rowsOfGlass;
    const y0 = y + h + oy * t0;
    const y1 = y + h + oy * t1;
    const columns = Math.max(1, Math.floor(w / 22));
    for (let column = 0; column < columns; column += 1) {
      const u = (column + 0.28) / columns;
      const u2 = (column + 0.72) / columns;
      const on = hash2(building.seed + column * 13, row * 7) < (lit ? 0.55 : 0.4);
      ctx.fillStyle = lit
        ? on
          ? 'rgba(255, 214, 140, 0.92)'
          : 'rgba(40, 44, 54, 0.55)'
        : mix(building.glass, '#ffffff', 0.08);
      ctx.beginPath();
      ctx.moveTo(x + w * u + ox * t0, y0 + 1.6);
      ctx.lineTo(x + w * u2 + ox * t0, y0 + 1.6);
      ctx.lineTo(x + w * u2 + ox * t1, y1 - 1.2);
      ctx.lineTo(x + w * u + ox * t1, y1 - 1.2);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Ground floor: a shopfront band on the street side.
  if (building.district === 'market' || building.district === 'beach' || building.district === 'downtown') {
    ctx.fillStyle = rgba('#1d2229', 0.55);
    ctx.fillRect(x + 3, y + h - 9, w - 6, 7);
    if (night > 0.2) {
      ctx.fillStyle = rgba('#ffcf82', 0.32);
      ctx.fillRect(x + 3, y + h - 8, w - 6, 5);
    }
  }

  // Awning over the pavement.
  if (building.awning) {
    const awningY = y + h + oy * 0.22;
    const stripes = Math.max(3, Math.floor(w / 10));
    for (let stripe = 0; stripe < stripes; stripe += 1) {
      ctx.fillStyle = stripe % 2 === 0 ? building.awningColor : shade(building.awningColor, 0.35);
      ctx.fillRect(x + (w / stripes) * stripe, awningY, w / stripes + 0.5, 9);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(x, awningY + 9, w, 3);
  }

  // The roof.
  ctx.fillStyle = building.roof;
  ctx.fillRect(x + ox, y + oy, w, h);
  ctx.strokeStyle = 'rgba(255, 250, 232, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + ox + 0.7, y + oy + 0.7, w - 1.4, h - 1.4);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.strokeRect(x + ox + 4, y + oy + 4, w - 8, h - 8);

  // Roof plant: air-conditioning boxes, vents and the odd water tank or antenna.
  for (const unit of building.units) {
    const ux = x + ox + unit.x;
    const uy = y + oy + unit.y;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(ux + 2, uy + 2, unit.w, unit.h);
    ctx.fillStyle = '#b9b6ac';
    ctx.fillRect(ux, uy, unit.w, unit.h);
    ctx.fillStyle = '#8e8b82';
    ctx.fillRect(ux + 2, uy + 2, unit.w - 4, unit.h * 0.35);
    ctx.strokeStyle = 'rgba(60, 60, 58, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ux + 0.5, uy + 0.5, unit.w - 1, unit.h - 1);
  }
  if (building.roofStyle === 'tank') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + ox + w * 0.7 + 4, y + oy + h * 0.32 + 4, 10, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a6b4a';
    ctx.beginPath();
    ctx.arc(x + ox + w * 0.7, y + oy + h * 0.32, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a98a63';
    ctx.beginPath();
    ctx.arc(x + ox + w * 0.7, y + oy + h * 0.32, 6, 0, TAU);
    ctx.fill();
  } else if (building.roofStyle === 'antenna') {
    ctx.strokeStyle = '#6c6a63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + ox + w * 0.28, y + oy + h * 0.5);
    ctx.lineTo(x + ox + w * 0.28, y + oy + h * 0.5 - 16);
    ctx.stroke();
    if (night > 0.3) {
      ctx.fillStyle = 'rgba(255, 90, 70, 0.9)';
      ctx.beginPath();
      ctx.arc(x + ox + w * 0.28, y + oy + h * 0.5 - 17, 2.2, 0, TAU);
      ctx.fill();
    }
  }
}

/** Every building, far ones first so nearer roofs overlap them. */
export function drawBuildings(ctx, city, view, frame) {
  const list = city.buildings;
  for (let index = 0; index < list.length; index += 1) {
    const building = list[index];
    if (!visible(view, building.x, building.y - 70, building.w + 20, building.h + 110)) continue;
    drawBuilding(ctx, building, frame);
  }
}

function drawLamp(ctx, prop, frame) {
  const night = frame.night;
  ctx.strokeStyle = '#5c5a54';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(prop.x, prop.y);
  ctx.lineTo(prop.x + 4, prop.y - 16);
  ctx.stroke();
  ctx.fillStyle = '#6f6c64';
  ctx.beginPath();
  ctx.arc(prop.x + 4, prop.y - 16, 4, 0, TAU);
  ctx.fill();
  if (night > 0.15) {
    const glow = ctx.createRadialGradient(prop.x + 4, prop.y - 16, 1, prop.x + 4, prop.y - 16, 34);
    glow.addColorStop(0, `rgba(255, 224, 158, ${0.2 * night})`);
    glow.addColorStop(0.5, `rgba(255, 198, 112, ${0.07 * night})`);
    glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(prop.x + 4, prop.y - 16, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 236, 190, 0.8)';
    ctx.beginPath();
    ctx.arc(prop.x + 4, prop.y - 16, 2.4, 0, TAU);
    ctx.fill();
  }
}

function drawPalm(ctx, prop, frame) {
  ctx.fillStyle = 'rgba(20, 30, 20, 0.25)';
  ctx.beginPath();
  ctx.ellipse(prop.x + 12, prop.y + 9, 18, 8, 0.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8a6a45';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(prop.x, prop.y);
  ctx.quadraticCurveTo(prop.x + 3, prop.y - 16, prop.x + 7, prop.y - 26);
  ctx.stroke();
  const sway = Math.sin(frame.time * 1.1 + prop.x * 0.01) * 0.06;
  ctx.fillStyle = '#2f6b3f';
  for (let frond = 0; frond < 7; frond += 1) {
    const angle = (frond / 7) * TAU + sway;
    ctx.beginPath();
    ctx.moveTo(prop.x + 7, prop.y - 26);
    ctx.quadraticCurveTo(
      prop.x + 7 + Math.cos(angle) * 14,
      prop.y - 26 + Math.sin(angle) * 10 - 3,
      prop.x + 7 + Math.cos(angle) * 22,
      prop.y - 26 + Math.sin(angle) * 16 + 4,
    );
    ctx.quadraticCurveTo(
      prop.x + 7 + Math.cos(angle + 0.35) * 12,
      prop.y - 26 + Math.sin(angle + 0.35) * 9 + 3,
      prop.x + 7,
      prop.y - 26,
    );
    ctx.fill();
  }
  ctx.fillStyle = '#3f8348';
  ctx.beginPath();
  ctx.arc(prop.x + 7, prop.y - 26, 4, 0, TAU);
  ctx.fill();
}

function drawTree(ctx, prop) {
  ctx.fillStyle = 'rgba(20, 30, 20, 0.22)';
  ctx.beginPath();
  ctx.ellipse(prop.x + 8, prop.y + 8, 20, 10, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5a4029';
  ctx.fillRect(prop.x - 2, prop.y - 4, 5, 10);
  ctx.fillStyle = '#3f6b37';
  ctx.beginPath();
  ctx.arc(prop.x, prop.y - 6, 15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4d7d3f';
  ctx.beginPath();
  ctx.arc(prop.x - 7, prop.y - 12, 10, 0, TAU);
  ctx.arc(prop.x + 8, prop.y - 10, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#61934a';
  ctx.beginPath();
  ctx.arc(prop.x + 2, prop.y - 16, 7, 0, TAU);
  ctx.fill();
}

function drawCrate(ctx, prop) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate(prop.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-prop.w / 2 + 3, -prop.h / 2 + 3, prop.w, prop.h);
  ctx.fillStyle = '#a87c4b';
  ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
  ctx.strokeStyle = '#7d5a34';
  ctx.lineWidth = 2;
  ctx.strokeRect(-prop.w / 2 + 2, -prop.h / 2 + 2, prop.w - 4, prop.h - 4);
  ctx.beginPath();
  ctx.moveTo(-prop.w / 2 + 3, -prop.h / 2 + 3);
  ctx.lineTo(prop.w / 2 - 3, prop.h / 2 - 3);
  ctx.moveTo(prop.w / 2 - 3, -prop.h / 2 + 3);
  ctx.lineTo(-prop.w / 2 + 3, prop.h / 2 - 3);
  ctx.stroke();
  ctx.restore();
}

function drawContainer(ctx, prop) {
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate(prop.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.fillRect(-prop.w / 2 + 5, -prop.h / 2 + 5, prop.w, prop.h);
  ctx.fillStyle = prop.color;
  ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, prop.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let rib = -prop.w / 2 + 5; rib < prop.w / 2; rib += 7) {
    ctx.beginPath();
    ctx.moveTo(rib, -prop.h / 2 + 2);
    ctx.lineTo(rib, prop.h / 2 - 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(-prop.w / 2, -prop.h / 2, prop.w, 3);
  ctx.restore();
}

function drawPier(ctx, prop) {
  ctx.fillStyle = 'rgba(10, 30, 34, 0.35)';
  ctx.fillRect(prop.x - prop.w / 2 + 6, prop.y - prop.h / 2 + 8, prop.w, prop.h);
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
  ctx.strokeStyle = 'rgba(60, 42, 26, 0.5)';
  ctx.lineWidth = 1;
  for (let y = prop.y - prop.h / 2; y < prop.y + prop.h / 2; y += 9) {
    ctx.beginPath();
    ctx.moveTo(prop.x - prop.w / 2, y);
    ctx.lineTo(prop.x + prop.w / 2, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#5f472c';
  ctx.fillRect(prop.x - prop.w / 2 - 3, prop.y - prop.h / 2, 5, prop.h);
  ctx.fillRect(prop.x + prop.w / 2 - 2, prop.y - prop.h / 2, 5, prop.h);
}

function drawCrane(ctx, prop) {
  const baseX = prop.x;
  const baseY = prop.y + 30;
  ctx.strokeStyle = '#c9a13c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(baseX - 26, baseY);
  ctx.lineTo(baseX - 26, baseY - 70);
  ctx.moveTo(baseX + 26, baseY);
  ctx.lineTo(baseX + 26, baseY - 70);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(201, 161, 60, 0.85)';
  for (let step = 0; step < 7; step += 1) {
    const y0 = baseY - step * 10;
    ctx.beginPath();
    ctx.moveTo(baseX - 26, y0);
    ctx.lineTo(baseX + 26, y0 - 10);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9a13c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(baseX - 70, baseY - 74);
  ctx.lineTo(baseX + 96, baseY - 74);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(baseX + 60, baseY - 74);
  ctx.lineTo(baseX + 60, baseY - 34);
  ctx.stroke();
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(baseX + 46, baseY - 34, 28, 16);
}

function drawProp(ctx, prop, frame) {
  switch (prop.kind) {
    case 'lamp':
      drawLamp(ctx, prop, frame);
      break;
    case 'palm':
      drawPalm(ctx, prop, frame);
      break;
    case 'tree':
      drawTree(ctx, prop);
      break;
    case 'bench':
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(prop.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-11, -2, 22, 7);
      ctx.fillStyle = '#8a5f38';
      ctx.fillRect(-11, -4, 22, 5);
      ctx.fillStyle = '#6d492a';
      ctx.fillRect(-10, 1, 3, 4);
      ctx.fillRect(7, 1, 3, 4);
      ctx.restore();
      break;
    case 'bin':
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.arc(prop.x + 3, prop.y + 3, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#4c5a52';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#63736a';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 4, 0, TAU);
      ctx.fill();
      break;
    case 'hydrant':
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(prop.x - 2, prop.y - 1, 7, 6);
      ctx.fillStyle = '#c9453a';
      ctx.fillRect(prop.x - 2.5, prop.y - 5, 5, 7);
      ctx.fillRect(prop.x - 4.5, prop.y - 3.5, 9, 2.5);
      break;
    case 'planter':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 2, prop.y + 4, 11, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#9a7f5e';
      ctx.fillRect(prop.x - 9, prop.y - 7, 18, 14);
      ctx.fillStyle = '#7d6448';
      ctx.fillRect(prop.x - 6, prop.y - 4, 12, 8);
      ctx.fillStyle = '#4f7d3e';
      ctx.beginPath();
      ctx.arc(prop.x - 2, prop.y - 2, 5, 0, TAU);
      ctx.arc(prop.x + 3, prop.y + 1, 4, 0, TAU);
      ctx.fill();
      break;
    case 'crate':
      drawCrate(ctx, prop);
      break;
    case 'container':
      drawContainer(ctx, prop);
      break;
    case 'pier':
      drawPier(ctx, prop);
      break;
    case 'crane':
      drawCrane(ctx, prop);
      break;
    case 'umbrella':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 5, prop.y + 5, 11, 7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8654f';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f5eee0';
      for (let slice = 0; slice < 4; slice += 1) {
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.arc(prop.x, prop.y, 11, (slice / 4) * TAU + 0.2, (slice / 4) * TAU + 0.65);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#a89a86';
      ctx.fillRect(prop.x - 1, prop.y, 2, 9);
      break;
    case 'lighthouse': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(prop.x + 8, prop.y + 9, 15, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f4efe2';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c9523f';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f7d774';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 5, 0, TAU);
      ctx.fill();
      if (frame.night > 0.2) {
        const glow = ctx.createRadialGradient(prop.x, prop.y, 3, prop.x, prop.y, 130);
        glow.addColorStop(0, `rgba(255, 236, 170, ${0.5 * frame.night})`);
        glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 130, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'pond': {
      ctx.fillStyle = '#3f7f86';
      ctx.beginPath();
      ctx.ellipse(prop.x, prop.y, 58, 34, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 200, 200, 0.35)';
      ctx.beginPath();
      ctx.ellipse(prop.x - 12, prop.y - 8, 22, 10, 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#8a7f63';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'awning':
      ctx.fillStyle = prop.color;
      ctx.fillRect(prop.x - prop.w / 2, prop.y, prop.w, prop.h);
      break;
    default:
      break;
  }
}

/** Street furniture, drawn after the buildings so it sits on the pavement in front. */
export function drawProps(ctx, city, view, frame) {
  for (const prop of city.props) {
    const padX = prop.w ? prop.w / 2 + 20 : 40;
    const padY = prop.h ? prop.h / 2 + 40 : 40;
    if (!visible(view, prop.x - padX, prop.y - padY, padX * 2, padY * 2)) continue;
    drawProp(ctx, prop, frame);
  }
}

// City generation: one seed builds the whole town. Each block between the avenues is zoned to a
// district, filled with buildings of a size and height that suit it, and dressed with street
// furniture — lamps, benches, bins, palms, crates, containers and cranes — along its sidewalks.
// The south edge becomes sand, then water, with piers reaching out from the docks.
//
// Nothing here draws. It hands the art, the collisions and the spawners a plain description of
// what stands where, and it is deterministic: createCity(seed) twice gives the same town.

import { CITY } from '../core/config.js';
import { createRandom } from '../core/rng.js';
import { districtAt, DISTRICTS } from './districts.js';
import { createRoadNetwork } from './roads.js';

const LANDMARKS = [
  { id: 'hospital', name: 'Mercy General', kind: 'hospital', column: 2, row: 2 },
  { id: 'precinct', name: 'Ninth Precinct', kind: 'police', column: 4, row: 3 },
  { id: 'pawnshop', name: 'Calder Loan & Pawn', kind: 'shop', column: 3, row: 1 },
  { id: 'dockshed', name: 'Pier Nine Shed', kind: 'warehouse', column: 0, row: 2 },
  { id: 'depot', name: 'Harbor Freight Depot', kind: 'warehouse', column: 0, row: 1 },
  { id: 'taxistand', name: 'Marisol Cab Stand', kind: 'taxi', column: 2, row: 4 },
  { id: 'marina', name: 'Tidewater Marina', kind: 'marina', column: 5, row: 4 },
  { id: 'park', name: 'Verdano Park', kind: 'park', column: 6, row: 0 },
  { id: 'safehouse', name: 'Larkspur Safehouse', kind: 'home', column: 6, row: 3 },
  { id: 'club', name: 'The Blue Heron', kind: 'club', column: 4, row: 1 },
];

export function createCity(seed) {
  const random = createRandom(seed ^ 0x5f3759df);
  const roads = createRoadNetwork();
  const width = CITY.worldWidth;
  const height = CITY.worldHeight;

  const buildings = [];
  const props = [];
  const solids = [];
  const parkingSpots = [];
  const boundaries = [];

  /** Sand starts just past the coastal avenue's south sidewalk. */
  const shoreY = CITY.shoreY;
  const waterEdgeAt = (x) => shoreY + CITY.beachDepth + Math.sin(x * 0.0023) * 16 + Math.sin(x * 0.0007 + 1.7) * 9;
  const water = { shoreY, beachDepth: CITY.beachDepth, edgeAt: waterEdgeAt };

  /** A coarse hash so a circle only meets the handful of solids around it. */
  const grid = new Map();
  const CELL = 150;
  function indexSolid(rect) {
    const minX = Math.floor(rect.x / CELL);
    const maxX = Math.floor((rect.x + rect.w) / CELL);
    const minY = Math.floor(rect.y / CELL);
    const maxY = Math.floor((rect.y + rect.h) / CELL);
    for (let gy = minY; gy <= maxY; gy += 1) {
      for (let gx = minX; gx <= maxX; gx += 1) {
        const key = `${gx},${gy}`;
        let bucket = grid.get(key);
        if (!bucket) {
          bucket = [];
          grid.set(key, bucket);
        }
        bucket.push(rect);
      }
    }
  }
  function addSolid(rect) {
    solids.push(rect);
    indexSolid(rect);
  }
  function solidsNear(x, y, radius) {
    const found = [];
    const minX = Math.floor((x - radius) / CELL);
    const maxX = Math.floor((x + radius) / CELL);
    const minY = Math.floor((y - radius) / CELL);
    const maxY = Math.floor((y + radius) / CELL);
    for (let gy = minY; gy <= maxY; gy += 1) {
      for (let gx = minX; gx <= maxX; gx += 1) {
        const bucket = grid.get(`${gx},${gy}`);
        if (!bucket) continue;
        for (const rect of bucket) if (!found.includes(rect)) found.push(rect);
      }
    }
    return found;
  }

  function addProp(prop) {
    props.push(prop);
    if (prop.solid) {
      const r = prop.radius ?? Math.max(prop.w ?? 0, prop.h ?? 0) / 2;
      if (prop.w && prop.h) addSolid({ x: prop.x - prop.w / 2, y: prop.y - prop.h / 2, w: prop.w, h: prop.h, kind: prop.kind, prop });
      else addSolid({ x: prop.x - r, y: prop.y - r, w: r * 2, h: r * 2, kind: prop.kind, prop });
    }
  }

  const landmarks = LANDMARKS.map((entry) => {
    const block = roads.blocks.find((b) => b.column === entry.column && b.row === entry.row);
    const x = block ? block.centerX : 800;
    const y = block ? block.centerY : 800;
    return { ...entry, x, y, blockId: block ? block.id : 0 };
  });
  const landmark = (id) => landmarks.find((entry) => entry.id === id);

  /** Split a rectangle into 1-4 lots with narrow alleys, according to the district's density. */
  function lotsFor(rect, district) {
    const lots = [];
    const districtId = district.id;
    let splitX = districtId === 'residential' || districtId === 'beach' ? 2 : districtId === 'docks' ? 2 : 2;
    let splitY = districtId === 'docks' ? 1 : districtId === 'residential' ? 2 : 2;
    if (districtId === 'beach') splitY = 1;
    if (districtId === 'park') return lots;
    if (rect.w > 300 && random.chance(0.4)) splitX = 2;
    const alley = 12;
    const lotW = (rect.w - alley * (splitX - 1)) / splitX;
    const lotH = (rect.h - alley * (splitY - 1)) / splitY;
    for (let row = 0; row < splitY; row += 1) {
      for (let column = 0; column < splitX; column += 1) {
        const insetX = random.range(0, 8);
        const insetY = random.range(0, 8);
        lots.push({
          x: rect.x + column * (lotW + alley) + insetX,
          y: rect.y + row * (lotH + alley) + insetY,
          w: lotW - insetX - random.range(0, 6),
          h: lotH - insetY - random.range(0, 6),
        });
      }
    }
    return lots.filter((lot) => lot.w > 46 && lot.h > 46);
  }

  function makeBuilding(lot, district, block) {
    const palettePick = (list) => random.pick(list);
    const tall = district.height[1] - district.height[0];
    let tallness = random.next();
    // Towers cluster toward the middle of downtown, warehouses stay flat at the docks.
    if (district.id === 'downtown') {
      const centre = 1 - Math.min(1, Math.hypot(block.centerX - width * 0.47, block.centerY - height * 0.33) / 900);
      tallness = Math.min(1, tallness * 0.55 + centre * 0.85);
    }
    const buildingHeight = district.height[0] + tall * tallness;
    const awning = random.chance(district.awning);
    const building = {
      x: lot.x,
      y: lot.y,
      w: lot.w,
      h: lot.h,
      height: buildingHeight,
      roof: palettePick(district.roof ? [district.roof, district.roof] : ['#8f877a']),
      wall: palettePick(district.wall),
      face: palettePick(district.building),
      glass: palettePick(district.glass),
      accent: district.accent,
      district: district.id,
      awning,
      awningColor: palettePick(['#c8543f', '#2f7f7a', '#d9a13c', '#3c5f8a', '#b8493c']),
      roofStyle: random.chance(0.3) ? 'tank' : random.chance(0.4) ? 'antenna' : 'plain',
      seed: random.int(0, 9999),
      door: random.chance(0.5) ? 'front' : 'side',
    };
    // Rooftop clutter: air-conditioning boxes and vents, laid out on a small grid.
    const units = [];
    const unitCount = Math.max(1, Math.floor((lot.w * lot.h) / 5200));
    for (let index = 0; index < unitCount; index += 1) {
      const size = random.range(9, 20);
      units.push({
        x: random.range(10, Math.max(12, lot.w - size - 10)),
        y: random.range(10, Math.max(12, lot.h - size - 10)),
        w: size,
        h: size * random.range(0.65, 1.1),
      });
    }
    building.units = units;
    return building;
  }

  function furnishBlock(block, district) {
    const sidewalk = block.sidewalk;
    const inner = {
      x: block.x + sidewalk,
      y: block.y + sidewalk,
      w: block.w - sidewalk * 2,
      h: block.h - sidewalk * 2,
    };
    const corner = (dx, dy) => ({
      x: block.x + sidewalk * 0.5 + dx * (block.w - sidewalk),
      y: block.y + sidewalk * 0.5 + dy * (block.h - sidewalk),
    });

    // Street lamps on the sidewalk corners and the middle of each side.
    const lampSpots = [
      corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1),
      { x: block.centerX, y: block.y + 9 },
      { x: block.centerX, y: block.y + block.h - 9 },
      { x: block.x + 9, y: block.centerY },
      { x: block.x + block.w - 9, y: block.centerY },
    ];
    for (const spot of lampSpots) {
      if (random.chance(0.82)) addProp({ kind: 'lamp', x: spot.x, y: spot.y, angle: 0, solid: true, radius: 5 });
    }

    // Bins, benches, hydrants and planters scattered along the pavement.
    const streetKinds = ['bin', 'bench', 'hydrant', 'planter'];
    const clutter = Math.floor(random.range(3, 7));
    for (let index = 0; index < clutter; index += 1) {
      const side = random.int(0, 3);
      const t = random.range(0.16, 0.84);
      let x = block.x + 15;
      let y = block.y + 15;
      if (side === 0) x = block.x + t * block.w;
      else if (side === 1) x = block.x + block.w - 15;
      else if (side === 2) {
        x = block.x + t * block.w;
        y = block.y + block.h - 15;
      } else y = block.y + t * block.h;
      if (side === 1 || side === 3) y = block.y + t * block.h;
      addProp({ kind: random.pick(streetKinds), x, y, angle: random.range(0, Math.PI * 2), solid: streetKinds[random.int(0, 3)] === 'planter', radius: 7, seed: random.int(0, 999) });
    }

    if (district.id === 'beach') {
      const palms = random.int(3, 6);
      for (let index = 0; index < palms; index += 1) {
        addProp({ kind: 'palm', x: block.x + random.range(14, block.w - 14), y: block.y + random.range(14, block.h - 14), angle: random.range(0, Math.PI * 2), solid: true, radius: 8, seed: random.int(0, 99) });
      }
    }
    if (district.id === 'park') {
      for (let index = 0; index < 9; index += 1) {
        addProp({ kind: 'tree', x: block.x + random.range(20, block.w - 20), y: block.y + random.range(20, block.h - 20), angle: random.range(0, Math.PI * 2), solid: true, radius: 13, seed: random.int(0, 99) });
      }
      addProp({ kind: 'pond', x: block.centerX, y: block.centerY + 20, angle: 0, solid: false, radius: 62, seed: random.int(0, 99) });
    }
    if (district.id === 'docks') {
      const crates = random.int(4, 8);
      for (let index = 0; index < crates; index += 1) {
        const along = random.chance(0.5);
        addProp({
          kind: 'crate',
          x: block.x + random.range(20, block.w - 20),
          y: block.y + random.range(20, block.h - 20),
          angle: random.range(-0.3, 0.3) + (along ? 0 : Math.PI / 2),
          solid: true,
          w: 26,
          h: 26,
          seed: random.int(0, 99),
        });
      }
    }

    // Awnings facing the street from the shopfronts below them are part of the building art.
    if (district.awning > 0.2) {
      for (const building of block.buildings) {
        if (building.awning && random.chance(0.5)) {
          addProp({ kind: 'awning', x: building.x + building.w / 2, y: building.y + building.h, angle: 0, solid: false, w: building.w * 0.7, h: 12, color: building.awningColor });
        }
      }
    }
  }

  // ---- Generate every block -------------------------------------------------------------
  for (const block of roads.blocks) {
    const district = districtAt(block.centerX, block.centerY, { width, height });
    block.district = district;
    block.buildings = [];
    const inset = CITY.blockInset + (district.id === 'park' ? 20 : 0);
    const lotArea = {
      x: block.x + block.sidewalk + inset,
      y: block.y + block.sidewalk + inset,
      w: block.w - (block.sidewalk + inset) * 2,
      h: block.h - (block.sidewalk + inset) * 2,
    };
    const lots = district.id === 'park' ? [] : lotsFor(lotArea, district);
    for (const lot of lots) {
      if (!random.chance(district.density)) continue;
      const building = makeBuilding(lot, district, block);
      block.buildings.push(building);
      buildings.push(building);
      addSolid({ x: building.x, y: building.y, w: building.w, h: building.h, kind: 'building', building });
    }
    // Parking bays along the kerb, one per side, for the vehicle system to fill.
    if (district.id !== 'park') {
      for (let index = 0; index < 2; index += 1) {
        parkingSpots.push({ x: block.x + block.w * random.range(0.25, 0.75), y: block.y - roads.half - 24, angle: 0 });
        parkingSpots.push({ x: block.x - roads.half - 24, y: block.y + block.h * random.range(0.25, 0.75), angle: Math.PI / 2 });
      }
    }
    furnishBlock(block, district);
  }

  // ---- The waterfront: sand, piers, a lighthouse and the marina ---------------------------
  for (let x = 40; x < width - 40; x += 52) {
    if (random.chance(0.55)) {
      addProp({ kind: 'palm', x, y: shoreY + random.range(18, CITY.beachDepth - 34), angle: random.range(0, Math.PI * 2), solid: false, radius: 8, seed: random.int(0, 99) });
    }
    if (random.chance(0.3)) {
      addProp({ kind: 'umbrella', x, y: shoreY + random.range(40, CITY.beachDepth - 20), angle: random.range(0, Math.PI * 2), solid: false, radius: 9, seed: random.int(0, 99) });
    }
  }
  for (let pier = 0; pier < 3; pier += 1) {
    const x = 260 + pier * 620;
    addProp({ kind: 'pier', x, y: shoreY + CITY.beachDepth + 70, angle: 0, solid: false, w: 54, h: 170, seed: pier });
  }
  addProp({ kind: 'lighthouse', x: width - 300, y: shoreY + CITY.beachDepth + 46, angle: 0, solid: true, radius: 15 });

  // Containers and cranes give the docks its silhouette.
  const dockBlocks = roads.blocks.filter((block) => block.district.id === 'docks');
  for (const block of dockBlocks) {
    for (let index = 0; index < 3; index += 1) {
      addProp({
        kind: 'container',
        x: block.x + random.range(40, block.w - 40),
        y: block.y + random.range(40, block.h - 40),
        angle: random.chance(0.5) ? 0 : Math.PI / 2,
        solid: true,
        w: 66,
        h: 28,
        color: random.pick(['#b5502f', '#3f6f74', '#c49a3a', '#4c5f7a', '#7a4a6b']),
        seed: random.int(0, 999),
      });
    }
  }
  addProp({ kind: 'crane', x: 210, y: shoreY - 40, angle: 0, solid: false, seed: 1 });
  addProp({ kind: 'crane', x: 1180, y: shoreY - 40, angle: 0, solid: false, seed: 2 });

  // The city edge: a fence of barriers where the map stops.
  boundaries.push({ x: 0, y: 0, w: width, h: roads.roadY(0) - roads.half });
  boundaries.push({ x: 0, y: 0, w: roads.roadX(0) - roads.half, h: height });

  /** Is this point on dry land the player may stand on? */
  function inWater(x, y) {
    return y > waterEdgeAt(x) - 4;
  }

  function buildingAt(x, y) {
    for (const rect of solidsNear(x, y, 4)) {
      if (rect.kind === 'building' && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return rect.building;
    }
    return null;
  }

  return {
    seed,
    width,
    height,
    roads,
    water,
    buildings,
    props,
    solids,
    parkingSpots,
    landmarks,
    landmark,
    shoreY,
    inWater,
    buildingAt,
    solidsNear,
    addSolid,
    inBounds: (x, y) => x > 40 && x < width - 40 && y > 40 && y < height - 40,
  };
}

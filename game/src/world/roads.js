// The road network: a lattice of intersections, the lane each direction drives in, the blocks
// between them, the crosswalks, and the traffic lights that hold a whole avenue at a time.
// Traffic, pedestrians, the police drivers and the screenshot autopilot all navigate by it.

import { CITY } from '../core/config.js';
import { TAU } from '../core/math2d.js';

export const DIR_EAST = 0;
export const DIR_SOUTH = 1;
export const DIR_WEST = 2;
export const DIR_NORTH = 3;

export const DIR_VECTORS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

/** Traffic lights: a full cycle, green and amber per axis. */
const LIGHT_CYCLE = 16;
const GREEN = 7.5;
const AMBER = 2;

export function createRoadNetwork() {
  const { cols, rows, cell, road, margin } = CITY;
  const half = road / 2;
  const laneOffset = 22;

  const roadX = (column) => margin + column * cell;
  const roadY = (row) => margin + row * cell;
  const nodeIndex = (column, row) => row * cols + column;

  const nodes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < cols; column += 1) {
      nodes.push({
        index: nodeIndex(column, row),
        column,
        row,
        x: roadX(column),
        y: roadY(row),
        /** Offsets each light so the avenues do not all change at once. */
        phase: (column * 2.7 + row * 5.1) % LIGHT_CYCLE,
        /** A seeded-ish jitter the art uses to vary the paint and the pole. */
        seed: (column * 73 + row * 149) % 997,
      });
    }
  }

  const blocks = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < cols - 1; column += 1) {
      const x = roadX(column) + half;
      const y = roadY(row) + half;
      const w = cell - road;
      const h = cell - road;
      blocks.push({
        id: row * (cols - 1) + column,
        column,
        row,
        x,
        y,
        w,
        h,
        centerX: x + w / 2,
        centerY: y + h / 2,
        sidewalk: CITY.sidewalk,
      });
    }
  }

  function lightState(node, axis, time) {
    const phase = (time + node.phase) % LIGHT_CYCLE;
    const nsGreen = phase < GREEN;
    const nsAmber = phase >= GREEN && phase < GREEN + AMBER;
    const ewGreen = phase >= GREEN + AMBER && phase < GREEN + AMBER + GREEN;
    const ewAmber = phase >= GREEN + AMBER + GREEN;
    if (axis === 'ns') return nsGreen ? 'green' : nsAmber ? 'amber' : 'red';
    return ewGreen ? 'green' : ewAmber ? 'amber' : 'red';
  }

  /** The intersection nearest a point, and how far away it is. */
  function nearestNode(x, y) {
    let best = nodes[0];
    let bestDistance = Infinity;
    for (const node of nodes) {
      const gap = (node.x - x) ** 2 + (node.y - y) ** 2;
      if (gap < bestDistance) {
        bestDistance = gap;
        best = node;
      }
    }
    return { node: best, distance: Math.sqrt(bestDistance) };
  }

  /** Breadth-first route along the avenues: the node ids from `from` to `to`, both included. */
  function route(from, to) {
    if (from === to) return [from];
    const previous = new Int16Array(nodes.length).fill(-1);
    const seen = new Uint8Array(nodes.length);
    const queue = [from];
    seen[from] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      if (current === to) break;
      const column = current % cols;
      const row = (current - column) / cols;
      const neighbours = [];
      if (column > 0) neighbours.push(current - 1);
      if (column < cols - 1) neighbours.push(current + 1);
      if (row > 0) neighbours.push(current - cols);
      if (row < rows - 1) neighbours.push(current + cols);
      for (const neighbour of neighbours) {
        if (seen[neighbour]) continue;
        seen[neighbour] = 1;
        previous[neighbour] = current;
        queue.push(neighbour);
      }
    }
    const path = [];
    let cursor = to;
    let guard = 0;
    while (cursor !== -1 && guard < 64) {
      path.push(cursor);
      if (cursor === from) break;
      cursor = previous[cursor];
      guard += 1;
    }
    return path.reverse();
  }

  /** True when a point is on asphalt. */
  function onRoad(x, y) {
    for (let column = 0; column < cols; column += 1) {
      if (Math.abs(x - roadX(column)) <= half) {
        return y >= roadY(0) - half && y <= roadY(rows - 1) + half;
      }
    }
    for (let row = 0; row < rows; row += 1) {
      if (Math.abs(y - roadY(row)) <= half) {
        return x >= roadX(0) - half && x <= roadX(cols - 1) + half;
      }
    }
    return false;
  }

  /** The nearest point on the centreline of the closest avenue, with its heading. */
  function nearestLanePoint(x, y) {
    let best = { x, y, angle: 0, distance: Infinity };
    for (let row = 0; row < rows; row += 1) {
      const gap = Math.abs(y - roadY(row));
      if (gap < best.distance) best = { x, y: roadY(row), angle: 0, distance: gap };
    }
    for (let column = 0; column < cols; column += 1) {
      const gap = Math.abs(x - roadX(column));
      if (gap < best.distance) best = { x: roadX(column), y, angle: Math.PI / 2, distance: gap };
    }
    return best;
  }

  /** A lane point and heading a car can be dropped at, by node and direction. */
  function laneSpawn(nodeIndexValue, direction, along = 0) {
    const node = nodes[nodeIndexValue];
    const vector = DIR_VECTORS[direction];
    const offset = DIR_VECTORS[(direction + 1) % 4];
    return {
      x: node.x + vector.x * along + offset.x * laneOffset,
      y: node.y + vector.y * along + offset.y * laneOffset,
      angle: direction === DIR_EAST ? 0 : direction === DIR_SOUTH ? Math.PI / 2 : direction === DIR_WEST ? Math.PI : -Math.PI / 2,
    };
  }

  /** The stop line, in lane coordinates, a car must not pass on red. */
  function stopLine(node, direction) {
    const vector = DIR_VECTORS[direction];
    return { x: node.x - vector.x * (half + 10), y: node.y - vector.y * (half + 10) };
  }

  return {
    cols,
    rows,
    cell,
    road,
    half,
    laneOffset,
    roadX,
    roadY,
    nodeIndex,
    nodes,
    blocks,
    lightState,
    nearestNode,
    route,
    onRoad,
    nearestLanePoint,
    laneSpawn,
    stopLine,
    width: CITY.width,
    height: CITY.height,
    turn: (angle) => ((angle % TAU) + TAU) % TAU,
    bounds: { minX: roadX(0) - half, maxX: roadX(cols - 1) + half, minY: roadY(0) - half, maxY: roadY(rows - 1) + half },
  };
}

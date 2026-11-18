// Small geometry and vector helpers shared by the simulation and the drawing code. Nothing
// here touches the canvas or the clock.

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

/** Frame-rate independent easing: the fraction of the way to move in `dt` seconds. */
export function damp(from, to, rate, dt) {
  return lerp(from, to, 1 - Math.exp(-rate * dt));
}

export function approach(value, target, delta) {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function distanceSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function within(ax, ay, bx, by, radius) {
  return distanceSq(ax, ay, bx, by) <= radius * radius;
}

/** The angle wrapped into [-PI, PI). */
export function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped >= Math.PI) wrapped -= TAU;
  while (wrapped < -Math.PI) wrapped += TAU;
  return wrapped;
}

/** Turn `angle` toward `target` by at most `maxStep` radians. */
export function turnToward(angle, target, maxStep) {
  const delta = wrapAngle(target - angle);
  return angle + clamp(delta, -maxStep, maxStep);
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleInRect(x, y, radius, rect) {
  const nearX = clamp(x, rect.x, rect.x + rect.w);
  const nearY = clamp(y, rect.y, rect.y + rect.h);
  return distanceSq(x, y, nearX, nearY) <= radius * radius;
}

/** Push a circle out of a rectangle, returning the corrected point. */
export function resolveCircleRect(x, y, radius, rect) {
  const nearX = clamp(x, rect.x, rect.x + rect.w);
  const nearY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearX;
  const dy = y - nearY;
  const gap = Math.hypot(dx, dy);
  if (gap > radius) return null;
  if (gap > 0.0001) {
    const push = radius - gap;
    return { x: x + (dx / gap) * push, y: y + (dy / gap) * push };
  }
  // The centre is inside the rectangle: leave by the nearest edge.
  const left = x - rect.x;
  const right = rect.x + rect.w - x;
  const top = y - rect.y;
  const bottom = rect.y + rect.h - y;
  const smallest = Math.min(left, right, top, bottom);
  if (smallest === left) return { x: rect.x - radius, y };
  if (smallest === right) return { x: rect.x + rect.w + radius, y };
  if (smallest === top) return { x, y: rect.y - radius };
  return { x, y: rect.y + rect.h + radius };
}

/** A short deterministic hash of a position, used to vary art without storing per-object data. */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function formatMoney(amount) {
  return `$${Math.max(0, Math.round(amount)).toLocaleString('en-US')}`;
}

// A virtual controller. The screenshot scenes drive the game through exactly the same input layer
// a keyboard uses — holding actions, tapping others — so a staged frame is a real frame of play,
// not a posed diorama.

import { createVirtualInput } from '../core/input.js';
import { clamp } from '../core/math2d.js';

/** Wrap the shared virtual pad with a plain on/off setter, which is how the autopilots think. */
export function createPad() {
  const input = createVirtualInput();
  input.set = (action, on) => {
    if (on) input.hold(action);
    else input.release(action);
  };
  input.tap = (action) => input.hold(action);
  input.releaseAll = () => {
    input.clear();
    input.endFrame();
  };
  return input;
}

function wrapAngle(angle) {
  let value = angle % (Math.PI * 2);
  if (value > Math.PI) value -= Math.PI * 2;
  if (value < -Math.PI) value += Math.PI * 2;
  return value;
}

/** Hold the throttle and steer the car toward a point, easing off for sharp turns. */
export function driveToward(game, vehicle, targetX, targetY, input, speedFactor = 1) {
  const desired = Math.atan2(targetY - vehicle.y, targetX - vehicle.x);
  const difference = wrapAngle(desired - vehicle.angle);
  const steer = clamp(difference * 2.6, -1, 1);
  input.set('steerRight', steer > 0.12);
  input.set('steerLeft', steer < -0.12);
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  const tooFast = Math.abs(difference) > 0.5 && speed > 240;
  input.set('accelerate', !tooFast && speed < vehicle.type.maxSpeed * 0.86 * speedFactor);
  input.set('reverse', false);
  input.set('handbrake', false);
  return difference;
}

/** Walk toward a point on foot, sprinting when it is far away. */
export function walkToward(game, targetX, targetY, input) {
  const dx = targetX - game.player.x;
  const dy = targetY - game.player.y;
  const distance = Math.hypot(dx, dy);
  input.set('right', dx > 6);
  input.set('left', dx < -6);
  input.set('down', dy > 6);
  input.set('up', dy < -6);
  input.set('sprint', distance > 90);
  return distance;
}

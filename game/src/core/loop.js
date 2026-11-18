// The clock. One fixed simulation step of 1/60 s, replayed as many times as the frame's real
// elapsed time allows, then a single draw. A slow frame is caught up, a stalled one (a hidden
// tab, a breakpoint) is dropped rather than replayed, so the world never lurches.

import { MAX_FRAME, STEP } from './config.js';

export function createLoop(step, draw) {
  let accumulator = 0;
  let last = 0;
  let handle = 0;
  let running = false;

  function frame(now) {
    if (!running) return;
    const seconds = Math.min(MAX_FRAME, (now - last) / 1000 || 0);
    last = now;
    accumulator += seconds;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      step(STEP);
      accumulator -= STEP;
      guard += 1;
    }
    if (guard === 8) accumulator = 0;
    draw(accumulator / STEP);
    handle = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      handle = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(handle);
    },
    get running() {
      return running;
    },
  };
}

/** Run the simulation forward without a display: the screenshot scenes use this to stage a
 *  real game state by actually playing it, rather than by painting a still. */
export function simulateSteps(step, count, onStep) {
  for (let index = 0; index < count; index += 1) {
    step(STEP);
    if (onStep) onStep(index);
  }
}

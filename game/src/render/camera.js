// The camera: it chases the player with a little lead in the direction of travel, settles
// rather than snapping, shakes when something hits hard, and never shows the void outside the
// city. Everything is in logical pixels; the renderer asks it for a transform each frame.

import { CAMERA, VIEW } from '../core/config.js';
import { clamp, damp } from '../core/math2d.js';

export function createCamera() {
  const state = {
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    zoom: 1.12,
    shake: 0,
    shakePhase: 0,
    /** The settled centre; the drawn centre adds the shake on top. */
    targetX: VIEW.width / 2,
    targetY: VIEW.height / 2,
  };

  function focus(x, y, velocityX, velocityY, dt, world) {
    const leadScale = state.leadScale ?? 1;
    const leadX = velocityX * CAMERA.lead * leadScale;
    const leadY = velocityY * CAMERA.lead * leadScale;
    const desiredX = x + clamp(leadX, -CAMERA.lookAhead, CAMERA.lookAhead);
    const desiredY = y + clamp(leadY, -CAMERA.lookAhead, CAMERA.lookAhead);
    state.targetX = desiredX;
    state.targetY = desiredY;
    state.x = damp(state.x, desiredX, CAMERA.smooth, dt);
    state.y = damp(state.y, desiredY, CAMERA.smooth, dt);
    if (world) clampToWorld(world);
  }

  function clampToWorld(world) {
    const halfW = VIEW.width / (2 * state.zoom);
    const halfH = VIEW.height / (2 * state.zoom);
    state.x = clamp(state.x, halfW, world.width - halfW);
    state.y = clamp(state.y, halfH, world.height - halfH);
  }

  function snap(x, y, world) {
    state.x = x;
    state.y = y;
    state.targetX = x;
    state.targetY = y;
    if (world) clampToWorld(world);
  }

  function addShake(amount) {
    state.shake = Math.min(18, state.shake + amount);
  }

  function update(dt) {
    state.shake = Math.max(0, state.shake - dt * 26);
    state.shakePhase += dt * 42;
  }

  /** The centre the frame is drawn around, shake included. */
  function drawnCentre() {
    const falloff = state.shake;
    return {
      x: state.x + Math.sin(state.shakePhase * 1.7) * falloff,
      y: state.y + Math.cos(state.shakePhase * 2.3) * falloff,
    };
  }

  /** The world rectangle the frame shows, grown a little so big art is not cut at the edge. */
  function viewRect(padding = 120) {
    const halfW = VIEW.width / (2 * state.zoom) + padding;
    const halfH = VIEW.height / (2 * state.zoom) + padding;
    return { x: state.x - halfW, y: state.y - halfH, w: halfW * 2, h: halfH * 2 };
  }

  return { state, focus, snap, addShake, update, drawnCentre, viewRect, clampToWorld };
}

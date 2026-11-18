// The wanted level. Crimes add heat; one star is one unit of heat. The level only falls once no
// officer has had eyes on the player for a while, so hiding in an alley is the way out.

import { WANTED } from '../core/config.js';
import { clamp } from '../core/math2d.js';

export const CRIMES = {
  shot: 0.34,
  ped: 1.15,
  carjack: 0.9,
  cop: 2.2,
  copKill: 3,
  heist: 2,
};

export function createWanted() {
  return {
    level: 0,
    heat: 0,
    unseen: 0,
    seen: false,
    flash: 0,
    lastCrime: null,
    lastCrimeAt: -999,
  };
}

export function addWanted(game, amount, reason) {
  const wanted = game.wanted;
  wanted.heat = clamp(wanted.heat + amount, 0, WANTED.max);
  wanted.level = clamp(Math.ceil(wanted.heat), 0, WANTED.max);
  wanted.unseen = 0;
  wanted.seen = true;
  wanted.flash = 1;
  wanted.lastCrime = reason ?? null;
  wanted.lastCrimeAt = game.clock.time;
  if (wanted.level > 0) game.audio?.sirenTone(true, 0);
}

export function stepWanted(game, dt) {
  const wanted = game.wanted;
  wanted.flash = Math.max(0, wanted.flash - dt * 0.8);
  if (wanted.level <= 0) {
    wanted.heat = 0;
    return;
  }
  if (wanted.seen) {
    wanted.unseen = 0;
  } else {
    wanted.unseen += dt;
    if (wanted.unseen > WANTED.decayDelay) {
      wanted.heat = Math.max(0, wanted.heat - dt / WANTED.decaySeconds);
      wanted.level = clamp(Math.ceil(wanted.heat), 0, WANTED.max);
      if (wanted.level === 0) {
        game.addToast('You lost the heat', 'good');
      }
    }
  }
  wanted.seen = false;
}

export function clearWanted(game) {
  game.wanted.heat = 0;
  game.wanted.level = 0;
  game.wanted.unseen = 0;
}

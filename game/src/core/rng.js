// A seeded random number generator (mulberry32) plus the handful of helpers the city
// generator needs: a range, an integer, a pick, a chance and a shuffle. The same seed always
// builds the same city, so a screenshot scene repeats frame for frame.

export function createRandom(seed) {
  let state = (seed | 0) || 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** A float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** An integer in [min, max]. */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    /** One element of the array. */
    pick: (list) => list[Math.min(list.length - 1, Math.floor(next() * list.length))],
    /** True at the given probability. */
    chance: (probability) => next() < probability,
    /** A fresh shuffled copy of the array. */
    shuffle: (list) => {
      const copy = list.slice();
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = Math.floor(next() * (index + 1));
        const held = copy[index];
        copy[index] = copy[other];
        copy[other] = held;
      }
      return copy;
    },
    /** A random sign, -1 or 1. */
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

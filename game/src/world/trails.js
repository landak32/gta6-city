// Tyre marks: a ring of short dark strokes laid under a drifting car and faded out over the
// following seconds, so a handbrake turn leaves a story on the asphalt.

export function createTrails(capacity = 900) {
  const items = [];
  let cursor = 0;

  function push(x, y, angle, alpha, width) {
    const mark = { x, y, angle, alpha, width, age: 0, life: 7 };
    if (items.length < capacity) items.push(mark);
    else {
      items[cursor % capacity] = mark;
      cursor += 1;
    }
  }

  function step(dt) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      items[index].age += dt;
      if (items[index].age >= items[index].life) items.splice(index, 1);
    }
  }

  return { items, push, step, count: items.length, capacity };
}

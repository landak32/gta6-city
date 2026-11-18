// A small pool of sparks, smoke, dust, muzzle flashes and tyre smoke. Particles are plain
// objects in a fixed-size ring, so a busy shootout recycles rather than allocates.

export function createParticles(capacity = 700) {
  const items = [];
  let cursor = 0;

  function push(spec) {
    const particle = {
      x: spec.x,
      y: spec.y,
      vx: spec.vx ?? 0,
      vy: spec.vy ?? 0,
      life: spec.life ?? 0.5,
      age: 0,
      size: spec.size ?? 3,
      color: spec.color ?? '#ffd27a',
      drag: spec.drag ?? 2.2,
      glow: spec.glow ?? false,
      grow: spec.grow ?? 0,
      kind: spec.kind ?? 'spark',
    };
    if (items.length < capacity) items.push(particle);
    else {
      items[cursor % capacity] = particle;
      cursor += 1;
    }
    return particle;
  }

  function step(dt) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const particle = items[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        items.splice(index, 1);
        continue;
      }
      const drag = Math.exp(-particle.drag * dt);
      particle.vx *= drag;
      particle.vy *= drag;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.size += particle.grow * dt;
    }
  }

  function burst(x, y, count, options = {}) {
    for (let index = 0; index < count; index += 1) {
      const angle = (options.angle ?? 0) + (options.spread ?? Math.PI * 2) * (Math.random() - 0.5);
      const speed = (options.speed ?? 120) * (0.4 + Math.random() * 0.8);
      push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: (options.life ?? 0.4) * (0.6 + Math.random() * 0.8),
        size: options.size ?? 2.5,
        color: options.color ?? '#ffd27a',
        glow: options.glow ?? true,
        drag: options.drag ?? 3,
        grow: options.grow ?? 0,
        kind: options.kind ?? 'spark',
      });
    }
  }

  return { items, push, step, burst, clear: () => items.splice(0, items.length) };
}

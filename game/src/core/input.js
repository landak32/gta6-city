// Keyboard and mouse, reduced to the handful of actions the game understands. Held keys are a
// set, keys pressed this step are a second set the loop clears at the end of every step, so a
// tap is never missed and never repeats.

const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  fire: ['KeyJ'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  cycleWeapon: ['KeyQ'],
  interact: ['KeyF'],
  horn: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  stats: ['Tab'],
  retry: ['KeyR'],
  confirm: ['Space', 'Enter'],
};

const CODE_TO_ACTIONS = new Map();
for (const [action, codes] of Object.entries(BINDINGS)) {
  for (const code of codes) {
    if (!CODE_TO_ACTIONS.has(code)) CODE_TO_ACTIONS.set(code, []);
    CODE_TO_ACTIONS.get(code).push(action);
  }
}

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { down: false, pressed: false, x: 0, y: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    const actions = CODE_TO_ACTIONS.get(event.code);
    if (!actions) return;
    if (event.code === 'Tab' || event.code === 'Space') event.preventDefault();
    for (const action of actions) {
      held.add(action);
      pressed.add(action);
    }
  }

  function onKeyUp(event) {
    const actions = CODE_TO_ACTIONS.get(event.code);
    if (!actions) return;
    for (const action of actions) held.delete(action);
  }

  function onBlur() {
    held.clear();
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouse.down = true;
    mouse.pressed = true;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onMouseMove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }

  if (target) {
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onBlur);
    target.addEventListener('mousedown', onMouseDown);
    target.addEventListener('mouseup', onMouseUp);
    target.addEventListener('mousemove', onMouseMove);
  }

  return {
    held,
    pressed,
    mouse,
    down: (action) => held.has(action),
    justPressed: (action) => pressed.has(action),
    /** -1, 0 or 1 along each axis. */
    axisX: () => (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
    axisY: () => (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
    firing: () => held.has('fire') || mouse.down,
    firePressed: () => pressed.has('fire') || mouse.pressed,
    endFrame() {
      pressed.clear();
      mouse.pressed = false;
    },
  };
}

/** A virtual pad: the screenshot autopilot and the mission scripts drive the same actions. */
export function createVirtualInput() {
  const held = new Set();
  const pressed = new Set();
  return {
    held,
    pressed,
    mouse: { down: false, pressed: false, x: 0, y: 0 },
    down: (action) => held.has(action),
    justPressed: (action) => pressed.has(action),
    axisX: () => (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
    axisY: () => (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
    firing: () => held.has('fire'),
    firePressed: () => pressed.has('fire'),
    hold(action) {
      held.add(action);
      pressed.add(action);
    },
    release(action) {
      held.delete(action);
    },
    clear() {
      held.clear();
    },
    endFrame() {
      pressed.clear();
    },
  };
}

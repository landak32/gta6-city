// The application shell: canvas sizing, the menu state machine, the fixed-step loop and the draw
// order. The simulation lives in world/game.js; everything here is plumbing and presentation.

import { createGame, stepGame } from './world/game.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { loadProgress, saveProgress, hasProgress, clearProgress } from './core/save.js';
import { START, VIEW } from './core/config.js';
import { renderWorld } from './render/frame.js';
import { drawHud } from './render/hud.js';
import { drawDialogue } from './render/dialogue.js';
import { drawTitle, drawPause, drawControls, drawStats, drawEndScreen } from './render/screens.js';
import { nightAmount, sunsetAmount } from './render/lighting.js';
import { buildShot } from './render/scenes.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 7) || 7;

const ui = {
  screen: shotName ? 'play' : 'title',
  index: 0,
  items: [],
  hasSave: hasProgress(),
  cost: 0,
};

let game = null;
let shot = null;
let audio = null;
const input = createInput(window);

function sizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(window.innerWidth * ratio));
  canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

function frameOf(game) {
  const hour = game.clock.hour;
  return {
    time: game.clock.time,
    hour,
    night: nightAmount(hour),
    sunset: sunsetAmount(hour),
    width: VIEW.width,
    height: VIEW.height,
  };
}

function titleItems() {
  const items = ['New Game'];
  if (ui.hasSave) items.push('Continue');
  items.push('Controls');
  return items;
}

function pauseItems() {
  return ['Resume', 'Controls', 'Stats', 'Quit to title'];
}

function startNewGame() {
  game = createGame({ seed: Math.floor(Math.random() * 1e6) });
  game.player.x = START.x;
  game.player.y = START.y;
  game.camera.snap(START.x, START.y, game.city);
  if (!audio) audio = createAudio();
  game.audio = audio;
  audio.resume?.();
  ui.screen = 'play';
}

function continueGame() {
  game = createGame({ seed: Math.floor(Math.random() * 1e6) });
  const profile = loadProgress();
  if (profile) {
    game.money = Math.max(0, Math.round(profile.money ?? game.money));
    game.mission.index = Math.min(profile.mission ?? 0, 5);
    if (profile.stats) Object.assign(game.stats, profile.stats);
    if (profile.hour) game.clock.hour = profile.hour;
  }
  game.camera.snap(game.player.x, game.player.y, game.city);
  if (!audio) audio = createAudio();
  game.audio = audio;
  audio.resume?.();
  ui.screen = 'play';
}

function persist() {
  if (!game) return;
  saveProgress({
    money: game.money,
    mission: game.mission.index,
    stats: game.stats,
    hour: game.clock.hour,
  });
  ui.hasSave = true;
}

function choose(index) {
  const label = ui.items[index];
  if (!label) return;
  if (ui.screen === 'title') {
    if (label === 'New Game') startNewGame();
    else if (label === 'Continue') continueGame();
    else if (label === 'Controls') {
      ui.screen = 'controls';
      ui.returnTo = 'title';
    }
  } else if (ui.screen === 'pause') {
    if (label === 'Resume') ui.screen = 'play';
    else if (label === 'Controls') {
      ui.screen = 'controls';
      ui.returnTo = 'pause';
    } else if (label === 'Stats') {
      ui.screen = 'stats';
      ui.returnTo = 'pause';
    } else if (label === 'Quit to title') {
      persist();
      ui.screen = 'title';
      ui.index = 0;
      ui.items = titleItems();
    }
  }
}

function handleMenu() {
  const items = ui.items;
  if (input.justPressed('up') || input.justPressed('left')) {
    ui.index = (ui.index - 1 + items.length) % items.length;
  }
  if (input.justPressed('down') || input.justPressed('right')) {
    ui.index = (ui.index + 1) % items.length;
  }
  if (input.justPressed('confirm') || input.mouse.pressed) choose(ui.index);
  if (ui.screen === 'controls' || ui.screen === 'stats') {
    if (input.justPressed('confirm') || input.justPressed('pause') || input.justPressed('interact')) {
      ui.screen = ui.returnTo ?? 'title';
      ui.index = 0;
      ui.items = ui.screen === 'pause' ? pauseItems() : titleItems();
    }
  }
}

function step(dt) {
  if (!game) return;

  if (shot) {
    shot.think(dt);
    const body = game.player.inVehicle ?? game.player;
    game.camera.focus(body.x, body.y, body.vx ?? 0, body.vy ?? 0, dt, game.city);
    game.camera.update(dt);
    input.endFrame();
    return;
  }

  if (ui.screen === 'title') {
    ui.items = titleItems();
    game.input = null;
    stepGame(game, dt);
    handleMenu();
  } else if (ui.screen === 'play') {
    if (input.justPressed('pause')) {
      ui.screen = 'pause';
      ui.index = 0;
      ui.items = pauseItems();
    } else if (game.mode !== 'play') {
      ui.cost = game.mode === 'busted' ? 300 : 600;
      game.input = null;
      stepGame(game, dt);
    } else {
      game.input = input;
      stepGame(game, dt);
    }
  } else if (ui.screen === 'pause') {
    handleMenu();
  } else {
    handleMenu();
  }

  const body = game.player.inVehicle ?? game.player;
  game.camera.focus(body.x, body.y, body.vx ?? 0, body.vy ?? 0, dt, game.city);
  game.camera.update(dt);
  input.endFrame();
}

function draw() {
  if (!game) return;
  const frame = frameOf(game);
  const scale = Math.max(canvas.width / VIEW.width, canvas.height / VIEW.height);
  const offsetX = (canvas.width - VIEW.width * scale) / 2;
  const offsetY = (canvas.height - VIEW.height * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05080b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  renderWorld(ctx, game, game.camera, frame);

  if (ui.screen === 'play' || shot) {
    drawHud(ctx, game, frame);
    drawDialogue(ctx, game, frame);
    if (game.mode !== 'play') drawEndScreen(ctx, game, frame, game.mode, ui.cost);
  } else if (ui.screen === 'title') {
    drawTitle(ctx, { items: ui.items.length ? ui.items : titleItems(), index: ui.index }, frame);
  } else if (ui.screen === 'pause') {
    drawPause(ctx, { items: ui.items, index: ui.index }, frame);
  } else if (ui.screen === 'controls') {
    drawControls(ctx, frame);
  } else if (ui.screen === 'stats') {
    drawStats(ctx, game, frame);
  }
}

function boot() {
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  if (shotName) {
    shot = buildShot(shotName, seed);
    game = shot.game;
    game.audio = null;
    document.body.classList.add('shot');
  } else {
    game = createGame({ seed });
    game.player.x = START.x;
    game.player.y = START.y;
    game.camera.snap(START.x, START.y, game.city);
    ui.items = titleItems();
  }

  const loop = createLoop(step, draw);
  loop.start();
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM' && audio) audio.toggleMute?.();
});
window.addEventListener('beforeunload', persist);

boot();

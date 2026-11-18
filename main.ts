// Vice Harbor — the entry for make.fun's "Make GTA 6" bounty.
//
// A complete, original top-down open-world crime game. Everything lives in game/ as plain static
// files: game/index.html plus ES modules under game/src/, no build step, no library, no network
// request and no external assets. Every pixel is drawn procedurally on a 2D canvas and every
// sound is synthesised with WebAudio, so the whole city — Calder Heights' towers, the Pier Nine
// docks, the Marisol beach strip, Vane Park and the residential blocks behind it — loads offline.
//
// The simulation is split by job: core/ holds the fixed-step loop, input map, seeded RNG, audio
// synthesis and save file; world/ holds the road grid, districts, buildings and props, the six
// vehicle classes and their arcade physics, the player, combat with real travelling projectiles,
// traffic, pedestrians, police and the wanted level, the six-mission story and the two repeatable
// side jobs; render/ holds the camera, the city and vehicle and character art, the lighting pass,
// the minimap, the HUD, dialogue and menus. game/src/app.js wires them together.
//
// ?shot=chase|foot|drive|mission&seed=N stages a real frame of play (it builds the real game and
// drives it through the same input layer a keyboard would) so the four screenshots in
// screenshots/ are genuine renders, never overlays.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Report the shape of what was handed in, so the console shows the game's weight beside the dossier.
function measureGame(root: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    files += 1;
    bytes += statSync(join(entry.parentPath, entry.name)).size;
  }
  return { files, bytes };
}

const game = measureGame(join(out, 'game'));
const screenshots = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).length : 0;
console.log(
  `Vice Harbor: ${game.files} files, ${(game.bytes / 1024).toFixed(1)} KB of game/, ` +
    `${screenshots} screenshots, dossier.json written to ${join(out, 'dossier.json')}`,
);

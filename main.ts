// Vice Harbor — the make.fun gta6-01 entry program (Node 22, standard library only).
//
// The game is this directory's game/ folder: "Vice Harbor", an original top-down
// open-world crime game that runs as plain static files in a desktop browser — a
// coastal city of avenues, neon-signed buildings, parks and a beach; traffic and
// pedestrians; cars to steal and drive; a five-star wanted system with pursuing
// police; a pistol, fists and car combat; a six-mission story told by five harbour
// characters; taxi fares and lost packages for cash between jobs; a minimap HUD;
// procedural WebAudio sound; and a localStorage save. No library, no build step,
// no network request: game/index.html and its ES modules under game/src/ are the
// whole game, each file with one clear job (city, vehicles, pedestrians, police,
// missions, combat, hud, render, audio, save).
//
// This program hands the entry in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library (vendor/makefun-game.ts, unchanged).
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

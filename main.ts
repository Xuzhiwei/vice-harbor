// Vice Harbor hand-in program (Node 22, no dependencies beyond the kit's
// vendored dossier library). Copies game/ and screenshots/ next to the
// output dossier and writes dossier.json with buildDossier, refusing any
// entry that would break the scorer's caps before it writes anything.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 16 * 1024 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');

function fail(msg: string): never {
  console.error(`vice-harbor hand-in: ${msg}`);
  process.exit(1);
}

function walk(dir: string, base: string, acc: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) walk(full, rel, acc);
    else acc.push(rel);
  }
}

// --- pre-flight checks against the scorer caps -----------------------------
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');

const gameFiles: string[] = [];
walk(gameDir, '', gameFiles);
if (gameFiles.length > CAPS.game_max_files) fail(`game/ holds ${gameFiles.length} files, over the ${CAPS.game_max_files} cap`);
let gameBytes = 0;
for (const rel of gameFiles) {
  gameBytes += statSync(join(gameDir, rel)).size;
  if (Buffer.byteLength(rel, 'utf8') > CAPS.game_path_max_bytes) fail(`game path too long: ${rel}`);
}
if (gameBytes > CAPS.game_max_bytes) fail(`game/ is ${gameBytes} bytes, over the ${CAPS.game_max_bytes} cap`);

const shotFiles = readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort();
if (shotFiles.length === 0) fail('screenshots/ holds no PNG/JPEG screens');
if (shotFiles.length > CAPS.screenshots.max) fail(`${shotFiles.length} screenshots, over the ${CAPS.screenshots.max} cap`);
for (const name of shotFiles) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > CAPS.screenshots.max_bytes) fail(`screenshot ${name} is ${size} bytes, over the ${CAPS.screenshots.max_bytes} cap`);
}

// --- copy + dossier ----------------------------------------------------------
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
const dossier = buildDossier(root, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`vice-harbor: handed in ${gameFiles.length} game files (${gameBytes} bytes), ${shotFiles.length} screenshots, dossier ${dossier.length} bytes -> ${outDir}`);

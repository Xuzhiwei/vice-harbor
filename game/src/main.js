// Vice Harbor — boot and main loop. Wires every module together: player
// movement, driving, combat input, police, missions, HUD, save/load,
// title / pause / busted / wasted flow, and the ?shot= staging mode.
import { DAY_LENGTH, clamp, dist, angleTo } from './config.js';
import { initInput, keys, pressed, mouse, endFrameInput, axisX, axisY, sprintHeld, handbrakeHeld } from './input.js';
import { createWorld, updateParticles, respawnAtHospital, setToast, collideCircle } from './world.js';
import { spawnTraffic, nearestEnterableCar, enterCar, exitCar, updateVehicles } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { createCombat, tryShoot, tryMelee, startReload, updateCombat, hurtPlayer } from './combat.js';
import { createMissionState, currentObjective, updateMissions, updatePackages, advanceDialogue } from './missions.js';
import { renderWorld } from './render.js';
import { cacheHud, updateHud, drawMinimap } from './hud.js';
import { initAudio, sfx, toggleMute, updateMusic } from './audio.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { shotNameFromUrl, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW_W = canvas.width, VIEW_H = canvas.height;
const H = cacheHud();
const shot = shotNameFromUrl();

const G = createWorld(20261120);
const C = createCombat();
G.missions = createMissionState(G);
spawnTraffic(G, 16);
spawnPeds(G, 45);
G.objectiveCache = null;

const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-menu');
const endEl = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endSub = document.getElementById('end-sub');
const continueBtn = document.getElementById('btn-continue');

let saveTimer = 0;
let endShownFor = '';

function applySave(data) {
  if (!data) return;
  G.cash = data.cash ?? G.cash;
  G.totalEarned = data.totalEarned ?? 0;
  G.faresDone = data.faresDone ?? 0;
  if (typeof data.hour === 'number') G.hour = data.hour;
  if (data.player) { G.player.x = data.player.x; G.player.y = data.player.y; }
  if (Array.isArray(data.packages)) {
    G.packagesFound = data.packages.slice();
    for (const pk of G.packages) if (G.packagesFound.includes(pk.id)) pk.taken = true;
  }
  if (typeof data.missionIndex === 'number') {
    G.missions.index = clamp(data.missionIndex, 0, G.missions.defs.length);
    if (G.missions.index >= G.missions.defs.length) G.missions.complete = true;
  }
}

function startGame(fresh) {
  initAudio();
  if (fresh) { clearSave(); }
  else applySave(loadGame());
  G.mode = 'play';
  titleEl.style.display = 'none';
  pauseEl.style.display = 'none';
  sfx.ui();
}

document.getElementById('btn-new').addEventListener('click', () => startGame(true));
continueBtn.addEventListener('click', () => startGame(false));
document.getElementById('btn-resume').addEventListener('click', () => { G.mode = 'play'; pauseEl.style.display = 'none'; });
document.getElementById('btn-quit-title').addEventListener('click', () => {
  pauseEl.style.display = 'none'; G.mode = 'title'; titleEl.style.display = 'flex';
  continueBtn.style.display = loadGame() ? 'block' : 'none';
});
if (!loadGame()) continueBtn.style.display = 'none';

initInput(canvas);

// Shot mode: deterministic warm-up steps, then stage and freeze the sim.
if (shot) {
  G.mode = 'play';
  titleEl.style.display = 'none';
  const step = 1 / 60;
  for (let i = 0; i < 90; i++) {
    G.time += step;
    updateVehicles(G, step, { up: false, down: false, left: false, right: false, handbrake: false });
    updatePeds(G, step);
  }
  stageShot(G, C, shot);
  G.frozen = true;
  G.objectiveCache = currentObjective(G);
}

function playerInputForCar() {
  return {
    up: !!(keys['w'] || keys['arrowup']), down: !!(keys['s'] || keys['arrowdown']),
    left: !!(keys['a'] || keys['arrowleft']), right: !!(keys['d'] || keys['arrowright']),
    handbrake: handbrakeHeld(),
  };
}

function updatePlayerOnFoot(dt) {
  const p = G.player;
  const ax = axisX(), ay = axisY();
  const mag = Math.hypot(ax, ay) || 1;
  const spd = sprintHeld() ? 268 : 168;
  const moving = ax !== 0 || ay !== 0;
  p.vx = moving ? (ax / mag) * spd : 0;
  p.vy = moving ? (ay / mag) * spd : 0;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (moving) { p.angle = Math.atan2(p.vy, p.vx); p.walkPhase += dt; }
  // aim follows the mouse even while walking
  const aimWX = G.camera.x + mouse.x, aimWY = G.camera.y + mouse.y;
  C.aimAngle = angleTo(p.x, p.y, aimWX, aimWY);
  if (!G.dialogue) p.angle = moving ? p.angle : C.aimAngle;
  collideCircle(G, p, p.radius);
}

function handleInteractions() {
  const p = G.player;
  if (pressed['e']) {
    if (p.car) exitCar(G);
    else {
      const car = nearestEnterableCar(G);
      if (car) enterCar(G, car);
    }
  }
  if (pressed['f']) tryMelee(G, C);
  if (pressed['r']) startReload(G, C);
  if (pressed['m']) { const m = toggleMute(); setToast(G, m ? 'Sound off' : 'Sound on'); }
  if (mouse.down && G.mode === 'play' && !p.car) {
    const aimWX = G.camera.x + mouse.x, aimWY = G.camera.y + mouse.y;
    tryShoot(G, C, aimWX, aimWY);
  }
  // interact hint
  const near = !p.car && nearestEnterableCar(G, 52);
  H.interact.style.display = near ? 'block' : 'none';
  if (near) H.interact.textContent = 'E — enter vehicle';
}

function update(dt) {
  G.time += dt;
  G.hour = (G.hour + (dt / DAY_LENGTH) * 24) % 24;
  if (G.mode === 'wasted') {
    G.wastedT = (G.wastedT || 0) + dt;
    if (endShownFor !== 'wasted') { endShownFor = 'wasted'; showEnd('WASTED', 'Harbor General patched you up. Fee $250.'); }
    if (G.wastedT > 2.4) { hideEnd(); respawnAtHospital(G, 250); endShownFor = ''; }
    return;
  }
  if (G.mode === 'busted') {
    if (endShownFor !== 'busted') { endShownFor = 'busted'; showEnd('BUSTED', 'VHPD booked you. Bail & fees apply.'); }
    if (!G.bustedT) G.bustedT = 0;
    G.bustedT += dt;
    if (G.bustedT > 2.6) { hideEnd(); G.bustedT = 0; endShownFor = ''; if (G.mode === 'busted') respawnAtHospital(G, 150 + G.wanted.stars * 40); }
    return;
  }
  if (G.mode !== 'play' && G.mode !== 'dialogue') return;

  if (G.mode === 'dialogue') {
    if (pressed['enter'] || pressed[' '] || mouse.clicked) advanceDialogue(G);
    updatePeds(G, dt * 0.25);
    return;
  }

  handleInteractions();
  if (G.player.car) {
    const car = G.player.car;
    updateVehicles(G, dt, playerInputForCar());
    G.player.x = car.x; G.player.y = car.y;
    if (car.dead) { exitCar(G); hurtPlayer(G, 18); }
  } else {
    updatePlayerOnFoot(dt);
    updateVehicles(G, dt, playerInputForCar());
  }
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, C, dt);
  updateMissions(G, dt);
  updatePackages(G);
  updateParticles(G, dt);
  updateMusic(dt, true);

  // cops shoot back lightly at high heat when player is on foot & close
  if (G.wanted.stars >= 3 && !G.player.car && G.rng() < dt * 0.7) {
    for (const cop of G.cops) {
      if (!cop.dead && dist(cop.x, cop.y, G.player.x, G.player.y) < 240) { hurtPlayer(G, 4); break; }
    }
  }

  if (G.saveNow) { G.saveNow = false; saveGame(G); }
  saveTimer -= dt;
  if (saveTimer <= 0) { saveTimer = 20; saveGame(G); }
}

function showEnd(title, sub) {
  endTitle.textContent = title;
  endSub.textContent = sub;
  endEl.style.display = 'flex';
}
function hideEnd() { endEl.style.display = 'none'; }

function frame() {
  // camera follows player (or car), clamped to the world
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  G.camera.x = clamp(px - VIEW_W / 2, 0, Math.max(0, 3200 - VIEW_W));
  G.camera.y = clamp(py - VIEW_H / 2, 0, Math.max(0, 2400 - VIEW_H));
  if (shot) { /* stageShot pinned the camera */ if (!G.frozen) { /* keep */ } }

  renderWorld(ctx, G, C, VIEW_W, VIEW_H);
  G.objectiveCache = currentObjective(G);
  if (G.mode !== 'title') {
    updateHud(H, G, G.objectiveCache);
    drawMinimap(H, G, G.objectiveCache);
    document.getElementById('hud').style.display = 'block';
  } else {
    document.getElementById('hud').style.display = 'none';
  }
  if (C.hitmark > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.4;
    const cx = mouse.x, cy = mouse.y;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.moveTo(cx + dx * 6, cy + dy * 6); ctx.lineTo(cx + dx * 13, cy + dy * 13); ctx.stroke();
    }
  }
}

let last = performance.now();
function loop(nowMs) {
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  if (pressed['escape']) {
    if (G.mode === 'play') { G.mode = 'pause'; pauseEl.style.display = 'flex'; saveGame(G); }
    else if (G.mode === 'pause') { G.mode = 'play'; pauseEl.style.display = 'none'; }
  }
  if (G.mode === 'play' || G.mode === 'dialogue' || G.mode === 'busted' || G.mode === 'wasted') {
    if (!G.frozen) update(dt);
    else { G.time += dt * 0.35; G.objectiveCache = currentObjective(G); }
  }
  if (pressed['enter'] && G.mode === 'title') startGame(false);
  frame();
  endFrameInput();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

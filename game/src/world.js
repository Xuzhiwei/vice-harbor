// Vice Harbor — the living world: one state object holding the city, the player, every
// car, pedestrian and cruiser, and the fixed-step simulation that moves them all.
import {
  STEP, WORLD_W, WORLD_H, WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, PLAYER_MAX_HEALTH,
  START_CASH, HOSPITAL_FEE, BUST_FINE, DAY_SECONDS, START_MINUTES,
} from './config.js';
import { createCity, createRng, clamp, dist } from './city.js';
import { spawnVehicles, updateTrafficCar, updatePlayerCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { updateWanted, updatePolice } from './police.js';
import { updateCombat, createArmory } from './combat.js';
import { createMissionState, updateMissions, updateTaxi, updatePackages, scatterPackages } from './missions.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

export function createGame(seed, audio) {
  const city = createCity(seed);
  const rng = createRng(seed ^ 0xbeef);
  const state = {
    seed,
    city,
    rng,
    audio,
    screen: 'title',
    time: 0,
    minutes: START_MINUTES,
    player: {
      x: city.specials.pier.x - 60, y: city.specials.pier.y + 30,
      angle: -Math.PI / 2, aimAngle: 0, aiming: false,
      health: PLAYER_MAX_HEALTH, cash: START_CASH,
      inCar: null, walkPhase: 0, muzzle: 0, meleeTime: 0, recoil: 0,
      packagesFound: 0, hurtTime: 0,
    },
    armory: createArmory(),
    cars: [], peds: [], cops: [], bullets: [], particles: [], packages: [],
    heat: 0, hiddenTime: 0, seen: false, copTimer: 0, pinTimer: 0,
    busted: false, wasted: false,
    missions: createMissionState(city),
    dialogue: null, dialogueAdvance: false,
    fare: null, fareTimer: 8,
    toast: null,
    camera: { x: 0, y: 0 },
    shake: 0,
    dirtySave: false,
  };
  spawnVehicles(state);
  spawnPeds(state, 46);
  scatterPackages(state);
  updateCamera(state, 1);
  return state;
}

export function updateCamera(state, dt) {
  const p = state.player;
  const focusX = p.inCar ? p.inCar.x + p.inCar.vx * 0.35 : p.x;
  const focusY = p.inCar ? p.inCar.y + p.inCar.vy * 0.35 : p.y;
  const tx = clamp(focusX - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
  const ty = clamp(focusY - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
  const k = dt <= 0 ? 1 : Math.min(1, dt * 5.5);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
}

function updatePlayerFoot(state, input, dt) {
  const p = state.player;
  const axis = input.moveAxis();
  const moving = axis.x !== 0 || axis.y !== 0;
  if (moving) {
    const len = Math.hypot(axis.x, axis.y);
    const speed = input.sprint() ? SPRINT_SPEED : WALK_SPEED;
    p.x += (axis.x / len) * speed * dt;
    p.y += (axis.y / len) * speed * dt;
    if (!p.aiming) p.angle = Math.atan2(axis.y, axis.x);
    p.walkPhase += dt * (input.sprint() ? 12 : 9);
  }
  const pos = { x: p.x, y: p.y };
  state.city.collideCircle(pos, PLAYER_RADIUS);
  p.x = pos.x; p.y = pos.y;
  // Do not stand inside a car.
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < 26 && d > 0.01) {
      p.x = car.x + ((p.x - car.x) / d) * 26;
      p.y = car.y + ((p.y - car.y) / d) * 26;
    }
  }
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
  }
  // Disabled cars smoke.
  for (const car of state.cars) {
    if (car.dead && Math.random() < dt * 6) {
      state.particles.push({ x: car.x, y: car.y, vx: (Math.random() - 0.5) * 12, vy: -22 - Math.random() * 16, life: 0.9, max: 0.9, size: 6, color: 'rgba(70,70,70,0.45)', kind: 'smoke' });
    } else if (!car.dead && car.health < 32 && Math.random() < dt * 3) {
      state.particles.push({ x: car.x, y: car.y, vx: 0, vy: -14, life: 0.7, max: 0.7, size: 4, color: 'rgba(120,120,120,0.4)', kind: 'smoke' });
    }
  }
}

/** One fixed simulation step of the whole harbour. Input is the live input object. */
export function stepGame(state, input, dt) {
  state.time += dt;
  state.minutes = (state.minutes + dt * (1440 / DAY_SECONDS)) % 1440;
  if (state.toast) {
    state.toast.time -= dt;
    if (state.toast.time <= 0) state.toast = null;
  }
  state.shake = Math.max(0, state.shake - dt * 16);
  state.player.hurtTime = Math.max(0, state.player.hurtTime - dt);

  const p = state.player;
  if (p.inCar) {
    updatePlayerCar(state, p.inCar, input.drive(), dt);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    p.angle = p.inCar.angle;
  } else {
    updatePlayerFoot(state, input, dt);
  }
  for (const car of state.cars) {
    if (car.kind === 'traffic') updateTrafficCar(state, car, dt);
  }
  updatePeds(state, dt);
  updateWanted(state, dt);
  updatePolice(state, dt);
  updateCombat(state, input, dt);
  updateMissions(state, dt);
  updateTaxi(state, dt);
  updatePackages(state);
  updateParticles(state, dt);

  // Slow recovery somewhere safe; the harbour is forgiving between crimes.
  if (state.heat <= 0 && p.health > 0 && p.health < PLAYER_MAX_HEALTH && p.hurtTime <= 0) {
    p.health = Math.min(PLAYER_MAX_HEALTH, p.health + dt * 2.4);
  }
  if (p.health <= 0 && !state.wasted) {
    p.health = 0;
    state.wasted = true;
    state.audio?.busted();
  }
  updateCamera(state, dt);
}

/** After a bust or a wasting: wake up at St Marina, poorer and unhunted. */
export function respawn(state, wasBusted) {
  const p = state.player;
  const fee = wasBusted ? BUST_FINE : HOSPITAL_FEE;
  p.cash = Math.max(0, p.cash - fee);
  if (p.inCar) {
    p.inCar.kind = 'parked';
    p.inCar = null;
  }
  p.health = PLAYER_MAX_HEALTH;
  p.x = state.city.specials.hospital.x;
  p.y = state.city.specials.hospital.y + 10;
  p.angle = Math.PI / 2;
  state.heat = 0;
  state.pinTimer = 0;
  state.busted = false;
  state.wasted = false;
  for (const cop of state.cops) {
    state.cars.splice(state.cars.indexOf(cop), 1);
  }
  state.cops = [];
  state.bullets = [];
  state.missions.active = false;
  state.missions.stage = 0;
  state.fare = null;
  updateCamera(state, 0);
  state.toast = { text: wasBusted ? `Busted — $${fee} fine. The harbour keeps your dignity receipt.` : `St Marina patched you up — $${fee}.`, time: 4 };
}

export { STEP };

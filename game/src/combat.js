// Vice Harbor — fighting: a swinging fist, a pistol that aims where the mouse points,
// tracers and muzzle flash, and damage dealt to pedestrians, cruisers and car bodywork.
import { PLAYER_RADIUS } from './config.js';
import { dist } from './city.js';
import { commitCrime, damageCop } from './police.js';
import { damagePed, scarePeds } from './pedestrians.js';
import { spawnSparks } from './vehicles.js';

export const MAG_SIZE = 12;
export const START_RESERVE = 36;
const FIRE_INTERVAL = 0.21;
const RELOAD_TIME = 1.15;
const BULLET_SPEED = 940;
const BULLET_RANGE = 560;

export function createArmory() {
  return { mag: MAG_SIZE, reserve: START_RESERVE, cooldown: 0, reload: 0 };
}

/** Swing at whatever stands in front of the player. */
export function meleeSwing(state) {
  const p = state.player;
  if (p.inCar || p.meleeTime > 0) return;
  p.meleeTime = 0.32;
  state.audio?.swing();
  const fx = Math.cos(p.angle);
  const fy = Math.sin(p.angle);
  const hx = p.x + fx * 30;
  const hy = p.y + fy * 30;
  for (const ped of state.peds) {
    if (ped.state !== 'down' && dist(ped.x, ped.y, hx, hy) < 30) {
      damagePed(state, ped, 16, p.x, p.y);
      state.audio?.thud();
      return;
    }
  }
  for (const car of state.cars) {
    if (!car.dead && dist(car.x, car.y, hx, hy) < 34) {
      car.health -= 7;
      spawnSparks(state, hx, hy, 4);
      state.audio?.thud();
      if (car.kind !== 'player') commitCrime(state, 20, hx, hy, 'Vandalism reported!');
      return;
    }
  }
}

function fireBullet(state) {
  const p = state.player;
  const arm = state.armory;
  arm.mag -= 1;
  arm.cooldown = FIRE_INTERVAL;
  const spread = (Math.random() - 0.5) * 0.035;
  const a = p.aimAngle + spread;
  state.bullets.push({
    x: p.x + Math.cos(p.aimAngle) * (PLAYER_RADIUS + 7),
    y: p.y + Math.sin(p.aimAngle) * (PLAYER_RADIUS + 7),
    vx: Math.cos(a) * BULLET_SPEED,
    vy: Math.sin(a) * BULLET_SPEED,
    life: BULLET_RANGE / BULLET_SPEED,
  });
  p.muzzle = 0.05;
  p.recoil = 1;
  state.audio?.gunshot();
  scarePeds(state, p.x, p.y, 210);
  commitCrime(state, 34, p.x, p.y, 'Shots fired!');
}

export function updateCombat(state, input, dt) {
  const p = state.player;
  const arm = state.armory;
  arm.cooldown = Math.max(0, arm.cooldown - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.meleeTime = Math.max(0, p.meleeTime - dt);
  p.recoil = Math.max(0, p.recoil - dt * 5);

  if (arm.reload > 0) {
    arm.reload -= dt;
    if (arm.reload <= 0) {
      const take = Math.min(MAG_SIZE - arm.mag, arm.reserve);
      arm.mag += take;
      arm.reserve -= take;
    }
  }

  p.aiming = false;
  if (!p.inCar && state.screen === 'play') {
    const mouse = input.mouse();
    const worldMouseX = state.camera.x + mouse.x;
    const worldMouseY = state.camera.y + mouse.y;
    p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    if (mouse.down) {
      p.aiming = true;
      p.angle = p.aimAngle;
      if (arm.reload <= 0 && arm.cooldown <= 0) {
        if (arm.mag > 0) fireBullet(state);
        else if (arm.reserve > 0) startReload(state);
        else state.audio?.dryFire();
      }
    }
  }

  // Bullets fly, and stop at the first body, car or wall they meet.
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = b.life <= 0;
    if (!hit) {
      for (const ped of state.peds) {
        if (ped.state !== 'down' && dist(ped.x, ped.y, b.x, b.y) < 11) {
          damagePed(state, ped, 34, p.x, p.y);
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const car of state.cars) {
        if (car.dead || car === p.inCar) continue;
        if (dist(car.x, car.y, b.x, b.y) < 23) {
          if (car.kind === 'cop') damageCop(state, car, 26);
          else {
            car.health -= 22;
            commitCrime(state, 26, b.x, b.y, 'You shot up a car!');
            if (car.health <= 0) { car.dead = true; spawnSparks(state, car.x, car.y, 10); }
          }
          spawnSparks(state, b.x, b.y, 3);
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const wall of state.city.buildings) {
        if (b.x > wall.x && b.x < wall.x + wall.w && b.y > wall.y && b.y < wall.y + wall.h) {
          spawnSparks(state, b.x, b.y, 2);
          hit = true;
          break;
        }
      }
    }
    if (hit) state.bullets.splice(i, 1);
  }
}

export function startReload(state) {
  const arm = state.armory;
  if (arm.reload <= 0 && arm.mag < MAG_SIZE && arm.reserve > 0) {
    arm.reload = RELOAD_TIME;
    state.audio?.reload();
  }
}

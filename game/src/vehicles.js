// Vice Harbor — cars: arcade driving for the player, lane-following traffic that
// cruises the avenue/street grid, parked cars waiting to be stolen, and the enter/exit
// dance between on-foot and behind-the-wheel.
import {
  AVENUES, STREETS, ROAD_W, CAR_ACCEL, CAR_MAX_SPEED, CAR_MAX_REVERSE, CAR_TURN,
  CAR_RADIUS, CAR_COLORS, PLAYER_RADIUS,
} from './config.js';
import { clamp, dist } from './city.js';
import { commitCrime } from './police.js';

let nextCarId = 1;

export function createCar(x, y, angle, color, kind) {
  return {
    id: nextCarId += 1,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color,
    kind, // 'traffic' | 'parked' | 'cop' | 'player'
    health: 100,
    dead: false,
    // traffic brain
    dirX: 0, dirY: 1, cruise: 120 + Math.random() * 60,
    stuck: 0,
    // police brain
    sirenPhase: Math.random() * 6,
    // shared
    honk: 0, smoke: 0, entered: false,
  };
}

/** Lane centre for travelling along an avenue (vertical) or street (horizontal). */
export function lanePoint(car) {
  if (car.dirY !== 0) {
    let best = AVENUES[0];
    for (const ax of AVENUES) if (Math.abs(ax - car.x) < Math.abs(best - car.x)) best = ax;
    return { x: best + (car.dirY > 0 ? -19 : 19), y: car.y };
  }
  let best = STREETS[0];
  for (const sy of STREETS) if (Math.abs(sy - car.y) < Math.abs(best - car.y)) best = sy;
  return { x: car.x, y: best + (car.dirX > 0 ? 19 : -19) };
}

function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      const d = dist(x, y, ax, sy);
      if (d < bestD) { bestD = d; best = { x: ax, y: sy }; }
    }
  }
  return best;
}

/** Spawn the ambient fleet: cruisers on the grid plus parked cars in lots and kerbs. */
export function spawnVehicles(state) {
  const { city, rng } = state;
  for (let i = 0; i < 15; i += 1) {
    const p = city.randomRoadPoint(rng);
    const vertical = AVENUES.some((ax) => Math.abs(ax - p.x) < 4);
    const car = createCar(p.x, p.y, 0, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], 'traffic');
    if (vertical) { car.dirY = rng() < 0.5 ? 1 : -1; car.dirX = 0; }
    else { car.dirX = rng() < 0.5 ? 1 : -1; car.dirY = 0; }
    const lane = lanePoint(car);
    car.x = lane.x; car.y = lane.y;
    car.angle = Math.atan2(car.dirY, car.dirX);
    state.cars.push(car);
  }
  for (const lot of city.lots) {
    const count = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const x = lot.x + 34 + (i % 3) * 64 + rng() * 10;
      const y = lot.y + 40 + Math.floor(i / 3) * 74 + rng() * 8;
      const car = createCar(x, y, rng() < 0.5 ? 0 : Math.PI, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], 'parked');
      state.cars.push(car);
    }
  }
  // Kerbside cars along two avenues, easy first steals near the spawn.
  for (let i = 0; i < 8; i += 1) {
    const ax = AVENUES[i % AVENUES.length];
    const y = 420 + i * 210 + rng() * 60;
    const car = createCar(ax + ROAD_W / 2 - 15, y, -Math.PI / 2, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)], 'parked');
    state.cars.push(car);
  }
}

function carVsCars(state, car) {
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    const min = CAR_RADIUS * 2 - 4;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push; car.y += ny * push;
      other.x -= nx * push; other.y -= ny * push;
      const impact = Math.abs(car.speed - other.speed) + Math.hypot(car.vx - other.vx, car.vy - other.vy) * 0.4;
      if (impact > 90) {
        car.health -= impact * 0.05;
        other.health -= impact * 0.05;
        car.speed *= 0.45; other.speed *= 0.45;
        state.shake = Math.min(9, impact * 0.03);
        state.audio?.crash(impact);
        if (car.kind === 'player' || other.kind === 'player') {
          commitCrime(state, 26, car.x, car.y, 'A crash like that gets noticed.');
        }
        spawnSparks(state, (car.x + other.x) / 2, (car.y + other.y) / 2, 7);
      } else {
        car.speed *= 0.8; other.speed *= 0.8;
      }
    }
  }
}

export function spawnSparks(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 40 + Math.random() * 130;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.28 + Math.random() * 0.3, max: 0.55, size: 2.2, color: '#ffd76a', kind: 'spark' });
  }
}

/** Building and world-edge collision for any car; returns the impact speed lost. */
function collideWorld(state, car) {
  const before = Math.abs(car.speed);
  const pos = { x: car.x, y: car.y };
  const hit = state.city.collideCircle(pos, CAR_RADIUS + 2);
  if (hit) {
    car.x = pos.x; car.y = pos.y;
    if (before > 120) {
      car.health -= (before - 120) * 0.05;
      state.audio?.crash(before * 0.7);
      if (car.kind === 'player') {
        state.shake = Math.min(8, before * 0.02);
        state.player.health -= (before - 120) * 0.03;
      }
      spawnSparks(state, car.x, car.y, 5);
    }
    car.speed *= 0.35;
    car.vx *= 0.3; car.vy *= 0.3;
  }
  return hit;
}

/** One traffic car's step: follow its lane, slow for the car ahead, turn at junctions. */
export function updateTrafficCar(state, car, dt) {
  if (car.dead || car.kind !== 'traffic') return;
  // Is there a junction close ahead? Then maybe turn onto the crossing road.
  const aheadX = car.x + car.dirX * 58;
  const aheadY = car.y + car.dirY * 58;
  const junction = nearestIntersection(aheadX, aheadY);
  const nearJunction = junction && dist(aheadX, aheadY, junction.x, junction.y) < 30;
  if (nearJunction && !car.turnedAt) {
    car.turnedAt = junction.x * 10000 + junction.y;
    if (Math.random() < 0.42) {
      if (car.dirY !== 0) { car.dirX = Math.random() < 0.5 ? 1 : -1; car.dirY = 0; }
      else { car.dirY = Math.random() < 0.5 ? 1 : -1; car.dirX = 0; }
    }
  }
  if (!nearJunction) car.turnedAt = 0;

  const lane = lanePoint(car);
  const tx = car.dirX !== 0 ? car.x + car.dirX * 90 : lane.x;
  const ty = car.dirY !== 0 ? car.y + car.dirY * 90 : lane.y;

  // Traffic ahead in the same lane direction?
  let blocked = false;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 62) {
      const dot = ((other.x - car.x) * car.dirX + (other.y - car.y) * car.dirY);
      if (dot > 12) { blocked = true; break; }
    }
  }
  const px = state.player;
  if (!px.inCar && dist(car.x, car.y, px.x, px.y) < 58) {
    const dot = ((px.x - car.x) * car.dirX + (px.y - car.y) * car.dirY);
    if (dot > 8) blocked = true;
  }

  const target = blocked ? 0 : car.cruise;
  car.speed += clamp(target - car.speed, -320 * dt, 170 * dt);
  if (blocked && car.speed < 4 && Math.random() < dt * 0.5) car.honk = 0.7;

  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  collideWorld(state, car);
  carVsCars(state, car);
}

/** The player's car: throttle, steering that bites with speed, handbrake drift. */
export function updatePlayerCar(state, car, drive, dt) {
  const accel = drive.throttle > 0 ? CAR_ACCEL : drive.throttle < 0 ? CAR_ACCEL * 0.72 : 0;
  car.speed += drive.throttle * accel * dt;
  const drag = drive.handbrake ? 1.6 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (drive.throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = clamp(car.speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);

  const grip = drive.handbrake ? 0.35 : 1;
  const steerAuthority = clamp(Math.abs(car.speed) / 60, 0, 1) * Math.sign(car.speed);
  car.angle += drive.steer * CAR_TURN * steerAuthority * dt * (drive.handbrake ? 1.25 : 1);

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  // Velocity chases the heading; with the handbrake down it lags and the car slides.
  car.vx = car.vx * (1 - grip * 6 * dt) + fx * car.speed * grip * 6 * dt;
  car.vy = car.vy * (1 - grip * 6 * dt) + fy * car.speed * grip * 6 * dt;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = (car.vx * fx + car.vy * fy);

  if (Math.abs(car.speed) > 130 && drive.handbrake && Math.random() < dt * 22) {
    state.particles.push({ x: car.x - fx * 16, y: car.y - fy * 16, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 5, color: 'rgba(230,230,230,0.5)', kind: 'smoke' });
  }
  collideWorld(state, car);
  carVsCars(state, car);
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    state.audio?.crash(220);
  }
}

/** Try to get in or out of a car; returns a message for the HUD, or ''. */
export function tryEnterExit(state) {
  const player = state.player;
  if (player.inCar) {
    const car = player.inCar;
    player.inCar = null;
    car.kind = car.wasPlayerKind || 'parked';
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * (CAR_RADIUS + PLAYER_RADIUS + 4);
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * (CAR_RADIUS + PLAYER_RADIUS + 4);
    state.city.collideCircle(player, PLAYER_RADIUS);
    return 'On foot';
  }
  let best = null;
  let bestD = 54;
  for (const car of state.cars) {
    if (car.dead || car.kind === 'cop') continue;
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return '';
  const wasParked = best.kind === 'parked';
  best.wasPlayerKind = wasParked ? 'parked' : 'traffic';
  best.kind = 'player';
  player.inCar = best;
  player.x = best.x; player.y = best.y;
  state.audio?.door();
  if (wasParked || best.speed > 30) {
    commitCrime(state, 42, best.x, best.y, 'Grand theft auto — someone called it in.');
  }
  return wasParked ? 'Car taken' : 'Car jacked!';
}

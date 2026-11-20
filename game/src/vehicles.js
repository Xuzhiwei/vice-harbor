// Vehicles: spawning, arcade driving for the player, lane-following traffic
// AI with junction turns, braking and horns, damage with smoke and sparks.
import { CAR, clamp, dist, wrapAngle, angleTo, pick } from './config.js';
import { AVENUES, STREETS, LANE, isIntersection } from './city.js';
import { collideCircle, spawnParticles } from './world.js';
import { sfx } from './audio.js';
import { reportCrime } from './police.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6', '#ff6b9d', '#48dbfb'];
const CAR_KINDS = [
  { kind: 'sedan', w: 44, h: 21, top: 400 },
  { kind: 'taxi', w: 44, h: 21, top: 400, color: '#f7b731' },
  { kind: 'coupe', w: 42, h: 19, top: 470 },
  { kind: 'van', w: 52, h: 24, top: 340 },
  { kind: 'pickup', w: 50, h: 23, top: 380 },
];
let nextCarId = 1;

export function makeCar(G, x, y, angle, opts = {}) {
  const base = opts.kind ? CAR_KINDS.find(k => k.kind === opts.kind) : pick(G.rng, CAR_KINDS);
  const car = {
    id: nextCarId++, x, y, angle, vx: 0, vy: 0, speed: 0, steer: 0,
    w: base.w, h: base.h, topSpeed: base.top, kind: base.kind,
    color: opts.color || base.color || pick(G.rng, CAR_COLORS),
    health: 100, driver: opts.driver || 'traffic', // traffic | player | cop | parked | none
    // traffic route state
    dirX: Math.round(Math.cos(angle)), dirY: Math.round(Math.sin(angle)),
    cruise: 120 + G.rng() * 110, hornT: 0, brakeLight: false, dead: false,
    skidL: null, skidR: null,
  };
  if (Math.abs(car.dirX) > 0) car.dirY = 0; else car.dirX = 0;
  if (car.dirX === 0 && car.dirY === 0) car.dirX = 1;
  return car;
}

// Lane centre for a car travelling (dirX,dirY): right-hand traffic.
export function laneTarget(car) {
  if (car.dirX !== 0) { // vertical travel along an avenue
    const ax = nearestOf(AVENUES, car.x);
    return { x: ax + (car.dirY > 0 ? LANE : -LANE) * (car.dirX > 0 ? 1 : -1) * 0 + (car.dirX > 0 ? LANE : -LANE), y: car.y + car.dirX * 300, vertical: true, line: ax };
  }
  const sy = nearestOf(STREETS, car.y);
  return { x: car.x + car.dirY * 300, y: sy + (car.dirY > 0 ? -LANE : LANE), vertical: false, line: sy };
}
function nearestOf(arr, v) { let b = arr[0], bd = Infinity; for (const a of arr) { const d = Math.abs(a - v); if (d < bd) { bd = d; b = a; } } return b; }

// Compute the waypoint a traffic car steers toward, handling lane offset.
export function trafficWaypoint(car) {
  if (car.dirX !== 0) { // moving vertically: x must sit in the correct lane
    const ax = nearestOf(AVENUES, car.x);
    const laneX = ax + (car.dirX > 0 ? LANE : -LANE);
    return { x: laneX, y: car.y + car.dirX * 260 };
  }
  const sy = nearestOf(STREETS, car.y);
  const laneY = sy + (car.dirY > 0 ? -LANE : LANE);
  return { x: car.x + car.dirY * 260, y: laneY };
}

function maybeTurnAtJunction(G, car) {
  if (!isIntersection(car.x, car.y)) return;
  if (car.turnCooldown > 0) return;
  const roll = G.rng();
  if (roll < 0.42) return; // go straight
  const nd = roll < 0.71
    ? { x: -car.dirY, y: car.dirX }
    : { x: car.dirY, y: -car.dirX };
  // Only turn if the new direction stays in the world for a while
  if (car.x + nd.x * 300 < 80 || car.x + nd.x * 300 > 2680) return;
  if (car.y + nd.y * 300 < 80 || car.y + nd.y * 300 > 2320) return;
  car.dirX = nd.x; car.dirY = nd.y;
  car.turnCooldown = 1.6;
}

export function spawnTraffic(G, count) {
  for (let i = 0; i < count; i++) {
    const vertical = G.rng() < 0.55;
    let x, y, dirX = 0, dirY = 0;
    if (vertical) {
      const ax = pick(G.rng, AVENUES);
      dirX = G.rng() < 0.5 ? 1 : -1;
      x = ax + (dirX > 0 ? LANE : -LANE); y = 120 + G.rng() * 2160;
    } else {
      const sy = pick(G.rng, STREETS);
      dirY = G.rng() < 0.5 ? 1 : -1;
      y = sy + (dirY > 0 ? -LANE : LANE); x = 140 + G.rng() * 2400;
    }
    const car = makeCar(G, x, y, Math.atan2(dirX, -dirY) + Math.PI / 2, {});
    car.angle = dirX !== 0 ? (dirX > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirY > 0 ? 0 : Math.PI);
    car.dirX = dirX; car.dirY = dirY; car.turnCooldown = G.rng() * 2;
    car.speed = car.cruise * 0.7;
    G.cars.push(car);
  }
  // Parked cars in lots and along kerbs
  for (const lot of G.city.lots) {
    const n = 3 + Math.floor(G.rng() * 5);
    for (let i = 0; i < n; i++) {
      const car = makeCar(G, lot.x + 34 + (i % 4) * 58, lot.y + 40 + Math.floor(i / 4) * 62, -Math.PI / 2, {});
      car.driver = 'parked'; car.speed = 0;
      G.cars.push(car);
    }
  }
}

export function damageCar(G, car, amount, hx, hy) {
  if (car.dead) return;
  car.health -= amount;
  if (hx !== undefined) spawnParticles(G, hx, hy, amount > 20 ? 10 : 4, '#ffd76a', 170, 0.35, 2.5);
  if (car.health <= 40 && car.health > 0 && G.rng() < 0.4) spawnParticles(G, car.x, car.y, 2, '#666', 40, 0.8, 5);
  if (car.health <= 0) {
    car.dead = true; car.health = 0;
    spawnParticles(G, car.x, car.y, 26, '#ff8c42', 220, 0.7, 4);
    spawnParticles(G, car.x, car.y, 18, '#444', 90, 1.1, 6);
    sfx.crash(true);
    G.shake = Math.max(G.shake, 6);
  }
}

function carCollisions(G, dt) {
  const all = G.cars.concat(G.cops);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const d = dist(a.x, a.y, b.x, b.y);
      const min = 40;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 90) {
          damageCar(G, a, impact * 0.06, (a.x + b.x) / 2, (a.y + b.y) / 2);
          damageCar(G, b, impact * 0.06, (a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.driver === 'player' || b.driver === 'player') { sfx.crash(false); reportCrime(G, 'crash', a.x, a.y, 0.35); G.shake = Math.max(G.shake, 3); }
          a.speed *= 0.55; b.speed *= 0.55;
        }
      }
    }
  }
}

export function updateTrafficCar(G, car, dt) {
  if (car.dead || car.driver !== 'traffic') return;
  car.turnCooldown = Math.max(0, (car.turnCooldown || 0) - dt);
  maybeTurnAtJunction(G, car);
  const wp = trafficWaypoint(car);
  const want = angleTo(car.x, car.y, wp.x, wp.y);
  let diff = wrapAngle(want - car.angle);
  car.steer = clamp(diff * 2.2, -1, 1);
  car.angle += car.steer * 1.9 * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1);

  // Brake for cars ahead, the player, or peds crossing
  let target = car.cruise;
  car.brakeLight = false;
  const fx = car.x + Math.cos(car.angle) * 66, fy = car.y + Math.sin(car.angle) * 66;
  const blockers = G.cars.concat(G.cops, G.player.car ? [G.player.car] : []);
  for (const o of blockers) {
    if (o === car) continue;
    if (dist(fx, fy, o.x, o.y) < 46) { target = 0; car.brakeLight = true; break; }
  }
  if (!car.brakeLight) for (const p of G.peds) {
    if (!p.dead && dist(fx, fy, p.x, p.y) < 40) { target = 0; car.brakeLight = true; break; }
  }
  if (car.brakeLight && car.hornT <= 0 && G.rng() < 0.012) { sfx.horn(); car.hornT = 2.5; }
  car.hornT = Math.max(0, car.hornT - dt);

  if (car.speed < target) car.speed = Math.min(target, car.speed + 190 * dt);
  else car.speed = Math.max(target, car.speed - 420 * dt);
  car.speed = Math.min(car.speed, car.topSpeed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideCircle(G, car, 20);
  if (car.x > 2700) { car.x = 2700; car.dirX = 0; car.dirY = car.y < 1200 ? 1 : -1; }
}

export function updatePlayerCar(G, car, input, dt) {
  const fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steerIn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const moving = Math.abs(car.speed);
  if (fwd > 0) car.speed += CAR.accel * dt * (1 - moving / (car.topSpeed * 1.25));
  else if (fwd < 0) {
    if (car.speed > 12) { car.speed -= CAR.brake * dt; car.brakeLight = true; }
    else car.speed = Math.max(-CAR.reverseMax, car.speed - 200 * dt);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(moving, 60 * dt);
    car.brakeLight = false;
  }
  if (fwd >= 0) car.brakeLight = fwd < 0;
  const grip = input.handbrake ? CAR.driftGrip : CAR.grip;
  const steerAuthority = clamp(moving / 130, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerIn * CAR.turnRate * steerAuthority * dt * (input.handbrake ? 1.25 : 1);
  const vx = Math.cos(car.angle) * car.speed, vy = Math.sin(car.angle) * car.speed;
  car.vx = (car.vx || 0) + (vx - (car.vx || 0)) * Math.min(1, grip * dt);
  car.vy = (car.vy || 0) + (vy - (car.vy || 0)) * Math.min(1, grip * dt);
  const px = car.x, py = car.y;
  car.x += car.vx * dt; car.y += car.vy * dt;
  const before = car.health;
  collideCircle(G, car, 21);
  const hitWall = Math.abs(car.x - px - car.vx * dt) > 2 || Math.abs(car.y - py - car.vy * dt) > 2;
  if (hitWall && moving > 150) {
    damageCar(G, car, moving * 0.045, car.x, car.y);
    car.speed *= 0.5; sfx.crash(false); G.shake = Math.max(G.shake, 4);
    if (before !== car.health) reportCrime(G, 'crash', car.x, car.y, 0.3);
  }
  // Skid marks while drifting or launching hard
  const lateral = Math.abs(-Math.sin(car.angle) * car.vx + Math.cos(car.angle) * car.vy);
  if ((input.handbrake && moving > 90) || lateral > 95) {
    const bx = Math.cos(car.angle), by = Math.sin(car.angle);
    const sx = -by, sy = bx;
    G.skids.push({ x: car.x - bx * 14 + sx * 10, y: car.y - by * 14 + sy * 10, life: 7 });
    G.skids.push({ x: car.x - bx * 14 - sx * 10, y: car.y - by * 14 - sy * 10, life: 7 });
    if (G.rng() < 0.3) spawnParticles(G, car.x - bx * 16, car.y - by * 16, 1, '#ddd', 40, 0.5, 4);
  }
  if (car.health <= 35 && G.rng() < 0.35) spawnParticles(G, car.x, car.y - 4, 1, '#555', 30, 0.9, 6);
  sfx.engine(clamp(moving / car.topSpeed, 0, 1));
}

export function updateVehicles(G, dt, input) {
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
    else if (car.driver === 'player') updatePlayerCar(G, car, input, dt);
  }
  carCollisions(G, dt);
}

// Enter / exit ------------------------------------------------------------
export function nearestEnterableCar(G, range = 52) {
  let best = null, bd = range;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
export function enterCar(G, car) {
  const wasTraffic = car.driver === 'traffic';
  car.driver = 'player'; car.speed = car.speed || 0;
  G.player.car = car;
  G.player.x = car.x; G.player.y = car.y;
  sfx.door();
  if (wasTraffic) reportCrime(G, 'theft', car.x, car.y, 1); // stealing a driven car is a witnessed crime
  G.stats.carsStolen++;
}
export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.driver = 'none'; car.wasTraffic = false;
  G.player.car = null;
  G.player.x = car.x - Math.sin(car.angle) * 30;
  G.player.y = car.y + Math.cos(car.angle) * 30;
  sfx.door();
}

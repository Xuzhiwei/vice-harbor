// Pedestrians: ~45 walkers who stroll the sidewalks, cross at crossings,
// chat in pairs, and flee from danger, gunfire and speeding cars.
import { clamp, dist, angleTo, wrapAngle, pick } from './config.js';
import { AVENUES, STREETS, ROAD_W, STREET_W, sidewalkOffset } from './city.js';
import { collideCircle, spawnParticles } from './world.js';
import { reportCrime } from './police.js';
import { sfx } from './audio.js';

const SHIRTS = ['#ff6b81', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#5f27cd', '#c8d6e5', '#fd79a8'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

function spawnOnePed(G, evening) {
  const vertical = G.rng() < 0.55;
  const side = G.rng() < 0.5 ? -1 : 1;
  let x, y;
  if (vertical) {
    const ax = pick(G.rng, AVENUES);
    x = ax + side * sidewalkOffset(); y = 100 + G.rng() * 2200;
  } else {
    const sy = pick(G.rng, STREETS);
    y = sy + side * (STREET_W / 2 + 15); x = 120 + G.rng() * 2500;
  }
  G.peds.push({
    x, y, angle: G.rng() * Math.PI * 2, speed: 0,
    walkSpeed: 52 + G.rng() * 42, phase: G.rng() * 9,
    shirt: pick(G.rng, SHIRTS), skin: pick(G.rng, SKINS),
    health: 100, dead: false, state: 'stroll', panicT: 0,
    targetX: x, targetY: y, retargetT: G.rng() * 4, vertical, side,
    screamT: 0, evening, hidden: false,
  });
}

export function spawnPeds(G, count = 45) {
  for (let i = 0; i < count; i++) spawnOnePed(G, false);
  // Evening crowd: extra walkers who only come out from late afternoon
  // to late night, when the neon is on — the streets feel busier at dusk.
  const eveningCount = Math.round(count * 0.35);
  for (let i = 0; i < eveningCount; i++) spawnOnePed(G, true);
}

function pickStrollTarget(G, p) {
  // Walk along the current sidewalk; occasionally cross the street.
  const along = 140 + G.rng() * 320;
  if (p.vertical) {
    p.targetY = clamp(p.y + (G.rng() < 0.5 ? -along : along), 70, 2330);
    p.targetX = p.x;
    if (G.rng() < 0.12) p.targetX = p.x + (p.side > 0 ? -1 : 1) * (ROAD_W + 34); // cross avenue
  } else {
    p.targetX = clamp(p.x + (G.rng() < 0.5 ? -along : along), 90, 2660);
    p.targetY = p.y;
    if (G.rng() < 0.12) p.targetY = p.y + (p.side > 0 ? -1 : 1) * (STREET_W + 32);
  }
  p.retargetT = 3 + G.rng() * 5;
}

export function scarePeds(G, x, y, radius, cause) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee'; p.panicT = 2.2 + G.rng() * 1.6;
      p.fleeX = x; p.fleeY = y;
      if (cause === 'gunfire' || cause === 'hit') reportCrime(G, cause === 'hit' ? 'assault' : 'gunfire', x, y, 0.8);
    }
  }
}

export function hurtPed(G, p, amount, hx, hy) {
  if (p.dead) return;
  p.health -= amount;
  spawnParticles(G, hx ?? p.x, hy ?? p.y, 6, '#c0392b', 120, 0.4, 3);
  p.state = 'flee'; p.panicT = 3; p.fleeX = G.player.x; p.fleeY = G.player.y;
  if (p.health <= 0) {
    p.dead = true; p.health = 0;
    spawnParticles(G, p.x, p.y, 14, '#c0392b', 130, 0.6, 3.5);
  }
}

export function updatePeds(G, dt) {
  const playerSpeed = G.player.car ? Math.abs(G.player.car.speed) : 0;
  for (const p of G.peds) {
    if (p.dead) continue;
    // The evening crowd keeps evening hours: out 16:30–23:36, else home.
    if (p.evening) {
      p.hidden = !(G.hour >= 16.5 && G.hour <= 23.6);
      if (p.hidden) continue;
    }
    // Danger sense: fast car or armed chaos nearby
    const nearCar = G.player.car && dist(p.x, p.y, G.player.car.x, G.player.car.y) < 90 && playerSpeed > 200;
    if (nearCar && p.state !== 'flee') { p.state = 'flee'; p.panicT = 1.4; p.fleeX = G.player.car.x; p.fleeY = G.player.car.y; }

    let tx, ty, spd;
    if (p.state === 'flee') {
      p.panicT -= dt;
      const away = angleTo(p.fleeX, p.fleeY, p.x, p.y);
      tx = p.x + Math.cos(away) * 120; ty = p.y + Math.sin(away) * 120;
      spd = 178;
      if (p.panicT <= 0) { p.state = 'stroll'; pickStrollTarget(G, p); }
    } else {
      p.retargetT -= dt;
      if (p.retargetT <= 0 || dist(p.x, p.y, p.targetX, p.targetY) < 12) pickStrollTarget(G, p);
      tx = p.targetX; ty = p.targetY; spd = p.walkSpeed;
    }
    const want = angleTo(p.x, p.y, tx, ty);
    p.angle += clamp(wrapAngle(want - p.angle), -4 * dt, 4 * dt);
    p.speed = spd;
    p.x += Math.cos(p.angle) * spd * dt;
    p.y += Math.sin(p.angle) * spd * dt;
    p.phase += dt * (spd / 14);
    collideCircle(G, p, 10);

    // Run down by a car?
    for (const car of G.cars.concat(G.cops)) {
      if (Math.abs(car.speed) > 60 && dist(p.x, p.y, car.x, car.y) < 26) {
        hurtPed(G, p, 65, p.x, p.y);
        if (car.driver === 'player') {
          G.stats.pedsHit++;
          reportCrime(G, 'runover', p.x, p.y, 1.2);
          sfx.crash(false); G.shake = Math.max(G.shake, 3);
        }
        p.x += Math.cos(car.angle) * 26; p.y += Math.sin(car.angle) * 26;
      }
    }
  }
}

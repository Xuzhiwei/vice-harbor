// World state: the single game object G every module reads and mutates,
// plus physics helpers (building collision, line of sight) and particles.
import { WORLD_W, WORLD_H, BEACH_X, SEA_X, START_HOUR, PLAYER, makeRng } from './config.js';
import { buildCity } from './city.js';

export function createWorld(seed = 20261120) {
  const city = buildCity(seed);
  const rng = makeRng(seed ^ 0x9e3779b9);
  const G = {
    city, rng,
    time: 0,
    hour: START_HOUR,
    mode: 'title',           // title | play | pause | busted | wasted | dialogue
    player: {
      x: 700, y: 1010, angle: -Math.PI / 2, vx: 0, vy: 0,
      health: PLAYER.health, radius: PLAYER.radius,
      car: null, dead: false, walkPhase: 0, name: 'Rio',
    },
    camera: { x: 0, y: 0 },
    cars: [], peds: [], cops: [],
    heli: null,              // police helicopter state, filled by police.js
    garage: { owned: false, storedCar: null },
    bullets: [], casings: [], particles: [], skids: [], tracers: [],
    wanted: { stars: 0, heat: 0, lastSeenX: 0, lastSeenY: 0, lastSeenT: -99, bustedMeter: 0, unseenT: 0 },
    cash: 120, totalEarned: 0, faresDone: 0,
    ammo: { mag: 12, reserve: 48 },
    packages: [], packagesFound: [],
    missions: null,          // filled by missions.js
    fare: null,
    dialogue: null,
    banner: '', bannerT: 0,
    toast: '', toastT: 0,
    shake: 0,
    stats: { shotsFired: 0, carsStolen: 0, pedsHit: 0 },
  };
  // 20 lost packages scattered on footpaths and the beach
  for (let i = 0; i < 20; i++) {
    let x = 0, y = 0, ok = false;
    while (!ok) {
      x = 120 + rng() * (BEACH_X - 160);
      y = 100 + rng() * (WORLD_H - 200);
      ok = !pointInBuilding(G, x, y, 6);
    }
    G.packages.push({ id: i, x, y, taken: false, bob: rng() * Math.PI * 2 });
  }
  return G;
}

export function pointInBuilding(G, x, y, pad = 0) {
  for (const b of G.city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Push a circle out of every building AABB and the world bounds / sea.
export function collideCircle(G, e, r) {
  for (const b of G.city.buildings) {
    if (e.x > b.x - r && e.x < b.x + b.w + r && e.y > b.y - r && e.y < b.y + b.h + r) {
      const dxl = e.x - (b.x - r), dxr = (b.x + b.w + r) - e.x;
      const dyt = e.y - (b.y - r), dyb = (b.y + b.h + r) - e.y;
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) e.x = b.x - r; else if (m === dxr) e.x = b.x + b.w + r;
      else if (m === dyt) e.y = b.y - r; else e.y = b.y + b.h + r;
      if (e.vx !== undefined) { if (m === dxl || m === dxr) e.vx *= -0.25; if (m === dyt || m === dyb) e.vy *= -0.25; }
    }
  }
  if (e.x < r + 8) e.x = r + 8;
  if (e.y < r + 8) e.y = r + 8;
  if (e.y > WORLD_H - r - 8) e.y = WORLD_H - r - 8;
  if (e.x > SEA_X + 60) e.x = SEA_X + 60; // wading limit
}

// Line of sight blocked by buildings only (good enough at this scale).
export function hasLineOfSight(G, ax, ay, bx, by) {
  const steps = 14;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBuilding(G, ax + (bx - ax) * t, ay + (by - ay) * t, -4)) return false;
  }
  return true;
}

export function spawnParticles(G, x, y, n, color, speed = 130, life = 0.5, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2, s = speed * (0.3 + G.rng() * 0.9);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.5 + G.rng()), maxLife: life, color, size: size * (0.6 + G.rng() * 0.8),
    });
  }
}
export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.tracers.length - 1; i >= 0; i--) { G.tracers[i].life -= dt; if (G.tracers[i].life <= 0) G.tracers.splice(i, 1); }
  for (let i = G.casings.length - 1; i >= 0; i--) {
    const c = G.casings[i]; c.life -= dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 300 * dt;
    if (c.life <= 0) G.casings.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i--) { G.skids[i].life -= dt; if (G.skids[i].life <= 0) G.skids.splice(i, 1); }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.toastT > 0) G.toastT -= dt;
}

export function setBanner(G, text) { G.banner = text; G.bannerT = 4.2; }
export function setToast(G, text) { G.toast = text; G.toastT = 3.2; }
export function addCash(G, amount) {
  G.cash += amount;
  if (amount > 0) G.totalEarned += amount;
}

// Hospital respawn shared by BUSTED and WASTED.
export function respawnAtHospital(G, fee) {
  const h = G.city.places.hospital;
  G.cash = Math.max(0, G.cash - fee);
  G.player.x = h.x; G.player.y = h.y + 70;
  G.player.health = PLAYER.health;
  G.player.car = null; G.player.dead = false;
  G.wanted.stars = 0; G.wanted.heat = 0; G.wanted.bustedMeter = 0;
  G.cops.length = 0;
  G.heli = null;
  G.mode = 'play';
}

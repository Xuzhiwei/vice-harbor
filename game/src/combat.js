// Combat: mouse-aimed pistol with tracers, casings, muzzle flash and hit
// markers, plus a short-range melee swing. Handles NPC and car damage.
import { GUN, clamp, dist, angleTo } from './config.js';
import { spawnParticles, pointInBuilding } from './world.js';
import { hurtPed, scarePeds } from './pedestrians.js';
import { damageCar } from './vehicles.js';
import { reportCrime } from './police.js';
import { sfx } from './audio.js';

export function createCombat() {
  return { cooldown: 0, reloading: 0, muzzle: 0, hitmark: 0, aimAngle: 0 };
}

export function tryMelee(G, C) {
  if (C.cooldown > 0 || G.player.car) return;
  C.cooldown = 0.34;
  sfx.melee();
  const px = G.player.x, py = G.player.y;
  for (const p of G.peds) {
    if (!p.dead && dist(px, py, p.x, p.y) < 52) {
      hurtPed(G, p, 34, p.x, p.y);
      reportCrime(G, 'assault', p.x, p.y, 0.9);
      C.hitmark = 0.18;
    }
  }
  scarePeds(G, px, py, 120, 'melee');
}

export function tryShoot(G, C, aimX, aimY) {
  if (G.player.car || C.cooldown > 0 || C.reloading > 0) return;
  if (G.ammo.mag <= 0) { sfx.dryFire(); C.cooldown = 0.25; startReload(G, C); return; }
  G.ammo.mag--;
  G.stats.shotsFired++;
  C.cooldown = GUN.fireInterval;
  C.muzzle = 0.05;
  const px = G.player.x, py = G.player.y;
  const base = angleTo(px, py, aimX, aimY);
  const a = base + (G.rng() - 0.5) * 2 * GUN.spread;
  C.aimAngle = a;
  sfx.gunshot();
  G.shake = Math.max(G.shake, 1.6);
  scarePeds(G, px, py, 300, 'gunfire');
  reportCrime(G, 'gunfire', px, py, 0.7);

  // Hitscan with building occlusion, sampled along the ray.
  let endX = px + Math.cos(a) * GUN.range, endY = py + Math.sin(a) * GUN.range;
  let hitSomething = false;
  const steps = 46;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = px + (endX - px) * t, y = py + (endY - py) * t;
    if (pointInBuilding(G, x, y, -2)) { endX = x; endY = y; hitSomething = true; spawnParticles(G, x, y, 4, '#d8cfc0', 110, 0.3, 2); break; }
    let consumed = false;
    for (const p of G.peds) {
      if (!p.dead && dist(x, y, p.x, p.y) < 13) {
        hurtPed(G, p, GUN.damage, x, y);
        reportCrime(G, 'assault', x, y, 1);
        C.hitmark = 0.18; sfx.hit();
        endX = x; endY = y; hitSomething = true; consumed = true; break;
      }
    }
    if (consumed) break;
    for (const car of G.cars.concat(G.cops)) {
      if (dist(x, y, car.x, car.y) < 24) {
        damageCar(G, car, GUN.damage, x, y);
        C.hitmark = 0.18; sfx.hit();
        endX = x; endY = y; hitSomething = true; consumed = true; break;
      }
    }
    if (consumed) break;
  }
  G.tracers.push({ x1: px + Math.cos(a) * 20, y1: py + Math.sin(a) * 20, x2: endX, y2: endY, life: 0.07 });
  G.casings.push({ x: px, y: py, vx: Math.cos(a + Math.PI / 2) * 60, vy: Math.sin(a + Math.PI / 2) * 60 - 40, life: 0.7 });
  if (!hitSomething) spawnParticles(G, endX, endY, 2, '#ffe9a8', 60, 0.2, 1.6);
  if (G.ammo.mag === 0) startReload(G, C);
}

export function startReload(G, C) {
  if (C.reloading > 0 || G.ammo.reserve <= 0 || G.ammo.mag >= GUN.magSize) return;
  C.reloading = GUN.reloadTime;
  sfx.reload();
}

export function updateCombat(G, C, dt) {
  C.cooldown = Math.max(0, C.cooldown - dt);
  C.muzzle = Math.max(0, C.muzzle - dt);
  C.hitmark = Math.max(0, C.hitmark - dt);
  if (C.reloading > 0) {
    C.reloading -= dt;
    if (C.reloading <= 0) {
      const need = GUN.magSize - G.ammo.mag;
      const take = Math.min(need, G.ammo.reserve);
      G.ammo.mag += take; G.ammo.reserve -= take;
    }
  }
}

export function hurtPlayer(G, amount) {
  if (G.player.dead || G.mode !== 'play') return;
  G.player.health -= amount;
  G.shake = Math.max(G.shake, 2.5);
  if (G.player.health <= 0) {
    G.player.health = 0; G.player.dead = true;
    G.mode = 'wasted';
    sfx.wasted();
    G.wastedT = 0;
  }
}

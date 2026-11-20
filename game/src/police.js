// Wanted system and police: crimes raise heat when witnessed, cruisers
// spawn at the city edge of vision, pursue with last-seen memory, ram and
// pin the player, and fill the BUSTED meter on sustained close contact.
import { WANTED, HELI, clamp, dist, angleTo, wrapAngle } from './config.js';
import { hasLineOfSight, respawnAtHospital, setBanner, collideCircle } from './world.js';
import { makeCar, damageCar } from './vehicles.js';
import { sfx } from './audio.js';

const CRIME_HEAT = { theft: 1, crash: 0.5, runover: 1.6, assault: 0.8, gunfire: 0.9, mission: 1.2 };

export function witnessNear(G, x, y, radius = 340) {
  // A crime counts if a ped or a cop can plausibly see it.
  for (const p of G.peds) if (!p.dead && dist(p.x, p.y, x, y) < radius && hasLineOfSight(G, p.x, p.y, x, y)) return true;
  for (const c of G.cops) if (dist(c.x, c.y, x, y) < radius + 120) return true;
  return false;
}

export function reportCrime(G, kind, x, y, scale = 1) {
  if (!witnessNear(G, x, y)) return false;
  const heat = (CRIME_HEAT[kind] || 0.5) * scale;
  G.wanted.heat += heat;
  G.wanted.lastSeenX = x; G.wanted.lastSeenY = y; G.wanted.lastSeenT = G.time;
  const newStars = clamp(Math.floor(G.wanted.heat), 0, WANTED.maxStars);
  if (newStars > G.wanted.stars) { G.wanted.stars = newStars; sfx.phone(); }
  return true;
}

export function forceStars(G, n) {
  G.wanted.stars = clamp(n, 0, WANTED.maxStars);
  G.wanted.heat = Math.max(G.wanted.heat, n + 0.2);
  G.wanted.lastSeenX = G.player.x; G.wanted.lastSeenY = G.player.y;
  G.wanted.lastSeenT = G.time;
}

// Police helicopter --------------------------------------------------------
// Air support joins at HELI.minStars. It is pressure, not a weapon: it
// never shoots and never lands — it shadows you, and while its crew has
// eyes on you the last-seen point stays fresh and the heat cannot decay.
// Break its line of sight (duck behind a building) and it hunts the
// last-seen point like everyone else; cool the stars and it peels off.
function spawnHeli(G) {
  const a = G.rng() * Math.PI * 2;
  G.heli = {
    x: clamp(G.wanted.lastSeenX + Math.cos(a) * 720, 120, 2920),
    y: clamp(G.wanted.lastSeenY + Math.sin(a) * 720, 100, 2300),
    angle: 0, orbit: G.rng() * Math.PI * 2, leaving: false,
    spotX: G.wanted.lastSeenX, spotY: G.wanted.lastSeenY, seesYou: false,
  };
  setBanner(G, 'VHPD air support is on you — break its line of sight.');
}

// Returns true when the helicopter currently sees the player.
export function updateHeli(G, dt) {
  const w = G.wanted;
  if (!G.heli) {
    if (w.stars >= HELI.minStars) spawnHeli(G);
    return false;
  }
  const h = G.heli;
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  if (w.stars >= HELI.minStars) h.leaving = false;
  else if (w.stars <= HELI.leaveStars) h.leaving = true;

  // Where it wants to hover: circling the freshest anchor (the player
  // while the memory is live, else the last-seen point), or home once
  // it peels off.
  let tx, ty;
  if (h.leaving) { tx = -300; ty = h.y; }
  else {
    h.orbit += dt * 0.55;
    const fresh = G.time - w.lastSeenT < WANTED.seenMemory;
    const ax = fresh ? w.lastSeenX : px, ay = fresh ? w.lastSeenY : py;
    tx = ax + Math.cos(h.orbit) * HELI.orbitRadius;
    ty = ay + Math.sin(h.orbit) * HELI.orbitRadius;
  }
  const d = dist(h.x, h.y, tx, ty);
  if (d > 4) {
    const step = Math.min(d, HELI.speed * dt);
    h.x += ((tx - h.x) / d) * step;
    h.y += ((ty - h.y) / d) * step;
    h.angle = angleTo(0, 0, tx - h.x, ty - h.y);
  }
  if (h.leaving && h.x < -200) { G.heli = null; return false; }

  h.seesYou = !h.leaving && dist(h.x, h.y, px, py) < HELI.sightRange && hasLineOfSight(G, h.x, h.y, px, py);
  // The spotlight tracks the player when seen, else sweeps last-seen.
  const sx = h.seesYou ? px : w.lastSeenX, sy = h.seesYou ? py : w.lastSeenY;
  h.spotX += (sx - h.spotX) * Math.min(1, dt * 3.2);
  h.spotY += (sy - h.spotY) * Math.min(1, dt * 3.2);
  return h.seesYou;
}

function desiredCops(G) { return G.wanted.stars <= 0 ? 0 : Math.min(2 + G.wanted.stars, 7); }

function spawnCop(G) {
  // Spawn off-screen on a road near the player's last seen position.
  const a = G.rng() * Math.PI * 2;
  const d = 560 + G.rng() * 160;
  let x = clamp(G.wanted.lastSeenX + Math.cos(a) * d, 140, 2620);
  let y = clamp(G.wanted.lastSeenY + Math.sin(a) * d, 120, 2280);
  const cop = makeCar(G, x, y, angleTo(x, y, G.wanted.lastSeenX, G.wanted.lastSeenY), { kind: 'sedan', color: '#2c3e50' });
  cop.driver = 'cop'; cop.isCop = true; cop.cruise = 999; cop.topSpeed = 480;
  cop.speed = 200; cop.sirenPhase = G.rng() * 9;
  G.cops.push(cop);
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;

  // Vision: any cop — or the helicopter — with LOS refreshes last-seen;
  // otherwise memory fades. The heli's gaze also pins the heat in place.
  let seen = false;
  for (const c of G.cops) {
    if (!c.dead && dist(c.x, c.y, px, py) < 430 && hasLineOfSight(G, c.x, c.y, px, py)) seen = true;
  }
  if (updateHeli(G, dt)) seen = true;
  if (seen) { w.lastSeenX = px; w.lastSeenY = py; w.lastSeenT = G.time; w.unseenT = 0; }
  else w.unseenT += dt;

  // Heat decay while unseen
  if (w.stars > 0 && w.unseenT > 2.5) {
    w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * dt * 3);
    const ns = clamp(Math.floor(w.heat + 0.001), 0, WANTED.maxStars);
    if (ns < w.stars) { w.stars = ns; if (ns === 0) setBanner(G, 'You lost the heat.'); }
  }

  // Spawn / despawn to match pressure
  const want = desiredCops(G);
  if (G.cops.filter(c => !c.dead).length < want && w.stars > 0) {
    G.copSpawnT = (G.copSpawnT || 0) - dt;
    if (G.copSpawnT <= 0) { spawnCop(G); G.copSpawnT = 1.4; }
  }
  for (let i = G.cops.length - 1; i >= 0; i--) {
    if (G.cops[i].dead && dist(G.cops[i].x, G.cops[i].y, px, py) > 700) G.cops.splice(i, 1);
    else if (w.stars === 0 && dist(G.cops[i].x, G.cops[i].y, px, py) > 620) G.cops.splice(i, 1);
  }

  // Pursuit driving
  let closeContact = false;
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const tx = (G.time - w.lastSeenT < WANTED.seenMemory || seen) ? w.lastSeenX : cop.wanderX ?? px;
    const ty = (G.time - w.lastSeenT < WANTED.seenMemory || seen) ? w.lastSeenY : cop.wanderY ?? py;
    if (G.time - w.lastSeenT >= WANTED.seenMemory && !cop.wanderX) {
      cop.wanderX = clamp(w.lastSeenX + (G.rng() - 0.5) * 700, 120, 2640);
      cop.wanderY = clamp(w.lastSeenY + (G.rng() - 0.5) * 700, 100, 2300);
    }
    if (seen) { cop.wanderX = null; cop.wanderY = null; }
    const want = angleTo(cop.x, cop.y, tx, ty);
    const diff = wrapAngle(want - cop.angle);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const d = dist(cop.x, cop.y, tx, ty);
    const top = cop.topSpeed * (d < 90 ? 0.35 : 1);
    cop.speed = Math.min(top, cop.speed + 330 * dt);
    if (d < 34) cop.speed = Math.max(0, cop.speed - 300 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    const beforeX = cop.x, beforeY = cop.y;
    collideCircle(G, cop, 21);
    if (Math.abs(cop.speed) > 200 && Math.abs(cop.x - beforeX) < 1 && Math.abs(cop.y - beforeY) < 1) damageCar(G, cop, 4, cop.x, cop.y);
    // Ram damage against player car
    const pc = G.player.car;
    if (pc && dist(cop.x, cop.y, pc.x, pc.y) < 42 && Math.abs(cop.speed) > 130) {
      damageCar(G, pc, 5, pc.x, pc.y);
      cop.speed *= 0.6;
    }
    if (dist(cop.x, cop.y, px, py) < WANTED.bustedRadius && !G.player.car) closeContact = true;
    if (dist(cop.x, cop.y, px, py) < WANTED.bustedRadius + 26 && G.player.car && Math.abs(G.player.car.speed) < 26) closeContact = true;
    if (G.time % 0.5 < dt) sfx.siren(G.time + (cop.sirenPhase || 0));
  }

  // BUSTED meter
  if (w.stars > 0 && closeContact && G.mode === 'play') {
    w.bustedMeter += dt / WANTED.bustedFill;
    if (w.bustedMeter >= 1) {
      G.mode = 'busted'; sfx.busted(); // main loop shows the card and respawns
    }
  } else {
    w.bustedMeter = Math.max(0, w.bustedMeter - dt * 0.7);
  }
}

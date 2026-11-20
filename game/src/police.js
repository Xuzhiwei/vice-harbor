// Vice Harbor — the law: a wanted level fed by witnessed crime, cruisers that hunt,
// ram and box the player in, the busted/wasted endings, and the slow forgiveness of a
// player the police cannot see.
import { HEAT_PER_STAR, HEAT_DECAY, HEAT_HIDDEN_BONUS, MAX_STARS, CAR_MAX_SPEED } from './config.js';
import { clamp, dist } from './city.js';
import { createCar, spawnSparks } from './vehicles.js';

export function wantedStars(state) {
  return clamp(Math.floor(state.heat / HEAT_PER_STAR), 0, MAX_STARS);
}

/**
 * A crime at (x, y). It only counts in full when someone can see it — a pedestrian, a
 * cruiser, or (for the loud ones) simply being near the action. Unwitnessed crime adds
 * a whisper of heat instead.
 */
export function commitCrime(state, amount, x, y, message) {
  if (state.screen !== 'play') return;
  let witnessed = state.cops.length > 0;
  if (!witnessed) {
    for (const ped of state.peds) {
      if (ped.state !== 'down' && dist(ped.x, ped.y, x, y) < 240 && state.city.hasLineOfSight(ped.x, ped.y, x, y)) {
        witnessed = true;
        break;
      }
    }
  }
  const before = wantedStars(state);
  state.heat = clamp(state.heat + (witnessed ? amount : amount * 0.22), 0, MAX_STARS * HEAT_PER_STAR + 60);
  const after = wantedStars(state);
  if (message && (witnessed || after > before)) state.toast = { text: message, time: 2.6 };
  if (after > before) state.audio?.sirenBlip();
}

/** Is any officer currently looking at the player (range + line of sight)? */
export function playerSeen(state) {
  const p = state.player;
  for (const cop of state.cops) {
    if (cop.dead) continue;
    if (dist(cop.x, cop.y, p.x, p.y) < 430 && state.city.hasLineOfSight(cop.x, cop.y, p.x, p.y)) return true;
  }
  return false;
}

function spawnCop(state) {
  const p = state.player;
  for (let tries = 0; tries < 10; tries += 1) {
    const angle = Math.random() * Math.PI * 2;
    const d = 520 + Math.random() * 160;
    const x = p.x + Math.cos(angle) * d;
    const y = p.y + Math.sin(angle) * d;
    const point = state.city.randomRoadPoint(state.rng);
    const sx = clamp(Math.round(x / 8) * 8, 60, 3000);
    const sy = clamp(y, 60, 2100);
    const spot = state.city.isRoad(sx, sy) ? { x: sx, y: sy } : point;
    if (dist(spot.x, spot.y, p.x, p.y) < 380) continue;
    const cop = createCar(spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), '#f4f6f8', 'cop');
    cop.health = 130;
    state.cops.push(cop);
    state.cars.push(cop);
    return;
  }
}

export function updateWanted(state, dt) {
  const stars = wantedStars(state);
  state.seen = playerSeen(state);
  if (stars > 0) {
    if (state.seen) {
      state.hiddenTime = 0;
      state.heat = Math.min(state.heat + dt * 2.2, MAX_STARS * HEAT_PER_STAR + 60);
    } else {
      state.hiddenTime += dt;
      state.heat = Math.max(0, state.heat - (HEAT_DECAY + HEAT_HIDDEN_BONUS * Math.min(3, state.hiddenTime * 0.4)) * dt);
    }
  } else {
    state.hiddenTime = 0;
    state.heat = Math.max(0, state.heat - HEAT_DECAY * dt);
  }

  const wantCops = stars === 0 ? 0 : Math.min(6, stars + 1);
  state.copTimer -= dt;
  if (state.cops.filter((c) => !c.dead).length < wantCops && state.copTimer <= 0) {
    spawnCop(state);
    state.copTimer = 1.6;
  }
  if (stars === 0) {
    // Officers give up and leave the world once the heat is gone.
    for (const cop of state.cops) cop.leaving = true;
  }
}

/** Cruiser pursuit: hunt the player's last seen position, ram a car, pin a pedestrian. */
export function updatePolice(state, dt) {
  const p = state.player;
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    if (cop.dead) {
      cop.smoke += dt;
      continue;
    }
    cop.sirenPhase += dt * 7;
    if (state.seen) {
      cop.lastX = p.x; cop.lastY = p.y; cop.memory = 4;
    } else if (cop.memory > 0) {
      cop.memory -= dt;
    }
    const targetX = cop.memory > 0 || cop.leaving ? (cop.leaving ? cop.x + Math.cos(cop.angle) * 300 : cop.lastX) : p.x;
    const targetY = cop.memory > 0 || cop.leaving ? (cop.leaving ? cop.y + Math.sin(cop.angle) * 300 : cop.lastY) : p.y;

    const d = dist(cop.x, cop.y, p.x, p.y);
    if (cop.leaving && d > 720) {
      state.cops.splice(i, 1);
      state.cars.splice(state.cars.indexOf(cop), 1);
      continue;
    }

    const want = Math.atan2(targetY - cop.y, targetX - cop.x);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const topSpeed = p.inCar ? CAR_MAX_SPEED * 0.94 : 205;
    const pursuit = clamp(d / 130, 0.25, 1) * topSpeed;
    cop.speed += clamp(pursuit - cop.speed, -300 * dt, 190 * dt);
    cop.angle += clamp(diff, -2.5 * dt, 2.5 * dt) * (Math.abs(cop.speed) > 12 ? 1 : 0.3);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.vx = Math.cos(cop.angle) * cop.speed;
    cop.vy = Math.sin(cop.angle) * cop.speed;

    const pos = { x: cop.x, y: cop.y };
    if (state.city.collideCircle(pos, 19)) {
      cop.x = pos.x; cop.y = pos.y;
      cop.speed *= 0.4;
    }
    // Ram the player's car; crowd the player on foot.
    if (p.inCar && d < 40 && Math.abs(cop.speed) > 60) {
      p.inCar.health -= 9;
      p.health -= 2.5;
      cop.speed *= 0.55;
      state.shake = Math.min(10, state.shake + 4);
      state.audio?.crash(130);
      spawnSparks(state, p.x, p.y, 6);
    }
  }

  // The pin: officers close on foot can end it, if the player can't break away.
  const stars = wantedStars(state);
  if (!p.inCar && stars > 0) {
    let near = false;
    for (const cop of state.cops) {
      if (!cop.dead && dist(cop.x, cop.y, p.x, p.y) < 86) near = true;
    }
    if (near && state.seen) {
      state.pinTimer += dt;
      if (state.pinTimer > 2.4) state.busted = true;
    } else {
      state.pinTimer = Math.max(0, state.pinTimer - dt * 1.6);
    }
  } else if (p.inCar) {
    // Boxed in: surrounded and barely moving under pressure counts too.
    const speed = Math.hypot(p.inCar.vx, p.inCar.vy);
    let near = 0;
    for (const cop of state.cops) if (!cop.dead && dist(cop.x, cop.y, p.x, p.y) < 92) near += 1;
    if (stars > 0 && near >= 2 && speed < 26 && state.seen) {
      state.pinTimer += dt;
      if (state.pinTimer > 3) state.busted = true;
    } else {
      state.pinTimer = Math.max(0, state.pinTimer - dt * 1.6);
    }
  }
}

export function damageCop(state, cop, amount) {
  cop.health -= amount;
  if (cop.health <= 0 && !cop.dead) {
    cop.dead = true;
    cop.speed = 0;
    commitCrime(state, 80, cop.x, cop.y, 'You disabled a police cruiser!');
    spawnSparks(state, cop.x, cop.y, 14);
    state.audio?.crash(240);
  }
}

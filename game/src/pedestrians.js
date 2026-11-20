// Vice Harbor — pedestrians: harbour folk strolling the sidewalks, who dive out of the
// way of bad driving and run from gunfire, and who remember nothing but report plenty.
import { PED_SHIRTS, WALK_SPEED } from './config.js';
import { clamp, dist } from './city.js';
import { commitCrime } from './police.js';

export function createPed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 34 + rng() * 30,
    shirt: PED_SHIRTS[Math.floor(rng() * PED_SHIRTS.length)],
    skin: ['#f2c89b', '#c68863', '#8d5a3b', '#6e442a', '#ffd9b3'][Math.floor(rng() * 5)],
    health: 30,
    state: 'walk', // 'walk' | 'flee' | 'down'
    fleeX: 0, fleeY: 0, fleeTime: 0,
    panic: 0, walkPhase: rng() * 6, retarget: 0,
    downTime: 0, reported: false,
  };
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i += 1) {
    const p = state.city.randomSidewalkPoint(state.rng);
    state.peds.push(createPed(p.x, p.y, state.rng));
  }
}

/** Something frightening happened at (x, y): nearby peds run and may report it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeX = x; ped.fleeY = y;
      ped.fleeTime = 2.4 + Math.random() * 1.4;
      ped.panic = 1;
    }
  }
}

export function updatePeds(state, dt) {
  const player = state.player;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.downTime -= dt;
      continue;
    }
    ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);
    let moveX = 0;
    let moveY = 0;
    let speed = ped.speed;

    if (ped.state === 'flee') {
      ped.fleeTime -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      moveX = dx / d; moveY = dy / d;
      speed = WALK_SPEED * 1.55;
      if (ped.fleeTime <= 0) { ped.state = 'walk'; ped.panic = 0; }
    } else {
      ped.retarget -= dt;
      if (ped.retarget <= 0) {
        ped.retarget = 2 + Math.random() * 3;
        // Drift along the nearest sidewalk: pick a heading biased to the road grid.
        const snap = Math.round(ped.angle / (Math.PI / 2)) * (Math.PI / 2);
        ped.angle = snap + (Math.random() - 0.5) * 0.5;
        if (Math.random() < 0.25) ped.angle += Math.PI;
      }
      moveX = Math.cos(ped.angle);
      moveY = Math.sin(ped.angle);
      // Keep to the promenade and sidewalks: steer back if wandering onto the road.
      if (!state.city.isSidewalk(ped.x + moveX * 26, ped.y + moveY * 26) && state.city.isRoad(ped.x + moveX * 26, ped.y + moveY * 26)) {
        ped.angle += Math.PI * 0.9;
        moveX = Math.cos(ped.angle);
        moveY = Math.sin(ped.angle);
      }
    }

    ped.x += moveX * speed * dt;
    ped.y += moveY * speed * dt;
    const pos = { x: ped.x, y: ped.y };
    if (state.city.collideCircle(pos, 9)) {
      ped.angle += Math.PI * 0.75;
    }
    ped.x = pos.x; ped.y = pos.y;
    if (moveX !== 0 || moveY !== 0) ped.angle = Math.atan2(moveY, moveX);

    // Cars are the real danger: a fast car close by makes anyone dive aside.
    for (const car of state.cars) {
      if (car.dead) continue;
      const cs = Math.hypot(car.vx, car.vy);
      if (cs < 40) continue;
      const d = dist(ped.x, ped.y, car.x, car.y);
      if (d < 30) {
        // Struck.
        ped.state = 'down';
        ped.downTime = 6;
        ped.health = 0;
        state.audio?.thud();
        if (car.kind === 'player') {
          player.health -= 2;
          commitCrime(state, 68, ped.x, ped.y, 'You ran someone down!');
          state.shake = Math.min(8, state.shake + 3);
        }
        break;
      }
      if (d < 64 && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeX = car.x; ped.fleeY = car.y;
        ped.fleeTime = 1.1;
      }
    }

    // A drawn gun empties the pavement too.
    if (player.aiming && !player.inCar && dist(ped.x, ped.y, player.x, player.y) < 120 && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeX = player.x; ped.fleeY = player.y;
      ped.fleeTime = 1.6;
    }
  }
}

export function damagePed(state, ped, amount, sourceX, sourceY) {
  if (ped.state === 'down') return;
  ped.health -= amount;
  scarePeds(state, sourceX, sourceY, 150);
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.downTime = 8;
    commitCrime(state, 55, ped.x, ped.y, 'Assault reported!');
  } else {
    ped.state = 'flee';
    ped.fleeX = sourceX; ped.fleeY = sourceY;
    ped.fleeTime = 2.2;
    commitCrime(state, 30, ped.x, ped.y, 'Assault reported!');
  }
}

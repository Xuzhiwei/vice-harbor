// Vice Harbor — the screenshot scenes behind ?shot=cover|chase|mission|night.
// Each stages the real game state (fixed city seed, fixed clock, placed cars and
// cruisers), runs the true simulation forward a little so the frame is alive, then
// pins the principals back into their marks before the picture is taken.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { startDialogue } from './missions.js';
import { updateCamera } from './world.js';

const IDLE = {
  moveAxis: () => ({ x: 0, y: 0 }),
  drive: () => ({ throttle: 0, steer: 0, handbrake: false }),
  sprint: () => false,
  mouse: () => ({ x: 640, y: 400, down: false }),
  takeActions: () => 0,
  takeClick: () => false,
};

const DRIVE = {
  ...IDLE,
  drive: () => ({ throttle: 1, steer: 0, handbrake: false }),
};

function stepN(state, input, n, stepGame) {
  for (let i = 0; i < n; i += 1) stepGame(state, input, STEP);
}

function putPlayerInCar(state, x, y, angle, color) {
  let car = state.cars.find((c) => c.kind === 'parked');
  if (!car) car = state.cars[0];
  car.x = x; car.y = y; car.angle = angle;
  car.vx = 0; car.vy = 0; car.speed = 0;
  car.color = color || car.color;
  car.wasPlayerKind = 'parked';
  car.kind = 'player';
  state.player.inCar = car;
  state.player.x = x; state.player.y = y;
  return car;
}

function addCop(state, x, y, angle) {
  const cop = createCar(x, y, angle, '#f4f6f8', 'cop');
  cop.health = 130;
  state.cops.push(cop);
  state.cars.push(cop);
  return cop;
}

function stageCover(state, stepGame) {
  // Golden hour on the beachfront strip: the camera looks over the lot east
  // of the last avenue — cafe blocks and their neon across the road, traffic
  // rolling both ways, locals on the sidewalks, and the sand and sea closing
  // the right edge of the frame. Jules stands by the car he just stepped
  // out of, mid-frame, with the whole harbour waking up around him.
  state.minutes = 18 * 60 + 36;
  const p = state.player;
  p.x = 2952; p.y = 486; p.angle = -0.35;
  p.inCar = null;
  // The car Jules just stepped out of, parked on the lot a few paces away.
  const car = state.cars.find((c) => c.kind === 'parked');
  if (car) {
    car.x = 3002; car.y = 466; car.angle = 0.12;
    car.vx = 0; car.vy = 0; car.speed = 0;
    car.color = '#e74c3c';
  }
  // Traffic on the avenue, both directions, plus a car crossing on each street.
  const traffic = state.cars.filter((c) => c.kind === 'traffic');
  const marks = [
    { dirX: 0, dirY: 1, x: 2797, y: 268 },
    { dirX: 0, dirY: -1, x: 2835, y: 668 },
    { dirX: 1, dirY: 0, x: 2590, y: 787 },
    { dirX: -1, dirY: 0, x: 2700, y: 237 },
  ];
  const staged = marks.map((mark, i) => {
    const t = traffic[i];
    if (!t) return null;
    Object.assign(t, mark);
    t.angle = Math.atan2(mark.dirY, mark.dirX);
    t.speed = t.cruise;
    return { car: t, mark };
  }).filter(Boolean);
  // Locals strolling the avenue sidewalks, west and east.
  const pedMarks = [
    { x: 2756, y: 430 }, { x: 2754, y: 618 },
    { x: 2876, y: 372 }, { x: 2877, y: 566 },
  ];
  const stagedPeds = pedMarks.map((mark, i) => {
    const ped = state.peds[i];
    if (!ped) return null;
    ped.x = mark.x; ped.y = mark.y;
    ped.state = 'walk'; ped.panic = 0;
    ped.angle = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    return { ped, mark };
  }).filter(Boolean);
  stepN(state, IDLE, 36, stepGame);
  // Re-pin everyone into their marks so the composition is exact.
  p.x = 2952; p.y = 486; p.angle = -0.35;
  if (car) { car.x = 3002; car.y = 466; car.angle = 0.12; car.speed = 0; car.vx = 0; car.vy = 0; }
  for (const s of staged) {
    s.car.x = s.mark.x; s.car.y = s.mark.y;
    s.car.angle = Math.atan2(s.mark.dirY, s.mark.dirX);
    s.car.speed = s.car.cruise;
    s.car.vx = Math.cos(s.car.angle) * s.car.speed;
    s.car.vy = Math.sin(s.car.angle) * s.car.speed;
  }
  for (const s of stagedPeds) {
    s.ped.x = s.mark.x; s.ped.y = s.mark.y;
    s.ped.state = 'walk'; s.ped.panic = 0; s.ped.fleeTime = 0; s.ped.startle = 0;
  }
  state.toast = null; // no pickup/crime toast may photobomb the cover
  updateCamera(state, 0);
}

function stageChase(state, stepGame) {
  state.minutes = 16 * 60 + 42;
  // Mid-story context: the Heat Run's last leg, so the objective line agrees
  // with the four stars and the cruisers on the player's tail.
  const m = state.missions;
  m.index = 3;
  m.active = true;
  m.stage = 2;
  const car = putPlayerInCar(state, 1773, 1560, -Math.PI / 2, '#e74c3c');
  car.speed = 250;
  addCop(state, 1773, 1745, -Math.PI / 2);
  addCop(state, 1830, 1835, -Math.PI / 2);
  addCop(state, 1720, 1905, -Math.PI / 2);
  // A pale delivery van ahead in the right lane: traffic to thread past,
  // so the avenue reads as a living road and not an empty drag strip.
  const van = state.cars.find((c) => c.kind === 'traffic');
  if (van) {
    van.dirX = 0; van.dirY = -1;
    van.x = 1811; van.y = 1210; van.angle = -Math.PI / 2;
    van.speed = 140; van.cruise = 140;
    van.color = '#f7f3e8';
  }
  state.heat = 430;
  stepN(state, DRIVE, 46, stepGame);
  // Re-pin the pursuit into a readable diagonal after the run.
  state.heat = 430;
  const p = state.player;
  if (p.inCar) {
    p.inCar.x = 1773; p.inCar.y = 1420; p.inCar.angle = -Math.PI / 2;
    p.inCar.vx = 0; p.inCar.vy = -250; p.inCar.speed = 250;
    p.x = 1773; p.y = 1420;
  }
  state.cops.forEach((cop, i) => {
    cop.x = 1752 + i * 52;
    cop.y = 1510 + i * 74;
    cop.angle = -Math.PI / 2;
    cop.speed = 240;
  });
  if (van) {
    van.x = 1811; van.y = 1150; van.angle = -Math.PI / 2;
    van.speed = 140; van.vx = 0; van.vy = -140;
  }
  // Speed streaks and a kiss of tyre smoke sell the motion in a still frame.
  for (let i = 0; i < 7; i += 1) {
    state.particles.push({ x: 1773 + (i % 3 - 1) * 14, y: 1450 + i * 13, vx: 0, vy: 60, life: 0.5, max: 0.5, size: 3.4, color: 'rgba(255,255,255,0.65)', kind: 'smoke' });
  }
  state.shake = 2.5;
  updateCamera(state, 0);
}

function stageMission(state, stepGame) {
  state.minutes = 9 * 60 + 38;
  const m = state.missions;
  m.index = 1; // Hot Package
  m.active = true;
  m.stage = 0;
  m.timer = 0;
  startDialogue(state, m.defs[1].intro);
  // Park the player's car on the lot itself, a short roll from the package point.
  const stage = m.defs[1].stages[0];
  putPlayerInCar(state, stage.x - 130, stage.y + 55, 0.5, '#f39c12');
  stepN(state, IDLE, 24, stepGame);
  const p = state.player;
  if (p.inCar) { p.inCar.x = stage.x - 130; p.inCar.y = stage.y + 55; p.inCar.angle = 0.5; p.x = stage.x - 130; p.y = stage.y + 55; }
  startDialogue(state, m.defs[1].intro);
  state.dialogue.i = 1;
  updateCamera(state, 0);
}

function stageNight(state, stepGame) {
  state.minutes = 21 * 60 + 35;
  const club = state.city.specials.club;
  const p = state.player;
  p.x = club.x + 40; p.y = club.y + 66;
  p.angle = 0.65; p.aimAngle = 0.65;
  stepN(state, IDLE, 30, stepGame);
  p.x = club.x + 40; p.y = club.y + 66;
  p.angle = 0.65; p.aimAngle = 0.65; p.aiming = true; p.muzzle = 0.05;
  // A couple of startled locals mid-flee sell the drawn gun.
  state.peds.slice(0, 3).forEach((ped, i) => {
    ped.x = p.x + 90 + i * 42;
    ped.y = p.y + 30 - i * 26;
    ped.state = 'flee';
    ped.fleeX = p.x; ped.fleeY = p.y;
    ped.fleeTime = 3;
    ped.panic = 1;
  });
  updateCamera(state, 0);
}

export function stageShot(name, state, stepGame) {
  state.screen = 'play';
  if (name === 'chase') stageChase(state, stepGame);
  else if (name === 'mission') stageMission(state, stepGame);
  else if (name === 'night') stageNight(state, stepGame);
  else stageCover(state, stepGame);
}

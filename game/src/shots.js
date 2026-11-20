// Deterministic staged scenes for screenshots, selected with ?shot=<name>.
// The world is built from a fixed seed, the sim is stepped a fixed number of
// ticks in main.js, then these pins place the hero actors exactly.
import { forceStars } from './police.js';
import { makeCar } from './vehicles.js';
import { CHARACTERS } from './missions.js';

export function shotNameFromUrl() {
  try { return new URLSearchParams(location.search).get('shot'); }
  catch { return null; }
}

function parkHeroCar(G, x, y, angle, color, kind) {
  const car = makeCar(G, x, y, angle, { kind: kind || 'coupe', color });
  car.driver = 'parked'; car.speed = 0;
  G.cars.push(car);
  return car;
}

export function stageShot(G, C, name) {
  G.mode = 'play';
  if (name === '1-cover' || name === 'cover') {
    G.hour = 17.85;
    // Beachfront downtown: player on foot beside a coupe, marina behind,
    // avenue traffic in frame, beach + sea at the right edge.
    G.player.x = 2475; G.player.y = 1472; G.player.angle = 0.5; G.player.car = null;
    parkHeroCar(G, 2525, 1505, 0.25, '#e74c3c', 'coupe');
    parkHeroCar(G, 2380, 1560, -0.4, '#3498db', 'sedan');
    const t1 = makeCar(G, 2452, 1180, Math.PI / 2, { kind: 'taxi' });
    t1.driver = 'traffic'; t1.dirX = 1; t1.dirY = 0; t1.speed = 130; G.cars.push(t1);
    const t2 = makeCar(G, 2408, 1750, -Math.PI / 2, { kind: 'sedan', color: '#f1c40f' });
    t2.driver = 'traffic'; t2.dirX = -1; t2.dirY = 0; t2.speed = 120; G.cars.push(t2);
    G.cash = 420;
  } else if (name === '2-chase' || name === 'chase') {
    G.hour = 16.9;
    const hero = makeCar(G, 1560, 1310, 0, { kind: 'coupe', color: '#e74c3c' });
    hero.driver = 'player'; hero.speed = 330; hero.vx = 330; hero.vy = 0;
    G.cars.push(hero);
    G.player.car = hero; G.player.x = hero.x; G.player.y = hero.y;
    for (const [dx, dy] of [[-108, -36], [-196, 28], [-292, -12]]) {
      const cop = makeCar(G, hero.x + dx, hero.y + dy, 0, { kind: 'sedan', color: '#2c3e50' });
      cop.driver = 'cop'; cop.isCop = true; cop.speed = 300; cop.sirenPhase = dx;
      G.cops.push(cop);
    }
    forceStars(G, 4);
    // At 4 stars the helicopter joins: pin it up-left of the hero with
    // its spotlight pooled on the fleeing coupe.
    G.heli = {
      x: hero.x - 185, y: hero.y - 165, angle: 0.5, orbit: 0, leaving: false,
      spotX: hero.x + 12, spotY: hero.y, seesYou: true,
    };
    const M = G.missions;
    M.active = { def: M.defs[3], leg: 1, timer: 96 };
    G.banner = 'MISSION: Harbour Lights'; G.bannerT = 999;
    G.cash = 1420;
  } else if (name === '3-mission' || name === 'mission') {
    G.hour = 18.4;
    const P = G.city.places;
    G.player.x = P.club.x - 60; G.player.y = P.club.y + 36; G.player.angle = 2.6; G.player.car = null;
    parkHeroCar(G, 1000, 860, 0.05, '#9b59b6', 'sedan');
    const M = G.missions;
    M.active = { def: M.defs[1], leg: 1, timer: 132 };
    G.dialogue = { lines: M.defs[1].intro, idx: 1, from: 'marisol', onDone: 'start' };
    G.mode = 'dialogue';
    G.cash = 720;
  } else if (name === '4-night' || name === 'night') {
    G.hour = 22.35;
    G.player.x = 1470; G.player.y = 1410; G.player.angle = 0.4; G.player.car = null;
    C.aimAngle = 0.35;
    G.ammo.mag = 9;
    parkHeroCar(G, 1390, 1330, Math.PI / 2, '#37e2ff', 'sedan');
    const t1 = makeCar(G, 1428, 1080, Math.PI / 2, { kind: 'sedan', color: '#ecf0f1' });
    t1.driver = 'traffic'; t1.dirX = 1; t1.dirY = 0; t1.speed = 110; G.cars.push(t1);
    G.cash = 2210;
    G.wanted.stars = 1; G.wanted.heat = 1.2;
  }
  // Snap camera onto the player for a stable frame.
  G.camera.x = G.player.x - 640;
  G.camera.y = G.player.y - 400;
  return name;
}

export { CHARACTERS };

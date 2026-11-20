// Vice Harbor — the city itself: a seeded coastal grid of avenues and streets with
// named buildings, parks, parking lots, palms and a beach, plus the spatial questions
// every other system asks it (is this road? can these two points see each other?).
import {
  AVENUES, STREETS, ROAD_W, SIDEWALK_W, WORLD_W, WORLD_H, SAND_X, WATER_X,
  BUILDING_STYLES,
} from './config.js';

/** mulberry32: one seeded stream per city, so a seed always builds the same harbour. */
export function createRng(seed) {
  let a = seed | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Original Vice Harbor businesses; the generator deals them onto building roofs. */
const SIGN_NAMES = [
  'HOTEL SOLANA', 'CAFE BRISA', 'NEON PALMS MOTEL', 'TACO SOL', 'MARINA DELI',
  'CORAL BOOKS', 'SUNSET GYM', 'PALM PHARMACY', 'BRISA BAKERY', 'THE SALTY ANCHOR',
  'HAVANA PRINT CO', 'CORAL CLEANERS', 'SURF & SAND', 'LA OLA BAR', 'PIER 9 DINER',
  'GOLDEN HOUR CLUB', 'MARLIN MOTORS', 'SEABREEZE INN', 'COCO LOCO', 'TIDE POOL SPA',
  'HARBOR PAWN', 'SOLSTICE RECORDS', 'VELVET REEF', 'CAPTAIN NEMO PIZZA', 'AZUL TRAVEL',
];

/** Fixed story locations, keyed so missions and respawns can find them by name. */
const SPECIALS = [
  { key: 'hospital', name: 'ST MARINA HOSPITAL', col: 0, row: 2, color: '#eef4f8' },
  { key: 'police', name: 'HARBOR POLICE', col: 2, row: 1, color: '#dfe8f2' },
  { key: 'hotel', name: 'HOTEL SOLANA', col: 4, row: 0, color: '#fdf0d5' },
  { key: 'garage', name: 'FERRIS & SONS GARAGE', col: 0, row: 0, color: '#f0e6da' },
  { key: 'club', name: 'GOLDEN HOUR CLUB', col: 3, row: 1, color: '#f3e5f5' },
  { key: 'depot', name: 'BRISA CAB DEPOT', col: 1, row: 2, color: '#fff6d8' },
  { key: 'pier', name: 'PIER 9', col: 4, row: 2, color: '#f7ead9' },
];

/** Block rectangles between the roads: columns sit between avenues, rows between streets. */
function blockRects() {
  const cols = [];
  let prev = 40;
  for (const avenue of AVENUES) {
    cols.push([prev, avenue - ROAD_W / 2 - 10]);
    prev = avenue + ROAD_W / 2 + 10;
  }
  cols.push([prev, SAND_X - 16]);
  const rows = [];
  prev = 40;
  for (const street of STREETS) {
    rows.push([prev, street - ROAD_W / 2 - 10]);
    prev = street + ROAD_W / 2 + 10;
  }
  rows.push([prev, WORLD_H - 40]);
  const rects = [];
  for (let c = 0; c < cols.length; c += 1) {
    for (let r = 0; r < rows.length; r += 1) {
      rects.push({ x: cols[c][0], y: rows[r][0], w: cols[c][1] - cols[c][0], h: rows[r][1] - rows[r][0], col: c, row: r });
    }
  }
  return rects;
}

export function createCity(seed) {
  const rng = createRng(seed ^ 0x51ab);
  const buildings = [];
  const parks = [];
  const lots = [];
  const palms = [];
  const lamps = [];
  const specials = {};
  let signIndex = Math.floor(rng() * SIGN_NAMES.length);

  function nextSign() {
    signIndex = (signIndex + 1 + Math.floor(rng() * 3)) % SIGN_NAMES.length;
    return SIGN_NAMES[signIndex];
  }

  function addBuilding(x, y, w, h, name, forcedColor) {
    const style = BUILDING_STYLES[Math.floor(rng() * BUILDING_STYLES.length)];
    const building = {
      x, y, w, h,
      roof: forcedColor || style.roof,
      wall: style.wall,
      name: name || '',
      floors: 2 + Math.floor(rng() * 5),
      seed: rng() * 1000,
    };
    buildings.push(building);
    return building;
  }

  for (const block of blockRects()) {
    const special = SPECIALS.find((s) => s.col === block.col && s.row === block.row);
    if (special) {
      const bw = Math.min(block.w - 60, 250);
      const bh = Math.min(block.h - 70, 190);
      const b = addBuilding(block.x + (block.w - bw) / 2, block.y + (block.h - bh) / 2, bw, bh, special.name, special.color);
      specials[special.key] = { x: b.x + b.w / 2, y: b.y + b.h + 26, building: b };
      continue;
    }
    const roll = rng();
    if (roll < 0.22) {
      parks.push({ x: block.x, y: block.y, w: block.w, h: block.h });
      const count = 5 + Math.floor(rng() * 6);
      for (let i = 0; i < count; i += 1) {
        palms.push({ x: block.x + 20 + rng() * (block.w - 40), y: block.y + 20 + rng() * (block.h - 40), s: 0.8 + rng() * 0.5, seed: rng() * 10 });
      }
    } else if (roll < 0.42) {
      lots.push({ x: block.x, y: block.y, w: block.w, h: block.h });
    } else {
      const split = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < split; i += 1) {
        for (let j = 0; j < split; j += 1) {
          const bw = (block.w - 30 * (split + 1)) / split;
          const bh = (block.h - 30 * (split + 1)) / split;
          if (bw < 90 || bh < 80) continue;
          addBuilding(block.x + 30 + i * (bw + 30), block.y + 30 + j * (bh + 30), bw, bh, rng() < 0.62 ? nextSign() : '');
        }
      }
    }
  }

  // Palms line the promenade and the beach; lamps stand at every intersection corner.
  for (let y = 90; y < WORLD_H - 60; y += 118) {
    palms.push({ x: SAND_X + 26 + rng() * 30, y, s: 0.9 + rng() * 0.5, seed: rng() * 10 });
    if (rng() < 0.7) palms.push({ x: WATER_X - 44 - rng() * 26, y: y + 50, s: 0.85 + rng() * 0.5, seed: rng() * 10 });
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lamps.push({ x: ax - ROAD_W / 2 - 8, y: sy - ROAD_W / 2 - 8 });
      lamps.push({ x: ax + ROAD_W / 2 + 8, y: sy + ROAD_W / 2 + 8 });
    }
  }
  // Decorative sand speckles and water sparkle anchors, fixed per seed.
  const speckles = [];
  for (let i = 0; i < 260; i += 1) {
    speckles.push({ x: SAND_X + rng() * (WORLD_W - SAND_X), y: rng() * WORLD_H, s: 1 + rng() * 2.4 });
  }

  const intersections = [];
  for (const ax of AVENUES) for (const sy of STREETS) intersections.push({ x: ax, y: sy });

  function isRoad(x, y) {
    if (x >= SAND_X || x < 24 || y < 24 || x > WORLD_W - 24 || y > WORLD_H - 24) return false;
    for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
    return false;
  }

  function isSidewalk(x, y) {
    const edge = ROAD_W / 2 + SIDEWALK_W;
    if (x >= SAND_X - 6) return x < WATER_X - 30;
    for (const ax of AVENUES) if (Math.abs(x - ax) <= edge && Math.abs(x - ax) > ROAD_W / 2) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= edge && Math.abs(y - sy) > ROAD_W / 2) return true;
    return false;
  }

  function isWater(x) {
    return x >= WATER_X;
  }

  /** Buildings are the only hard obstacles; resolve a circle against them. */
  function collideCircle(pos, radius) {
    let hit = false;
    for (const b of buildings) {
      const nx = clamp(pos.x, b.x, b.x + b.w);
      const ny = clamp(pos.y, b.y, b.y + b.h);
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.y = ny + (dy / d) * radius;
        } else {
          // Centre inside the rect: push out through the nearest face.
          const left = pos.x - b.x;
          const right = b.x + b.w - pos.x;
          const top = pos.y - b.y;
          const bottom = b.y + b.h - pos.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = b.x - radius;
          else if (m === right) pos.x = b.x + b.w + radius;
          else if (m === top) pos.y = b.y - radius;
          else pos.y = b.y + b.h + radius;
        }
      }
    }
    pos.x = clamp(pos.x, radius + 4, WORLD_W - radius - 4);
    pos.y = clamp(pos.y, radius + 4, WORLD_H - radius - 4);
    if (pos.x > WATER_X - radius - 6 && pos.y >= 0) pos.x = Math.min(pos.x, WATER_X - radius - 6);
    return hit;
  }

  /** Sight line between two points, blocked only by buildings. */
  function hasLineOfSight(x1, y1, x2, y2) {
    const steps = Math.max(2, Math.ceil(dist(x1, y1, x2, y2) / 42));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (const b of buildings) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
      }
    }
    return true;
  }

  function randomRoadPoint(rand) {
    if (rand() < 0.5) {
      const ax = AVENUES[Math.floor(rand() * AVENUES.length)];
      return { x: ax, y: 90 + rand() * (WORLD_H - 180) };
    }
    const sy = STREETS[Math.floor(rand() * STREETS.length)];
    return { x: 90 + rand() * (SAND_X - 240), y: sy };
  }

  function randomSidewalkPoint(rand) {
    for (let tries = 0; tries < 24; tries += 1) {
      const p = randomRoadPoint(rand);
      const off = (ROAD_W / 2 + SIDEWALK_W / 2 + 2) * (rand() < 0.5 ? -1 : 1);
      const q = rand() < 0.5 ? { x: p.x + off, y: p.y } : { x: p.x, y: p.y + off };
      if (q.x > 40 && q.x < SAND_X - 30 && q.y > 40 && q.y < WORLD_H - 40) return q;
    }
    return { x: 330, y: 330 };
  }

  return {
    seed, buildings, parks, lots, palms, lamps, speckles, specials, intersections,
    isRoad, isSidewalk, isWater, collideCircle, hasLineOfSight, randomRoadPoint, randomSidewalkPoint,
  };
}

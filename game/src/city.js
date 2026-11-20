// City generation: the street plan, ~60 named buildings, parks, lots,
// palms and lamps for Vice Harbor. Fully deterministic from a seed.
import { WORLD_W, WORLD_H, BEACH_X, SEA_X, NEON_COLORS, makeRng, pick } from './config.js';

export const AVENUES = [360, 880, 1400, 1920, 2440];   // vertical road centre x
export const STREETS = [300, 820, 1340, 1860];          // horizontal road centre y
export const ROAD_W = 124;
export const STREET_W = 112;
export const LANE = 30;                                  // lane offset from centre line

const BUILDING_NAMES = [
  'Coral Crown Hotel', 'Neon Palms Inn', 'The Gilded Flamingo', 'Hotel Marisol',
  'Azure Bay Suites', 'Club Tropicana', 'Vice Savings Bank', 'Harbor Trust',
  'Sunset Records', 'Pelican Pharmacy', 'Marlin Motors', 'Copa Cabana Club',
  'The Pink Pelican', 'Ocean Drive Diner', 'Bikini Burger', 'Salsa Verde',
  'Casa del Sol', 'The Rum Runner', 'Starfish Studios', 'Wavecrest Realty',
  'Palm Court Mall', 'Neon Nights Arcade', 'The Salty Anchor', 'Coco Loco Bar',
  'Mango Media', 'Harbor City Hall', 'Vice Harbor PD', 'St. Coral Chapel',
  'Sunbeam Laundry', 'Tidal Gym', 'The Velvet Crab', 'Bodega del Mar',
  'Fire Station 7', 'Harbor General', 'Pier 9 Warehouse', 'Customs House',
  'Yacht Club Marina', 'Sundial Tower', 'Flamingo Tower', 'Coral Tower',
  'Azure Tower', 'The Meridian', 'Hotel Hibiscus', 'Casa Azul',
  'Neon Noodle House', 'Vice Vinyl', 'Palm Print Co.', 'Harbor Library',
  'Sunset Cinema', 'The Bijou', 'Cafe Con Leche', 'Bakeria Sol',
  'Tropic Travel', 'Seahorse Suites', 'The Driftwood', 'Mermaid Books',
  'Coral Ink Tattoos', 'Vice Vapor Lounge', 'Harbor Hardware', 'Pier Deli',
  'The Lookout', 'Bayside School', 'Neon Chapel', 'Club Marlin',
];
const ROOF_COLORS = ['#9c7a5f', '#7d6a8a', '#a2674f', '#5f7d8a', '#8a5f74', '#6a8a5f', '#b08a5a', '#746a9c'];
const WALL_COLORS = ['#f4e3c2', '#f7c8d8', '#c2e8f4', '#fdf3b8', '#d8f4c2', '#f4d2a0', '#e8d2f4', '#ffe9d6'];

export function isOnRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < STREET_W / 2) return true;
  return false;
}
export function isIntersection(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2)
    for (const sy of STREETS) if (Math.abs(y - sy) < STREET_W / 2) return true;
  return false;
}
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const ax of AVENUES) { const d = Math.abs(x - ax); if (d < bd) { bd = d; best = { x: ax, y, vertical: true }; } }
  for (const sy of STREETS) { const d = Math.abs(y - sy); if (d < bd) { bd = d; best = { x, y: sy, vertical: false }; } }
  return best;
}

export function buildCity(seed = 20261120) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const lots = [];
  const palms = [];
  const lamps = [];
  const crosswalks = [];

  // Blocks sit between avenues/streets; each block holds 2x2 buildings,
  // a park, or a parking lot.
  let nameIdx = 0;
  const blockXs = [];
  for (let i = 0; i <= AVENUES.length; i++) {
    const left = i === 0 ? 60 : AVENUES[i - 1] + ROAD_W / 2 + 26;
    const right = i === AVENUES.length ? BEACH_X - 30 : AVENUES[i] - ROAD_W / 2 - 26;
    if (right - left > 120) blockXs.push([left, right]);
  }
  const blockYs = [];
  for (let j = 0; j <= STREETS.length; j++) {
    const top = j === 0 ? 50 : STREETS[j - 1] + STREET_W / 2 + 24;
    const bot = j === STREETS.length ? WORLD_H - 60 : STREETS[j] - STREET_W / 2 - 24;
    if (bot - top > 110) blockYs.push([top, bot]);
  }

  for (const [bx0, bx1] of blockXs) {
    for (const [by0, by1] of blockYs) {
      const bw = bx1 - bx0, bh = by1 - by0;
      const roll = rng();
      const cx = bx0 + bw / 2, cy = by0 + bh / 2;
      if (roll < 0.14) {
        parks.push({ x: bx0, y: by0, w: bw, h: bh });
        for (let t = 0; t < 7; t++) palms.push({ x: bx0 + 20 + rng() * (bw - 40), y: by0 + 20 + rng() * (bh - 40), s: 0.8 + rng() * 0.5, park: true });
      } else if (roll < 0.26) {
        lots.push({ x: bx0, y: by0, w: bw, h: bh });
      } else {
        // 2 x 2 buildings with an alley cross
        const gap = 26;
        const w2 = (bw - gap) / 2, h2 = (bh - gap) / 2;
        const spots = [[bx0, by0], [bx0 + w2 + gap, by0], [bx0, by0 + h2 + gap], [bx0 + w2 + gap, by0 + h2 + gap]];
        for (const [sx, sy] of spots) {
          if (rng() < 0.08) continue;
          const inset = 6 + rng() * 14;
          const b = {
            x: sx + inset / 2, y: sy + inset / 2,
            w: w2 - inset, h: h2 - inset,
            name: BUILDING_NAMES[nameIdx++ % BUILDING_NAMES.length],
            roof: pick(rng, ROOF_COLORS), wall: pick(rng, WALL_COLORS),
            neon: pick(rng, NEON_COLORS),
            floors: 2 + Math.floor(rng() * 6),
            seed: Math.floor(rng() * 1e9),
          };
          b.signSide = rng() < 0.5 ? 's' : 'w';
          buildings.push(b);
        }
      }
    }
  }

  // Beach palms + boardwalk lamps
  for (let y = 90; y < WORLD_H - 60; y += 90 + rng() * 70) {
    palms.push({ x: BEACH_X + 40 + rng() * 120, y, s: 0.9 + rng() * 0.6, park: false });
  }
  // Park trees elsewhere on grass
  for (let i = 0; i < 26; i++) {
    const x = 80 + rng() * (BEACH_X - 200), y = 60 + rng() * (WORLD_H - 120);
    if (!isOnRoad(x, y)) palms.push({ x, y, s: 0.85 + rng() * 0.5, park: true });
  }

  // Street lamps at intersections and along avenues
  for (const ax of AVENUES) for (const sy of STREETS) {
    lamps.push({ x: ax - ROAD_W / 2 - 8, y: sy - STREET_W / 2 - 8 });
    lamps.push({ x: ax + ROAD_W / 2 + 8, y: sy + STREET_W / 2 + 8 });
  }
  for (const ax of AVENUES) for (let y = 120; y < WORLD_H; y += 260) lamps.push({ x: ax - ROAD_W / 2 - 8, y });
  for (const sy of STREETS) for (let x = 140; x < BEACH_X; x += 260) lamps.push({ x, y: sy - STREET_W / 2 - 8 });

  // Crosswalks at every intersection
  for (const ax of AVENUES) for (const sy of STREETS) crosswalks.push({ x: ax, y: sy });

  // Named special places used by the story
  const places = {
    hospital: { x: 460, y: 1960, label: 'Harbor General' },
    depot: { x: 980, y: 420, label: 'Marlin Motors' },
    marina: { x: 2560, y: 1450, label: 'Yacht Club Marina' },
    warehouse: { x: 1560, y: 1980, label: 'Pier 9 Warehouse' },
    club: { x: 1080, y: 940, label: 'Copa Cabana Club' },
    tower: { x: 2080, y: 460, label: 'Sundial Tower' },
    garage: { x: 2544, y: 640, label: 'Harbor Garage' },
  };

  return { buildings, parks, lots, palms, lamps, crosswalks, places, seed };
}

// Sidewalk band edges: pedestrians walk on these offsets around roads.
export function sidewalkOffset() { return ROAD_W / 2 + 16; }

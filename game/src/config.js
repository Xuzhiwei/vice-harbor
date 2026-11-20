// Vice Harbor — global tuning and palette.
// Every magic number the other modules need lives here so the game can be
// rebalanced from one place.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const BEACH_X = 2740;      // sand starts here
export const SEA_X = 2960;        // water starts here
export const TILE_ROAD = '#3d3a44';
export const DAY_LENGTH = 240;    // seconds for a full 24h cycle
export const START_HOUR = 17.4;   // golden hour opening

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sprintSpeed: 268,
  health: 100,
  meleeRange: 46,
  meleeDamage: 34,
};

export const CAR = {
  accel: 340,
  brake: 520,
  reverseMax: 130,
  maxSpeed: 430,
  turnRate: 2.35,
  grip: 7.5,
  driftGrip: 2.1,
  radius: 21,
};

export const WANTED = {
  maxStars: 5,
  decayPerSecond: 0.045,   // heat lost while unseen
  seenMemory: 6,           // seconds police remember last position
  bustedRadius: 64,
  bustedFill: 1.15,        // seconds of close contact to get busted
};

export const GUN = {
  magSize: 12,
  reserveStart: 48,
  fireInterval: 0.16,
  reloadTime: 1.15,
  range: 560,
  damage: 34,
  spread: 0.035,
};

export const PALETTE = {
  skyDay: '#ffd9a0',
  grass: '#79b657',
  park: '#5da24c',
  sand: '#f2d492',
  sea: '#2e9db8',
  seaDeep: '#1f7d99',
  sidewalk: '#cfc4b0',
  curb: '#a89a82',
  lot: '#55505e',
  buildingRoof: '#8a6f5c',
};

export const NEON_COLORS = ['#ff5da2', '#37e2ff', '#ffe14d', '#9dff57', '#c792ff', '#ff9a3d'];

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

// Deterministic RNG (mulberry32) so staged screenshots are reproducible.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

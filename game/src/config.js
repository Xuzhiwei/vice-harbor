// Vice Harbor — shared tuning: world geometry, speeds, prices and the palette the whole
// game paints with. Everything else imports from here so the feel of the game can be
// retuned in one place.
export const STEP = 1 / 60;
export const WORLD_W = 3584;
export const WORLD_H = 2176;

/** Road layout: avenue centre-lines run north-south, street centre-lines east-west. */
export const AVENUES = [256, 768, 1280, 1792, 2304, 2816];
export const STREETS = [256, 768, 1280, 1792];
export const ROAD_W = 104;
export const SIDEWALK_W = 16;
/** The beach and the sea take the east edge of the map. */
export const SAND_X = 3080;
export const WATER_X = 3330;

/** Player on foot. */
export const WALK_SPEED = 148;
export const SPRINT_SPEED = 232;
export const PLAYER_RADIUS = 13;
export const PLAYER_MAX_HEALTH = 100;

/** Arcade car handling, shared by the player's car, traffic and police. */
export const CAR_ACCEL = 300;
export const CAR_MAX_SPEED = 348;
export const CAR_MAX_REVERSE = 128;
export const CAR_TURN = 2.45;
export const CAR_RADIUS = 17;
export const CAR_LENGTH = 42;
export const CAR_WIDTH = 21;

/** Wanted heat: stars are whole, heat is the fractional pressure underneath them. */
export const HEAT_PER_STAR = 100;
export const HEAT_DECAY = 4.2;
export const HEAT_HIDDEN_BONUS = 3.4;
export const MAX_STARS = 5;

/** Money. */
export const START_CASH = 120;
export const HOSPITAL_FEE = 150;
export const BUST_FINE = 200;
export const PACKAGE_CASH = 50;
export const PACKAGE_COUNT = 20;

/** Day length in real seconds for one full in-game day, and the start time (09:12). */
export const DAY_SECONDS = 300;
export const START_MINUTES = 9 * 60 + 12;

/** Save slot key for localStorage. */
export const SAVE_KEY = 'vice-harbor-save-v1';

/** Warm, sun-soaked palette; the renderer darkens toward night from these day colours. */
export const PALETTE = {
  grass: '#57a75a',
  grassDark: '#4c9850',
  park: '#63b364',
  sand: '#ecd28f',
  sandDark: '#e0c078',
  water: '#2f9db8',
  waterDeep: '#2386a4',
  waterFoam: '#bdf0ea',
  road: '#4a4a52',
  roadEdge: '#3c3c44',
  lane: '#e8e4d2',
  sidewalk: '#cfc8b8',
  sidewalkEdge: '#bdb5a2',
  parking: '#5a5a60',
  plaza: '#d8cfba',
  shadow: 'rgba(46, 32, 24, 0.22)',
  night: '#131c3f',
};

export const CAR_COLORS = [
  '#e74c3c', '#f39c12', '#f7f3e8', '#3498db', '#9b59b6', '#1abc9c',
  '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9', '#fdcb6e', '#6c5ce7',
  '#dfe6e9', '#b2bec3', '#ff7675', '#74b9ff', '#55efc4', '#ffeaa7',
];

export const PED_SHIRTS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43',
  '#54a0ff', '#5f27cd', '#c8d6e5', '#ff9ff3', '#00d2d3', '#8395a7',
];

export const BUILDING_STYLES = [
  { roof: '#e2725b', wall: '#f4e1d0' },
  { roof: '#5b8e7d', wall: '#eef3e6' },
  { roof: '#bc4b51', wall: '#f7ead9' },
  { roof: '#8e6cc8', wall: '#efe9f7' },
  { roof: '#e8a13a', wall: '#fdf0d5' },
  { roof: '#4f86c6', wall: '#e8f1fa' },
  { roof: '#d96c85', wall: '#fbe9ee' },
  { roof: '#7fb069', wall: '#f0f7e8' },
];

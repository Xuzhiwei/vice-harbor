// Vice Harbor — saving: cash, story progress, packages and where the player stood,
// kept in localStorage. Wanted level is never saved — a fresh visit starts clean,
// which is the harbour's one act of mercy.
import { SAVE_KEY, START_CASH } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(state) {
  const p = state.player;
  const data = {
    cash: p.cash,
    missionIndex: state.missions.index,
    complete: state.missions.complete,
    packages: state.packages.map((pack) => (pack.taken ? 1 : 0)),
    packagesFound: p.packagesFound,
    x: Math.round(p.inCar ? p.inCar.x : p.x),
    y: Math.round(p.inCar ? p.inCar.y : p.y),
    minutes: Math.round(state.minutes),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(state) {
  let data = null;
  try {
    data = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data) return false;
  const p = state.player;
  p.cash = Number.isFinite(data.cash) ? data.cash : START_CASH;
  p.packagesFound = data.packagesFound || 0;
  state.missions.index = Math.min(data.missionIndex || 0, state.missions.defs.length - 1);
  state.missions.complete = Boolean(data.complete) && data.missionIndex >= state.missions.defs.length;
  if (Array.isArray(data.packages)) {
    state.packages.forEach((pack, i) => { pack.taken = data.packages[i] === 1; });
  }
  if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
    p.x = data.x;
    p.y = data.y;
  }
  if (Number.isFinite(data.minutes)) state.minutes = data.minutes;
  state.heat = 0;
  return true;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

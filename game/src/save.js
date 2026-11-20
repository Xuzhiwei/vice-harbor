// localStorage save/load. Guards every access: some embeds disable storage,
// so the game must run fine with saving unavailable.
const KEY = 'vice-harbor-save-v1';
let memoryFallback = null;

function store() {
  try {
    const s = window.localStorage;
    const probe = '__vh_probe__';
    s.setItem(probe, '1'); s.removeItem(probe);
    return s;
  } catch { return null; }
}

export function saveGame(G) {
  const data = {
    cash: G.cash,
    missionIndex: G.missions.index,
    packages: G.packagesFound,
    player: { x: G.player.x, y: G.player.y },
    hour: G.hour,
    totalEarned: G.totalEarned,
    faresDone: G.faresDone,
  };
  const s = store();
  if (s) { try { s.setItem(KEY, JSON.stringify(data)); } catch { /* full/blocked */ } }
  else memoryFallback = data;
  return data;
}

export function loadGame() {
  const s = store();
  if (s) {
    try {
      const raw = s.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  return memoryFallback;
}

export function clearSave() {
  const s = store();
  if (s) { try { s.removeItem(KEY); } catch { /* ignore */ } }
  memoryFallback = null;
}
export function hasSave() { return !!loadGame(); }

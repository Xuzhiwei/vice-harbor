// Vice Harbor — the story: six missions from five harbour originals, told through
// phone calls and curbside dialogue, plus the free-roam work — taxi fares and the
// harbour's scattered lost packages — that pays between jobs.
import { PACKAGE_CASH, PACKAGE_COUNT } from './config.js';
import { dist } from './city.js';
import { wantedStars } from './police.js';

export const CAST = {
  marina: { name: 'Marina Sol', role: 'Fixer, Pier 9', color: '#ff8fab' },
  eddie: { name: 'Eddie Lark', role: 'Brisa Cab dispatcher', color: '#ffd166' },
  ferris: { name: 'Old Man Ferris', role: 'Ferris & Sons Garage', color: '#a3b18a' },
  rosa: { name: 'Rosa Vega', role: 'Golden Hour Club', color: '#c77dff' },
  nils: { name: 'Nils “The Commodore” Beck', role: 'Harbour smuggler', color: '#6ec1e4' },
  jules: { name: 'Jules Marlowe', role: 'You', color: '#f4f1de' },
};

function line(who, text) {
  return { who, text };
}

/** The mission chain. Stages are plain data; updateMission walks them in order. */
export function missionDefs(city) {
  const S = city.specials;
  // The package waits in whichever real parking lot sits nearest the harbour centre,
  // so the stage point is always open tarmac, never inside a building.
  let hotLot = city.lots[0] || { x: 1500, y: 950, w: 200, h: 160 };
  let bestD = Infinity;
  for (const lot of city.lots) {
    const d = dist(lot.x + lot.w / 2, lot.y + lot.h / 2, 1792, 1024);
    if (d < bestD) { bestD = d; hotLot = lot; }
  }
  const hotSpot = { x: hotLot.x + hotLot.w / 2, y: hotLot.y + hotLot.h / 2 };
  return [
    {
      id: 'first-wheels', title: 'First Wheels', giver: 'marina', at: S.pier, reward: 180,
      intro: [
        line('marina', 'Jules Marlowe. The new wheel in Vice Harbor. I have a reputation for spotting talent early.'),
        line('jules', 'And I have a reputation for needing rent money. What is the job?'),
        line('marina', 'Simple. Borrow a car, pick me up at Pier 9, and drive me to the Hotel Solana. Smoothly. My dress costs more than your car will.'),
      ],
      stages: [
        { x: S.pier.x, y: S.pier.y, r: 52, label: 'Pick up Marina at Pier 9 (needs a car)', needCar: true },
        { x: S.hotel.x, y: S.hotel.y, r: 62, label: 'Drive Marina to the Hotel Solana', needCar: true },
      ],
      outro: [line('marina', 'Smooth enough. The harbour pays people who show up, Jules. Remember that.')],
    },
    {
      id: 'hot-package', title: 'Hot Package', giver: 'ferris', at: S.garage, reward: 320,
      intro: [
        line('ferris', 'Marina vouched for you, so here is the thing. A package sat too long in a lot off Avenida Coral.'),
        line('ferris', 'Pick it up and bring it to my garage. Do not open it, do not dawdle, and if the harbour police ask — you are delivering sandwiches.'),
        line('jules', 'Heavy sandwiches, I bet.'),
      ],
      stages: [
        { x: hotSpot.x, y: hotSpot.y, r: 46, label: 'Pick up the package from the lot', tag: 'pickup' },
        { x: S.garage.x, y: S.garage.y, r: 58, label: 'Deliver the package to Ferris & Sons', timer: 150 },
      ],
      outro: [line('ferris', 'Sandwiches. Sure. Good hands, kid — the Commodore will want to meet you.')],
    },
    {
      id: 'fare-play', title: 'Fare Play', giver: 'eddie', at: S.depot, reward: 260,
      intro: [
        line('eddie', 'Brisa Cab! Eddie Lark. Marina says you can drive and keep a secret — perfect cab material.'),
        line('eddie', 'Three fares are waiting across the harbour. Pick each one up, drop each one off, keep the paint on. Radio pays cash.'),
      ],
      stages: [
        { x: 1080, y: 318, r: 46, label: 'Pick up fare 1 — the nurse on Avenida Brisa', needCar: true },
        { x: S.hospital.x, y: S.hospital.y, r: 58, label: 'Drop fare 1 at St Marina Hospital', needCar: true },
        { x: 2380, y: 1342, r: 46, label: 'Pick up fare 2 — the drummer on Calle Palma', needCar: true },
        { x: S.club.x, y: S.club.y, r: 58, label: 'Drop fare 2 at the Golden Hour Club', needCar: true },
        { x: 318, y: 1420, r: 46, label: 'Pick up fare 3 — the chef on Avenida Coral', needCar: true },
        { x: S.pier.x, y: S.pier.y, r: 58, label: 'Drop fare 3 at Pier 9', needCar: true },
      ],
      outro: [
        line('eddie', 'Clean sheet, three happy fares. You are on the radio now, Jules — passengers will flag you down all over the harbour.'),
        line('eddie', 'Yellow TAXI markers. Cash per fare, tip if you are quick.'),
      ],
    },
    {
      id: 'heat-run', title: 'Heat Run', giver: 'nils', at: S.pier, reward: 600,
      intro: [
        line('nils', 'So you are Marina’s driver. Nils Beck. The Commodore, if the harbour police are listening — and they usually are.'),
        line('nils', 'A crate waits at the end of the promenade. The moment you touch it, every cruiser in Vice Harbor will want your autograph.'),
        line('nils', 'Lose them, then bring it to Ferris. He owes me a quiet garage and a loud engine.'),
      ],
      stages: [
        { x: 3130, y: 300, r: 46, label: 'Take the Commodore’s crate from the promenade', tag: 'hotpickup' },
        { x: S.garage.x, y: S.garage.y, r: 58, label: 'Reach Ferris & Sons Garage' },
        { kind: 'loseheat', label: 'Lose the heat — break line of sight and stay hidden' },
      ],
      outro: [line('nils', 'Ha! The harbour has a new ghost. Rosa Vega asked about you, by the way. Wear something with pockets.')],
    },
    {
      id: 'neon-debt', title: 'Neon Debt', giver: 'rosa', at: S.club, reward: 520,
      intro: [
        line('rosa', 'Rosa Vega, Golden Hour. Three of my regulars owe the club money and sudden shyness.'),
        line('rosa', 'Visit them. The Anchor bar, the Neon Palms motel, the pawn shop on Brisa. Be… memorable. Then come back and tell me they remembered.'),
        line('jules', 'Memorable. Not violent.'),
        line('rosa', 'Memorable is a spectrum, darling.'),
      ],
      stages: [
        { x: 830, y: 1180, r: 48, label: 'Collect at the Salty Anchor bar' },
        { x: 2242, y: 420, r: 48, label: 'Collect at the Neon Palms Motel' },
        { x: 1218, y: 1620, r: 48, label: 'Collect at Harbor Pawn', tag: 'lastdebt' },
        { x: S.club.x, y: S.club.y, r: 60, label: 'Report back to Rosa at the Golden Hour' },
      ],
      outro: [line('rosa', 'All three paid in full and one sent flowers. You have a gift, Jules. One more job after this — the big one. Harbour Lights.')],
    },
    {
      id: 'harbor-lights', title: 'Harbour Lights', giver: 'nils', at: S.pier, reward: 1200,
      intro: [
        line('nils', 'Last run, Jules. Tonight the harbour lights a path for one boat that does not exist, carrying cargo that does not exist.'),
        line('nils', 'The crate is on the sand by the pier. Four stars the second you lift it — the whole force, the whole harbour, between you and the Solana.'),
        line('marina', 'And I will be waiting at the hotel with your money and a cold drink. Do not be late, and do not be caught.'),
      ],
      stages: [
        { x: 3120, y: 1180, r: 48, label: 'Lift the crate from the sand by the pier', tag: 'finale' },
        { x: S.hotel.x, y: S.hotel.y, r: 64, label: 'Deliver to Marina at the Hotel Solana', timer: 240 },
      ],
      outro: [
        line('marina', 'Vice Harbor is yours now, Jules. Every road, every neon sign.'),
        line('nils', 'The Commodore salutes you. Keep the engine warm — a harbour like this never stays quiet for long.'),
      ],
    },
  ];
}

export function createMissionState(city) {
  return {
    defs: missionDefs(city),
    index: 0, // next mission to offer
    active: false,
    stage: 0,
    timer: 0,
    complete: false,
    failed: 0,
  };
}

export function currentStage(state) {
  const m = state.missions;
  if (!m.active) return null;
  return m.defs[m.index].stages[m.stage] || null;
}

/** Where the HUD/minimap marker should point right now. */
export function missionMarker(state) {
  const m = state.missions;
  if (m.complete) return null;
  if (!m.active) {
    const def = m.defs[m.index];
    return { x: def.at.x, y: def.at.y, kind: 'giver', label: def.title };
  }
  const stage = currentStage(state);
  if (!stage) return null;
  if (stage.kind === 'loseheat') return { x: state.city.specials.garage.x, y: state.city.specials.garage.y, kind: 'stage', label: stage.label };
  return { x: stage.x, y: stage.y, kind: 'stage', label: stage.label };
}

export function startDialogue(state, lines) {
  state.dialogue = { lines, i: 0, t: 0 };
}

function startMission(state) {
  const m = state.missions;
  const def = m.defs[m.index];
  m.active = true;
  m.stage = 0;
  const first = def.stages[0];
  m.timer = first.timer || 0;
  startDialogue(state, def.intro);
  state.toast = { text: `Mission: ${def.title}`, time: 3.4 };
  state.audio?.phone();
}

function completeMission(state) {
  const m = state.missions;
  const def = m.defs[m.index];
  state.player.cash += def.reward;
  state.toast = { text: `${def.title} complete — +$${def.reward}`, time: 4 };
  state.audio?.cash();
  startDialogue(state, def.outro);
  m.active = false;
  m.stage = 0;
  m.index += 1;
  if (m.index >= m.defs.length) {
    m.complete = true;
    state.toast = { text: 'Story complete — Vice Harbor is yours. Free roam!', time: 5 };
  }
  state.dirtySave = true;
}

function failMission(state, why) {
  const m = state.missions;
  m.active = false;
  m.stage = 0;
  m.failed += 1;
  state.dialogue = null;
  state.toast = { text: `Mission failed — ${why}. Return to the marker to retry.`, time: 4 };
  state.audio?.fail();
}

function arriveStage(state, stage) {
  const m = state.missions;
  if (stage.tag === 'pickup') {
    state.heat = Math.max(state.heat, 205);
    state.toast = { text: 'Package taken — the harbour noticed. Move!', time: 3 };
    state.audio?.pickup();
  }
  if (stage.tag === 'hotpickup' || stage.tag === 'finale') {
    state.heat = Math.max(state.heat, stage.tag === 'finale' ? 405 : 305);
    state.toast = { text: 'Crate lifted — every cruiser in the harbour is awake!', time: 3.2 };
    state.audio?.sirenBlip();
  }
  if (stage.tag === 'lastdebt') {
    state.heat = Math.max(state.heat, 205);
    state.toast = { text: 'The last debtor called the police. Back to Rosa!', time: 3 };
  }
  m.stage += 1;
  const next = m.defs[m.index].stages[m.stage];
  if (!next) {
    completeMission(state);
    return;
  }
  m.timer = next.timer || 0;
}

export function updateMissions(state, dt) {
  const m = state.missions;
  const p = state.player;

  // Dialogue ticks forward on its own; a click or E hurries it (main sets the flag).
  if (state.dialogue) {
    const d = state.dialogue;
    d.t += dt;
    if (d.t > 4.4 || state.dialogueAdvance) {
      d.i += 1;
      d.t = 0;
      state.dialogueAdvance = false;
      if (d.i >= d.lines.length) state.dialogue = null;
    }
  }

  if (!m.active && !m.complete) {
    const def = m.defs[m.index];
    if (dist(p.x, p.y, def.at.x, def.at.y) < 46) startMission(state);
    return;
  }
  if (!m.active) return;

  const stage = currentStage(state);
  if (!stage) return;
  if (stage.timer || m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }
  if (stage.kind === 'loseheat') {
    if (wantedStars(state) === 0) arriveStage(state, stage);
    return;
  }
  const inCarOk = !stage.needCar || p.inCar;
  if (inCarOk && dist(p.x, p.y, stage.x, stage.y) < stage.r) arriveStage(state, stage);
}

/** Free-roam taxi work, unlocked once the story teaches it (mission index 3+). */
export function updateTaxi(state, dt) {
  const p = state.player;
  state.fareTimer -= dt;
  if (!state.fare && state.missions.index >= 3 && p.inCar && !state.missions.active && state.fareTimer <= 0) {
    const spot = state.city.randomSidewalkPoint(state.rng);
    if (dist(spot.x, spot.y, p.x, p.y) > 260 && dist(spot.x, spot.y, p.x, p.y) < 900) {
      const dest = state.city.randomRoadPoint(state.rng);
      const fareDist = dist(spot.x, spot.y, dest.x, dest.y);
      state.fare = {
        phase: 'pickup', x: spot.x, y: spot.y, destX: dest.x, destY: dest.y,
        pay: Math.round(34 + fareDist * 0.055), time: 0, limit: 50 + fareDist * 0.09,
      };
      state.toast = { text: 'A fare is flagging you down — follow the TAXI marker', time: 3 };
    } else {
      state.fareTimer = 1.2;
    }
  }
  if (!state.fare) return;
  const fare = state.fare;
  if (!p.inCar) {
    state.fare = null;
    state.fareTimer = 6;
    state.toast = { text: 'Fare lost — you left the car', time: 2.4 };
    return;
  }
  if (fare.phase === 'pickup') {
    if (dist(p.x, p.y, fare.x, fare.y) < 42 && Math.hypot(p.inCar.vx, p.inCar.vy) < 26) {
      fare.phase = 'dropoff';
      fare.time = 0;
      state.audio?.pickup();
      state.toast = { text: 'Passenger in — drive to the gold marker', time: 2.4 };
    }
  } else {
    fare.time += dt;
    if (dist(p.x, p.y, fare.destX, fare.destY) < 56) {
      const tip = fare.time < fare.limit ? Math.round(fare.pay * 0.35) : 0;
      p.cash += fare.pay + tip;
      state.toast = { text: tip > 0 ? `Fare $${fare.pay} + $${tip} tip — quick work!` : `Fare paid — $${fare.pay}`, time: 3 };
      state.audio?.cash();
      state.fare = null;
      state.fareTimer = 7 + Math.random() * 6;
      state.dirtySave = true;
    }
  }
}

/** The harbour's lost packages: glowing briefcases scattered through parks and lots. */
export function scatterPackages(state) {
  const spots = [];
  for (const park of state.city.parks) spots.push({ x: park.x + park.w / 2, y: park.y + park.h / 2 });
  for (const lot of state.city.lots) spots.push({ x: lot.x + lot.w / 2, y: lot.y + lot.h / 2 });
  for (const key of Object.keys(state.city.specials)) {
    const s = state.city.specials[key];
    spots.push({ x: s.x + 46, y: s.y + 18 });
  }
  spots.push({ x: 3180, y: 420 }, { x: 3180, y: 1500 }, { x: 3220, y: 2050 }, { x: 3240, y: 900 });
  state.packages = [];
  for (let i = 0; i < Math.min(PACKAGE_COUNT, spots.length); i += 1) {
    const s = spots[(i * 2 + 1) % spots.length];
    state.packages.push({ x: s.x + (state.rng() - 0.5) * 90, y: s.y + (state.rng() - 0.5) * 70, taken: false });
  }
}

export function updatePackages(state) {
  const p = state.player;
  for (const pack of state.packages) {
    if (pack.taken) continue;
    if (dist(p.x, p.y, pack.x, pack.y) < 30) {
      pack.taken = true;
      p.cash += PACKAGE_CASH;
      p.packagesFound += 1;
      state.toast = { text: `Lost package found — +$${PACKAGE_CASH} (${p.packagesFound}/${state.packages.length})`, time: 2.6 };
      state.audio?.pickup();
      state.dirtySave = true;
    }
  }
}

// Story missions, characters, phone dialogue, taxi fares and packages.
// Six-mission chain (~$3,000 total) from five original Vice Harbor locals.
import { dist, clamp } from './config.js';
import { addCash, setBanner, setToast } from './world.js';
import { forceStars, reportCrime } from './police.js';
import { sfx } from './audio.js';

export const CHARACTERS = {
  marisol: { name: 'Marisol Vega', role: 'Club owner, Copa Cabana', color: '#ff5da2' },
  dext: { name: 'Dext', role: 'Fixer at Marlin Motors', color: '#37e2ff' },
  pastor: { name: 'Pastor June', role: 'Neon Chapel', color: '#ffe14d' },
  kiko: { name: 'Kiko Tanaka', role: 'Marina harbormaster', color: '#9dff57' },
  rosa: { name: 'Rosa Delgado', role: 'Sunset Records A&R', color: '#c792ff' },
};

// Each mission: intro dialogue, then a list of legs. A leg completes when
// the player reaches its marker (optionally in a car / with wanted level /
// before a timer). Final leg pays out.
export function missionDefs(G) {
  const P = G.city.places;
  return [
    {
      id: 'm1', from: 'dext', title: 'First Wheels',
      intro: [
        ['dext', 'Rio. Heard you washed up with nothing but a tan. I run Marlin Motors — I can fix that.'],
        ['dext', 'A coupe got left at the depot lot with the keys in. Take it. Call it a signing bonus.'],
        ['rio', 'And the catch?'],
        ['dext', 'Drive it to Marisol at the Copa Cabana. She owes me a favour, now she owes you a job.'],
      ],
      legs: [
        { text: 'Get the coupe at Marlin Motors', x: P.depot.x, y: P.depot.y, r: 90 },
        { text: 'Deliver the car to the Copa Cabana', x: P.club.x, y: P.club.y, r: 90, needCar: true },
      ],
      reward: 300,
      outro: [['marisol', 'Dext sent you? Then you drive clean. I like that. Stick around, Rio.']],
    },
    {
      id: 'm2', from: 'marisol', title: 'Vinyl Run',
      intro: [
        ['marisol', 'Rosa at Sunset Records cut a master disc my DJ needs tonight. Pier 9 has it in a crate.'],
        ['marisol', 'Warehouse boys are jumpy since the customs raid. Grab it, lose any noise, bring it home.'],
      ],
      legs: [
        { text: 'Pick up the master disc at Pier 9', x: P.warehouse.x, y: P.warehouse.y, r: 80, crime: true },
        { text: 'Bring the disc to the Copa Cabana', x: P.club.x, y: P.club.y, r: 90, timer: 150 },
      ],
      reward: 420,
      outro: [['marisol', 'Smooth. The floor is yours any night, driver.']],
    },
    {
      id: 'm3', from: 'pastor', title: 'Chapel Bells',
      intro: [
        ['pastor', 'June here. Some charmer lifted the Neon Chapel bell fund box during service.'],
        ['pastor', 'Harbor General saw him limp in after a scooter crash. Ask nicely. Or don\'t. Just bring it back.'],
      ],
      legs: [
        { text: 'Search Harbor General for the bell fund', x: P.hospital.x, y: P.hospital.y, r: 90 },
        { text: 'Return the fund box to Neon Chapel', x: 2080, y: 1420, r: 90 },
      ],
      reward: 380,
      outro: [['pastor', 'Bless you, child. The harbour provides — mostly through you.']],
    },
    {
      id: 'm4', from: 'kiko', title: 'Harbour Lights',
      intro: [
        ['kiko', 'Kiko, marina. A courier boat drops a package at the Sundial Tower helipad stairs at dusk.'],
        ['kiko', 'Customs drones watch the tower. Be quick, be gone, bring it to the marina office.'],
      ],
      legs: [
        { text: 'Collect the package at Sundial Tower', x: P.tower.x, y: P.tower.y, r: 85, crime: true },
        { text: 'Reach the marina — fast', x: P.marina.x, y: P.marina.y, r: 95, timer: 120 },
      ],
      reward: 550,
      outro: [['kiko', 'You move like tide water. The marina remembers its friends.']],
    },
    {
      id: 'm5', from: 'rosa', title: 'Encore',
      intro: [
        ['rosa', 'Rosa, Sunset Records. My headline singer is hiding at the Flamingo Tower — stage fright, or worse.'],
        ['rosa', 'Get her to the Copa before doors. Every copper in Vice Harbor will want a selfie. Avoid them.'],
      ],
      legs: [
        { text: 'Pick up the singer at Flamingo Tower', x: 460, y: 460, r: 90 },
        { text: 'Drive her to the Copa Cabana', x: P.club.x, y: P.club.y, r: 95, needCar: true, timer: 170, heat: 2 },
      ],
      reward: 650,
      outro: [['rosa', 'She sang like sunrise. You\'re on the guest list forever, Rio.']],
    },
    {
      id: 'm6', from: 'marisol', title: 'Vice Harbor',
      intro: [
        ['marisol', 'Last job, Rio. The Gilded Flamingo is laundering through my club\'s books tonight.'],
        ['marisol', 'Take their ledger from the warehouse, torch nothing, hurt no one — just walk it to Pastor June. She\'ll make it sing.'],
        ['rio', 'And if the whole city lights up behind me?'],
        ['marisol', 'Then drive like Vice Harbor is yours. Because after tonight, it is.'],
      ],
      legs: [
        { text: 'Take the ledger at Pier 9', x: P.warehouse.x, y: P.warehouse.y, r: 80, crime: true },
        { text: 'Escape to Neon Chapel with the ledger', x: 2080, y: 1420, r: 95, heat: 3, timer: 200 },
      ],
      reward: 700,
      outro: [
        ['pastor', 'It\'s done. Half the pier bosses resign by Friday.'],
        ['marisol', 'Drinks on the house, partner. Vice Harbor is ours.'],
      ],
    },
  ];
}

export function createMissionState(G) {
  return {
    defs: missionDefs(G),
    index: 0,          // next mission to offer
    active: null,      // { def, leg, timer }
    offered: false,
    complete: false,
  };
}

export function currentObjective(G) {
  const M = G.missions;
  if (!M) return null;
  if (M.active) {
    const leg = M.active.def.legs[M.active.leg];
    return { text: leg.text, x: leg.x, y: leg.y, mission: M.active.def.title, timer: M.active.timer };
  }
  if (G.fare) return { text: 'Taxi: drop your fare off', x: G.fare.x, y: G.fare.y, mission: 'Taxi fare', timer: G.fare.timer };
  if (M.index < M.defs.length) {
    const def = M.defs[M.index];
    const first = def.legs[0];
    const giver = CHARACTERS[def.from];
    return { text: `Meet ${giver.name}`, x: first.x, y: first.y, mission: def.title, giver: true };
  }
  return { text: 'Vice Harbor is yours. Taxi fares and lost packages still pay.', x: null, y: null };
}

// Start dialogue for the next mission when the player reaches the giver.
export function tryStartMission(G) {
  const M = G.missions;
  if (M.active || M.index >= M.defs.length || G.dialogue) return false;
  const def = M.defs[M.index];
  const first = def.legs[0];
  if (dist(G.player.x, G.player.y, first.x, first.y) > 110 || G.player.car) return false;
  G.dialogue = { lines: def.intro, idx: 0, from: def.from, onDone: 'start' };
  G.mode = 'dialogue';
  sfx.phone();
  return true;
}

export function advanceDialogue(G) {
  const d = G.dialogue;
  if (!d) return;
  d.idx++;
  sfx.ui();
  if (d.idx >= d.lines.length) {
    G.dialogue = null;
    G.mode = 'play';
    if (d.onDone === 'start') {
      const M = G.missions;
      const def = M.defs[M.index];
      M.active = { def, leg: 0, timer: def.legs[0].timer || 0 };
      setBanner(G, `MISSION: ${def.title}`);
    } else if (d.onDone === 'outro') {
      // nothing else; reward already paid
    }
  }
}

function completeLeg(G) {
  const M = G.missions;
  const a = M.active;
  const leg = a.def.legs[a.leg];
  if (leg.crime) reportCrime(G, 'mission', leg.x, leg.y, 1);
  if (leg.heat) forceStars(G, leg.heat);
  a.leg++;
  if (a.leg >= a.def.legs.length) {
    addCash(G, a.def.reward);
    sfx.missionDone();
    setBanner(G, `${a.def.title} complete — $${a.def.reward}`);
    const def = a.def;
    M.active = null;
    M.index++;
    if (M.index >= M.defs.length) M.complete = true;
    if (def.outro) { G.dialogue = { lines: def.outro, idx: 0, from: def.from, onDone: 'outro' }; G.mode = 'dialogue'; }
    G.saveNow = true;
  } else {
    const next = a.def.legs[a.leg];
    a.timer = next.timer || 0;
    setToast(G, next.text);
    sfx.pickup();
  }
}

export function updateMissions(G, dt) {
  const M = G.missions;
  if (!M || G.mode !== 'play') return;
  if (!M.active) { tryStartMission(G); updateFare(G, dt); return; }
  const a = M.active;
  const leg = a.def.legs[a.leg];
  if (leg.timer) {
    a.timer -= dt;
    if (a.timer <= 0) {
      setBanner(G, 'Out of time — mission failed. It will be offered again.');
      M.active = null;
      return;
    }
  }
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  if (leg.needCar && !G.player.car) return;
  if (dist(px, py, leg.x, leg.y) < leg.r) completeLeg(G);
}

// Taxi side work ------------------------------------------------------------
export function maybeOfferFare(G) {
  if (G.fare || G.missions?.active || G.dialogue) return;
  if (!G.player.car || G.player.car.kind !== 'taxi') return;
  if (G.rng() > 0.006) return;
  // a ped hails: nearest ped becomes the passenger beacon
  let best = null, bd = 260;
  for (const p of G.peds) { if (!p.dead) { const d = dist(G.player.x, G.player.y, p.x, p.y); if (d < bd) { bd = d; best = p; } } }
  if (!best) return;
  const dests = [[500, 500], [2100, 500], [1100, 1500], [2300, 1500], [700, 2050], [2600, 900]];
  const [dx, dy] = dests[Math.floor(G.rng() * dests.length)];
  G.fare = { x: dx, y: dy, pay: 60 + Math.floor(dist(best.x, best.y, dx, dy) / 22), timer: 150, ped: best };
  setBanner(G, `Taxi fare: $${G.fare.pay} — follow the yellow marker`);
  sfx.phone();
}
function updateFare(G, dt) {
  maybeOfferFare(G);
  if (!G.fare) return;
  G.fare.timer -= dt;
  if (G.fare.timer <= 0) { setToast(G, 'Fare gave up waiting.'); G.fare = null; return; }
  if (G.player.car && dist(G.player.car.x, G.player.car.y, G.fare.x, G.fare.y) < 70 && Math.abs(G.player.car.speed) < 30) {
    addCash(G, G.fare.pay);
    G.faresDone++;
    sfx.cash();
    setBanner(G, `Fare paid $${G.fare.pay}`);
    G.fare = null;
    G.saveNow = true;
  }
}

// Lost packages --------------------------------------------------------------
export function updatePackages(G) {
  for (const pk of G.packages) {
    if (pk.taken || G.packagesFound.includes(pk.id)) { pk.taken = true; continue; }
    if (!G.player.car && dist(G.player.x, G.player.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      G.packagesFound.push(pk.id);
      addCash(G, 50);
      sfx.pickup();
      setToast(G, `Lost package returned — $50 (${G.packagesFound.length}/20)`);
      G.saveNow = true;
    }
  }
}
export { CHARACTERS as CHARS };

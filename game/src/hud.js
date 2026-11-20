// HUD: DOM panels (cash, stars, health, ammo, clock, objective, banner,
// dialogue card) plus the canvas minimap.
import { WORLD_W, WORLD_H, clamp, dist } from './config.js';
import { AVENUES, STREETS } from './city.js';
import { CHARACTERS } from './missions.js';

const $ = (id) => document.getElementById(id);

export function cacheHud() {
  return {
    cash: $('hud-cash'), stars: $('hud-stars'), health: $('hud-health-fill'),
    ammo: $('hud-ammo'), clock: $('hud-clock'), objective: $('hud-objective'),
    banner: $('banner'), toast: $('toast'), minimap: $('minimap'),
    dialogue: $('dialogue'), dlgName: $('dlg-name'), dlgText: $('dlg-text'),
    interact: $('interact-hint'), bustedFill: $('busted-fill'), bustedWrap: $('busted-meter'),
    speed: $('hud-speed'),
  };
}

function fmtClock(hour) {
  const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function updateHud(H, G, objective) {
  H.cash.textContent = '$' + G.cash.toLocaleString('en-US');
  const stars = G.wanted.stars;
  H.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  H.stars.style.color = stars > 0 ? '#ffd740' : 'rgba(255,255,255,0.25)';
  H.stars.style.textShadow = stars > 0 ? '0 0 12px rgba(255,180,0,0.8)' : 'none';
  H.health.style.width = clamp(G.player.health, 0, 100) + '%';
  H.health.style.background = G.player.health < 30 ? '#e53935' : '#43d17c';
  H.ammo.textContent = G.player.car ? '—' : `${G.ammo.mag} / ${G.ammo.reserve}`;
  H.clock.textContent = fmtClock(G.hour);
  if (G.player.car) {
    H.speed.textContent = Math.round(Math.abs(G.player.car.speed) * 0.22) + ' mph';
    H.speed.style.display = 'block';
  } else H.speed.style.display = 'none';

  if (objective) {
    let line = objective.text;
    if (objective.x != null) {
      const px = G.player.car ? G.player.car.x : G.player.x;
      const py = G.player.car ? G.player.car.y : G.player.y;
      line += ` — ${Math.round(dist(px, py, objective.x, objective.y))}m`;
    }
    if (objective.timer) line += ` — ${Math.max(0, Math.ceil(objective.timer))}s`;
    H.objective.textContent = (objective.mission ? objective.mission + ': ' : '') + line;
    H.objective.style.display = 'block';
  } else H.objective.style.display = 'none';

  if (G.bannerT > 0) { H.banner.textContent = G.banner; H.banner.style.opacity = '1'; }
  else H.banner.style.opacity = '0';
  if (G.toastT > 0) { H.toast.textContent = G.toast; H.toast.style.opacity = '1'; }
  else H.toast.style.opacity = '0';

  if (G.wanted.bustedMeter > 0.02 && G.wanted.stars > 0) {
    H.bustedWrap.style.display = 'block';
    H.bustedFill.style.width = (G.wanted.bustedMeter * 100) + '%';
  } else H.bustedWrap.style.display = 'none';

  // dialogue card
  if (G.dialogue) {
    const d = G.dialogue;
    const [who, text] = d.lines[d.idx];
    const ch = who === 'rio' ? { name: 'Rio (you)', color: '#14b8a6' } : CHARACTERS[who];
    H.dialogue.style.display = 'block';
    H.dlgName.textContent = ch ? ch.name : who;
    H.dlgName.style.color = ch ? ch.color : '#fff';
    H.dlgText.textContent = text;
  } else H.dialogue.style.display = 'none';
}

export function drawMinimap(H, G, objective) {
  const c = H.minimap; if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, Hh = c.height;
  const sx = W / WORLD_W, sy = Hh / WORLD_H;
  ctx.fillStyle = '#20303a';
  ctx.fillRect(0, 0, W, Hh);
  ctx.fillStyle = '#3f7d4e';
  ctx.fillRect(0, 0, 2740 * sx, Hh);
  ctx.fillStyle = '#e8cf92';
  ctx.fillRect(2740 * sx, 0, (2960 - 2740) * sx, Hh);
  ctx.fillStyle = '#2e9db8';
  ctx.fillRect(2960 * sx, 0, (WORLD_W - 2960) * sx, Hh);
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2;
  for (const ax of AVENUES) { ctx.beginPath(); ctx.moveTo(ax * sx, 0); ctx.lineTo(ax * sx, Hh); ctx.stroke(); }
  for (const sy2 of STREETS) { ctx.beginPath(); ctx.moveTo(0, sy2 * sy); ctx.lineTo(W, sy2 * sy); ctx.stroke(); }
  // traffic dots
  ctx.fillStyle = '#d7dde3';
  for (const car of G.cars) { if (car.driver === 'traffic') ctx.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3); }
  // police flash
  const flash = Math.sin(G.time * 8) > 0;
  for (const cop of G.cops) {
    ctx.fillStyle = flash ? '#ff3b30' : '#2471ff';
    ctx.beginPath(); ctx.arc(cop.x * sx, cop.y * sy, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  // police helicopter: a white pulsing diamond, distinct from cruiser dots
  if (G.heli) {
    const hx = G.heli.x * sx, hy = G.heli.y * sy;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx, hy, 6.5 + Math.sin(G.time * 6) * 1.4, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffffff';
    const s = 3.6 + Math.sin(G.time * 6) * 0.7;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  // garage: grey square until bought, cyan once it is yours
  const gp = G.city.places.garage;
  if (gp) {
    ctx.fillStyle = G.garage && G.garage.owned ? '#37e2ff' : '#9aa5ad';
    ctx.fillRect(gp.x * sx - 3, gp.y * sy - 3, 6, 6);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(gp.x * sx - 3, gp.y * sy - 3, 6, 6);
  }
  // packages
  ctx.fillStyle = '#ffb340';
  for (const pk of G.packages) if (!pk.taken) ctx.fillRect(pk.x * sx - 1.5, pk.y * sy - 1.5, 3, 3);
  // objective marker
  if (objective && objective.x != null) {
    ctx.fillStyle = G.fare ? '#ffd740' : '#ff5da2';
    ctx.beginPath(); ctx.arc(objective.x * sx, objective.y * sy, 4.4 + Math.sin(G.time * 5) * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  // player arrow
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  const pa = G.player.car ? G.player.car.angle : G.player.angle;
  ctx.save();
  ctx.translate(px * sx, py * sy); ctx.rotate(pa);
  ctx.fillStyle = '#14f1d9';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.4); ctx.lineTo(-5, 4.4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, Hh - 1);
}

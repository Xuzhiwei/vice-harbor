// Vice Harbor — the HUD: cash and clock top-left, the minimap top-right with its
// traffic, cruisers and mission marker, wanted stars, health, weapon readout, the
// objective line, toasts, and the phone-style dialogue card missions talk through.
import { MAX_STARS, WORLD_W, WORLD_H, SAND_X, WATER_X, PLAYER_MAX_HEALTH } from './config.js';
import { wantedStars } from './police.js';
import { missionMarker, currentStage, CAST } from './missions.js';
import { VIEW_W, VIEW_H } from './world.js';

const MAP_W = 196;
const MAP_H = 124;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, r, filled, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function clockText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawMinimap(ctx, state) {
  const x = VIEW_W - MAP_W - 16;
  const y = 14;
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.save();
  roundRect(ctx, x, y, MAP_W, MAP_H, 10);
  ctx.fillStyle = 'rgba(24, 34, 44, 0.82)';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#3f7d46';
  ctx.fillRect(x, y, MAP_W, MAP_H);
  ctx.fillStyle = '#e8cf92';
  ctx.fillRect(x + SAND_X * sx, y, (WATER_X - SAND_X) * sx, MAP_H);
  ctx.fillStyle = '#2f86a8';
  ctx.fillRect(x + WATER_X * sx, y, (WORLD_W - WATER_X) * sx, MAP_H);
  ctx.fillStyle = '#585860';
  for (const b of state.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  ctx.fillStyle = '#6d6d75';
  for (const ax of [256, 768, 1280, 1792, 2304, 2816]) ctx.fillRect(x + (ax - 52) * sx, y, 104 * sx, MAP_H);
  for (const syLine of [256, 768, 1280, 1792]) ctx.fillRect(x, y + (syLine - 52) * sy, MAP_W, 104 * sy);
  for (const car of state.cars) {
    if (car.dead || car.kind === 'cop') continue;
    ctx.fillStyle = car.kind === 'player' ? '#ffffff' : '#d9d4c5';
    ctx.fillRect(x + car.x * sx - 1.5, y + car.y * sy - 1.5, 3, 3);
  }
  const blink = Math.floor(state.time * 2.4) % 2 === 0;
  for (const cop of state.cops) {
    if (cop.dead) continue;
    ctx.fillStyle = blink ? '#ff5252' : '#4da3ff';
    ctx.fillRect(x + cop.x * sx - 2, y + cop.y * sy - 2, 4, 4);
  }
  const marker = missionMarker(state);
  const fare = state.fare;
  const pulse = 3 + Math.sin(state.time * 5) * 1.2;
  if (fare) {
    ctx.fillStyle = '#ffd83d';
    ctx.beginPath();
    ctx.arc(x + (fare.phase === 'pickup' ? fare.x : fare.destX) * sx, y + (fare.phase === 'pickup' ? fare.y : fare.destY) * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (marker) {
    ctx.fillStyle = marker.kind === 'giver' ? '#ff9f43' : '#ffe14d';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse + 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
  }
  // The player: a white arrow that turns with them.
  const p = state.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  roundRect(ctx, x, y, MAP_W, MAP_H, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawHUD(ctx, state) {
  const p = state.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Cash and clock, top-left.
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.strokeStyle = 'rgba(20,16,8,0.65)';
  ctx.lineWidth = 4;
  const cash = `$${p.cash}`;
  ctx.strokeText(cash, 18, 38);
  ctx.fillText(cash, 18, 38);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#fdf6e3';
  const clock = `${clockText(state.minutes)} · Vice Harbor`;
  ctx.strokeText(clock, 18, 60);
  ctx.fillText(clock, 18, 60);

  // Health bar under the cash.
  ctx.fillStyle = 'rgba(10,10,14,0.55)';
  roundRect(ctx, 18, 70, 170, 13, 6);
  ctx.fill();
  const hpFrac = Math.max(0, p.health / PLAYER_MAX_HEALTH);
  ctx.fillStyle = hpFrac > 0.35 ? '#5ad66f' : '#ef5350';
  if (hpFrac > 0) {
    roundRect(ctx, 20, 72, 166 * hpFrac, 9, 4);
    ctx.fill();
  }

  drawMinimap(ctx, state);

  // Wanted stars under the minimap; they flash while the police can see the player.
  const stars = wantedStars(state);
  const flash = state.seen && Math.floor(state.time * 3) % 2 === 0;
  for (let i = 0; i < MAX_STARS; i += 1) {
    const filled = i < stars;
    star(ctx, VIEW_W - 178 + i * 36, 168, 14, filled, filled ? (flash ? '#ffd83d' : '#ffb703') : 'rgba(255,255,255,0.4)');
  }
  if (state.pinTimer > 0.15) {
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText(state.player.inCar ? 'BOXED IN!' : 'THEY ARE ON YOU!', VIEW_W / 2, 118);
    ctx.textAlign = 'left';
  }

  // Objective line, top-centre. It carries the distance to the target, and a
  // change of objective earns a brief banner under the line (the first
  // objective of a session is set silently, so staged scenes stay clean).
  const stage = currentStage(state);
  const marker = missionMarker(state);
  let objective = '';
  if (stage) objective = stage.label;
  else if (state.fare) objective = state.fare.phase === 'pickup' ? 'Pick up your fare' : 'Drop your fare at the gold marker';
  else if (marker) objective = `Meet ${state.missions.defs[state.missions.index].giver === 'nils' ? 'Nils Beck' : 'your contact'} — ${marker.label}`;
  if (objective) {
    if (state._objText === undefined || state._objText === '') {
      if (state._objText === '') state._objT = state.time;
      state._objText = objective;
    } else if (state._objText !== objective) {
      state._objText = objective;
      state._objT = state.time;
    }
    let target = null;
    if (stage && stage.kind !== 'loseheat') target = stage;
    else if (stage) target = state.city.specials.garage;
    else if (state.fare) target = state.fare.phase === 'pickup' ? state.fare : { x: state.fare.destX, y: state.fare.destY };
    else if (marker) target = marker;
    const distText = target ? ` · ${Math.max(10, Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 10) * 10)}m` : '';
    ctx.font = '600 17px system-ui, sans-serif';
    const w = ctx.measureText(objective + distText).width + 30;
    ctx.fillStyle = 'rgba(12, 14, 22, 0.62)';
    roundRect(ctx, (VIEW_W - w) / 2, 14, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#ffeec2';
    ctx.textAlign = 'center';
    ctx.fillText(objective + distText, VIEW_W / 2, 37);
    ctx.textAlign = 'left';
    // The banner: a larger card that announces the new objective, then goes.
    const age = state._objT === undefined ? 99 : state.time - state._objT;
    if (age < 2.8) {
      const fade = age > 2.2 ? 1 - (age - 2.2) / 0.6 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.font = '700 20px system-ui, sans-serif';
      const bw = ctx.measureText(objective).width + 56;
      ctx.fillStyle = 'rgba(12, 14, 22, 0.78)';
      roundRect(ctx, (VIEW_W - bw) / 2, 56, bw, 52, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 217, 61, 0.65)';
      ctx.lineWidth = 1.6;
      roundRect(ctx, (VIEW_W - bw) / 2, 56, bw, 52, 11);
      ctx.stroke();
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.fillStyle = '#ffd83d';
      ctx.textAlign = 'center';
      ctx.fillText('NEW OBJECTIVE', VIEW_W / 2, 74);
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffeec2';
      ctx.fillText(objective, VIEW_W / 2, 99);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  } else {
    state._objText = '';
  }
  if (state.missions.active && state.missions.timer > 0) {
    const t = Math.max(0, state.missions.timer);
    const bannerAge = state._objT === undefined ? 99 : state.time - state._objT;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillStyle = t < 25 ? '#ff6b6b' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, VIEW_W / 2, bannerAge < 2.8 ? 132 : 74);
    ctx.textAlign = 'left';
  }

  // Weapon readout, bottom-right. The numbers redden as the magazine runs dry.
  if (!p.inCar) {
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = state.armory.reload > 0 ? '#fdf6e3' : state.armory.mag === 0 ? '#ff8a80' : state.armory.mag <= 3 ? '#ffb74d' : '#fdf6e3';
    const gun = state.armory.reload > 0 ? 'PISTOL — RELOADING' : `PISTOL  ${state.armory.mag} / ${state.armory.reserve}`;
    ctx.strokeStyle = 'rgba(20,16,8,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(gun, VIEW_W - 196, VIEW_H - 20);
    ctx.fillText(gun, VIEW_W - 196, VIEW_H - 20);
  } else {
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(253,246,227,0.85)';
    ctx.fillText('E — step out · SPACE — handbrake', VIEW_W - 300, VIEW_H - 20);
  }

  // Toast line, bottom-centre.
  if (state.toast) {
    ctx.font = '600 18px system-ui, sans-serif';
    const w = ctx.measureText(state.toast.text).width + 34;
    ctx.fillStyle = 'rgba(12, 14, 22, 0.68)';
    roundRect(ctx, (VIEW_W - w) / 2, VIEW_H - 62, w, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(state.toast.text, VIEW_W / 2, VIEW_H - 40);
    ctx.textAlign = 'left';
  }

  // Dialogue: a phone card, bottom-left, with the speaker's name lit in their colour.
  if (state.dialogue) {
    const d = state.dialogue;
    const current = d.lines[Math.min(d.i, d.lines.length - 1)];
    const who = CAST[current.who] || CAST.jules;
    const w = 430;
    const h = 108;
    const x = 18;
    const y = VIEW_H - h - 16;
    ctx.fillStyle = 'rgba(14, 16, 26, 0.88)';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = who.color;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = who.color;
    ctx.fillText(`${who.name} · ${who.role}`, x + 16, y + 26);
    ctx.font = '400 16px system-ui, sans-serif';
    ctx.fillStyle = '#f5f2e8';
    wrapText(ctx, current.text, x + 16, y + 52, w - 32, 21);
    ctx.font = '400 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(245,242,232,0.55)';
    ctx.fillText('E or click — next', x + w - 108, y + h - 10);
  }

  // Damage vignette: a red bloom that spikes the moment Jules is hurt and
  // throbs for as long as his health sits in the red.
  const hurtBloom = Math.min(1, p.hurtTime * 2.2) * 0.5;
  const lowThrob = hpFrac < 0.35 && p.health > 0 ? 0.17 + Math.sin(state.time * 5) * 0.05 : 0;
  const vig = Math.max(hurtBloom, lowThrob);
  if (vig > 0.01) {
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.92);
    grad.addColorStop(0, 'rgba(200, 20, 10, 0)');
    grad.addColorStop(1, `rgba(200, 20, 10, ${vig})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, ly);
      line = word;
      ly += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, ly);
}

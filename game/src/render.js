// Renderer: draws the whole city top-down — ground, roads with lane paint,
// crosswalks, buildings with neon signs and lit windows, beach and animated
// sea, then cars, peds, the player, effects, and the day/night grade.
import { WORLD_W, WORLD_H, BEACH_X, SEA_X, PALETTE, TILE_ROAD, clamp, lerp } from './config.js';
import { AVENUES, STREETS, ROAD_W, STREET_W } from './city.js';

// Sky grade by hour: returns overlay colour + alpha and a light factor.
export function skyGrade(hour) {
  // keyframes: [hour, r,g,b, alpha]
  const keys = [
    [0, 8, 10, 38, 0.62], [5, 10, 12, 44, 0.55], [6.5, 60, 30, 60, 0.25],
    [8, 0, 0, 0, 0], [16.5, 0, 0, 0, 0], [18, 255, 120, 40, 0.11],
    [19.3, 120, 40, 90, 0.34], [20.5, 8, 10, 38, 0.6], [24, 8, 10, 38, 0.62],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (hour >= a[0] && hour <= b[0]) {
      const t = (hour - a[0]) / Math.max(0.001, b[0] - a[0]);
      return {
        r: Math.round(lerp(a[1], b[1], t)), g: Math.round(lerp(a[2], b[2], t)),
        b: Math.round(lerp(a[3], b[3], t)), a: lerp(a[4], b[4], t),
      };
    }
  }
  return { r: 8, g: 10, b: 38, a: 0.6 };
}
export function isNight(hour) { return hour < 6.2 || hour > 18.6; }
export function darkness(hour) { const g = skyGrade(hour); return clamp(g.a / 0.62, 0, 1); }

function drawGround(ctx, G, cam) {
  const { city } = G;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cam.x - 20, cam.y - 20, cam.w + 40, cam.h + 40);
  // parks (darker lawns + paths)
  for (const p of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(240,230,200,0.5)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(p.x + 8, p.y + p.h / 2); ctx.lineTo(p.x + p.w - 8, p.y + p.h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.y + 8); ctx.lineTo(p.x + p.w / 2, p.y + p.h - 8); ctx.stroke();
  }
  // parking lots with bay lines
  for (const l of city.lots) {
    ctx.fillStyle = PALETTE.lot;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let x = l.x + 26; x < l.x + l.w - 10; x += 58) { ctx.beginPath(); ctx.moveTo(x, l.y + 14); ctx.lineTo(x, l.y + 66); ctx.stroke(); }
    for (let x = l.x + 26; x < l.x + l.w - 10; x += 58) { ctx.beginPath(); ctx.moveTo(x, l.y + l.h - 66); ctx.lineTo(x, l.y + l.h - 14); ctx.stroke(); }
  }
  // beach + sea
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, 0, SEA_X - BEACH_X, WORLD_H);
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(SEA_X, 0, WORLD_W - SEA_X + 80, WORLD_H);
  ctx.fillStyle = PALETTE.sea;
  const wave = Math.sin(G.time * 1.4) * 7;
  ctx.fillRect(SEA_X + 14 + wave * 0.4, 0, WORLD_W - SEA_X, WORLD_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
  for (let y = 30; y < WORLD_H; y += 86) {
    const off = Math.sin(G.time * 1.7 + y * 0.05) * 9;
    ctx.beginPath();
    ctx.moveTo(SEA_X + 4 + off, y);
    ctx.quadraticCurveTo(SEA_X + 30 + off, y + 8, SEA_X + 58 + off, y);
    ctx.stroke();
  }
  // boardwalk
  ctx.fillStyle = '#c9a876';
  ctx.fillRect(BEACH_X - 16, 0, 20, WORLD_H);
}

function drawRoads(ctx, G, cam) {
  ctx.fillStyle = TILE_ROAD;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - STREET_W / 2, BEACH_X + 10, STREET_W);
  // sidewalks
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) {
    ctx.fillRect(ax - ROAD_W / 2 - 13, 0, 10, WORLD_H);
    ctx.fillRect(ax + ROAD_W / 2 + 3, 0, 10, WORLD_H);
  }
  for (const sy of STREETS) {
    ctx.fillRect(0, sy - STREET_W / 2 - 13, BEACH_X + 10, 10);
    ctx.fillRect(0, sy + STREET_W / 2 + 3, BEACH_X + 10, 10);
  }
  // centre dashes
  ctx.strokeStyle = 'rgba(255,214,90,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
  for (const ax of AVENUES) { ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, WORLD_H); ctx.stroke(); }
  for (const sy of STREETS) { ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(BEACH_X + 10, sy); ctx.stroke(); }
  ctx.setLineDash([]);
  // lane edge lines
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
  for (const ax of AVENUES) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ax + s * (ROAD_W / 2 - 6), 0); ctx.lineTo(ax + s * (ROAD_W / 2 - 6), WORLD_H); ctx.stroke(); }
  // crosswalks
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const cw of G.city.crosswalks) {
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cw.x - ROAD_W / 2 + 6, cw.y + i * 20 - 5, 16, 10);
      ctx.fillRect(cw.x + ROAD_W / 2 - 22, cw.y + i * 20 - 5, 16, 10);
      ctx.fillRect(cw.x + i * 24 - 6, cw.y - STREET_W / 2 + 6, 12, 14);
      ctx.fillRect(cw.x + i * 24 - 6, cw.y + STREET_W / 2 - 20, 12, 14);
    }
  }
}

function drawBuildings(ctx, G, cam, night) {
  for (const b of G.city.buildings) {
    if (b.x + b.w < cam.x - 40 || b.x > cam.x + cam.w + 40 || b.y + b.h < cam.y - 40 || b.y > cam.y + cam.h + 40) continue;
    // soft shadow
    ctx.fillStyle = 'rgba(60,30,10,0.22)';
    ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    // windows: grid, some lit at night (deterministic per building seed)
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) for (let ry = 0; ry < rows; ry++) {
      const hsh = Math.sin(b.seed * 0.001 + cx * 12.9898 + ry * 78.233) * 43758.5453;
      const frac = hsh - Math.floor(hsh);
      const lit = night > 0.25 && frac < night * 0.75;
      ctx.fillStyle = lit ? 'rgba(255,214,120,0.95)' : 'rgba(40,50,70,0.5)';
      ctx.fillRect(b.x + 13 + cx * 26, b.y + 13 + ry * 26, 13, 13);
    }
    // neon sign along the south or west edge
    ctx.save();
    ctx.shadowColor = b.neon; ctx.shadowBlur = night > 0.2 ? 16 : 7;
    ctx.fillStyle = b.neon;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = b.name.toUpperCase().slice(0, 22);
    if (b.signSide === 's') ctx.fillText(label, b.x + b.w / 2, b.y + b.h + 15);
    else { ctx.save(); ctx.translate(b.x - 6, b.y + b.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(label, 0, 0); ctx.restore(); }
    ctx.restore();
  }
}

function drawPalms(ctx, G) {
  for (const p of G.city.palms) {
    ctx.fillStyle = 'rgba(60,30,10,0.18)';
    ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 7, 13 * p.s, 6 * p.s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 4 * p.s;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + 4, p.y - 12 * p.s, p.x + 8, p.y - 20 * p.s); ctx.stroke();
    ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 3 * p.s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x + 8, p.y - 20 * p.s);
      ctx.quadraticCurveTo(p.x + 8 + Math.cos(a) * 13 * p.s, p.y - 20 * p.s + Math.sin(a) * 6 * p.s - 3, p.x + 8 + Math.cos(a) * 20 * p.s, p.y - 20 * p.s + Math.sin(a) * 11 * p.s);
      ctx.stroke();
    }
  }
}

export function drawCar(ctx, car, G, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  ctx.fillStyle = 'rgba(40,20,10,0.28)';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 6, w, h);
  ctx.fillStyle = car.dead ? '#3a3a3a' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
  // cabin + glass
  ctx.fillStyle = 'rgba(20,28,44,0.9)';
  roundRect(ctx, -w * 0.12, -h * 0.36, w * 0.34, h * 0.72, 5); ctx.fill();
  ctx.fillStyle = 'rgba(160,210,240,0.65)';
  ctx.fillRect(w * 0.16, -h * 0.3, 4, h * 0.6);
  // wheels
  ctx.fillStyle = '#16161c';
  for (const [wx, wy] of [[-w / 2 + 8, -h / 2 - 2], [w / 2 - 8, -h / 2 - 2], [-w / 2 + 8, h / 2 - 3], [w / 2 - 8, h / 2 - 3]]) ctx.fillRect(wx - 5, wy, 10, 5);
  if (car.kind === 'taxi') { ctx.fillStyle = '#fff3b0'; ctx.fillRect(-6, -5, 12, 10); ctx.fillStyle = '#222'; ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 2.5); }
  if (car.isCop) {
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(-w * 0.3, -h / 2, w * 0.6, h);
    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VHPD', 0, 3);
    const flash = Math.sin(G.time * 10 + (car.sirenPhase || 0)) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2471ff';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.shadowBlur = 0;
  }
  if (car.brakeLight) { ctx.fillStyle = '#ff2d2d'; ctx.fillRect(-w / 2 - 2, -h / 2 + 2, 3, 6); ctx.fillRect(-w / 2 - 2, h / 2 - 8, 3, 6); }
  // headlights at night
  if (night > 0.3) {
    const grad = ctx.createRadialGradient(w / 2, 0, 4, w / 2 + 90, 0, 95);
    grad.addColorStop(0, 'rgba(255,240,180,0.34)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(w / 2, -h * 0.32); ctx.lineTo(w / 2 + 95, -26); ctx.lineTo(w / 2 + 95, 26); ctx.lineTo(w / 2, h * 0.32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6c9'; ctx.fillRect(w / 2 - 1, -h / 2 + 2, 3, 5); ctx.fillRect(w / 2 - 1, h / 2 - 7, 3, 5);
  }
  ctx.restore();
  // health smoke handled by particles; wreck tint
  if (car.dead) { ctx.fillStyle = 'rgba(20,20,20,0.25)'; ctx.beginPath(); ctx.arc(car.x, car.y, 26, 0, Math.PI * 2); ctx.fill(); }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPed(ctx, p, G) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(40,20,10,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(p.phase * 6) * 1.6;
  if (p.dead) { ctx.rotate(Math.PI / 2); }
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(2.5, bob * 0.3, 4.6, 0, Math.PI * 2); ctx.fill();
  if (p.state === 'flee' && !p.dead) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', 0, -13 + bob);
  }
  ctx.restore();
}

export function drawPlayer(ctx, G, C) {
  const p = G.player;
  if (p.car) return; // drawn as the car
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(40,20,10,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 5, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  const moving = Math.abs(p.vx) + Math.abs(p.vy) > 12;
  const bob = moving ? Math.sin(p.walkPhase * 10) * 1.8 : 0;
  ctx.rotate(p.angle);
  // legs
  ctx.fillStyle = '#2d3a55';
  ctx.fillRect(-3, -7 + bob * 0.4, 7, 4.5); ctx.fillRect(-3, 2.5 - bob * 0.4, 7, 4.5);
  // torso — teal shirt, the Vice Harbor look
  ctx.fillStyle = '#14b8a6';
  ctx.beginPath(); ctx.arc(0, bob * 0.2, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(3, bob * 0.2, 5, 0, Math.PI * 2); ctx.fill();
  // gun arm toward aim
  if (C) {
    ctx.rotate(-p.angle + C.aimAngle);
    ctx.fillStyle = '#f1c27d'; ctx.fillRect(6, -2, 10, 4);
    ctx.fillStyle = '#22242c'; ctx.fillRect(14, -2.6, 10, 5.2);
    if (C.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,210,90,0.95)';
      ctx.shadowColor = '#ffcf4d'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(29, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
  // soft ring so the player reads at a glance
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 15 + Math.sin(G.time * 4) * 1.2, 0, Math.PI * 2); ctx.stroke();
}

export function renderWorld(ctx, G, C, viewW, viewH) {
  const cam = G.camera;
  const camRect = { x: cam.x, y: cam.y, w: viewW, h: viewH };
  const night = darkness(G.hour);
  ctx.save();
  ctx.translate(-cam.x + (G.shake ? (G.rng() - 0.5) * G.shake : 0), -cam.y + (G.shake ? (G.rng() - 0.5) * G.shake : 0));
  drawGround(ctx, G, camRect);
  drawRoads(ctx, G, camRect);
  // skid marks under cars
  ctx.fillStyle = 'rgba(22,20,26,0.5)';
  for (const s of G.skids) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  // packages
  for (const pk of G.packages) {
    if (pk.taken) continue;
    const bob = Math.sin(G.time * 3 + pk.bob) * 3;
    ctx.fillStyle = 'rgba(255,215,80,0.3)';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb340';
    ctx.fillRect(pk.x - 6, pk.y - 6 + bob, 12, 12);
    ctx.fillStyle = '#8a5a18'; ctx.fillRect(pk.x - 6, pk.y - 1.5 + bob, 12, 3);
  }
  drawPalms(ctx, G);
  drawBuildings(ctx, G, camRect, night);
  // lamps glow pools at night
  if (night > 0.25) {
    for (const l of G.city.lamps) {
      if (l.x < cam.x - 80 || l.x > cam.x + viewW + 80 || l.y < cam.y - 80 || l.y > cam.y + viewH + 80) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 52);
      g.addColorStop(0, `rgba(255,205,110,${0.34 * night})`); g.addColorStop(1, 'rgba(255,205,110,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, 52, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe6a8'; ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    }
  } else {
    ctx.fillStyle = '#5a5348';
    for (const l of G.city.lamps) ctx.fillRect(l.x - 1.5, l.y - 1.5, 3, 3);
  }
  // mission / objective marker beam
  const obj = G.objectiveCache;
  if (obj && obj.x != null && G.mode === 'play' || (obj && obj.x != null && G.mode === 'dialogue')) {
    const pulse = 0.55 + Math.sin(G.time * 4) * 0.25;
    const grad = ctx.createLinearGradient(obj.x, obj.y - 190, obj.x, obj.y);
    grad.addColorStop(0, 'rgba(255,215,64,0)'); grad.addColorStop(1, `rgba(255,215,64,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(obj.x - 9, obj.y - 190, 18, 190);
    ctx.fillStyle = '#ffd740';
    ctx.beginPath(); ctx.arc(obj.x, obj.y, 15 + Math.sin(G.time * 4) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5200'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', obj.x, obj.y + 5);
  }
  // entities
  for (const car of G.cars) drawCar(ctx, car, G, night);
  for (const cop of G.cops) drawCar(ctx, cop, G, night);
  for (const p of G.peds) drawPed(ctx, p, G);
  if (G.player.car) drawCar(ctx, G.player.car, G, night);
  drawPlayer(ctx, G, C);
  // tracers, casings, particles
  for (const t of G.tracers) {
    ctx.strokeStyle = 'rgba(255,230,150,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  ctx.fillStyle = '#d9a441';
  for (const c of G.casings) ctx.fillRect(c.x - 1.5, c.y - 1.5, 3, 3);
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // day/night grade overlay
  const g = skyGrade(G.hour);
  if (g.a > 0.01) { ctx.fillStyle = `rgba(${g.r},${g.g},${g.b},${g.a})`; ctx.fillRect(0, 0, viewW, viewH); }
  // golden-hour warmth
  if (G.hour > 16.8 && G.hour < 19.2) { ctx.fillStyle = 'rgba(255,140,50,0.08)'; ctx.fillRect(0, 0, viewW, viewH); }
}

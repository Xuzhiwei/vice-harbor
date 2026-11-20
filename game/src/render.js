// Vice Harbor — painting the harbour: ground, roads and beach first, then buildings
// with their neon, palms and lamps, cars, people, effects, and the day-night light
// that washes over all of it. Screens (title, pause, busted, wasted) live here too.
import {
  AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, SAND_X, WATER_X, PALETTE,
} from './config.js';
import { clamp, lerp } from './city.js';
import { missionMarker } from './missions.js';
import { VIEW_W, VIEW_H } from './world.js';

/** How dark and how golden the light is at a given time of day. */
export function lightAt(minutes) {
  const h = minutes / 60;
  let dark = 0;
  if (h >= 19.5 || h < 5) dark = 0.82;
  else if (h >= 17.5) dark = (h - 17.5) / 2 * 0.82;
  else if (h < 7) dark = 0.82 * (1 - (h - 5) / 2);
  let dusk = 0;
  if (h >= 16.8 && h < 20.4) dusk = Math.sin(((h - 16.8) / 3.6) * Math.PI);
  else if (h >= 5.4 && h < 7.6) dusk = Math.sin(((h - 5.4) / 2.2) * Math.PI) * 0.7;
  return { dark, dusk };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const NEON = ['#ff5da2', '#22d3ee', '#ffd166', '#7Cfc9a', '#c77dff', '#ff8c42'];

function drawGround(ctx, state, cam) {
  const { city } = state;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
  // Mown stripes on the grass.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 128;
  for (let x = Math.floor(cam.x / stripe) * stripe; x < cam.x + VIEW_W; x += stripe * 2) {
    ctx.fillRect(x, cam.y, stripe, VIEW_H);
  }
  for (const park of city.parks) {
    if (!visible(cam, park)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  for (const lot of city.lots) {
    if (!visible(cam, lot)) continue;
    ctx.fillStyle = PALETTE.parking;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(240,240,230,0.5)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 26; x < lot.x + lot.w - 20; x += 62) {
      ctx.beginPath();
      ctx.moveTo(x, lot.y + 16);
      ctx.lineTo(x, lot.y + 58);
      ctx.lineTo(x + 34, lot.y + 58);
      ctx.lineTo(x + 34, lot.y + 16);
      ctx.stroke();
    }
  }
  // Sidewalks, then roads over them.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2 - 16, 0, ROAD_W + 32, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2 - 16, SAND_X, ROAD_W + 32);
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, SAND_X, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const ax of AVENUES) {
    for (let y = 12; y < WORLD_H; y += 46) {
      if (STREETS.some((sy) => Math.abs(y - sy) < ROAD_W / 2 + 8)) continue;
      ctx.fillRect(ax - 2, y, 4, 24);
    }
  }
  for (const sy of STREETS) {
    for (let x = 12; x < SAND_X; x += 46) {
      if (AVENUES.some((ax) => Math.abs(x - ax) < ROAD_W / 2 + 8)) continue;
      ctx.fillRect(x, sy - 2, 24, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,238,228,0.75)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (ax + 80 < cam.x || ax - 80 > cam.x + VIEW_W || sy + 80 < cam.y || sy - 80 > cam.y + VIEW_H) continue;
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(ax + i * 18 - 6, sy - ROAD_W / 2 - 13, 12, 9);
        ctx.fillRect(ax + i * 18 - 6, sy + ROAD_W / 2 + 4, 12, 9);
        ctx.fillRect(ax - ROAD_W / 2 - 13, sy + i * 18 - 6, 9, 12);
        ctx.fillRect(ax + ROAD_W / 2 + 4, sy + i * 18 - 6, 9, 12);
      }
    }
  }
  // Beach and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(SAND_X, 0, WATER_X - SAND_X, WORLD_H);
  ctx.fillStyle = PALETTE.sandDark;
  for (const s of city.speckles) {
    if (s.x < cam.x - 10 || s.x > cam.x + VIEW_W + 10 || s.y < cam.y - 10 || s.y > cam.y + VIEW_H + 10) continue;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  const wave = Math.sin(state.time * 0.9) * 5;
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WATER_X + wave * 0.3, 0, WORLD_W - WATER_X, WORLD_H);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let y = -40; y < WORLD_H; y += 92) {
    const off = Math.sin(state.time * 0.6 + y * 0.05) * 16;
    ctx.fillRect(WATER_X + 60 + off, y, 150, 10);
    ctx.fillRect(WATER_X + 210 - off, y + 44, 120, 8);
  }
  ctx.fillStyle = PALETTE.waterFoam;
  for (let y = 0; y < WORLD_H; y += 34) {
    const wob = Math.sin(state.time * 1.4 + y * 0.11) * 6;
    ctx.fillRect(WATER_X - 4 + wob, y, 7, 18);
  }
  // Promenade planks along the sand.
  ctx.fillStyle = 'rgba(160, 116, 74, 0.5)';
  for (let y = 0; y < WORLD_H; y += 26) ctx.fillRect(SAND_X + 6, y, 30, 3);
}

function visible(cam, r) {
  return r.x + r.w > cam.x - 60 && r.x < cam.x + VIEW_W + 60 && r.y + r.h > cam.y - 60 && r.y < cam.y + VIEW_H + 60;
}

function drawBuildings(ctx, state, cam, light) {
  const { city } = state;
  for (const b of city.buildings) {
    if (!visible(cam, b)) continue;
    const lift = 5 + b.floors * 2.2;
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y + lift, b.w, b.h - lift + 4);
    ctx.fillStyle = b.roof;
    rr(ctx, b.x, b.y, b.w, b.h - lift, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Roof details: a water tank or AC block on the bigger roofs.
    if (b.w > 130) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(b.x + b.w * 0.62, b.y + 14, 30, 22);
      ctx.fillRect(b.x + 16, b.y + b.h - lift - 34, 22, 16);
    }
    // Windows: a seeded grid, lit gold after dark.
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor((b.h - lift) / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const lit = ((Math.sin(b.seed + i * 12.9898 + j * 78.233) * 43758.5453) % 1 + 1) % 1;
        const wx = b.x + 12 + i * ((b.w - 24) / cols);
        const wy = b.y + 12 + j * ((b.h - lift - 18) / rows);
        if (light.dark > 0.25 && lit > 0.45) {
          // Lit windows are not one flat gold: most burn warm, a few run
          // cool office-white, and each shade sits at its own brightness.
          const tone = ((Math.sin(b.seed * 3.7 + i * 3.31 + j * 17.17) * 24634.6345) % 1 + 1) % 1;
          const a = 0.3 + light.dark * 0.62;
          ctx.fillStyle = tone > 0.78
            ? `rgba(190, 225, 255, ${a})`
            : `rgba(255, ${tone > 0.4 ? 205 : 176}, 92, ${a})`;
        } else {
          ctx.fillStyle = 'rgba(38, 62, 84, 0.55)';
        }
        ctx.fillRect(wx, wy, 13, 10);
      }
    }
    if (b.name) {
      const neon = NEON[Math.abs(Math.floor(b.seed)) % NEON.length];
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const signY = b.y + b.h - lift - 8;
      if (light.dark > 0.3) {
        // Neon after dark: a wide halo pass under a hot near-white core, and
        // now and then a tube dips — each sign flickers on its own schedule.
        const flick = ((Math.sin(b.seed * 7.13 + Math.floor(state.time * 9) * 2.39) * 43758.5453) % 1 + 1) % 1;
        const dip = flick > 0.965 ? 0.45 : 1;
        ctx.save();
        ctx.globalAlpha = dip;
        ctx.shadowColor = neon;
        ctx.shadowBlur = 22;
        ctx.fillStyle = neon;
        ctx.fillText(b.name, b.x + b.w / 2, signY);
        ctx.shadowBlur = 6;
        ctx.globalAlpha = dip * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.name, b.x + b.w / 2, signY);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(52, 40, 34, 0.8)';
        ctx.fillText(b.name, b.x + b.w / 2, signY);
      }
      ctx.textAlign = 'left';
    }
  }
}

function drawPalms(ctx, state, cam) {
  for (const palm of state.city.palms) {
    if (palm.x < cam.x - 40 || palm.x > cam.x + VIEW_W + 40 || palm.y < cam.y - 40 || palm.y > cam.y + VIEW_H + 40) continue;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(palm.x + 8, palm.y + 5, 13 * palm.s, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6642';
    ctx.lineWidth = 3.4 * palm.s;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.quadraticCurveTo(palm.x + 3, palm.y - 9 * palm.s, palm.x + 6, palm.y - 15 * palm.s);
    ctx.stroke();
    ctx.strokeStyle = '#2f9e57';
    ctx.lineWidth = 2.6 * palm.s;
    for (let i = 0; i < 6; i += 1) {
      const a = palm.seed + (i * Math.PI) / 3 + Math.sin(state.time * 1.2 + palm.seed) * 0.05;
      ctx.beginPath();
      ctx.moveTo(palm.x + 6, palm.y - 15 * palm.s);
      ctx.quadraticCurveTo(
        palm.x + 6 + Math.cos(a) * 13 * palm.s, palm.y - 15 * palm.s + Math.sin(a) * 6 * palm.s - 3,
        palm.x + 6 + Math.cos(a) * 21 * palm.s, palm.y - 15 * palm.s + Math.sin(a) * 11 * palm.s + 4,
      );
      ctx.stroke();
    }
  }
}

function drawPackages(ctx, state) {
  for (const pack of state.packages) {
    if (pack.taken) continue;
    const bob = Math.sin(state.time * 3 + pack.x) * 2.4;
    ctx.save();
    ctx.shadowColor = '#ffd83d';
    ctx.shadowBlur = 12 + Math.sin(state.time * 4) * 4;
    ctx.fillStyle = '#8a5a2b';
    rr(ctx, pack.x - 10, pack.y - 7 + bob, 20, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd83d';
    ctx.fillRect(pack.x - 10, pack.y - 1 + bob, 20, 3);
    ctx.restore();
  }
}

function drawMarker(ctx, state) {
  const marker = missionMarker(state);
  const fare = state.fare;
  const target = fare
    ? { x: fare.phase === 'pickup' ? fare.x : fare.destX, y: fare.phase === 'pickup' ? fare.y : fare.destY, color: '#ffd83d', label: 'TAXI' }
    : marker
      ? { x: marker.x, y: marker.y, color: marker.kind === 'giver' ? '#ff9f43' : '#ffe14d', label: marker.kind === 'giver' ? '!' : '' }
      : null;
  if (!target) return;
  const pulse = 1 + Math.sin(state.time * 4.5) * 0.16;
  ctx.save();
  ctx.globalAlpha = 0.28;
  const grad = ctx.createLinearGradient(0, target.y - 190, 0, target.y);
  grad.addColorStop(0, 'rgba(255, 225, 77, 0)');
  grad.addColorStop(1, target.color);
  ctx.fillStyle = grad;
  ctx.fillRect(target.x - 13, target.y - 190, 26, 190);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = target.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = target.color;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
  ctx.fill();
  if (target.label) {
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = target.color;
    ctx.fillText(target.label, target.x, target.y - 42 - Math.sin(state.time * 4.5) * 3);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

// ---- Entities, effects, light and screens (second half of render.js) ----

function drawPed(ctx, state, ped) {
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(ped.x + 3, ped.y + 4, 8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'down') {
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y, 12, 5.5, ped.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 13, ped.y + Math.sin(ped.angle) * 13, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const stepBob = Math.sin(ped.walkPhase) * 1.4;
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + stepBob * 0.3, 7.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + stepBob * 0.3, 3.9, 0, Math.PI * 2);
  ctx.fill();
  if (ped.hat) {
    // A cap: a half-disc over the crown, in a colour that argues with the shirt.
    ctx.fillStyle = ped.hat;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + stepBob * 0.3, 4.5, Math.PI * 0.92, Math.PI * 2.08);
    ctx.closePath();
    ctx.fill();
  }
  if (ped.panic > 0 || ped.startle > 0) {
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('!', ped.x - 1.5, ped.y - 12);
  }
}

function drawCar(ctx, state, car, light) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = PALETTE.shadow;
  rr(ctx, -19, -7, 44, 22, 7);
  ctx.fill();
  if (car.dead) {
    ctx.fillStyle = '#3c3c40';
  } else if (car.kind === 'cop') {
    ctx.fillStyle = '#f4f6f8';
  } else {
    ctx.fillStyle = car.color;
  }
  rr(ctx, -21, -10.5, 42, 21, 6);
  ctx.fill();
  if (car.kind === 'cop' && !car.dead) {
    ctx.fillStyle = '#23272e';
    rr(ctx, -9, -10.5, 15, 21, 3);
    ctx.fill();
    // Light bar: red and blue trade places with the siren phase.
    const red = Math.sin(car.sirenPhase) > 0;
    ctx.save();
    ctx.shadowBlur = 13;
    ctx.shadowColor = red ? '#ff3b30' : '#2f7bff';
    ctx.fillStyle = red ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-3, -6, 6, 5);
    ctx.shadowColor = red ? '#2f7bff' : '#ff3b30';
    ctx.fillStyle = red ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-3, 1, 6, 5);
    ctx.restore();
  }
  // Cabin and glass.
  ctx.fillStyle = car.dead ? '#22252a' : 'rgba(24, 42, 58, 0.9)';
  rr(ctx, -8, -8, 17, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 210, 235, 0.5)';
  ctx.fillRect(7, -7.5, 3.4, 15);
  // Wheels.
  ctx.fillStyle = '#17181c';
  ctx.fillRect(-15, -12.5, 9, 3.6);
  ctx.fillRect(-15, 8.9, 9, 3.6);
  ctx.fillRect(7, -12.5, 9, 3.6);
  ctx.fillRect(7, 8.9, 9, 3.6);
  // Headlights, and cones after dark.
  if (!car.dead) {
    ctx.fillStyle = '#fff6bf';
    ctx.fillRect(19.4, -8, 2.4, 4.4);
    ctx.fillRect(19.4, 3.6, 2.4, 4.4);
    // Tail lights, flaring with a halo for as long as the car is braking.
    if (car.brake > 0) {
      ctx.save();
      ctx.shadowColor = '#ff2d20';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff6a5e';
      ctx.fillRect(-21.6, -8, 2.2, 4);
      ctx.fillRect(-21.6, 4, 2.2, 4);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff5147';
      ctx.fillRect(-21.6, -8, 2.2, 4);
      ctx.fillRect(-21.6, 4, 2.2, 4);
    }
    if (light.dark > 0.3) {
      const grad = ctx.createLinearGradient(21, 0, 120, 0);
      grad.addColorStop(0, `rgba(255, 244, 180, ${0.16 * light.dark})`);
      grad.addColorStop(1, 'rgba(255, 244, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(21, -7);
      ctx.lineTo(120, -24);
      ctx.lineTo(120, 24);
      ctx.lineTo(21, 7);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  if (!car.dead && car.health < 55) {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    ctx.beginPath();
    ctx.arc(car.x + 8, car.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return;
  // A deeper, wider contact shadow so Jules reads even at thumbnail size.
  ctx.fillStyle = 'rgba(30, 20, 14, 0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 5, 11.5, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(p.walkPhase) * 1.2;
  // Legs when moving.
  ctx.fillStyle = '#2d4059';
  const legSwing = Math.sin(p.walkPhase) * 5;
  ctx.fillRect(p.x - 5 + Math.cos(p.angle) * legSwing * 0.4, p.y + 3, 4.4, 7);
  ctx.fillRect(p.x + 2 - Math.cos(p.angle) * legSwing * 0.4, p.y + 3, 4.4, 7);
  // Jacket and head, ringed dark-then-white so the player reads at a glance.
  ctx.fillStyle = '#0fb5ae';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.25, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 16, 10, 0.55)';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.9;
  ctx.stroke();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.25, 5.2, 0, Math.PI * 2);
  ctx.fill();
  // The pistol: a dark line toward the aim, a star of flame when it speaks.
  if (p.aiming || p.muzzle > 0) {
    const gx = p.x + Math.cos(p.aimAngle) * 10;
    const gy = p.y + Math.sin(p.aimAngle) * 10;
    ctx.strokeStyle = '#22252b';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(p.aimAngle) * 9, gy + Math.sin(p.aimAngle) * 9);
    ctx.stroke();
    if (p.muzzle > 0) {
      const mx = gx + Math.cos(p.aimAngle) * 13;
      const my = gy + Math.sin(p.aimAngle) * 13;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4 + p.aimAngle;
        const r = i % 2 === 0 ? 10 : 4;
        ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  if (p.meleeTime > 0.14) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, p.angle - 0.7, p.angle + 0.7);
    ctx.stroke();
  }
  if (p.hurtTime > 0) {
    ctx.strokeStyle = 'rgba(255,60,50,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15 + Math.sin(state.time * 20) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSkids(ctx, state) {
  if (!state.skids || state.skids.length === 0) return;
  ctx.save();
  ctx.strokeStyle = '#26221e';
  ctx.lineCap = 'round';
  for (const s of state.skids) {
    ctx.globalAlpha = Math.max(0, s.life) * 0.42;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    s.life -= 0.0016; // rubber fades a touch with every pass of the sun
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (state.skids.every((s) => s.life <= 0)) state.skids.length = 0;
}

function drawFx(ctx, state) {
  for (const b of state.bullets) {
    ctx.strokeStyle = 'rgba(255, 230, 150, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Brass casings get their own pass: little tumbling bars, not sparks.
  for (const pt of state.particles) {
    if (pt.kind !== 'casing') continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.translate(pt.x, pt.y);
    ctx.rotate((pt.spin || 0) + pt.life * 14);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(-2.4, -1, 4.8, 2);
    ctx.restore();
  }
  for (const pt of state.particles) {
    if (pt.kind === 'casing') continue;
    const a = Math.max(0, pt.life / pt.max);
    ctx.globalAlpha = pt.kind === 'smoke' ? a * 0.55 : a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? 1 + (1 - a) * 1.6 : 1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Hit-marker: a brief cross where the last bullet bit — red when it ended it.
  if (state.hitmark && state.hitmark.t > 0) {
    const hm = state.hitmark;
    ctx.save();
    ctx.globalAlpha = Math.min(1, hm.t / 0.16);
    ctx.strokeStyle = hm.kill ? '#ff5147' : '#ffffff';
    ctx.lineWidth = 2.2;
    for (const d of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(hm.x + d[0] * 3.2, hm.y + d[1] * 3.2);
      ctx.lineTo(hm.x + d[0] * 7.5, hm.y + d[1] * 7.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawLighting(ctx, state, light) {
  if (light.dark <= 0.01 && light.dusk <= 0.01) return;
  const cam = state.camera;
  if (light.dusk > 0.01) {
    ctx.fillStyle = `rgba(255, 128, 54, ${light.dusk * 0.13})`;
    ctx.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
  }
  if (light.dark > 0.01) {
    ctx.fillStyle = `rgba(10, 14, 46, ${light.dark * 0.52})`;
    ctx.fillRect(cam.x, cam.y, VIEW_W, VIEW_H);
    // Pools of lamplight.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of state.city.lamps) {
      if (lamp.x < cam.x - 90 || lamp.x > cam.x + VIEW_W + 90 || lamp.y < cam.y - 90 || lamp.y > cam.y + VIEW_H + 90) continue;
      const grad = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 62);
      grad.addColorStop(0, `rgba(255, 214, 130, ${0.34 * light.dark})`);
      grad.addColorStop(1, 'rgba(255, 214, 130, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
    }
    ctx.restore();
  }
}

/** Paint the whole world for one frame; the HUD is drawn by hud.js over this. */
export function drawWorld(ctx, state) {
  const cam = state.camera;
  const light = lightAt(state.minutes);
  ctx.save();
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));
  drawGround(ctx, state, cam);
  drawSkids(ctx, state);
  drawPackages(ctx, state);
  drawMarker(ctx, state);
  for (const ped of state.peds) {
    if (ped.x < cam.x - 40 || ped.x > cam.x + VIEW_W + 40 || ped.y < cam.y - 40 || ped.y > cam.y + VIEW_H + 40) continue;
    drawPed(ctx, state, ped);
  }
  const sortedCars = [...state.cars].sort((a, b) => a.y - b.y);
  for (const car of sortedCars) {
    if (car.x < cam.x - 80 || car.x > cam.x + VIEW_W + 80 || car.y < cam.y - 80 || car.y > cam.y + VIEW_H + 80) continue;
    drawCar(ctx, state, car, light);
  }
  drawPlayer(ctx, state);
  drawPalms(ctx, state, cam);
  drawBuildings(ctx, state, cam, light);
  drawFx(ctx, state);
  drawLighting(ctx, state, light);
  ctx.restore();
  // A soft vignette to sit the frame.
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.52, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vignette.addColorStop(0, 'rgba(20,10,0,0)');
  vignette.addColorStop(1, 'rgba(20,10,0,0.20)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, w, h, yOff = 0) {
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2 + yOff;
  ctx.fillStyle = 'rgba(13, 15, 26, 0.88)';
  rr(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 217, 61, 0.5)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 18);
  ctx.stroke();
  return { x, y };
}

export function drawTitleScreen(ctx, state, canContinue) {
  ctx.fillStyle = 'rgba(16, 10, 24, 0.42)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#ff5da2';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffd9ec';
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.fillText('VICE HARBOR', VIEW_W / 2, 196);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#d9fbff';
  ctx.font = '600 25px system-ui, sans-serif';
  ctx.fillText('an original harbour crime story', VIEW_W / 2, 240);
  ctx.restore();
  const { x, y } = panel(ctx, 620, 300, 62);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '400 19px system-ui, sans-serif';
  const lines = [
    'WASD / arrows — move · SHIFT — sprint · E — cars & talk',
    'Mouse — aim · Click — pistol · F — melee · R — reload',
    'SPACE — handbrake · P / ESC — pause · M — mute',
    '',
    'Steal cars, run fares, work the story — mind the stars.',
  ];
  lines.forEach((text, i) => ctx.fillText(text, VIEW_W / 2, y + 58 + i * 33));
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = '#ffd83d';
  ctx.fillText(canContinue ? 'ENTER — new game · C — continue' : 'ENTER — start your first shift', VIEW_W / 2, y + 252);
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245,242,232,0.6)';
  ctx.fillText('Vice Harbor — every name, street and story on this harbour is its own.', VIEW_W / 2, VIEW_H - 26);
  ctx.textAlign = 'left';
  void x;
}

export function drawPauseScreen(ctx, state) {
  ctx.fillStyle = 'rgba(8, 8, 16, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const { y } = panel(ctx, 480, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd9ec';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, y + 74);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '400 19px system-ui, sans-serif';
  ctx.fillText(`Cash $${state.player.cash} · Mission ${Math.min(state.missions.index + (state.missions.active ? 1 : 0), 6)} of 6`, VIEW_W / 2, y + 122);
  ctx.fillText(`Packages ${state.player.packagesFound} of ${state.packages.length}`, VIEW_W / 2, y + 152);
  ctx.fillStyle = '#ffd83d';
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('P — resume · S — save · M — mute', VIEW_W / 2, y + 208);
  ctx.fillText('N — new game', VIEW_W / 2, y + 240);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, state, kind) {
  const busted = kind === 'busted';
  ctx.fillStyle = busted ? 'rgba(20, 26, 60, 0.62)' : 'rgba(50, 4, 4, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = busted ? '#4da3ff' : '#ff3b30';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 92px system-ui, sans-serif';
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', VIEW_W / 2, VIEW_H / 2 - 30);
  ctx.restore();
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '400 21px system-ui, sans-serif';
  ctx.fillText(busted ? 'The harbour police walk you to a cell. The fine stings worse.' : 'You wake up at St Marina Hospital, stitched and billed.', VIEW_W / 2, VIEW_H / 2 + 24);
  ctx.fillStyle = '#ffd83d';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('ENTER — wake up', VIEW_W / 2, VIEW_H / 2 + 70);
  ctx.textAlign = 'left';
}

export { clamp, lerp };

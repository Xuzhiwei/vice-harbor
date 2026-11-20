// Procedural WebAudio: engine hum, sirens, gunfire, pickups, UI blips and a
// tiny synthwave loop. No audio files anywhere.
let ctx = null;
let master = null;
let muted = false;
let musicTimer = 0;
let musicStep = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
export function isMuted() { return muted; }
function now() { return ctx ? ctx.currentTime : 0; }

function blip(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx || muted) return;
  const t = now() + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
  if (!ctx || muted) return;
  const t = now() + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  ui() { blip(660, 0.07, 'square', 0.12); },
  pickup() { blip(880, 0.09, 'sine', 0.22); blip(1320, 0.14, 'sine', 0.22, null, 0.08); },
  cash() { blip(1180, 0.07, 'triangle', 0.2); blip(1560, 0.12, 'triangle', 0.2, null, 0.06); },
  door() { noise(0.12, 0.16, 700); blip(180, 0.1, 'sine', 0.14, 90); },
  gunshot() { noise(0.14, 0.5, 2600); blip(150, 0.1, 'sawtooth', 0.3, 55); },
  reload() { noise(0.06, 0.2, 1800); blip(320, 0.05, 'square', 0.12, null, 0.12); noise(0.06, 0.22, 2200, 0.3); },
  dryFire() { blip(240, 0.05, 'square', 0.14); },
  hit() { blip(190, 0.06, 'square', 0.18, 120); },
  melee() { noise(0.09, 0.3, 900); },
  crash(big = false) { noise(big ? 0.4 : 0.2, big ? 0.55 : 0.32, 800); blip(90, 0.25, 'sawtooth', 0.25, 40); },
  horn() { blip(370, 0.22, 'sawtooth', 0.16); blip(466, 0.22, 'sawtooth', 0.12); },
  siren(t) { if (ctx && !muted) blip(700 + Math.sin(t * 6) * 220, 0.09, 'triangle', 0.05); },
  engine(rpm) { if (ctx && !muted && Math.random() < 0.3) blip(55 + rpm * 60, 0.05, 'sawtooth', 0.045); },
  busted() { blip(520, 0.5, 'sawtooth', 0.25, 110); },
  wasted() { blip(220, 0.9, 'sine', 0.3, 55); },
  phone() { blip(1046, 0.1, 'sine', 0.16); blip(1046, 0.1, 'sine', 0.16, null, 0.16); },
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'triangle', 0.2, null, i * 0.09)); },
};

// A lazy minor-key synthwave arpeggio, scheduled from the main loop.
const BASS = [110, 110, 130.8, 98];
const ARP = [220, 261.6, 329.6, 392, 329.6, 261.6];
export function updateMusic(dt, active) {
  if (!ctx || muted || !active) return;
  musicTimer -= dt;
  if (musicTimer <= 0) {
    musicTimer = 0.24;
    const bar = Math.floor(musicStep / 8) % BASS.length;
    if (musicStep % 8 === 0) blip(BASS[bar], 0.9, 'triangle', 0.11);
    blip(ARP[musicStep % ARP.length] * (bar === 3 ? 0.89 : 1), 0.2, 'square', 0.045);
    musicStep++;
  }
}

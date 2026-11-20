// Vice Harbor — all sound is procedural WebAudio: oscillators and filtered noise,
// no samples. Engine hum follows the player's car, sirens wail when cruisers close in,
// and a lazy synth loop plays the harbour's theme under everything.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startEngine();
    startMusic();
    return true;
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter).connect(engineGain).connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenLfo = ctx.createOscillator();
    sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }

  function blip(freqA, freqB, dur, type, vol) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqB), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  // A slow A-minor groove: soft bass on the beat, a pentatonic pluck wandering above.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  const PLUCK = [220, 261.6, 329.6, 392, 329.6, 261.6, 293.7, 220];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted || ctx.state !== 'running') return;
      const bass = BASS[musicStep % BASS.length];
      if (bass) blip(bass, bass, 0.34, 'sine', 0.16);
      if (musicStep % 2 === 0 && Math.random() < 0.75) {
        const note = PLUCK[Math.floor(Math.random() * PLUCK.length)];
        blip(note * 2, note * 2, 0.22, 'triangle', 0.05);
      }
      musicStep += 1;
    }, 235);
  }

  return {
    unlock() { ensure(); },
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.03);
      return muted;
    },
    get muted() { return muted; },
    /** Called every frame with the player's driving state and nearest cruiser. */
    frame(carSpeed, inCar, copDistance) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const engineTarget = inCar ? 0.05 + Math.min(0.09, Math.abs(carSpeed) / 3200) : 0;
      engineGain.gain.setTargetAtTime(engineTarget, t, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + Math.abs(carSpeed) * 0.55, t, 0.06);
      const sirenTarget = copDistance < 460 ? 0.028 * (1 - copDistance / 520) + 0.008 : 0;
      sirenGain.gain.setTargetAtTime(Math.max(0, sirenTarget), t, 0.15);
    },
    gunshot() { noise(0.16, 0.5, 900); blip(160, 40, 0.1, 'square', 0.2); },
    dryFire() { blip(1200, 900, 0.04, 'square', 0.08); },
    reload() { blip(300, 500, 0.07, 'square', 0.1); setTimeout(() => blip(500, 260, 0.06, 'square', 0.1), 120); },
    swing() { noise(0.09, 0.12, 500); },
    thud() { noise(0.1, 0.3, 220); blip(90, 45, 0.12, 'sine', 0.3); },
    crash(strength) { noise(0.22, Math.min(0.55, 0.14 + strength / 420), 300); },
    pickup() { blip(660, 990, 0.11, 'sine', 0.16); },
    cash() { blip(880, 880, 0.07, 'square', 0.1); setTimeout(() => blip(1318, 1318, 0.12, 'square', 0.1), 75); },
    phone() { blip(1046, 1046, 0.09, 'sine', 0.12); setTimeout(() => blip(1046, 1046, 0.09, 'sine', 0.12), 150); },
    door() { blip(140, 90, 0.09, 'sine', 0.22); },
    sirenBlip() { blip(720, 980, 0.14, 'triangle', 0.1); },
    fail() { blip(220, 110, 0.3, 'sawtooth', 0.1); },
    busted() { blip(392, 392, 0.16, 'square', 0.12); setTimeout(() => blip(311, 311, 0.16, 'square', 0.12), 170); setTimeout(() => blip(233, 180, 0.3, 'square', 0.12), 340); },
  };
}

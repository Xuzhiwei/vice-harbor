// Vice Harbor — boot and the one loop. The world advances in fixed steps behind four
// screens (title, play, pause, and the busted/wasted endings); input actions route to
// whichever screen is up. ?shot=cover|chase|mission|night&seed=N stages a deterministic
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP, WORLD_W } from './config.js';
import { createInput, ACT_INTERACT, ACT_PAUSE, ACT_MELEE, ACT_RELOAD, ACT_MUTE, ACT_CONFIRM } from './input.js';
import { createGame, stepGame, respawn, VIEW_W, VIEW_H } from './world.js';
import { tryEnterExit } from './vehicles.js';
import { meleeSwing, startReload } from './combat.js';
import { createAudio } from './audio.js';
import { hasSave, saveGame, loadGame } from './save.js';
import { drawWorld, drawTitleScreen, drawPauseScreen, drawEndScreen } from './render.js';
import { drawHUD } from './hud.js';
import { stageShot } from './shots.js';

const CITY_SEED = 987123;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const audio = createAudio();

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const state = createGame(CITY_SEED, null);
  stageShot(name, state, stepGame);
  window.__state = state; // QA handle: lets a headless check read the staged world.
  let painted = 0;
  function paint() {
    drawWorld(ctx, state);
    drawHUD(ctx, state);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = createGame(CITY_SEED, audio);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let titlePan = 0;
  let fade = 1; // the harbour fades in from black on boot and after each reset
  const extraKeys = new Set();
  window.addEventListener('keydown', (event) => {
    if (!event.repeat) extraKeys.add(event.code);
  });

  function drawFade(dtReal) {
    if (fade <= 0) return;
    ctx.fillStyle = `rgba(6, 4, 10, ${fade})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    fade = Math.max(0, fade - dtReal * 1.5);
  }

  function newGame() {
    state = createGame(CITY_SEED, audio);
    screen = 'play';
    state.screen = 'play';
    fade = 1;
    announce('Vice Harbor. Meet your contact at the orange marker.');
  }

  function continueGame() {
    state = createGame(CITY_SEED, audio);
    if (loadGame(state)) {
      screen = 'play';
      state.screen = 'play';
      fade = 1;
      state.toast = { text: 'Welcome back to Vice Harbor', time: 3 };
      announce('Save loaded.');
    } else {
      newGame();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (actions & ACT_MUTE) {
      const muted = audio.setMuted(!audio.muted);
      state.toast = { text: muted ? 'Sound off' : 'Sound on', time: 1.6 };
    }
    if (screen === 'title') {
      if (extraKeys.has('KeyC') && hasSave()) {
        audio.unlock();
        continueGame();
      } else if (actions & ACT_CONFIRM) {
        audio.unlock();
        newGame();
      }
      return;
    }
    if (screen === 'busted' || screen === 'wasted') {
      if (actions & ACT_CONFIRM) {
        respawn(state, screen === 'busted');
        screen = 'play';
        state.screen = 'play';
        fade = 1;
      }
      return;
    }
    if (screen === 'pause') {
      if (actions & (ACT_PAUSE | ACT_CONFIRM)) {
        screen = 'play';
        state.screen = 'play';
      } else if (extraKeys.has('KeyS')) {
        if (saveGame(state)) state.toast = { text: 'Saved', time: 1.8 };
      } else if (extraKeys.has('KeyN')) {
        newGame();
      }
      return;
    }
    // Play screen.
    if (actions & ACT_PAUSE) {
      screen = 'pause';
      state.screen = 'pause';
      announce('Paused.');
      return;
    }
    if (actions & ACT_INTERACT) {
      if (state.dialogue) state.dialogueAdvance = true;
      else {
        const message = tryEnterExit(state);
        if (message) state.toast = { text: message, time: 1.6 };
      }
    }
    if (clicked && state.dialogue) state.dialogueAdvance = true;
    if (actions & ACT_MELEE) meleeSwing(state);
    if (actions & ACT_RELOAD) startReload(state);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dtReal = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dtReal;
    last = now;
    handleActions();
    extraKeys.clear();

    if (screen === 'title') {
      // The harbour idles behind the title: traffic rolls, the camera drifts.
      // The drift runs on real elapsed time, so it glides at the same pace on
      // a 60 Hz laptop and a 144 Hz monitor alike.
      titlePan += dtReal;
      while (accumulator >= STEP) {
        stepGame(state, input, STEP);
        accumulator -= STEP;
      }
      state.camera.x = (Math.sin(titlePan * 0.11) * 0.5 + 0.5) * (WORLD_W - VIEW_W);
      state.camera.y = (Math.cos(titlePan * 0.07) * 0.5 + 0.5) * 900;
      drawWorld(ctx, state);
      drawTitleScreen(ctx, state, hasSave());
      drawFade(dtReal);
      return;
    }

    if (screen === 'play') {
      let guard = 0;
      while (accumulator >= STEP && guard < 6) {
        stepGame(state, input, STEP);
        accumulator -= STEP;
        guard += 1;
        if (state.busted) {
          screen = 'busted';
          state.screen = 'busted';
          audio.busted();
          announce('Busted.');
          break;
        }
        if (state.wasted) {
          screen = 'wasted';
          state.screen = 'wasted';
          announce('Wasted.');
          break;
        }
      }
      if (state.dirtySave) {
        state.dirtySave = false;
        saveGame(state);
      }
    } else {
      accumulator = 0;
    }

    drawWorld(ctx, state);
    drawHUD(ctx, state);
    if (screen === 'pause') drawPauseScreen(ctx, state);
    if (screen === 'busted') drawEndScreen(ctx, state, 'busted');
    if (screen === 'wasted') drawEndScreen(ctx, state, 'wasted');
    drawFade(dtReal);

    const p = state.player;
    let copDistance = Infinity;
    for (const cop of state.cops) {
      if (!cop.dead) copDistance = Math.min(copDistance, Math.hypot(cop.x - p.x, cop.y - p.y));
    }
    audio.frame(p.inCar ? Math.hypot(p.inCar.vx, p.inCar.vy) : 0, Boolean(p.inCar), copDistance);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'pause';
      state.screen = 'pause';
    }
  });
  // Alt-tabbing away on a desktop browser deserves the same mercy.
  window.addEventListener('blur', () => {
    if (screen === 'play') {
      screen = 'pause';
      state.screen = 'pause';
    }
  });

  announce('Vice Harbor. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

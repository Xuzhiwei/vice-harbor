// Vice Harbor — keyboard and mouse state. The loop reads held keys and the mouse every
// frame; one-shot actions (interact, pause, melee…) are latched as bits and consumed once
// by whoever asks, so a press is never seen twice and never missed between steps.
export const ACT_INTERACT = 1;
export const ACT_PAUSE = 2;
export const ACT_MELEE = 4;
export const ACT_RELOAD = 8;
export const ACT_MUTE = 16;
export const ACT_CONFIRM = 32;

const ACTION_KEYS = {
  KeyE: ACT_INTERACT,
  Escape: ACT_PAUSE,
  KeyP: ACT_PAUSE,
  KeyF: ACT_MELEE,
  KeyR: ACT_RELOAD,
  KeyM: ACT_MUTE,
  Enter: ACT_CONFIRM,
  Space: ACT_CONFIRM,
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    const bit = ACTION_KEYS[event.code];
    if (bit) actions |= bit;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    mouseY = (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      clicked = true;
      actions |= ACT_CONFIRM;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Movement axes from WASD or the arrow keys: x right, y down, each -1..1. */
    moveAxis() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Driving input for the car the player sits in. */
    drive() {
      return {
        throttle: (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0),
        steer: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
        handbrake: held.has('Space'),
      };
    },
    sprint: () => held.has('ShiftLeft') || held.has('ShiftRight'),
    mouse: () => ({ x: mouseX, y: mouseY, down: mouseDown }),
    /** Consume the latched one-shot actions; each call clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True once per physical click, for menus and dialogue. */
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
  };
}

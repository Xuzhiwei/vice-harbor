// Keyboard + mouse state. One shared object, updated by listeners, read by
// the simulation. Also tracks "pressed this frame" edges for toggles.
export const keys = Object.create(null);
export const pressed = Object.create(null);
export const mouse = { x: 0, y: 0, down: false, clicked: false, inside: false };

let canvasRef = null;

export function initInput(canvas) {
  canvasRef = canvas;
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    mouse.inside = true;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; mouse.down = false; });
}

export function endFrameInput() {
  for (const k in pressed) pressed[k] = false;
  mouse.clicked = false;
}

export function axisX() {
  return (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
}
export function axisY() {
  return (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
}
export function sprintHeld() { return !!(keys['shift']); }
export function handbrakeHeld() { return !!keys[' ']; }

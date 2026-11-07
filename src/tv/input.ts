import type { ButtonId, ControlInput } from "../shared/protocol";
import { clamp } from "../shared/math";
import { canvas, toStage, W, H } from "./screen";

export interface Pointer {
  x: number;
  y: number;
  roll: number;
  visible: boolean;
}

export interface Swing {
  power: number;
  dir: number;
  p: number;
}

export interface InputSink {
  button(id: ButtonId, down: boolean, p: number): void;
  swing(s: Swing): void;
}

/** One pointer per player. Player 1 shares theirs with the mouse. */
export const pointers = new Map<number, Pointer>();
export const pointer = (p = 1): Pointer => {
  let ptr = pointers.get(p);
  if (!ptr) {
    ptr = { x: W / 2, y: H / 2, roll: 0, visible: false };
    pointers.set(p, ptr);
  }
  return ptr;
};

const held = new Set<string>();
export const isHeld = (id: ButtonId, p = 1) => held.has(`${p}:${id}`);

let sink: InputSink | null = null;
export const setSink = (s: InputSink) => (sink = s);

/** When set, gets key presses first (used for typing names). */
export let keyboardCapture: ((e: KeyboardEvent) => boolean) | null = null;
export const captureKeyboard = (fn: typeof keyboardCapture) => (keyboardCapture = fn);

function button(id: ButtonId, down: boolean, p: number) {
  const key = `${p}:${id}`;
  if (down === held.has(key)) return;
  if (down) held.add(key);
  else held.delete(key);
  sink?.button(id, down, p);
}

export function fromRemote(msg: ControlInput & { p: number }) {
  if (msg.t === "aim") {
    const ptr = pointer(msg.p);
    ptr.x = msg.x * W;
    ptr.y = msg.y * H;
    ptr.roll = msg.roll;
    ptr.visible = msg.x > -0.1 && msg.x < 1.1 && msg.y > -0.1 && msg.y < 1.1;
  } else if (msg.t === "btn") {
    button(msg.id, msg.down, msg.p);
  } else {
    sink?.swing({ power: msg.power, dir: msg.dir, p: msg.p });
  }
}

export function releaseAll(p: number) {
  for (const key of [...held]) {
    const [owner, id] = key.split(":");
    if (Number(owner) === p) button(id as ButtonId, false, p);
  }
  pointer(p).visible = false;
}

// Mouse and keyboard stand in for player 1's remote.

let lastMove = { x: 0, y: 0, t: 0 };
let flickQuietUntil = 0;

canvas.addEventListener("mousemove", (e) => {
  const at = toStage(e.clientX, e.clientY);
  const ptr = pointer(1);
  ptr.x = at.x;
  ptr.y = at.y;
  ptr.roll = 0;
  ptr.visible = true;

  // Holding B (right button) and flicking the mouse upward counts as a swing.
  const now = performance.now();
  const dt = Math.max(1, now - lastMove.t);
  const vx = (at.x - lastMove.x) / dt;
  const vy = (at.y - lastMove.y) / dt;
  lastMove = { x: at.x, y: at.y, t: now };
  if (isHeld("b") && vy < -1.6 && now > flickQuietUntil) {
    flickQuietUntil = now + 500;
    sink?.swing({ power: clamp((-vy - 1.2) / 4, 0.1, 1), dir: clamp(vx / 3, -1, 1), p: 1 });
  }
});

canvas.addEventListener("mouseleave", () => (pointer(1).visible = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) button("a", true, 1);
  if (e.button === 2) button("b", true, 1);
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) button("a", false, 1);
  if (e.button === 2) button("b", false, 1);
});

const KEYS: Record<string, ButtonId> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "a",
  Space: "a",
  ShiftLeft: "b",
  ShiftRight: "b",
  Escape: "home",
  KeyH: "home",
  Minus: "minus",
  Equal: "plus",
  Digit1: "one",
  Digit2: "two",
};

window.addEventListener("keydown", (e) => {
  if (keyboardCapture?.(e)) return e.preventDefault();
  const id = KEYS[e.code];
  if (!id) return;
  e.preventDefault();
  if (!e.repeat) button(id, true, 1);
});

window.addEventListener("keyup", (e) => {
  const id = KEYS[e.code];
  if (id) button(id, false, 1);
});

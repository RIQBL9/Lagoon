import type { ButtonId } from "../shared/protocol";
import { approach, easeOutBack } from "../shared/math";
import { playSong, setMusicEnabled, type Song } from "../audio/music";
import { sfx } from "../audio/sfx";
import { C, PLAYER_COLORS, font, panel, text } from "./draw";
import { drawCursor } from "./cursor";
import { isHeld, pointer, pointers, setSink, type Swing } from "./input";
import { players } from "./net";
import { persist, save } from "./save";
import { beginFrame, ctx, endFrame, H, W } from "./screen";
import { Hotspots, drawButton, hotspot } from "./ui";

export interface Scene {
  /** Song to play while this scene is up. Leave undefined to keep whatever is playing. */
  music?: Song | null;
  /** Home opens the pause overlay instead of reaching the scene. */
  pausable?: boolean;
  hideCursor?: boolean;
  enter?(): void;
  exit?(): void;
  paused?(on: boolean): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  button?(id: ButtonId, down: boolean, p: number): void;
  swing?(s: Swing): void;
  hovering?(): boolean;
}

let scene: Scene;
let pending: Scene | null = null;
let fade = 0;
let fading: -1 | 0 | 1 = 0;
let clock = 0;
let home: () => Scene;

export const time = () => clock;

export function go(next: Scene) {
  if (pending) return;
  pending = next;
  fading = 1;
}

function swap() {
  scene.exit?.();
  scene = pending!;
  pending = null;
  scene.enter?.();
  if (scene.music !== undefined) playSong(scene.music);
  fading = -1;
}

// Toasts

interface Toast {
  text: string;
  color: string;
  age: number;
}
const toasts: Toast[] = [];

export function toast(message: string, color: string = C.cyan) {
  toasts.push({ text: message, color, age: 0 });
}

function drawToasts(dt: number) {
  let y = 24;
  for (const t of toasts) {
    t.age += dt;
    const show = Math.min(1, t.age * 4, (3.2 - t.age) * 4);
    if (show <= 0) continue;
    ctx.font = font(18);
    const w = ctx.measureText(t.text).width + 64;
    const x = W - 24 - w * easeOutBack(Math.max(0, show));
    ctx.save();
    ctx.globalAlpha = Math.max(0, show);
    panel(ctx, x, y, w, 46, 23);
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(x + 24, y + 23, 6, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, t.text, x + 40, y + 24, 18, C.ink, "left");
    ctx.restore();
    y += 56;
  }
  while (toasts.length && toasts[0].age > 3.4) toasts.shift();
}

// Home overlay, shown when Home is pressed during a game.

const pause = { open: false, t: 0, spots: new Hotspots() };
const resumeBtn = hotspot(W / 2 - 250, 400, 230, 70, () => closePause());
const menuBtn = hotspot(W / 2 + 20, 400, 230, 70, () => {
  closePause();
  go(home());
});
const musicBtn = hotspot(W / 2 - 120, 500, 240, 50, () => {
  save.music = !save.music;
  setMusicEnabled(save.music);
  persist();
});
pause.spots.items = [resumeBtn, menuBtn, musicBtn];

function openPause() {
  pause.open = true;
  sfx.select();
  scene.paused?.(true);
}

function closePause() {
  pause.open = false;
  sfx.back();
  scene.paused?.(false);
}

function drawPause() {
  const t = pause.t;
  ctx.save();
  ctx.fillStyle = `rgba(61, 71, 82, ${0.45 * t})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = t;
  ctx.translate(0, (1 - t) * 30);
  panel(ctx, W / 2 - 300, 220, 600, 360, 32);
  text(ctx, "Home", W / 2, 290, 40);
  text(ctx, "Your game is paused.", W / 2, 340, 20, C.soft, "center", 500);
  drawButton(ctx, resumeBtn, "Resume");
  drawButton(ctx, menuBtn, "Home Menu", true);
  drawButton(ctx, musicBtn, save.music ? "Music: on" : "Music: off");
  ctx.restore();
}

function drawCursors() {
  if (scene.hideCursor && !pause.open) return;
  for (const [p, ptr] of pointers) {
    if (!ptr.visible || (p !== 1 && !players.has(p))) continue;
    const hovering = p === 1 && (pause.open ? pause.spots.hovering : (scene.hovering?.() ?? false));
    drawCursor(ctx, ptr, p, isHeld("a", p), hovering);
  }
}

/** Fades the whole stage to a soft white, used by scene changes. */
function drawFade() {
  if (fade <= 0) return;
  ctx.fillStyle = `rgba(243, 245, 247, ${fade})`;
  ctx.fillRect(0, 0, W, H);
}

let last = performance.now();

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  if (fading === 1) {
    fade = Math.min(1, fade + dt * 5);
    if (fade >= 1) swap();
  } else if (fading === -1) {
    fade = Math.max(0, fade - dt * 4);
    if (fade <= 0) fading = 0;
  }

  if (!pause.open) scene.update(dt);
  pause.t = approach(pause.t, pause.open ? 1 : 0, 0.25, dt);
  if (pause.open) pause.spots.update(dt, pointer(1));

  beginFrame();
  scene.draw(ctx);
  if (pause.t > 0.01) drawPause();
  drawToasts(dt);
  drawFade();
  drawCursors();
  endFrame();

  requestAnimationFrame(frame);
}

export function start(first: Scene, homeScene: () => Scene) {
  home = homeScene;
  scene = first;
  scene.enter?.();
  if (scene.music !== undefined) playSong(scene.music);

  setSink({
    button(id, down, p) {
      if (fading !== 0) return;
      if (pause.open) {
        if (!down || p !== 1) return;
        if (id === "a") pause.spots.press();
        else if (id === "home" || id === "b") closePause();
        return;
      }
      if (id === "home" && down && scene.pausable) return openPause();
      scene.button?.(id, down, p);
    },
    swing(s) {
      if (!pause.open && fading === 0) scene.swing?.(s);
    },
  });

  requestAnimationFrame(frame);
}

export const goHome = () => go(home());

export function playerColor(p: number) {
  return PLAYER_COLORS[(p - 1) % PLAYER_COLORS.length];
}

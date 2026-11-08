import { approach } from "../shared/math";
import { sfx } from "../audio/sfx";
import { C, font, noShadow, rr, softShadow, text } from "./draw";
import type { Pointer } from "./input";
import { rumble } from "./net";

export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..1, eases towards 1 while the pointer is over it. */
  hover: number;
  disabled?: boolean;
  press(): void;
}

export const hotspot = (x: number, y: number, w: number, h: number, press: () => void): Hotspot => ({
  x,
  y,
  w,
  h,
  hover: 0,
  press,
});

export type Direction = "up" | "down" | "left" | "right";

export const isDirection = (id: string): id is Direction =>
  id === "up" || id === "down" || id === "left" || id === "right";

const STEP: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// The pointer has to travel this far before it takes over from the D-pad again,
// so a resting hand doesn't undo a D-pad move.
const POINTER_TAKEOVER = 28;

const middle = (h: Hotspot) => ({ x: h.x + h.w / 2, y: h.y + h.h / 2 });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Tracks which hotspot the pointer (or the D-pad) is on and fires it on A. */
export class Hotspots {
  items: Hotspot[] = [];
  current: Hotspot | null = null;
  /** Picked with the D-pad. Holds until the pointer moves away. */
  private focus: Hotspot | null = null;
  private focusAt: { x: number; y: number } | null = null;
  private pointerAt: { x: number; y: number } | null = null;

  update(dt: number, p: Pointer) {
    if (this.focus && !this.items.includes(this.focus)) this.focus = null;
    if (this.focus) {
      // pointerAt is where the pointer was when the D-pad took over.
      if (!p.visible) this.pointerAt = null;
      else if (!this.pointerAt) this.pointerAt = { x: p.x, y: p.y };
      else if (dist(p, this.pointerAt) > POINTER_TAKEOVER) this.focus = null;
    }
    if (!this.focus) this.pointerAt = p.visible ? { x: p.x, y: p.y } : null;

    let found: Hotspot | null = this.focus;
    if (!found && p.visible) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const h = this.items[i];
        if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
          found = h;
          break;
        }
      }
    }
    if (found !== this.current) {
      this.current = found;
      if (found && !found.disabled) {
        sfx.tick();
        rumble(14);
      }
    }
    for (const h of this.items) h.hover = approach(h.hover, h === found && !h.disabled ? 1 : 0, 0.25, dt);
  }

  /** Moves the highlight to the nearest hotspot in that direction. */
  move(dir: Direction) {
    const open = this.items.filter((h) => !h.disabled);
    if (!open.length) return;
    // focus first: two quick presses can land before the next frame updates current.
    const from = this.focus ?? this.current;
    let next: Hotspot | null = null;

    if (!from) {
      // Nothing highlighted: start where the last highlight was, or at the top left,
      // which is where the main choices sit on every screen.
      const at = this.focusAt;
      const cost = at ? (h: Hotspot) => dist(middle(h), at) : (h: Hotspot) => middle(h).y * 2 + middle(h).x * 0.5;
      next = open.reduce((a, b) => (cost(b) < cost(a) ? b : a));
    } else {
      const o = middle(from);
      const [sx, sy] = STEP[dir];
      let best = Infinity;
      for (const h of open) {
        if (h === from) continue;
        const m = middle(h);
        const along = (m.x - o.x) * sx + (m.y - o.y) * sy;
        if (along <= 4) continue;
        const across = Math.abs((m.x - o.x) * sy - (m.y - o.y) * sx);
        const score = along + across * 2;
        if (score < best) {
          best = score;
          next = h;
        }
      }
    }
    if (!next) return;
    this.focus = next;
    this.focusAt = middle(next);
  }

  /** Returns true if A landed on something. */
  press() {
    const h = this.focus ?? this.current;
    if (!h) return false;
    if (h.disabled) {
      sfx.nope();
      return true;
    }
    h.press();
    return true;
  }

  get hovering() {
    return !!this.current && !this.current.disabled;
  }
}

type Ctx = CanvasRenderingContext2D;

export function drawButton(ctx: Ctx, h: Hotspot, label: string, primary = false) {
  const grow = h.hover * 4;
  ctx.save();
  softShadow(ctx, 10 + h.hover * 10, 3 + h.hover * 3, 0.1 + h.hover * 0.06);
  rr(ctx, h.x - grow, h.y - grow, h.w + grow * 2, h.h + grow * 2, (h.h + grow * 2) / 2);
  ctx.fillStyle = primary ? C.cyan : C.panel;
  ctx.fill();
  noShadow(ctx);
  ctx.lineWidth = 2;
  ctx.strokeStyle = primary ? "rgba(0,0,0,0.06)" : h.hover > 0.05 ? C.cyan : C.line;
  ctx.stroke();
  if (primary && h.hover > 0.05) {
    // A cyan outline wouldn't show on a cyan button, so it gets a ring a little outside.
    const gap = grow + 5;
    rr(ctx, h.x - gap, h.y - gap, h.w + gap * 2, h.h + gap * 2, (h.h + gap * 2) / 2);
    ctx.globalAlpha = h.hover;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.cyan;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = h.disabled ? 0.4 : 1;
  text(ctx, label, h.x + h.w / 2, h.y + h.h / 2 + 1, Math.min(26, h.h * 0.42), primary ? "#fff" : C.ink);
  ctx.restore();
}

/** Small rounded chip, e.g. a points counter. */
export function chip(ctx: Ctx, label: string, x: number, y: number, align: "left" | "right" = "left") {
  ctx.font = font(18);
  const w = ctx.measureText(label).width + 52;
  const left = align === "left" ? x : x - w;
  ctx.save();
  softShadow(ctx, 8, 2, 0.08);
  rr(ctx, left, y, w, 36, 18);
  ctx.fillStyle = C.panel;
  ctx.fill();
  noShadow(ctx);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // coin
  ctx.fillStyle = C.amber;
  ctx.beginPath();
  ctx.arc(left + 20, y + 18, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.stroke();
  text(ctx, label, left + 36, y + 19, 18, C.ink, "left");
  ctx.restore();
}

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

/** Tracks which hotspot the pointer is over and fires it on A. */
export class Hotspots {
  items: Hotspot[] = [];
  current: Hotspot | null = null;

  update(dt: number, p: Pointer) {
    let found: Hotspot | null = null;
    if (p.visible) {
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

  /** Returns true if A landed on something. */
  press() {
    const h = this.current;
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

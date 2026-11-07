import { drawAvatar, type Avatar } from "../../shared/avatar";
import { C, rr } from "../../tv/draw";
import type { Prop } from "./track";

type Ctx = CanvasRenderingContext2D;

/** World widths, used for both drawing and bumping into things. */
export const PROP_WIDTH: Record<Prop, number> = {
  palm: 700,
  rock: 500,
  "sign-left": 420,
  "sign-right": 420,
  buoy: 260,
  hut: 1300,
};

/** Kart width in world units. */
export const KART_W = 440;

/** Draws a prop standing on (x, y). `s` is pixels per world unit. */
export function drawProp(ctx: Ctx, kind: Prop, x: number, y: number, s: number) {
  const w = PROP_WIDTH[kind] * s;
  if (w < 2) return;

  switch (kind) {
    case "palm": {
      const h = w * 2;
      ctx.strokeStyle = "#a67c52";
      ctx.lineWidth = w * 0.09;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + w * 0.25, y - h * 0.5, x + w * 0.1, y - h * 0.9);
      ctx.stroke();
      const tx = x + w * 0.1;
      const ty = y - h * 0.9;
      ctx.fillStyle = "#3fa067";
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55;
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * w * 0.32, ty + Math.sin(a) * w * 0.18 + w * 0.08, w * 0.36, w * 0.09, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#7a5a33";
      ctx.beginPath();
      ctx.arc(tx, ty + w * 0.05, w * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "rock":
      ctx.fillStyle = "#9aa3ab";
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x - w * 0.45, y - w * 0.55, x - w * 0.05, y - w * 0.6);
      ctx.quadraticCurveTo(x + w * 0.45, y - w * 0.5, x + w / 2, y);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(x - w * 0.15, y - w * 0.4, w * 0.15, w * 0.08, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "sign-left":
    case "sign-right": {
      const dir = kind === "sign-right" ? 1 : -1;
      ctx.fillStyle = "#5b6670";
      ctx.fillRect(x - w * 0.36, y - w * 0.5, w * 0.06, w * 0.5);
      ctx.fillRect(x + w * 0.3, y - w * 0.5, w * 0.06, w * 0.5);
      rr(ctx, x - w / 2, y - w * 1.05, w, w * 0.6, w * 0.08);
      ctx.fillStyle = C.amber;
      ctx.fill();
      ctx.fillStyle = "#2f363d";
      for (let i = -1; i <= 1; i++) {
        const cx = x + i * w * 0.28;
        const cy = y - w * 0.75;
        ctx.beginPath();
        ctx.moveTo(cx - dir * w * 0.08, cy - w * 0.16);
        ctx.lineTo(cx + dir * w * 0.1, cy);
        ctx.lineTo(cx - dir * w * 0.08, cy + w * 0.16);
        ctx.lineTo(cx - dir * w * 0.02, cy);
        ctx.fill();
      }
      break;
    }
    case "buoy":
      ctx.fillStyle = C.coral;
      ctx.beginPath();
      ctx.ellipse(x, y - w * 0.4, w * 0.4, w * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - w * 0.4, y - w * 0.45, w * 0.8, w * 0.12);
      break;
    case "hut": {
      ctx.fillStyle = "#f3ead8";
      ctx.fillRect(x - w * 0.4, y - w * 0.45, w * 0.8, w * 0.45);
      ctx.fillStyle = "#5bc0be";
      ctx.fillRect(x - w * 0.12, y - w * 0.3, w * 0.24, w * 0.3);
      ctx.fillStyle = "#c58a4b";
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - w * 0.42);
      ctx.lineTo(x, y - w * 0.75);
      ctx.lineTo(x + w / 2, y - w * 0.42);
      ctx.fill();
      break;
    }
  }
}

/**
 * A kart seen from behind, with the driver's avatar in the seat.
 * (x, y) is the middle of the ground under it; `w` its width in pixels.
 */
export function drawKart(ctx: Ctx, x: number, y: number, w: number, color: string, driver: Avatar, steer = 0, bounce = 0) {
  if (w < 3) return;
  ctx.save();
  ctx.translate(x, y - bounce);
  ctx.rotate(steer * 0.06);

  ctx.fillStyle = "rgba(20, 30, 40, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, bounce, w * 0.55, w * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // driver first, so the body hides their lower half
  drawAvatar(ctx, driver, steer * w * 0.03, -w * 0.68, w * 0.4, { body: true });

  // seat back
  rr(ctx, -w * 0.24, -w * 0.48, w * 0.48, w * 0.2, w * 0.06);
  ctx.fillStyle = "#2f363d";
  ctx.fill();

  // wheels
  ctx.fillStyle = "#23292e";
  for (const side of [-1, 1]) {
    rr(ctx, side * w * 0.5 - w * 0.12, -w * 0.3, w * 0.24, w * 0.3, w * 0.06);
    ctx.fill();
  }

  // body
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, -w * 0.06);
  ctx.lineTo(-w * 0.34, -w * 0.32);
  ctx.quadraticCurveTo(0, -w * 0.38, w * 0.34, -w * 0.32);
  ctx.lineTo(w * 0.4, -w * 0.06);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(-w * 0.3, -w * 0.29, w * 0.6, w * 0.04);

  // bumper and exhausts
  rr(ctx, -w * 0.42, -w * 0.09, w * 0.84, w * 0.07, w * 0.03);
  ctx.fillStyle = "#3d4752";
  ctx.fill();
  ctx.fillStyle = "#9aa3ab";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * w * 0.16, -w * 0.16, w * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

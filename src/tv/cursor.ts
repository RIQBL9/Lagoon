import { clamp } from "../shared/math";
import { PLAYER_COLORS, text } from "./draw";
import type { Pointer } from "./input";

// A rounded arrow with the player's number tucked under it. Twisting the
// phone tilts it a little, so it feels attached to your hand.

export function drawCursor(ctx: CanvasRenderingContext2D, ptr: Pointer, player: number, pressed: boolean, hovering: boolean) {
  const color = PLAYER_COLORS[(player - 1) % PLAYER_COLORS.length];
  const size = (hovering ? 1.12 : 1) * (pressed ? 0.9 : 1);

  ctx.save();
  ctx.translate(ptr.x, ptr.y);
  ctx.rotate(clamp(ptr.roll * 0.006, -0.5, 0.5));
  ctx.scale(size, size);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 30);
  ctx.lineTo(8, 23.5);
  ctx.lineTo(13.5, 35);
  ctx.lineTo(19.5, 32);
  ctx.lineTo(14, 21);
  ctx.lineTo(24, 20);
  ctx.closePath();

  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(30, 50, 70, 0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(26, 34, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  text(ctx, String(player), 26, 35, 13, color);

  ctx.restore();
}

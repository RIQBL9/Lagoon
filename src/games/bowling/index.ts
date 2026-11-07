import { C, tileLabel } from "../../tv/draw";
import type { LagoonGame } from "../types";
import { Bowling } from "./game";

function icon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#e7f5fb");
  sky.addColorStop(1, "#cfe9f5");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // lane, gutters either side
  const top = h * 0.3;
  const lane = (l: number, r: number, bl: number, br: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(w * bl, h);
    ctx.lineTo(w * l, top);
    ctx.lineTo(w * r, top);
    ctx.lineTo(w * br, h);
    ctx.fill();
  };
  lane(0.33, 0.67, 0.02, 0.98, "#8f9ba5");
  lane(0.36, 0.64, 0.1, 0.9, "#e8c896");
  ctx.fillStyle = "#2f363d";
  ctx.fillRect(w * 0.33, top - 22, w * 0.34, 22);

  // pins, back row first so the front ones overlap
  for (let row = 3; row >= 0; row--) {
    const y = top + 6 - row * 4;
    const size = 1 - row * 0.06;
    for (let k = 0; k <= row; k++) {
      const x = w / 2 + (k - row / 2) * 13;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(x, y - 9 * size, 4.5 * size, 10 * size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.coral;
      ctx.fillRect(x - 3 * size, y - 14 * size, 6 * size, 1.6);
    }
  }

  const roll = (t * 0.35) % 1;
  const bx = w / 2 + Math.sin(roll * Math.PI) * 10;
  const by = h - 20 - roll * (h * 0.55);
  const r = 15 - roll * 10;
  ctx.fillStyle = C.cyan;
  ctx.beginPath();
  ctx.arc(bx, by, Math.max(4, r), 0, Math.PI * 2);
  ctx.fill();

  tileLabel(ctx, "Bowling");
}

export const bowling: LagoonGame = {
  id: "bowling",
  title: "Lagoon Sports: Bowling",
  blurb: "Ten frames. Hold B and swing to roll.",
  price: 0,
  icon,
  create: (host) => new Bowling(host),
};

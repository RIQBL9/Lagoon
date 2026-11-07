import { C, tileLabel } from "../../tv/draw";
import type { LagoonGame } from "../types";
import { Race } from "./race";

function icon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = "#cfeaf5";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#8fcf8a";
  ctx.fillRect(0, h * 0.45, w, h * 0.55);

  // road
  ctx.fillStyle = "#5b6670";
  ctx.beginPath();
  ctx.moveTo(w * 0.47, h * 0.45);
  ctx.lineTo(w * 0.53, h * 0.45);
  ctx.lineTo(w * 0.95, h);
  ctx.lineTo(w * 0.05, h);
  ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 6; i++) {
    const k = ((i / 6 + t * 0.8) % 1) ** 2;
    const y = h * 0.45 + k * h * 0.55;
    ctx.fillRect(w / 2 - 1 - k * 3, y, 2 + k * 6, 3 + k * 10);
  }

  // kart, seen from behind
  const x = w / 2 + Math.sin(t * 1.7) * 18;
  const y = h - 34;
  ctx.fillStyle = "#2f363d";
  ctx.fillRect(x - 34, y + 8, 14, 16);
  ctx.fillRect(x + 20, y + 8, 14, 16);
  ctx.fillStyle = C.coral;
  ctx.beginPath();
  ctx.roundRect(x - 26, y - 4, 52, 22, 8);
  ctx.fill();
  ctx.fillStyle = C.cyan;
  ctx.beginPath();
  ctx.arc(x, y - 10, 10, 0, Math.PI * 2);
  ctx.fill();

  tileLabel(ctx, "Kart");
}

export const kart: LagoonGame = {
  id: "kart",
  title: "Lagoon Kart",
  blurb: "Three laps of Lagoon Bay. Point to steer, hold A to drive.",
  price: 500,
  icon,
  create: (host) => new Race(host),
};

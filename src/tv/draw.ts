export const C = {
  bg: "#f3f5f7",
  panel: "#ffffff",
  line: "#d5dbe0",
  faint: "#e9edf0",
  ink: "#3d4752",
  soft: "#8a96a1",
  cyan: "#1aa6d9",
  cyanSoft: "#e2f3fa",
  coral: "#ef6f5e",
  green: "#3fb67a",
  amber: "#f2b53a",
};

export const PLAYER_COLORS = [C.cyan, C.coral, C.green, C.amber];

const FAMILY = '"M PLUS Rounded 1c", system-ui, sans-serif';

export const font = (size: number, weight = 800) => `${weight} ${size}px ${FAMILY}`;

type Ctx = CanvasRenderingContext2D;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color = C.ink,
  align: CanvasTextAlign = "center",
  weight = 800,
) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

export function softShadow(ctx: Ctx, blur = 18, y = 6, alpha = 0.12) {
  ctx.shadowColor = `rgba(40, 60, 80, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = y;
}

export function noShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r = 24) {
  ctx.save();
  softShadow(ctx);
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = C.panel;
  ctx.fill();
  noShadow(ctx);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** The soft wave along the bottom of most screens. */
export function backdrop(ctx: Ctx, w: number, h: number, t: number, tint = C.cyanSoft) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) {
    ctx.lineTo(x, h - 70 + Math.sin(x / 180 + t * 0.4) * 10 + Math.sin(x / 67 - t * 0.3) * 4);
  }
  ctx.lineTo(w, h);
  ctx.fill();
}

const images = new Map<string, HTMLImageElement>();

export function image(src: string) {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    images.set(src, img);
  }
  return img;
}

export function drawImage(ctx: Ctx, src: string, x: number, y: number, w: number, h: number) {
  const img = image(src);
  if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
}

/** A channel tile's name, on a white pill so the artwork never covers it. */
export function tileLabel(ctx: CanvasRenderingContext2D, label: string) {
  ctx.font = font(16);
  const w = ctx.measureText(label).width + 24;
  ctx.save();
  softShadow(ctx, 6, 2, 0.12);
  rr(ctx, 10, 10, w, 28, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fill();
  ctx.restore();
  text(ctx, label, 22, 25, 16, C.ink, "left");
}

// Everything on the TV is laid out on a fixed 1280×720 stage and scaled to
// fit the window, with letterboxing if the aspect ratio doesn't match.

export const W = 1280;
export const H = 720;

export const canvas = document.getElementById("screen") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d")!;

let dpr = 1;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

export function fit() {
  dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  scale = Math.min(vw / W, vh / H);
  offsetX = (vw - W * scale) / 2;
  offsetY = (vh - H * scale) / 2;
}

export function beginFrame() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#e3e8ec";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
}

export function endFrame() {
  ctx.restore();
}

export function toStage(clientX: number, clientY: number) {
  return { x: (clientX - offsetX) / scale, y: (clientY - offsetY) / scale };
}

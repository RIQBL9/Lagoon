export interface Avatar {
  name: string;
  face: number;
  skin: number;
  eyes: number;
  brows: number;
  mouth: number;
  hair: number;
  hairColor: number;
  shirt: number;
}

export const SKINS = ["#fde3cf", "#f6cfae", "#e8b48c", "#c98e63", "#a26a45", "#6f4630"];
export const HAIR_COLORS = ["#2b2523", "#5a3a28", "#8a5a34", "#c58a4b", "#e3c27a", "#b5483a", "#9aa3ab", "#4b6fb5"];
export const SHIRTS = ["#1aa6d9", "#ef6f5e", "#3fb67a", "#f2b53a", "#8a6fd1", "#e46fa8", "#3d4752", "#f3f5f7", "#5bc0be", "#a0522d"];

export const OPTION_COUNTS = {
  face: 3,
  skin: SKINS.length,
  eyes: 5,
  brows: 3,
  mouth: 5,
  hair: 7,
  hairColor: HAIR_COLORS.length,
  shirt: SHIRTS.length,
} satisfies Record<Exclude<keyof Avatar, "name">, number>;

export type Feature = keyof typeof OPTION_COUNTS;

const NAMES = ["Kai", "Momo", "Rin", "Juno", "Theo", "Pip", "Sol", "Nia", "Ollie", "Mika", "Bea", "Remy", "Ivy", "Taro", "Lou", "Zed"];

export const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)];

export function randomAvatar(): Avatar {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    name: randomName(),
    face: pick(OPTION_COUNTS.face),
    skin: pick(OPTION_COUNTS.skin),
    eyes: pick(OPTION_COUNTS.eyes),
    brows: pick(OPTION_COUNTS.brows),
    mouth: pick(OPTION_COUNTS.mouth),
    hair: pick(OPTION_COUNTS.hair),
    hairColor: pick(OPTION_COUNTS.hairColor),
    shirt: pick(OPTION_COUNTS.shirt),
  };
}

type Ctx = CanvasRenderingContext2D;

interface DrawOptions {
  body?: boolean;
  blink?: boolean;
}

/**
 * Draws an avatar's head centred on (cx, cy). `s` is the head height.
 * With `body`, shoulders and a shirt are drawn underneath.
 */
export function drawAvatar(ctx: Ctx, a: Avatar, cx: number, cy: number, s: number, opts: DrawOptions = {}) {
  const skin = SKINS[a.skin] ?? SKINS[0];
  const hair = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const rx = [0.42, 0.37, 0.47][a.face] * s;
  const ry = [0.48, 0.52, 0.45][a.face] * s;
  const line = Math.max(1, s * 0.025);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (opts.body) {
    ctx.fillStyle = skin;
    ctx.fillRect(cx - s * 0.09, cy + ry * 0.7, s * 0.18, s * 0.25);
    ctx.fillStyle = SHIRTS[a.shirt] ?? SHIRTS[0];
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry + s * 0.42, s * 0.46, s * 0.4, 0, Math.PI, 0);
    ctx.lineTo(cx + s * 0.46, cy + ry + s * 0.62);
    ctx.lineTo(cx - s * 0.46, cy + ry + s * 0.62);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = line;
    ctx.stroke();
  }

  // Long styles have hair behind the head.
  ctx.fillStyle = hair;
  if (a.hair === 3) {
    ctx.beginPath();
    ctx.roundRect(cx - rx * 1.12, cy - ry * 0.7, rx * 2.24, ry * 1.55, rx * 0.5);
    ctx.fill();
  } else if (a.hair === 6) {
    ctx.beginPath();
    ctx.roundRect(cx - rx * 1.15, cy - ry * 0.6, rx * 2.3, ry * 2.1, [rx * 0.6, rx * 0.6, rx * 0.3, rx * 0.3]);
    ctx.fill();
  }

  // Ears and face
  ctx.fillStyle = skin;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * rx * 0.98, cy + s * 0.04, s * 0.07, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  if (a.face === 2) ctx.roundRect(cx - rx, cy - ry, rx * 2, ry * 2, rx * 0.75);
  else ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = line;
  ctx.stroke();

  // Cheeks
  ctx.fillStyle = "rgba(239, 111, 94, 0.18)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * rx * 0.58, cy + s * 0.13, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEyes(ctx, a.eyes, cx, cy + s * 0.02, s, opts.blink ?? false);
  drawBrows(ctx, a.brows, cx, cy - s * 0.11, s, hair);

  // Nose
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.1, s * 0.035, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();

  drawMouth(ctx, a.mouth, cx, cy + s * 0.24, s);
  drawHairFront(ctx, a.hair, cx, cy, rx, ry, s, hair);

  ctx.restore();
}

function drawEyes(ctx: Ctx, style: number, cx: number, cy: number, s: number, blink: boolean) {
  const dx = s * 0.15;
  ctx.fillStyle = "#2f3438";
  ctx.strokeStyle = "#2f3438";
  ctx.lineWidth = s * 0.03;

  for (const side of [-1, 1]) {
    const x = cx + side * dx;
    if (blink || style === 2) {
      // closed, or happy arcs
      ctx.beginPath();
      if (blink) ctx.moveTo(x - s * 0.045, cy), ctx.lineTo(x + s * 0.045, cy);
      else ctx.arc(x, cy + s * 0.02, s * 0.045, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    switch (style) {
      case 0:
        ctx.arc(x, cy, s * 0.038, 0, Math.PI * 2);
        break;
      case 1:
        ctx.ellipse(x, cy, s * 0.03, s * 0.055, 0, 0, Math.PI * 2);
        break;
      case 3:
        ctx.ellipse(x, cy + s * 0.01, s * 0.045, s * 0.03, 0, 0, Math.PI * 2);
        break;
      default:
        ctx.arc(x, cy, s * 0.06, 0, Math.PI * 2);
    }
    ctx.fill();

    if (style === 3) {
      // sleepy lid
      ctx.beginPath();
      ctx.moveTo(x - s * 0.055, cy - s * 0.005);
      ctx.lineTo(x + s * 0.055, cy - s * 0.005);
      ctx.stroke();
    }
    if (style === 4 || style === 1) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + s * 0.015, cy - s * 0.02, s * (style === 4 ? 0.022 : 0.012), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f3438";
    }
  }
}

function drawBrows(ctx: Ctx, style: number, cx: number, cy: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * [0.025, 0.028, 0.05][style];
  for (const side of [-1, 1]) {
    const x = cx + side * s * 0.15;
    ctx.beginPath();
    if (style === 1) {
      ctx.arc(x, cy + s * 0.04, s * 0.07, 1.25 * Math.PI, 1.75 * Math.PI);
    } else {
      ctx.moveTo(x - s * 0.055, cy + side * s * 0.004);
      ctx.lineTo(x + s * 0.055, cy - side * s * 0.004);
    }
    ctx.stroke();
  }
}

function drawMouth(ctx: Ctx, style: number, cx: number, cy: number, s: number) {
  ctx.strokeStyle = "#7a3b34";
  ctx.fillStyle = "#7a3b34";
  ctx.lineWidth = s * 0.026;
  ctx.beginPath();
  switch (style) {
    case 0: // smile
      ctx.arc(cx, cy - s * 0.05, s * 0.08, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    case 1: // open smile
      ctx.moveTo(cx - s * 0.08, cy - s * 0.02);
      ctx.quadraticCurveTo(cx, cy + s * 0.1, cx + s * 0.08, cy - s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e9877a";
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.03, s * 0.035, s * 0.014, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 2: // calm
      ctx.moveTo(cx - s * 0.05, cy);
      ctx.lineTo(cx + s * 0.05, cy);
      ctx.stroke();
      break;
    case 3: // little o
      ctx.ellipse(cx, cy, s * 0.028, s * 0.034, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: // grin
      ctx.roundRect(cx - s * 0.085, cy - s * 0.035, s * 0.17, s * 0.07, s * 0.035);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - s * 0.065, cy - s * 0.022, s * 0.13, s * 0.022);
  }
}

function drawHairFront(ctx: Ctx, style: number, cx: number, cy: number, rx: number, ry: number, s: number, color: string) {
  if (style === 0) return; // none

  ctx.fillStyle = color;
  const top = cy - ry;
  const hairline = cy - ry * 0.42;

  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.04, cy - ry * 0.05);
  ctx.bezierCurveTo(cx - rx * 1.12, top - ry * 0.25, cx + rx * 1.12, top - ry * 0.25, cx + rx * 1.04, cy - ry * 0.05);

  switch (style) {
    case 1: // short, straight fringe
    case 3: // bob
    case 6: // long
      ctx.quadraticCurveTo(cx + rx * 0.9, hairline, cx + rx * 0.5, hairline);
      ctx.quadraticCurveTo(cx, hairline + ry * 0.08, cx - rx * 0.5, hairline);
      ctx.quadraticCurveTo(cx - rx * 0.9, hairline, cx - rx * 1.04, cy - ry * 0.05);
      break;
    case 2: // side part, swept left
      ctx.quadraticCurveTo(cx + rx * 0.7, hairline - ry * 0.25, cx + rx * 0.15, hairline - ry * 0.3);
      ctx.quadraticCurveTo(cx - rx * 0.5, hairline - ry * 0.05, cx - rx * 0.8, hairline + ry * 0.15);
      ctx.lineTo(cx - rx * 1.04, cy - ry * 0.05);
      break;
    case 4: { // spiky
      const spikes = 5;
      for (let i = 0; i <= spikes; i++) {
        const x = cx + rx * (0.95 - (1.9 * i) / spikes);
        const y = hairline + (i % 2 ? -ry * 0.12 : ry * 0.04);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(cx - rx * 1.04, cy - ry * 0.05);
      break;
    }
    case 5: // bun, hair pulled back
      ctx.quadraticCurveTo(cx, hairline - ry * 0.35, cx - rx * 1.04, cy - ry * 0.05);
      break;
  }
  ctx.fill();

  if (style === 4) {
    // a few spikes on top
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = cx + rx * (-0.6 + i * 0.4);
      ctx.moveTo(x - rx * 0.22, top + ry * 0.12);
      ctx.lineTo(x + rx * 0.05, top - ry * 0.22);
      ctx.lineTo(x + rx * 0.22, top + ry * 0.12);
    }
    ctx.fill();
  }

  if (style === 5) {
    ctx.beginPath();
    ctx.arc(cx, top - s * 0.06, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const MAX_NAME = 10;

/** Builds a valid avatar from untrusted data (e.g. sent by a phone), dropping anything out of range. */
export function cleanAvatar(raw: unknown): Avatar {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = randomAvatar();
  for (const key of Object.keys(OPTION_COUNTS) as Feature[]) {
    const v = src[key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < OPTION_COUNTS[key]) out[key] = v;
  }
  if (typeof src.name === "string") {
    const name = src.name.replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, MAX_NAME);
    if (name) out.name = name;
  }
  return out;
}

import type { ButtonId } from "../../shared/protocol";
import { SHIRTS, drawAvatar, randomAvatar, type Avatar } from "../../shared/avatar";
import { approach, clamp, easeOutBack, lerp } from "../../shared/math";
import { kartSong } from "../../audio/songs";
import { engineSound, sfx } from "../../audio/sfx";
import { C, panel, text } from "../../tv/draw";
import { H, W } from "../../tv/screen";
import { Hotspots, isDirection, drawButton, hotspot } from "../../tv/ui";
import type { GameHost, GameSession } from "../types";
import { KART_W, PROP_WIDTH, drawKart, drawProp } from "./art";
import { ROAD_W, SEG, buildTrack, type Segment } from "./track";

type Ctx = CanvasRenderingContext2D;
type Phase = "title" | "countdown" | "race" | "finished" | "over";

const DEPTH = 1 / Math.tan((50 * Math.PI) / 180); // 100° field of view
const CAM_H = 1000;
const PLAYER_Z = CAM_H * DEPTH; // how far the player's kart sits in front of the camera
const DRAW = 220;
const MAX = SEG * 48;
const ACCEL = MAX / 4.5;
const BRAKE = -MAX * 0.9;
const COAST = -MAX / 6;
const OFF_ROAD = -MAX / 2;
const OFF_ROAD_LIMIT = MAX / 4;
const CENTRIFUGAL = 0.3;
const LAPS = 3;
const POINTS = [60, 40, 25, 15];
const TILT_DEAD = 4; // degrees of tip ignored, so a resting hand drives straight
const TILT_FULL = 30; // degrees past that for full lock

interface Racer {
  avatar: Avatar;
  color: string;
  z: number;
  lap: number;
  offset: number;
  speed: number;
  /** AI only: cruising speed and where in the lane it wants to be. */
  top: number;
  aim: number;
  finishedAt: number | null;
}

interface Projected {
  x: number;
  y: number;
  w: number;
  scale: number;
}

const ordinal = (n: number) => `${n}${["st", "nd", "rd"][n - 1] ?? "th"}`;
const clock = (s: number) => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, "0")}`;
};

export class Race implements GameSession {
  private segs = buildTrack();
  private len = this.segs.length * SEG;
  private phase: Phase = "title";
  private t = 0;
  private phaseT = 0;
  private raceT = 0;
  private lapStart = 0;
  private me!: Racer;
  private rivals: Racer[] = [];
  private skyOffset = 0;
  private banner = "";
  private bannerT = 0;
  private bump = 0;
  private steer = 0;
  private finalPlace = 0;
  private earned = 0;
  private newBest = false;
  private engine: ReturnType<typeof engineSound> | null = null;
  private lastBeep = -1;
  private near: Projected[] = [];
  private far: Projected[] = [];

  private spots = new Hotspots();
  private again = hotspot(W / 2 - 250, 480, 230, 64, () => this.start());
  private leave = hotspot(W / 2 + 20, 480, 230, 64, () => this.host.exit());

  constructor(private host: GameHost) {
    host.music(kartSong);
    this.grid();
  }

  get hideCursor() {
    return this.phase !== "title" && this.phase !== "over";
  }

  hovering() {
    return this.spots.hovering;
  }

  destroy() {
    this.engine?.stop();
  }

  paused(on: boolean) {
    this.engine?.set(on ? 0 : this.me.speed / MAX, false);
  }

  private grid() {
    const racer = (avatar: Avatar, z: number, offset: number, top: number): Racer => ({
      avatar,
      color: SHIRTS[avatar.shirt] ?? C.cyan,
      z,
      lap: 0,
      offset,
      speed: 0,
      top,
      aim: offset,
      finishedAt: null,
    });
    this.me = racer(this.host.avatar, 300, 0, MAX);
    this.rivals = [
      racer(randomAvatar(), 900, -0.45, MAX * 0.86),
      racer(randomAvatar(), 900, 0.45, MAX * 0.83),
      racer(randomAvatar(), 1500, 0, MAX * 0.89),
    ];
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.spots.items = p === "over" ? [this.again, this.leave] : [];
  }

  private start() {
    sfx.select();
    this.grid();
    this.raceT = 0;
    this.lapStart = 0;
    this.lastBeep = -1;
    this.host.music(null);
    this.engine?.stop();
    this.engine = engineSound();
    this.setPhase("countdown");
  }

  button(id: ButtonId, down: boolean, p: number) {
    if (p !== 1 || !down) return;
    if (this.phase === "over" && isDirection(id)) return this.spots.move(id);
    if (id !== "a") return;
    if (this.phase === "title") this.start();
    else if (this.phase === "over") this.spots.press();
  }

  private seg(z: number) {
    return this.segs[Math.floor(z / SEG) % this.segs.length];
  }

  private progress(r: Racer) {
    return r.lap * this.len + r.z;
  }

  private place(r: Racer) {
    const all = [this.me, ...this.rivals];
    return 1 + all.filter((o) => o !== r && this.progress(o) > this.progress(r)).length;
  }

  /** Signed distance from a to b along the track, wrapping at the lap line. */
  private gap(a: Racer, b: Racer) {
    let d = b.z - a.z;
    if (d > this.len / 2) d -= this.len;
    if (d < -this.len / 2) d += this.len;
    return d;
  }

  private advance(r: Racer, dt: number) {
    r.z += r.speed * dt;
    if (r.z >= this.len) {
      r.z -= this.len;
      r.lap++;
      return true;
    }
    return false;
  }

  update(dt: number) {
    this.t += dt;
    this.phaseT += dt;
    this.bannerT += dt;

    if (this.phase === "title" || this.phase === "over") {
      if (this.phase === "over") this.spots.update(dt, this.host.pointer(1));
      return;
    }

    if (this.phase === "countdown") {
      const n = Math.floor(this.phaseT);
      if (n !== this.lastBeep && n < 3) {
        this.lastBeep = n;
        sfx.beep(false);
        this.host.rumble(60);
      }
      if (this.phaseT >= 3) {
        sfx.beep(true);
        this.host.rumble(200);
        this.host.music(kartSong);
        this.say("Go!");
        this.setPhase("race");
      }
      this.engine?.set(0.05, this.gas());
      return;
    }

    this.raceT += dt;
    this.updatePlayer(dt);
    for (const r of this.rivals) this.updateRival(r, dt);

    if (this.phase === "finished" && this.phaseT > 3.5) this.finish();
  }

  private gas() {
    return this.host.isHeld("a") || this.host.isHeld("two");
  }

  private updatePlayer(dt: number) {
    const me = this.me;
    const seg = this.seg(me.z);
    const racing = this.phase === "race";

    let steer = 0;
    if (this.host.isHeld("left")) steer = -1;
    else if (this.host.isHeld("right")) steer = 1;
    else {
      const ptr = this.host.pointer(1);
      // A phone steers like a wheel: tip it right to go right, whichever way it's held.
      if (ptr.remote) steer = clamp((Math.abs(ptr.roll) < TILT_DEAD ? 0 : ptr.roll - Math.sign(ptr.roll) * TILT_DEAD) / TILT_FULL, -1, 1);
      else if (ptr.visible) steer = clamp((ptr.x - W / 2) / (W * 0.28), -1, 1);
    }
    if (!racing) steer = clamp(-me.offset, -0.3, 0.3);
    this.steer = approach(this.steer, steer, 0.3, dt);

    const pace = me.speed / MAX;
    const sideways = dt * 2.2 * pace;
    me.offset += sideways * this.steer;
    me.offset -= sideways * pace * seg.curve * CENTRIFUGAL;

    const gas = racing ? this.gas() : true;
    const brake = racing && (this.host.isHeld("b") || this.host.isHeld("one"));
    const target = racing ? MAX : MAX * 0.4;
    if (brake) me.speed += BRAKE * dt;
    else if (gas && me.speed < target) me.speed += ACCEL * dt;
    else me.speed += COAST * dt;

    const offRoad = Math.abs(me.offset) > 1.05;
    if (offRoad) {
      if (me.speed > OFF_ROAD_LIMIT) me.speed += OFF_ROAD * dt;
      this.bump = Math.sin(this.t * 45) * 3 * pace;
      if (Math.floor(this.t * 8) !== Math.floor((this.t - dt) * 8)) this.host.rumble(30);

      for (const prop of seg.scenery) {
        const reach = (PROP_WIDTH[prop.kind] * 0.5 + KART_W * 0.5) / ROAD_W;
        if (Math.abs(me.offset - prop.offset) < reach * 0.7 && me.speed > MAX / 6) {
          me.speed = MAX / 6;
          me.offset += me.offset > prop.offset ? 0.15 : -0.15;
          sfx.thud(0.9);
          this.host.rumble(250);
        }
      }
    } else {
      this.bump = 0;
    }

    for (const r of this.rivals) {
      const ahead = this.gap(me, r);
      if (ahead > 0 && ahead < 220 && me.speed > r.speed && Math.abs(me.offset - r.offset) < (KART_W / ROAD_W) * 0.9) {
        me.speed = r.speed * 0.85;
        me.z = r.z - 230;
        if (me.z < 0) me.z += this.len;
        sfx.thud(0.5);
        this.host.rumble(120);
      }
    }

    me.offset = clamp(me.offset, -2.4, 2.4);
    me.speed = clamp(me.speed, 0, MAX);
    this.skyOffset += seg.curve * pace * dt * 30;

    if (this.advance(me, dt) && racing) this.lapDone();
    this.engine?.set(me.speed / MAX, gas);
  }

  private lapDone() {
    const me = this.me;
    this.lapStart = this.raceT;
    if (me.lap >= LAPS) {
      me.finishedAt = this.raceT;
      this.finalPlace = this.place(me);
      this.say(this.finalPlace === 1 ? "You win!" : `${ordinal(this.finalPlace)} place`);
      if (this.finalPlace === 1) {
        sfx.fanfare();
        sfx.cheer();
      } else {
        sfx.select();
      }
      this.host.rumble(400);
      this.setPhase("finished");
    } else {
      this.say(me.lap === LAPS - 1 ? "Final lap!" : `Lap ${me.lap + 1}`);
      sfx.coin();
    }
  }

  private updateRival(r: Racer, dt: number) {
    const seg = this.seg(r.z);
    let top = r.top * (1 - Math.min(0.2, Math.abs(seg.curve) * 0.025));

    // Keep the pack close: ease off when far ahead, push when far behind.
    const lead = this.progress(r) - this.progress(this.me);
    top *= clamp(1 - lead / (this.len * 0.6), 0.85, 1.15);
    if (this.phase === "finished") top = Math.min(top, r.top);

    r.speed += clamp(top - r.speed, -ACCEL * dt, ACCEL * dt * 0.8);

    // Steer around whoever is just in front.
    let aim = r.offset;
    for (const o of [this.me, ...this.rivals]) {
      if (o === r) continue;
      const ahead = this.gap(r, o);
      if (ahead > 0 && ahead < 1600 && Math.abs(o.offset - r.offset) < 0.4 && o.speed < r.speed) {
        aim = o.offset > 0 ? o.offset - 0.6 : o.offset + 0.6;
      }
    }
    r.aim = clamp(approach(r.aim, aim, 0.05, dt), -0.75, 0.75);
    r.offset = approach(r.offset, r.aim, 0.04, dt);

    if (this.advance(r, dt) && r.lap >= LAPS && r.finishedAt === null) r.finishedAt = this.raceT;
  }

  private say(message: string) {
    this.banner = message;
    this.bannerT = 0;
  }

  private finish() {
    this.engine?.stop();
    this.engine = null;
    const place = this.finalPlace;
    this.earned = POINTS[place - 1] ?? 0;
    this.newBest = this.host.award(Math.round((this.me.finishedAt ?? this.raceT) * 1000), this.earned, true);
    this.host.music(kartSong);
    this.setPhase("over");
  }

  // Drawing

  draw(ctx: Ctx) {
    this.drawSky(ctx);
    this.drawRoad(ctx);
    this.drawSprites(ctx);
    drawKart(ctx, W / 2, H - 8, (KART_W / CAM_H) * (W / 2), this.me.color, this.me.avatar, this.steer, this.bump);

    if (this.phase !== "title") this.drawHud(ctx);
    if (this.phase === "countdown") this.drawCountdown(ctx);
    if (this.banner && this.bannerT < 1.6) this.drawBanner(ctx);
    if (this.phase === "title") this.drawTitle(ctx);
    if (this.phase === "over") this.drawResults(ctx);
  }

  private drawSky(ctx: Ctx) {
    const horizon = H * 0.5;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, "#8fd3ef");
    sky.addColorStop(1, "#e3f5fb");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon + 40);

    // a few slow clouds
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 5; i++) {
      const x = ((i * 310 - this.skyOffset * 0.3 + this.t * 6) % (W + 300) + W + 300) % (W + 300) - 150;
      const y = 70 + (i % 3) * 45;
      ctx.beginPath();
      ctx.ellipse(x, y, 70, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 40, y - 12, 40, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // sea, then far hills
    ctx.fillStyle = "#4fb8dd";
    ctx.fillRect(0, horizon - 30, W, H - horizon + 30);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = horizon - 20 + i * 14;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x / 50 + this.t * 2 + i) * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#7cc48a";
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 16) {
      const k = (x + this.skyOffset) / 140;
      ctx.lineTo(x, horizon - 18 - Math.sin(k) * 14 - Math.sin(k * 0.37) * 22 - Math.max(0, Math.sin(k * 0.13)) * 30);
    }
    ctx.lineTo(W, horizon);
    ctx.fill();
  }

  private drawRoad(ctx: Ctx) {
    const N = this.segs.length;
    const me = this.me;
    let camZ = me.z - PLAYER_Z;
    if (camZ < 0) camZ += this.len;

    const base = this.seg(camZ);
    const basePct = (camZ % SEG) / SEG;
    const mine = this.seg(me.z);
    const roadY = lerp(mine.y1, mine.y2, (me.z % SEG) / SEG);
    const camY = roadY + CAM_H;
    const camX = me.offset * ROAD_W;

    const project = (y: number, z: number, curveX: number): Projected => {
      const scale = DEPTH / z;
      return {
        x: W / 2 + scale * (curveX - camX) * (W / 2),
        y: H / 2 - scale * (y - camY) * (H / 2),
        w: scale * ROAD_W * (W / 2),
        scale,
      };
    };

    let x = 0;
    let dx = -base.curve * basePct;
    let maxY = H;
    this.near = [];
    this.far = [];

    for (let n = 0; n < DRAW; n++) {
      const seg = this.segs[(base.index + n) % N];
      const looped = seg.index < base.index;
      const z = seg.z + (looped ? this.len : 0) - camZ;
      const p1 = project(seg.y1, z, x);
      const p2 = project(seg.y2, z + SEG, x + dx);
      x += dx;
      dx += seg.curve;
      seg.clip = maxY;
      this.near[n] = p1;
      this.far[n] = p2;

      if (z <= DEPTH || p2.y >= p1.y || p2.y >= maxY) continue;
      this.drawSegment(ctx, seg, p1, p2);
      maxY = p1.y;
    }
  }

  private drawSegment(ctx: Ctx, seg: Segment, a: Projected, b: Projected) {
    const quad = (x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1 - w1, y1);
      ctx.lineTo(x2 - w2, y2);
      ctx.lineTo(x2 + w2, y2);
      ctx.lineTo(x1 + w1, y1);
      ctx.fill();
    };

    ctx.fillStyle = seg.stripe ? "#f1e2bf" : "#ead8b0"; // sand
    ctx.fillRect(0, b.y, W, a.y - b.y + 1);

    quad(a.x, a.y, a.w * 1.14, b.x, b.y, b.w * 1.14, seg.stripe ? C.coral : "#ffffff");
    const start = seg.index < 3;
    quad(a.x, a.y, a.w, b.x, b.y, b.w, start ? "#f3f5f7" : seg.stripe ? "#6b7680" : "#66717b");

    if (start) {
      // chequered start line
      const squares = 10;
      for (let i = 0; i < squares; i++) {
        if ((i + seg.index) % 2) continue;
        const l1 = a.x - a.w + (2 * a.w * i) / squares;
        const l2 = b.x - b.w + (2 * b.w * i) / squares;
        ctx.fillStyle = "#2f363d";
        ctx.beginPath();
        ctx.moveTo(l1, a.y);
        ctx.lineTo(l1 + (2 * a.w) / squares, a.y);
        ctx.lineTo(l2 + (2 * b.w) / squares, b.y);
        ctx.lineTo(l2, b.y);
        ctx.fill();
      }
    } else if (seg.stripe) {
      for (const lane of [-1 / 3, 1 / 3]) quad(a.x + lane * a.w * 2, a.y, a.w * 0.02, b.x + lane * b.w * 2, b.y, b.w * 0.02, "#f3f5f7");
    }
  }

  private drawSprites(ctx: Ctx) {
    const N = this.segs.length;
    let camZ = this.me.z - PLAYER_Z;
    if (camZ < 0) camZ += this.len;
    const base = this.seg(camZ);

    const bySeg = new Map<number, Racer[]>();
    for (const r of this.rivals) {
      const i = Math.floor(r.z / SEG) % N;
      bySeg.set(i, [...(bySeg.get(i) ?? []), r]);
    }

    for (let n = DRAW - 1; n > 0; n--) {
      const seg = this.segs[(base.index + n) % N];
      const p = this.near[n];
      if (!p || p.scale <= 0) continue;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, seg.clip);
      ctx.clip();

      const px = p.scale * (W / 2);
      for (const s of seg.scenery) drawProp(ctx, s.kind, p.x + px * s.offset * ROAD_W, p.y, px);

      for (const r of bySeg.get(seg.index) ?? []) {
        const q = this.far[n];
        const k = (r.z % SEG) / SEG;
        const scale = lerp(p.scale, q.scale, k);
        const x = lerp(p.x, q.x, k) + scale * (W / 2) * r.offset * ROAD_W;
        const y = lerp(p.y, q.y, k);
        drawKart(ctx, x, y, KART_W * scale * (W / 2), r.color, r.avatar);
      }
      ctx.restore();
    }
  }

  private drawHud(ctx: Ctx) {
    const me = this.me;
    const lap = Math.min(me.lap + 1, LAPS);

    panel(ctx, 30, 24, 210, 86, 22);
    text(ctx, `Lap ${lap}/${LAPS}`, 54, 54, 26, C.ink, "left");
    text(ctx, clock(this.raceT - this.lapStart), 54, 86, 18, C.soft, "left", 500);

    const place = this.phase === "finished" || this.phase === "over" ? this.finalPlace : this.place(me);
    panel(ctx, W - 170, 24, 140, 86, 22);
    text(ctx, ordinal(place), W - 100, 62, 40, place === 1 ? C.cyan : C.ink);
    text(ctx, `of ${this.rivals.length + 1}`, W - 100, 95, 14, C.soft, "center", 500);

    panel(ctx, W / 2 - 110, 24, 220, 50, 25);
    text(ctx, clock(this.raceT), W / 2, 50, 22);

    // where everyone is on this lap
    const barX = W / 2 - 200;
    const barW = 400;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(barX, 88, barW, 6);
    for (const r of [...this.rivals, me]) {
      const x = barX + (r.z / this.len) * barW;
      ctx.beginPath();
      ctx.arc(x, 91, r === me ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }

    const kmh = Math.round((me.speed / MAX) * 120);
    panel(ctx, 30, H - 100, 150, 70, 22);
    text(ctx, String(kmh), 92, H - 65, 32, C.ink, "right");
    text(ctx, "km/h", 100, H - 60, 16, C.soft, "left", 500);
  }

  private drawCountdown(ctx: Ctx) {
    const n = 3 - Math.floor(this.phaseT);
    const k = easeOutBack(clamp((this.phaseT % 1) / 0.3, 0, 1));
    this.bigText(ctx, String(n), W / 2, H * 0.38, 140 * k, C.ink);

    const mouse = this.host.players().length === 0;
    const help = mouse
      ? "Move the mouse to steer. Hold left click to drive, right click to brake."
      : "Tip your phone like a wheel to steer. Hold A or 2 to drive, B or 1 to brake.";
    panel(ctx, W / 2 - 380, H - 92, 760, 56, 28);
    text(ctx, help, W / 2, H - 63, 18, C.ink, "center", 500);
  }

  private drawBanner(ctx: Ctx) {
    const k = easeOutBack(clamp(this.bannerT / 0.3, 0, 1));
    const fade = clamp((1.6 - this.bannerT) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    this.bigText(ctx, this.banner, W / 2, H * 0.36, 84 * k, this.banner === "Go!" ? C.green : C.cyan);
    ctx.restore();
  }

  private bigText(ctx: Ctx, s: string, x: number, y: number, size: number, color: string) {
    if (size < 1) return;
    ctx.font = `800 ${size}px "M PLUS Rounded 1c", system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  private drawTitle(ctx: Ctx) {
    ctx.fillStyle = "rgba(243, 245, 247, 0.8)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 360, 130, 720, 460, 36);
    text(ctx, "Lagoon", W / 2, 190, 22, C.cyan);
    text(ctx, "Kart", W / 2, 243, 56);
    // low enough that tall hairstyles stay clear of the title
    drawKart(ctx, W / 2, 478 + Math.sin(this.t * 3) * 2, 200, this.me.color, this.me.avatar, Math.sin(this.t * 1.4) * 0.5);
    text(ctx, `${LAPS} laps of Lagoon Bay against three rivals.`, W / 2, 510, 18, C.soft, "center", 500);
    const best = this.host.best();
    if (best !== undefined) text(ctx, `Best time ${clock(best / 1000)}`, W / 2, 535, 16, C.soft, "center", 500);
    ctx.globalAlpha = 0.6 + Math.sin(this.t * 3) * 0.4;
    text(ctx, "Press A to start", W / 2, 565, 24, C.cyan);
    ctx.globalAlpha = 1;
  }

  private drawResults(ctx: Ctx) {
    ctx.fillStyle = "rgba(61, 71, 82, 0.35)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, W / 2 - 320, 150, 640, 430, 32);

    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 225, 44, 0, Math.PI * 2);
    ctx.fillStyle = C.cyanSoft;
    ctx.fill();
    ctx.clip();
    drawAvatar(ctx, this.me.avatar, W / 2, 236, 70);
    ctx.restore();

    text(ctx, `${ordinal(this.finalPlace)} place`, W / 2, 310, 52, this.finalPlace === 1 ? C.cyan : C.ink);
    text(ctx, `Time ${clock(this.me.finishedAt ?? this.raceT)}`, W / 2, 365, 22, C.ink, "center", 500);
    if (this.newBest) text(ctx, "New best time!", W / 2, 400, 20, C.cyan);
    text(ctx, `You earned ${this.earned} points`, W / 2, 435, 18, C.soft, "center", 500);
    drawButton(ctx, this.again, "Race again");
    drawButton(ctx, this.leave, "Home Menu", true);
  }
}

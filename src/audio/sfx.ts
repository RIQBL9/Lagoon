import { getEngine } from "./engine";
import { bell, keys, makeFilter, makeGain, makeOsc, noiseSource } from "./voices";

const out = () => getEngine().sfx;
const now = () => getEngine().ctx.currentTime;

let lastTick = 0;

export const sfx = {
  /** Pointer moved onto something clickable. */
  tick() {
    const t = now();
    if (t - lastTick < 0.04) return;
    lastTick = t;
    const o = makeOsc("sine", 1900);
    const g = makeGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(out());
    o.start(t);
    o.stop(t + 0.04);
  },

  select() {
    const t = now();
    bell(out(), t, 79, 0.08, 0.7);
    bell(out(), t + 0.055, 86, 0.18, 0.6);
  },

  back() {
    const t = now();
    bell(out(), t, 86, 0.08, 0.6);
    bell(out(), t + 0.055, 79, 0.18, 0.5);
  },

  nope() {
    const t = now();
    keys(out(), t, 64, 0.1, 0.6);
    keys(out(), t + 0.09, 63, 0.2, 0.6);
  },

  coin() {
    const t = now();
    bell(out(), t, 83, 0.07, 0.8);
    bell(out(), t + 0.07, 88, 0.4, 0.8);
  },

  /** Startup chime: a rising Dmaj9 with a soft chord under it. */
  chime() {
    const t = now();
    [62, 66, 69, 73, 76, 81].forEach((n, i) => bell(out(), t + i * 0.075, n + 12, 0.9, 0.55));
    [62, 66, 69, 73].forEach((n) => keys(out(), t + 0.05, n, 1.4, 0.35));
  },

  fanfare() {
    const t = now();
    [72, 76, 79, 84].forEach((n, i) => bell(out(), t + i * 0.09, n, i === 3 ? 0.6 : 0.12, 0.8));
    [60, 64, 67, 71].forEach((n) => keys(out(), t + 0.27, n + 12, 0.8, 0.45));
  },

  whoosh(power = 0.5) {
    const t = now();
    const src = noiseSource(t, 0.35);
    const bp = makeFilter("bandpass", 400, 1.2);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(1800 + power * 1600, t + 0.25);
    const g = makeGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2 * (0.4 + power), t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.connect(bp).connect(g).connect(out());
  },

  /** Wooden knocks. More pins, more knocks. */
  pins(count: number, strength = 1) {
    const t = now();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const at = t + Math.random() * 0.12 * Math.sqrt(count);
      const o = makeOsc("triangle", 500 + Math.random() * 700);
      const g = makeGain();
      g.gain.setValueAtTime(0.18 * strength, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      o.connect(g).connect(out());
      o.start(at);
      o.stop(at + 0.08);

      const n = noiseSource(at, 0.06);
      const bp = makeFilter("bandpass", 2400, 1);
      const ng = makeGain(0.12 * strength);
      ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
      n.connect(bp).connect(ng).connect(out());
    }
  },

  /** Race countdown: three short beeps, then a higher one for go. */
  beep(go: boolean) {
    const t = now();
    bell(out(), t, go ? 84 : 72, go ? 0.5 : 0.18, 0.9);
    keys(out(), t, go ? 72 : 60, go ? 0.5 : 0.18, 0.5);
  },

  thud(level = 0.6) {
    const t = now();
    const o = makeOsc("sine", 140);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.1);
    const g = makeGain();
    g.gain.setValueAtTime(0.5 * level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(out());
    o.start(t);
    o.stop(t + 0.2);
  },

  /** Crowd swell for big moments. */
  cheer() {
    const t = now();
    const src = noiseSource(t, 1.6);
    const bp = makeFilter("bandpass", 1100, 0.5);
    const g = makeGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.25);
    g.gain.setTargetAtTime(0, t + 0.6, 0.35);
    src.connect(bp).connect(g).connect(out());
  },
};

/** A looping rumble whose level follows the ball's speed. */
export function rollingSound() {
  const { ctx, noise } = getEngine();
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const lp = makeFilter("lowpass", 220, 2);
  const g = makeGain(0);
  src.connect(lp).connect(g).connect(out());
  src.start();
  return {
    set(level: number) {
      g.gain.setTargetAtTime(Math.min(1, level) * 0.5, ctx.currentTime, 0.05);
      lp.frequency.setTargetAtTime(160 + level * 160, ctx.currentTime, 0.05);
    },
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      src.stop(ctx.currentTime + 0.3);
    },
  };
}

/** Kart engine: pitch and grit follow speed, a little extra when on the gas. */
export function engineSound() {
  const { ctx } = getEngine();
  const low = makeOsc("sawtooth", 45);
  const high = makeOsc("square", 68);
  const lp = makeFilter("lowpass", 300, 3);
  const g = makeGain(0);
  low.connect(lp);
  high.connect(lp);
  lp.connect(g).connect(out());
  low.start();
  high.start();
  return {
    set(pace: number, throttle: boolean) {
      const t = ctx.currentTime;
      const f = 42 + pace * 120;
      low.frequency.setTargetAtTime(f, t, 0.08);
      high.frequency.setTargetAtTime(f * 1.5, t, 0.08);
      lp.frequency.setTargetAtTime(280 + pace * 900 + (throttle ? 250 : 0), t, 0.1);
      g.gain.setTargetAtTime(pace > 0 ? 0.035 + pace * 0.05 + (throttle ? 0.015 : 0) : 0, t, 0.1);
    },
    stop() {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.05);
      low.stop(t + 0.3);
      high.stop(t + 0.3);
    },
  };
}

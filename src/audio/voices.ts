import { getEngine } from "./engine";

export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function osc(type: OscillatorType, freq: number) {
  const o = getEngine().ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function gain(value = 0) {
  const g = getEngine().ctx.createGain();
  g.gain.value = value;
  return g;
}

function filter(type: BiquadFilterType, freq: number, q = 0.7) {
  const f = getEngine().ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function noise(t: number, length: number) {
  const { ctx, noise: buffer } = getEngine();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.start(t, Math.random() * (buffer.duration - length - 0.05), length + 0.05);
  return src;
}

/** Attack then a long natural decay, with a quick release at the end of the note. */
function pluckEnv(g: AudioParam, t: number, dur: number, peak: number, decay: number, release = 0.08) {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + 0.006);
  g.setTargetAtTime(0, t + 0.006, decay);
  g.setTargetAtTime(0, t + dur, release);
}

/** Two-operator FM electric piano with a little tine on the attack. */
export function keys(out: AudioNode, t: number, midi: number, dur: number, vel = 0.5) {
  const f = hz(midi);
  const carrier = osc("sine", f);
  const mod = osc("sine", f);
  const depth = gain();
  depth.gain.setValueAtTime(f * 1.4 * vel, t);
  depth.gain.exponentialRampToValueAtTime(f * 0.12 + 1, t + 0.5);
  mod.connect(depth).connect(carrier.frequency);

  const tine = osc("sine", f * 7);
  const tineAmp = gain();
  tineAmp.gain.setValueAtTime(0.05 * vel, t);
  tineAmp.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

  const amp = gain();
  pluckEnv(amp.gain, t, dur, 0.2 * vel, 0.9);
  carrier.connect(amp);
  tine.connect(tineAmp).connect(amp);
  amp.connect(out);

  const end = t + dur + 0.6;
  for (const o of [carrier, mod, tine]) {
    o.start(t);
    o.stop(end);
  }
}

export function bass(out: AudioNode, t: number, midi: number, dur: number, vel = 0.6) {
  const f = hz(midi);
  const body = osc("triangle", f);
  const sub = osc("sine", f);
  const lp = filter("lowpass", 700);
  const amp = gain();
  pluckEnv(amp.gain, t, dur, 0.32 * vel, 0.5, 0.05);
  body.connect(lp);
  sub.connect(lp);
  lp.connect(amp).connect(out);
  for (const o of [body, sub]) {
    o.start(t);
    o.stop(t + dur + 0.3);
  }
}

export function bell(out: AudioNode, t: number, midi: number, dur: number, vel = 0.5) {
  const f = hz(midi);
  const a = osc("sine", f);
  const b = osc("sine", f * 4.02);
  const bAmp = gain(0.18);
  bAmp.gain.setTargetAtTime(0, t, 0.06);
  const amp = gain();
  pluckEnv(amp.gain, t, dur, 0.16 * vel, 0.55, 0.12);
  a.connect(amp);
  b.connect(bAmp).connect(amp);
  amp.connect(out);
  for (const o of [a, b]) {
    o.start(t);
    o.stop(t + dur + 0.8);
  }
}

/** Nylon-ish pluck for bossa comping. */
export function pluck(out: AudioNode, t: number, midi: number, dur: number, vel = 0.5) {
  const o = osc("sawtooth", hz(midi));
  const lp = filter("lowpass", 3200, 1.2);
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.setTargetAtTime(500, t, 0.08);
  const amp = gain();
  pluckEnv(amp.gain, t, dur, 0.08 * vel, 0.35, 0.06);
  o.connect(lp).connect(amp).connect(out);
  o.start(t);
  o.stop(t + dur + 0.4);
}

/** Breathy sine with delayed vibrato. */
export function flute(out: AudioNode, t: number, midi: number, dur: number, vel = 0.5) {
  const f = hz(midi);
  const o = osc("sine", f);
  const vib = osc("sine", 5.2);
  const vibDepth = gain(0);
  vibDepth.gain.setValueAtTime(0, t);
  vibDepth.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
  vib.connect(vibDepth).connect(o.frequency);

  const amp = gain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.13 * vel, t + 0.05);
  amp.gain.setTargetAtTime(0.1 * vel, t + 0.05, 0.2);
  amp.gain.setTargetAtTime(0, t + dur, 0.06);

  const breath = noise(t, Math.min(dur, 0.15));
  const breathBand = filter("bandpass", f * 2, 2);
  const breathAmp = gain(0.03 * vel);
  breathAmp.gain.setTargetAtTime(0, t + 0.02, 0.04);
  breath.connect(breathBand).connect(breathAmp).connect(out);

  o.connect(amp).connect(out);
  for (const x of [o, vib]) {
    x.start(t);
    x.stop(t + dur + 0.4);
  }
}

/** Bright, slightly brassy lead for the sports theme. */
export function brass(out: AudioNode, t: number, midi: number, dur: number, vel = 0.5) {
  const f = hz(midi);
  const a = osc("sawtooth", f);
  const b = osc("square", f);
  b.detune.value = 6;
  const lp = filter("lowpass", 900, 1);
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.linearRampToValueAtTime(2600, t + 0.04);
  lp.frequency.setTargetAtTime(1500, t + 0.05, 0.15);
  const amp = gain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.07 * vel, t + 0.03);
  amp.gain.setTargetAtTime(0.05 * vel, t + 0.03, 0.2);
  amp.gain.setTargetAtTime(0, t + dur, 0.05);
  a.connect(lp);
  b.connect(lp);
  lp.connect(amp).connect(out);
  for (const o of [a, b]) {
    o.start(t);
    o.stop(t + dur + 0.3);
  }
}

// Drums

export function kick(out: AudioNode, t: number, vel = 0.6) {
  const o = osc("sine", 110);
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const amp = gain();
  amp.gain.setValueAtTime(0.7 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(amp).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

export function hat(out: AudioNode, t: number, vel = 0.4, open = false) {
  const len = open ? 0.22 : 0.05;
  const src = noise(t, len);
  const hp = filter("highpass", 7500);
  const amp = gain();
  amp.gain.setValueAtTime(0.12 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(hp).connect(amp).connect(out);
}

export function shaker(out: AudioNode, t: number, vel = 0.4) {
  const src = noise(t, 0.09);
  const hp = filter("highpass", 5000);
  const amp = gain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.07 * vel, t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  src.connect(hp).connect(amp).connect(out);
}

export function brush(out: AudioNode, t: number, vel = 0.5) {
  const src = noise(t, 0.2);
  const bp = filter("bandpass", 2600, 0.6);
  const amp = gain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(0.1 * vel, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(bp).connect(amp).connect(out);
}

export function snare(out: AudioNode, t: number, vel = 0.5) {
  const src = noise(t, 0.18);
  const bp = filter("bandpass", 1900, 0.8);
  const amp = gain();
  amp.gain.setValueAtTime(0.22 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  src.connect(bp).connect(amp).connect(out);

  const body = osc("triangle", 190);
  const bodyAmp = gain();
  bodyAmp.gain.setValueAtTime(0.25 * vel, t);
  bodyAmp.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  body.connect(bodyAmp).connect(out);
  body.start(t);
  body.stop(t + 0.1);
}

export function rim(out: AudioNode, t: number, vel = 0.5) {
  const o = osc("triangle", 1650);
  const amp = gain();
  amp.gain.setValueAtTime(0.14 * vel, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  o.connect(amp).connect(out);
  o.start(t);
  o.stop(t + 0.05);
}

export { noise as noiseSource, filter as makeFilter, gain as makeGain, osc as makeOsc };

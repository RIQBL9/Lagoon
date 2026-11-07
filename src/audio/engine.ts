export interface Engine {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
  noise: AudioBuffer;
}

let engine: Engine | null = null;

function makeNoise(ctx: AudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** A short, dark room. Generated, so there's no impulse file to ship. */
function makeRoom(ctx: AudioContext) {
  const len = Math.floor(ctx.sampleRate * 1.8);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const verb = ctx.createConvolver();
  verb.buffer = buf;
  return verb;
}

export function getEngine(): Engine {
  if (engine) return engine;

  const ctx = new AudioContext({ latencyHint: "interactive" });

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 4;
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(limiter);

  const room = makeRoom(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  room.connect(wet).connect(master);

  const music = ctx.createGain();
  music.gain.value = 0.5;
  music.connect(master);
  music.connect(room);

  const sfx = ctx.createGain();
  sfx.gain.value = 0.7;
  sfx.connect(master);

  engine = { ctx, music, sfx, noise: makeNoise(ctx, 2) };
  return engine;
}

/** Browsers keep audio suspended until the first click or key press. */
export function unlockAudio() {
  const { ctx } = getEngine();
  if (ctx.state !== "running") void ctx.resume();
}

export const audioTime = () => getEngine().ctx.currentTime;

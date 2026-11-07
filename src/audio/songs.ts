import type { Song } from "./music";
import { bass, bell, brass, brush, flute, hat, keys, kick, pluck, rim, shaker, snare } from "./voices";

// All four tracks are original. Each one is written as a chord chart, a
// melody string and a small per-step function for the groove.

const PITCH: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

const QUALITY: Record<string, number[]> = {
  "": [0, 4, 7],
  "6": [0, 4, 7, 9],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  "7": [0, 4, 7, 10],
  "9": [0, 4, 10, 14],
  "13": [0, 4, 10, 14, 21],
  "7sus": [0, 5, 7, 10],
};

interface Chord {
  root: number;
  /** Close voicing around middle C, without the root (the bass has it). */
  voicing: number[];
}

function chord(name: string): Chord {
  const m = /^([A-G])(b|#)?(.*)$/.exec(name);
  if (!m || !(m[3] in QUALITY)) throw new Error(`Unknown chord ${name}`);
  const root = (PITCH[m[1].toLowerCase()] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0) + 12) % 12;
  const voicing = QUALITY[m[3]]
    .filter((i) => i !== 0)
    .map((i) => {
      let n = 48 + ((root + i) % 12);
      while (n < 55) n += 12;
      return n;
    })
    .sort((a, b) => a - b);
  return { root, voicing };
}

/** One chord per half bar. "Dmaj9" fills a whole bar, "F#m7 B7" splits it. */
function chart(bars: string[]) {
  return bars.flatMap((bar) => {
    const names = bar.split(" ");
    return names.length === 1 ? [chord(names[0]), chord(names[0])] : names.map(chord);
  });
}

interface Note {
  midi: number;
  steps: number;
}

/** "a4 - c#5 ." → a note per token; "-" holds the last one, "." is a rest. */
function melody(src: string): (Note | null)[] {
  const tokens = src.trim().split(/\s+/);
  const out: (Note | null)[] = tokens.map(() => null);
  let last: Note | null = null;
  tokens.forEach((tok, i) => {
    if (tok === "-") {
      if (last) last.steps++;
      return;
    }
    if (tok === ".") {
      last = null;
      return;
    }
    const m = /^([a-g])(#|b)?(\d)$/.exec(tok);
    if (!m) throw new Error(`Bad note ${tok}`);
    const midi = 12 * (Number(m[3]) + 1) + PITCH[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    last = { midi, steps: 1 };
    out[i] = last;
  });
  return out;
}

const bassNote = (c: Chord) => 36 + c.root;

/** Home menu: unhurried lounge in D, light swing, keys and a bell melody. */
const homeChords = chart(["Dmaj9", "Bm9", "Em9", "A13", "Dmaj9", "F#m7 B7", "Em9", "A13"]);
const homeTune = melody(`
  a4 - c#5 e5 - - d5 .   c#5 - - - b4 . a4 .
  g4 - b4 d5 - f#5 - e5  - - - - . . c#5 d5
  e5 - f#5 a5 - - e5 .   c#5 - - a4 b4 - d#5 .
  e5 - - - d5 b4 g4 -    f#4 - - - e4 . . .
`);

export const homeSong: Song = {
  bpm: 92,
  perBeat: 2,
  swing: 0.16,
  steps: 64,
  play(step, t, out, len) {
    const half = Math.floor(step / 4);
    const c = homeChords[half];
    const next = homeChords[(half + 1) % homeChords.length];
    const inBar = step % 8;

    if (inBar === 0) c.voicing.forEach((n) => keys(out, t, n, len * 3, 0.42));
    if (inBar === 5) c.voicing.forEach((n) => keys(out, t, n, len * 1.6, 0.3));

    if (step % 4 === 0) bass(out, t, bassNote(c), len * 2.6, 0.7);
    if (inBar === 3) bass(out, t, bassNote(c) + 7, len * 0.9, 0.45);
    if (inBar === 7) bass(out, t, bassNote(next) - 1, len * 0.9, 0.4);

    if (inBar === 2 || inBar === 6) brush(out, t, 0.45);
    if (step % 2 === 0) hat(out, t, 0.25);
    if (inBar === 0) kick(out, t, 0.25);

    const n = homeTune[step];
    if (n) bell(out, t, n.midi + 12, len * n.steps, 0.38);
  },
};

/** Avatar Studio: bouncy, straight eighths, staccato off-beat chords in F. */
const studioChords = chart(["F6", "Dm7", "Gm7", "C9", "F6", "Am7 D7", "Gm7 C9", "F6"]);
const studioTune = melody(`
  c5 . f5 . a5 . g5 f5   . d5 - . f5 . e5 d5
  bb4 . d5 . g5 - f5 .   e5 . g5 . - - . .
  c5 . a4 . c5 . d5 f5   - e5 . c5 f#5 - a5 .
  g5 - f5 . e5 . d5 .    f5 . . . c5 . f4 .
`);

export const studioSong: Song = {
  bpm: 116,
  perBeat: 2,
  swing: 0,
  steps: 64,
  play(step, t, out, len) {
    const c = studioChords[Math.floor(step / 4)];
    const inBar = step % 8;

    if (step % 2 === 1) c.voicing.forEach((n) => keys(out, t, n + 12, len * 0.45, 0.32));
    if (step % 2 === 0) bass(out, t, bassNote(c) + (step % 4 === 2 ? 7 : 0), len * 0.7, 0.6);

    if (inBar === 0 || inBar === 4) kick(out, t, 0.4);
    if (inBar === 2 || inBar === 6) rim(out, t, 0.5);
    shaker(out, t, step % 2 ? 0.5 : 0.3);

    const n = studioTune[step];
    if (n) bell(out, t, n.midi + 12, len * n.steps * 0.8, 0.45);
  },
};

/** Shop: easy bossa in G with a nylon pluck and a flute line. */
const shopChords = chart(["Gmaj7", "Gmaj7", "Am7", "D9", "Bm7", "E9", "Am7", "D9"]);
const shopTune = melody(`
  b4 - - d5 - - f#5 -    e5 - d5 - b4 - . .
  c5 - - e5 - - g5 -     f#5 - e5 - c5 - . .
  d5 - - f#5 - a5 - -    g#5 - f#5 - d5 - b4 .
  c5 - e5 - a5 - g5 .    f#5 - - - - - . .
`);
const bossaComp = [
  [0, 3, 6],
  [2, 4, 7],
];
const clave = [0, 3, 6, 10, 12];

export const shopSong: Song = {
  bpm: 126,
  perBeat: 2,
  swing: 0,
  steps: 64,
  play(step, t, out, len) {
    const bar = Math.floor(step / 8);
    const c = shopChords[Math.floor(step / 4)];
    const inBar = step % 8;

    if (bossaComp[bar % 2].includes(inBar)) c.voicing.forEach((n, i) => pluck(out, t + i * 0.008, n, len * 1.2, 0.6));

    if (inBar === 0) bass(out, t, bassNote(c), len * 2.8, 0.7);
    if (inBar === 3) bass(out, t, bassNote(c) + 7, len * 0.8, 0.5);
    if (inBar === 4) bass(out, t, bassNote(c) + 7, len * 2.8, 0.6);

    if (clave.includes(step % 16)) rim(out, t, 0.4);
    shaker(out, t, step % 2 ? 0.55 : 0.3);
    if (inBar === 0 || inBar === 4) kick(out, t, 0.22);

    const n = shopTune[step];
    if (n) flute(out, t, n.midi + 12, len * n.steps, 0.8);
  },
};

/** Lagoon Sports title: bright and up-tempo, brass lead in Bb. */
const sportsChords = chart(["Bb", "Gm7", "Ebmaj7", "F", "Bb", "Gm7", "Cm7 F7", "Bb"]);
const sportsTune = melody(`
  f5 - d5 f5 bb5 - - .   a5 - g5 f5 d5 - - .
  eb5 - g5 bb5 - - g5 .  a5 - - - c6 - - .
  bb5 - f5 d5 bb4 - d5 f5   g5 - - f5 g5 - bb5 .
  c6 - bb5 a5 g5 - a5 .  bb5 - - - . . . .
`);

export const sportsSong: Song = {
  bpm: 132,
  perBeat: 2,
  swing: 0,
  steps: 64,
  play(step, t, out, len) {
    const c = sportsChords[Math.floor(step / 4)];
    const inBar = step % 8;

    if (inBar === 0 || inBar === 3 || inBar === 6) c.voicing.forEach((n) => keys(out, t, n + 12, len * 1.2, 0.4));
    bass(out, t, bassNote(c) + (step % 2 ? 12 : 0), len * 0.8, 0.6);

    if (inBar === 0 || inBar === 4) kick(out, t, 0.6);
    if (inBar === 2 || inBar === 6) snare(out, t, 0.5);
    hat(out, t, step % 2 ? 0.25 : 0.4);

    const n = sportsTune[step];
    if (n) brass(out, t, n.midi - 12, len * n.steps * 0.9, 0.9);
  },
};

/** Lagoon Kart: driving four-on-the-floor in E, bright brass hook. */
const kartChords = chart(["E", "C#m7", "A", "B", "E", "C#m7", "A B", "E"]);
const kartTune = melody(`
  b4 - e5 - g#5 - b5 -   c#6 - b5 g#5 e5 - - .
  a5 - c#6 - e6 - c#6 -  b5 - - - f#5 - - .
  g#5 - b5 - e6 - d#6 e6   c#6 - b5 - g#5 - e5 -
  f#5 - a5 - b5 - d#6 -  e6 - - - . . . .
`);

export const kartSong: Song = {
  bpm: 150,
  perBeat: 2,
  swing: 0,
  steps: 64,
  play(step, t, out, len) {
    const c = kartChords[Math.floor(step / 4)];
    const inBar = step % 8;

    if (step % 2 === 1) c.voicing.forEach((n) => keys(out, t, n + 12, len * 0.5, 0.3));
    bass(out, t, bassNote(c) + (step % 2 ? 12 : 0), len * 0.7, 0.65);

    if (step % 2 === 0) kick(out, t, 0.55);
    if (inBar === 2 || inBar === 6) snare(out, t, 0.45);
    hat(out, t, step % 2 ? 0.35 : 0.2, inBar === 7);

    const n = kartTune[step];
    if (n) brass(out, t, n.midi - 12, len * n.steps * 0.9, 0.8);
  },
};

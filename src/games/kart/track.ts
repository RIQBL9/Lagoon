// The track is a long list of short road segments. Each one can bend
// (curve) and rise or fall (y), and can carry roadside scenery. Drawing it
// projects the next few hundred segments in front of the camera.

export const SEG = 200;
export const ROAD_W = 2000;

export type Prop = "palm" | "rock" | "sign-left" | "sign-right" | "buoy" | "hut";

export interface Scenery {
  kind: Prop;
  /** Across the road: 0 is the centre, ±1 the edges, beyond that is the verge. */
  offset: number;
}

export interface Segment {
  index: number;
  z: number;
  curve: number;
  y1: number;
  y2: number;
  scenery: Scenery[];
  stripe: boolean;
  /** Screen y below which this segment hides things behind it. Set while drawing. */
  clip: number;
}

const ease = (a: number, b: number, t: number) => a + (b - a) * (1 - Math.cos(t * Math.PI)) / 2;

export function buildTrack() {
  const segs: Segment[] = [];
  const lastY = () => (segs.length ? segs[segs.length - 1].y2 : 0);

  const add = (curve: number, y: number) => {
    const index = segs.length;
    segs.push({
      index,
      z: index * SEG,
      curve,
      y1: lastY(),
      y2: y,
      scenery: [],
      stripe: Math.floor(index / 3) % 2 === 0,
      clip: 0,
    });
  };

  /** enter → hold → leave, easing the curve in and out, climbing `hill` segments' worth. */
  const road = (enter: number, hold: number, leave: number, curve: number, hill = 0) => {
    const start = lastY();
    const end = start + hill * SEG;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(ease(0, curve, n / enter), ease(start, end, n / total));
    for (let n = 0; n < hold; n++) add(curve, ease(start, end, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(ease(curve, 0, n / leave), ease(start, end, (enter + hold + n) / total));
  };

  const L = { short: 25, medium: 50, long: 100 };
  const C = { easy: 2, medium: 4, hard: 6 };
  const H = { low: 20, medium: 40, high: 60 };

  road(L.medium, L.medium, L.medium, 0);
  road(L.medium, L.medium, L.medium, C.easy, H.low);
  road(L.short, L.short, L.short, 0, -H.low / 2);
  road(L.medium, L.short, L.medium, -C.medium);
  road(L.short, L.medium, L.short, C.medium, H.medium);
  road(L.long, L.medium, L.long, -C.easy, -H.medium);
  road(L.short, L.short, L.short, C.hard);
  road(L.short, L.short, L.short, -C.hard);
  road(L.medium, L.long, L.medium, 0, H.high);
  road(L.long, L.medium, L.medium, C.medium, -H.high);
  road(L.medium, L.short, L.medium, -C.medium, H.low);
  road(L.short, L.short, L.short, C.easy);
  // ease back down to the start height so the lap joins up
  road(L.long, L.medium, L.long, 0, -lastY() / SEG);

  // Scenery
  const put = (i: number, kind: Prop, offset: number) => segs[i % segs.length].scenery.push({ kind, offset });
  for (let i = 20; i < segs.length; i += 6) {
    put(i, "palm", -1.6 - ((i * 7) % 5) * 0.25);
    if (i % 4 === 0) put(i + 3, "palm", 1.7 + ((i * 3) % 4) * 0.3);
  }
  for (let i = 30; i < segs.length; i += 37) put(i, "rock", 1.4);
  for (let i = 60; i < segs.length; i += 90) put(i, "hut", -2.6);
  for (let i = 10; i < segs.length; i += 13) put(i, "buoy", 3.4 + (i % 3) * 0.5);
  segs.forEach((s, i) => {
    // arrow signs on the outside of each sharp bend
    if (Math.abs(s.curve) >= C.medium && i % 20 === 0) put(i, s.curve > 0 ? "sign-right" : "sign-left", s.curve > 0 ? -1.3 : 1.3);
  });

  return segs;
}

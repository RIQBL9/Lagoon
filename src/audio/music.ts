import { getEngine } from "./engine";

export interface Song {
  bpm: number;
  /** Steps per beat. 2 = eighth notes. */
  perBeat: number;
  /** 0 is straight; ~0.33 is a full triplet swing on the off-steps. */
  swing: number;
  steps: number;
  play(step: number, t: number, out: AudioNode, stepLen: number): void;
}

interface Playing {
  song: Song;
  out: GainNode;
  timer: number;
}

const LOOKAHEAD = 0.15;

let playing: Playing | null = null;
let wanted: Song | null = null;
let enabled = true;

function start(song: Song): Playing {
  const { ctx, music } = getEngine();
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.8);
  out.connect(music);

  const stepLen = 60 / song.bpm / song.perBeat;
  let step = 0;
  let next = ctx.currentTime + 0.1;

  const timer = window.setInterval(() => {
    while (next < ctx.currentTime + LOOKAHEAD) {
      const swingDelay = step % 2 === 1 ? song.swing * stepLen : 0;
      song.play(step % song.steps, next + swingDelay, out, stepLen);
      next += stepLen;
      step++;
    }
  }, 25);

  return { song, out, timer };
}

function fadeOut(p: Playing) {
  const { ctx } = getEngine();
  p.out.gain.cancelScheduledValues(ctx.currentTime);
  p.out.gain.setValueAtTime(p.out.gain.value, ctx.currentTime);
  p.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  clearInterval(p.timer);
  setTimeout(() => p.out.disconnect(), 2500);
}

export function playSong(song: Song | null) {
  if (playing?.song === song) return;
  if (playing) fadeOut(playing);
  playing = song && enabled ? start(song) : null;
  wanted = song;
}

export function setMusicEnabled(on: boolean) {
  enabled = on;
  const song = wanted;
  if (!on && playing) {
    fadeOut(playing);
    playing = null;
  } else if (on && song && !playing) {
    playing = start(song);
  }
}

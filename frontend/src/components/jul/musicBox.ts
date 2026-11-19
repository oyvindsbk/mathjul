/**
 * A music box (spilledåse) in the browser, for the /jul page (feature 067).
 * Plays JUL_MELODIES in a loop through the Web Audio API: no audio files.
 *
 * Timing uses the usual look-ahead pattern: a timer wakes every 25 ms and
 * schedules the notes due in the next 120 ms on the audio clock, which stays
 * exact even when the main thread is busy (snowstorm, rendering).
 */

import { JUL_MELODIES, type Melody } from "@/lib/julMelodies";

const LOOK_AHEAD_S = 0.12;
const TICK_MS = 25;
/** Silence between songs. */
const SONG_GAP_S = 2.5;
const MASTER_VOLUME = 0.16;
const FADE_S = 0.3;

/**
 * A music box tine: a sine fundamental with a quieter octave and a faint,
 * slightly inharmonic overtone that dies away first. Attack is near
 * instant, decay is exponential, so every note rings out like a bell.
 */
const PARTIALS = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2, gain: 0.28, decay: 0.6 },
  { ratio: 4.07, gain: 0.07, decay: 0.25 },
] as const;

type AudioContextCtor = typeof AudioContext;

function audioContextClass(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/** True when this browser can play the music box at all. */
export function canPlayMusicBox(): boolean {
  return audioContextClass() !== null;
}

export interface MusicBoxOptions {
  /** Called with a song's title as it starts playing. */
  onSongChange?: (title: string) => void;
}

export class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private titleTimer: ReturnType<typeof setTimeout> | null = null;
  private songIndex = 0;
  private noteIndex = 0;
  private nextNoteTime = 0;

  constructor(private readonly options: MusicBoxOptions = {}) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  /**
   * Starts from the first song. Must be called from a user gesture (a click),
   * or the browser keeps the audio context suspended.
   */
  start(): void {
    if (this.playing) return;
    const Ctor = audioContextClass();
    if (!Ctor) throw new Error("Web Audio is not supported");

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(MASTER_VOLUME, ctx.currentTime + FADE_S);
    master.connect(this.echo(ctx));
    master.connect(ctx.destination);
    void ctx.resume();

    this.ctx = ctx;
    this.master = master;
    this.songIndex = 0;
    this.noteIndex = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.announce(this.nextNoteTime);
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  /** Fades out, then releases the audio context. */
  stop(): void {
    const { ctx, master } = this;
    if (this.timer !== null) clearInterval(this.timer);
    if (this.titleTimer !== null) clearTimeout(this.titleTimer);
    this.timer = null;
    this.titleTimer = null;
    this.ctx = null;
    this.master = null;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + FADE_S);
    setTimeout(() => void ctx.close().catch(() => undefined), FADE_S * 1000 + 50);
  }

  /** Freezes the audio clock (tab hidden). Scheduled notes wait with it. */
  pause(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /** A soft echo, for the sound of a box resonating. */
  private echo(ctx: AudioContext): AudioNode {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.19;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    return delay;
  }

  private get song(): Melody {
    return JUL_MELODIES[this.songIndex];
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    while (this.nextNoteTime < ctx.currentTime + LOOK_AHEAD_S) {
      const song = this.song;
      const note = song.notes[this.noteIndex];
      const seconds = (note.beats * 60) / song.bpm;
      if (note.frequency !== null) this.playNote(ctx, note.frequency, this.nextNoteTime, seconds);
      this.nextNoteTime += seconds;
      this.noteIndex++;

      if (this.noteIndex >= song.notes.length) {
        this.noteIndex = 0;
        this.songIndex = (this.songIndex + 1) % JUL_MELODIES.length;
        this.nextNoteTime += SONG_GAP_S;
        this.announce(this.nextNoteTime);
      }
    }
  }

  /** Reports the current song's title when its first note sounds. */
  private announce(at: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const title = this.song.title;
    if (this.titleTimer !== null) clearTimeout(this.titleTimer);
    const delayMs = Math.max(0, (at - ctx.currentTime) * 1000);
    this.titleTimer = setTimeout(() => this.options.onSongChange?.(title), delayMs);
  }

  private playNote(ctx: AudioContext, frequency: number, time: number, length: number): void {
    const master = this.master;
    if (!master) return;
    const ring = Math.max(1.2, length * 1.6);

    for (const partial of PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency * partial.ratio;

      const env = ctx.createGain();
      const peak = partial.gain * 0.5;
      const end = time + ring * partial.decay;
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(peak, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(env).connect(master);
      osc.start(time);
      osc.stop(end + 0.05);
    }
  }
}

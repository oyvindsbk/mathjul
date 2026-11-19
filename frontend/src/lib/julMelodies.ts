/**
 * Christmas melodies for the /jul music box (feature 067). Public-domain
 * compositions only, melody line only.
 *
 * Each melody is written as space-separated notes: `<pitch>:<beats>`, where
 * pitch is scientific pitch notation (C4 = middle C, `#`/`b` for sharp/flat)
 * or `R` for a rest, and beats defaults to 1. `bpm` is beats per minute.
 */

export interface MelodyNote {
  /** Frequency in Hz, or null for a rest. */
  frequency: number | null;
  beats: number;
}

export interface Melody {
  title: string;
  bpm: number;
  notes: readonly MelodyNote[];
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" → 440, "C#5" → 554.37. Throws on anything else, so a typo fails loudly. */
export function pitchToFrequency(pitch: string): number {
  const match = /^([A-G])([#b]?)(\d)$/.exec(pitch);
  if (!match) throw new Error(`Invalid pitch: ${pitch}`);
  const [, letter, accidental, octave] = match;
  const offset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const midi = 12 * (Number(octave) + 1) + SEMITONES[letter] + offset;
  return 440 * 2 ** ((midi - 69) / 12);
}

function parse(score: string): MelodyNote[] {
  return score
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [pitch, beats = "1"] = token.split(":");
      return {
        frequency: pitch === "R" ? null : pitchToFrequency(pitch),
        beats: Number(beats),
      };
    });
}

function melody(title: string, bpm: number, score: string): Melody {
  return { title, bpm, notes: parse(score) };
}

/** Played in this order, then from the top again. */
export const JUL_MELODIES: readonly Melody[] = [
  // Franz Xaver Gruber, 1818. 6/8, one beat = one eighth note.
  melody(
    "Glade jul",
    160,
    `G4:1.5 A4:.5 G4 E4:3   G4:1.5 A4:.5 G4 E4:3
     D5:2 D5 B4:3   C5:2 C5 G4:3
     A4:2 A4 C5:1.5 B4:.5 A4   G4:1.5 A4:.5 G4 E4:3
     A4:2 A4 C5:1.5 B4:.5 A4   G4:1.5 A4:.5 G4 E4:3
     D5:2 D5 F5:1.5 D5:.5 B4   C5:3 E5:3
     C5:1.5 G4:.5 E4 G4:1.5 F4:.5 D4   C4:6`
  ),
  // James Lord Pierpont, 1857. Chorus, both endings.
  melody(
    "Jingle Bells",
    150,
    `B4 B4 B4:2   B4 B4 B4:2   B4 D5 G4:1.5 A4:.5   B4:4
     C5 C5 C5:1.5 C5:.5   C5 B4 B4 B4:.5 B4:.5   B4 A4 A4 B4   A4:2 D5:2
     B4 B4 B4:2   B4 B4 B4:2   B4 D5 G4:1.5 A4:.5   B4:4
     C5 C5 C5:1.5 C5:.5   C5 B4 B4 B4:.5 B4:.5   D5 D5 C5 A4   G4:4`
  ),
  // Welsh traditional (Nos Galan).
  melody(
    "Deck the Halls",
    140,
    `C5:1.5 Bb4:.5 A4 G4   F4 G4 A4 F4   G4:.5 A4:.5 Bb4:.5 G4:.5 A4:1.5 G4:.5   F4 E4 F4:2
     C5:1.5 Bb4:.5 A4 G4   F4 G4 A4 F4   G4:.5 A4:.5 Bb4:.5 G4:.5 A4:1.5 G4:.5   F4 E4 F4:2
     G4:1.5 A4:.5 Bb4 G4   A4:1.5 Bb4:.5 C5 G4   A4:.5 B4:.5 C5 D5:.5 E5:.5 F5   E5 D5 C5:2
     C5:1.5 Bb4:.5 A4 G4   F4 G4 A4 F4   D5:.5 D5:.5 D5:.5 D5:.5 C5:1.5 Bb4:.5   A4 G4 F4:2`
  ),
  // English traditional. 3/4.
  melody(
    "We Wish You a Merry Christmas",
    170,
    `D4   G4 G4:.5 A4:.5 G4:.5 F#4:.5   E4 E4 E4
     A4 A4:.5 B4:.5 A4:.5 G4:.5   F#4 D4 D4
     B4 B4:.5 C5:.5 B4:.5 A4:.5   G4 E4 D4:.5 D4:.5   E4 A4 F#4   G4:2`
  ),
];

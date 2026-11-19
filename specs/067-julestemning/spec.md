# Feature: Julestemning — snow levels and Christmas music on /jul

## Summary
Extends the `/jul` page from 066. The "Snø av/på" button becomes a five-stop slider, from no snow through to a full snowstorm. A new button plays optional Christmas music: public-domain melodies played as a music box in the browser. The music is off by default.

## Motivation
The snow is the most noticed part of the Christmas mood, and people want different amounts: a little decoration while reading a recipe, or a full storm for fun. Music finishes the mood, but it must never surprise anyone, so it only plays when someone asks for it.

## Current state (verified in code, 2026-11-19)

| Piece | Status |
|---|---|
| `Snowfall.tsx` | 32 random flakes, 18–32 px, fall straight down with drift and spin (`jul-fall` keyframes). `enabled` prop is boolean |
| `useSnowPreference.ts` | boolean, localStorage key `mathjul.jul.snow` = `"on"`/`"off"`, defaults on |
| Toggle on `/jul` | `data-testid="jul-snow-toggle"`, `aria-pressed`, text "❄ Snø av" / "❄ Snø på" |
| Reduced motion | `.jul-snow` hidden by CSS, and `Snowfall` renders no flakes |
| Audio anywhere in the app | ❌ none |
| E2E | `jul.spec.ts`: "reduced motion renders no snowflakes", "the snow toggle hides the flakes and is remembered" |

## Requirements

### Snow levels
- R1: The snow button is replaced by a slider (`<input type="range">`, min 0, max 4, step 1) with five stops, left to right:

  | Value | Label | Look |
  |---|---|---|
  | 0 | **Ingen snø** | no flakes |
  | 1 | **Små snøfnugg** | few, small, slow flakes |
  | 2 | **Lett snøfall** | today's snow (the default) |
  | 3 | **Snøen laver ned** | many flakes, falling faster |
  | 4 | **Snøstorm** | dense snow that whirls in all directions, including sideways and upwards |

- R2: The current level's label is shown next to the slider and is the slider's `aria-valuetext`. The slider has a visible label ("Snø"). Arrow keys move one stop at a time (native range behaviour).
- R3: Changing the level takes effect immediately, without reloading the page.
- R4: The level is remembered per browser in localStorage, key `mathjul.jul.snowLevel` (`"0"`–`"4"`). Storage may be missing, so reads and writes are guarded, and the default is used.
- R5: Migration: if there is no stored level and the old key `mathjul.jul.snow` is `"off"`, start at 0 (Ingen snø). Otherwise the default is 2 (Lett snøfall).
- R6: Under `prefers-reduced-motion: reduce`, no flakes render at any level, as today. The slider still shows and still saves the choice.
- R7: Snøstorm stays smooth. Only `transform` and `opacity` are animated, the flake count has a ceiling (≈150), and it uses the same single shared SVG shape.

### Christmas music
- R8: A button **"♪ Julemusikk"** sits next to the snow slider (`aria-pressed`, `data-testid="jul-music-toggle"`). It is **off by default** and never starts on its own. It is not resumed on the next visit either; browsers block audio without a click anyway.
- R9: The music is played in the browser with the Web Audio API as a **music box** (spilledåse): short bell-like notes that fade out. There are no audio files and no new dependencies.
- R10: The playlist is public-domain melodies only, played in order and looped, with a short pause between songs:
  1. Glade jul (Franz Gruber, 1818)
  2. Jingle Bells (James Lord Pierpont, 1857)
  3. Deck the Halls (walisisk folketone)
  4. We Wish You a Merry Christmas (engelsk folketone)

  Deilig er jorden and O jul med din glede were planned, but they were swapped (2026-11-19) for two melodies whose notes could be written out with confidence. They can be added later from verified sheet music.
- R11: While playing, the page shows "Nå spiller: {title}" (`data-testid="jul-now-playing"`).
- R12: The music pauses when the tab is hidden and resumes when it is visible again, if it was playing. It stops when the user leaves `/jul`.
- R13: The volume is moderate and fixed. Notes fade in and out, so starting and stopping makes no click.

## Design

### Data model / API
No backend changes.

### UI changes
- `/jul` header row: countdown pill · snow slider (label "Snø", range, current level name) · music button. It wraps on mobile.
- Testids: `jul-snow-level` (the range input), `jul-snow-level-name`, `jul-music-toggle`, `jul-now-playing`. `jul-snow-toggle` goes away.
- `Snowfall` takes `level: SnowLevel` (0–4) instead of `enabled`. Each level is a config: count, size range, duration range, drift range and animation (`fall` or `whirl`).
- Snøstorm uses a `jul-whirl` keyframe with several random waypoints per flake (CSS variables). Flakes cross the page sideways, rise and fall, and some enter from the sides.

### Music engine
- `lib/julMelodies.ts`: melodies as data (note name + length in beats, tempo per song).
- `components/jul/musicBox.ts`: creates the `AudioContext` on the first click. Notes are a sine fundamental plus soft overtones with a fast attack and an exponential decay, and there is one master gain. A look-ahead scheduler (a timer every ~25 ms schedules notes ~100 ms ahead on the audio clock) keeps timing exact. It exposes `start()`, `stop()` and `onSongChange`.
- `components/jul/useJulMusic.ts`: React state (`playing`, `title`), a visibility listener, and cleanup on unmount (stop, then close the context).

## Out of scope
- Volume slider, song picker, skip button.
- Recorded music or streams.
- Music or snow levels on other pages or on the home card.
- Remembering "music on" across visits.

## Open questions
- None. Decided with the user on 2026-11-19: the music is a music box in the browser, and "Ingen snø" is the fifth stop on the slider.

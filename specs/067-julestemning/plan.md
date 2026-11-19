# Implementation Plan: Julestemning

## Approach
Frontend only, all inside `components/jul/` and `lib/`. The snow gets a level type and a config per level, and `Snowfall` reads the config instead of a fixed count. Snøstorm adds a second keyframe animation driven by per-flake CSS variables. The music is a small Web Audio synth with a look-ahead scheduler, fed by melodies stored as data and wrapped in a React hook.

## Stacks affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key decisions
- **Native range input:** keyboard, touch and screen reader support for free. Stop labels are plain text under it.
- **Level configs in one table** (`SNOW_LEVELS`): one place to tune. Flakes are regenerated when the level changes, which is cheap (≤150 objects).
- **Storm = waypoints, not JS physics:** CSS keyframes at 0/25/50/75/100 % with random `--wxN`/`--wyN` offsets per flake. This keeps it on the compositor, with no requestAnimationFrame loop.
- **Music box through Web Audio, not files:** this avoids copyright on recordings (the compositions are public domain, but most recordings aren't), asset size and dependencies. A music box timbre also hides that it's a synth.
- **AudioContext is created on the click:** this satisfies autoplay policies, including iOS Safari.
- **Look-ahead scheduler:** `setTimeout` alone drifts. Scheduling on `audioContext.currentTime` keeps the rhythm steady, even when the main thread is busy with the storm.

## Risks
- **The storm is heavy on weak phones:** cap the count, animate only transform, and use `will-change`. Check on a phone. If it's too heavy, use fewer flakes on narrow screens.
- **Melody transcription errors:** check each melody against sheet music and listen to it once before marking the task done.
- **iOS silent switch mutes Web Audio:** this is known platform behaviour. It's acceptable and isn't worked around.
- **Playwright can't hear audio:** test the state instead (button, `jul-now-playing`, and that the scheduler starts and stops). The sound is checked by hand.

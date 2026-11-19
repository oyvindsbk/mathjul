# Tasks: Julestemning

## Tasks

- [x] Task 1: Snow levels 0–3 and the slider.
  - Add a `SnowLevel` type with labels and a `SNOW_LEVELS` config table.
  - Change `useSnowPreference` to a level, with the new key and the migration from `mathjul.jul.snow` (R4, R5).
  - Make `Snowfall` take `level` and build its flakes from the config.
  - Replace the toggle on `/jul` with the slider (R1–R3, R6). Snøstorm can use the "laver ned" look for now.
  - Update the E2E tests:
    - Level 0 has no flakes, and level 1 has fewer flakes than level 3.
    - The level is remembered after a reload.
    - The old "off" key migrates to 0.
    - Reduced motion shows no flakes.
  - Lint, tsc, build, `npx playwright test jul.spec`.
- [x] Task 2: Snøstorm (R7).
  - Add the `jul-whirl` keyframes with random waypoints per flake, the denser count and faster durations, and flakes that enter from the sides.
  - E2E: level 4 renders the storm flakes (`data-motion="whirl"`) within the count cap.
  - Manual check of smoothness in the dev server.
  - Lint, tsc, build, E2E.
- [ ] Task 3: The music engine, with no UI yet (R9, R10, R13).
  - `lib/julMelodies.ts` holds the four melodies, checked against sheet music.
  - `components/jul/musicBox.ts` holds the synth voice, the look-ahead scheduler, the playlist loop and the pause between songs, plus `start`/`stop`/`onSongChange`.
  - Lint, tsc, build.
- [ ] Task 4: The music button on /jul (R8, R11, R12).
  - Add the `useJulMusic` hook and the button with "Nå spiller".
  - Pause when the tab is hidden, and stop and close the context on unmount.
  - E2E:
    - The music is off by default.
    - A click shows "Nå spiller: Glade jul".
    - A second click stops it.
    - It is not on after a reload.
    - Leaving /jul stops it.
  - Listen to all four songs by hand.
  - Lint, tsc, build, E2E.
- [ ] Task 5: Final verification.
  - Full frontend inner loop and the full `jul.spec`.
  - Review agents.
  - Start the dev server and check it in Chrome on desktop and at phone width (slider, storm, music).

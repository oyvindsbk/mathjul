# Tasks: Kaker — temperatur og steketid per form

## Tasks

- [x] Task 1: Add `BakeGuidance` type, the `BAKE_GUIDANCE` lookup table, and
      `bakeGuidanceFor(preset)` to `frontend/src/lib/pan-size.ts`, covering
      the six presets the chart actually maps to (rund-24/26/28/30,
      liten-langpanne-20x30, langpanne-30x40 — no `rund-23` preset exists to
      key the chart's Ø23 row to, see spec.md). No standalone unit-test
      runner exists in this project (only Playwright e2e, per CLAUDE.md) —
      coverage for both the covered and uncovered cases lives in Task 2's
      e2e tests instead.

- [x] Task 2: Wire `bakeGuidanceFor(selected)` into `FormVelger.tsx`. Render
      the guidance text (`data-testid="form-velger-bake-guidance"`, e.g.
      "175–180°C i 30–35 min") in place of the existing `conversionWarning`
      block when guidance exists for the selected preset; fall back to
      today's warning block unchanged when it doesn't. Extended
      `kakeform.spec.ts`:
      - selecting a covered preset (Rund Ø26, Langpanne 30×40, Liten
        langpanne 20×30) shows the guidance text and hides the qualitative
        warning, even where the shape/depth change would otherwise trigger
        it (updated two pre-existing tests that asserted the old warning
        text for now-covered presets);
      - selecting an uncovered preset (Stor langpanne 40×50) still shows the
        existing qualitative warning, unchanged from today;
      - selecting the source pan itself (Rund Ø24), when covered, shows that
        pan's own guidance rather than nothing.

## Verification (per task)

Frontend inner loop, run after each task:

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
cd frontend && npx playwright test kakeform
```

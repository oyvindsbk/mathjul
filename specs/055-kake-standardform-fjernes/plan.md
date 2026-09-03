# Implementation Plan: Kaker — én standardform, ingen egen "original"

## Approach

Two independent-ish changes bundled into one feature because they touch the
same small set of files and were requested together:

1. **Message gating** (frontend only): `FormVelger` stops showing guidance/
   warning when the selected pan equals the source/default pan.
2. **Retire `DefaultPanPresetId`** (frontend + backend + migration): remove
   the UI control, then work backwards through the request/response DTOs to
   the database column, mirroring the `RemoveSpringformShape` migration's
   shape (SQL data cleanup in `Up`, no-op `Down`).

Order matters for a clean inner loop: do the frontend UI/copy changes first
(fast feedback, e2e-testable immediately), then the backend column removal
last (requires a fresh migration + `dotnet test`, slower loop). Doing
frontend first also means the TypeScript types can drop the field before the
backend stops sending it, which is safe — an extra field in a response the
frontend no longer reads is inert.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **One `data-testid` gate, not two.** Rather than duplicating the
  `selected?.id !== source?.id` check across the guidance block and the
  warning block, compute a single boolean once in `FormVelger` and use it to
  gate whichever of the two would otherwise render — keeps the "only one
  message, only on a real change" rule enforced in one place.
- **Drop the column instead of leaving it dormant.** Confirmed with the user:
  a field nothing can set and nothing reads is worse than a clean removal —
  matches the project's own precedent (`RemoveSpringformShape`) for retiring
  a pan-related concept via migration rather than leaving dead columns.
- **No new tests file for the backend removal** — `RecipePanFieldsTests.cs`
  already has a "── Available preset subset + default ──" section entirely
  about `DefaultPanPresetId`; those tests get deleted or rewritten in place
  (e.g. `UpdateRecipe_DefaultNotInSubset_ReturnsBadRequest` no longer applies
  and is removed; `UpdateRecipe_ValidSubsetAndDefault_PersistsBoth` becomes
  `UpdateRecipe_ValidSubset_Persists` without the default half).
- **`UpdateRequest`/DTO test helper signatures change** — removing the
  `defaultPanPresetId` parameter from `RecipePanFieldsTests.cs`'s
  `UpdateRequest(...)` helper is a compile-time forcing function that surfaces
  every call site still passing it, which is the fastest way to confirm
  nothing was missed.

## Risks

- **Existing recipes silently lose a configured default.** Named explicitly
  in the spec as intended, not accidental — mitigate by making sure the PR
  description says so, since it is a real (if small) behavior change for any
  recipe that had set a default different from its source tin. `git grep` for
  `defaultPanPresetId` in mock data / seed data to confirm none of the seeded
  fixtures relies on it after this lands (recipe 6, `mock-data.ts`, currently
  sets one — it becomes dead data, not a bug, but worth a quick look so the
  053 e2e tests that reference it are updated rather than left silently
  passing against stale assumptions).
- **053's e2e coverage for "the configured default is preselected on load"
  no longer has anything to test.** That `kakeform.spec.ts` test
  (`'the configured default is preselected on load'`) is removed along with
  the feature it covered; `'a restricted recipe only offers its configured
  subset, plus the source tin'` is kept but its expected preselected value
  changes from `langpanne-30x40` back to the source tin `rund-24`.

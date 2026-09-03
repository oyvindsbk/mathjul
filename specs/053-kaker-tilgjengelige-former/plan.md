# Implementation Plan: Kaker — forfatterstyrt formutvalg

## Approach

Mirror the exact pattern the five existing pan fields already use end-to-end:
`Recipe.cs` column → `RecipeDbContext` JSON conversion (copy `Tips`'s
converter) → three DTOs → `ValidatePanFields`/`ClearPanFieldsForNonForm` →
`RecipeForm` (write side) → `FormVelger` (read side, filtering).

No migration framework surprises expected: `Program.cs:265` already runs
`MigrateAsync()` on startup, same as every prior pan-field addition.

## Stacks Affected

- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions

- **Two columns, not one.** A single `Dictionary<string,bool>`-style blob
  could encode "available + which is default" in one field, but two flat
  columns (`List<string>?` + `string?`) match the existing `Tips`/simple-list
  precedent exactly and keep the "default must be a member of available"
  invariant checkable as an explicit validation rule instead of buried in a
  blob's internal consistency.
- **Empty subset = no restriction, not "nothing allowed."** A recipe with no
  chosen subset must keep working exactly as it does today (full list). This
  also means existing recipes need no backfill/migration data — null reads as
  "unrestricted."
- **Source tin always implicitly available.** Enforced in the UI (checkbox
  disabled) and worth asserting is *not* separately enforced server-side as a
  hard rule beyond "the id list, if present, doesn't need to literally contain
  the source id" — `FormVelger` already unions the source preset in regardless
  of what's stored, so this is a UI-only guarantee, not a data-integrity one.
- **Backend id validation duplicates the frontend's preset id list.** The
  preset table itself stays frontend-only (per 052's decision — never a DB
  table), so the backend needs its own flat array of valid ids to validate
  against, the same way `PanShapes` already duplicates the four shape strings.
  This is intentionally a small duplication, not a shared package — 052 chose
  this trade-off already for the shape enum.

## Risks

- **Duplicated id list drifting out of sync** (frontend `PAN_PRESETS` ids vs.
  backend's validation array) if a preset is ever added/removed/renamed
  without updating both. Mitigation: a code comment on each list pointing at
  the other, same as `PanShapes` already does for shape strings.
- **RecipeForm UI crowding.** The form already gained a picker + optional
  height field in 052; a 14-item checkbox list plus a default-radio adds real
  vertical space to an already long form. Mitigation: collapse behind a
  disclosure ("Begrens tilgjengelige former") defaulting to closed/unrestricted,
  so authors who don't care about this never see it.

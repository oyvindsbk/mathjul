# Implementation Plan: Instruction Step Checkboxes

## Approach
Add a `checkedSteps` state (`Set<number>`) to `RecipeDetailClient`. Each instruction step gets a global index (counting across all sections). Clicking a step or its checkbox toggles that index in the set. Apply visual styles to checked steps. Add a reset button when any steps are checked.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- **Global index across sections:** Using a single counter (same pattern as `stepCounter` already in the component) ensures unique keys even when sections are present.
- **Client-side only:** No persistence needed for MVP — state resets on navigation, which is acceptable for a cooking aid.
- **Click on row toggles:** Wrapping the `<li>` content in a clickable area improves usability on mobile.

## Risks
- None significant — purely additive UI change with no API or data model impact.

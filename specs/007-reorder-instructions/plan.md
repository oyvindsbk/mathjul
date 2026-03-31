# Implementation Plan: Reorder Recipe Instructions

## Approach
Frontend-only change. Add move-up, move-down, and insert-below controls to each step row in `RecipeForm.tsx`. Array reordering is handled with simple splice/swap operations on `formData.instructions`.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- Arrow buttons over drag-and-drop: simpler, accessible, no new dependencies
- Insert-below button per row: avoids the UX friction of having to add at end and then move up repeatedly
- Keep the existing "add step at bottom" button for quick appending

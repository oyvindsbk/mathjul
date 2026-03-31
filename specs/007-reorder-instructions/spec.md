# Feature: Reorder Recipe Instructions

## Summary
Allow users to manually reorder recipe instruction steps in the recipe edit form. Users can also add new steps and split or merge steps as needed to correct AI extraction errors.

## Motivation
The AI extraction sometimes merges steps that should be separate, or splits steps that should be combined. Users need a way to manually fix the step order and granularity after extraction or during editing.

## Requirements
- Users can drag a step up or down to reorder it relative to other steps
- Users can move a step up or down via arrow buttons (accessible alternative to drag)
- Users can add a new empty step at any position in the list (not just at the end)
- Existing functionality (edit step text, delete step, add step at end) continues to work
- Step numbers update automatically when order changes

## Design

### Data Model
No changes — instructions remain `List<string>` in the API and `string[]` in the frontend. Order is determined by array index.

### API Changes
None. The existing `PUT /api/recipes/{id}` accepts `instructions` as an ordered array. The frontend just needs to send them in the new order.

### UI Changes

#### RecipeForm.tsx — instruction step controls
Each step row gets two additional controls:
- **Move up** button (↑) — disabled on the first step
- **Move down** button (↓) — disabled on the last step
- **Add step below** button (+) — inserts a new empty step immediately after this step

The existing "add step" button at the bottom of the list remains as a convenience shortcut for appending.

Drag-and-drop is **out of scope** for this iteration (arrow buttons are sufficient and more accessible).

## Out of Scope
- Drag-and-drop reordering
- Splitting a single step into two steps
- Merging two steps into one
- Reordering ingredients

## Open Questions
- None

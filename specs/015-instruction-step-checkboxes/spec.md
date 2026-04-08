# Feature: Instruction Step Checkboxes

## Summary
Allow users to check off individual instruction steps as they cook, so they can track their progress through a recipe.

## Motivation
When following a recipe, it's easy to lose your place. Checking off completed steps gives visual feedback and helps users stay oriented mid-cook.

## Requirements
- Each instruction step has a clickable checkbox
- Checking a step visually marks it as done (strikethrough text + muted color + checked checkbox)
- State is purely client-side (no persistence to backend)
- State resets when the page is refreshed or navigated away
- Works for both flat `instructionSteps` and sectioned `instructionSections` layouts
- A "Reset" button clears all checked steps

## Design

### Data Model
No backend changes. State lives in a `Set<number>` (global step index) in React component state.

### API Changes
None.

### UI Changes
- Each instruction `<li>` gets a checkbox on the left (similar to ingredient checkboxes)
- Checked step: text gets `line-through` + `text-gray-400`, number bubble gets muted style
- "Nullstill trinn" (Reset steps) button appears at the top of the instructions panel when at least one step is checked
- Clicking anywhere on a step row (text or checkbox) toggles it

## Out of Scope
- Persisting checked state to localStorage or backend
- Per-ingredient checked state changes (already has uncontrolled checkboxes — leave as-is)

## Open Questions
- None

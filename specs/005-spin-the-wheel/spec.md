# Feature: Spin the Wheel — Random Recipe Selector

## Summary
A "Spin the Wheel" feature that lets users randomly select a recipe by spinning an animated wheel. The selected recipe is revealed after the spin animation completes, and the user can navigate directly to it.

## Motivation
When users can't decide what to cook, they need a fun, engaging way to get a random suggestion from their recipe collection. A spinning wheel adds delight and gamification to recipe discovery.

## Requirements

- The wheel is accessible from the home page (recipes list) via a prominent button or link.
- The wheel is populated with all available recipes (from the API or mock data).
- Clicking "Spin" triggers an animation that spins the wheel and lands on a random recipe.
- After the spin completes, the selected recipe is highlighted and displayed (name + optional description).
- The user can navigate to the full recipe detail page from the result.
- The user can spin again without leaving the page.
- If there are no recipes, a friendly empty state is shown.
- Minimum 2 recipes required to spin; show a message if fewer than 2 exist.

## Design

### Data Model
No new data model. Uses existing `Recipe` type: `{ id, title, description }`.

### API Changes
None. Uses the existing `GET /api/recipes` endpoint (or mock data) via the existing `recipeService.getAllRecipes()`.

### UI Changes

#### New Page: `/spin`
- Route: `frontend/src/app/spin/page.tsx` (server wrapper) + `client.tsx` (client component)
- Canvas- or CSS-based spinning wheel rendering recipe names as segments
- "Spin!" button triggers the animation
- Result overlay/card shown after spin with recipe title, description, and a "View Recipe" link
- "Spin Again" button resets to spinning state
- Back link to home page

#### Home Page Addition
- Add a "Spin the Wheel 🎡" button/link on the home page (`/`) linking to `/spin`

### Wheel Implementation
- Pure CSS + React state (no canvas): divide the wheel into equal segments, rotate with a CSS transition on a `transform: rotate(deg)` value
- Number of segments = number of recipes (capped at a reasonable max of 20 for readability, showing the first 20 if more exist)
- Each segment gets a distinct color from a predefined palette
- Spin duration: ~3–4 seconds with an ease-out cubic-bezier
- Landing is determined by a random angle computed before the animation starts

## Out of Scope
- Saving spin history
- Filtering recipes before spinning (e.g., by ingredient or difficulty)
- Mobile-specific gesture support (swipe to spin)
- Backend changes

## Open Questions
- None — pure frontend feature using existing API.

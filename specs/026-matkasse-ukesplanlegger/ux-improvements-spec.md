# Feature: Matkasse UX Improvements

## Summary
Four UX improvements to the matkasse/ukesplanlegger integration: drag-and-drop to move meals between calendar days, drag-and-drop to add matkasse recipes (replacing the + button), week highlighting in the calendar when a matkasse week is selected, and displaying dates alongside the week number in the matkasse week selector.

## Motivation
The current matkasse flow requires clicking a + button to add recipes and provides no visual feedback between the matkasse week selector and the calendar. Moving meals between days is not possible at all. These changes bring matkasse recipes to parity with regular recipes and improve spatial awareness between the sidebar and calendar.

## Requirements

### 1. Move meals between calendar days (drag-and-drop)
- Any meal entry in a DayCell must be draggable to another DayCell
- Dragging a meal to a new day removes it from the old day and places it on the new day
- Works for both regular recipes and matkasse recipes
- Visual drag state on the entry being dragged (opacity, cursor)
- Drop target highlight (same green style as existing recipe drag-over)
- Should NOT call createMealPlan + deleteMealPlan if dropped on the same day

### 2. Matkasse recipes: drag-and-drop to calendar (remove + button)
- Each `MatkasseRecipeCard` must be draggable (set `draggable`, `onDragStart`)
- On drag start: set `dataTransfer` with `matkasseRecipeId` (distinct key from `recipeId`)
- `WeekCalendar`/`DayCell` drop handler reads `matkasseRecipeId` and calls a new `onDropMatkasse` callback
- `UkesplanleggerClient` wires up `onDropMatkasse` → `handleMatkasseAdd`
- The `+` button on `MatkasseRecipeCard` is removed; drag is the only add mechanism
- Keep the "Legg til i uke" bulk button in the sidebar header

### 3. Highlight selected matkasse week in calendar
- When the matkasse sidebar is on the "matkasse" tab, the week shown in the matkasse week selector should have all its days highlighted in the calendar
- `MatkassePanelSidebar` exposes its `weekMonday` via a callback prop `onWeekChange(monday: Date)`
- `UkesplanleggerClient` passes the highlighted week's dates to `WeekCalendar` via the existing `highlightedDays: Set<string>` prop (currently always `new Set()`)
- Highlighting only active when `sidebarTab === "matkasse"`; clearing when switching away

### 4. Week selector: show dates in parentheses
- The week label in `MatkassePanelSidebar` currently shows e.g. `1 jan – 7 jan`
- Change to format: `Uke 17 (1 jan – 7 jan)`
- Requires computing ISO week number (same logic as in `WeekCalendar.tsx`)

## Design

### Data Model
No changes.

### API Changes
None — drag-to-move uses existing delete + create endpoints.

### UI Changes

#### MatkasseRecipeCard.tsx
- Add `draggable` attribute and `onDragStart` handler
- Set `dataTransfer.setData("matkasseRecipeId", String(recipe.id))`
- Remove + button
- Visual: `cursor-grab active:cursor-grabbing`, opacity 70% while dragging

#### MatkassePanelSidebar.tsx
- Add `onWeekChange?: (monday: Date) => void` prop
- Call `onWeekChange(weekMonday)` whenever `weekMonday` changes (useEffect)
- Update `formatWeekLabel()` to include week number: `Uke N (d mmm – d mmm)`

#### WeekCalendar.tsx
- Update `handleDrop` to also read `matkasseRecipeId` and call a new `onDropMatkasse(date, matkasseRecipeId)` prop
- Add `onDropMatkasse: (date: Date, matkasseRecipeId: number) => void` to `WeekCalendarProps`

#### DayCell.tsx
- Each meal entry `div` gets `draggable`, `onDragStart` sets `dataTransfer.setData("movePlanId", String(plan.id))`
- Visual dragging state: `opacity-50` on the dragged entry

#### WeekCalendar.tsx (move between days)
- `handleDrop` reads `movePlanId` first; if present, calls `onMoveEntry(planId, newDate)`
- Add `onMoveEntry: (planId: number, date: Date) => void` to props

#### UkesplanleggerClient.tsx
- Wire `onDropMatkasse` → `handleMatkasseAdd`
- Add `handleMoveEntry(planId, date)`: delete + create on new date
- Pass `highlightedDays` from matkasse week state when tab is "matkasse"
- Pass `onWeekChange` to `MatkassePanelSidebar`, update `highlightedWeekMonday` state

## Out of Scope
- Mobile drag-and-drop (touch events)
- Reordering multiple entries within the same day
- Undo/redo for moves

## Open Questions
- None — all decisions resolved.

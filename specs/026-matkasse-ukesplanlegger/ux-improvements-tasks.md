# Tasks: Matkasse UX Improvements

## Tasks

- [ ] Task 1: Week selector — show "Uke N (d mmm – d mmm)" label and expose onWeekChange prop
  - Update `formatWeekLabel()` in `MatkassePanelSidebar.tsx` to include ISO week number
  - Add `onWeekChange?: (monday: Date) => void` prop; call it in a `useEffect` on `weekMonday`
  - Verify: `npm run lint && npx tsc --noEmit`

- [ ] Task 2: Highlight selected matkasse week in calendar
  - Add `highlightedWeekMonday` state to `UkesplanleggerClient.tsx`
  - Pass `onWeekChange` to `MatkassePanelSidebar`; set state; clear when tab switches to "oppskrifter"
  - Compute `highlightedDays` Set from `highlightedWeekMonday` (7 days Mon–Sun) when `sidebarTab === "matkasse"`
  - Pass to `WeekCalendar` (replaces the hardcoded `new Set()`)
  - Verify: `npm run lint && npx tsc --noEmit && npm run build`

- [ ] Task 3: Matkasse drag-to-calendar — MatkasseRecipeCard draggable, remove + button
  - Add `draggable`, `onDragStart` (sets `matkasseRecipeId`), `cursor-grab` styles to `MatkasseRecipeCard.tsx`
  - Remove the + button from `MatkasseRecipeCard.tsx` (and its `onAdd` prop)
  - Remove `onAdd` prop from `MatkasseRecipeCard` interface and all call sites in `MatkassePanelSidebar.tsx`
  - Verify: `npm run lint && npx tsc --noEmit`

- [ ] Task 4: Wire matkasse drop into WeekCalendar and UkesplanleggerClient
  - Add `onDropMatkasse: (date: Date, matkasseRecipeId: number) => void` prop to `WeekCalendar`
  - In `WeekCalendar.handleDrop`: read `matkasseRecipeId`; if present call `onDropMatkasse`; else existing `recipeId` path
  - Wire `onDropMatkasse` in `UkesplanleggerClient` → `handleMatkasseAdd`
  - Verify: `npm run lint && npx tsc --noEmit && npm run build`

- [ ] Task 5: Drag meal entries between calendar days
  - Add `draggable` + `onDragStart` (sets `movePlanId`) to each meal entry in `DayCell.tsx`
  - Add `onMoveEntry: (planId: number, date: Date) => void` prop to `WeekCalendarProps` and `DayCellProps`
  - In `WeekCalendar.handleDrop`: read `movePlanId` first; if present call `onMoveEntry(planId, date)`
  - Add `handleMoveEntry(planId, date)` in `UkesplanleggerClient`: delete old plan, create new plan on date, update `plans` state
  - Verify: `npm run lint && npx tsc --noEmit && npm run build`

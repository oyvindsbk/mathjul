# Feature: Ukesplanlegger (Weekly Dinner Planner)

## Summary
A weekly dinner planner where users can view a calendar, select a week, and plan dinners for each day — either manually or by requesting an AI-generated plan. Each day cell shows the planned dinner and allows adding/editing/removing meals.

## Motivation
Users want to plan their weekly dinners in advance. Having a structured planner that ties into their existing recipe library makes meal planning easy and reduces daily decision fatigue.

## Requirements

### Calendar View
- Display a monthly calendar showing all weeks
- Highlight the current week
- Each week row has a right-click context menu with two options:
  1. **Planlegg uke for meg** — AI generates a dinner plan for the entire week using recipes from the library
  2. **Planlegg manuelt** — Highlights all 7 days in the week for manual editing
- Clicking a specific day cell opens a dialog/modal to assign a dinner recipe for that date

### Day Cell
- Shows the recipe title if a dinner is planned, otherwise shows an empty/placeholder state
- Clicking opens a recipe picker modal (searchable list of user's recipes)
- Ability to remove/clear a planned dinner

### AI Planning
- Sends the selected week's date range to the backend
- Backend selects 7 recipes (one per day Mon–Sun) from the user's recipe library
- Returns a day-to-recipe mapping
- AI plan respects variety (avoids repeating the same recipe)
- Results are saved and displayed in the calendar immediately

### Data Persistence
- Meal plans are stored per user, per date
- One recipe per day (dinner only)
- Plans persist across sessions

### Navigation
- New "Ukesplanlegger" menu item in Sidebar
- Route: `/ukesplanlegger`
- Protected route (requires auth)

## Design

### Data Model

**New entity: `MealPlan`**
```
Id          int (PK, auto)
UserEmail   string (FK to user, required)
Date        DateTime (the specific dinner date, date only)
RecipeId    int (FK to Recipe)
CreatedAt   DateTime
UpdatedAt   DateTime

Unique constraint: (UserEmail, Date)
```

### API Changes

| Method | Endpoint                            | Description                                      |
|--------|-------------------------------------|--------------------------------------------------|
| GET    | /api/mealplans?from=&to=            | Get meal plans for a date range (current user)   |
| PUT    | /api/mealplans/{date}               | Set or update a meal plan for a specific date    |
| DELETE | /api/mealplans/{date}               | Remove a meal plan for a specific date           |
| POST   | /api/mealplans/ai-plan              | Generate AI dinner plan for a week               |

**PUT /api/mealplans/{date}** body:
```json
{ "recipeId": 42 }
```

**POST /api/mealplans/ai-plan** body:
```json
{ "weekStart": "2026-04-14" }
```
Returns: array of `{ date, recipeId, recipe }` for all 7 days.

### UI Changes

**New pages/components:**
- `/ukesplanlegger/page.tsx` — main planner page (server wrapper)
- `/ukesplanlegger/UkesplanleggerClient.tsx` — client component with calendar
- `WeekCalendar.tsx` — calendar grid component (month view, week rows)
- `DayCell.tsx` — individual day cell showing planned recipe or empty state
- `WeekContextMenu.tsx` — right-click context menu per week row
- `RecipePickerModal.tsx` — searchable modal to pick a recipe for a day
- `mealplan.service.ts` — frontend API service for meal plans

## Out of Scope
- Planning breakfast/lunch (dinner only in v1)
- Shopping list generation from the plan
- Shared/group meal plans (personal only)
- Recurring plans or templates
- Drag-and-drop reordering

## Open Questions
- None — ready to implement

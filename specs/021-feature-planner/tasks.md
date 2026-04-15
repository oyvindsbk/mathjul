# Tasks: Feature Planner (Scrum Board)

## Tasks

- [ ] Task 1: Backend — Data model + EF migration
  - Add `FeatureColumn` and `FeatureCard` entities to `AppDbContext`
  - Create and apply EF migration
  - Seed default columns: New Feature, Planned Feature, In Progress, Done
  - Verify: `dotnet build` passes

- [ ] Task 2: Backend — CRUD API for columns and cards
  - Add `FeaturePlannerController` with endpoints:
    - `GET /api/feature-board` (board + columns + cards)
    - `POST/PUT/DELETE /api/feature-board/columns/{id}`
    - `POST/PUT/DELETE /api/feature-board/cards/{id}`
    - `POST /api/feature-board/cards/{id}/move`
  - Verify: `dotnet build` + `dotnet test` pass

- [ ] Task 3: Backend — AI PRD generation endpoint
  - Add `POST /api/feature-board/ai/generate` endpoint
  - Accepts `{ prompt: string, model?: string }`
  - Calls Azure AI Foundry to fill in PRD template fields
  - Returns `{ title, summary, motivation, requirements, stacksFrontend, stacksBackend, stacksInfrastructure, dataModel, apiSketch, uiSketch, outOfScope, openQuestions }`
  - System prompt includes full codebase architecture context so the model can reason technically, not just reformat text
  - Verify: `dotnet build` + `dotnet test` pass

- [ ] Task 4: Frontend — API service + types
  - Add `FeaturePlannerService` in `frontend/src/lib/services/feature-planner.service.ts`
  - Define TypeScript types for `FeatureColumn`, `FeatureCard`, `FeatureBoard`
  - Verify: `npx tsc --noEmit` passes

- [ ] Task 5: Frontend — Kanban board page skeleton
  - Add `/feature-planner` page (`app/feature-planner/page.tsx` + `client.tsx`)
  - Render columns with cards (no drag-and-drop yet)
  - Add sidebar nav entry for Feature Planner
  - Verify: lint + typecheck + build pass

- [ ] Task 6: Frontend — Drag-and-drop between columns
  - Install `@dnd-kit/core` and `@dnd-kit/sortable`
  - Wrap board in `DndContext`, implement `onDragEnd` to call move API
  - Cards draggable within and between columns
  - Verify: lint + typecheck + build pass

- [ ] Task 7: Frontend — New card modal (manual mode)
  - Modal with form: title, summary, motivation, requirements, out of scope, open questions
  - On save: POST to API → card appears in New Feature column
  - Verify: lint + typecheck + build pass

- [ ] Task 8: Frontend — New card modal (AI mode)
  - Add AI tab to new card modal
  - Textarea for free-text prompt + model selector dropdown
  - "Generate" button calls `/api/feature-board/ai/generate` → populates form fields
  - Fields remain editable before saving
  - Verify: lint + typecheck + build pass

- [ ] Task 9: Frontend — Card detail modal + copy to clipboard
  - Clicking a card opens a detail modal with full PRD content (rendered markdown)
  - "Copy to clipboard" button formats content as markdown and copies it
  - Edit button opens the write form pre-populated
  - Delete button with confirmation
  - Verify: lint + typecheck + build pass

- [ ] Task 10: Frontend — Column management UI
  - Column header kebab menu: rename, delete, add column
  - Rename: inline edit or modal
  - Delete: confirm dialog (moves cards to first column)
  - Add column: prompt for name, appended at end
  - Verify: lint + typecheck + build pass

- [ ] Task 11: E2E tests
  - Playwright tests: create a card manually, verify it appears on board
  - Create a card with AI assist (mock AI endpoint in test)
  - Move a card between columns
  - Copy card content to clipboard
  - Verify: `npx playwright test` passes

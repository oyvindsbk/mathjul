# Tasks: Notater – projects, colors and a OneNote-style sidebar

## Tasks

- [x] Task 1: Hand cursor and header cleanup (R1, R5). Add the `cursor: pointer` rule to `frontend-notes/src/app/globals.css` (`@layer base`, enabled controls only). Remove the "Denne uka" link from `AppHeader`. Verify: lint, tsc, build in `frontend-notes`.

- [ ] Task 2: Rename context → project end to end (R2). Backend: `Features/Contexts` → `Features/Projects` (`Project`, `ProjectsController` at `api/projects`, `ProjectDto`, requests), `Item.ProjectId`, `DayService`, `ImportService`, `NotesDbContext` (table `Projects`). Add migration `RenameContextsToProjects` and check it only renames. Update `NotesApi.Tests`. Frontend: `types.ts` (`Project`, `projectId`), `api.ts`, `ProjectsManager`, `/prosjekter` page, `/kontekster` → permanent redirect, all user-facing text, `DayEditor`/`ItemRow`/`WeekView`/`DayPage`. Update `tests/e2e/notater.spec.ts`. Verify: `dotnet test` in `backend/NotesApi.Tests`, lint/tsc/build in `frontend-notes`.

- [ ] Task 3: Project colors (R3). Backend: `Project.Color`, `ProjectColors` palette + validation, auto-assign next unused color on create, `Color`/`ClearColor` on PATCH, migration `ProjectColor` that also assigns colors to existing projects by `SortOrder`. Tests for validation, auto-assign and clear. Frontend: `--project-*` variables (light + dark), `Project.color` type, swatch + palette popover in `ProjectsManager`, colored left border + dot on project groups in `DayEditor`. Verify: `dotnet test`, lint/tsc/build.

- [ ] Task 4: Sidebar shell (R4 layout). `NotesShell` client component with header, sidebar slot and content; mobile ☰ overlay (closes on navigation and Escape); refresh context. Move `dag`, `uke`, `prosjekter` pages into it (e.g. a route group layout). Sidebar shows "I dag" and the week list (collapsed, titles only). Verify: lint/tsc/build.

- [ ] Task 5: Sidebar content (R4 behaviour). Lazy-load days per expanded week via `api.week`, current week and viewed day's week expanded, day rows with open count, today marker, `aria-current` on the viewed day, dimmed empty days, weekend rule, "Eldre uker" (+8), week title links to `/uke/{week}`, refresh after `DayEditor` changes. Verify: lint/tsc/build.

- [ ] Task 6: E2E coverage and final check. Playwright tests in `frontend-notes/tests/e2e/`: create project and pick color (color visible on day group), `/kontekster` redirect, sidebar navigates to a day and highlights it, "Eldre uker" adds weeks, header has no "Denne uka". Run full checks for both stacks, run the migration against local Aspire SQL with existing data, review agents, manual check in Chrome.

# Feature: Notater – projects, colors and a OneNote-style sidebar

## Summary
Four usability improvements to Notater: a hand cursor on everything clickable, "kontekster" renamed to "prosjekter" with a OneNote-style color per project, a left sidebar for jumping between weeks and days, and one fewer duplicate header link.

## Motivation
- Tailwind v4 resets `button` to `cursor: default`, so buttons, the day toggles, the kind toggle, ✕ and "+ Ny" don't look clickable.
- "Kontekst" is the wrong word for the user; the groups are projects. OneNote gave every section a color, which made a page easy to scan. Notater has no colors.
- Getting to a day means going week by week with ← Forrige / Neste →. OneNote had a page list on the left to click straight to a day.
- The header links "Notater" and "Denne uka" both go to `/`.

## Requirements

### R1 Hand cursor
- Every enabled clickable element shows `cursor: pointer`: `a`, `button`, `select`, checkboxes, `[role="button"]`, `summary`, `label[for]`.
- Disabled buttons and controls keep the default cursor (`not-allowed` is not needed).
- Done once in `globals.css`, not per component.

### R2 Context → project
- Everything a user sees says "prosjekt"/"prosjekter": header link "Prosjekter", page `/prosjekter` (title "Prosjekter"), placeholder "Nytt prosjekt", the item's group dropdown (aria-label "Prosjekt"), "(arkivert)" suffix unchanged.
- `/kontekster` redirects permanently to `/prosjekter` (bookmarks).
- The code follows: entity `Project` (table `notes.Projects`), `Item.ProjectId` (column renamed), API `api/projects` (list, create, patch, reorder — same shapes), `projectId` in item DTOs and requests (`AddItemRequest`, `MoveItemRequest`), frontend type `Project`, `ProjectsManager`, `api.projects()` etc.
- The migration only renames (table, column, FK, index). No data is lost; existing items keep their group.
- "Dagens TODOs" (no project) stays as it is.

### R3 Project colors
- A project has an optional color from a fixed palette of 10, modelled on OneNote's section colors: `blue`, `yellow`, `green`, `red`, `purple`, `cyan`, `orange`, `magenta`, `teal`, `gray`.
- Stored as the key (`Color`, `nvarchar(20)`, nullable). `null` = no color (shown neutral). The API rejects keys outside the palette with 400.
- New projects get the next palette color not yet used by an active project (all used → cycle), so colors appear without effort. Existing projects get colors assigned in the migration by `SortOrder` (blue, yellow, green, …).
- `/prosjekter`: each row has a color swatch; clicking it opens a small palette (10 swatches + "Ingen farge"). Keyboard reachable, each swatch has an aria-label with the color's Norwegian name.
- In a day, a project's group shows its color as a 4px left border on the section and a colored dot before the heading. Text stays the normal foreground color (readability).
- The item's project dropdown is unchanged (native `<option>` can't be colored reliably).
- Each key maps to a light and a dark value in `globals.css` (`--project-blue` etc.), chosen to be visible on both `--surface` backgrounds.

### R4 Sidebar
- Layout: a fixed-width (≈ 15rem) left sidebar next to the content on screens ≥ `md`. Below `md` it is hidden behind a "☰" button in the header that opens it as an overlay; choosing a day closes it.
- Content, top to bottom:
  1. "I dag" — links to today's day page.
  2. Weeks, newest first, starting with the current week. Each week is a collapsible row "Uke 48 · 23.–29. nov". The current week and the week of the day being viewed start expanded.
  3. Under an expanded week: its days (Mon–Fri always, Sat/Sun only when they have content or are today), each as "Man 23." with a small summary (number of open to-dos) and empty days dimmed. Today is marked; the day being viewed is highlighted (`aria-current="page"`).
  4. "Eldre uker" at the bottom loads 8 more weeks.
- Initially lists the current week and the 7 before it. A week's days are fetched (existing `GET api/weeks/{week}`) only when it is expanded; nothing new in the backend.
- Clicking a week's title (not the chevron) opens that week's page `/uke/{week}`.
- After an edit in a day editor, the sidebar's counts for that week refresh (same way `WeekView` refreshes today).
- Login page has no sidebar.

### R5 Header
- Remove the "Denne uka" link. "Notater" stays as the home link (`/` → this week).
- Header: "Notater", "Prosjekter", (mobile: ☰), "Logg ut".

## Design

### Data Model
```
notes.Projects (renamed from notes.Contexts)
  Id, Name, SortOrder, IsArchived, Color nvarchar(20) NULL   -- new
notes.Items.ContextId → ProjectId
```

### API Changes
| Before | After |
|---|---|
| `GET/POST api/contexts`, `PATCH api/contexts/{id}`, `POST api/contexts/reorder` | same under `api/projects` |
| `ContextDto(Id, Name, SortOrder, IsArchived)` | `ProjectDto(Id, Name, SortOrder, IsArchived, Color)` |
| `UpdateContextRequest(Name?, IsArchived?)` | `UpdateProjectRequest(Name?, IsArchived?, Color?, ClearColor?)` |
| `ItemDto.ContextId`, `AddItemRequest.ContextId`, `MoveItemRequest.ContextId` | `ProjectId` |

`ClearColor: true` sets color to null (a plain `Color: null` can't be told apart from "not sent"). Unknown color → 400 `{ error }`.

The old `api/contexts` routes are removed; frontend and backend deploy together via `deploy-notes.yml`.

### UI Changes
- `globals.css`: cursor rule, `--project-*` palette variables (light + dark).
- `AppHeader`: drop "Denne uka", "Kontekster" → "Prosjekter", ☰ button on mobile.
- New `NotesShell` (client) wrapping header + sidebar + page; pages under `dag`, `uke`, `prosjekter` render inside it. A small React context lets a `DayEditor` tell the sidebar to refresh a week.
- New `Sidebar` component.
- `ContextsManager` → `ProjectsManager` with color swatch/palette.
- `DayEditor`: colored left border + dot on project groups.

## Out of Scope
- Colors on the items themselves or on the item dropdown.
- Searching notes from the sidebar.
- Drag-and-drop in the sidebar.
- Free hex colors.

## Open Questions
None — resolved with the user on 2026-11-25: fixed OneNote-style palette, weeks → days tree, drop the "Denne uka" link (keep the week view).

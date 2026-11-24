# Feature: Notater — daily work log that replaces OneNote

## Summary
A separate, single-user app for a single user's daily work log: a page per day, to-dos grouped by context, and unfinished to-dos carried over to the next day. It runs on mathjul's Azure infrastructure and in the same `RecipeDb` database, but in its own `notes` schema, with its own API, frontend and sign-in allowlist. The OneNote history (2017–2026) is imported in v1, so the switch from OneNote loses nothing.

## Motivation
The work log has lived in OneNote since 2017: one section per week ("Uke 47"), one page per day ("Mandag 16. november"), a "Dagens TODOs" list, and to-dos grouped by context (Jobb, Prosjekt B, Prosjekt C, Hobby). Each morning, unfinished to-dos are copied to the new day by hand. OneNote is being dropped, and an app can do the carry-over itself.

## Current state (verified 2026-11-24)

| Piece | Status |
|---|---|
| OneNote export | 324 files in the local OneNote export folder: `2017`–`2026` hold weekly sections (`Uke N.one`), and `Fag`, `Jobb`, `Hobby` and `Notater` hold topic sections |
| Text in `.one` files | Older files store text as UTF-16, and 2025–2026 files store it as 8-bit text. A raw string scan recovers the text but not page boundaries, indentation or checkbox state |
| SQL | Azure SQL `RecipeDb` (Basic). The backend connects with managed identity (`AzureAdTokenInterceptor`). The connection string is in Key Vault as `ConnectionStrings--RecipeDb` |
| Container Apps | The backend and frontend each create their own environment (`*-env`). The backend's managed identity has a database user |
| Local dev | Aspire runs SQL Edge with database `recipedb`. **RecipeApi calls `EnsureDeletedAsync` on every local start** |
| Auth | Google OAuth goes through Next.js routes to `/api/auth/google-token`, which issues a 7-day JWT (`Jwt:Issuer` RecipeApi, `Jwt:Audience` RecipeFrontend). The `approved-users` Key Vault secret is the whitelist |

## Requirements

### Access
- R1: Only allowlisted emails can sign in. The allowlist is a separate list (`Notes:AllowedEmails`, Key Vault secret `Notes--AllowedEmails`), not mathjul's `approved-users`, and it starts out holding only the owner's email.
- R2: Google sign-in in production and the fake dev login locally, as in mathjul. Notes JWTs use audience `NotesFrontend`, so a recipe-app token is rejected by NotesApi and the other way round.

### Days and to-dos
- R3: A day page shows one date. Items are grouped under headings: **Dagens TODOs** (items with no context) first, then one heading per context in context order.
- R4: An item is a **to-do** (with a checkbox) or a **note** (a plain line). Both have text and an indent level (0–3), and keep their order within their heading.
- R5: The user can add, edit, delete, reorder and indent items, tick to-dos done or undone, and move an item to another context.
- R6: Keyboard-first editing, like OneNote:
  - **Enter** adds a new item below.
  - **Tab** and **Shift+Tab** indent and outdent.
  - **Ctrl+Enter** toggles done.
  - **Backspace** on an empty item deletes it.
- R7: Contexts can be created, renamed, reordered and archived. An archived context gets no new items, but its history still shows.
- R8: A week view (`/uke/2026-W48`) lists Monday–Friday, plus Saturday and Sunday when they have items. Today is expanded and the other days are collapsed with a count of open and done items. The start page redirects to the current week.

### Carry-over
- R9: The first time today's page is opened (Europe/Oslo date), every **open** to-do from the most recent earlier day that has items is copied into today. Each copy keeps its context, text, indent and order. The copy links to the original (`CarriedFromItemId`), and the original's state becomes **Carried**.
- R10: Carry-over runs once per day, when the day is created. Opening past or future dates never creates or carries anything. If days are skipped, the most recent earlier day is used.
- R11: A carried item shows a quiet hint of where it came from ("fra fredag 20.11"). A carried original is shown greyed out on its own day and can't be ticked there.

### OneNote import
- R12: Every weekly section in `2017`–`2026` is imported. Each dated page becomes a day. The date is resolved from the title's weekday, day and month together with the section's week number, as in `research.md` §2.
  - **Undated pages** (meeting notes and similar) are attached to a day in their week, under a note line holding the page title.
  - **Duplicate dates** are merged, not dropped.
  - **Empty pages** are skipped and listed in a report.
- R13: Paragraph order and indentation are kept. OneNote to-do tags become to-dos, and all other paragraphs become notes. Ticked to-dos become Done. Unticked to-dos become **Carried**, except on the last imported day, where they stay Open (`research.md` §1). Contexts are created from the context table and the headings (`Jobb:`, `Oppgaver <prosjekt>:`), and a heading sets the context for the lines under it.
- R14: The import is idempotent per date: it replaces that day's imported items (`Source = OneNote`) and leaves manually created items alone.
- R15: The importer runs locally. The exported JSON holds work notes, so it is written outside the repo and never committed.
- R16: After the import, open to-dos on the most recent imported day are carried into today by R9. The switch from OneNote happens through the normal mechanism.

## Design

### Data model (schema `notes`, migrations history table `notes.__EFMigrationsHistory`)

| Table | Columns |
|---|---|
| `Contexts` | `Id`, `Name` (≤60, unique), `SortOrder`, `IsArchived` |
| `Days` | `Id`, `Date` (`date`, unique), `CreatedAt` |
| `Items` | `Id`, `DayId` → Days, `ContextId?` → Contexts, `Kind` (Todo/Note), `Text` (≤4000), `State` (Open/Done/Carried; to-dos only), `Indent` (0–3), `SortOrder`, `CarriedFromItemId?` → Items, `CompletedAt?`, `Source` (Manual/OneNote), `CreatedAt`, `UpdatedAt` |

The model is single-user, so there is no owner column (see Out of Scope).

### API (NotesApi, ASP.NET Core 10)

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/google-token`, `/api/auth/dev-token` | Issue a JWT for an allowlisted email |
| GET | `/api/weeks/{isoWeek}` | Day summaries for a week (`2026-W48`) |
| GET | `/api/days/{date}` | The day with its items. Creates the day and runs carry-over only when `date` is today |
| POST | `/api/days/{date}/items` | Add an item |
| PATCH | `/api/items/{id}` | Update text, kind, state, context, indent or order |
| DELETE | `/api/items/{id}` | Delete an item |
| GET/POST/PATCH | `/api/contexts[/{id}]` | List, create and update contexts |
| POST | `/api/import/onenote` | Batch import of days (R14) |

### UI (frontend-notes, Next.js 15, Norwegian text)
- `/login` works as in mathjul.
- `/` redirects to `/uke/<current week>`.
- `/uke/[week]` is the week view (R8), with previous/next week links and an "I dag" link.
- `/dag/[date]` shows a single day full-width, the same component as the expanded day.
- `/kontekster` is where contexts are managed.

## Out of Scope
- Meetings as their own entity, and free-form markdown notes. Imported meeting lines become notes.
- Topic sections (`Fag`, `Jobb`, `Hobby`, `Notater`): neither imported nor modelled.
- Search, and auto-linking Jira keys and PR URLs.
- Images and attachments from OneNote.
- Multiple users or sharing.
- Offline editing.

## Open Questions
- ~~Q1: Custom domain~~. Resolved (2026-11-24): use the generated Container Apps hostname for now. A domain can be added later through `NOTES_CUSTOM_DOMAIN` / `NOTES_CUSTOM_DOMAIN_CERT`, and the Google redirect URI must then be updated to match.
- ~~Q2: Rust for the importer~~. Resolved: approved and installed. `onenote_parser` exports 307 of 309 sections with full structure (`research.md`).

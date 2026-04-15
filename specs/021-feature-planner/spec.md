# Feature: Feature Planner (Scrum Board)

## Summary
A Kanban-style scrum board for planning and tracking application features. Features can be created manually or via AI assistance that fills in a simple PRD template from a short text prompt.

## Motivation
The team needs a lightweight way to track feature ideas and their development status without leaving the app. Cards store structured feature descriptions (PRD-style) that can be copied directly into VS Code for implementation.

## Requirements

### Board
- Display features as cards organized into configurable columns
- Default columns (in order): **New Feature**, **Planned Feature**, **In Progress**, **Done**
- Columns can be renamed, reordered, added, and deleted by the user
- Column configuration is persisted (backend-stored per user or globally)
- Cards can be dragged between columns (or moved via a dropdown/button as fallback)

### Feature Cards
- Each card displays: title, short summary, and column label
- Cards are created in the **New Feature** column by default
- Cards can be opened in a modal/drawer showing full PRD content
- Full content can be copied to clipboard with a single button click (for pasting into VS Code)
- Cards can be deleted
- Cards can be edited after creation

### Feature Creation
- **Manual mode**: User fills in the PRD template fields directly in a form
- **AI mode**: User writes a free-text description; AI fills in the PRD template fields
  - AI model: existing Azure AI Foundry integration (`Azure.AI.Inference`) — no new SDK needed
  - User can select which AI model to use (same models already configured in the app)
  - AI response is shown in the form for review/editing before saving

### PRD Template (fields)

The template has two tiers. Non-technical users only need to fill in the **core fields**. The **technical fields** are hidden behind a "Show technical details" toggle — they are populated by AI or filled in by a developer before implementation.

**Core fields (always visible):**
```
Title:            Short feature name
Summary:          1-2 sentence description of what the feature does
Motivation:       Why this feature is needed / user problem it solves
Requirements:     What the feature must do (plain language, bullet list)
Out of Scope:     Things explicitly not included
Open Questions:   Things that need to be decided before building
```

**Technical fields (collapsed by default, toggle to expand):**
```
Stacks Affected:  Checkboxes: Frontend / Backend / Infrastructure
Data Model:       New or modified data (plain language or entity sketch)
API Sketch:       New or modified endpoints
UI Sketch:        New pages, components, or key interactions
```

**Language in the form:** Labels and placeholders use plain English, not developer jargon. "Requirements" not "Acceptance Criteria". "What data needs to be stored?" not "Data Model". "What screens or pages are needed?" not "UI Sketch". The technical section heading is "Technical notes (for developers)" with a note that this can be left blank.

### AI generation — planning prompt strategy

The AI endpoint does more than reformat text. It acts as a first-pass product thinker and tech lead combined. The system prompt instructs it to:
- Write the core fields in plain, non-technical language accessible to anyone
- Fill in the technical fields based on the app's architecture (Next.js 15 App Router, ASP.NET Core 9 vertical slices, EF Core, Azure) — but only if it can make confident suggestions
- Identify genuine open questions (auth scope, data ownership, edge cases, UX decisions) — not generic placeholder questions
- Keep requirements focused on *what*, not *how*

A prompt like "I want to add a shopping list that generates from a meal plan" should produce:
- **Summary**: "Automatically create a shopping list from the meals planned for the week, so you know exactly what to buy."
- **Requirements**: Plain bullet points about what users can do
- **Technical notes** (collapsed): sketched `ShoppingList` entity, `POST /api/shopping-list/generate`, affected stacks checked
- **Open Questions**: "Should items be editable after generation?", "One list per week or per plan?"

## Design

### Data Model

**FeatureBoard** (global, single board for now)
- `Id` (int)
- `Columns` (ordered list of FeatureColumn)

**FeatureColumn**
- `Id` (int)
- `Name` (string)
- `SortOrder` (int)

**FeatureCard**
- `Id` (int)
- `ColumnId` (int, FK → FeatureColumn)
- `Title` (string)
- `Summary` (string)
- `Motivation` (string)
- `Requirements` (string — markdown bullet list)
- `StacksFrontend` (bool)
- `StacksBackend` (bool)
- `StacksInfrastructure` (bool)
- `DataModel` (string — markdown, nullable)
- `ApiSketch` (string — markdown, nullable)
- `UiSketch` (string — markdown, nullable)
- `OutOfScope` (string — markdown bullet list, nullable)
- `OpenQuestions` (string — markdown bullet list, nullable)
- `SortOrder` (int — position within column)
- `CreatedAt` (DateTimeOffset)
- `UpdatedAt` (DateTimeOffset)

### API Changes

```
GET    /api/feature-board                    — Get board with all columns and cards
POST   /api/feature-board/columns            — Add a column
PUT    /api/feature-board/columns/{id}       — Rename or reorder a column
DELETE /api/feature-board/columns/{id}       — Delete a column (cards moved to first column)
POST   /api/feature-board/cards              — Create a card
PUT    /api/feature-board/cards/{id}         — Update a card
DELETE /api/feature-board/cards/{id}         — Delete a card
POST   /api/feature-board/cards/{id}/move    — Move a card to a different column
POST   /api/feature-board/ai/generate        — Generate PRD fields from a text prompt
```

### UI Changes

**New page:** `/feature-planner`
- Full-width Kanban board layout (horizontal scroll if columns overflow)
- Each column: header (name + card count) + scrollable card list + "Add card" button
- Column header has kebab menu: rename, delete, add column before/after
- **New Card modal**: tab between "Write yourself" and "AI-assisted"
  - Write tab: form with core fields always visible; "Technical notes (for developers)" section collapsed by default with a toggle to expand
  - AI tab: textarea for free-text prompt + "Generate" button → populates all fields for review → Save. Technical fields auto-expand if AI populated them.
  - All field labels and placeholders use plain language (e.g. "What should this feature do?" not "Summary")
- **Card detail modal**: read-only view of PRD content
  - Core fields always shown
  - Technical fields shown in a collapsible "Technical notes" section (collapsed by default if empty, expanded if populated)
  - "Copy to clipboard" button — copies full content as formatted markdown for VS Code
  - "Edit" button opens the write form pre-populated
  - "Delete" button with confirmation
- Drag-and-drop between columns (using `@dnd-kit/core`)

## Out of Scope
- Multi-user/per-user boards (single shared board for now)
- Real-time collaboration / websockets
- Card comments or attachments
- Sprint planning / velocity tracking
- Integration with GitHub issues

## Open Questions
- Should columns be per-user or shared globally? (Assume global/shared for now)
- Should drag-and-drop be required, or is a "Move to column" dropdown sufficient for v1? (Prefer dnd-kit but fallback is acceptable)
- Which AI models should appear in the model selector? (Use same list as existing recipe extraction, read from config)

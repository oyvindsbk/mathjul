# Implementation Plan: Feature Planner (Scrum Board)

## Approach

Build a full-stack Kanban feature planner following the existing vertical-slice pattern. Backend adds a new `FeaturePlanner` feature slice. Frontend adds a new `/feature-planner` page. AI generation reuses the existing Azure AI Foundry (`Azure.AI.Inference`) integration.

No new NuGet packages or npm packages beyond `@dnd-kit/core` (drag-and-drop) are required on the backend. The frontend will add `@dnd-kit/core` and `@dnd-kit/sortable`.

## Stacks Affected
- [x] Frontend (Next.js 15)
- [x] Backend (ASP.NET Core 9)
- [ ] Infrastructure (no Bicep changes needed)

## Key Decisions

- **Single shared board**: One board for the whole app (no per-user boards). Simpler data model, consistent with existing meal planner pattern.
- **Model: `gpt-4o`** via the existing `AzureOpenAIClient` (same SDK as `RecipeImageProcessor`). Configured via `AiFoundry:PrdModelName` (default `gpt-4o`). Phi-4 and gpt-4o-mini lack the reasoning depth needed for useful technical planning output.
- **Planning-aware system prompt**: The AI endpoint is not just a reformatter — the system prompt includes full architecture context (Next.js 15 App Router, ASP.NET Core 9 vertical slices, EF Core, Azure) and instructs the model to reason through stacks affected, data model, API shape, and UI components. A short prompt like "shopping list from meal plan" should produce a card with a sketched entity, endpoint, and real open questions.
- **Markdown storage**: PRD fields (requirements, out of scope, open questions) stored as markdown strings — no structured parsing needed. Easy to copy/paste into VS Code.
- **@dnd-kit**: Lightweight, accessible drag-and-drop. Used widely with Next.js App Router. No SSR issues if wrapped in a client component.
- **Copy to clipboard**: `navigator.clipboard.writeText()` called client-side. Content formatted as markdown when copied.
- **Model selector**: Read available model names from a config endpoint or hardcode the same list used for recipe extraction (from `appsettings`). Keep it simple — a static dropdown is fine for v1.

## Risks

- **Drag-and-drop SSR**: `@dnd-kit` requires `"use client"`. The entire board page will be a client component — acceptable since board data is user-interactive, not SEO content.
- **EF migration**: New tables require a new EF migration. Must be run before the feature works in dev/prod.
- **AI prompt quality**: PRD generation quality depends on prompt engineering. May need iteration. The form is always editable before saving so a bad AI response is recoverable.

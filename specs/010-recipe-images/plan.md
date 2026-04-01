# Implementation Plan: Recipe Images

## Approach
Build from the bottom up: infrastructure first, then backend data model + API, then frontend UI. Each layer builds on the previous.

## Stacks Affected
- [x] Frontend
- [x] Backend
- [x] Infrastructure

## Key Decisions

- **Managed Identity for blob access**: Backend uses Azure Managed Identity to write blobs — no storage account keys in configuration or Key Vault. `DefaultAzureCredential` works in both Aspire (local with Azure CLI login) and production (Container App identity).
- **Public read, authenticated write**: Blob container has public read so images can be served directly via URL without auth tokens. Writes go through the backend API which enforces JWT auth.
- **InstructionStep replaces Instructions string**: Migrating from newline-separated string to `List<InstructionStep>` (JSON column). EF Core migration splits existing data; no data loss.
- **Image endpoints are separate from recipe CRUD**: `PUT /api/recipes/{id}/main-image` etc. keep image uploads decoupled from recipe data updates, avoiding large multipart payloads in the main PUT.
- **AI dish extraction on upload**: The existing `RecipeImageProcessor` is extended to call the vision model a second time asking specifically "is there a dish photo here, and if so, return its bounding region or confirm it fills the frame." If confident, the image (or a crop) is stored as the main photo. Confidence threshold: AI must explicitly say yes.
- **stepIndex in image URLs**: Steps are zero-indexed. When steps are reordered, image URLs stay with the step text (they are stored in `InstructionStep.ImageUrl`, not derived from position). Blob path uses a UUID per image, not the step index, to avoid collisions on reorder.

## Risks
- **Migration risk**: Existing `Instructions` string data must be migrated cleanly. Mitigation: write and test migration script carefully; keep old column temporarily with a rename rather than drop.
- **Managed Identity local dev**: `DefaultAzureCredential` requires `az login` in local dev. Aspire won't auto-provision blob storage — developer must have an Azure Storage account or use Azurite. Mitigation: document setup; use `UseDevelopmentStorage=true` (Azurite) as fallback for local.
- **AI crop quality**: The AI may crop poorly or return the full image. Mitigation: if AI returns "full image is the dish," store as-is. If crop coordinates are returned, use ImageSharp to crop.

# Implementation Plan: Multi-Image Recipe Extraction

## Approach

Add a new `from-images` endpoint alongside the existing `from-image` endpoint. The backend change is minimal: extend `IRecipeImageProcessor` with a multi-image overload that constructs a single AI message with multiple image parts. On the frontend, swap the single-file state for a file array, update the drop zone to accept `multiple`, and replace the single preview with a thumbnail grid.

No database changes are needed — the response shape and save flow are unchanged.

## Stacks Affected

- [x] Frontend — upload page UI
- [x] Backend — new endpoint + processor method
- [ ] Infrastructure — no changes

## Key Decisions

- **New endpoint, keep old**: `POST /api/recipes/from-images` for multi-image; `from-image` stays untouched. Avoids risk of breaking existing callers and makes the multi-image path explicit.
- **Single AI message with multiple image parts**: All images sent as separate `ChatMessageContentPart.CreateImagePart(...)` entries in one user message. This lets the model reason across all images at once rather than doing multiple calls and merging results.
- **Unordered image prompt**: The system prompt for multi-image extraction explicitly tells the AI that images may arrive in any order and it should synthesize one coherent recipe from all of them combined — not follow image sequence. The user text part of the message reinforces this ("These images may be in any order...").
- **Dish photo from first positive**: Iterate images in order, run `TryExtractDishPhotoAsync` on each, use the first success. Avoids burning extra tokens on all images when one is clearly a dish photo.
- **Frontend state: `File[]` array**: Replace `selectedFile: File | null` with `selectedFiles: File[]`. Thumbnails are object URLs created on select, revoked on remove/reset.

## Risks

- **Token limit**: 5 large images could hit the model's token budget. Mitigation: each image is resized to ≤2048px before sending (existing `ResizeImageIfNeeded` reused), and `MaxOutputTokenCount` is already 4096.
- **Total request size**: 5×10 MB = 50 MB. Need `[RequestSizeLimit]` set to 50 MB on the new endpoint and Kestrel/IIS limits checked. Aspire local dev is fine; Azure Container Apps may need a config tweak (out of scope for this feature — document in spec).

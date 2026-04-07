# Feature: Image Cropping Before Upload

## Summary
Show a crop modal after the user selects a photo (main recipe photo or per-step photo) so they can trim the image to the desired region before it is uploaded. No new npm dependencies — implemented with the native Canvas API.

## Motivation
Photos taken on phones often include excess background. Letting users crop before upload keeps recipe images clean without needing a separate tool.

## Requirements

- After the user selects a file (via file picker or drag-drop), a full-screen crop modal appears before `onFileSelected` is called.
- The crop modal shows the full image with a draggable/resizable rectangular selection overlay.
- The user can:
  - Drag the selection box to reposition it.
  - Drag the four corner handles to resize it.
  - Click **Crop** to confirm — produces a cropped `File` (JPEG, quality 0.92) and closes the modal.
  - Click **Skip** to use the original file unchanged and close the modal.
- The crop selection defaults to the largest centered square that fits within the image (good default for recipe covers).
- The modal is keyboard-accessible: **Enter** confirms (same as Crop), **Escape** skips (same as Skip).
- Works for both `MainPhotoUpload` (main recipe photo) and `SortableInstruction` (per-step photo).
- A **Crop** button is shown next to "Replace photo" on `MainPhotoUpload` so users can re-crop the pending file.

## Design

### Data Model
No changes.

### API Changes
No changes.

### UI Changes

#### New component: `CropModal`
- Props: `{ file: File; onConfirm: (cropped: File) => void; onSkip: () => void }`
- Rendered as a portal/fixed overlay
- Canvas-based crop UI — no new libraries
- Image drawn to canvas at display size; crop coordinates mapped to natural image dimensions on output

#### `MainPhotoUpload` changes
- When a file passes validation, open `CropModal` instead of immediately calling `onFileSelected`.
- After confirmation/skip, call `onFileSelected` with the resulting file.
- Add a **Crop** button in the action row (alongside "Replace photo" / "Remove photo") that re-opens `CropModal` using the current `pendingFile`. Only shown when `pendingFile` is present.

#### `SortableInstruction` changes (in `RecipeForm.tsx`)
- Same pattern: after file selection/validation, open `CropModal`; on confirm/skip, proceed with upload.

## Out of Scope
- Server-side image processing / re-cropping after upload
- Aspect-ratio locking beyond the default square hint
- Rotation or flip

## Open Questions
- None.

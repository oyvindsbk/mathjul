# Feature: Paste Image Upload

## Summary
Allow users to paste images (from clipboard) into all image upload areas in the app, in addition to the existing file picker and drag-and-drop methods.

## Motivation
Users often take screenshots or copy images from other apps and want to paste them directly into the upload area without saving to disk first. This is a common UX expectation that reduces friction in the upload flow.

## Requirements
- Pasting an image (Ctrl+V / Cmd+V) while the upload area is focused or hovered must trigger the same upload flow as dropping or picking a file
- Must work in all four image upload locations:
  1. **MainPhotoUpload** — main recipe photo on the recipe detail/edit page
  2. **last-opp-oppskrift page** — multi-image recipe extraction upload
  3. **RecipeForm step photos** — per-instruction-step photo upload
  4. **MatkassePanelSidebar** — matkasse (meal kit) menu image upload
- Pasted image must pass through the same validation as file-picked images (type and size checks)
- Pasted image must be treated as a `File` object identical to one selected via file input, so that all downstream logic (cropping, uploading, progress) is unchanged
- If the clipboard contains no image, silently ignore the paste event (no error shown)
- Paste should be scoped: only active when the upload area is focused or when the cursor is inside the upload drop zone (avoid intercepting paste globally across the page)

## Design

### Data Model
No changes.

### API Changes
No changes.

### UI Changes

#### Paste scope strategy
Each upload component already has a container `div` with drag-and-drop handlers. We will:
1. Make the container `div` focusable (`tabIndex={0}`) if it is not already
2. Attach a `onPaste` handler to the container `div`
3. Inside `onPaste`, read `ClipboardEvent.clipboardData.items`, filter for `image/*` type, call `.getAsFile()`, and pass the resulting `File` to the existing file-handling function

This means paste is scoped to the component's DOM subtree — pasting elsewhere on the page does nothing.

#### Components to update
| Component | File | Existing handler to reuse |
|-----------|------|--------------------------|
| MainPhotoUpload | `frontend/src/components/MainPhotoUpload.tsx` | `handleFile(file)` |
| last-opp-oppskrift page | `frontend/src/app/last-opp-oppskrift/page.tsx` | `handleFilesSelect(files)` |
| RecipeForm step photos | `frontend/src/components/RecipeForm.tsx` | `handlePhotoFile(file)` |
| MatkassePanelSidebar | `frontend/src/components/matkasse/MatkassePanelSidebar.tsx` | `handleFilesSelect(files)` |

#### Visual feedback
- Add a small paste hint label ("eller lim inn bilde") below or near the existing drag-drop hint text in the upload zones that support it
- No additional UI change needed for RecipeForm step photos (minimal UI, no drag-drop zone)

## Out of Scope
- Pasting multiple images at once from clipboard (only first image used for single-image components; all images used for multi-image components)
- Paste support outside of image upload areas (e.g., in text fields)
- Global paste listener on the page/document level

## Open Questions
- None — approach is clear.

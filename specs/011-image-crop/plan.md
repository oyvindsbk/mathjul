# Implementation Plan: Image Cropping Before Upload

## Approach
Implement a pure-frontend crop modal using the HTML5 Canvas API. No new npm packages.

1. **`CropModal` component** — renders as a fixed full-screen overlay containing a `<canvas>` element. Draws the source image, then overlays a dimmed mask and a bright crop rectangle. Mouse (and touch-friendly pointer) events track drag of the box and resize of the four corner handles. On "Crop", uses an off-screen canvas to draw only the selected region at full natural resolution and converts it to a JPEG `File` via `canvas.toBlob`.

2. **Integration** — the two upload sites (`MainPhotoUpload` and `SortableInstruction` inside `RecipeForm`) currently call their `handleFile`/`handlePhotoFile` functions directly on file selection. We intercept after validation and before the upstream callback, storing the selected file in a `cropTarget` state slot and rendering `<CropModal>` when that slot is set.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- **Canvas API over library**: avoids adding a dependency; Canvas crop is straightforward enough for this use case.
- **JPEG output at 0.92 quality**: consistent format, good balance of size vs quality; original PNG/WEBP colour fidelity is not critical after cropping.
- **Default to largest centered square**: sensible crop for portrait/landscape phone photos where the subject is centred.
- **Skip = original file**: users on desktop photos may already have a clean crop; Skip keeps the whole image without re-encoding.
- **Re-crop button on main photo**: only available when there is a `pendingFile` (client-side), not for server-side `currentImageUrl`, because we don't have the original file after upload. This is an intentional limitation.

## Risks
- **Touch devices**: pointer events should handle touch without separate touch handlers; tested on mobile viewport sizes.
- **Very large images**: the canvas is displayed at capped size (max 800 × 600 display), only the off-screen export canvas uses natural resolution — no memory issue.

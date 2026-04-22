# Implementation Plan: Paste Image Upload

## Approach
Add an `onPaste` handler to each upload container `div`. Read clipboard items, extract the first (or all, for multi-image zones) `image/*` item(s) as `File` objects, and pass them to the existing file-handling function. No new abstractions needed — the paste handler is a thin wrapper around existing logic.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- **Scoped paste (component level), not global:** Attaching to the container div avoids conflicts with text inputs elsewhere on the page. Users paste into the upload zone by clicking/focusing it first.
- **Reuse existing file handlers:** No duplication of validation or upload logic. The paste path produces a `File` and hands it off identically to drag-and-drop.
- **Multi-image components accept all pasted images:** `last-opp-oppskrift` and `MatkassePanelSidebar` support multiple files; paste will collect all image items from the clipboard (browsers typically provide one, but we handle N).
- **Single-image components take first image only:** `MainPhotoUpload` and RecipeForm step photos only accept one image at a time.

## Risks
- **Browser clipboard API permissions:** Reading image data from clipboard via `ClipboardEvent.clipboardData` does not require the Permissions API and works synchronously — no risk here.
- **MIME type quirks:** Some browsers emit `image/png` even for screenshots; existing validation accepts `image/*` in the multi-image zones and JPEG/PNG/WEBP in single-image zones. Screenshots are always PNG, so this is fine.

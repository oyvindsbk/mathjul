# Feature: Upload Progress Feedback

## Summary
Show real-time stage-by-stage progress messages during recipe extraction (both image and URL modes) so the user understands what is happening and isn't left staring at a silent button.

## Motivation
Recipe extraction involves multiple slow steps: reading/resizing images, fetching the source URL, calling the AI, downloading the dish photo, and uploading to blob storage. The current UX only changes the button label to "Henter oppskrift..." and gives no indication of how far along processing is. Users may think the app is frozen, especially on slow connections.

## Requirements

- During image extraction, show messages in sequence:
  1. "Leser bilder..." (reading/resizing images)
  2. "Analyserer med AI..." (AI extraction call)
  3. "Laster opp bilder..." (dish photo crop + blob upload)
- During URL extraction, show messages in sequence:
  1. "Henter nettsiden..." (fetching the URL)
  2. Conditionally "Analyserer med AI..." (only shown if JSON-LD wasn't enough)
  3. "Laster ned bilde..." (downloading dish image)
- Messages are displayed as a status line below the extract button while `isExtracting` is true
- The backend emits progress events via **Server-Sent Events (SSE)** on a new streaming endpoint; the frontend consumes them
- Fallback: if SSE isn't supported or the connection drops, the UI still completes (non-blocking)
- All message text is Norwegian (Bokmål), matching existing UI language

## Design

### API Changes

Two new SSE streaming endpoints replace the existing JSON endpoints (or run alongside them):

**Image extraction (SSE):**
```
POST /api/recipes/from-images/stream
Content-Type: multipart/form-data
Accept: text/event-stream

data: {"stage":"reading_images"}
data: {"stage":"ai_processing"}
data: {"stage":"uploading_images"}
data: {"stage":"done","result":{...extractedRecipeDto...}}
data: {"stage":"error","message":"..."}
```

**URL extraction (SSE):**
```
POST /api/recipes/from-url/stream
Content-Type: application/json
Accept: text/event-stream

data: {"stage":"fetching_url"}
data: {"stage":"ai_processing"}       // only if HTML fallback used
data: {"stage":"downloading_image"}
data: {"stage":"done","result":{...extractedRecipeDto...}}
data: {"stage":"error","message":"..."}
```

### Stage → Norwegian message map (frontend)

| Stage | Display text |
|---|---|
| `reading_images` | "Leser bilder..." |
| `ai_processing` | "Analyserer med AI..." |
| `uploading_images` | "Laster opp bilder..." |
| `fetching_url` | "Henter nettsiden..." |
| `downloading_image` | "Laster ned bilde..." |

### UI Changes

- Add a `progressMessage: string | null` state to the upload page
- Render it as a small grey italic line directly below the extract button while `isExtracting` is true
- Reset to `null` when extraction finishes (success or error)
- The button text stays as "Henter oppskrift..." (unchanged) so existing visual cue is preserved

### Implementation Approach

**Backend:** Each existing processing method gets an optional `IProgress<string>` (or `Action<string>`) parameter. The controller creates an `IProgress<string>` that writes SSE frames to the response stream, then calls the processor as before but passing the progress reporter.

**Frontend:** Use the native `fetch` + `ReadableStream` API to consume SSE. No extra library needed. When a `done` event arrives, parse the result the same way as the current JSON response.

## Out of Scope
- Percentage-based progress bars
- Cancellation of in-progress extraction
- Showing progress during the save-recipe step (fast DB write, not worth it)
- Retrying failed extractions automatically

## Open Questions
- None — approach is straightforward.

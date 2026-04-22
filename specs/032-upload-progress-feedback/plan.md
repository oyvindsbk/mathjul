# Implementation Plan: Upload Progress Feedback

## Approach

Add SSE streaming endpoints alongside the existing JSON endpoints. The backend refactors the two extraction methods to accept a progress reporter (`Action<string> reportStage`) and calls it at each meaningful stage boundary. The controller action writes SSE frames to the HTTP response for each reported stage, then a final `done` or `error` frame with the result payload.

The frontend replaces `fetch(...).then(r => r.json())` with a streaming reader that dispatches progress messages to state while reading SSE lines, then parses the `done` payload as the final result. The existing error handling path is preserved.

## Stacks Affected
- [x] Frontend (upload page: SSE consumer, progress state, progress UI)
- [x] Backend (controller: SSE response writing; processors: progress reporting)
- [ ] Infrastructure

## Key Decisions

- **SSE over WebSockets:** SSE is request-response like the existing endpoints (POST body → streamed response), no persistent connection needed, and works natively with fetch/ReadableStream. No new infrastructure required.
- **New endpoints, not replacing existing ones:** Keeps backward compatibility in case SSE fails or the old endpoint is used elsewhere. Frontend switches to the stream endpoint.
- **`Action<string>` not `IProgress<T>`:** Simpler and synchronous — the processor already runs async so there's no thread-dispatch concern. `IProgress<T>` would add unnecessary abstraction.
- **Stage strings are simple keys:** Frontend does the display-text mapping so backend stays locale-agnostic.
- **No SSE library:** Native `Response.Body` write with `text/event-stream` content type and manual `data: ...\n\n` formatting is < 20 lines and has no dependencies.

## Risks

- **Browser SSE over POST:** The `EventSource` API only supports GET. We use `fetch` + `ReadableStream` instead — this is well-supported in all modern browsers but slightly more code to parse SSE frames manually. Mitigation: small helper function to parse SSE lines.
- **Buffering:** Some proxies/reverse proxies buffer responses. Mitigation: set `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers (standard SSE headers). Already handled by setting `response.ContentType`.
- **Azure Container Apps:** May buffer SSE. Mitigation: flush after each frame with `await response.Body.FlushAsync()`.

# Implementation Plan: Kildebilder

## Approach
Widen the existing single `SourceImageUrl` into a list end-to-end (DB → extraction response → save request → detail DTO → UI), add validation on save, clean up blobs on delete, and render a thumbnail strip on the recipe detail page. Backend first (with migration + tests), then frontend.

## Stacks Affected
- [ ] Frontend — upload page state, service types, detail page component, mock data, Playwright test
- [x] Backend — model, migration, DTOs, extraction helper, save validation, delete cleanup, xUnit tests
- [ ] Infrastructure — none (download goes via the API, not direct to storage)

## Key Decisions
- **List column instead of a child table:** source images are an ordered, immutable list owned by one recipe, never queried on their own — JSON column matches `Tips`/`AvailablePanPresetIds`.
- **Replace, don't add alongside:** dropping `SourceImageUrl` after backfill avoids two sources of truth. Frontend and backend ship together, so no API compatibility window is needed.
- **Keep blobs in `recipes/pending/`:** the storage service has no copy/rename; explicit per-URL delete on recipe delete is enough.
- **Validate URLs on save:** only accept URLs pointing at our own container's `recipes/pending/source-` prefix, so the list can't be used to inject external links or to make delete target arbitrary blobs.
- **Download via API endpoint (Q1=b):** `GET /api/recipes/{id}/source-images/{index}` reuses the detail endpoint's visibility check and streams the blob as an attachment. Needs one new storage method, `OpenReadAsync`. The frontend downloads with the Bearer token through an object URL. Display stays on public blob URLs, since `<img>` can't send Bearer.
- **Crop on the client, reusing `CropModal`:** cropping happens before upload, so the backend sees an ordinary (smaller) image and needs no change. It is per image and optional, not a forced modal, because multi-image uploads would otherwise mean clicking through every image. Keep `original` next to `current` so re-cropping never degrades quality.
- **Store only the cropped image:** the source photo then matches the extracted recipe, and parts of the page the user cut away are not kept.
- **Immutable after save:** not part of `UpdateRecipeRequest`, keeping the edit flow untouched.

## Risks
- **Migration on prod data:** backfill SQL must handle NULLs and escape correctly. Mitigation: `STRING_ESCAPE`, test Up/Down locally against seeded data.
- **CI `dotnet-ef` pin (9.0.14) vs .NET 10 upgrade (c583eff):** migration generation tooling may mismatch. Mitigation: generate with the version CI uses; verify the CI migration step still works.
- **Validation too strict in local dev:** Azurite URLs (`http://127.0.0.1:10000/devstoreaccount1/recipe-images/...`) differ from prod. Mitigation: validate by parsing via the same path logic as `BlobPathFromUrl` + checking the container name from `BlobStorageOptions`, not by hardcoding the host.
- **Filename not readable cross-origin:** the frontend can only read `Content-Disposition` if the API's CORS policy exposes it. Mitigation: add `WithExposedHeaders("Content-Disposition")` if missing, and fall back to `kilde-<n>.jpg`.
- **CropModal regressions on the main photo:** the new props default to today's behavior. Mitigation: check the main-photo crop manually in the final task.
- **JPEG re-encoding of text scans:** `CropModal` outputs JPEG at quality 0.92, which is fine for photographed text. Mitigation: if extraction quality drops, switch to PNG output when the input is PNG.
- **Visibility check drift:** copying the access logic into a new endpoint risks diverging from the detail endpoint. Mitigation: extract and share one helper, and test that a private recipe returns 404 for a non-owner.

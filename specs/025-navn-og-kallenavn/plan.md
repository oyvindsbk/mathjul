# Implementation Plan: Navn og kallenavn

## Approach
Extend the existing `User` entity with two nullable string fields (`Name`, `Nickname`), add an EF Core migration, expose a new `PUT /api/user/{id}` endpoint on a new `UserController`, and create a `/profil` page in the frontend that reads and updates these fields.

## Stacks Affected
- [x] Backend
- [x] Frontend
- [ ] Infrastructure

## Key Decisions
- **Nullable fields**: `Name` and `Nickname` are optional — no migration data loss, no breaking change to `ensure-user`.
- **Authorization**: The PUT endpoint verifies the authenticated user's email matches the target user record (no admin scope needed).
- **New controller**: `UserController` rather than adding to `AuthController` — keeps auth concerns separate from profile management.
- **Frontend state**: Extend `AuthContext` with `userId`, `name`, `nickname` populated from `ensure-user` response; refresh after successful save.
- **Profile page**: New Next.js page at `/profil` protected by the existing auth middleware. Accessible via user dropdown in Sidebar.

## Risks
- EF Core migration must be additive (nullable columns) — low risk.
- Token does not carry name/nickname, so the frontend always fetches them via `ensure-user` on load — acceptable given the current architecture.

# Feature: Navn og kallenavn

## Summary
Users can set and edit their display name (navn) and nickname (kallenavn) from a profile settings page, making the app experience more personal.

## Motivation
Users should be able to customize their profile identity beyond their email address. A friendly display name and nickname improves personalization and future social interactions within the app.

## Requirements
- Users can add a name (`name`) and a nickname (`nickname`) to their profile.
- Not required on first login — the profile settings are accessible at any time.
- Users can edit existing name and nickname.
- Name and nickname are stored on the `User` entity and returned by the `ensure-user` endpoint.
- A profile settings UI (page or modal accessible from the navigation bar) shows current values and allows updating them.
- Saving triggers `PUT /api/user/{id}` and shows confirmation feedback.

## Design

### Data Model
`User` entity gains two new optional fields:
- `Name` — nullable string, max 100 chars — user's full name
- `Nickname` — nullable string, max 50 chars — user's chosen nickname

Existing `DisplayName` remains (derived from email at creation) and is unchanged.

### API Changes
**New endpoint:**
```
PUT /api/user/{id}
Authorization: Bearer <token>
Body: { "name": "string|null", "nickname": "string|null" }
Response 200: { "id", "email", "displayName", "name", "nickname" }
Response 403: if authenticated user tries to update another user
Response 404: if user not found
```

The `ensure-user` response is extended to include `name` and `nickname`.

### UI Changes
- New page at `/profil` — profile settings page
- Fields: Name (optional), Nickname (optional) with a Save button
- Accessible via a "Profil" link in the user dropdown menu in the Sidebar
- AuthContext extended with `userId`, `name`, and `nickname` state; refreshed after login and after save

## Out of Scope
- Uniqueness enforcement for nicknames (open question — defer to later)
- Length/content validation beyond simple max-length (defer)
- Displaying name/nickname elsewhere in the app (e.g., recipe cards) — follow-up feature

## Open Questions
- Nickname uniqueness: no enforcement for now; can be revisited if needed.
- Max lengths: Name ≤ 100, Nickname ≤ 50 for now.

# Implementation Plan: Category Filter for Spin the Wheel

## Approach
Extend `frontend/src/app/spin/client.tsx` to fetch categories and support filtering — mirroring the pattern already used in `HomeClient.tsx`. No backend changes needed.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- **Reuse existing API**: `GET /api/categories` + `GET /api/recipes?categories=...` — no new endpoints needed.
- **AND-logic**: Consistent with home page filter behavior.
- **No persistence**: Filter state lives in component state only — simpler, no storage side-effects.
- **Collapsible panel**: Mirrors HomeClient.tsx pattern so the UX feels consistent.

## Risks
- Category fetch failure should degrade gracefully (show wheel without filter UI, not crash)

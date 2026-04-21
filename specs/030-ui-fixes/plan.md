# Implementation Plan: UI Fixes (030)

## Approach
Four targeted single-file fixes — no new components, no new dependencies.

## Stacks Affected
- [x] Frontend
- [ ] Backend
- [ ] Infrastructure

## Key Decisions
- Bug button z-index: raise to `z-50` to sit above BottomNav (`z-40`) — simple and correct
- Floating ingredients: use `rootMargin` with a positive bottom offset to trigger earlier, no logic change needed
- M icon: use `<img src="/icons/icon-192.png">` in the home tab — leverages existing PWA asset, no new SVG needed
- Provider icons: render a small inline colored pill with 2-letter abbreviation in DayCell — fits the compact card design without emoji

## Risks
- None significant — all changes are isolated, visual-only

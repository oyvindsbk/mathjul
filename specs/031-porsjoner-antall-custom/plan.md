# Implementation Plan: Porsjoner, Antall og Custom Enhet

## Approach
Backend first: add EF migration, extend DTOs and AI extraction. Then frontend: update form and detail view. No breaking changes — existing recipes without quantityType display as "porsjoner".

## Stacks Affected
- [x] Frontend
- [x] Backend
- [ ] Infrastructure

## Key Decisions
- `QuantityType` stored as string (not enum) for forward compatibility; validated at API boundary
- `Servings` becomes `double?` — EF migration alters column type (no data loss, int fits in double)
- AI extraction gets explicit instructions + example for all three types
- Frontend label derivation: `quantityType == "antall"` → "stk", `"custom"` → customUnit, else "porsjoner"

## Risks
- EF migration altering `servings` column type: low risk (int → double is widening), but must verify SQL Server migration runs cleanly

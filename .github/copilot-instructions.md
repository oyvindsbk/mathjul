<!-- AI Copilot Instructions for Food Recipes Application -->
<!-- Primary instructions are maintained in CLAUDE.md at the project root. -->
<!-- This file keeps Copilot aligned with the same conventions. -->

# Food Recipes Application

See [`CLAUDE.md`](../CLAUDE.md) for the full project instructions, conventions, inner loop, and project structure.

Copilot should follow the same rules defined there. Key points summarized below for quick reference.

## Quick Reference

- **Stack**: ASP.NET Core 9 backend, Next.js 15 frontend, Azure Bicep IaC
- **Feature workflow**: feature branches (`NNN-feature-name`), specs in `specs/[branch]/`
- **Skills**: `.claude/skills/` — reusable agent workflows
- **Never push to main** — always use feature branches and PRs
- **Inner loop**: lint → typecheck → build (frontend), `dotnet build` (backend), `az bicep build` (infra)
- **Auth**: JWT via `TokenService`, `EmailWhitelistMiddleware`, `middleware.ts` cookie check
- **No hardcoded secrets** — use Key Vault / env vars / user-secrets
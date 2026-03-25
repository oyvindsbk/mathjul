#!/usr/bin/env bash
# Stop hook: hard gate before the agent stops.
# Detects which stacks changed (last commit + uncommitted) and runs the
# full verification suite for each. Exits 2 to block the stop on failure.

set -uo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || echo "/c/git/privat/mathjul")"
cd "$REPO_ROOT"

# Collect changed files: last commit + staged + unstaged
CHANGED=$(
  git diff --name-only HEAD~1 HEAD 2>/dev/null || true
  git diff --name-only --cached 2>/dev/null || true
  git diff --name-only 2>/dev/null || true
)

if [ -z "$CHANGED" ]; then
  echo "✅ [stop-gate] No changes detected — skipping checks."
  exit 0
fi

FAILED=false

# ── Backend ──────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "^backend/"; then
  echo "🔨 [stop-gate] Backend changes detected — running full backend checks..."
  if (cd "$REPO_ROOT/backend/RecipeApi" && dotnet build -v q 2>&1 && dotnet test --no-build 2>&1); then
    echo "✅ Backend checks passed."
  else
    echo "❌ Backend checks FAILED."
    FAILED=true
  fi
fi

# ── Frontend ─────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "^frontend/"; then
  echo "🔨 [stop-gate] Frontend changes detected — running full frontend checks..."
  if (cd "$REPO_ROOT/frontend" && npm run lint --silent 2>&1 && npx tsc --noEmit 2>&1 && npm run build 2>&1); then
    echo "✅ Frontend checks passed."
  else
    echo "❌ Frontend checks FAILED."
    FAILED=true
  fi

  # E2E: only if dev server is reachable
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "🎭 [stop-gate] Dev server detected — running Playwright E2E tests..."
    if (cd "$REPO_ROOT/frontend" && npx playwright test 2>&1); then
      echo "✅ Playwright tests passed."
    else
      echo "❌ Playwright tests FAILED."
      FAILED=true
    fi
  else
    echo "⚠️  [stop-gate] No server on :3000 — skipping Playwright tests."
  fi
fi

# ── Infrastructure ────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "^infrastructure/"; then
  echo "🔨 [stop-gate] Infrastructure changes detected — validating Bicep..."
  if az bicep build --file "$REPO_ROOT/infrastructure/main.bicep" 2>&1; then
    echo "✅ Bicep validation passed."
  else
    echo "❌ Bicep validation FAILED."
    FAILED=true
  fi
fi

# ── Result ────────────────────────────────────────────────────────────────────
if $FAILED; then
  echo ""
  echo "❌ [stop-gate] One or more checks failed. Fix errors before completing the task."
  exit 2
fi

echo "✅ [stop-gate] All checks passed."
exit 0

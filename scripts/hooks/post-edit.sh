#!/usr/bin/env bash
# Post-edit hook: fast feedback after each Edit/Write tool call.
# Reads the tool call JSON from stdin, extracts the file path, and
# runs the cheapest relevant check for the affected stack.
# Always exits 0 -- PostToolUse output is informational only.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || echo "/c/git/privat/mathjul")"

# Extract file_path from tool-call JSON via node (guaranteed available in Next.js project)
INPUT=$(cat)
FILE=$(echo "$INPUT" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input?.file_path || ''); }
    catch { console.log(''); }
  });
" 2>/dev/null || echo "")

if [ -z "$FILE" ]; then exit 0; fi

case "$FILE" in
  *backend/*.cs|*backend/*.csproj)
    echo "🔨 [hook] Backend changed — building..."
    cd "$REPO_ROOT/backend/RecipeApi" && dotnet build --no-restore -v q 2>&1 | tail -5
    ;;
  *frontend/src/*.ts|*frontend/src/*.tsx)
    echo "🔨 [hook] Frontend changed — linting..."
    cd "$REPO_ROOT/frontend" && npm run lint --silent 2>&1 | tail -10
    ;;
  *infrastructure/*.bicep)
    echo "🔨 [hook] Bicep changed — validating..."
    az bicep build --file "$REPO_ROOT/infrastructure/main.bicep" 2>&1
    ;;
esac

exit 0

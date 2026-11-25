#!/usr/bin/env bash
# Tests for infra-preflight.sh and changed-since-deployed.sh, with a stubbed `az` and a
# throwaway git repo. Run: bash .github/scripts/test.sh
set -uo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PASS=0
FAILED=0

# ── Stub az ──────────────────────────────────────────────────────────────────
# Reads fixtures from $STUB: `apps` (one name per line), <name>.image, <name>.fqdn,
# <name>.domains (tsv: name, bindingType, certificateId). A missing file is an az error.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/az" <<'EOF'
#!/usr/bin/env bash
query=""; name=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --query) query="${args[$((i + 1))]}" ;;
    -n) name="${args[$((i + 1))]}" ;;
  esac
done
case "$2" in
  list)
    needle=$(echo "$query" | sed -E "s/.*contains\(name, '([^']+)'\).*/\1/")
    grep -F -- "$needle" "$STUB/apps" 2>/dev/null | head -1
    ;;
  show)
    case "$query" in
      *customDomains*) file="$STUB/$name.domains" ;;
      *fqdn*) file="$STUB/$name.fqdn" ;;
      *image*) file="$STUB/$name.image" ;;
    esac
    [ -f "$file" ] || { echo "ERROR: not found" >&2; exit 3; }
    cat "$file"
    ;;
esac
EOF
chmod +x "$WORK/bin/az"
export PATH="$WORK/bin:$PATH"
export RG=rg-test

check() { # description, expected, actual
  if [ "$2" = "$3" ]; then
    PASS=$((PASS + 1))
  else
    FAILED=$((FAILED + 1))
    echo "FAIL: $1 -- expected '$2', got '$3'"
  fi
}

output_value() { # file, key
  grep -E "^$2=" "$1" | tail -1 | cut -d= -f2-
}

new_stub() {
  export STUB="$WORK/stub-$RANDOM$RANDOM"
  mkdir -p "$STUB"
  : > "$STUB/apps"
}

add_app() { # name, image, [fqdn]
  echo "$1" >> "$STUB/apps"
  echo "$2" > "$STUB/$1.image"
  [ -n "${3:-}" ] && echo "$3" > "$STUB/$1.fqdn"
  : > "$STUB/$1.domains"
}

# ── infra-preflight.sh ───────────────────────────────────────────────────────
run_preflight() { # writes $OUT; returns exit code
  OUT="$WORK/out-$RANDOM$RANDOM"
  : > "$OUT"
  GITHUB_OUTPUT="$OUT" GITHUB_STEP_SUMMARY=/dev/null bash "$SCRIPTS/infra-preflight.sh" > "$OUT.log" 2>&1
}

unset FRONTEND_CUSTOM_DOMAIN FRONTEND_CUSTOM_DOMAIN_CERT FRONTEND_URL NOTES_CUSTOM_DOMAIN NOTES_CUSTOM_DOMAIN_CERT NOTES_ENABLED

# First deploy: nothing exists.
new_stub
run_preflight; check "preflight: empty rg passes" 0 $?
check "preflight: empty rg -> no api image" "" "$(output_value "$OUT" recipe-api-image)"

# Running apps, everything matching.
new_stub
add_app ca-recipe-api-prod-x ghcr.io/o/r/recipe-api:main-abc1234
add_app ca-recipe-web-prod-x ghcr.io/o/r/recipe-frontend:main-abc1234 web.example.io
add_app ca-notes-api-prod-x ghcr.io/o/r/notes-api:main-1111111
add_app ca-notes-web-prod-x ghcr.io/o/r/notes-web:main-2222222
printf 'mathjul.example.no\tSniEnabled\t/sub/env/managedCertificates/mc-web\n' > "$STUB/ca-recipe-web-prod-x.domains"
printf 'notater.example.no\tSniEnabled\t/sub/env/managedCertificates/mc-notes\n' > "$STUB/ca-notes-web-prod-x.domains"
export FRONTEND_CUSTOM_DOMAIN=mathjul.example.no FRONTEND_CUSTOM_DOMAIN_CERT=mc-web
export NOTES_ENABLED=true NOTES_CUSTOM_DOMAIN=notater.example.no NOTES_CUSTOM_DOMAIN_CERT=mc-notes
run_preflight; check "preflight: all matching passes" 0 $?
check "preflight: keeps api image" ghcr.io/o/r/recipe-api:main-abc1234 "$(output_value "$OUT" recipe-api-image)"
check "preflight: keeps web image" ghcr.io/o/r/recipe-frontend:main-abc1234 "$(output_value "$OUT" recipe-web-image)"
check "preflight: keeps notes-web image" ghcr.io/o/r/notes-web:main-2222222 "$(output_value "$OUT" notes-web-image)"
check "preflight: frontend fqdn url" https://web.example.io "$(output_value "$OUT" frontend-fqdn-url)"

# Domain variable missing: would remove the binding.
FRONTEND_CUSTOM_DOMAIN="" run_preflight; check "preflight: missing domain var fails" 1 $?
grep -q "Set FRONTEND_CUSTOM_DOMAIN=mathjul.example.no" "$OUT.log"; check "preflight: names the variable" 0 $?

# Certificate variable missing: would drop TLS.
FRONTEND_CUSTOM_DOMAIN_CERT="" run_preflight; check "preflight: missing cert var fails" 1 $?
grep -q "Set FRONTEND_CUSTOM_DOMAIN_CERT=mc-web" "$OUT.log"; check "preflight: names the cert" 0 $?

# Notes domain var missing.
NOTES_CUSTOM_DOMAIN="" run_preflight; check "preflight: missing notes domain fails" 1 $?

# Notater off: its apps are not touched, so neither checked nor kept.
NOTES_ENABLED=false NOTES_CUSTOM_DOMAIN="" run_preflight; check "preflight: notes off ignores notes" 0 $?
check "preflight: notes off -> no notes image" "" "$(output_value "$OUT" notes-api-image)"

# API exists, no frontend app and no origin variables: no CORS origin.
new_stub
add_app ca-recipe-api-prod-x ghcr.io/o/r/recipe-api:main-abc1234
FRONTEND_CUSTOM_DOMAIN="" FRONTEND_URL="" NOTES_ENABLED=false run_preflight
check "preflight: api without any origin fails" 1 $?
FRONTEND_CUSTOM_DOMAIN="" FRONTEND_URL=https://x.example NOTES_ENABLED=false run_preflight
check "preflight: FRONTEND_URL is enough" 0 $?

# Binding without certificate yet (validation only), cert var empty: fine.
new_stub
add_app ca-recipe-web-prod-x ghcr.io/o/r/recipe-frontend:main-abc1234 web.example.io
printf 'mathjul.example.no\tDisabled\t\n' > "$STUB/ca-recipe-web-prod-x.domains"
FRONTEND_CUSTOM_DOMAIN_CERT="" NOTES_ENABLED=false run_preflight
check "preflight: disabled binding needs no cert" 0 $?

unset FRONTEND_CUSTOM_DOMAIN FRONTEND_CUSTOM_DOMAIN_CERT FRONTEND_URL NOTES_CUSTOM_DOMAIN NOTES_CUSTOM_DOMAIN_CERT NOTES_ENABLED

# ── changed-since-deployed.sh ────────────────────────────────────────────────
REPO="$WORK/repo"
git init -q "$REPO"
cd "$REPO"
git config user.email t@example.com
git config user.name test
git config core.autocrlf false
mkdir -p backend/RecipeApi backend/RecipeApi.Tests frontend .github/workflows
echo 1 > backend/RecipeApi/a.cs; echo 1 > frontend/a.ts; echo 1 > .github/workflows/deploy.yml
git add -A; git commit -qm base
BASE=$(git rev-parse HEAD)
# Set here, not in run_changes: that runs in $(...), so its assignments would not reach us.
OUT="$WORK/changes-out"

run_changes() { # key, app; prints the decision, leaves outputs in $OUT
  : > "$OUT"
  GITHUB_OUTPUT="$OUT" GITHUB_STEP_SUMMARY=/dev/null bash "$SCRIPTS/changed-since-deployed.sh" \
    "$1" "$2" backend/RecipeApi .github/workflows/deploy.yml > /dev/null 2>&1
  output_value "$OUT" "$1"
}

new_stub
add_app api ghcr.io/o/r/recipe-api:main-${BASE:0:7}
check "changes: nothing changed -> skip" false "$(run_changes recipe-api api)"

echo 2 > backend/RecipeApi.Tests/t.cs; echo 2 > frontend/a.ts; git add -A; git commit -qm other
check "changes: tests/frontend only -> skip" false "$(run_changes recipe-api api)"

echo 2 > backend/RecipeApi/a.cs; git add -A; git commit -qm api
check "changes: own path -> deploy" true "$(run_changes recipe-api api)"
grep -q "backend/RecipeApi/a.cs" "$OUT"; check "changes: reason lists file" 0 $?

add_app api ghcr.io/o/r/recipe-api:main-$(git rev-parse HEAD)
check "changes: full sha, up to date -> skip" false "$(run_changes recipe-api api)"

echo 2 > .github/workflows/deploy.yml; git add -A; git commit -qm wf
check "changes: workflow file -> deploy" true "$(run_changes recipe-api api)"

add_app api mcr.microsoft.com/dotnet/samples:aspnetapp
check "changes: placeholder -> deploy" true "$(run_changes recipe-api api)"

add_app api ghcr.io/o/r/recipe-api:latest
check "changes: tag without sha -> deploy" true "$(run_changes recipe-api api)"

add_app api ghcr.io/o/r/recipe-api:main-deadbee
check "changes: unknown commit -> deploy" true "$(run_changes recipe-api api)"

check "changes: app missing -> deploy" true "$(run_changes recipe-api "")"

add_app api ghcr.io/o/r/recipe-api:main-$(git rev-parse HEAD)
check "changes: up to date again -> skip" false "$(run_changes recipe-api api)"
FORCE=true; export FORCE
check "changes: force -> deploy" true "$(run_changes recipe-api api)"
unset FORCE

echo ""
echo "$PASS passed, $FAILED failed"
[ "$FAILED" -eq 0 ]

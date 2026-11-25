#!/usr/bin/env bash
# Decides whether one app needs a deploy: have its paths changed between the commit its
# running image was built from and HEAD? Diffing against the running commit, not the push's
# `before`, means a failed or skipped deploy is retried on the next push.
#
# When unsure (no app, placeholder image, tag without a SHA, commit not in history), it
# deploys: a needless deploy is cheap, a missed one leaves production behind.
#
# Usage: changed-since-deployed.sh <key> <container-app-name> <path>...
#   Image tags are expected to end in -<sha> (7 or 40 hex), as deploy.yml and
#   deploy-notes.yml tag them. Needs the full history (checkout fetch-depth: 0).
# Env:   RG (or AZURE_RESOURCE_GROUP), FORCE (true|false),
#        CHANGES_SUMMARY (file to append the table row to; default $GITHUB_STEP_SUMMARY)
# Out:   $GITHUB_OUTPUT  <key>=true|false, <key>-reason=<text>
#        $CHANGES_SUMMARY  one markdown table row. GitHub renders each step's summary on
#        its own, so the workflow writes header + rows from one step.
set -uo pipefail

KEY="$1"
APP="$2"
shift 2
PATHS=("$@")
RG="${RG:-${AZURE_RESOURCE_GROUP:-}}" # workflows set AZURE_RESOURCE_GROUP at the top
: "${RG:?RG or AZURE_RESOURCE_GROUP is required}"
: "${GITHUB_OUTPUT:=/dev/null}"
: "${GITHUB_STEP_SUMMARY:=/dev/null}"
CHANGES_SUMMARY="${CHANGES_SUMMARY:-$GITHUB_STEP_SUMMARY}"
FORCE="${FORCE:-false}"

decide() { # deploy(true|false), reason
  echo "$KEY: deploy=$1 ($2)"
  {
    echo "$KEY=$1"
    echo "$KEY-reason=$2"
  } >> "$GITHUB_OUTPUT"
  local verdict="skip"
  [ "$1" = "true" ] && verdict="**deploy**"
  echo "| $KEY | $verdict | $2 |" >> "$CHANGES_SUMMARY"
  exit 0
}

[ "$FORCE" = "true" ] && decide true "forced (workflow_dispatch)"
[ -z "$APP" ] && decide true "container app not found"

IMAGE=$(az containerapp show -n "$APP" -g "$RG" \
  --query "properties.template.containers[0].image" -o tsv 2>/dev/null | tr -d '\r')
[ -z "$IMAGE" ] && decide true "running image unknown"

TAG="${IMAGE##*:}"
SHA="${TAG##*-}"
if [ "$TAG" = "$IMAGE" ] || ! [[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  decide true "running image \`$IMAGE\` has no commit in its tag"
fi

if ! COMMIT=$(git rev-parse --verify --quiet "$SHA^{commit}"); then
  decide true "running commit $SHA is not in this history"
fi

CHANGED=$(git diff --name-only "$COMMIT" HEAD -- "${PATHS[@]}")
if [ -n "$CHANGED" ]; then
  COUNT=$(echo "$CHANGED" | wc -l | tr -d ' ')
  FIRST=$(echo "$CHANGED" | head -3 | paste -sd ',' - | sed 's/,/, /g')
  decide true "$COUNT file(s) changed since ${SHA:0:7}: $FIRST"
fi

decide false "unchanged since ${SHA:0:7}"

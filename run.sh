#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ITERATION=0
while :; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "==============================================================="
  echo "  Loop Iteration $ITERATION"
  echo "==============================================================="

  cat "$SCRIPT_DIR/PROMPT.md" \
    | claude -p --dangerously-skip-permissions --output-format stream-json --verbose \
    2>&1 | "$SCRIPT_DIR/parse-claude.sh"

  [[ $? -eq 42 ]] && exit 0

  sleep 2
done

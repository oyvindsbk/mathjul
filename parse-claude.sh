#!/bin/bash
export LC_ALL=C
# Parses claude --output-format stream-json into readable output
# Usage: cat PROMPT.md | claude -p --dangerously-skip-permissions --output-format stream-json --verbose 2>&1 | ./parse-claude.sh

DIM='\033[2m'
BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
RED='\033[31m'
RESET='\033[0m'

START_TIME=$SECONDS
LAST_EVENT=$SECONDS
spinner_pid=""

start_spinner() {
  stop_spinner
  local label="$1"
  local start=$SECONDS
  (
    chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    i=0
    while true; do
      elapsed=$(( SECONDS - start ))
      printf "\r  ${DIM}${chars:i%10:1} ${label} (%ds)${RESET}  " "$elapsed" >&2
      sleep 0.2
      i=$((i+1))
    done
  ) &
  spinner_pid=$!
}

stop_spinner() {
  if [[ -n "$spinner_pid" ]]; then
    kill "$spinner_pid" 2>/dev/null
    wait "$spinner_pid" 2>/dev/null
    spinner_pid=""
    printf "\r\033[K" >&2
  fi
}

trap 'stop_spinner' EXIT

start_spinner "waiting for response"

while IFS= read -r line; do
  LAST_EVENT=$SECONDS
  stop_spinner

  type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null) || continue

  if [[ "$type" == "assistant" ]]; then
    count=$(echo "$line" | jq -r '.message.content | length' 2>/dev/null) || continue
    for ((idx=0; idx<count; idx++)); do
      block_type=$(echo "$line" | jq -r ".message.content[$idx].type" 2>/dev/null)
      case "$block_type" in
        thinking)
          thinking=$(echo "$line" | jq -r ".message.content[$idx].thinking" 2>/dev/null)
          # Truncate long thinking to first 3 lines
          short=$(echo "$thinking" | head -3)
          total=$(echo "$thinking" | wc -l)
          echo -e "${YELLOW}[thinking]${RESET} ${DIM}${short}${RESET}"
          if (( total > 3 )); then
            echo -e "${DIM}  ... (${total} lines)${RESET}"
          fi
          start_spinner "thinking"
          ;;
        text)
          text=$(echo "$line" | jq -r ".message.content[$idx].text" 2>/dev/null)
          echo -e "${GREEN}${text}${RESET}"
          start_spinner "working"
          ;;
        tool_use)
          name=$(echo "$line" | jq -r ".message.content[$idx].name" 2>/dev/null)
          # Short summary per tool type
          case "$name" in
            Read|Glob|Grep)
              path=$(echo "$line" | jq -r ".message.content[$idx].input.file_path // .message.content[$idx].input.pattern // .message.content[$idx].input.path // empty" 2>/dev/null)
              echo -e "${CYAN}>>> ${name}${RESET} ${DIM}${path}${RESET}"
              ;;
            Edit)
              path=$(echo "$line" | jq -r ".message.content[$idx].input.file_path // empty" 2>/dev/null)
              echo -e "${CYAN}>>> ${name}${RESET} ${DIM}${path}${RESET}"
              ;;
            Write)
              path=$(echo "$line" | jq -r ".message.content[$idx].input.file_path // empty" 2>/dev/null)
              echo -e "${CYAN}>>> ${name}${RESET} ${DIM}${path}${RESET}"
              ;;
            Bash)
              cmd=$(echo "$line" | jq -r ".message.content[$idx].input.command // empty" 2>/dev/null | head -1 | cut -c1-120)
              echo -e "${CYAN}>>> ${name}${RESET} ${DIM}${cmd}${RESET}"
              ;;
            Task)
              desc=$(echo "$line" | jq -r ".message.content[$idx].input.description // empty" 2>/dev/null)
              echo -e "${CYAN}>>> ${name}${RESET} ${DIM}${desc}${RESET}"
              ;;
            *)
              echo -e "${CYAN}>>> ${name}${RESET}"
              ;;
          esac
          start_spinner "running ${name}"
          ;;
      esac
    done

  elif [[ "$type" == "user" ]]; then
    # Tool result -- one-line summary
    content=$(echo "$line" | jq -r '.message.content[0].content // empty' 2>/dev/null)
    if [[ -n "$content" ]]; then
      first=$(echo "$content" | head -1 | cut -c1-120)
      echo -e "${DIM}  <- ${first}${RESET}"
    fi
    start_spinner "thinking"

  elif [[ "$type" == "result" ]]; then
    result_text=$(echo "$line" | jq -r '.result // empty' 2>/dev/null)
    cost=$(echo "$line" | jq -r '.total_cost_usd // empty' 2>/dev/null)
    duration=$(echo "$line" | jq -r '.duration_ms // empty' 2>/dev/null)
    turns=$(echo "$line" | jq -r '.num_turns // empty' 2>/dev/null)
    is_error=$(echo "$line" | jq -r '.is_error // empty' 2>/dev/null)
    wall=$(( SECONDS - START_TIME ))
    echo ""
    if [[ "$is_error" == "true" ]]; then
      echo -e "${RED}${BOLD}=== ERROR ===${RESET}"
    fi
    echo -e "${BOLD}--- done | cost: \$${cost:-?} | turns: ${turns:-?} | time: ${wall}s ---${RESET}"

    # Signal completion to caller
    if echo "$result_text" | grep -q "<promise>COMPLETE</promise>"; then
      echo -e "${GREEN}${BOLD}=== ALL TASKS COMPLETE ===${RESET}"
      exit 42
    fi
  fi
done

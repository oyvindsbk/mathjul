# Build Prompt

Implement one task from the implementation plan.

study /spec/spec.md

## Input

- /spec/tasks.md

## Rules

- ONE task per iteration
- Mark task complete in the plan after implementing
- Follow @CLAUDE.md inner loop for verification
- Only modify files relevant to the current task
- Use feature branches -- never commit to main

## Completion

When ALL tasks are complete:

- Output: <promise>COMPLETE</promise>

If blocked, note it in the plan and move to the next task.

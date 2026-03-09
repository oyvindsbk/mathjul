# spec/

This directory holds your project's specification and task breakdown.

## Files

| File | Purpose |
|------|---------|
| `spec.md` | Technical specification -- the source of truth for what to build |
| `tasks.md` | Task breakdown -- numbered tasks, one per loop iteration |

## Writing a good spec

- Be precise about data formats (API contracts, component props, database schemas)
- Include algorithms as pseudocode, not prose
- Define error handling explicitly (what to reject, what to ignore)
- Include test scenarios with exact expected behavior
- List what's in scope AND out of scope

## Writing good tasks

- Task 0 is always scaffolding -- get the check command passing first
- Each task adds one capability with tests
- Include **Do:** (what to build) and **Verify:** (how to check)
- Mark done by appending ` ✅ DONE` to the heading
- Keep tasks small enough to complete in one Claude iteration

## Multi-stack considerations

This project has multiple stacks (frontend, backend, infrastructure). Each task should specify which stack it affects so the correct inner loop checks are run:
- **Frontend tasks:** lint -> typecheck -> build
- **Backend tasks:** dotnet build
- **Infrastructure tasks:** bicep validate

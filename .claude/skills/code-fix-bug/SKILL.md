---
name: code-fix-bug
description: "Diagnose and fix bugs in the mathjul codebase (frontend Next.js or backend ASP.NET Core). Use when a bug is reported, something is broken, an error is thrown, a test is failing, or behavior is unexpected. Covers root cause analysis, targeted fix, and inner loop verification."
metadata:
  author: mimir
  version: "1.0"
---

## Instructions

### 1. Understand the bug

- Read the bug report carefully: error message, stack trace, reproduction steps, expected vs actual behavior.
- Identify which stack is affected: **frontend** (Next.js), **backend** (ASP.NET Core). **infrastructure** (bicep), or all.
- If the report is vague, ask clarifying questions before proceeding.

### 2. Reproduce and locate the bug

- Find the relevant code using Grep/Glob. Start narrow — search for the symbol, route, or error message mentioned.
- Read the file(s) involved. Understand the existing logic before touching anything.
- If a test is failing, read the test first, then the implementation it exercises.
- Trace the data flow: where does the bug originate vs where does it surface?

### 3. Diagnose the root cause

- State the root cause clearly before writing any code.
- Check for common patterns:
  - **Frontend:** type errors, missing null checks, wrong API endpoint, broken auth token handling, SSR/CSR mismatch
  - **Backend:** EF Core query issue, missing validation, auth middleware bypassed, wrong HTTP status, null reference
  - **Infrastructure:** misconfigured resources, incorrect parameters, deployment failures  
- Do not guess. If unsure, read more code.

### 4. Implement the fix

- Make the minimal change that fixes the root cause. Do not refactor surrounding code.
- Do not suppress lint or type errors with comments (`// eslint-disable`, `#pragma warning`, `!` non-null assertions without reason).
- Do not use `any` in TypeScript.
- If the bug was caused by a missing edge case, add a guard — do not restructure the whole function.
- Cover the bug with test(s). If no test existed, add one that fails before the fix and passes after. If a test already exists, ensure it now passes.

### 5. Run the inner loop

Follow the **Agent Inner Loop** defined in `CLAUDE.md` for the affected stack (frontend, backend, or infrastructure). Run cheapest checks first; fix any failures before continuing. All steps must pass before the fix is considered complete.

### 6. Confirm the fix

- Re-read the original bug report and verify the fix addresses it.
- If a test was failing, confirm it now passes.
- If no test existed for this bug, note it — but do not add a test unless the user asks.

## Validation

- [ ] Root cause was identified and stated explicitly
- [ ] Only the minimal change was made
- [ ] No lint/type errors introduced
- [ ] All inner loop checks pass for the affected stack
- [ ] Fix addresses the reported behavior, not just a symptom

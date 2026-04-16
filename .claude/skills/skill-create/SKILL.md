---
name: skill-create
description: "Scaffolds a new agent skill directory and SKILL.md file following the agentskills.io specification. Use when creating a new skill, adding a reusable AI automation, writing a SKILL.md, defining a reusable workflow, or scaffolding a skill template."
compatibility: Requires file system write access.
metadata:
  author: oyvind
  version: "1.0"
---

## Instructions

When the user asks you to create a new skill, follow these steps:

### 1. Gather requirements

Determine the following from the user's request (ask if unclear):

- **Skill name** — kebab-case, 1-64 chars, lowercase alphanumeric + hyphens.
  Must not start/end with a hyphen or contain consecutive hyphens.
  Use the prefix taxonomy below to pick the right prefix for the skill name:

  | Prefix   | Scope                                                                      |
  |----------|----------------------------------------------------------------------------|
  | `code-`  | C# application code: domain modeling, API implementation, architectural validation |
  | `infra-` | Build system, CI/CD, infrastructure tasks                  |
  | `git-`   | Git workflows (commits, branches, PRs)                                     |
  | `skill-` | Skill scaffolding and management                                           |
- **What the skill does** — a clear description for the `description` field
  (max 1024 chars). Must describe both what the skill does AND when to use it.
  Include keywords that help agents match user requests.
- **Step-by-step instructions** — what should the agent do when this skill is
  activated?
- **Any prerequisites** — tools, permissions, or environment state needed.
- **Compatibility requirements** (optional) — specific agent products or system
  packages required.

### 2. Create the directory

Create the skill directory at `.claude/skills/<skill-name>/`.

The directory name **must** match the `name` field in the frontmatter exactly.

### 3. Write SKILL.md

Create `.claude/skills/<skill-name>/SKILL.md` with the following structure:

```markdown
---
name: <skill-name>
description: "<What this skill does and when to use it. Include semantic keywords. Keep to max 1024 chars.>"
compatibility: <Optional — environment requirements>
metadata:
  author: oyvind
  version: "1.0"
---

## Instructions

<Step-by-step instructions for the agent. Be specific and actionable.
Use numbered steps for sequential actions, bullets for alternatives.>

## Validation

<How to verify the skill executed correctly.>
```

**Note on description format:** Use double quotes around the description text (as shown above). Avoid YAML folded scalars (`>`) which can cause linting issues in some editors.

#### Frontmatter rules

- `name` and `description` are **required**.
- `description` must describe both purpose AND trigger conditions.
- All other frontmatter fields are optional.
- See the [spec](https://agentskills.io/specification) for full field details.

#### Body rules

- Keep the file under **500 lines**.
- Write instructions that are clear enough for any AI agent to follow.
- If the skill needs detailed reference material, create a `references/`
  subdirectory and link to files from the instructions.
- If the skill needs executable scripts, create a `scripts/` subdirectory.
- Use relative paths for all internal file references.

### 4. Create supporting directories (if needed)

Only create these if the skill requires them:

- `scripts/` — executable code the skill invokes
- `references/` — additional documentation loaded on demand
- `assets/` — templates, schemas, or static resources

### 5. Validate the skill

After creating the skill, verify:

- [ ] Directory name matches the `name` frontmatter field exactly
- [ ] `name` follows naming rules (lowercase, hyphens, no consecutive hyphens)
- [ ] `description` is 1-1024 chars and includes trigger keywords
- [ ] YAML frontmatter is valid (proper `---` delimiters, correct indentation)
- [ ] Instructions are clear, specific, and actionable
- [ ] File is under 500 lines
- [ ] No secrets, credentials, or production endpoints in any file
- [ ] No destructive commands without explicit user confirmation

### 6. Report back

Tell the user:

- The skill was created at `.claude/skills/<skill-name>/SKILL.md`
- Summarize the `name` and `description`
- Remind them to test the skill by asking an agent to perform a matching task
- Remind them to open a PR for review

## Review constraints

Skills created by this workflow are subject to the same review constraints as
all skills in this repository. The key constraints are:

- No secrets or credentials
- No production side-effects
- Scripts must be reviewed for safety
- Minimum necessary permissions
- Idempotent where possible

## Examples

**Example 1: User asks to create a PR skill**

Input: "Create a skill for making pull requests with our standard template"

Expected actions:
1. Create `.claude/skills/create-pr/SKILL.md`
2. Frontmatter `name: create-pr`
3. Frontmatter `description` mentions PR creation, pull requests, standard template
4. Instructions cover: branch check, commit analysis, PR title/body formatting, `gh pr create`
5. Validation: PR URL returned, checks pass

**Example 2: User asks to create a test-runner skill**

Input: "I want a skill that runs integration tests for a specific module"

Expected actions:
1. Create `.claude/skills/run-integration-tests/SKILL.md`
2. Frontmatter `name: run-integration-tests`
3. Frontmatter `description` mentions running tests, integration tests, module testing
4. Instructions cover: detecting the target module, running the right test command, reporting results
5. Validation: test output shown, pass/fail summary

---
name: db-migration-reviewer
description: Reviews new or modified DbUp SQL migration scripts for safety — destructive DDL, idempotency guards, Citus-incompatible operations, and multi-region rollout risk. Use when changes touch any DatabaseMigrator/Scripts/ directory.
model: sonnet
tools: Read, Grep, Glob
---

Follow the instructions in .github/skills/code-db-migration-review/SKILL.md

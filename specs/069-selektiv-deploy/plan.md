# Implementation Plan: Safe infrastructure deploys and per-app deploys

## Approach
Two independent halves, both in CI/IaC only:
1. **Image + registry preservation.** `infrastructure.yml` reads each app's running image and passes it to Bicep. Bicep falls back to the placeholder only for apps that don't exist yet. Bicep also declares the GHCR registry, so a full ARM replace keeps it.
2. **Per-app change detection.** A shared bash script compares each app's paths between the commit of the running image (taken from its tag) and `HEAD`. The two app workflows gate their build, migrate and deploy jobs on its outputs.

A shared concurrency group stops the infra workflow and the app workflows from racing.

## Stacks Affected
- [ ] Frontend
- [ ] Backend
- [x] Infrastructure (Bicep + GitHub Actions)

## Key Decisions
- **Read images in the workflow, not in Bicep.** Bicep `existing` fails when the resource is missing, and there is no "if exists". The workflow can default to `''`.
- **Diff against the running image's commit, not `github.event.before`.** That's self-healing: a failed deploy or a manual infra rollback is retried on the next push, and pushes with several commits work too.
- **When unsure, deploy.** An unknown SHA, placeholder or missing commit counts as changed. A needless deploy is cheap, and a missed one is a bug in production.
- **No new Actions dependency** (`dorny/paths-filter` etc.). The logic is about 40 lines of bash and has to call `az` anyway to find the running SHA.
- **Keep two app workflows.** They already deploy independently, and merging them is churn this feature doesn't need.
- **Skipped-needs pattern** `!failure() && !cancelled() && <flag>` on every downstream job, so skipped jobs before them don't skip them too.

## Risks
- **Bicep and the CLI fight over the registry secret** (duplicate secrets, or the password reverts to a stale value). Mitigation: Task 1 inspects the live config and settles Q1 before Bicep changes.
- **Reading the image races with an app deploy.** Mitigation: a shared `concurrency: deploy-prod` group (R14).
- **Shallow clone breaks `git diff`.** Mitigation: `fetch-depth: 0` in the `changes` job.
- **The tag format changes later** (e.g. someone switches to `latest`). The SHA lookup then fails and everything deploys, which is safe but wasteful. The summary shows "unknown running commit", so it's visible.
- **Testing needs real Azure.** Workflows can't be run locally. Mitigation: unit-test the bash script against a local git repo with fake inputs, then check one real run of each workflow after merge (Task 6).

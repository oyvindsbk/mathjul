# Feature: Safe infrastructure deploys and per-app deploys

## Summary
Re-running **Deploy Infrastructure** keeps the four running apps (recipe API, recipe web, Notater API, Notater web) on their current images and registry credentials, and the app deploy workflows build and deploy only the apps whose code changed since the image now running.

## Motivation
- **Infra deploys take the site down.** Every Container App module sets `image: containerImage`, which defaults to `mcr.microsoft.com/dotnet/samples:aspnetapp`. ARM replaces the whole app, so each infra run swaps all four apps to the sample image until someone runs both app workflows again (DEPLOYMENT.md says so). The same full replace also drops the GHCR registry and its password secret, which the app workflows add with `az containerapp registry set`, because the templates have no `registries` block.
- **Infra deploys also remove domains and reset settings.** A custom domain is kept only if `FRONTEND_CUSTOM_DOMAIN` (or `NOTES_CUSTOM_DOMAIN`) is set for the run. If it's empty, Bicep sends `customDomains: []` and the binding is deleted. This has happened: the recipe app's domain was gone after an infra deploy. If the certificate variable is empty, the binding loses TLS. The recipe API's CORS list and share base URL are reset to `FRONTEND_URL` (one origin), because the step that fixed them after deploy was removed in `2da3d22`. The comment in `container-app.bicep` still describes that step.
- **App deploys do too much.**
  - `deploy.yml` triggers on `backend/**`, which matches `backend/NotesApi/**` and both test projects, so a Notater change rebuilds and redeploys the recipe apps.
  - Inside `deploy.yml`, the recipe API, EF migration and recipe web always all run, even when only the frontend changed.
  - `deploy-notes.yml` always builds and deploys both Notater apps and runs the Notater migration.

## Current state (verified 2026-11-25, branch `068-notater`)

| Piece | Today |
|---|---|
| `infrastructure.yml` | Manual (`workflow_dispatch`). Deploys `main.bicep` and passes no image parameters |
| Bicep modules | `container-app.bicep`, `frontend-container-app.bicep`, `notes-api-container-app.bicep`, `notes-web-container-app.bicep` each have a `containerImage` param with the sample image as default, and none has `registries` |
| `deploy.yml` | Triggers on `backend/**`, `frontend/**` and itself. Jobs: get-resources → build API + build web → deploy API → migrate → deploy web. Image tag `ghcr.io/<repo>/recipe-api:<branch>-<sha7>` (recipe-frontend likewise) |
| `deploy-notes.yml` | Triggers on `backend/NotesApi/**`, `frontend-notes/**` and itself. Matrix builds both images. Tag `ghcr.io/<repo>/notes-{api,web}:<branch>-<full sha>` |
| Registry auth | `az containerapp registry set ... --password ${{ secrets.GHCR_TOKEN }}` before every image update |

## Requirements

### Infrastructure deploys keep the apps running
- R1: When a Container App already exists, Deploy Infrastructure leaves its image exactly as it was: same registry, repository and tag.
- R2: When a Container App doesn't exist yet (first deploy, or Notater switched on for the first time), it gets the placeholder image, as today.
- R3: The GHCR registry and its password survive an infra deploy. The registry is declared in the templates, and its password comes from the `GHCR_TOKEN` secret.
- R4: An infra deploy still creates a new revision when it changes the template (env vars, probes, resources). The new revision runs the preserved image, so it is the same app with its new settings.
- R5: DEPLOYMENT.md no longer says to rerun the app workflows after an infra deploy.

### Infrastructure deploys keep domains and app settings
- R5a: Before Bicep runs, a guard step reads the live `ingress.customDomains` of recipe-web and notes-web. If the deploy would remove a bound domain, change its hostname, or turn `SniEnabled` into `Disabled` (because a variable is empty or different), the workflow fails before deploying, names the variable to set, and prints its live value.
- R5b: The recipe API's CORS origins come from Bicep: the custom domain (if set) and the frontend's ingress fqdn, written to `Cors__AllowedOrigins__0..n`. `Sharing__PublicBaseUrl` is the custom domain, with `FRONTEND_URL` as the fallback. No step after deploy changes them. The placeholder `https://placeholder-update-after-deployment.com` is removed. If the recipe API already exists and there's no origin to allow (custom domain, `FRONTEND_URL` and fqdn all empty), the guard fails the deploy. This has happened: an infra deploy with `FRONTEND_URL` unset wrote the placeholder to `Cors__AllowedOrigins__0` and `Sharing__PublicBaseUrl` in production.
- R5c: The outdated comment in `container-app.bicep` about a post-deploy step is corrected.
- R5d: DEPLOYMENT.md lists every variable and secret the workflows read, what it's for, and whether it lives on the repository or on the `prod` environment. The app workflows have no `environment:`, so they only see repository variables. It also explains how to find the managed certificate's name (environment → Certificates).

### App deploys only touch what changed
- R6: Each of the four apps has its own set of source paths:

  | App | Paths |
  |---|---|
  | recipe-api | `backend/RecipeApi/**` |
  | recipe-web | `frontend/**` |
  | notes-api | `backend/NotesApi/**` |
  | notes-web | `frontend-notes/**` |

  Test projects (`backend/*.Tests/**`), specs, docs and `infrastructure/**` never trigger an app deploy.
- R7: An app is built and deployed only if its paths changed between the commit of the image it's running now and the commit being deployed. Comparing against the running image's commit, not just the push's `before`, means a failed or skipped deploy is retried on the next push.
- R8: If the running commit can't be found (placeholder image, tag without a SHA, commit missing after a force-push, app missing), that app is deployed. When unsure, deploy.
- R9: A change to an app's own workflow file deploys every app in that workflow.
- R10: The EF migration for an API runs only when that API is deployed (migrations live in the API project).
- R11: A skipped job doesn't block the jobs after it. For example, recipe-web still deploys when recipe-api and its migration are skipped. A failed job still blocks them.
- R12: `workflow_dispatch` has a `force` input (boolean, default false) that deploys every app in the workflow no matter what changed.
- R13: The run summary (`$GITHUB_STEP_SUMMARY`) shows, per app, whether it was deployed or skipped, and why (changed paths, unknown running commit, forced, unchanged).

### Running two workflows at once
- R14: Deploy Infrastructure and the two app workflows share one concurrency group (`deploy-prod`, `cancel-in-progress: false`), so an infra deploy can't read an image, then have an app deploy replace it, then write the old image back.

## Design

### Image preservation (R1–R4)
`infrastructure.yml` gets a "Read current images" step before Bicep. For each of the four app names (same name logic as `main.bicep`, or found by `az containerapp list` with `contains(name, ...)` as the app workflows do), it runs:

```bash
az containerapp show -n "$APP" -g "$RG" --query "properties.template.containers[0].image" -o tsv 2>/dev/null || echo ""
```

The four values are passed to `main.bicep` as new params `recipeApiImage`, `recipeWebImage`, `notesApiImage` and `notesWebImage`, which default to `''`. `main.bicep` forwards each one to its module's `containerImage` as `empty(x) ? placeholder : x`. The placeholder string lives in one `var` in `main.bicep`.

Why read in the workflow and not with a Bicep `existing` reference: an `existing` reference to an app that doesn't exist yet fails the deploy, and Bicep has no "if exists" check. The workflow handles that case in one line.

Registries (R3): new secure param `ghcrToken` (default `''`) and param `ghcrUsername` (default `''`), passed to the four modules. When both are set, a module adds:

```bicep
secrets: [ ..., { name: 'ghcr-password', value: ghcrToken } ]
registries: [ { server: 'ghcr.io', username: ghcrUsername, passwordSecretRef: 'ghcr-password' } ]
```

When they're empty, the module leaves out both blocks, which is today's behaviour, so a local `az deployment` without the token still works. The secret name has to line up with what `az containerapp registry set` creates, or the two will each keep their own secret. See Q1.

### Domain guard and CORS (R5a–R5d)
The guard is a bash step in `infrastructure.yml` next to "Read current images". It reads `properties.configuration.ingress.customDomains[].{name,bindingType,certificateId}` for both web apps and compares that with `FRONTEND_CUSTOM_DOMAIN`/`_CERT` and `NOTES_CUSTOM_DOMAIN`/`_CERT`. It compares the certificate by the last segment of `certificateId`. If the app doesn't exist yet, there's nothing to check.

CORS: the frontend fqdn can't come from the frontend module's output, because the frontend module already uses the API module's output and that would make a cycle. Options for Task 2:
- (a) Compute the fqdn from the frontend app name and the frontend environment's `defaultDomain`. The environment is created inside the frontend module, so this needs an `existing` lookup, which fails on first deploy.
- (b) Have the workflow pass the live fqdn in, the same way it passes images.
- (c) Allow only the custom domain (plus `FRONTEND_URL`) and stop allowing the fqdn.

**Proposal:** (b), with an empty value meaning "leave it out". This matches the image approach.

### Change detection (R6–R13)
Each app workflow gets a first job, `changes`, that:
1. Checks out with `fetch-depth: 0`.
2. For each app, reads the running image with `az containerapp show` and takes the SHA from the end of the tag (text after the last `-`; recipe tags use 7 characters, Notater tags the full SHA, and `git rev-parse` resolves both).
3. Decides per app: `force` → deploy; SHA unknown or `git cat-file -e "$SHA^{commit}"` fails → deploy; `git diff --quiet "$SHA" HEAD -- <paths> <own workflow file>` reports changes → deploy; otherwise skip.
4. Outputs `recipe-api=true|false` and so on, and writes the summary table.

The script is plain bash in the workflow (no new action dependency). It sits in `.github/scripts/changed-since-deployed.sh` and is shared by both workflows.

Downstream jobs use `if: needs.changes.outputs.<app> == 'true'`. Jobs that `needs` a job that may be skipped use `if: ${{ !failure() && !cancelled() && needs.changes.outputs.<app> == 'true' }}`, so a skipped job before them doesn't skip them too (R11).

Workflow triggers:
- `deploy.yml`: `paths: [backend/RecipeApi/**, frontend/**, .github/workflows/deploy.yml, .github/scripts/**]`
- `deploy-notes.yml`: `paths: [backend/NotesApi/**, frontend-notes/**, .github/workflows/deploy-notes.yml, .github/scripts/**]`

The trigger filter only decides whether a workflow starts. The `changes` job decides which apps are deployed.

### Data Model / API / UI
None.

## Out of Scope
- Creating the managed certificate in Bicep. Azure only issues it after the hostname is attached to the app, so it stays a manual step done once in the portal. Bicep only references it by name, and the guard (R5a) protects it.
- Deploying infrastructure automatically when `infrastructure/**` changes (stays manual).
- Merging the two app workflows into one.
- Running tests in CI before deploy.
- Rebuilding recipe-web when the recipe API's URL changes (it's baked in at build time). Use `force`.
- Moving registry auth to a managed identity or ACR.

## Open Questions
- Q1: Registry secret name. `az containerapp registry set` names the password secret after the server and user (e.g. `ghcrio-<user>`). Either Bicep uses that exact name, or Bicep owns the registry and the app workflows stop calling `registry set`. **Proposal:** Bicep owns it, and the app workflows keep `registry set` only as a fallback for apps deployed before this change. Check against the live app in Task 1 (`az containerapp show --query properties.configuration.registries`).
- Q2: Are the GHCR packages private? If they're public, R3 isn't needed and `ghcrToken` can be left out. **Proposal:** keep R3 either way, since it costs little and stays correct if the visibility changes.
- Q3: Should this branch be cut from `068-notater` (it is) and merged after it? `deploy-notes.yml` and the Notater modules only exist there.

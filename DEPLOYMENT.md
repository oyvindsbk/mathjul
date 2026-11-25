# Azur```
📁 mathjul/
├── infrastructure/              # Bicep templates
│   ├── main.bicep              # Main orchestration
│   ├── modules/                # Modular Bicep files
│   └── README.md               # Infrastructure documentation
├── scripts/                     # Deployment helper scripts
│   ├── setup.sh                # Initial Azure setup
│   └── README.md               # Scripts documentation
├── .github/workflows/          # GitHub Actions CI/CD
│   ├── infrastructure.yml      # Deploy infrastructure
│   └── deploy.yml              # Deploy application
├── backend/RecipeApi/
│   └── Dockerfile              # Container image for backend
└── frontend/                   # Next.js frontend
```

This guide covers the complete Azure deployment setup for the Recipe App using Bicep (Infrastructure as Code) and GitHub Actions.

## 📁 Project Structure

```
mathjul/
├── infrastructure/              # Bicep templates
│   ├── main.bicep              # Main orchestration
│   ├── modules/                # Modular Bicep files
│   └── README.md               # Infrastructure documentation
├── scripts/                     # Deployment helper scripts
│   ├── setup.sh                # Initial Azure setup
│   ├── get-connection-string.sh # Get SQL connection string
│   ├── cleanup.sh              # Delete resources
│   └── README.md               # Scripts documentation
├── .github/workflows/          # GitHub Actions CI/CD
│   ├── infrastructure.yml      # Deploy infrastructure
│   └── deploy.yml              # Deploy application
├── backend/RecipeApi/
│   └── Dockerfile              # Container image for backend
└── frontend/                   # Next.js frontend
```

## 🚀 Quick Start

### 1. Initial Setup

Run the setup script to create Azure service principal and collect configuration:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This will output all the GitHub Secrets you need to configure.

### 2. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets (values from setup script output):

- `AZURE_CREDENTIALS` - Service principal JSON
- `SQL_ADMIN_USERNAME` - SQL admin username
- `SQL_ADMIN_PASSWORD` - SQL admin password (min 12 chars, complex)
- `AZURE_OPENAI_ENDPOINT` - Your Azure OpenAI endpoint
- `AZURE_OPENAI_KEY` - Your Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - e.g., "gpt-4.1-nano"

### 3. Deploy Infrastructure

Via GitHub Actions:
1. Go to Actions → "Deploy Infrastructure"
2. Click "Run workflow"
3. Select environment (dev/prod)
4. Click "Run workflow"

Or via CLI:
```bash
gh workflow run infrastructure.yml -f environment=dev
```

### 4. Get SQL Connection String

After infrastructure deployment completes, get the connection string from:

**Option 1: Azure Portal**
1. Go to your SQL Database in Azure Portal
2. Settings → Connection strings
3. Copy the ADO.NET connection string
4. Replace `{your_password}` with your actual password

**Option 2: Azure CLI**
```bash
az sql db show-connection-string \
  --client ado.net \
  --server <sql-server-name> \
  --name RecipeDb
```

Then manually construct the full connection string with your credentials.

Add the connection string to GitHub Secrets as `AZURE_SQL_CONNECTION_STRING`

### 5. Deploy Application

Push to main branch or manually trigger:

```bash
gh workflow run deploy.yml -f environment=dev
```

## 🏗️ Infrastructure Components

### Azure Resources Created:

| Resource | SKU | Monthly Cost | Purpose |
|----------|-----|--------------|---------|
| SQL Database | Basic | ~$5 | Recipe data storage |
| Container Apps | 0.25 vCPU, 0.5GB | ~$0-2 | Backend API |
| Log Analytics | Pay-as-you-go | ~$0-1 | Logging and monitoring |
| Key Vault | Standard | $0 | Secure secret storage |
| Static Web App | Free | $0 | Frontend hosting |
| **Total** | | **~$5-8/month** | |

### Security Features:

✅ **Azure Key Vault** - All secrets stored securely  
✅ **Managed Identity** - No credentials in code  
✅ **RBAC** - Role-based access control  
✅ **HTTPS Only** - All traffic encrypted  
✅ **Soft Delete** - 7-day recovery for secrets  

## 📋 Deployment Workflows

All three workflows share the concurrency group `deploy-prod`, so they never run at the same time. GitHub keeps only one waiting run per group: if a third run is queued while one runs and one waits, the waiting one is cancelled. In that case, rerun it.

### Infrastructure Workflow (`infrastructure.yml`)
- Manually triggered. Deploys `infrastructure/main.bicep`.
- **Keeps the running apps.** A preflight step (`.github/scripts/infra-preflight.sh`) reads the image each Container App runs and passes it to Bicep, so the apps stay on their current image. Only an app that doesn't exist yet gets the placeholder. The GHCR registry is declared in the template too (`GHCR_TOKEN`), so the apps can still pull afterwards. You don't need to rerun the app workflows after an infra deploy.
- **Refuses to break a domain.** If a web app has a custom domain bound and `FRONTEND_CUSTOM_DOMAIN`/`_CERT` (or `NOTES_CUSTOM_DOMAIN`/`_CERT`) are empty or different, the preflight fails, names the variable and its live value, and nothing is deployed. It also fails if the recipe API would be left with no CORS origin.
- **Owns the recipe API's CORS and share links.** `Cors__AllowedOrigins__N` gets the custom domain, `FRONTEND_URL` and the frontend's ingress URL, and `Sharing__PublicBaseUrl` the custom domain (or `FRONTEND_URL`). Values set by hand in the portal are overwritten on the next infra deploy. Change the variables instead.

### Application Workflows (`deploy.yml`, `deploy-notes.yml`)
- Trigger on push to `main` when their own app's code changes:

  | Workflow | App | Paths |
  |---|---|---|
  | `deploy.yml` | recipe-api | `backend/RecipeApi/**` |
  | `deploy.yml` | recipe-web | `frontend/**` |
  | `deploy-notes.yml` | notes-api | `backend/NotesApi/**` |
  | `deploy-notes.yml` | notes-web | `frontend-notes/**` |

- **Only changed apps are deployed.** The `changes` job (`.github/scripts/changed-since-deployed.sh`) takes the commit from the running image's tag and diffs the app's paths against it. A change to the workflow file itself, or to `.github/scripts/`, deploys every app in that workflow. If the running commit can't be found (placeholder, unknown tag), the app is deployed. The run summary lists each app and why it was deployed or skipped.
- An API's migration runs only when that API is deployed.
- **Run workflow** has a `force` option that deploys every app in the workflow, e.g. after the recipe API's URL changes (it is baked into the frontend image).

### Variables and secrets

Settings → Secrets and variables → Actions. Put them on the **repository**, not on the `prod` environment: only `infrastructure.yml` runs in `prod`, so the app workflows can't see environment-level values.

| Name | Kind | Used by | What |
|---|---|---|---|
| `AZURE_CREDENTIALS` | secret | all | Service principal JSON for `azure/login` |
| `GHCR_TOKEN` | secret | all | Token with `read:packages`. The apps pull images from ghcr.io with it |
| `AZURE_SQL_CONNECTION_STRING` | secret | app workflows | Admin connection for EF migrations |
| `SQL_ADMIN_USERNAME`, `SQL_ADMIN_PASSWORD` | secret | infra | SQL server admin |
| `JWT_SECRET_KEY` | secret | infra | Recipe API token signing (to Key Vault) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | secret | infra | Google sign-in, both web apps |
| `NOTES_JWT_SECRET_KEY` | secret | infra | Notater token signing. Empty: Notater isn't deployed |
| `NOTES_ALLOWED_EMAILS` | secret | infra | Who may sign in to Notater |
| `FRONTEND_CUSTOM_DOMAIN` | variable | infra | e.g. `mathjul.kheradmandi.no`, without `https://`. **Required once a domain is bound** |
| `FRONTEND_CUSTOM_DOMAIN_CERT` | variable | infra | Name of the managed certificate for that domain (see below). **Required once it has TLS** |
| `FRONTEND_URL` | variable | infra | Public frontend URL with `https://`, no trailing slash. CORS origin and share-link base when there's no custom domain |
| `PUBLIC_APP_URL` | variable | `deploy.yml` | Same URL as above. Printed after the frontend deploy |
| `NOTES_CUSTOM_DOMAIN`, `NOTES_CUSTOM_DOMAIN_CERT` | variable | infra | Same as the frontend's, for Notater |

**Finding the certificate name.** Portal → the Container Apps environment (`ca-recipe-web-prod-…-env` for the recipe frontend, `ca-recipe-api-prod-…-env` for Notater) → Certificates → Managed certificate. Copy the name column, e.g. `mc-ca-recipe-w-mathjul-kheradm-1234`. The certificate itself is created once in the portal (the app's Custom domains → Add, with a managed certificate). It isn't in Bicep, because Azure only issues it after the domain is attached to the app.

**A new web app shows "TargetPort 3000 does not match the listening port 8080"** until its first app deploy. The placeholder image listens on 8080. That's expected, and the next app deploy fixes it.

## 🔧 Manual Azure CLI Commands

### Deploy Infrastructure
```bash
az group create --name rg-recipe-app-dev --location westeurope

az deployment group create \
  --resource-group rg-recipe-app-dev \
  --template-file infrastructure/main.bicep \
  --parameters environment=dev \
    sqlAdminUsername=sqladmin \
    sqlAdminPassword='YourPassword123!' \
    azureOpenAIEndpoint='https://your-openai.openai.azure.com/' \
    azureOpenAIKey='your-key' \
    azureOpenAIDeploymentName='gpt-4.1-nano'
```

### Check Deployment Status
```bash
az deployment group show \
  --resource-group rg-recipe-app-dev \
  --name main \
  --query properties.provisioningState
```

### View Container App Logs
```bash
az containerapp logs show \
  --name ca-recipe-api-dev-xxxxx \
  --resource-group rg-recipe-app-dev \
  --follow
```

## 🧹 Cleanup

To delete all resources, use Azure Portal or Azure CLI:

**Via Azure Portal:**
1. Go to Resource Groups
2. Select `rg-recipe-app-dev` (or your resource group)
3. Click "Delete resource group"
4. Type the resource group name to confirm
5. Click "Delete"

**Via Azure CLI:**
```bash
az group delete --name rg-recipe-app-dev --yes --no-wait
```

**Note:** Key Vault has soft-delete enabled with 7-day retention, so it can be recovered if deleted accidentally.

## 🐛 Troubleshooting

### Infrastructure Deployment Fails

**Check Bicep syntax:**
```bash
az bicep build --file infrastructure/main.bicep
```

**View deployment errors:**
```bash
az deployment group show \
  --resource-group rg-recipe-app-dev \
  --name main \
  --query properties.error
```

### Container App Won't Start

**Check logs:**
```bash
az containerapp logs show \
  --name <container-app-name> \
  --resource-group rg-recipe-app-dev \
  --follow
```

**Common issues:**
- Container image not accessible (check GitHub Container Registry permissions)
- Port 8080 not exposed in Dockerfile
- Environment variables missing or incorrect
- Connection string format wrong

### Database Migration Fails

**Check connection string format:**
```
Server=tcp:SERVER.database.windows.net,1433;Initial Catalog=DB;User ID=USER;Password=PASS;Encrypt=True;
```

**Run migrations locally:**
```bash
cd backend/RecipeApi
dotnet ef database update --connection "YOUR_CONNECTION_STRING"
```

### Static Web App Build Fails

**Check build output location:**
- Next.js apps output to `.next`
- Verify in `staticwebapp.config.json`

**Check Node version:**
```bash
node --version  # Should be 18.x or 20.x
```

## 📚 Documentation

- [Infrastructure README](infrastructure/README.md) - Detailed Bicep documentation
- [Scripts README](scripts/README.md) - Deployment scripts guide
- [Azure Bicep Docs](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)

## 🔐 Security Best Practices

1. **Never commit secrets** to Git
2. **Use GitHub Secrets** for CI/CD
3. **Use Key Vault** for runtime secrets
4. **Use Managed Identity** instead of connection strings when possible
5. **Enable soft delete** on Key Vault (already configured)
6. **Rotate secrets regularly**
7. **Use complex passwords** for SQL Server (min 12 chars)

## 💰 Cost Optimization Tips

1. **Scale to zero** - Container Apps automatically scale down when idle
2. **Use Free tiers** - Static Web Apps and Key Vault have generous free tiers
3. **Basic SQL tier** - Sufficient for small apps, can upgrade later
4. **Log retention** - 30 days is usually enough for dev
5. **Delete dev resources** when not in use

## 🎯 Next Steps

After deployment:

1. **Configure custom domain** (optional)
   - See [infrastructure README](infrastructure/README.md#custom-domain-setup-optional)

2. **Set up monitoring**
   - Enable Application Insights
   - Configure alerts

3. **Add authentication**
   - Azure AD B2C
   - Auth0
   - Custom JWT

4. **Implement CI/CD for branches**
   - Deploy feature branches to separate environments

5. **Add integration tests**
   - Run tests in GitHub Actions before deployment

## 📞 Support

For issues:
1. Check GitHub Actions logs
2. Review Azure Portal for resource status
3. Verify GitHub Secrets are correctly configured
4. Check the troubleshooting sections in documentation

## 📝 Notater (work log app)

Notater is a separate app: `backend/NotesApi` and `frontend-notes`. It runs on the same resource group, the recipe API's Container Apps environment, and the same SQL database, with all of its tables in the `notes` schema. The API has internal ingress only, and the web app proxies to it. Nothing is deployed until `NOTES_JWT_SECRET_KEY` is set. Design: `specs/068-notater/`.

### One-time setup

1. **GitHub secrets.**
   - `NOTES_JWT_SECRET_KEY`: run `openssl rand -base64 48`. Use a different key from `JWT_SECRET_KEY`.
   - `NOTES_ALLOWED_EMAILS`: the Google account(s) allowed in, comma-separated with no spaces.
   - Optional variables: `NOTES_CUSTOM_DOMAIN` and `NOTES_CUSTOM_DOMAIN_CERT`, which work like the recipe frontend's.
2. **Infrastructure.** Run **Deploy Infrastructure**. The log prints the Notater URL and the API's name, which is also its identity's name, e.g. `ca-notes-api-prod-xxxx`.
3. **Google OAuth.** In the existing OAuth client (the same `GOOGLE_CLIENT_ID`), add the redirect URI `https://<notater-host>/api/auth/google/callback`.
4. **App and schema.** Run **Deploy Notater**. It builds both images, migrates the `notes` schema with `AZURE_SQL_CONNECTION_STRING`, then deploys.
5. **Database user for the API's identity.** Connect to `RecipeDb` as the server's Entra admin (Query editor in the portal, or Azure Data Studio), then run:
   ```sql
   CREATE USER [ca-notes-api-prod-xxxx] FROM EXTERNAL PROVIDER;
   GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::notes TO [ca-notes-api-prod-xxxx];
   ```
   The grant is deliberately rows-only and limited to `notes`. Schema changes run in CI with the admin connection.
6. **Import the OneNote history.** Run this on your own machine, since the export holds private notes and is gitignored.
   1. Sign in to Notater.
   2. In DevTools → Application → Cookies, copy the value of `notes_token`.
   3. Run the export and the import:
      ```bash
      cd tools/onenote-export
      cargo run --release -- "<path to the OneNote export>" out
      NOTES_TOKEN=<token> python -I notes_import.py out --url https://<notater-host>
      ```
   Re-running the import is safe: it replaces imported items per date and keeps anything written in the app. `out/import-report.txt` lists the corrected dates, attached pages and skipped pages.

### Notes
- **Re-running Deploy Infrastructure keeps the running Notater images** (see Deployment Workflows). Only a brand-new app starts on the placeholder until **Deploy Notater** runs.
- **Both apps scale to zero**, so the first request after idle takes a few seconds.
- **Locally**, `aspire run` starts Notater on http://localhost:3100 with a dev login. RecipeApi recreates the local database on every start, and that includes the notes schema.

---

**Estimated setup time:** 15-20 minutes  
**Estimated monthly cost:** ~$5-8 for dev environment

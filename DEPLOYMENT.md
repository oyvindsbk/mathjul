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
| Container Apps | 0.25 vCPU, 0.5GB | ~$0-2 | Backend API (scales to zero!) |
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

### Infrastructure Workflow
- Manually triggered
- Creates all Azure resources
- Uses Bicep templates
- Outputs resource URLs and names

### Application Workflow
- Auto-triggers on push to `main` branch
- Builds Docker image for backend
- Deploys to Container Apps
- Runs EF Core migrations
- Deploys frontend to Static Web Apps

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

---

**Estimated setup time:** 15-20 minutes  
**Estimated monthly cost:** ~$5-8 for dev environment

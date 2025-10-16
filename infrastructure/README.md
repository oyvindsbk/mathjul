# Infrastructure as Code (Bicep)

This folder contains Azure Bicep templates for deploying the Recipe App infrastructure.

## Structure

```
infrastructure/
├── main.bicep                      # Main orchestration file
└── modules/
    ├── key-vault.bicep            # Azure Key Vault for secrets
    ├── key-vault-access.bicep     # RBAC permissions for Key Vault
    ├── sql-server.bicep           # SQL Server and Database
    ├── container-app.bicep        # Azure Container Apps (Backend API)
    └── static-web-app.bicep       # Static Web Apps (Frontend)
```

## Resources Created

### 1. **Azure Key Vault**
- **SKU:** Standard
- **Cost:** Free (first 10,000 operations/month)
- **Purpose:** Secure storage for secrets (SQL connection string, OpenAI key)
- **Features:** RBAC enabled, soft delete (7 days retention)

### 2. **Azure SQL Database**
- **SKU:** Basic (5 DTU)
- **Cost:** ~$5/month
- **Size:** 2GB
- **Backup:** Local redundancy

### 3. **Azure Container Apps**
- **Resources:** 0.25 vCPU, 0.5GB RAM
- **Cost:** ~$0-2/month (scale to zero enabled)
- **Features:** Managed identity, auto-scaling (0-1 replicas)

### 4. **Log Analytics Workspace**
- **Retention:** 30 days
- **Cost:** ~$0-1/month (pay-as-you-go)

### 5. **Azure Static Web Apps**
- **SKU:** Free
- **Cost:** $0
- **Features:** Global CDN, automatic HTTPS

## Deployment

### Prerequisites

1. Azure CLI installed
2. Azure subscription
3. GitHub repository configured

### Manual Deployment

```bash
# Login to Azure
az login

# Create resource group
az group create \
  --name rg-recipe-app-dev \
  --location westeurope

# Deploy infrastructure
az deployment group create \
  --resource-group rg-recipe-app-dev \
  --template-file infrastructure/main.bicep \
  --parameters \
    environment=dev \
    sqlAdminUsername=sqladmin \
    sqlAdminPassword='YourSecurePassword123!' \
    azureOpenAIEndpoint='https://your-openai.openai.azure.com/' \
    azureOpenAIKey='your-key' \
    azureOpenAIDeploymentName='gpt-4.1-nano'
```

### GitHub Actions Deployment (Recommended)

Use the workflows in `.github/workflows/`:
1. `infrastructure.yml` - Deploy infrastructure
2. `deploy.yml` - Deploy application

## Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `environment` | string | Environment name (dev/prod) | dev |
| `location` | string | Azure region | Resource group location |
| `sqlAdminUsername` | string | SQL Server admin username | Required |
| `sqlAdminPassword` | securestring | SQL Server admin password | Required |
| `azureOpenAIEndpoint` | string | Azure OpenAI endpoint URL | Required |
| `azureOpenAIKey` | securestring | Azure OpenAI API key | Required |
| `azureOpenAIDeploymentName` | string | OpenAI deployment name | gpt-4.1-nano |

## Outputs

| Output | Description |
|--------|-------------|
| `keyVaultName` | Name of the Key Vault |
| `sqlServerFqdn` | Fully qualified domain name of SQL Server |
| `containerAppUrl` | URL of the backend API |
| `staticWebAppUrl` | URL of the frontend |
| `staticWebAppDeploymentToken` | Deployment token for Static Web App |

## Security Features

### 🔐 Secrets Management
- All secrets stored in Azure Key Vault
- Managed Identity for Container App (no credentials in code)
- RBAC-based access control

### 🛡️ Network Security
- SQL Server: Azure services allowed only
- Container App: HTTPS only, no insecure connections
- Key Vault: Soft delete enabled

### 📊 Monitoring
- Log Analytics integration
- Container App logs automatically collected
- 30-day retention

## Cost Optimization

### Scale to Zero
Container Apps automatically scale to zero when not in use, minimizing costs.

### Free Tiers Used
- Static Web Apps: Free tier
- Key Vault: First 10k operations free
- Log Analytics: First 5GB/month free

### Estimated Monthly Cost
- **Dev Environment:** ~$5-8/month
- **Prod Environment:** ~$10-15/month (if you increase replicas)

## Naming Conventions

Resources use a consistent naming pattern:
```
<resource-type>-<app-name>-<environment>-<unique-suffix>

Examples:
- sql-recipe-dev-abc123def
- ca-recipe-api-dev-abc123def
- kv-recipe-dev-abc123de
- stapp-recipe-dev-abc123def
```

## Custom Domain Setup (Optional)

To add a custom domain to Container Apps:

1. **Add CNAME record** in your DNS:
   ```
   api.yourdomain.com → ca-recipe-api-dev-xxxxx.westeurope.azurecontainerapps.io
   ```

2. **Add TXT record** for verification:
   ```
   asuid.api.yourdomain.com → <verification-code>
   ```

3. **Bind domain via CLI**:
   ```bash
   az containerapp hostname add \
     --name ca-recipe-api-dev-xxxxx \
     --resource-group rg-recipe-app-dev \
     --hostname api.yourdomain.com
   
   az containerapp hostname bind \
     --name ca-recipe-api-dev-xxxxx \
     --resource-group rg-recipe-app-dev \
     --hostname api.yourdomain.com \
     --environment ca-recipe-api-dev-xxxxx-env \
     --validation-method CNAME
   ```

Azure will automatically provision and manage SSL certificates!

## Troubleshooting

### Deployment Fails with "Name already exists"
Resource names must be globally unique. The Bicep uses `uniqueString()` to generate unique suffixes.

### Container App won't start
Check:
1. Container image exists and is accessible
2. Environment variables are set correctly
3. Port 8080 is exposed in the container
4. Check logs: `az containerapp logs show --name <name> --resource-group <rg>`

### Can't connect to SQL Database
1. Verify firewall rules allow Azure services
2. Check connection string is correct
3. Ensure managed identity has permissions

### Key Vault access denied
Container App needs "Key Vault Secrets User" role. This is automatically granted by the `key-vault-access.bicep` module.

## Further Reading

- [Azure Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/)
- [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/)

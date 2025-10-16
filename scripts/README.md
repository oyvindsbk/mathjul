# Deployment Scripts

This folder contains the setup script for Azure deployment.

## Prerequisites

- Azure CLI installed (`az`)
- An Azure subscription
- GitHub repository with access to manage secrets

## Script

### `setup.sh` - Initial Azure Setup

Sets up the Azure service principal and collects configuration for GitHub Actions deployment.

**Usage:**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

**What it does:**
- Logs you into Azure
- Creates a service principal for GitHub Actions
- Collects configuration (SQL credentials, OpenAI settings)
- Displays all GitHub Secrets you need to configure

**After running:**
1. Copy the output secrets to your GitHub repository (Settings → Secrets and variables → Actions)
2. Deploy infrastructure via GitHub Actions workflow

---

## Deployment Flow

1. **Initial Setup**
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```
   - Add secrets to GitHub

2. **Deploy Infrastructure** (via GitHub Actions)
   - Go to Actions → "Deploy Infrastructure" → Run workflow
   - Select environment (dev/prod)

3. **Get Connection String**
   - From Azure Portal: SQL Database → Connection strings
   - Or via CLI: `az sql db show-connection-string --client ado.net --server <server> --name <db>`
   - Add as `AZURE_SQL_CONNECTION_STRING` to GitHub Secrets

4. **Deploy Application** (via GitHub Actions)
   - Go to Actions → "Deploy Application" → Run workflow
   - Or push to `main` branch (auto-deploys)

---

## GitHub Secrets Required

After running `setup.sh`, add these to your GitHub repository:

- `AZURE_CREDENTIALS` - Service principal JSON
- `SQL_ADMIN_USERNAME` - SQL admin username
- `SQL_ADMIN_PASSWORD` - SQL admin password
- `AZURE_OPENAI_ENDPOINT` - OpenAI endpoint URL
- `AZURE_OPENAI_KEY` - OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Deployment name (e.g., gpt-4.1-nano)
- `AZURE_SQL_CONNECTION_STRING` - Connection string (from get-connection-string.sh)

---

## Troubleshooting

### "Azure CLI not found"
Install Azure CLI:
- macOS: `brew install azure-cli`
- Linux: See [Azure CLI docs](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- Windows: Download from [Azure CLI installer](https://aka.ms/installazurecliwindows)

### "Permission denied when running scripts"
Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### "Service principal creation failed"
Ensure you have Owner or Contributor role on your Azure subscription.

### "Cannot find resource group"
The infrastructure must be deployed first via GitHub Actions workflow.

### "How do I delete resources?"
Use Azure Portal or CLI:
```bash
az group delete --name rg-recipe-app-dev --yes --no-wait
```

---

## Cost Estimate

Running these scripts creates the following Azure resources:

| Resource | SKU | Monthly Cost |
|----------|-----|--------------|
| SQL Database | Basic | ~$5 |
| Container Apps | 0.25 vCPU, 0.5GB | ~$0-2 |
| Log Analytics | Pay-as-you-go | ~$0-1 |
| Key Vault | Standard | $0 (free tier) |
| Static Web App | Free | $0 |
| **Total** | | **~$5-8/month** |

---

## Support

For issues or questions:
1. Check the GitHub Actions workflow logs
2. Review Azure Portal for resource status
3. Verify all GitHub Secrets are correctly set

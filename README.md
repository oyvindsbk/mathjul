# Food Recipes Application

A full-stack recipe management application with AI-powered recipe extraction from images, built with ASP.NET Core, Next.js, and deployed to Azure.

## Features

- 📖 **Browse Recipes** - View a collection of delicious recipes
- 📸 **AI Recipe Extraction** - Upload a photo of a recipe and extract ingredients and instructions using Azure OpenAI
- 🔐 **Email Whitelist Authentication** - Secure access control using Google login with administrator-approved emails
- ☁️ **Azure Deployment** - Fully automated deployment with Bicep infrastructure as code
- 📊 **Observability** - Built-in logging and monitoring with Azure Application Insights

## Architecture

- **Frontend**: Next.js 15 with TypeScript, deployed to Azure Static Web Apps
- **Backend**: ASP.NET Core 9.0 Web API with vertical slice architecture, deployed to Azure Container Apps
- **Database**: Azure SQL Database with Entity Framework Core
- **AI**: Azure OpenAI GPT-4 for recipe extraction
- **Security**: Azure Key Vault for secrets management
- **Authentication**: Azure Static Web Apps built-in auth with Google provider
- **Local Dev**: .NET Aspire for orchestration with Docker SQL Server

## Project Structure

```
├── aspire/                          # .NET Aspire orchestration
│   └── FoodRecipesApp/             # Aspire host project
├── backend/                         # ASP.NET Core API
│   └── RecipeApi/
│       ├── Features/                # Vertical slices
│       │   └── Recipes/            # Recipe domain
│       └── Infrastructure/          # Cross-cutting concerns
├── frontend/                        # Next.js application
│   ├── src/
│   │   ├── app/                    # Next.js app router
│   │   └── components/             # React components
│   └── public/                     # Static assets
├── infrastructure/                  # Bicep templates
│   ├── main.bicep                  # Main orchestration
│   └── modules/                    # Reusable modules
├── .github/workflows/              # CI/CD pipelines
└── docs/                           # Documentation
```

## Getting Started

### Prerequisites

- .NET 9.0 SDK
- Node.js 18+
- Docker Desktop
- Azure CLI
- Azure subscription

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/oyvindsbk/mathjul.git
   cd mathjul
   ```

2. **Set up user secrets**
   ```bash
   cd backend/RecipeApi
   dotnet user-secrets set "AzureOpenAI:Endpoint" "https://your-instance.openai.azure.com/"
   dotnet user-secrets set "AzureOpenAI:ApiKey" "your-key"
   dotnet user-secrets set "AzureOpenAI:DeploymentName" "gpt-4.1-nano"
   ```

3. **Update approved emails** (for local testing)
   
   Edit `backend/RecipeApi/appsettings.Development.json`:
   ```json
   {
     "ApprovedEmails": [
       "your-email@gmail.com"
     ]
   }
   ```

4. **Start with Aspire**
   ```bash
   # From root directory
   dotnet run --project aspire/FoodRecipesApp/FoodRecipesApp.csproj
   ```
   
   Or use VS Code tasks:
   - Press `Cmd+Shift+P` > `Tasks: Run Task` > `start:aspire`

5. **Access the applications**
   - Aspire Dashboard: http://localhost:15112
   - Backend API: http://localhost:5238
   - Frontend: http://localhost:3000

### Azure Deployment

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for detailed authentication setup.

1. **Set up service principal**
   ```bash
   az ad sp create-for-rbac \
     --name "github-actions-recipe-app" \
     --role contributor \
     --scopes /subscriptions/{subscription-id}/resourceGroups/rg-recipe-app-prod \
     --sdk-auth
   ```

2. **Configure GitHub secrets**
   - `AZURE_CREDENTIALS` - Service principal JSON
   - `SQL_ADMIN_PASSWORD` - SQL Server password
   - `AZURE_OPENAI_KEY` - Azure OpenAI API key

3. **Deploy infrastructure**
   ```bash
   # Manual deployment
   az deployment group create \
     --resource-group rg-recipe-app-prod \
     --template-file infrastructure/main.bicep \
     --parameters \
       environment=prod \
       sqlAdminUsername=sqladmin \
       sqlAdminPassword='YourPassword!' \
       azureOpenAIEndpoint='https://your-instance.openai.azure.com/' \
       azureOpenAIKey='your-key' \
       approvedEmails='user1@gmail.com,user2@gmail.com'
   ```
   
   Or trigger the GitHub Actions workflow: `infrastructure.yml`

4. **Set up Google OAuth**
   - Create OAuth credentials in Google Cloud Console
   - Configure in Azure Static Web App > Configuration > Identity providers
   - See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for details

5. **Deploy application**
   
   Push to `main` branch to trigger automatic deployment via GitHub Actions.

## Authentication & Authorization

This application uses a **Google login with email whitelist** approach:

- ✅ Users log in with Google via Azure Static Web Apps
- ✅ Backend validates email against Key Vault whitelist
- ✅ Only approved users can upload recipes
- ✅ Anyone can view recipes (public access)

### Managing Approved Users

**Via Azure Portal:**
1. Go to Key Vault > Secrets > `approved-users`
2. Create new version with JSON array: `["email1@gmail.com","email2@gmail.com"]`

**Via Azure CLI:**
```bash
az keyvault secret set \
  --vault-name kv-recipe-prod-xxxxx \
  --name approved-users \
  --value '["user1@gmail.com","user2@gmail.com"]'
```

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for comprehensive guide.

## Available Scripts

### Backend

```bash
# Run backend API
dotnet run --project backend/RecipeApi/RecipeApi.csproj

# Run migrations
dotnet ef migrations add MigrationName --project backend/RecipeApi

# Run tests
dotnet test
```

### Frontend

```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Lint
npm run lint
```

### VS Code Tasks

- `start:aspire` - Start Aspire orchestration
- `start:dev` - Start backend and frontend separately
- `start:backend` - Backend API only
- `start:frontend` - Frontend only

## Environment Variables

### Backend (Production)

Set in Container App configuration:

- `ConnectionStrings__RecipeDb` - SQL connection string (from Key Vault)
- `AzureOpenAI__Endpoint` - Azure OpenAI endpoint
- `AzureOpenAI__ApiKey` - Azure OpenAI key (from Key Vault)
- `AzureOpenAI__DeploymentName` - Model deployment name
- `KeyVault__VaultUri` - Key Vault URI
- `Cors__AllowedOrigins__0` - Frontend URL

### Frontend (Build Time)

Set in Static Web App or GitHub Actions:

- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL

## Monitoring & Debugging

### View Container App Logs

```bash
az containerapp logs show \
  --name ca-recipe-api-prod-xxxxx \
  --resource-group rg-recipe-app-prod \
  --tail 50 \
  --follow
```

### Check Application Insights

Navigate to Azure Portal > Application Insights > your instance

## Cost Estimate

Monthly costs (approximate):

- **Azure SQL Database** (Basic tier): ~$5
- **Container Apps**: ~$0-2 (scale to zero when idle)
- **Static Web Apps**: Free tier
- **Key Vault**: ~$0.03
- **Azure OpenAI**: Pay per token usage

**Total**: ~$5-8/month + OpenAI usage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with Aspire
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Documentation

- [Authentication Guide](docs/AUTHENTICATION.md) - Comprehensive authentication setup
- [Copilot Instructions](.github/copilot-instructions.md) - GitHub Copilot workspace configuration

## Support

For issues or questions:
- Open an issue on GitHub
- Check the documentation in `docs/`
- Review Azure Container App logs for backend issues
- Check browser console for frontend issues

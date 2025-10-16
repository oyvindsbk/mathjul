#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Recipe App Azure Setup ===${NC}\n"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Login to Azure
echo -e "${BLUE}Logging in to Azure...${NC}"
az login

# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${GREEN}Using subscription: $SUBSCRIPTION_ID${NC}\n"

# Create service principal for GitHub Actions
echo -e "${BLUE}Creating service principal for GitHub Actions...${NC}"
SP_NAME="github-actions-recipe-app-$(date +%s)"

SP_JSON=$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --sdk-auth)

echo -e "${GREEN}Service principal created!${NC}"
echo -e "${BLUE}Add this to GitHub Secrets as 'AZURE_CREDENTIALS':${NC}"
echo "$SP_JSON"
echo ""

# Prompt for configuration
read -p "Enter SQL admin username (default: sqladmin): " SQL_ADMIN_USERNAME
SQL_ADMIN_USERNAME=${SQL_ADMIN_USERNAME:-sqladmin}

read -sp "Enter SQL admin password (min 12 chars, must include uppercase, lowercase, numbers, special chars): " SQL_ADMIN_PASSWORD
echo ""

read -p "Enter Azure OpenAI endpoint: " AZURE_OPENAI_ENDPOINT
read -sp "Enter Azure OpenAI API key: " AZURE_OPENAI_KEY
echo ""

read -p "Enter Azure OpenAI deployment name (default: gpt-4.1-nano): " AZURE_OPENAI_DEPLOYMENT_NAME
AZURE_OPENAI_DEPLOYMENT_NAME=${AZURE_OPENAI_DEPLOYMENT_NAME:-gpt-4.1-nano}

# Display GitHub Secrets to add
echo -e "\n${GREEN}=== GitHub Secrets Configuration ===${NC}"
echo -e "${BLUE}Add these secrets to your GitHub repository:${NC}\n"
echo "AZURE_CREDENTIALS:"
echo "$SP_JSON"
echo ""
echo "SQL_ADMIN_USERNAME:"
echo "$SQL_ADMIN_USERNAME"
echo ""
echo "SQL_ADMIN_PASSWORD:"
echo "$SQL_ADMIN_PASSWORD"
echo ""
echo "AZURE_OPENAI_ENDPOINT:"
echo "$AZURE_OPENAI_ENDPOINT"
echo ""
echo "AZURE_OPENAI_KEY:"
echo "$AZURE_OPENAI_KEY"
echo ""
echo "AZURE_OPENAI_DEPLOYMENT_NAME:"
echo "$AZURE_OPENAI_DEPLOYMENT_NAME"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo "1. Add the above secrets to your GitHub repository (Settings → Secrets and variables → Actions)"
echo "2. Run the 'Deploy Infrastructure' workflow from GitHub Actions"
echo "3. After infrastructure is deployed, get the SQL connection string and add it as AZURE_SQL_CONNECTION_STRING"
echo "4. Run the 'Deploy Application' workflow to deploy your app"

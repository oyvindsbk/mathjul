targetScope = 'resourceGroup'

@description('The environment name (dev, prod)')
param environment string = 'dev'

@description('The location for all resources')
param location string = resourceGroup().location

@description('The SQL Server administrator username')
param sqlAdminUsername string

@description('The SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('Azure OpenAI endpoint')
param azureOpenAIEndpoint string

@description('Azure OpenAI API key')
@secure()
param azureOpenAIKey string

@description('Azure OpenAI deployment name')
param azureOpenAIDeploymentName string = 'gpt-4.1-nano'

// Generate unique names
var uniqueSuffix = uniqueString(resourceGroup().id)
var sqlServerName = 'sql-recipe-${environment}-${uniqueSuffix}'
var sqlDatabaseName = 'RecipeDb'
var containerAppName = 'ca-recipe-api-${environment}-${uniqueSuffix}'
var staticWebAppName = 'stapp-recipe-${environment}-${uniqueSuffix}'
var keyVaultName = 'kv-recipe-${environment}-${take(uniqueSuffix, 8)}'

// Tags
var commonTags = {
  environment: environment
  application: 'recipe-app'
  managedBy: 'bicep'
}

// Key Vault (for secure secret storage)
module keyVault 'modules/key-vault.bicep' = {
  name: 'keyVaultDeployment'
  params: {
    keyVaultName: keyVaultName
    location: location
    tags: commonTags
  }
}

// SQL Server and Database
module sqlServer 'modules/sql-server.bicep' = {
  name: 'sqlServerDeployment'
  params: {
    sqlServerName: sqlServerName
    sqlDatabaseName: sqlDatabaseName
    location: location
    administratorLogin: sqlAdminUsername
    administratorLoginPassword: sqlAdminPassword
    keyVaultName: keyVault.outputs.keyVaultName
    tags: commonTags
  }
}

// Container App (Backend API)
module containerApp 'modules/container-app.bicep' = {
  name: 'containerAppDeployment'
  params: {
    containerAppName: containerAppName
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
    sqlConnectionString: sqlServer.outputs.connectionString
    azureOpenAIEndpoint: azureOpenAIEndpoint
    azureOpenAIKey: azureOpenAIKey
    azureOpenAIDeploymentName: azureOpenAIDeploymentName
    tags: commonTags
  }
}

// Grant Container App access to Key Vault
module keyVaultAccess 'modules/key-vault-access.bicep' = {
  name: 'keyVaultAccessDeployment'
  params: {
    keyVaultName: keyVault.outputs.keyVaultName
    principalId: containerApp.outputs.principalId
  }
}

// Static Web App (Frontend)
module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'staticWebAppDeployment'
  params: {
    staticWebAppName: staticWebAppName
    location: 'westeurope' // Static Web Apps not available in northeurope
    apiUrl: containerApp.outputs.containerAppUrl
    tags: commonTags
  }
}

// Outputs
output keyVaultName string = keyVault.outputs.keyVaultName
output sqlServerFqdn string = sqlServer.outputs.sqlServerFqdn
output containerAppUrl string = containerApp.outputs.containerAppUrl
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl
output staticWebAppDeploymentToken string = staticWebApp.outputs.deploymentToken

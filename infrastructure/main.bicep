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

@description('Initial approved email addresses for access control (comma-separated)')
param approvedEmails string = ''

@description('Google OAuth Client ID')
@secure()
param googleClientId string = ''

@description('Google OAuth Client Secret')
@secure()
param googleClientSecret string = ''

@description('JWT Secret Key for backend token signing')
@secure()
param jwtSecretKey string

// Generate unique names
var uniqueSuffix = uniqueString(resourceGroup().id)
var sqlServerName = 'sql-recipe-${environment}-${uniqueSuffix}'
var sqlDatabaseName = 'RecipeDb'
var containerAppName = 'ca-recipe-api-${environment}-${uniqueSuffix}'
var frontendContainerAppName = 'ca-recipe-web-${environment}-${uniqueSuffix}'
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
    approvedEmails: empty(approvedEmails) ? '[]' : '["${replace(approvedEmails, ',', '","')}"]'
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
    jwtSecretKey: jwtSecretKey
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

// Frontend Container App
module frontendContainerApp 'modules/frontend-container-app.bicep' = {
  name: 'frontendContainerAppDeployment'
  params: {
    containerAppName: frontendContainerAppName
    location: location
    backendApiUrl: containerApp.outputs.containerAppUrl
    googleClientId: googleClientId
    googleClientSecret: googleClientSecret
    tags: commonTags
  }
}

// Outputs
output keyVaultName string = keyVault.outputs.keyVaultName
output sqlServerFqdn string = sqlServer.outputs.sqlServerFqdn
output containerAppUrl string = containerApp.outputs.containerAppUrl
output frontendUrl string = frontendContainerApp.outputs.containerAppUrl
output frontendContainerAppName string = frontendContainerApp.outputs.containerAppName

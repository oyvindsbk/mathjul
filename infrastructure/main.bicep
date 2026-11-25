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

@description('Google OAuth Client ID')
@secure()
param googleClientId string = ''

@description('Google OAuth Client Secret')
@secure()
param googleClientSecret string = ''

@description('JWT Secret Key for backend token signing')
@secure()
param jwtSecretKey string

@description('Frontend URL for CORS (leave empty on first deploy, then set after frontend is deployed)')
param frontendUrl string = ''

@description('Custom domain for the frontend, e.g. mathjul.kheradmandi.no. Must be declared here -- ARM strips any binding made outside the template.')
param frontendCustomDomainName string = ''

@description('Managed certificate name for frontendCustomDomainName. Leave empty to bind without TLS (domain validation only).')
param frontendCustomDomainCertificateName string = ''

@description('Notater: JWT signing key. Leave empty to skip deploying the Notater apps.')
@secure()
param notesJwtSecretKey string = ''

@description('Notater: comma-separated emails allowed to sign in.')
@secure()
param notesAllowedEmails string = ''

@description('Notater: custom domain, e.g. notater.kheradmandi.no. Empty: generated hostname only.')
param notesCustomDomainName string = ''

@description('Notater: managed certificate name for notesCustomDomainName.')
param notesCustomDomainCertificateName string = ''

// Running images. infrastructure.yml reads them from the live apps, so an infra deploy keeps
// each app on the image it already runs. Empty means the app does not exist yet: placeholder.
@description('Image the recipe API runs now. Empty: placeholder (first deploy).')
param recipeApiImage string = ''

@description('Image the recipe frontend runs now. Empty: placeholder (first deploy).')
param recipeWebImage string = ''

@description('Image the Notater API runs now. Empty: placeholder (first deploy).')
param notesApiImage string = ''

@description('Image the Notater web app runs now. Empty: placeholder (first deploy).')
param notesWebImage string = ''

@description('GHCR user the apps pull images as. Empty (with ghcrToken): no registry is declared.')
param ghcrUsername string = ''

@description('GHCR token (read:packages). Declared in the template so an infra deploy keeps the registry.')
@secure()
param ghcrToken string = ''

@description('Live ingress URL of the recipe frontend (https://<fqdn>), read by infrastructure.yml. Allowed by CORS next to the custom domain.')
param frontendFqdnUrl string = ''

// Generate unique names
var uniqueSuffix = uniqueString(resourceGroup().id)
var sqlServerName = 'sql-recipe-${environment}-${uniqueSuffix}'
var sqlDatabaseName = 'RecipeDb'
var containerAppName = 'ca-recipe-api-${environment}-${uniqueSuffix}'
var frontendContainerAppName = 'ca-recipe-web-${environment}-${uniqueSuffix}'
var keyVaultName = 'kv-recipe-${environment}-${take(uniqueSuffix, 8)}'
var storageAccountName = 'strecipe${environment}${take(uniqueSuffix, 8)}'
// Container App names are capped at 32 characters; these are 31.
var notesApiName = 'ca-notes-api-${environment}-${uniqueSuffix}'
var notesWebName = 'ca-notes-web-${environment}-${uniqueSuffix}'
var deployNotes = !empty(notesJwtSecretKey)

// Placeholder for apps that do not exist yet. It listens on 8080, so the web apps (3000)
// fail activation until their first app deploy -- expected.
var placeholderImage = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

// Origins the browser loads the recipe frontend from, for the API's CORS policy. The fqdn
// cannot come from frontendContainerApp's output (that module depends on the API's), so
// the workflow passes it in.
var frontendCustomDomainUrl = !empty(frontendCustomDomainName) ? 'https://${frontendCustomDomainName}' : ''
var apiCorsOrigins = union(filter([frontendCustomDomainUrl, frontendUrl, frontendFqdnUrl], o => !empty(o)), [])
var publicBaseUrl = !empty(frontendCustomDomainUrl)
  ? frontendCustomDomainUrl
  : (!empty(frontendUrl) ? frontendUrl : frontendFqdnUrl)

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
// sqlConnectionString is no longer passed here — it's stored in Key Vault by sql-server.bicep
// and loaded by the backend via AddAzureKeyVault at startup.
module containerApp 'modules/container-app.bicep' = {
  name: 'containerAppDeployment'
  params: {
    containerAppName: containerAppName
    location: location
    keyVaultName: keyVault.outputs.keyVaultName
    jwtSecretKey: jwtSecretKey
    corsAllowedOrigins: apiCorsOrigins
    publicBaseUrl: publicBaseUrl
    blobStorageAccountName: storageAccountName
    containerImage: !empty(recipeApiImage) ? recipeApiImage : placeholderImage
    registryUsername: ghcrUsername
    registryPassword: ghcrToken
    tags: commonTags
  }
}

// Origins the frontend is served from: the custom domain and the Container App
// fqdn (taken from the module, so it is right even when frontendUrl is unset).
var frontendOrigins = filter(
  [
    !empty(frontendCustomDomainName) ? 'https://${frontendCustomDomainName}' : ''
    frontendContainerApp.outputs.containerAppUrl
  ],
  origin => !empty(origin)
)

// Blob Storage for recipe images
module storage 'modules/storage.bicep' = {
  name: 'storageDeployment'
  params: {
    storageAccountName: storageAccountName
    location: location
    backendPrincipalId: containerApp.outputs.principalId
    tags: commonTags
    corsAllowedOrigins: frontendOrigins
  }
}


// Note: Key Vault role assignment (Key Vault Secrets User) is a one-time setup.
// Run modules/key-vault-access.bicep manually if the Container App managed identity changes.

// Frontend Container App
module frontendContainerApp 'modules/frontend-container-app.bicep' = {
  name: 'frontendContainerAppDeployment'
  params: {
    containerAppName: frontendContainerAppName
    location: location
    backendApiUrl: containerApp.outputs.containerAppUrl
    googleClientId: googleClientId
    googleClientSecret: googleClientSecret
    customDomainName: frontendCustomDomainName
    customDomainCertificateName: frontendCustomDomainCertificateName
    // The OAuth redirect URI must name the host users actually arrive on, so the custom
    // domain wins when there is one. Falls back to frontendUrl (the fqdn) otherwise.
    appUrl: !empty(frontendCustomDomainName) ? 'https://${frontendCustomDomainName}' : frontendUrl
    containerImage: !empty(recipeWebImage) ? recipeWebImage : placeholderImage
    registryUsername: ghcrUsername
    registryPassword: ghcrToken
    tags: commonTags
  }
}

// Notater: a separate app on the same database (schema "notes") and in the recipe API's
// Container Apps environment. The API has internal ingress; only the web app is public.
module notesApi 'modules/notes-api-container-app.bicep' = if (deployNotes) {
  name: 'notesApiDeployment'
  params: {
    containerAppName: notesApiName
    location: location
    environmentId: containerApp.outputs.environmentId
    sqlServerFqdn: sqlServer.outputs.sqlServerFqdn
    sqlDatabaseName: sqlDatabaseName
    jwtSecretKey: notesJwtSecretKey
    allowedEmails: notesAllowedEmails
    googleClientId: googleClientId
    containerImage: !empty(notesApiImage) ? notesApiImage : placeholderImage
    registryUsername: ghcrUsername
    registryPassword: ghcrToken
    tags: union(commonTags, { application: 'notater' })
  }
}

module notesWeb 'modules/notes-web-container-app.bicep' = if (deployNotes) {
  name: 'notesWebDeployment'
  params: {
    containerAppName: notesWebName
    location: location
    environmentId: containerApp.outputs.environmentId
    notesApiUrl: notesApi!.outputs.internalUrl // same condition as this module
    googleClientId: googleClientId
    googleClientSecret: googleClientSecret
    customDomainName: notesCustomDomainName
    customDomainCertificateName: notesCustomDomainCertificateName
    containerImage: !empty(notesWebImage) ? notesWebImage : placeholderImage
    registryUsername: ghcrUsername
    registryPassword: ghcrToken
    tags: union(commonTags, { application: 'notater' })
  }
}

// Outputs
output notesWebUrl string = notesWeb.?outputs.appUrl ?? ''
output notesApiName string = notesApi.?outputs.containerAppName ?? ''
output notesApiPrincipalId string = notesApi.?outputs.principalId ?? ''
output keyVaultName string = keyVault.outputs.keyVaultName
output sqlServerFqdn string = sqlServer.outputs.sqlServerFqdn
output containerAppUrl string = containerApp.outputs.containerAppUrl
output frontendUrl string = frontendContainerApp.outputs.containerAppUrl
output frontendContainerAppName string = frontendContainerApp.outputs.containerAppName

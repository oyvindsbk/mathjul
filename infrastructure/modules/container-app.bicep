@description('The name of the Container App')
param containerAppName string

@description('The location for the Container App')
param location string

@description('Key Vault name')
param keyVaultName string

@description('Origins the frontend is served from (custom domain, ingress fqdn). Written to Cors__AllowedOrigins__N.')
param corsAllowedOrigins array = []

@description('Public frontend URL that share links are built from. Empty: not set.')
param publicBaseUrl string = ''

@description('JWT Secret Key for token signing')
@secure()
param jwtSecretKey string

@description('Azure Storage account name for recipe images')
param blobStorageAccountName string = ''

@description('Container image')
param containerImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

@description('Tags to apply to resources')
param tags object = {}

@description('Registry user (ghcr.io). Empty, or registryPassword empty: no registry is declared.')
param registryUsername string = ''

@description('Registry password. In the template so an infra deploy keeps it (ARM replaces the whole configuration).')
@secure()
param registryPassword string = ''

// Same secret name as `az containerapp registry set` uses (server without dots + user), so
// the app workflows' `registry set` finds this secret instead of adding a second one.
var useRegistry = !empty(registryUsername) && !empty(registryPassword)
var registrySecretName = 'ghcrio-${toLower(registryUsername)}'
var registrySecrets = useRegistry ? [{ name: registrySecretName, value: registryPassword }] : []
var registries = useRegistry ? [{ server: 'ghcr.io', username: registryUsername, passwordSecretRef: registrySecretName }] : []

var corsEnv = [for (origin, i) in corsAllowedOrigins: { name: 'Cors__AllowedOrigins__${i}', value: origin }]

// Log Analytics Workspace (required for Container Apps)
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${containerAppName}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container Apps Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${containerAppName}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Store sensitive secrets in Key Vault (loaded by backend via AddAzureKeyVault at startup).
// Secret names use '--' as separator which maps to ':' in ASP.NET Core configuration.
resource jwtSecretKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'Jwt--SecretKey'
  properties: {
    value: jwtSecretKey
  }
}

// Container App with Managed Identity
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned' // Enable managed identity
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: registrySecrets
      registries: registries
    }
    template: {
      containers: [
        {
          name: 'recipe-api'
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          probes: [
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              failureThreshold: 18
            }
          ]
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Production'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            // Key Vault URI — used to bootstrap AddAzureKeyVault at startup.
            // All other secrets (Jwt:SecretKey, AiFoundry:Key, ConnectionStrings:RecipeDb,
            // Jev:ApiKey) are loaded from Key Vault automatically at startup.
            {
              name: 'KeyVault__VaultUri'
              value: keyVault.properties.vaultUri
            }
            // CORS and share links are owned by this template; no workflow step changes them
            // afterwards. infrastructure.yml fails before deploying if an existing API would be
            // left with no origin. The policy uses AllowCredentials(), so every origin the
            // browser may send is listed exactly: custom domain and ingress fqdn.
            ...corsEnv
            ...(!empty(publicBaseUrl) ? [
              {
                name: 'Sharing__PublicBaseUrl'
                value: publicBaseUrl
              }
            ] : [])
            {
              name: 'Jwt__Issuer'
              value: 'RecipeApi'
            }
            {
              name: 'Jwt__Audience'
              value: 'RecipeFrontend'
            }
            {
              name: 'BlobStorage__AccountName'
              value: blobStorageAccountName
            }
            {
              name: 'BlobStorage__ContainerName'
              value: 'recipe-images'
            }
          ]
        }
      ]
      scale: {
        // Keep a replica running to avoid cold starts/warm-up timeouts
        minReplicas: 1
        maxReplicas: 1
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

// Outputs
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
output principalId string = containerApp.identity.principalId
@description('Shared with the Notater apps, which run in the same environment')
output environmentId string = containerAppEnvironment.id

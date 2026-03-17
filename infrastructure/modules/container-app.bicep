@description('The name of the Container App')
param containerAppName string

@description('The location for the Container App')
param location string

@description('Key Vault name')
param keyVaultName string

@description('Azure AI Foundry serverless endpoint URL')
param aiFoundryEndpoint string

@description('Azure AI Foundry API key')
@secure()
param aiFoundryKey string

@description('Azure AI Foundry model name')
param aiFoundryModelName string

@description('Frontend URL for CORS (optional)')
param frontendUrl string = ''

@description('JWT Secret Key for token signing')
@secure()
param jwtSecretKey string

@description('Container image')
param containerImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

@description('Tags to apply to resources')
param tags object = {}

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

resource aiFoundryKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AiFoundry--Key'
  properties: {
    value: aiFoundryKey
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
            // All other secrets (Jwt:SecretKey, AiFoundry:Key, ConnectionStrings:RecipeDb)
            // are loaded from Key Vault automatically at startup.
            {
              name: 'KeyVault__VaultUri'
              value: keyVault.properties.vaultUri
            }
            {
              name: 'AiFoundry__Endpoint'
              value: aiFoundryEndpoint
            }
            {
              name: 'AiFoundry__ModelName'
              value: aiFoundryModelName
            }
            {
              name: 'Cors__AllowedOrigins__0'
              value: frontendUrl != '' ? frontendUrl : 'https://placeholder-update-after-deployment.com'
            }
            {
              name: 'Jwt__Issuer'
              value: 'RecipeApi'
            }
            {
              name: 'Jwt__Audience'
              value: 'RecipeFrontend'
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

@description('The name of the Container App')
param containerAppName string

@description('The location for the Container App')
param location string

@description('Key Vault name')
param keyVaultName string

@description('SQL connection string (for initial setup)')
@secure()
param sqlConnectionString string

@description('Azure OpenAI endpoint')
param azureOpenAIEndpoint string

@description('Azure OpenAI API key')
@secure()
param azureOpenAIKey string

@description('Azure OpenAI deployment name')
param azureOpenAIDeploymentName string

@description('Frontend URL for CORS (optional)')
param frontendUrl string = ''

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

// Store OpenAI key in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource openAIKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'openai-api-key'
  properties: {
    value: azureOpenAIKey
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
      secrets: [
        {
          name: 'sql-connection-string'
          value: sqlConnectionString
        }
        {
          name: 'openai-key'
          value: azureOpenAIKey
        }
      ]
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
          env: [
            {
              name: 'ASPNETCORE_ENVIRONMENT'
              value: 'Production'
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://+:8080'
            }
            // Use Key Vault references (better approach)
            {
              name: 'KeyVault__VaultUri'
              value: keyVault.properties.vaultUri
            }
            {
              name: 'ConnectionStrings__DefaultConnection'
              secretRef: 'sql-connection-string'
            }
            {
              name: 'AzureOpenAI__Endpoint'
              value: azureOpenAIEndpoint
            }
            {
              name: 'AzureOpenAI__Key'
              secretRef: 'openai-key'
            }
            {
              name: 'AzureOpenAI__DeploymentName'
              value: azureOpenAIDeploymentName
            }
            {
              name: 'Cors__AllowedOrigins__0'
              value: frontendUrl != '' ? frontendUrl : 'https://placeholder-update-after-deployment.com'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
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

@description('The name of the frontend Container App')
param containerAppName string

@description('The location for the Container App')
param location string

@description('Backend API URL passed as env var and baked in via Docker build-arg')
param backendApiUrl string

@description('Google OAuth Client ID (public)')
param googleClientId string = ''

@description('Google OAuth Client Secret')
@secure()
param googleClientSecret string = ''

@description('Public URL of this frontend app, used to construct OAuth redirect URI')
param appUrl string = ''

@description('Container image to deploy')
param containerImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

@description('Tags to apply to resources')
param tags object = {}

// Log Analytics Workspace for container logs
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

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: !empty(googleClientSecret) ? [
        {
          name: 'google-client-secret'
          value: googleClientSecret
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: 'recipe-frontend'
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'HOSTNAME'
              value: '0.0.0.0'
            }
            // NEXT_PUBLIC_API_BASE_URL is baked at image build time via --build-arg.
            // Also set at runtime for observability / runtime reads.
            {
              name: 'NEXT_PUBLIC_API_BASE_URL'
              value: backendApiUrl
            }
            {
              name: 'GOOGLE_CLIENT_ID'
              value: googleClientId
            }
            ...(!empty(googleClientSecret) ? [
              {
                name: 'GOOGLE_CLIENT_SECRET'
                secretRef: 'google-client-secret'
              }
            ] : [])
            ...(!empty(appUrl) ? [
              {
                name: 'NEXTAUTH_URL'
                value: appUrl
              }
            ] : [])
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
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

output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name

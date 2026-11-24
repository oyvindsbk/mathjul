// Notater API. Internal ingress only: it is reachable from apps in the same Container Apps
// environment (the notes frontend proxies to it), never from the internet.

@description('Name of the Container App')
param containerAppName string

param location string

@description('Id of the Container Apps environment to run in (shared with the recipe API)')
param environmentId string

@description('SQL Server FQDN; the app authenticates with its managed identity')
param sqlServerFqdn string

param sqlDatabaseName string

@description('Signing key for notes JWTs (separate from the recipe app\'s key)')
@secure()
param jwtSecretKey string

@description('Comma-separated emails allowed to sign in')
@secure()
param allowedEmails string

@description('Google OAuth client id that sign-in id_tokens must be issued for')
param googleClientId string

param containerImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

param tags object = {}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    // The database user for this identity is created once by hand (DEPLOYMENT.md, Notater).
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: false
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'jwt-secret-key'
          value: jwtSecretKey
        }
        {
          name: 'allowed-emails'
          value: allowedEmails
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'notes-api'
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
              initialDelaySeconds: 3
              periodSeconds: 10
              failureThreshold: 12
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
            {
              // No credentials: AzureAdTokenInterceptor uses the managed identity.
              name: 'ConnectionStrings__NotesDb'
              value: 'Server=tcp:${sqlServerFqdn},1433;Initial Catalog=${sqlDatabaseName};Encrypt=True;TrustServerCertificate=False;'
            }
            {
              name: 'Jwt__SecretKey'
              secretRef: 'jwt-secret-key'
            }
            {
              name: 'Notes__AllowedEmails'
              secretRef: 'allowed-emails'
            }
            {
              name: 'Notes__GoogleClientId'
              value: googleClientId
            }
          ]
        }
      ]
      scale: {
        // One user: scale to zero when idle, accept a few seconds of cold start.
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

@description('Internal URL, reachable only from inside the environment')
output internalUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
output principalId string = containerApp.identity.principalId

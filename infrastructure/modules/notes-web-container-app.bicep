// Notater frontend (Next.js standalone). Public; proxies every API call to the internal notes API.

@description('Name of the Container App')
param containerAppName string

param location string

@description('Id of the Container Apps environment (must be the notes API\'s, for internal ingress)')
param environmentId string

@description('Internal URL of the notes API')
param notesApiUrl string

param googleClientId string

@secure()
param googleClientSecret string

@description('Custom domain, e.g. notater.kheradmandi.no. Empty: serve on the generated fqdn only.')
param customDomainName string = ''

@description('Managed certificate name for customDomainName. Empty: bind without TLS (validation only).')
param customDomainCertificateName string = ''

param containerImage string = 'mcr.microsoft.com/dotnet/samples:aspnetapp'

param tags object = {}

resource environment 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: last(split(environmentId, '/'))
}

// The public origin. OAuth redirect URIs and auth redirects are built from it, so it must be
// the host users actually arrive on: the custom domain when there is one.
var appUrl = !empty(customDomainName)
  ? 'https://${customDomainName}'
  : 'https://${containerAppName}.${environment.properties.defaultDomain}'

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        // Declared here: ARM replaces the ingress block wholesale, so a binding made by hand
        // would be removed on the next infra deploy.
        customDomains: empty(customDomainName) ? [] : [
          {
            name: customDomainName
            bindingType: empty(customDomainCertificateName) ? 'Disabled' : 'SniEnabled'
            certificateId: empty(customDomainCertificateName)
              ? null
              : '${environmentId}/managedCertificates/${customDomainCertificateName}'
          }
        ]
      }
      secrets: [
        {
          name: 'google-client-secret'
          value: googleClientSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'notes-web'
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'NOTES_API_URL'
              value: notesApiUrl
            }
            {
              name: 'APP_URL'
              value: appUrl
            }
            {
              name: 'GOOGLE_CLIENT_ID'
              value: googleClientId
            }
            {
              name: 'GOOGLE_CLIENT_SECRET'
              secretRef: 'google-client-secret'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

output appUrl string = appUrl
output containerAppName string = containerApp.name

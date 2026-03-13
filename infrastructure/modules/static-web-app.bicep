@description('The name of the Static Web App')
param staticWebAppName string

@description('The location for the Static Web App')
param location string

@description('The backend API URL')
param apiUrl string

@description('Google OAuth Client ID')
@secure()
param googleClientId string = ''

@description('Google OAuth Client Secret')
@secure()
param googleClientSecret string = ''

@description('Tags to apply to resources')
param tags object = {}

// Static Web App (Free tier)
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: ''
    branch: ''
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''
      // When deploying Next.js standalone, the output directory is .next/standalone
      outputLocation: '.next/standalone'
    }
  }
}

// Configure app settings
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    NEXT_PUBLIC_API_BASE_URL: apiUrl
    GOOGLE_CLIENT_ID: googleClientId
    GOOGLE_CLIENT_SECRET: googleClientSecret
    ,
    // Ensure Node version is set for the Static Web App runtime
    WEBSITE_NODE_DEFAULT_VERSION: '18'
  }
}

// Outputs
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
output staticWebAppName string = staticWebApp.name

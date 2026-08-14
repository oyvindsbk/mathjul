@description('The name of the Key Vault')
param keyVaultName string

@description('The location for Key Vault')
param location string

@description('Tags to apply to resources')
param tags object = {}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // Use RBAC instead of access policies
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: true // Required for existing vaults - cannot be disabled once enabled
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// NOTE: The 'approved-users' secret is managed outside of Bicep (via Azure CLI / portal)
// to prevent it from being overwritten on every infrastructure deployment.
//
// The same applies to 'heftymesterskapet-editors', the separate list of emails allowed to edit the
// Heftymesterskapet scoreboard. It is deliberately independent of 'approved-users'. The list fails
// closed: until it exists, nobody can edit the scoreboard (reading stays public either way).

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

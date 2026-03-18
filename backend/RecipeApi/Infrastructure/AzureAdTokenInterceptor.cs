using Azure.Core;
using Azure.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;

namespace RecipeApi.Infrastructure;

/// <summary>
/// Injects an Azure AD access token into SQL connections using DefaultAzureCredential.
/// Required for managed identity auth in Azure Container Apps, which exposes the identity
/// endpoint via IDENTITY_ENDPOINT/IDENTITY_HEADER env vars rather than the IMDS endpoint
/// used by SqlClient's built-in Active Directory Managed Identity auth.
/// </summary>
public class AzureAdTokenInterceptor : DbConnectionInterceptor
{
    private static readonly string[] Scopes = ["https://database.windows.net/.default"];
    private readonly TokenCredential _credential = new DefaultAzureCredential();

    public override async ValueTask<InterceptionResult> ConnectionOpeningAsync(
        DbConnection connection,
        ConnectionEventData eventData,
        InterceptionResult result,
        CancellationToken cancellationToken = default)
    {
        if (connection is SqlConnection sqlConnection)
        {
            var token = await _credential.GetTokenAsync(new TokenRequestContext(Scopes), cancellationToken);
            sqlConnection.AccessToken = token.Token;
        }
        return result;
    }
}

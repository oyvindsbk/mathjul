using Azure.Core;
using Azure.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;

namespace NotesApi.Infrastructure;

/// <summary>
/// Injects an Entra ID access token into SQL connections using the Container App's
/// managed identity (same approach as RecipeApi's interceptor).
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

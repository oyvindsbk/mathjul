using Azure.Security.KeyVault.Secrets;
using System.Text.Json;

namespace RecipeApi.Features.HeftyMesterskapet;

public interface IHeftyMesterskapetEditorService
{
    /// <summary>
    /// True if the email may modify competitions. Deliberately unrelated to the recipe app's
    /// approved-users whitelist -- a recipe user is not an editor, and an editor is not a recipe user.
    /// </summary>
    Task<bool> IsEditorAsync(string? email);
}

/// <summary>
/// Editor list for Heftymesterskapet, loaded from the Key Vault secret 'heftymesterskapet-editors'
/// in production or the 'HeftyMesterskapetEditors' configuration section locally.
///
/// Kept separate from <see cref="Infrastructure.EmailWhitelistMiddleware"/> on purpose: that answers
/// "may this person use the recipe app", which is a different question against a different list.
/// Sharing one list would let the two drift into each other.
/// </summary>
public class HeftyMesterskapetEditorService : IHeftyMesterskapetEditorService
{
    /// <summary>Key Vault secret name. Managed outside Bicep, like 'approved-users'.</summary>
    public const string SecretName = "heftymesterskapet-editors";

    /// <summary>Configuration section used when no Key Vault client is registered (local dev).</summary>
    public const string ConfigurationSection = "HeftyMesterskapetEditors";

    private readonly ILogger<HeftyMesterskapetEditorService> _logger;
    private readonly IConfiguration _configuration;
    private readonly SecretClient? _secretClient;

    private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(5);
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private HashSet<string> _editors = new();
    private DateTime _lastRefresh = DateTime.MinValue;

    public HeftyMesterskapetEditorService(
        ILogger<HeftyMesterskapetEditorService> logger,
        IConfiguration configuration,
        SecretClient? secretClient = null)
    {
        _logger = logger;
        _configuration = configuration;
        _secretClient = secretClient;
    }

    public async Task<bool> IsEditorAsync(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        await RefreshIfNeededAsync();

        // Fail closed: an empty list means nobody edits, never everybody.
        return _editors.Contains(email.Trim().ToLowerInvariant());
    }

    private async Task RefreshIfNeededAsync()
    {
        if (DateTime.UtcNow - _lastRefresh < _cacheExpiration)
        {
            return;
        }

        await _refreshLock.WaitAsync();
        try
        {
            if (DateTime.UtcNow - _lastRefresh < _cacheExpiration)
            {
                return;
            }

            var loaded = _secretClient != null
                ? await LoadFromKeyVaultAsync()
                : LoadFromConfiguration();

            // A failed read leaves the previous list in place rather than emptying it, so a
            // transient Key Vault outage does not lock out the scorekeepers mid-competition.
            if (loaded == null)
            {
                return;
            }

            _editors = loaded;
            _lastRefresh = DateTime.UtcNow;
            _logger.LogInformation("Loaded {Count} Heftymesterskapet editors", _editors.Count);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private async Task<HashSet<string>?> LoadFromKeyVaultAsync()
    {
        try
        {
            var secret = await _secretClient!.GetSecretAsync(SecretName);
            var emails = JsonSerializer.Deserialize<List<string>>(secret.Value.Value);
            return Normalize(emails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load Heftymesterskapet editors from Key Vault");
            return null;
        }
    }

    private HashSet<string>? LoadFromConfiguration()
    {
        var emails = _configuration.GetSection(ConfigurationSection).Get<List<string>>();
        return Normalize(emails);
    }

    private static HashSet<string>? Normalize(List<string>? emails)
    {
        if (emails == null)
        {
            return null;
        }

        return emails
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e.Trim().ToLowerInvariant())
            .ToHashSet();
    }
}

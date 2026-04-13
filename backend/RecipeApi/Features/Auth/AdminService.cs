namespace RecipeApi.Features.Auth;

public interface IAdminService
{
    bool IsAdmin(string email);
}

public class AdminService : IAdminService
{
    private readonly HashSet<string> _adminEmails;

    public AdminService(IConfiguration configuration)
    {
        var raw = configuration["AdminEmails"] ?? string.Empty;
        _adminEmails = raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .ToHashSet();
    }

    public bool IsAdmin(string email) =>
        _adminEmails.Contains(email.ToLowerInvariant());
}

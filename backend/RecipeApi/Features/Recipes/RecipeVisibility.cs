namespace RecipeApi.Features.Recipes;

/// <summary>
/// The single definition of which recipes a given caller may see.
///
/// Both the recipe listings and the profile recipe count go through this, so the count
/// shown on a profile can never disagree with the list underneath it.
/// </summary>
public static class RecipeVisibility
{
    /// <summary>
    /// Narrows <paramref name="query"/> to recipes visible to <paramref name="callerEmail"/>.
    /// Admins see everything; anonymous callers (null email) see only Public recipes.
    /// </summary>
    public static IQueryable<Recipe> VisibleTo(
        this IQueryable<Recipe> query, string? callerEmail, bool isAdmin)
    {
        if (isAdmin)
            return query;

        return query.Where(r =>
            r.Visibility == "Public" ||
            (r.Visibility == "Private" && r.OwnerEmail == callerEmail) ||
            (r.Visibility == "Group" && r.Groups.Any(rg =>
                rg.Group.Members.Any(m => m.User.Email == callerEmail))));
    }
}

using System.ComponentModel.DataAnnotations;
using RecipeApi.Features.MealPlans;
using Xunit;

namespace RecipeApi.Tests.MealPlans;

/// <summary>
/// The modal caps title and note via maxLength, which is a client-side courtesy only.
/// [ApiController] runs these annotations before the action body, so the length limits
/// are what actually stops an oversized payload from reaching the column.
/// </summary>
public class MealPlanPatchValidationTests
{
    private static List<ValidationResult> Validate(object model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void OversizedCustomTitleFailsValidation()
    {
        var results = Validate(new MoveMealPlanRequest { CustomTitle = new string('a', 101) });
        Assert.Contains(results, r => r.MemberNames.Contains(nameof(MoveMealPlanRequest.CustomTitle)));
    }

    [Fact]
    public void OversizedCustomNoteFailsValidation()
    {
        var results = Validate(new MoveMealPlanRequest { CustomNote = new string('a', 301) });
        Assert.Contains(results, r => r.MemberNames.Contains(nameof(MoveMealPlanRequest.CustomNote)));
    }

    [Fact]
    public void TitleAndNoteAtTheLimitPassValidation()
    {
        var results = Validate(new MoveMealPlanRequest
        {
            CustomTitle = new string('a', 100),
            CustomNote = new string('b', 300)
        });
        Assert.Empty(results);
    }

    [Fact]
    public void CreateRequestAlsoBoundsTitleAndNote()
    {
        var oversizedTitle = Validate(new CreateMealPlanRequest { Date = "2026-08-17", CustomTitle = new string('a', 101) });
        Assert.Contains(oversizedTitle, r => r.MemberNames.Contains(nameof(CreateMealPlanRequest.CustomTitle)));

        var oversizedNote = Validate(new CreateMealPlanRequest { Date = "2026-08-17", CustomTitle = "Rester", CustomNote = new string('a', 301) });
        Assert.Contains(oversizedNote, r => r.MemberNames.Contains(nameof(CreateMealPlanRequest.CustomNote)));
    }
}

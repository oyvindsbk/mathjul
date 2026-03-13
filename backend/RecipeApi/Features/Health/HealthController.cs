using Microsoft.AspNetCore.Mvc;

namespace RecipeApi.Features.Health;

[ApiController]
[Route("/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "Healthy" });
}

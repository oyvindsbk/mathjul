using Microsoft.AspNetCore.Mvc;

namespace NotesApi.Features.Import;

[ApiController]
[Route("api/import")]
public class ImportController(ImportService import) : ControllerBase
{
    /// <summary>Imports a batch of at most 200 days exported from OneNote.</summary>
    [HttpPost("onenote")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public Task<ImportResult> OneNote(ImportRequest request, CancellationToken ct) => import.ImportAsync(request, ct);
}

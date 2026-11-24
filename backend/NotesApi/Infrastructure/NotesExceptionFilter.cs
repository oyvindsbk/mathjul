using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using NotesApi.Features.Days;

namespace NotesApi.Infrastructure;

/// <summary>Turns a <see cref="NotesException"/> into its status code with a JSON error body.</summary>
public class NotesExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not NotesException ex)
            return;

        context.Result = new ObjectResult(new { error = ex.Message }) { StatusCode = ex.StatusCode };
        context.ExceptionHandled = true;
    }
}

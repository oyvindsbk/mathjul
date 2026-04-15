using Azure;
using Azure.AI.OpenAI;
using OpenAI.Chat;
using System.Text.Json;

namespace RecipeApi.Features.FeaturePlanner;

public interface IPrdGenerationService
{
    Task<PrdGenerationResult> GenerateAsync(string prompt, CancellationToken cancellationToken = default);
}

public class PrdGenerationResult
{
    public bool IsSuccess { get; init; }
    public string? ErrorMessage { get; init; }
    public GeneratedPrdDto? Prd { get; init; }

    public static PrdGenerationResult Success(GeneratedPrdDto prd) => new() { IsSuccess = true, Prd = prd };
    public static PrdGenerationResult Failure(string error) => new() { IsSuccess = false, ErrorMessage = error };
}

public class GeneratedPrdDto
{
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Motivation { get; set; } = string.Empty;
    public string Requirements { get; set; } = string.Empty;
    public string? OutOfScope { get; set; }
    public string? OpenQuestions { get; set; }
    public bool StacksFrontend { get; set; }
    public bool StacksBackend { get; set; }
    public bool StacksInfrastructure { get; set; }
    public string? DataModel { get; set; }
    public string? ApiSketch { get; set; }
    public string? UiSketch { get; set; }
}

public class PrdGenerationService : IPrdGenerationService
{
    private readonly ChatClient _chatClient;
    private readonly ILogger<PrdGenerationService> _logger;

    private const string SystemPrompt = """
        You are a product and technical planning assistant for a web application called "Matoppskrifter" (a Norwegian food recipe app).

        ## Application Architecture
        - **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS. Pages in `app/`, components in `components/`, services in `lib/services/`.
        - **Backend**: ASP.NET Core 9 Web API. Features organized as vertical slices in `Features/` (e.g., Recipes, MealPlans, Groups, Auth). Entity Framework Core with SQL Server.
        - **Infrastructure**: Azure (Container Apps, SQL, Blob Storage, Key Vault). Bicep IaC.
        - **Auth**: JWT tokens. Email whitelist for access control.
        - **Existing features**: Recipe CRUD with AI extraction (from URL or image), categories, groups/sharing, favourites, weekly meal planner, spin-the-wheel recipe picker.

        ## Your task
        Given a brief feature description from the user, produce a structured feature PRD (Product Requirements Document).

        ### Core fields — write in plain, non-technical language. Anyone should be able to understand these.
        - **title**: Short feature name (5 words or less)
        - **summary**: 1-2 sentences describing what the feature does and the value it provides
        - **motivation**: Why this is needed — what problem does it solve for the user?
        - **requirements**: A markdown bullet list of what the feature must do (focus on *what*, not *how*). Plain language.
        - **outOfScope**: A markdown bullet list of things explicitly NOT included in this feature. Be specific.
        - **openQuestions**: A markdown bullet list of genuine decisions that must be resolved before building — UX choices, data ownership, edge cases. Not generic placeholder questions.

        ### Technical fields — fill in based on your knowledge of the architecture. Be concrete and specific.
        - **stacksFrontend**: true if this feature needs frontend changes
        - **stacksBackend**: true if this feature needs backend/API/database changes
        - **stacksInfrastructure**: true if this feature needs Azure/Bicep/infrastructure changes
        - **dataModel**: If stacksBackend is true — describe new or modified entities and key fields in plain text or a short markdown sketch. Null if not applicable.
        - **apiSketch**: If stacksBackend is true — list new or modified API endpoints (method + path + one-line description). Null if not applicable.
        - **uiSketch**: If stacksFrontend is true — describe new pages, key components, and main user interactions. Null if not applicable.

        ## Output format
        Respond with ONLY valid JSON matching this structure:
        {
          "title": "...",
          "summary": "...",
          "motivation": "...",
          "requirements": "- Requirement 1\n- Requirement 2",
          "outOfScope": "- Thing 1\n- Thing 2",
          "openQuestions": "- Question 1\n- Question 2",
          "stacksFrontend": true,
          "stacksBackend": true,
          "stacksInfrastructure": false,
          "dataModel": "**ShoppingList**: id, weekStart (date), groupId, items (JSON list of {name, quantity, unit, checked})",
          "apiSketch": "POST /api/shopping-list/generate — generate list from meal plan\nGET /api/shopping-list/{weekStart} — get list for a week",
          "uiSketch": "New page /shopping-list. Shows grouped items by category. Checkbox per item to mark as bought. 'Generate from meal plan' button."
        }

        Keep all text concise. The requirements, outOfScope and openQuestions fields use markdown bullet lists (each item on a new line starting with "- ").
        """;

    public PrdGenerationService(IConfiguration configuration, ILogger<PrdGenerationService> logger)
    {
        var endpoint = configuration["AiFoundry:ImageEndpoint"]
            ?? configuration["AiFoundry:Endpoint"]
            ?? throw new InvalidOperationException("AiFoundry:Endpoint is required for PRD generation");
        var apiKey = configuration["AiFoundry:ImageApiKey"]
            ?? configuration["AiFoundry:ApiKey"]
            ?? throw new InvalidOperationException("AiFoundry:ApiKey is required for PRD generation");
        var modelName = configuration["AiFoundry:PrdModelName"] ?? "gpt-4o";

        var azureClient = new AzureOpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
        _chatClient = azureClient.GetChatClient(modelName);
        _logger = logger;
    }

    public async Task<PrdGenerationResult> GenerateAsync(string prompt, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(prompt))
            return PrdGenerationResult.Failure("Prompt is required");

        try
        {
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(SystemPrompt),
                new UserChatMessage($"Generate a PRD for this feature idea:\n\n{prompt}")
            };

            var options = new ChatCompletionOptions
            {
                Temperature = 0.4f,
                MaxOutputTokenCount = 2048
            };

            var response = await _chatClient.CompleteChatAsync(messages, options, cancellationToken);
            var content = response.Value.Content[0].Text?.Trim();

            if (string.IsNullOrWhiteSpace(content))
                return PrdGenerationResult.Failure("AI returned an empty response");

            // Strip markdown code fences if present
            if (content.StartsWith("```"))
            {
                var firstNewline = content.IndexOf('\n');
                var lastFence = content.LastIndexOf("```");
                if (firstNewline >= 0 && lastFence > firstNewline)
                    content = content[(firstNewline + 1)..lastFence].Trim();
            }

            _logger.LogInformation("PRD AI response ({Length} chars): {Response}", content.Length, content);

            var prd = JsonSerializer.Deserialize<GeneratedPrdDto>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (prd == null || string.IsNullOrWhiteSpace(prd.Title))
                return PrdGenerationResult.Failure("AI did not return a valid PRD structure");

            return PrdGenerationResult.Success(prd);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse PRD AI response as JSON");
            return PrdGenerationResult.Failure("AI returned an invalid response format. Please try again.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating PRD");
            return PrdGenerationResult.Failure($"Error generating PRD: {ex.Message}");
        }
    }
}

public class DisabledPrdGenerationService : IPrdGenerationService
{
    public Task<PrdGenerationResult> GenerateAsync(string prompt, CancellationToken cancellationToken = default) =>
        Task.FromResult(PrdGenerationResult.Failure("AI PRD generation is not configured. Set AiFoundry:Endpoint and AiFoundry:ApiKey."));
}

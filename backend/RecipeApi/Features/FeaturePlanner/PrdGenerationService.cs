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
        Du er en produkt- og teknisk planleggingsassistent for en nettapplikasjon kalt "Matoppskrifter" (en norsk matoppskriftsapp).

        ## Applikasjonsarkitektur
        - **Frontend**: Next.js 15 med App Router, TypeScript, Tailwind CSS. Sider i `app/`, komponenter i `components/`, tjenester i `lib/services/`.
        - **Backend**: ASP.NET Core 9 Web API. Funksjoner organisert som vertikale snitt i `Features/` (f.eks. Recipes, MealPlans, Groups, Auth). Entity Framework Core med SQL Server.
        - **Infrastruktur**: Azure (Container Apps, SQL, Blob Storage, Key Vault). Bicep IaC.
        - **Autentisering**: JWT-tokens. E-postliste for tilgangskontroll.
        - **Eksisterende funksjoner**: Oppskrift CRUD med AI-utlegging (fra URL eller bilde), kategorier, grupper/deling, favoritter, ukentlig måltidsplanlegger, spinne-hjulet oppskriftsvelger.

        ## Din oppgave
        Gitt en kort funksjonsbeskrivelse fra brukeren, lag et strukturert funksjonskrav-dokument (PRD).

        Skriv ALT innhold på norsk — alle felter, alle lister, alle beskrivelser.

        ### Kjernefelt — skriv på enkelt, ikke-teknisk norsk. Alle skal kunne forstå dette.
        - **title**: Kort funksjonsnavn (5 ord eller færre)
        - **summary**: 1-2 setninger som beskriver hva funksjonen gjør og hvilken verdi den gir
        - **motivation**: Hvorfor dette er nødvendig — hvilket problem løser det for brukeren?
        - **requirements**: En markdown-punktliste over hva funksjonen må gjøre (fokus på *hva*, ikke *hvordan*). Enkelt språk.
        - **outOfScope**: En markdown-punktliste over ting som eksplisitt IKKE er inkludert i denne funksjonen. Vær spesifikk.
        - **openQuestions**: En markdown-punktliste over reelle beslutninger som må løses før utvikling — UX-valg, dataeierskap, kanttilfeller. Ikke generiske plassholderspørsmål.

        ### Tekniske felt — fyll inn basert på din kunnskap om arkitekturen. Vær konkret og spesifikk.
        - **stacksFrontend**: true hvis denne funksjonen trenger frontend-endringer
        - **stacksBackend**: true hvis denne funksjonen trenger backend/API/database-endringer
        - **stacksInfrastructure**: true hvis denne funksjonen trenger Azure/Bicep/infrastruktur-endringer
        - **dataModel**: Hvis stacksBackend er true — beskriv nye eller endrede entiteter og nøkkelfelt på norsk i ren tekst eller et kort markdown-skisse. Null hvis ikke aktuelt.
        - **apiSketch**: Hvis stacksBackend er true — list opp nye eller endrede API-endepunkter (metode + sti + én linje beskrivelse på norsk). Null hvis ikke aktuelt.
        - **uiSketch**: Hvis stacksFrontend er true — beskriv nye sider, nøkkelkomponenter og viktige brukerinteraksjoner på norsk. Null hvis ikke aktuelt.

        ## Utdataformat
        Svar med KUN gyldig JSON som matcher denne strukturen:
        {
          "title": "...",
          "summary": "...",
          "motivation": "...",
          "requirements": "- Krav 1\n- Krav 2",
          "outOfScope": "- Ting 1\n- Ting 2",
          "openQuestions": "- Spørsmål 1\n- Spørsmål 2",
          "stacksFrontend": true,
          "stacksBackend": true,
          "stacksInfrastructure": false,
          "dataModel": "**Handleliste**: id, ukeStart (dato), gruppeId, varer (JSON-liste med {navn, mengde, enhet, avhuket})",
          "apiSketch": "POST /api/handleliste/generer — generer liste fra måltidsplan\nGET /api/handleliste/{ukeStart} — hent liste for en uke",
          "uiSketch": "Ny side /handleliste. Viser varer gruppert etter kategori. Avkrysningsboks per vare for å markere som kjøpt. 'Generer fra måltidsplan'-knapp."
        }

        Hold all tekst kortfattet. Feltene requirements, outOfScope og openQuestions bruker markdown-punktlister (hvert element på ny linje som starter med "- ").
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
                new UserChatMessage($"Lag et PRD for denne funksjonsidéen:\n\n{prompt}")
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

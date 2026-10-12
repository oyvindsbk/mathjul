using Azure;
using Azure.AI.OpenAI;
using OpenAI.Chat;

namespace RecipeApi.Features.Stock;

/// <summary>
/// Builds the Azure AI Foundry chat client for the stock features. Each use has its own
/// model setting so the scan and the correction can be pointed at different deployments.
/// </summary>
public static class StockChatClientFactory
{
    public const string DefaultModel = "gpt-5.4-mini";

    public static ChatClient Create(IConfiguration configuration, string modelSettingKey)
    {
        var endpoint = configuration["AiFoundry:ImageEndpoint"]
            ?? configuration["AiFoundry:Endpoint"]
            ?? throw new InvalidOperationException("Missing config: AiFoundry:ImageEndpoint or AiFoundry:Endpoint");
        var apiKey = configuration["AiFoundry:ImageApiKey"]
            ?? configuration["AiFoundry:ApiKey"]
            ?? throw new InvalidOperationException("Missing config: AiFoundry:ImageApiKey or AiFoundry:ApiKey");
        var deploymentName = configuration[modelSettingKey] ?? DefaultModel;

        return new AzureOpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey))
            .GetChatClient(deploymentName);
    }
}

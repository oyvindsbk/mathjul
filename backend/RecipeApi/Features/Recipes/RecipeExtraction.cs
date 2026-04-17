using System.Text.Json;
using System.Text.Json.Serialization;

namespace RecipeApi.Features.Recipes;

/// <summary>
/// Handles AI responses where quantity may be a JSON number, a numeric string ("4"),
/// a fraction string ("1/2"), or a range string ("1/2-1"). Non-parseable values become null.
/// </summary>
internal sealed class FlexibleDecimalConverter : JsonConverter<decimal?>
{
    public override decimal? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;

        if (reader.TokenType == JsonTokenType.Number)
            return reader.GetDecimal();

        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s)) return null;
            if (decimal.TryParse(s, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var d))
                return d;
            // Fraction like "1/2" or range like "1/2-1" — return null (unparseable as decimal)
            return null;
        }

        return null;
    }

    public override void Write(Utf8JsonWriter writer, decimal? value, JsonSerializerOptions options)
    {
        if (value.HasValue) writer.WriteNumberValue(value.Value);
        else writer.WriteNullValue();
    }
}

/// <summary>
/// Handles AI responses where int fields (prepTime, cookTime, servings) may be returned as strings.
/// </summary>
internal sealed class FlexibleIntConverter : JsonConverter<int?>
{
    public override int? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return null;

        if (reader.TokenType == JsonTokenType.Number)
            return reader.GetInt32();

        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s)) return null;
            if (int.TryParse(s, out var i)) return i;
            // e.g. "15 min" — try extracting leading digits
            var digits = new string(s.TakeWhile(char.IsDigit).ToArray());
            if (digits.Length > 0 && int.TryParse(digits, out var d)) return d;
            return null;
        }

        return null;
    }

    public override void Write(Utf8JsonWriter writer, int? value, JsonSerializerOptions options)
    {
        if (value.HasValue) writer.WriteNumberValue(value.Value);
        else writer.WriteNullValue();
    }
}

public class RecipeExtractionResult
{
    public bool IsSuccess { get; init; }
    public string? ErrorMessage { get; init; }
    public ExtractedRecipeDto? Recipe { get; init; }

    public static RecipeExtractionResult Success(ExtractedRecipeDto recipe) =>
        new() { IsSuccess = true, Recipe = recipe };

    public static RecipeExtractionResult Failure(string errorMessage) =>
        new() { IsSuccess = false, ErrorMessage = errorMessage };
}

public class ExtractedIngredientSectionDto
{
    public string Heading { get; set; } = string.Empty;
    public List<StructuredIngredient> Ingredients { get; set; } = new();
}

public class ExtractedInstructionSectionDto
{
    public string Heading { get; set; } = string.Empty;
    public List<string> Steps { get; set; } = new();
}

public class ExtractedRecipeDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<StructuredIngredient> Ingredients { get; set; } = new();
    public List<string> Instructions { get; set; } = new();
    public List<ExtractedIngredientSectionDto> IngredientSections { get; set; } = new();
    public List<ExtractedInstructionSectionDto> InstructionSections { get; set; } = new();
    public int? PrepTime { get; set; }
    public int? CookTime { get; set; }
    public int? Servings { get; set; }
    public List<int> SuggestedCategoryIds { get; set; } = new();
    public List<string> Tips { get; set; } = new();
}

internal static class RecipeExtractionPrompt
{
    private const string BaseSystemPrompt = @"You are a recipe extraction expert. Analyze the provided recipe content and extract all information into a structured JSON format.

IMPORTANT: All text fields in your response (title, description, ingredient names, instruction steps, section headings) MUST be written in Norwegian (Bokmål), regardless of the language of the source material.

Extract the following fields:
- title: The recipe name
- description: A brief description or subtitle if available
- ingredients: Array of ingredient objects (use this when the recipe has NO sections). Each object:
  - quantity: numeric amount (e.g., 2, 0.5) or null if not specified (e.g., ""salt to taste"")
  - unit: measurement unit (e.g., ""cups"", ""tsp"", ""g"", ""dl"", ""stk"") or null if unitless (e.g., ""2 eggs"")
  - name: the ingredient name (e.g., ""flour"", ""salt"", ""eggs"")
- ingredientSections: Array of ingredient sections (use this INSTEAD of ingredients when the recipe has explicit section headings like ""For the sauce:"", ""Marinade:"", ""Dough:""). Each section:
  - heading: The section heading in Norwegian
  - ingredients: Array of ingredient objects (same format as above)
- instructions: Array of instruction steps as separate strings (use this when the recipe has NO sections)
- instructionSections: Array of instruction sections (use this INSTEAD of instructions when the recipe has explicit phase headings like ""Preparation:"", ""Baking:""). Each section:
  - heading: The section heading in Norwegian
  - steps: Array of instruction step strings
- prepTime: Preparation time in minutes. Extract from explicit text (e.g., ""Prep: 15 min""). If not stated, estimate from the instructions (e.g., chopping, marinating steps).
- cookTime: Cooking time in minutes. Extract from explicit text (e.g., ""Cook: 30 min"", ""bake for 45 minutes""). If not stated, estimate from the instructions (e.g., simmering, baking, frying steps).
- servings: Number of servings/portions (extract from text like ""Serves 4"", ""4 porsjoner"")
- tips: Array of strings with practical tips, substitutions, serving suggestions, or cook's notes from the recipe. Each tip is a standalone sentence in Norwegian. Use an empty array if no tips are present in the source.

SECTIONS RULE: Only use ingredientSections/instructionSections if the source recipe explicitly has labeled sections or component headings. Do NOT invent section headings. For a simple recipe with one list of ingredients and one list of steps, use the flat ingredients/instructions fields.

Convert fractions to decimals (e.g., 1/2 = 0.5, 1/4 = 0.25).
If prepTime or cookTime cannot be extracted or estimated, use null.";

    internal static string BuildSystemPrompt(string? categoryListJson)
    {
        if (string.IsNullOrWhiteSpace(categoryListJson))
        {
            return BaseSystemPrompt + @"

Respond with ONLY valid JSON. Use the flat format for simple recipes:
{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredients"": [
    {""quantity"": 2, ""unit"": ""cups"", ""name"": ""flour""},
    {""quantity"": 1, ""unit"": ""tsp"", ""name"": ""salt""},
    {""quantity"": null, ""unit"": null, ""name"": ""fresh herbs to taste""}
  ],
  ""instructions"": [""step 1"", ""step 2""],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4,

  ""tips"": [""Tip 1"", ""Tip 2""],
  ""suggestedCategoryIds"": []
}

Use the sectioned format ONLY when the source recipe has explicit labeled sections:
{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredientSections"": [
    {
      ""heading"": ""Saus"",
      ""ingredients"": [{""quantity"": 2, ""unit"": ""dl"", ""name"": ""fløte""}]
    },
    {
      ""heading"": ""Kjøtt"",
      ""ingredients"": [{""quantity"": 500, ""unit"": ""g"", ""name"": ""kyllingfilet""}]
    }
  ],
  ""instructionSections"": [
    {
      ""heading"": ""Forberedelser"",
      ""steps"": [""step 1"", ""step 2""]
    },
    {
      ""heading"": ""Steking"",
      ""steps"": [""step 3""]
    }
  ],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4,

  ""tips"": [],
  ""suggestedCategoryIds"": []
}";
        }

        return BaseSystemPrompt + $@"

You also have access to a predefined list of categories. Based on the recipe, suggest which category IDs fit best.
Only suggest IDs from the list below. Include 1-5 most relevant categories. If none fit, use an empty array.

Available categories:
{categoryListJson}

Respond with ONLY valid JSON. Use the flat format for simple recipes:
{{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredients"": [
    {{""quantity"": 2, ""unit"": ""cups"", ""name"": ""flour""}},
    {{""quantity"": 1, ""unit"": ""tsp"", ""name"": ""salt""}},
    {{""quantity"": null, ""unit"": null, ""name"": ""fresh herbs to taste""}}
  ],
  ""instructions"": [""step 1"", ""step 2""],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4,

  ""tips"": [""Tip 1"", ""Tip 2""],
  ""suggestedCategoryIds"": [1, 3]
}}

Use the sectioned format ONLY when the source recipe has explicit labeled sections:
{{
  ""title"": ""Recipe Name"",
  ""description"": ""Brief description"",
  ""ingredientSections"": [
    {{
      ""heading"": ""Saus"",
      ""ingredients"": [{{""quantity"": 2, ""unit"": ""dl"", ""name"": ""fløte""}}]
    }}
  ],
  ""instructionSections"": [
    {{
      ""heading"": ""Forberedelser"",
      ""steps"": [""step 1"", ""step 2""]
    }}
  ],
  ""prepTime"": 15,
  ""cookTime"": 30,
  ""servings"": 4,

  ""tips"": [],
  ""suggestedCategoryIds"": [1, 3]
}}";
    }

    /// <summary>
    /// If the AI returns ingredients as plain strings instead of objects, convert them.
    /// Handles both the flat "ingredients" array and arrays nested inside "ingredientSections".
    /// </summary>
    internal static string NormalizeIngredients(string json, ILogger logger)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            bool hasFlat = root.TryGetProperty("ingredients", out _) || root.TryGetProperty("Ingredients", out _);
            bool hasSections = root.TryGetProperty("ingredientSections", out _) || root.TryGetProperty("IngredientSections", out _);

            if (!hasFlat && !hasSections)
                return json;

            using var ms = new MemoryStream();
            using var writer = new Utf8JsonWriter(ms);
            writer.WriteStartObject();

            foreach (var prop in root.EnumerateObject())
            {
                if (prop.Name.Equals("ingredients", StringComparison.OrdinalIgnoreCase))
                {
                    writer.WritePropertyName(prop.Name);
                    WriteNormalizedIngredientArray(writer, prop.Value, logger);
                }
                else if (prop.Name.Equals("ingredientSections", StringComparison.OrdinalIgnoreCase))
                {
                    writer.WritePropertyName(prop.Name);
                    writer.WriteStartArray();
                    foreach (var section in prop.Value.EnumerateArray())
                    {
                        writer.WriteStartObject();
                        foreach (var sectionProp in section.EnumerateObject())
                        {
                            if (sectionProp.Name.Equals("ingredients", StringComparison.OrdinalIgnoreCase))
                            {
                                writer.WritePropertyName(sectionProp.Name);
                                WriteNormalizedIngredientArray(writer, sectionProp.Value, logger);
                            }
                            else
                            {
                                sectionProp.WriteTo(writer);
                            }
                        }
                        writer.WriteEndObject();
                    }
                    writer.WriteEndArray();
                }
                else
                {
                    prop.WriteTo(writer);
                }
            }

            writer.WriteEndObject();
            writer.Flush();

            return System.Text.Encoding.UTF8.GetString(ms.ToArray());
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to normalize ingredients, proceeding with original JSON");
            return json;
        }
    }

    private static void WriteNormalizedIngredientArray(Utf8JsonWriter writer, JsonElement ingredients, ILogger logger)
    {
        if (ingredients.ValueKind != JsonValueKind.Array || ingredients.GetArrayLength() == 0)
        {
            ingredients.WriteTo(writer);
            return;
        }

        // Check if any element is a plain string (AI returned wrong format)
        bool hasStringElements = false;
        foreach (var item in ingredients.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String) { hasStringElements = true; break; }
        }

        if (!hasStringElements)
        {
            ingredients.WriteTo(writer);
            return;
        }

        logger.LogInformation("Converting plain string ingredients to structured format");

        var structured = new List<StructuredIngredient>();
        foreach (var item in ingredients.EnumerateArray())
        {
            structured.Add(new StructuredIngredient { Name = item.GetString() ?? string.Empty });
        }
        JsonSerializer.Serialize(writer, structured);
    }

    internal static RecipeExtractionResult ParseResponse(Azure.AI.Inference.ChatCompletions chatCompletions, ILogger logger)
    {
        return ParseResponseContent(chatCompletions.Content, logger);
    }

    internal static RecipeExtractionResult ParseResponseContent(string? responseContent, ILogger logger)
    {
        if (string.IsNullOrWhiteSpace(responseContent))
        {
            logger.LogError("AI response content text was null or empty.");
            return RecipeExtractionResult.Failure("AI response content text was null or empty.");
        }

        logger.LogInformation("Received response from AI ({Length} chars): {Response}", responseContent.Length, responseContent);

        if (responseContent.Trim().Length < 20)
        {
            logger.LogError("AI response too short to be valid JSON: {Content}", responseContent);
            return RecipeExtractionResult.Failure("The AI returned an incomplete response. Please try again with a clearer image.");
        }

        // Strip markdown code fences if present
        var json = responseContent.Trim();
        if (json.StartsWith("```"))
        {
            var firstNewline = json.IndexOf('\n');
            var lastFence = json.LastIndexOf("```");
            if (firstNewline >= 0 && lastFence > firstNewline)
                json = json[(firstNewline + 1)..lastFence].Trim();
        }

        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new FlexibleDecimalConverter(), new FlexibleIntConverter() }
            };

            // Pre-process: if ingredients contains plain strings, convert to structured objects
            json = NormalizeIngredients(json, logger);

            var extractedRecipe = JsonSerializer.Deserialize<ExtractedRecipeDto>(json, options);

            if (extractedRecipe == null || string.IsNullOrWhiteSpace(extractedRecipe.Title))
            {
                return RecipeExtractionResult.Failure("Failed to extract recipe information");
            }

            // If sections are present, clear the flat lists to avoid duplication
            if (extractedRecipe.IngredientSections.Count > 0)
                extractedRecipe.Ingredients = new();
            if (extractedRecipe.InstructionSections.Count > 0)
                extractedRecipe.Instructions = new();

            return RecipeExtractionResult.Success(extractedRecipe);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Failed to parse AI response as JSON. Raw content: {Content}", json);
            return RecipeExtractionResult.Failure("Failed to parse the AI response. The AI did not return valid recipe data. Please try again.");
        }
    }
}

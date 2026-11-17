using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using RecipeApi.Features.Recipes;
using Xunit;

namespace RecipeApi.Tests.Recipes;

/// <summary>
/// Covers source-image provenance (feature 064): upload on extraction, validation on save,
/// exposure on the detail DTO, cleanup on delete and the download endpoint.
/// </summary>
public class RecipeSourceImageTests
{
    private const string BlobBase = RecipeTestContext.BlobContainerUrl;

    private static string SourceUrl(string name) => $"{BlobBase}{RecipesController.SourceImageBlobPrefix}{name}.jpg";

    private static IFormFile MakeFile(string content, string fileName, string contentType = "image/jpeg")
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "images", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    /// <summary>
    /// Makes extraction succeed and makes each upload return a URL that embeds the uploaded
    /// file's content, so tests can assert which file ended up where. Content "fail" throws.
    /// </summary>
    private static void SetupSuccessfulExtraction(RecipeTestContext ctx)
    {
        ctx.ImageProcessor
            .Setup(p => p.ExtractRecipeFromImagesAsync(
                It.IsAny<IReadOnlyList<IFormFile>>(), It.IsAny<string?>(),
                It.IsAny<Func<string, Task>?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RecipeExtractionResult.Success(new ExtractedRecipeDto { Title = "Sandkaker" }));
        ctx.ImageProcessor
            .Setup(p => p.TryExtractDishPhotoAsync(It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);
        ctx.BlobStorage
            .Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns((Stream s, string path, string _, CancellationToken _) =>
            {
                var content = new StreamReader(s).ReadToEnd();
                if (content == "fail")
                    throw new IOException("upload failed");
                return Task.FromResult($"{BlobBase}{path}#{content}");
            });
    }

    [Fact]
    public async Task FromImages_ReturnsEveryUploadedSourceUrl_InUploadOrder()
    {
        using var ctx = new RecipeTestContext();
        SetupSuccessfulExtraction(ctx);
        var controller = ctx.CreateController();
        var files = new FormFileCollection { MakeFile("a", "1.jpg"), MakeFile("b", "2.png", "image/png"), MakeFile("c", "3.jpg") };

        var result = await controller.ExtractRecipeFromImages(files);

        var body = Assert.IsType<RecipeExtractionResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var urls = body.ExtractedRecipe!.SourceImageUrls;
        Assert.Equal(3, urls.Count);
        Assert.EndsWith("#a", urls[0]);
        Assert.EndsWith("#b", urls[1]);
        Assert.EndsWith("#c", urls[2]);
        Assert.All(urls, u => Assert.StartsWith(BlobBase + RecipesController.SourceImageBlobPrefix, u));
        Assert.Contains(".png#", urls[1]);
    }

    [Fact]
    public async Task FromImages_SkipsAFailedUpload_AndKeepsTheRest()
    {
        using var ctx = new RecipeTestContext();
        SetupSuccessfulExtraction(ctx);
        var controller = ctx.CreateController();
        var files = new FormFileCollection { MakeFile("a", "1.jpg"), MakeFile("fail", "2.jpg"), MakeFile("c", "3.jpg") };

        var result = await controller.ExtractRecipeFromImages(files);

        var body = Assert.IsType<RecipeExtractionResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var urls = body.ExtractedRecipe!.SourceImageUrls;
        Assert.Equal(2, urls.Count);
        Assert.EndsWith("#a", urls[0]);
        Assert.EndsWith("#c", urls[1]);
    }

    // ── Save, read, delete ──────────────────────────────────────────────────

    [Fact]
    public async Task SaveExtracted_PersistsSourceImages_AndDetailReturnsThemInOrder()
    {
        using var ctx = new RecipeTestContext();
        var controller = ctx.CreateController();
        var urls = new List<string> { SourceUrl("b"), SourceUrl("a") };

        var result = await controller.SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Sandkaker",
            SourceImageUrls = urls
        });

        Assert.IsType<CreatedAtActionResult>(result.Result);
        var stored = ctx.Db.Recipes.Single(r => r.Title == "Sandkaker");
        Assert.Equal(urls, stored.SourceImageUrls);

        var detail = await ctx.CreateController().GetRecipeById(stored.Id);
        var dto = Assert.IsType<RecipeDetailDto>(Assert.IsType<OkObjectResult>(detail.Result).Value);
        Assert.Equal(urls, dto.SourceImageUrls);
    }

    [Fact]
    public async Task SaveExtracted_WithoutSourceImages_StoresEmptyList()
    {
        using var ctx = new RecipeTestContext();

        await ctx.CreateController().SaveExtractedRecipe(new SaveExtractedRecipeRequest { Title = "Uten bilder" });

        Assert.Empty(ctx.Db.Recipes.Single(r => r.Title == "Uten bilder").SourceImageUrls);
    }

    [Theory]
    [InlineData("https://evil.example/recipe-images/recipes/pending/source-x.jpg")]        // other host
    [InlineData("https://acct.blob.core.windows.net/other/recipes/pending/source-x.jpg")]    // other container
    [InlineData("https://acct.blob.core.windows.net/recipe-images/recipes/1/main/x.jpg")]   // not a source image
    [InlineData("https://acct.blob.core.windows.net/recipe-images/recipes/pending/source-x/y.jpg")] // nested
    [InlineData("https://acct.blob.core.windows.net/recipe-images/recipes/pending/../1/main/x.jpg")] // traversal
    [InlineData("https://acct.blob.core.windows.net/recipe-images/recipes/pending/source-x.jpg?sig=1")] // query
    [InlineData("javascript:alert(1)")]
    [InlineData("not a url")]
    public async Task SaveExtracted_RejectsForeignSourceImageUrl(string url)
    {
        using var ctx = new RecipeTestContext();

        var result = await ctx.CreateController().SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "Ugyldig",
            SourceImageUrls = [SourceUrl("ok"), url]
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.False(ctx.Db.Recipes.Any(r => r.Title == "Ugyldig"));
    }

    [Fact]
    public async Task SaveExtracted_RejectsMoreThanFiveSourceImages()
    {
        using var ctx = new RecipeTestContext();

        var result = await ctx.CreateController().SaveExtractedRecipe(new SaveExtractedRecipeRequest
        {
            Title = "For mange",
            SourceImageUrls = Enumerable.Range(1, 6).Select(i => SourceUrl($"s{i}")).ToList()
        });

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task DeleteRecipe_DeletesEachSourceImageBlob()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Slettes");
        recipe.SourceImageUrls = [SourceUrl("a"), SourceUrl("b")];
        ctx.Db.SaveChanges();

        var result = await ctx.CreateController().DeleteRecipe(recipe.Id);

        Assert.IsType<NoContentResult>(result);
        ctx.BlobStorage.Verify(b => b.DeleteAsync(RecipesController.SourceImageBlobPrefix + "a.jpg", It.IsAny<CancellationToken>()), Times.Once);
        ctx.BlobStorage.Verify(b => b.DeleteAsync(RecipesController.SourceImageBlobPrefix + "b.jpg", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteRecipe_StillDeletesRecipe_WhenSourceBlobDeleteFails()
    {
        using var ctx = new RecipeTestContext();
        var recipe = ctx.SeedRecipe("Slettes likevel");
        recipe.SourceImageUrls = [SourceUrl("a")];
        ctx.Db.SaveChanges();
        ctx.BlobStorage
            .Setup(b => b.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("storage down"));

        var result = await ctx.CreateController().DeleteRecipe(recipe.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.False(ctx.Db.Recipes.Any(r => r.Id == recipe.Id));
    }

    // ── Blob URL parsing (production implementation) ────────────────────────

    [Theory]
    [InlineData("http://127.0.0.1:10000/devstoreaccount1/recipe-images/recipes/pending/source-a.jpg", "recipes/pending/source-a.jpg")]
    [InlineData("http://127.0.0.1:10000/devstoreaccount1/other/recipes/pending/source-a.jpg", null)]
    [InlineData("http://localhost:10000/devstoreaccount1/recipe-images/recipes/pending/source-a.jpg", null)]
    [InlineData("http://127.0.0.1:10000/devstoreaccount1/recipe-images/", null)]
    public void GetBlobPathFromUrl_AzuriteContainer(string url, string? expected)
    {
        var storage = new AzureBlobStorageService(new BlobStorageOptions
        {
            ContainerName = "recipe-images",
            ConnectionString = "UseDevelopmentStorage=true"
        });

        Assert.Equal(expected, storage.GetBlobPathFromUrl(url));
    }
}

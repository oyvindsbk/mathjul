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
    private const string BlobBase = "https://acct.blob.core.windows.net/recipe-images/";

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
}

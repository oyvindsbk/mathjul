using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace RecipeApi.Features.Recipes;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream content, string blobPath, string contentType, CancellationToken cancellationToken = default);
    Task DeleteAsync(string blobPath, CancellationToken cancellationToken = default);
    Task DeleteByPrefixAsync(string prefix, CancellationToken cancellationToken = default);
}

public class BlobStorageOptions
{
    public string AccountName { get; set; } = string.Empty;
    public string ContainerName { get; set; } = "recipe-images";
    /// <summary>
    /// Azurite connection string for local dev. When set, overrides managed identity.
    /// </summary>
    public string? ConnectionString { get; set; }
}

public class AzureBlobStorageService : IBlobStorageService
{
    private readonly BlobContainerClient _containerClient;

    public AzureBlobStorageService(BlobStorageOptions options)
    {
        BlobServiceClient serviceClient;

        if (!string.IsNullOrEmpty(options.ConnectionString))
        {
            // Local dev: Azurite or explicit connection string
            serviceClient = new BlobServiceClient(options.ConnectionString);
        }
        else
        {
            // Production: managed identity via DefaultAzureCredential
            var accountUri = new Uri($"https://{options.AccountName}.blob.core.windows.net");
            serviceClient = new BlobServiceClient(accountUri, new DefaultAzureCredential());
        }

        _containerClient = serviceClient.GetBlobContainerClient(options.ContainerName);
    }

    public async Task<string> UploadAsync(Stream content, string blobPath, string contentType, CancellationToken cancellationToken = default)
    {
        await _containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: cancellationToken);

        var blobClient = _containerClient.GetBlobClient(blobPath);
        await blobClient.UploadAsync(content, new BlobHttpHeaders { ContentType = contentType }, cancellationToken: cancellationToken);
        return blobClient.Uri.ToString();
    }

    public async Task DeleteAsync(string blobPath, CancellationToken cancellationToken = default)
    {
        var blobClient = _containerClient.GetBlobClient(blobPath);
        await blobClient.DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    public async Task DeleteByPrefixAsync(string prefix, CancellationToken cancellationToken = default)
    {
        await foreach (var blob in _containerClient.GetBlobsAsync(BlobTraits.None, BlobStates.None, prefix, cancellationToken))
        {
            await _containerClient.GetBlobClient(blob.Name).DeleteIfExistsAsync(cancellationToken: cancellationToken);
        }
    }
}

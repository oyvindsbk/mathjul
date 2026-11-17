using Azure;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace RecipeApi.Features.Recipes;

public interface IBlobStorageService
{
    Task<string> UploadAsync(Stream content, string blobPath, string contentType, CancellationToken cancellationToken = default);
    Task DeleteAsync(string blobPath, CancellationToken cancellationToken = default);
    Task DeleteByPrefixAsync(string prefix, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the blob path of <paramref name="url"/> when it points into this service's
    /// container (same scheme, host and container path), otherwise null. Use it to reject
    /// client-supplied URLs that are not ours.
    /// </summary>
    string? GetBlobPathFromUrl(string url);

    /// <summary>Opens a blob for reading, or returns null when it does not exist.</summary>
    Task<BlobDownload?> OpenReadAsync(string blobPath, CancellationToken cancellationToken = default);
}

/// <summary>An open blob stream and the content type it was stored with. Caller disposes the stream.</summary>
public sealed record BlobDownload(Stream Content, string? ContentType);

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
            // Local dev: Azurite or explicit connection string.
            // Pin to a service version supported by the local Azurite emulator so that
            // upgrading the SDK package doesn't break local dev with an older Azurite.
            var localOptions = new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04);
            serviceClient = new BlobServiceClient(options.ConnectionString, localOptions);
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

    public string? GetBlobPathFromUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment))
            return null;

        var container = _containerClient.Uri;
        if (!string.Equals(uri.Scheme, container.Scheme, StringComparison.OrdinalIgnoreCase)
            || !string.Equals(uri.Authority, container.Authority, StringComparison.OrdinalIgnoreCase))
            return null;

        // Uri has already collapsed any "." / ".." segments in AbsolutePath.
        var containerPath = container.AbsolutePath.TrimEnd('/') + "/";
        if (!uri.AbsolutePath.StartsWith(containerPath, StringComparison.Ordinal))
            return null;

        var blobPath = Uri.UnescapeDataString(uri.AbsolutePath[containerPath.Length..]);
        return blobPath.Length == 0 ? null : blobPath;
    }

    public async Task<BlobDownload?> OpenReadAsync(string blobPath, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _containerClient.GetBlobClient(blobPath)
                .DownloadStreamingAsync(cancellationToken: cancellationToken);
            return new BlobDownload(response.Value.Content, response.Value.Details.ContentType);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }
}

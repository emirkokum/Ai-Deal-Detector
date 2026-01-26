using System.Text.Json.Serialization;

namespace AIDealDetector.Core.Models;

public class CheapSharkDeal
{
    [JsonPropertyName("internalName")]
    public string InternalName { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("dealID")]
    public string DealId { get; set; } = string.Empty;

    [JsonPropertyName("storeID")]
    public string StoreId { get; set; } = string.Empty;

    [JsonPropertyName("gameID")]
    public string GameId { get; set; } = string.Empty;

    [JsonPropertyName("salePrice")]
    public string SalePrice { get; set; } = string.Empty;

    [JsonPropertyName("normalPrice")]
    public string NormalPrice { get; set; } = string.Empty;

    [JsonPropertyName("savings")]
    public string Savings { get; set; } = string.Empty;

    [JsonPropertyName("steamAppID")]
    public string? SteamAppId { get; set; }

    [JsonPropertyName("thumb")]
    public string? Thumb { get; set; }
}

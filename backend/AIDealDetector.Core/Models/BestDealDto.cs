namespace AIDealDetector.Core.Models;

public class BestDealDto
{
    public Guid Id { get; set; }
    public string GameName { get; set; } = string.Empty;
    public double OldPrice { get; set; }
    public double NewPrice { get; set; }
    public string Currency { get; set; } = "USD";
    public int DealScore { get; set; }
    public string? AiAnalysis { get; set; }
    public bool IsHistoricalLow { get; set; }
    public string? ImageUrl { get; set; }
    public string? StoreUrl { get; set; }
    public int DiscountPercent { get; set; }
    public DateTime CreatedAt { get; set; }
}

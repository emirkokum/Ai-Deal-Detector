namespace AIDealDetector.Core.Models;

public class DealAnalysisRequest
{
    public Guid GameId { get; set; }
    public string GameName { get; set; } = string.Empty;
    public double CurrentPrice { get; set; }
    public double AveragePrice { get; set; }
    public double HistoricalLow { get; set; }
    public List<PriceHistoryItem> PriceHistory { get; set; } = [];
}

public class PriceHistoryItem
{
    public double Amount { get; set; }
    public string Source { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

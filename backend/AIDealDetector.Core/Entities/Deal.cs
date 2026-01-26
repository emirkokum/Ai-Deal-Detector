namespace AIDealDetector.Core.Entities;

public class Deal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public double OldPrice { get; set; }
    public double NewPrice { get; set; }
    public string Currency { get; set; } = "USD";
    public int DealScore { get; set; }
    public string? AiAnalysis { get; set; }
    public Guid GameId { get; set; }
    public bool IsHistoricalLow { get; set; } = false;
    public DateTime? LastNotifiedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public Game Game { get; set; } = null!;
}

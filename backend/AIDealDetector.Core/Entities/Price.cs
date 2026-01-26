namespace AIDealDetector.Core.Entities;

public class Price
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public double Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public string Source { get; set; } = string.Empty;
    public Guid GameId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public Game Game { get; set; } = null!;
}

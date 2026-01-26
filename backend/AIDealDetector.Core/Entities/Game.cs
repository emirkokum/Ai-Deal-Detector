namespace AIDealDetector.Core.Entities;

public class Game
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Platform { get; set; } = "steam";
    public string? ExternalId { get; set; }  // Steam AppID
    public string? ImageUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Price> Prices { get; set; } = new List<Price>();
    public Deal? Deal { get; set; }
}

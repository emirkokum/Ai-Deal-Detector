namespace AIDealDetector.Core.Entities;

public class Subscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ChatId { get; set; } = string.Empty;
    public List<string> GameIds { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

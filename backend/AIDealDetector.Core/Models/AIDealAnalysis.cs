namespace AIDealDetector.Core.Models;

public class AIDealAnalysis
{
    public Guid GameId { get; set; }
    public int Score { get; set; }
    public string Reasoning { get; set; } = string.Empty;
}

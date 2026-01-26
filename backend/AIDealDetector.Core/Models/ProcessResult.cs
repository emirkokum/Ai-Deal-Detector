namespace AIDealDetector.Core.Models;

public class ProcessResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int ProcessedCount { get; set; }
    public int NotificationsSent { get; set; }
}

namespace AIDealDetector.Core.Interfaces;

public interface IScraperService
{
    Task TriggerDailyScrapingAsync();
    Task ResetAllDataAsync();
}

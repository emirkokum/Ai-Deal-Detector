using AIDealDetector.Core.Interfaces;
using Microsoft.Extensions.Logging;

namespace AIDealDetector.Infrastructure.Services;

public sealed class ScraperService(
    IPricesService pricesService,
    ILogger<ScraperService> logger) : IScraperService
{
    public async Task TriggerDailyScrapingAsync()
    {
        logger.LogInformation("Daily scraping job triggered at {Time}", DateTime.UtcNow);

        try
        {
            var result = await pricesService.ProcessAllDealsAsync();
            logger.LogInformation("Daily scraping completed: {Message}", result.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Daily scraping failed");
            throw;
        }
    }

    public async Task ResetAllDataAsync()
    {
        logger.LogWarning("Resetting all data and triggering full scrape...");

        await pricesService.ResetDatabaseAsync();
        await TriggerDailyScrapingAsync();
    }
}

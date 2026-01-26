using System.Globalization;
using System.Text.Json;
using AIDealDetector.Core.Entities;
using AIDealDetector.Core.Interfaces;
using AIDealDetector.Core.Models;
using AIDealDetector.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AIDealDetector.Infrastructure.Services;

public class PricesService(
    AppDbContext context,
    HttpClient httpClient,
    IAIService aiService,
    ITelegramService telegramService,
    ISubscriptionsService subscriptionsService,
    ILogger<PricesService> logger) : IPricesService
{
    private const string CheapSharkApiUrl = "https://www.cheapshark.com/api/1.0/deals?storeID=1&pageSize=50";
    private const int BatchSize = 3;
    private const int BatchDelayMs = 15000;
    private const int MinDiscountThreshold = 70;
    private const int MinNotifyScore = 85;
    private const int MinNotifyDiscount = 50;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<ProcessResult> ProcessAllDealsAsync(CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Starting deal processing...");
        var result = new ProcessResult();

        try
        {
            logger.LogInformation("Fetching deals from CheapShark API...");
            string response;
            try
            {
                response = await httpClient.GetStringAsync(CheapSharkApiUrl, cancellationToken);
                logger.LogInformation("CheapShark API response received: {Length} bytes", response.Length);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to fetch from CheapShark API. Exception type: {Type}", ex.GetType().Name);
                throw;
            }
            var deals = JsonSerializer.Deserialize<List<CheapSharkDeal>>(response, JsonOptions);

            if (deals is not { Count: > 0 })
            {
                logger.LogWarning("No deals received from CheapShark");
                return new ProcessResult { Success = false, Message = "No deals received" };
            }

            logger.LogInformation("Received {Count} deals from CheapShark", deals.Count);

            var candidatesForAnalysis = new List<DealCandidate>();

            foreach (var deal in deals)
            {
                cancellationToken.ThrowIfCancellationRequested();

                try
                {
                    var candidate = await ProcessSingleDealAsync(deal, cancellationToken);
                    if (candidate is not null)
                    {
                        candidatesForAnalysis.Add(candidate);
                    }
                    result.ProcessedCount++;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error processing deal for {GameName}", deal.Title);
                }
            }

            logger.LogInformation("{Count} games eligible for AI analysis", candidatesForAnalysis.Count);

            var batches = candidatesForAnalysis
                .Chunk(BatchSize)
                .ToList();

            for (var i = 0; i < batches.Count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var notificationsSent = await AnalyzeBatchAsync(batches[i].ToList(), cancellationToken);
                result.NotificationsSent += notificationsSent;

                if (i < batches.Count - 1)
                {
                    logger.LogInformation("Waiting {Delay}ms before next batch...", BatchDelayMs);
                    await Task.Delay(BatchDelayMs, cancellationToken);
                }
            }

            result.Success = true;
            result.Message = $"Processed {result.ProcessedCount} deals, sent {result.NotificationsSent} notifications";
            logger.LogInformation("{Message}", result.Message);
            return result;
        }
        catch (OperationCanceledException ex)
        {
            logger.LogWarning(ex, "Deal processing was cancelled. CancellationToken requested: {Requested}, Exception type: {Type}",
                cancellationToken.IsCancellationRequested, ex.GetType().Name);
            return new ProcessResult { Success = false, Message = "Processing cancelled" };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to process deals");
            return new ProcessResult { Success = false, Message = ex.Message };
        }
    }

    private async Task<DealCandidate?> ProcessSingleDealAsync(CheapSharkDeal deal, CancellationToken cancellationToken)
    {
        var game = await UpsertGameAsync(deal, cancellationToken);

        if (!TryParsePrice(deal.SalePrice, out var currentPrice) ||
            !TryParsePrice(deal.NormalPrice, out var normalPrice))
        {
            logger.LogWarning("Failed to parse prices for {GameName}", deal.Title);
            return null;
        }

        if (game.Prices.Count == 0)
        {
            await LoadHistoricalPricesAsync(game, normalPrice, cancellationToken);
        }

        var lastPrice = await context.Prices
            .Where(p => p.GameId == game.Id && p.Source == "Steam")
            .OrderByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (lastPrice is not null && Math.Abs(lastPrice.Amount - currentPrice) <= 0.01)
        {
            return null;
        }

        await SavePriceAsync(game.Id, currentPrice, "USD", "Steam", cancellationToken);

        var eligibility = await CheckDealEligibilityAsync(game.Id, currentPrice, cancellationToken);
        if (!eligibility.IsEligible)
        {
            return null;
        }

        return new DealCandidate
        {
            Game = game,
            CurrentPrice = currentPrice,
            OldPrice = normalPrice,
            AveragePrice = eligibility.AveragePrice,
            HistoricalLow = eligibility.HistoricalLow,
            DiscountRate = eligibility.DiscountRate
        };
    }

    private static bool TryParsePrice(string? priceString, out double price)
    {
        price = 0;
        return !string.IsNullOrEmpty(priceString) &&
               double.TryParse(priceString, NumberStyles.Any, CultureInfo.InvariantCulture, out price);
    }

    private async Task<Game> UpsertGameAsync(CheapSharkDeal deal, CancellationToken cancellationToken)
    {
        var existingGame = await context.Games
            .Include(g => g.Prices)
            .FirstOrDefaultAsync(g => g.ExternalId == deal.SteamAppId, cancellationToken);

        if (existingGame is not null)
        {
            return existingGame;
        }

        var imageUrl = !string.IsNullOrEmpty(deal.SteamAppId)
            ? $"https://cdn.cloudflare.steamstatic.com/steam/apps/{deal.SteamAppId}/header.jpg"
            : deal.Thumb;

        var game = new Game
        {
            Name = deal.Title,
            Platform = "steam",
            ExternalId = deal.SteamAppId,
            ImageUrl = imageUrl
        };

        context.Games.Add(game);
        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Created new game: {GameName} ({ExternalId})", deal.Title, deal.SteamAppId);

        return game;
    }

    private async Task LoadHistoricalPricesAsync(Game game, double normalPrice, CancellationToken cancellationToken)
    {
        var prices = new[]
        {
            new Price { GameId = game.Id, Amount = normalPrice, Currency = "USD", Source = "Steam_Baseline" },
            new Price { GameId = game.Id, Amount = normalPrice, Currency = "USD", Source = "Steam_Historical_Low" }
        };

        context.Prices.AddRange(prices);
        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Loaded historical prices for {GameName}", game.Name);
    }

    private async Task<DealEligibility> CheckDealEligibilityAsync(
        Guid gameId,
        double currentPrice,
        CancellationToken cancellationToken)
    {
        var result = new DealEligibility { IsEligible = false };

        var existingDeal = await context.Deals
            .FirstOrDefaultAsync(d => d.GameId == gameId, cancellationToken);

        if (existingDeal is not null)
        {
            var hoursSinceUpdate = (DateTime.UtcNow - existingDeal.UpdatedAt).TotalHours;
            if (hoursSinceUpdate < 24 && existingDeal.DealScore is not (50 or 75))
            {
                return result;
            }
        }

        var cutoffDate = DateTime.UtcNow.AddDays(-90);
        var prices = await context.Prices
            .Where(p => p.GameId == gameId && p.CreatedAt >= cutoffDate)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(cancellationToken);

        if (prices.Count < 2)
        {
            return result;
        }

        var regularPrices = prices
            .Where(p => p.Source is "Steam" or "Steam_Baseline")
            .ToList();

        result.AveragePrice = regularPrices.Count > 0
            ? regularPrices.Average(p => p.Amount)
            : currentPrice;

        var historicalLowPrice = prices.Find(p => p.Source == "Steam_Historical_Low");
        result.HistoricalLow = historicalLowPrice?.Amount ?? result.AveragePrice;

        result.DiscountRate = result.AveragePrice > 0
            ? ((result.AveragePrice - currentPrice) / result.AveragePrice) * 100
            : 0;

        result.IsEligible = result.DiscountRate >= MinDiscountThreshold;

        return result;
    }

    private async Task<int> AnalyzeBatchAsync(List<DealCandidate> candidates, CancellationToken cancellationToken)
    {
        var notificationsSent = 0;

        var analysisRequests = candidates.Select(c => new DealAnalysisRequest
        {
            GameId = c.Game.Id,
            GameName = c.Game.Name,
            CurrentPrice = c.CurrentPrice,
            AveragePrice = c.AveragePrice,
            HistoricalLow = c.HistoricalLow,
            PriceHistory = c.Game.Prices.Select(p => new PriceHistoryItem
            {
                Amount = p.Amount,
                Source = p.Source,
                CreatedAt = p.CreatedAt
            }).ToList()
        }).ToList();

        var analyses = await aiService.AnalyzeDealsBatchAsync(analysisRequests, cancellationToken);

        var dealsToAdd = new List<Deal>();
        var dealsToUpdate = new List<Deal>();
        var pricesToUpdate = new List<Price>();
        var notificationsToSend = new List<(string ChatId, DealNotification Notification)>();

        foreach (var analysis in analyses)
        {
            var candidate = candidates.Find(c => c.Game.Id == analysis.GameId);
            if (candidate is null) continue;

            var isHistoricalLow = candidate.CurrentPrice <= candidate.HistoricalLow;

            var existingDeal = await context.Deals
                .FirstOrDefaultAsync(d => d.GameId == candidate.Game.Id, cancellationToken);

            Deal dealRecord;
            if (existingDeal is not null)
            {
                existingDeal.OldPrice = candidate.OldPrice;
                existingDeal.NewPrice = candidate.CurrentPrice;
                existingDeal.DealScore = analysis.Score;
                existingDeal.AiAnalysis = analysis.Reasoning;
                existingDeal.IsHistoricalLow = isHistoricalLow;
                dealsToUpdate.Add(existingDeal);
                dealRecord = existingDeal;
            }
            else
            {
                dealRecord = new Deal
                {
                    GameId = candidate.Game.Id,
                    OldPrice = candidate.OldPrice,
                    NewPrice = candidate.CurrentPrice,
                    DealScore = analysis.Score,
                    AiAnalysis = analysis.Reasoning,
                    IsHistoricalLow = isHistoricalLow
                };
                dealsToAdd.Add(dealRecord);
            }

            if (ShouldNotify(dealRecord, candidate.DiscountRate))
            {
                var notification = CreateNotification(candidate, analysis, isHistoricalLow);
                dealRecord.LastNotifiedAt = DateTime.UtcNow;

                notificationsToSend.Add((string.Empty, notification));

                var subscriptions = await subscriptionsService.FindByGameIdAsync(candidate.Game.Id.ToString());
                foreach (var sub in subscriptions)
                {
                    notificationsToSend.Add((sub.ChatId, notification));
                }
            }

            if (isHistoricalLow)
            {
                var historicalLowPrice = await context.Prices
                    .FirstOrDefaultAsync(p => p.GameId == candidate.Game.Id && p.Source == "Steam_Historical_Low", cancellationToken);

                if (historicalLowPrice is not null)
                {
                    historicalLowPrice.Amount = candidate.CurrentPrice;
                    pricesToUpdate.Add(historicalLowPrice);
                }
            }
        }

        if (dealsToAdd.Count > 0)
        {
            context.Deals.AddRange(dealsToAdd);
        }

        await context.SaveChangesAsync(cancellationToken);

        foreach (var (chatId, notification) in notificationsToSend)
        {
            var sent = string.IsNullOrEmpty(chatId)
                ? await telegramService.SendDealNotificationAsync(notification)
                : await telegramService.SendDealNotificationToChatAsync(chatId, notification);

            if (sent && string.IsNullOrEmpty(chatId))
            {
                notificationsSent++;
            }
        }

        return notificationsSent;
    }

    private static DealNotification CreateNotification(DealCandidate candidate, AIDealAnalysis analysis, bool isHistoricalLow)
    {
        return new DealNotification
        {
            GameName = candidate.Game.Name,
            OldPrice = candidate.OldPrice,
            NewPrice = candidate.CurrentPrice,
            Currency = "USD",
            DiscountPercent = (int)candidate.DiscountRate,
            DealScore = analysis.Score,
            AiAnalysis = analysis.Reasoning,
            ImageUrl = candidate.Game.ImageUrl,
            StoreUrl = !string.IsNullOrEmpty(candidate.Game.ExternalId)
                ? $"https://store.steampowered.com/app/{candidate.Game.ExternalId}"
                : null,
            IsHistoricalLow = isHistoricalLow
        };
    }

    private static bool ShouldNotify(Deal deal, double discountRate)
    {
        if (deal.LastNotifiedAt.HasValue)
        {
            var hoursSinceNotify = (DateTime.UtcNow - deal.LastNotifiedAt.Value).TotalHours;
            if (hoursSinceNotify < 24)
            {
                return false;
            }
        }

        if (deal.IsHistoricalLow)
        {
            return true;
        }

        return deal.DealScore >= MinNotifyScore && discountRate >= MinNotifyDiscount;
    }

    public async Task<Price> SavePriceAsync(
        Guid gameId,
        double amount,
        string currency,
        string source,
        CancellationToken cancellationToken = default)
    {
        var price = new Price
        {
            GameId = gameId,
            Amount = amount,
            Currency = currency,
            Source = source
        };

        context.Prices.Add(price);
        await context.SaveChangesAsync(cancellationToken);
        return price;
    }

    public async Task<Price> AppendPriceAsync(Guid gameId, double amount, string currency, string source)
    {
        var gameExists = await context.Games.AnyAsync(g => g.Id == gameId);
        if (!gameExists)
        {
            throw new KeyNotFoundException($"Game with ID {gameId} not found");
        }

        return await SavePriceAsync(gameId, amount, currency, source);
    }

    public async Task<List<Deal>> GetAllDealsAsync(CancellationToken cancellationToken = default)
    {
        return await context.Deals
            .Include(d => d.Game)
            .OrderByDescending(d => d.DealScore)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public async Task<List<BestDealDto>> GetBestDealsAsync(CancellationToken cancellationToken = default)
    {
        return await context.Deals
            .Include(d => d.Game)
            .Where(d => d.DealScore >= 70)
            .OrderByDescending(d => d.DealScore)
            .AsNoTracking()
            .Select(d => new BestDealDto
            {
                Id = d.Id,
                GameName = d.Game.Name,
                OldPrice = d.OldPrice,
                NewPrice = d.NewPrice,
                Currency = d.Currency,
                DealScore = d.DealScore,
                AiAnalysis = d.AiAnalysis,
                IsHistoricalLow = d.IsHistoricalLow,
                ImageUrl = d.Game.ImageUrl ?? $"https://cdn.cloudflare.steamstatic.com/steam/apps/{d.Game.ExternalId}/header.jpg",
                StoreUrl = !string.IsNullOrEmpty(d.Game.ExternalId)
                    ? $"https://store.steampowered.com/app/{d.Game.ExternalId}"
                    : null,
                DiscountPercent = d.OldPrice > 0 ? (int)((d.OldPrice - d.NewPrice) / d.OldPrice * 100) : 0,
                CreatedAt = d.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task ResetDatabaseAsync(CancellationToken cancellationToken = default)
    {
        logger.LogWarning("Resetting database...");

        await context.Deals.ExecuteDeleteAsync(cancellationToken);
        await context.Prices.ExecuteDeleteAsync(cancellationToken);
        await context.Games.ExecuteDeleteAsync(cancellationToken);

        logger.LogInformation("Database reset complete");
    }

    private sealed record DealCandidate
    {
        public required Game Game { get; init; }
        public required double CurrentPrice { get; init; }
        public required double OldPrice { get; init; }
        public required double AveragePrice { get; init; }
        public required double HistoricalLow { get; init; }
        public required double DiscountRate { get; init; }
    }

    private sealed record DealEligibility
    {
        public bool IsEligible { get; set; }
        public double AveragePrice { get; set; }
        public double HistoricalLow { get; set; }
        public double DiscountRate { get; set; }
    }
}

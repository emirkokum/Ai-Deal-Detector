using AIDealDetector.Core.Entities;
using AIDealDetector.Core.Interfaces;
using AIDealDetector.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AIDealDetector.Infrastructure.Services;

public sealed class SubscriptionsService(
    AppDbContext context,
    ILogger<SubscriptionsService> logger) : ISubscriptionsService
{
    public async Task<Subscription> CreateOrUpdateAsync(string chatId, List<string> gameIds)
    {
        var existing = await context.Subscriptions
            .FirstOrDefaultAsync(s => s.ChatId == chatId);

        if (existing is not null)
        {
            existing.GameIds = gameIds;
            existing.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync();
            logger.LogInformation("Updated subscription for chat {ChatId}", chatId);
            return existing;
        }

        var subscription = new Subscription
        {
            ChatId = chatId,
            GameIds = gameIds
        };

        context.Subscriptions.Add(subscription);
        await context.SaveChangesAsync();
        logger.LogInformation("Created subscription for chat {ChatId}", chatId);
        return subscription;
    }

    public async Task<Subscription?> FindByChatIdAsync(string chatId)
    {
        return await context.Subscriptions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ChatId == chatId);
    }

    public async Task<List<Subscription>> FindByGameIdAsync(string gameId)
    {
        return await context.Subscriptions
            .AsNoTracking()
            .Where(s => s.GameIds.Contains(gameId))
            .ToListAsync();
    }

    public async Task<List<Subscription>> GetAllSubscriptionsAsync()
    {
        return await context.Subscriptions
            .AsNoTracking()
            .ToListAsync();
    }
}

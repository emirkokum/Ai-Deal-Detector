using AIDealDetector.Core.Entities;

namespace AIDealDetector.Core.Interfaces;

public interface ISubscriptionsService
{
    Task<Subscription> CreateOrUpdateAsync(string chatId, List<string> gameIds);
    Task<Subscription?> FindByChatIdAsync(string chatId);
    Task<List<Subscription>> FindByGameIdAsync(string gameId);
    Task<List<Subscription>> GetAllSubscriptionsAsync();
}

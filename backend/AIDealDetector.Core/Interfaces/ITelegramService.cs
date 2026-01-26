using AIDealDetector.Core.Models;

namespace AIDealDetector.Core.Interfaces;

public interface ITelegramService
{
    Task<bool> SendDealNotificationAsync(DealNotification notification);
    Task<bool> SendDealNotificationToChatAsync(string chatId, DealNotification notification);
    Task<bool> SendTestMessageAsync();
}

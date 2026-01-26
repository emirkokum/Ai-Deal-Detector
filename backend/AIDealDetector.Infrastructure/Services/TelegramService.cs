using AIDealDetector.Core.Interfaces;
using AIDealDetector.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace AIDealDetector.Infrastructure.Services;

public sealed class TelegramService : ITelegramService
{
    private readonly TelegramBotClient? _botClient;
    private readonly string? _adminChatId;
    private readonly ILogger<TelegramService> _logger;
    private readonly bool _isConfigured;

    private static readonly char[] CharsToEscape =
        ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

    public TelegramService(IConfiguration configuration, ILogger<TelegramService> logger)
    {
        _logger = logger;

        var botToken = configuration["Telegram:BotToken"];
        _adminChatId = configuration["Telegram:ChatId"];

        if (!string.IsNullOrEmpty(botToken) && !string.IsNullOrEmpty(_adminChatId))
        {
            _botClient = new TelegramBotClient(botToken);
            _isConfigured = true;
            _logger.LogInformation("Telegram bot initialized successfully");
        }
        else
        {
            _isConfigured = false;
            _logger.LogWarning("Telegram bot not configured - missing BotToken or ChatId");
        }
    }

    public async Task<bool> SendDealNotificationAsync(DealNotification notification)
    {
        if (!_isConfigured || _botClient is null || string.IsNullOrEmpty(_adminChatId))
        {
            _logger.LogWarning("Telegram not configured, skipping notification");
            return false;
        }

        return await SendDealNotificationToChatAsync(_adminChatId, notification);
    }

    public async Task<bool> SendDealNotificationToChatAsync(string chatId, DealNotification notification)
    {
        if (!_isConfigured || _botClient is null)
        {
            _logger.LogWarning("Telegram not configured, skipping notification");
            return false;
        }

        try
        {
            var message = FormatDealMessage(notification, isSubscription: chatId != _adminChatId);

            if (!string.IsNullOrEmpty(notification.ImageUrl))
            {
                try
                {
                    await _botClient.SendPhoto(
                        chatId: chatId,
                        photo: new InputFileUrl(notification.ImageUrl),
                        caption: message,
                        parseMode: ParseMode.MarkdownV2);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send photo, falling back to text message");
                    await _botClient.SendMessage(
                        chatId: chatId,
                        text: message,
                        parseMode: ParseMode.MarkdownV2);
                }
            }
            else
            {
                await _botClient.SendMessage(
                    chatId: chatId,
                    text: message,
                    parseMode: ParseMode.MarkdownV2);
            }

            _logger.LogInformation("Sent deal notification for {GameName} to chat {ChatId}",
                notification.GameName, chatId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send Telegram notification to chat {ChatId}", chatId);
            return false;
        }
    }

    public async Task<bool> SendTestMessageAsync()
    {
        if (!_isConfigured || _botClient is null || string.IsNullOrEmpty(_adminChatId))
        {
            _logger.LogWarning("Telegram not configured for test message");
            return false;
        }

        try
        {
            var testMessage = EscapeMarkdown($"Test message from AI Deal Detector - {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            await _botClient.SendMessage(
                chatId: _adminChatId,
                text: testMessage,
                parseMode: ParseMode.MarkdownV2);
            _logger.LogInformation("Test message sent successfully");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send test message");
            return false;
        }
    }

    private static string FormatDealMessage(DealNotification notification, bool isSubscription)
    {
        var header = isSubscription
            ? "FAVORI OYUNUNUZDA FIYAT DUSTU!"
            : "EFSANE FIRSAT YAKALANDI!";

        var historicalLowTag = notification.IsHistoricalLow
            ? "\nTARIHI EN DUSUK FIYAT!"
            : string.Empty;

        var message = $"""
            *{EscapeMarkdown(header)}*{EscapeMarkdown(historicalLowTag)}

            *{EscapeMarkdown(notification.GameName)}*

            {EscapeMarkdown(notification.OldPrice.ToString("F2"))} {EscapeMarkdown(notification.Currency)} ➜ *{EscapeMarkdown(notification.NewPrice.ToString("F2"))} {EscapeMarkdown(notification.Currency)}*
            İndirim: *%{notification.DiscountPercent}*
            Puan: *{notification.DealScore}/100*

            _{EscapeMarkdown(notification.AiAnalysis ?? "AI analizi mevcut değil")}_
            """;

        if (!string.IsNullOrEmpty(notification.StoreUrl))
        {
            message += $"\n\n[Steam'de Goruntule]({notification.StoreUrl})";
        }

        return message;
    }

    private static string EscapeMarkdown(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        foreach (var c in CharsToEscape)
        {
            text = text.Replace(c.ToString(), $"\\{c}");
        }

        return text;
    }
}

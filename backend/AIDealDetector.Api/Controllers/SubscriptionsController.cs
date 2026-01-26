using AIDealDetector.Api.DTOs;
using AIDealDetector.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AIDealDetector.Api.Controllers;

[ApiController]
[Route("[controller]")]
public sealed class SubscriptionsController(
    ISubscriptionsService subscriptionsService,
    ILogger<SubscriptionsController> logger) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateOrUpdateAsync([FromBody] CreateSubscriptionDto dto)
    {
        logger.LogInformation("Creating/updating subscription for chat {ChatId}", dto.ChatId);
        var subscription = await subscriptionsService.CreateOrUpdateAsync(dto.ChatId, dto.GameIds);
        return Ok(ApiResponse<object>.Ok(subscription, "Subscription saved successfully"));
    }

    [HttpGet("{chatId}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByChatIdAsync(string chatId)
    {
        var subscription = await subscriptionsService.FindByChatIdAsync(chatId);
        return subscription is null
            ? NotFound(ApiResponse.Error("Subscription not found"))
            : Ok(ApiResponse<object>.Ok(subscription));
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync()
    {
        var subscriptions = await subscriptionsService.GetAllSubscriptionsAsync();
        return Ok(ApiResponse<object>.Ok(subscriptions));
    }
}

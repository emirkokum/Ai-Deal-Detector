using AIDealDetector.Api.DTOs;
using AIDealDetector.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AIDealDetector.Api.Controllers;

[ApiController]
[Route("[controller]")]
public sealed class PricesController(
    IPricesService pricesService,
    IScraperService scraperService,
    ITelegramService telegramService,
    IConfiguration configuration,
    ILogger<PricesController> logger) : ControllerBase
{
    [HttpPost("append")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AppendPriceAsync([FromBody] AppendPriceDto dto)
    {
        var price = await pricesService.AppendPriceAsync(dto.GameId, dto.Amount, dto.Currency, dto.Source);
        return Ok(ApiResponse<object>.Ok(price, "Price appended successfully"));
    }

    [HttpGet("deals")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllDealsAsync(CancellationToken cancellationToken)
    {
        var deals = await pricesService.GetAllDealsAsync(cancellationToken);
        return Ok(ApiResponse<object>.Ok(deals));
    }

    [HttpGet("best-deals")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBestDealsAsync(CancellationToken cancellationToken)
    {
        var deals = await pricesService.GetBestDealsAsync(cancellationToken);
        return Ok(ApiResponse<object>.Ok(deals));
    }

    [HttpPost("reset-db")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResetDatabaseAsync(CancellationToken cancellationToken)
    {
        await scraperService.ResetAllDataAsync();
        return Ok(ApiResponse.Ok("Database reset and re-seeded successfully"));
    }

    [HttpPost("test-telegram")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> TestTelegramAsync()
    {
        var success = await telegramService.SendTestMessageAsync();
        return success
            ? Ok(ApiResponse.Ok("Test message sent successfully"))
            : BadRequest(ApiResponse.Error("Failed to send test message"));
    }

    [HttpPost("trigger")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> TriggerProcessAllDeals()
    {
        var cronSecret = configuration["CronSecret"];
        if (!string.IsNullOrEmpty(cronSecret))
        {
            var providedSecret = Request.Headers["x-cron-secret"].FirstOrDefault();
            if (providedSecret != cronSecret)
            {
                logger.LogWarning("Invalid cron secret provided from {IpAddress}",
                    HttpContext.Connection.RemoteIpAddress);
                return Unauthorized(ApiResponse.Error("Invalid cron secret"));
            }
        }

        logger.LogInformation("Manual trigger received for deal processing");
        await scraperService.TriggerDailyScrapingAsync();
        return Ok(ApiResponse.Ok("Deal processing triggered successfully"));
    }
}

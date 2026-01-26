using System.Net;
using System.Text.Json;
using AIDealDetector.Api.DTOs;

namespace AIDealDetector.Api.Middleware;

public sealed class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            var correlationId = context.TraceIdentifier;
            logger.LogError(ex, "Unhandled exception occurred. CorrelationId: {CorrelationId}", correlationId);
            await HandleExceptionAsync(context, ex, correlationId);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception, string correlationId)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, message) = exception switch
        {
            KeyNotFoundException => (HttpStatusCode.NotFound, exception.Message),
            ArgumentNullException => (HttpStatusCode.BadRequest, "Required parameter is missing"),
            ArgumentException => (HttpStatusCode.BadRequest, exception.Message),
            InvalidOperationException => (HttpStatusCode.BadRequest, exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, "Access denied"),
            OperationCanceledException => (HttpStatusCode.RequestTimeout, "Request was cancelled"),
            HttpRequestException => (HttpStatusCode.BadGateway, "External service unavailable"),
            TimeoutException => (HttpStatusCode.GatewayTimeout, "Operation timed out"),
            _ => (HttpStatusCode.InternalServerError, "An unexpected error occurred")
        };

        context.Response.StatusCode = (int)statusCode;

        var response = new ErrorResponse(
            Error: message,
            CorrelationId: correlationId,
            Timestamp: DateTime.UtcNow);

        var jsonResponse = JsonSerializer.Serialize(response, JsonOptions);
        await context.Response.WriteAsync(jsonResponse);
    }
}

public sealed record ErrorResponse(
    string Error,
    string CorrelationId,
    DateTime Timestamp);

public static class GlobalExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseGlobalExceptionMiddleware(this IApplicationBuilder app)
    {
        return app.UseMiddleware<GlobalExceptionMiddleware>();
    }
}

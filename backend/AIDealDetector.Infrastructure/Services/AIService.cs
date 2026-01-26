using System.Text;
using System.Text.Json;
using AIDealDetector.Core.Interfaces;
using AIDealDetector.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AIDealDetector.Infrastructure.Services;

public sealed class AIService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<AIService> logger) : IAIService
{
    private const string GeminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    private const int DefaultScore = 75;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly string? _apiKey = configuration["GeminiApiKey"];

    public async Task<List<AIDealAnalysis>> AnalyzeDealsBatchAsync(
        List<DealAnalysisRequest> deals,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            logger.LogWarning("AI analysis skipped - API key not configured");
            return CreateDefaultAnalysis(deals, "AI analysis not available");
        }

        try
        {
            var prompt = BuildAnalysisPrompt(deals);
            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                },
                generationConfig = new
                {
                    temperature = 0.7,
                    maxOutputTokens = 2048
                }
            };

            var jsonContent = JsonSerializer.Serialize(requestBody);
            using var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync(
                $"{GeminiEndpoint}?key={_apiKey}",
                content,
                cancellationToken);

            var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Gemini API error: {StatusCode} - {Response}",
                    response.StatusCode, responseText);
                return CreateDefaultAnalysis(deals, "AI service temporarily unavailable");
            }

            return ParseGeminiResponse(responseText, deals);
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("AI analysis was cancelled");
            throw;
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Network error while calling Gemini API");
            return CreateDefaultAnalysis(deals, "Network error during analysis");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to analyze deals with Gemini");
            return CreateDefaultAnalysis(deals, "Default score - AI analysis failed");
        }
    }

    private static string BuildAnalysisPrompt(List<DealAnalysisRequest> deals)
    {
        var sb = new StringBuilder(2048);
        sb.AppendLine("Analyze these game deals and determine if they are REAL discounts or MANIPULATED prices.");
        sb.AppendLine("For each game, provide a score (0-100) and brief reasoning (max 15 words).");
        sb.AppendLine();
        sb.AppendLine("Scoring rules:");
        sb.AppendLine("- If current price > average historical price, it's likely MANIPULATED (low score 0-40)");
        sb.AppendLine("- If current price <= historical low, it's definitely REAL (score 100)");
        sb.AppendLine("- Otherwise score based on how good the discount is compared to history (50-95)");
        sb.AppendLine();
        sb.AppendLine("Games to analyze:");

        foreach (var deal in deals)
        {
            sb.AppendLine();
            sb.AppendLine($"--- Game: {deal.GameName} (ID: {deal.GameId}) ---");
            sb.AppendLine($"Current Price: ${deal.CurrentPrice:F2}");
            sb.AppendLine($"Average Historical Price: ${deal.AveragePrice:F2}");
            sb.AppendLine($"Historical Low: ${deal.HistoricalLow:F2}");
            sb.AppendLine("Recent prices:");

            foreach (var price in deal.PriceHistory.Take(5))
            {
                sb.AppendLine($"  - ${price.Amount:F2} ({price.Source}) on {price.CreatedAt:yyyy-MM-dd}");
            }
        }

        sb.AppendLine();
        sb.AppendLine("Respond ONLY with valid JSON array in this exact format:");
        sb.AppendLine("[");
        sb.AppendLine("  {\"gameId\": \"<guid>\", \"score\": <0-100>, \"reasoning\": \"<max 15 words>\"},");
        sb.AppendLine("  ...");
        sb.AppendLine("]");

        return sb.ToString();
    }

    private List<AIDealAnalysis> ParseGeminiResponse(string responseText, List<DealAnalysisRequest> deals)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseText);
            var candidates = doc.RootElement.GetProperty("candidates");

            if (candidates.GetArrayLength() == 0)
            {
                return CreateDefaultAnalysis(deals, "No AI response candidates");
            }

            var textContent = candidates[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            if (string.IsNullOrEmpty(textContent))
            {
                return CreateDefaultAnalysis(deals, "Empty AI response");
            }

            var jsonStart = textContent.IndexOf('[');
            var jsonEnd = textContent.LastIndexOf(']');

            if (jsonStart < 0 || jsonEnd < 0 || jsonEnd <= jsonStart)
            {
                logger.LogWarning("Could not find JSON array in Gemini response");
                return CreateDefaultAnalysis(deals, "Invalid AI response format");
            }

            var jsonArray = textContent.Substring(jsonStart, jsonEnd - jsonStart + 1);
            var results = JsonSerializer.Deserialize<List<GeminiDealResult>>(jsonArray, JsonOptions);

            if (results is not { Count: > 0 })
            {
                return CreateDefaultAnalysis(deals, "Failed to parse AI response");
            }

            return results.Select(r => new AIDealAnalysis
            {
                GameId = Guid.TryParse(r.GameId, out var id) ? id : Guid.Empty,
                Score = Math.Clamp(r.Score, 0, 100),
                Reasoning = r.Reasoning ?? "No reasoning provided"
            }).Where(a => a.GameId != Guid.Empty).ToList();
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "JSON parsing error in Gemini response");
            return CreateDefaultAnalysis(deals, "JSON parsing error");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to parse Gemini response");
            return CreateDefaultAnalysis(deals, "Response parsing error");
        }
    }

    private static List<AIDealAnalysis> CreateDefaultAnalysis(List<DealAnalysisRequest> deals, string reasoning)
    {
        return deals.Select(d => new AIDealAnalysis
        {
            GameId = d.GameId,
            Score = DefaultScore,
            Reasoning = reasoning
        }).ToList();
    }

    private sealed record GeminiDealResult
    {
        public string GameId { get; init; } = string.Empty;
        public int Score { get; init; }
        public string? Reasoning { get; init; }
    }
}

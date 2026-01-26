using AIDealDetector.Core.Models;

namespace AIDealDetector.Core.Interfaces;

public interface IAIService
{
    Task<List<AIDealAnalysis>> AnalyzeDealsBatchAsync(
        List<DealAnalysisRequest> deals,
        CancellationToken cancellationToken = default);
}

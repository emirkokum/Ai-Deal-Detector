using AIDealDetector.Core.Entities;
using AIDealDetector.Core.Models;

namespace AIDealDetector.Core.Interfaces;

public interface IPricesService
{
    Task<ProcessResult> ProcessAllDealsAsync(CancellationToken cancellationToken = default);
    Task<Price> SavePriceAsync(Guid gameId, double amount, string currency, string source, CancellationToken cancellationToken = default);
    Task<Price> AppendPriceAsync(Guid gameId, double amount, string currency, string source);
    Task<List<Deal>> GetAllDealsAsync(CancellationToken cancellationToken = default);
    Task<List<BestDealDto>> GetBestDealsAsync(CancellationToken cancellationToken = default);
    Task ResetDatabaseAsync(CancellationToken cancellationToken = default);
}

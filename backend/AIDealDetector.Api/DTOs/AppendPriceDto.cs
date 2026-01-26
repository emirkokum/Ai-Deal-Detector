using System.ComponentModel.DataAnnotations;

namespace AIDealDetector.Api.DTOs;

public sealed record AppendPriceDto
{
    [Required]
    public Guid GameId { get; init; }

    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be positive")]
    public double Amount { get; init; }

    [Required]
    [StringLength(10)]
    public string Currency { get; init; } = "USD";

    [Required]
    [StringLength(50)]
    public string Source { get; init; } = string.Empty;
}

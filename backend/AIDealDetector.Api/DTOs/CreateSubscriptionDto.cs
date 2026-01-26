using System.ComponentModel.DataAnnotations;

namespace AIDealDetector.Api.DTOs;

public sealed record CreateSubscriptionDto
{
    [Required]
    [StringLength(50)]
    public string ChatId { get; init; } = string.Empty;

    [Required]
    [MinLength(1, ErrorMessage = "At least one game ID is required")]
    public List<string> GameIds { get; init; } = [];
}

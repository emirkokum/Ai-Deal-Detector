namespace AIDealDetector.Api.DTOs;

public sealed record ApiResponse<T>
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public T? Data { get; init; }

    public static ApiResponse<T> Ok(T data, string? message = null) => new()
    {
        Success = true,
        Message = message,
        Data = data
    };

    public static ApiResponse<T> Error(string message) => new()
    {
        Success = false,
        Message = message,
        Data = default
    };
}

public sealed record ApiResponse
{
    public bool Success { get; init; }
    public string? Message { get; init; }

    public static ApiResponse Ok(string? message = null) => new()
    {
        Success = true,
        Message = message
    };

    public static ApiResponse Error(string message) => new()
    {
        Success = false,
        Message = message
    };
}

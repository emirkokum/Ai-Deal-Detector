using AIDealDetector.Api.Middleware;
using AIDealDetector.Core.Interfaces;
using AIDealDetector.Infrastructure;
using AIDealDetector.Infrastructure.Data;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add infrastructure services (EF Core + all services)
builder.Services.AddInfrastructure(builder.Configuration);

// Get connection string
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

Console.WriteLine($"[BOOT] ConnectionString loaded: {!string.IsNullOrWhiteSpace(connectionString)}");

// Add Hangfire for background jobs
#pragma warning disable CS0618 // Type or member is obsolete
builder.Services.AddHangfire(config =>
{
    config
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UsePostgreSqlStorage(connectionString, new PostgreSqlStorageOptions
        {
            SchemaName = "hangfire",
            PrepareSchemaIfNecessary = true
        });
});
#pragma warning restore CS0618

builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = Environment.ProcessorCount;
    options.Queues = ["default", "critical"];
});

// Add controllers with JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add health checks
builder.Services.AddHealthChecks();

var app = builder.Build();

// Run database migrations on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    Console.WriteLine("[BOOT] Running database migrations...");
    dbContext.Database.Migrate();
    Console.WriteLine("[BOOT] Database migrations completed successfully.");
}

// Configure the HTTP request pipeline
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "AI Deal Detector API v1");
    options.RoutePrefix = "swagger";
});

app.UseGlobalExceptionMiddleware();
app.UseCors();
app.UseAuthorization();
app.MapControllers();

// Map health check endpoints
app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Redirect("/swagger"));

// Configure Hangfire dashboard
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    DashboardTitle = "AI Deal Detector Jobs"
});

app.Lifetime.ApplicationStarted.Register(() =>
{
    try
    {
        RecurringJob.AddOrUpdate<IScraperService>(
            "daily-deal-scraper",
            service => service.TriggerDailyScrapingAsync(),
            "0 7 * * *",
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

        Console.WriteLine("[BOOT] Hangfire recurring job registered: daily-deal-scraper at 07:00 UTC");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[BOOT] Warning: Could not register Hangfire job. Error: {ex.Message}");
    }
});

app.Run();

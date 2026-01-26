using AIDealDetector.Api.Middleware;
using AIDealDetector.Core.Interfaces;
using AIDealDetector.Infrastructure;
using AIDealDetector.Infrastructure.Data;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Add infrastructure services (EF Core + all services)
builder.Services.AddInfrastructure(builder.Configuration);

// Add Hangfire for background jobs
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var hangfireEnabled = false;

try
{
    using var testConnection = new NpgsqlConnection(connectionString);
    await testConnection.OpenAsync();
    await testConnection.CloseAsync();

    builder.Services.AddHangfire(config => config
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UsePostgreSqlStorage(options => options.UseNpgsqlConnection(connectionString)));

    builder.Services.AddHangfireServer(options =>
    {
        options.WorkerCount = Environment.ProcessorCount;
        options.Queues = ["default", "critical"];
    });

    hangfireEnabled = true;
}
catch (Exception ex)
{
    Console.WriteLine($"Warning: Could not initialize Hangfire - background jobs disabled. Error: {ex.Message}");
}

// Add controllers with JSON options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "AI Deal Detector API",
        Version = "v1",
        Description = "Scrapes game prices, analyzes deals with AI, and sends notifications"
    });
});

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
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString ?? throw new InvalidOperationException("Connection string required"));

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "AI Deal Detector API v1");
    options.RoutePrefix = "swagger";
});

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseGlobalExceptionMiddleware();
app.UseCors();
app.UseAuthorization();
app.MapControllers();

// Map health check endpoints
app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Redirect("/swagger"));

// Configure Hangfire dashboard only if enabled
if (hangfireEnabled)
{
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

            Console.WriteLine("Hangfire recurring job registered: daily-deal-scraper at 07:00 UTC");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Could not register Hangfire job. Error: {ex.Message}");
        }
    });
}

// Ensure database is migrated
await using (var scope = app.Services.CreateAsyncScope())
{
    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();
        Console.WriteLine("Database migration completed successfully");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Database migration failed. Error: {ex.Message}");
    }
}

await app.RunAsync();

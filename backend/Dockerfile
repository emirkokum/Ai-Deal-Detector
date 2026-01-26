# =========================
# Build stage
# =========================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files first (layer caching)
COPY AIDealDetector.sln .
COPY AIDealDetector.Api/AIDealDetector.Api.csproj AIDealDetector.Api/
COPY AIDealDetector.Core/AIDealDetector.Core.csproj AIDealDetector.Core/
COPY AIDealDetector.Infrastructure/AIDealDetector.Infrastructure.csproj AIDealDetector.Infrastructure/

# Restore dependencies
RUN dotnet restore

# Copy remaining source code
COPY . .

# Publish
RUN dotnet publish AIDealDetector.Api/AIDealDetector.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# =========================
# Runtime stage
# =========================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy published output
COPY --from=build /app/publish .

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "AIDealDetector.Api.dll"]

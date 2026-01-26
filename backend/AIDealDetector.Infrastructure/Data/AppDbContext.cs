using AIDealDetector.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AIDealDetector.Infrastructure.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Price> Prices => Set<Price>();
    public DbSet<Deal> Deals => Set<Deal>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Game>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ExternalId).IsUnique();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(256);
            entity.Property(e => e.Platform).HasMaxLength(50);
            entity.Property(e => e.ExternalId).HasMaxLength(50);
            entity.Property(e => e.ImageUrl).HasMaxLength(512);
        });

        modelBuilder.Entity<Price>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.GameId, e.Source, e.CreatedAt });
            entity.Property(e => e.Currency).HasMaxLength(10);
            entity.Property(e => e.Source).HasMaxLength(50);
            entity.HasOne(e => e.Game)
                  .WithMany(g => g.Prices)
                  .HasForeignKey(e => e.GameId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Deal>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.GameId).IsUnique();
            entity.HasIndex(e => e.DealScore);
            entity.Property(e => e.Currency).HasMaxLength(10);
            entity.Property(e => e.AiAnalysis).HasMaxLength(1000);
            entity.HasOne(e => e.Game)
                  .WithOne(g => g.Deal)
                  .HasForeignKey<Deal>(e => e.GameId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ChatId).IsUnique();
            entity.Property(e => e.ChatId).IsRequired().HasMaxLength(50);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Modified))
        {
            switch (entry.Entity)
            {
                case Game g:
                    g.UpdatedAt = now;
                    break;
                case Price p:
                    p.UpdatedAt = now;
                    break;
                case Deal d:
                    d.UpdatedAt = now;
                    break;
                case Subscription s:
                    s.UpdatedAt = now;
                    break;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}

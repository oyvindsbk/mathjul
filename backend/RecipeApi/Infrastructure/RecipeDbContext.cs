using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using RecipeApi.Features.Recipes;

namespace RecipeApi.Infrastructure;

public class RecipeDbContext : DbContext
{
    public RecipeDbContext(DbContextOptions<RecipeDbContext> options) : base(options)
    {
    }

    public DbSet<Recipe> Recipes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure Recipe entity
        modelBuilder.Entity<Recipe>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.CookTime).HasMaxLength(50);
            entity.Property(e => e.Difficulty).HasMaxLength(20);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            entity.Property(e => e.Ingredients)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<StructuredIngredient>>(v, (JsonSerializerOptions?)null) ?? new())
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(new ValueComparer<List<StructuredIngredient>>(
                    (c1, c2) => JsonSerializer.Serialize(c1, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(c2, (JsonSerializerOptions?)null),
                    c => c == null ? 0 : JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                    c => JsonSerializer.Deserialize<List<StructuredIngredient>>(JsonSerializer.Serialize(c, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));
        });

        // Seed initial data
        var seedDate = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        
        modelBuilder.Entity<Recipe>().HasData(
            new Recipe
            {
                Id = 1,
                Title = "Classic Spaghetti Carbonara",
                Description = "A traditional Italian pasta dish with eggs, cheese, and pancetta",
                CookTime = "20 minutes",
                Difficulty = "Medium",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = seedDate,
                UpdatedAt = seedDate
            },
            new Recipe
            {
                Id = 2,
                Title = "Chicken Tikka Masala",
                Description = "Creamy and flavorful Indian curry with tender chicken pieces",
                CookTime = "45 minutes",
                Difficulty = "Medium",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = seedDate,
                UpdatedAt = seedDate
            },
            new Recipe
            {
                Id = 3,
                Title = "Chocolate Chip Cookies",
                Description = "Soft and chewy homemade cookies with chocolate chips",
                CookTime = "25 minutes",
                Difficulty = "Easy",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = seedDate,
                UpdatedAt = seedDate
            },
            new Recipe
            {
                Id = 4,
                Title = "Caesar Salad",
                Description = "Fresh romaine lettuce with homemade caesar dressing and croutons",
                CookTime = "15 minutes",
                Difficulty = "Easy",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = seedDate,
                UpdatedAt = seedDate
            }
        );
    }
}
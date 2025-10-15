using Microsoft.EntityFrameworkCore;
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
        });

        // Seed initial data
        modelBuilder.Entity<Recipe>().HasData(
            new Recipe
            {
                Id = 1,
                Title = "Classic Spaghetti Carbonara",
                Description = "A traditional Italian pasta dish with eggs, cheese, and pancetta",
                CookTime = "20 minutes",
                Difficulty = "Medium",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Recipe
            {
                Id = 2,
                Title = "Chicken Tikka Masala",
                Description = "Creamy and flavorful Indian curry with tender chicken pieces",
                CookTime = "45 minutes",
                Difficulty = "Medium",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Recipe
            {
                Id = 3,
                Title = "Chocolate Chip Cookies",
                Description = "Soft and chewy homemade cookies with chocolate chips",
                CookTime = "25 minutes",
                Difficulty = "Easy",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new Recipe
            {
                Id = 4,
                Title = "Caesar Salad",
                Description = "Fresh romaine lettuce with homemade caesar dressing and croutons",
                CookTime = "15 minutes",
                Difficulty = "Easy",
                ImageUrl = "/api/placeholder/300/200",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        );
    }
}
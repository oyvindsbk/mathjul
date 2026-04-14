using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using RecipeApi.Features.Auth;
using RecipeApi.Features.Groups;
using RecipeApi.Features.MealPlans;
using RecipeApi.Features.Recipes;

namespace RecipeApi.Infrastructure;

public class RecipeDbContext : DbContext
{
    public RecipeDbContext(DbContextOptions<RecipeDbContext> options) : base(options)
    {
    }

    public DbSet<Recipe> Recipes { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Group> Groups { get; set; }
    public DbSet<GroupMember> GroupMembers { get; set; }
    public DbSet<RecipeGroup> RecipeGroups { get; set; }
    public DbSet<RecipeLike> RecipeLikes { get; set; }
    public DbSet<MealPlan> MealPlans { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure User entity
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Configure Group entity
        modelBuilder.Entity<Group>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasOne(e => e.Owner)
                  .WithMany()
                  .HasForeignKey(e => e.OwnerId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure GroupMember join table
        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasKey(e => new { e.GroupId, e.UserId });
            entity.HasOne(e => e.Group)
                  .WithMany(g => g.Members)
                  .HasForeignKey(e => e.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure RecipeGroup join table
        modelBuilder.Entity<RecipeGroup>(entity =>
        {
            entity.HasKey(e => new { e.RecipeId, e.GroupId });
            entity.HasOne(e => e.Recipe)
                  .WithMany(r => r.Groups)
                  .HasForeignKey(e => e.RecipeId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Group)
                  .WithMany()
                  .HasForeignKey(e => e.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure RecipeLike join table
        modelBuilder.Entity<RecipeLike>(entity =>
        {
            entity.HasKey(e => new { e.RecipeId, e.UserEmail });
            entity.Property(e => e.UserEmail).IsRequired().HasMaxLength(200);
            entity.Property(e => e.LikedAt).IsRequired();
            entity.HasOne(e => e.Recipe)
                  .WithMany()
                  .HasForeignKey(e => e.RecipeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure Category entity
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Group).HasMaxLength(50);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // Configure many-to-many Recipe <-> Category
        modelBuilder.Entity<Recipe>()
            .HasMany(r => r.Categories)
            .WithMany(c => c.Recipes)
            .UsingEntity(j => j.ToTable("RecipeCategory"));

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
            entity.Property(e => e.Visibility).IsRequired().HasMaxLength(20).HasDefaultValue("Public");
            entity.Property(e => e.OwnerEmail).HasMaxLength(200);

            entity.Property(e => e.Ingredients)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrWhiteSpace(v) ? new() : JsonSerializer.Deserialize<List<StructuredIngredient>>(v, (JsonSerializerOptions?)null) ?? new())
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(new ValueComparer<List<StructuredIngredient>>(
                    (c1, c2) => JsonSerializer.Serialize(c1, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(c2, (JsonSerializerOptions?)null),
                    c => c == null ? 0 : JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                    c => JsonSerializer.Deserialize<List<StructuredIngredient>>(JsonSerializer.Serialize(c, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));

            entity.Property(e => e.InstructionSteps)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrWhiteSpace(v) ? new() : JsonSerializer.Deserialize<List<InstructionStep>>(v, (JsonSerializerOptions?)null) ?? new())
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(new ValueComparer<List<InstructionStep>>(
                    (c1, c2) => JsonSerializer.Serialize(c1, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(c2, (JsonSerializerOptions?)null),
                    c => c == null ? 0 : JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                    c => JsonSerializer.Deserialize<List<InstructionStep>>(JsonSerializer.Serialize(c, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));

            entity.Property(e => e.IngredientSections)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrWhiteSpace(v) ? new() : JsonSerializer.Deserialize<List<IngredientSection>>(v, (JsonSerializerOptions?)null) ?? new())
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(new ValueComparer<List<IngredientSection>>(
                    (c1, c2) => JsonSerializer.Serialize(c1, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(c2, (JsonSerializerOptions?)null),
                    c => c == null ? 0 : JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                    c => JsonSerializer.Deserialize<List<IngredientSection>>(JsonSerializer.Serialize(c, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));

            entity.Property(e => e.InstructionSections)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrWhiteSpace(v) ? new() : JsonSerializer.Deserialize<List<InstructionSection>>(v, (JsonSerializerOptions?)null) ?? new())
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(new ValueComparer<List<InstructionSection>>(
                    (c1, c2) => JsonSerializer.Serialize(c1, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(c2, (JsonSerializerOptions?)null),
                    c => c == null ? 0 : JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                    c => JsonSerializer.Deserialize<List<InstructionSection>>(JsonSerializer.Serialize(c, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));

            entity.Property(e => e.Tips)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => string.IsNullOrWhiteSpace(v) ? new() : JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new())
                .HasColumnType("nvarchar(max)")
                .Metadata.SetValueComparer(new ValueComparer<List<string>>(
                    (c1, c2) => JsonSerializer.Serialize(c1, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(c2, (JsonSerializerOptions?)null),
                    c => c == null ? 0 : JsonSerializer.Serialize(c, (JsonSerializerOptions?)null).GetHashCode(),
                    c => JsonSerializer.Deserialize<List<string>>(JsonSerializer.Serialize(c, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!));
        });

        // Configure MealPlan entity
        modelBuilder.Entity<MealPlan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.Date).IsRequired().HasColumnType("date");
            entity.Property(e => e.CreatedByEmail).HasMaxLength(200);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            entity.HasIndex(e => new { e.GroupId, e.Date }).IsUnique();
            entity.HasOne(e => e.Group)
                  .WithMany()
                  .HasForeignKey(e => e.GroupId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Recipe)
                  .WithMany()
                  .HasForeignKey(e => e.RecipeId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Seed initial data
        var seedDate = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        
        // Seed categories
        modelBuilder.Entity<Category>().HasData(
            // Måltidstype
            new Category { Id = 1, Name = "Frokost", Group = "Måltidstype" },
            new Category { Id = 2, Name = "Lunsj", Group = "Måltidstype" },
            new Category { Id = 3, Name = "Middag", Group = "Måltidstype" },
            new Category { Id = 4, Name = "Dessert", Group = "Måltidstype" },
            new Category { Id = 5, Name = "Kveldsmat", Group = "Måltidstype" },
            new Category { Id = 6, Name = "Søtbakst", Group = "Måltidstype" },
            new Category { Id = 7, Name = "Snacks", Group = "Måltidstype" },
            new Category { Id = 8, Name = "Drikke", Group = "Måltidstype" },
            // Vanskelighetsgrad
            new Category { Id = 9, Name = "Enkel", Group = "Vanskelighetsgrad" },
            new Category { Id = 10, Name = "Middels", Group = "Vanskelighetsgrad" },
            new Category { Id = 11, Name = "Avansert", Group = "Vanskelighetsgrad" },
            // Tilberedningstid
            new Category { Id = 12, Name = "Under 15 min", Group = "Tilberedningstid" },
            new Category { Id = 13, Name = "Under 30 min", Group = "Tilberedningstid" },
            new Category { Id = 14, Name = "Under 1 time", Group = "Tilberedningstid" },
            new Category { Id = 15, Name = "Over 1 time", Group = "Tilberedningstid" }
        );

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
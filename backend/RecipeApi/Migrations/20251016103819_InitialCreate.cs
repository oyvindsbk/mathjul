using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Recipes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Ingredients = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Instructions = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PrepTime = table.Column<int>(type: "int", nullable: true),
                    CookTime = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CookTimeMinutes = table.Column<int>(type: "int", nullable: true),
                    Servings = table.Column<int>(type: "int", nullable: true),
                    Difficulty = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recipes", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Recipes",
                columns: new[] { "Id", "CookTime", "CookTimeMinutes", "CreatedAt", "Description", "Difficulty", "ImageUrl", "Ingredients", "Instructions", "PrepTime", "Servings", "Title", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "20 minutes", null, new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(8520), "A traditional Italian pasta dish with eggs, cheese, and pancetta", "Medium", "/api/placeholder/300/200", "", "", null, null, "Classic Spaghetti Carbonara", new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(8680) },
                    { 2, "45 minutes", null, new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(9090), "Creamy and flavorful Indian curry with tender chicken pieces", "Medium", "/api/placeholder/300/200", "", "", null, null, "Chicken Tikka Masala", new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(9090) },
                    { 3, "25 minutes", null, new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(9090), "Soft and chewy homemade cookies with chocolate chips", "Easy", "/api/placeholder/300/200", "", "", null, null, "Chocolate Chip Cookies", new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(9090) },
                    { 4, "15 minutes", null, new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(9100), "Fresh romaine lettuce with homemade caesar dressing and croutons", "Easy", "/api/placeholder/300/200", "", "", null, null, "Caesar Salad", new DateTime(2025, 10, 16, 10, 38, 19, 247, DateTimeKind.Utc).AddTicks(9100) }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Recipes");
        }
    }
}

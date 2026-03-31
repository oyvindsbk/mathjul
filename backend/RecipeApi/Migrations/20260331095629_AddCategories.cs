using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Group = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecipeCategory",
                columns: table => new
                {
                    CategoriesId = table.Column<int>(type: "int", nullable: false),
                    RecipesId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeCategory", x => new { x.CategoriesId, x.RecipesId });
                    table.ForeignKey(
                        name: "FK_RecipeCategory_Categories_CategoriesId",
                        column: x => x.CategoriesId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeCategory_Recipes_RecipesId",
                        column: x => x.RecipesId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "Group", "Name" },
                values: new object[,]
                {
                    { 1, "Måltidstype", "Frokost" },
                    { 2, "Måltidstype", "Lunsj" },
                    { 3, "Måltidstype", "Middag" },
                    { 4, "Måltidstype", "Dessert" },
                    { 5, "Måltidstype", "Kveldsmat" },
                    { 6, "Måltidstype", "Søtbakst" },
                    { 7, "Måltidstype", "Snacks" },
                    { 8, "Måltidstype", "Drikke" },
                    { 9, "Vanskelighetsgrad", "Enkel" },
                    { 10, "Vanskelighetsgrad", "Middels" },
                    { 11, "Vanskelighetsgrad", "Avansert" },
                    { 12, "Tilberedningstid", "Under 15 min" },
                    { 13, "Tilberedningstid", "Under 30 min" },
                    { 14, "Tilberedningstid", "Under 1 time" },
                    { 15, "Tilberedningstid", "Over 1 time" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name",
                table: "Categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RecipeCategory_RecipesId",
                table: "RecipeCategory",
                column: "RecipesId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecipeCategory");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}

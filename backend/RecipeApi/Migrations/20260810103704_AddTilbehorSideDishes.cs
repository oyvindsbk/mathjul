using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTilbehorSideDishes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RecipeSideDishes",
                columns: table => new
                {
                    RecipeId = table.Column<int>(type: "int", nullable: false),
                    SideDishRecipeId = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecipeSideDishes", x => new { x.RecipeId, x.SideDishRecipeId });
                    table.ForeignKey(
                        name: "FK_RecipeSideDishes_Recipes_RecipeId",
                        column: x => x.RecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecipeSideDishes_Recipes_SideDishRecipeId",
                        column: x => x.SideDishRecipeId,
                        principalTable: "Recipes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "Group", "Name" },
                values: new object[] { 16, "Måltidstype", "Tilbehør" });

            migrationBuilder.CreateIndex(
                name: "IX_RecipeSideDishes_RecipeId_SortOrder",
                table: "RecipeSideDishes",
                columns: new[] { "RecipeId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_RecipeSideDishes_SideDishRecipeId",
                table: "RecipeSideDishes",
                column: "SideDishRecipeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecipeSideDishes");

            migrationBuilder.DeleteData(
                table: "Categories",
                keyColumn: "Id",
                keyValue: 16);
        }
    }
}

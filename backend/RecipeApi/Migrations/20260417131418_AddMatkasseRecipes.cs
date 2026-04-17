using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddMatkasseRecipes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MealPlans_Recipes_RecipeId",
                table: "MealPlans");

            migrationBuilder.AlterColumn<int>(
                name: "RecipeId",
                table: "MealPlans",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "MatkasseRecipeId",
                table: "MealPlans",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "MatkasseRecipes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupId = table.Column<int>(type: "int", nullable: false),
                    Leverandor = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    UkeStart = table.Column<DateOnly>(type: "date", nullable: false),
                    Tittel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Beskrivelse = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedByEmail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatkasseRecipes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatkasseRecipes_Groups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MealPlans_MatkasseRecipeId",
                table: "MealPlans",
                column: "MatkasseRecipeId");

            migrationBuilder.CreateIndex(
                name: "IX_MatkasseRecipes_GroupId_UkeStart",
                table: "MatkasseRecipes",
                columns: new[] { "GroupId", "UkeStart" });

            migrationBuilder.AddForeignKey(
                name: "FK_MealPlans_MatkasseRecipes_MatkasseRecipeId",
                table: "MealPlans",
                column: "MatkasseRecipeId",
                principalTable: "MatkasseRecipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_MealPlans_Recipes_RecipeId",
                table: "MealPlans",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MealPlans_MatkasseRecipes_MatkasseRecipeId",
                table: "MealPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_MealPlans_Recipes_RecipeId",
                table: "MealPlans");

            migrationBuilder.DropTable(
                name: "MatkasseRecipes");

            migrationBuilder.DropIndex(
                name: "IX_MealPlans_MatkasseRecipeId",
                table: "MealPlans");

            migrationBuilder.DropColumn(
                name: "MatkasseRecipeId",
                table: "MealPlans");

            migrationBuilder.AlterColumn<int>(
                name: "RecipeId",
                table: "MealPlans",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_MealPlans_Recipes_RecipeId",
                table: "MealPlans",
                column: "RecipeId",
                principalTable: "Recipes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

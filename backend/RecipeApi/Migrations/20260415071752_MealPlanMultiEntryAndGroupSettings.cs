using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class MealPlanMultiEntryAndGroupSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MealPlans_GroupId_Date",
                table: "MealPlans");

            migrationBuilder.AddColumn<bool>(
                name: "MealPlanEnabled",
                table: "Groups",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_MealPlans_GroupId_Date",
                table: "MealPlans",
                columns: new[] { "GroupId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MealPlans_GroupId_Date",
                table: "MealPlans");

            migrationBuilder.DropColumn(
                name: "MealPlanEnabled",
                table: "Groups");

            migrationBuilder.CreateIndex(
                name: "IX_MealPlans_GroupId_Date",
                table: "MealPlans",
                columns: new[] { "GroupId", "Date" },
                unique: true);
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class RenameDefaultColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "FeatureColumns",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "New");

            migrationBuilder.UpdateData(
                table: "FeatureColumns",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Planned");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "FeatureColumns",
                keyColumn: "Id",
                keyValue: 1,
                column: "Name",
                value: "New Feature");

            migrationBuilder.UpdateData(
                table: "FeatureColumns",
                keyColumn: "Id",
                keyValue: 2,
                column: "Name",
                value: "Planned Feature");
        }
    }
}

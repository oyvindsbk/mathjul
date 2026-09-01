using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddCakePanFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PanDiameter",
                table: "Recipes",
                type: "decimal(5,1)",
                precision: 5,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PanHeight",
                table: "Recipes",
                type: "decimal(5,1)",
                precision: 5,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PanLength",
                table: "Recipes",
                type: "decimal(5,1)",
                precision: 5,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PanShape",
                table: "Recipes",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PanWidth",
                table: "Recipes",
                type: "decimal(5,1)",
                precision: 5,
                scale: 1,
                nullable: true);

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "Group", "Name" },
                values: new object[] { 17, "Måltidstype", "Kake" });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "PanDiameter", "PanHeight", "PanLength", "PanShape", "PanWidth" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "PanDiameter", "PanHeight", "PanLength", "PanShape", "PanWidth" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "PanDiameter", "PanHeight", "PanLength", "PanShape", "PanWidth" },
                values: new object[] { null, null, null, null, null });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "PanDiameter", "PanHeight", "PanLength", "PanShape", "PanWidth" },
                values: new object[] { null, null, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Categories",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.DropColumn(
                name: "PanDiameter",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "PanHeight",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "PanLength",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "PanShape",
                table: "Recipes");

            migrationBuilder.DropColumn(
                name: "PanWidth",
                table: "Recipes");
        }
    }
}

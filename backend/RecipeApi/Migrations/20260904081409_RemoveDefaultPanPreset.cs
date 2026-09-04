using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDefaultPanPreset : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A recipe's own tin is now the only default a reader can be shown,
            // so a separately configured default has nowhere left to apply. Any
            // stored value is dropped rather than migrated: falling back to the
            // source tin was already the behaviour for every recipe that never
            // set one.
            migrationBuilder.DropColumn(
                name: "DefaultPanPresetId",
                table: "Recipes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restores the column, but not the values it held — those are gone
            // with Up, and nothing records which recipes had one.
            migrationBuilder.AddColumn<string>(
                name: "DefaultPanPresetId",
                table: "Recipes",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 1,
                column: "DefaultPanPresetId",
                value: null);

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 2,
                column: "DefaultPanPresetId",
                value: null);

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 3,
                column: "DefaultPanPresetId",
                value: null);

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 4,
                column: "DefaultPanPresetId",
                value: null);
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSpringformShape : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // "springform" is gone as a distinct PanShape — a springform and a
            // round tin of the same diameter share a volume, so any existing
            // springform recipe becomes "rund" rather than losing its shape.
            migrationBuilder.Sql("UPDATE Recipes SET PanShape = 'rund' WHERE PanShape = 'springform';");

            // The two springform presets no longer exist in PAN_PRESETS, so
            // scrub them out of any stored subset/default rather than leaving
            // a dangling id the frontend can never resolve.
            migrationBuilder.Sql(
                "UPDATE Recipes SET AvailablePanPresetIds = REPLACE(REPLACE(AvailablePanPresetIds, '\"springform-24\",', ''), '\"springform-26\",', '') " +
                "WHERE AvailablePanPresetIds LIKE '%springform-24%' OR AvailablePanPresetIds LIKE '%springform-26%';");
            migrationBuilder.Sql(
                "UPDATE Recipes SET AvailablePanPresetIds = REPLACE(REPLACE(AvailablePanPresetIds, ',\"springform-24\"', ''), ',\"springform-26\"', '') " +
                "WHERE AvailablePanPresetIds LIKE '%springform-24%' OR AvailablePanPresetIds LIKE '%springform-26%';");
            migrationBuilder.Sql(
                "UPDATE Recipes SET AvailablePanPresetIds = REPLACE(REPLACE(AvailablePanPresetIds, '[\"springform-24\"]', '[]'), '[\"springform-26\"]', '[]') " +
                "WHERE AvailablePanPresetIds LIKE '%springform-24%' OR AvailablePanPresetIds LIKE '%springform-26%';");
            migrationBuilder.Sql(
                "UPDATE Recipes SET DefaultPanPresetId = NULL WHERE DefaultPanPresetId IN ('springform-24', 'springform-26');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data loss is intentional and one-directional: there is no way to
            // know which "rund" recipes were originally springform.
        }
    }
}

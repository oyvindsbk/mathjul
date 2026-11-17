using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <summary>
    /// Replaces the single <c>SourceImageUrl</c> with a JSON list <c>SourceImageUrls</c>,
    /// carrying any existing URL over as a one-element list.
    /// </summary>
    public partial class AddSourceImageUrls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Default '[]' fills every existing row (seed rows included) with an empty list.
            migrationBuilder.AddColumn<string>(
                name: "SourceImageUrls",
                table: "Recipes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.Sql(
                """
                UPDATE Recipes
                SET SourceImageUrls = N'["' + STRING_ESCAPE(SourceImageUrl, 'json') + N'"]'
                WHERE SourceImageUrl IS NOT NULL AND SourceImageUrl <> N'';
                """);

            migrationBuilder.DropColumn(
                name: "SourceImageUrl",
                table: "Recipes");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourceImageUrl",
                table: "Recipes",
                type: "nvarchar(max)",
                nullable: true);

            // Only the first URL survives a rollback; the old column held one.
            migrationBuilder.Sql(
                """
                UPDATE Recipes
                SET SourceImageUrl = JSON_VALUE(SourceImageUrls, '$[0]')
                WHERE ISJSON(SourceImageUrls) = 1;
                """);

            migrationBuilder.DropColumn(
                name: "SourceImageUrls",
                table: "Recipes");
        }
    }
}

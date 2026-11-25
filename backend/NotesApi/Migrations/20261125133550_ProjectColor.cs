using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotesApi.Migrations
{
    /// <inheritdoc />
    public partial class ProjectColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                schema: "notes",
                table: "Projects",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            // Give existing projects palette colors in their current order (same list as ProjectColors.All).
            migrationBuilder.Sql("""
                WITH ordered AS (
                    SELECT Color, ROW_NUMBER() OVER (ORDER BY SortOrder, Id) - 1 AS n FROM notes.Projects
                )
                UPDATE ordered SET Color = CHOOSE(CAST(n % 10 AS int) + 1,
                    'blue', 'yellow', 'green', 'red', 'purple', 'cyan', 'orange', 'magenta', 'teal', 'gray');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                schema: "notes",
                table: "Projects");
        }
    }
}

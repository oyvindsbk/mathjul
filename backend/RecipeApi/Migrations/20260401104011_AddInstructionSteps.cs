using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddInstructionSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Instructions",
                table: "Recipes",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "InstructionSteps",
                table: "Recipes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            // Migrate existing Instructions string data to InstructionSteps JSON for non-seed recipes
            // Splits on newline, wraps each non-empty line as {"Text":"...","ImageUrl":null}
            migrationBuilder.Sql("""
                UPDATE r
                SET r.InstructionSteps = CONCAT('[', steps.json, ']')
                FROM Recipes r
                CROSS APPLY (
                    SELECT STRING_AGG(
                        CONCAT('{"Text":"', REPLACE(REPLACE(LTRIM(RTRIM(s.value)), '\', '\\'), '"', '\"'), '","ImageUrl":null}'),
                        ','
                    ) AS json
                    FROM STRING_SPLIT(r.Instructions, CHAR(10)) s
                    WHERE LTRIM(RTRIM(s.value)) <> ''
                ) steps
                WHERE r.Instructions IS NOT NULL
                  AND LTRIM(RTRIM(r.Instructions)) <> ''
                  AND r.Id NOT IN (1, 2, 3, 4);
                """);

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "InstructionSteps", "Instructions" },
                values: new object[] { "[]", null });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "InstructionSteps", "Instructions" },
                values: new object[] { "[]", null });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "InstructionSteps", "Instructions" },
                values: new object[] { "[]", null });

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "InstructionSteps", "Instructions" },
                values: new object[] { "[]", null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InstructionSteps",
                table: "Recipes");

            migrationBuilder.AlterColumn<string>(
                name: "Instructions",
                table: "Recipes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Instructions",
                value: "");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Instructions",
                value: "");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Instructions",
                value: "");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Instructions",
                value: "");
        }
    }
}

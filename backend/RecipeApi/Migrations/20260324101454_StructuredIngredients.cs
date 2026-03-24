using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class StructuredIngredients : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Ingredients",
                value: "[]");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Ingredients",
                value: "[]");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Ingredients",
                value: "[]");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Ingredients",
                value: "[]");

            // Convert any non-seed legacy recipes with empty or newline-separated ingredients to JSON
            migrationBuilder.Sql("""
                UPDATE Recipes
                SET Ingredients = '[]'
                WHERE Id NOT IN (1, 2, 3, 4)
                  AND (Ingredients = '' OR Ingredients IS NULL OR LEFT(Ingredients, 1) != '[')
                  AND CHARINDEX(CHAR(10), Ingredients) = 0;

                -- For recipes with newline-separated ingredients, wrap each line as a structured object
                -- This handles legacy data like "2 cups flour\n1 tsp salt"
                UPDATE r
                SET r.Ingredients = (
                    SELECT '[' + STRING_AGG('{"quantity":null,"unit":null,"name":"' + STRING_ESCAPE(TRIM(value), 'json') + '"}', ',') + ']'
                    FROM STRING_SPLIT(r.Ingredients, CHAR(10))
                    WHERE TRIM(value) != ''
                )
                FROM Recipes r
                WHERE LEFT(r.Ingredients, 1) != '['
                  AND r.Ingredients != ''
                  AND r.Ingredients IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 1,
                column: "Ingredients",
                value: "");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 2,
                column: "Ingredients",
                value: "");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 3,
                column: "Ingredients",
                value: "");

            migrationBuilder.UpdateData(
                table: "Recipes",
                keyColumn: "Id",
                keyValue: 4,
                column: "Ingredients",
                value: "");
        }
    }
}

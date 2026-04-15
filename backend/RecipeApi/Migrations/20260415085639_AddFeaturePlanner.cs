using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RecipeApi.Migrations
{
    /// <inheritdoc />
    public partial class AddFeaturePlanner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FeatureColumns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureColumns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeatureCards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ColumnId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Motivation = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Requirements = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    OutOfScope = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OpenQuestions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StacksFrontend = table.Column<bool>(type: "bit", nullable: false),
                    StacksBackend = table.Column<bool>(type: "bit", nullable: false),
                    StacksInfrastructure = table.Column<bool>(type: "bit", nullable: false),
                    DataModel = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ApiSketch = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UiSketch = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureCards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeatureCards_FeatureColumns_ColumnId",
                        column: x => x.ColumnId,
                        principalTable: "FeatureColumns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "FeatureColumns",
                columns: new[] { "Id", "Name", "SortOrder" },
                values: new object[,]
                {
                    { 1, "New Feature", 0 },
                    { 2, "Planned Feature", 1 },
                    { 3, "In Progress", 2 },
                    { 4, "Done", 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeatureCards_ColumnId",
                table: "FeatureCards",
                column: "ColumnId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeatureCards");

            migrationBuilder.DropTable(
                name: "FeatureColumns");
        }
    }
}

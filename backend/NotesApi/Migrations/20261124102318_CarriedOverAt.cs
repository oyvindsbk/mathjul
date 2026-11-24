using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotesApi.Migrations
{
    /// <inheritdoc />
    public partial class CarriedOverAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CarriedOverAt",
                schema: "notes",
                table: "Days",
                type: "datetime2",
                nullable: true);

            // Days created before this column were carried into on creation.
            migrationBuilder.Sql("UPDATE [notes].[Days] SET [CarriedOverAt] = [CreatedAt]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CarriedOverAt",
                schema: "notes",
                table: "Days");
        }
    }
}

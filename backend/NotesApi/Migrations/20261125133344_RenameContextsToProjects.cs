using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NotesApi.Migrations
{
    /// <summary>
    /// "Kontekster" became "prosjekter". Renames only, so every item keeps its group.
    /// (EF scaffolds this as drop + create, which would delete the projects.)
    /// </summary>
    public partial class RenameContextsToProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Items_Contexts_ContextId", schema: "notes", table: "Items");

            migrationBuilder.RenameTable(name: "Contexts", schema: "notes", newName: "Projects", newSchema: "notes");
            migrationBuilder.Sql("EXEC sp_rename N'notes.PK_Contexts', N'PK_Projects', N'OBJECT';");
            migrationBuilder.RenameIndex(name: "IX_Contexts_Name", schema: "notes", table: "Projects", newName: "IX_Projects_Name");

            migrationBuilder.RenameColumn(name: "ContextId", schema: "notes", table: "Items", newName: "ProjectId");
            migrationBuilder.RenameIndex(
                name: "IX_Items_DayId_ContextId_SortOrder", schema: "notes", table: "Items", newName: "IX_Items_DayId_ProjectId_SortOrder");
            migrationBuilder.RenameIndex(name: "IX_Items_ContextId", schema: "notes", table: "Items", newName: "IX_Items_ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_Items_Projects_ProjectId",
                schema: "notes",
                table: "Items",
                column: "ProjectId",
                principalSchema: "notes",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Items_Projects_ProjectId", schema: "notes", table: "Items");

            migrationBuilder.RenameIndex(name: "IX_Items_ProjectId", schema: "notes", table: "Items", newName: "IX_Items_ContextId");
            migrationBuilder.RenameIndex(
                name: "IX_Items_DayId_ProjectId_SortOrder", schema: "notes", table: "Items", newName: "IX_Items_DayId_ContextId_SortOrder");
            migrationBuilder.RenameColumn(name: "ProjectId", schema: "notes", table: "Items", newName: "ContextId");

            migrationBuilder.RenameIndex(name: "IX_Projects_Name", schema: "notes", table: "Projects", newName: "IX_Contexts_Name");
            migrationBuilder.Sql("EXEC sp_rename N'notes.PK_Projects', N'PK_Contexts', N'OBJECT';");
            migrationBuilder.RenameTable(name: "Projects", schema: "notes", newName: "Contexts", newSchema: "notes");

            migrationBuilder.AddForeignKey(
                name: "FK_Items_Contexts_ContextId",
                schema: "notes",
                table: "Items",
                column: "ContextId",
                principalSchema: "notes",
                principalTable: "Contexts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}

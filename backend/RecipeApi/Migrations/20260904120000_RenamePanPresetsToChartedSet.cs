using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RecipeApi.Migrations
{
    /// <summary>
    /// Realigns stored pan preset ids with the charted preset set.
    ///
    /// PAN_PRESETS was cut back to the tins the published Idun conversion charts
    /// actually cover: a tin with no charted multiplier has no verified scaling
    /// factor. "langpanne-30x40" was also renamed "stor-langpanne-30x40" — the
    /// same physical tin (30×40, 3,5 cm), matching what the chart calls it.
    ///
    /// Recipes already carry these ids in AvailablePanPresetIds, so without this
    /// the API rejects saving any such recipe with "Ukjent formvariant".
    /// </summary>
    public partial class RenamePanPresetsToChartedSet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A rename, not a removal: same tin, charted name. Done first so the
            // filter below sees the new id and keeps it.
            migrationBuilder.Sql(
                "UPDATE Recipes SET AvailablePanPresetIds = " +
                "REPLACE(AvailablePanPresetIds, '\"langpanne-30x40\"', '\"stor-langpanne-30x40\"') " +
                "WHERE AvailablePanPresetIds LIKE '%\"langpanne-30x40\"%';");

            // Drop every id that no longer exists. Rebuilt through OPENJSON rather
            // than by REPLACE-ing each id out: string surgery on a JSON array has to
            // handle the leading-comma, trailing-comma and only-element cases
            // separately, and silently leaves malformed JSON when they overlap.
            // A recipe left with no ids gets '[]', which means "no restriction" —
            // every preset offered, the same as never having curated a subset.
            migrationBuilder.Sql(@"
                UPDATE r
                SET AvailablePanPresetIds = ISNULL(k.Kept, '[]')
                FROM Recipes AS r
                OUTER APPLY (
                    SELECT '[' + STRING_AGG('""' + j.value + '""', ',') + ']' AS Kept
                    FROM OPENJSON(r.AvailablePanPresetIds) AS j
                    WHERE j.value IN (
                        'rund-20', 'rund-23', 'rund-24', 'rund-26', 'rund-28', 'rund-30',
                        'liten-langpanne-20x30', 'stor-langpanne-30x40'
                    )
                ) AS k
                WHERE ISJSON(r.AvailablePanPresetIds) = 1
                  AND EXISTS (
                      SELECT 1 FROM OPENJSON(r.AvailablePanPresetIds) AS j2
                      WHERE j2.value NOT IN (
                          'rund-20', 'rund-23', 'rund-24', 'rund-26', 'rund-28', 'rund-30',
                          'liten-langpanne-20x30', 'stor-langpanne-30x40'
                      )
                  );");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The rename is reversible; the dropped ids are not — nothing records
            // which recipes once offered a tin that no chart covers.
            migrationBuilder.Sql(
                "UPDATE Recipes SET AvailablePanPresetIds = " +
                "REPLACE(AvailablePanPresetIds, '\"stor-langpanne-30x40\"', '\"langpanne-30x40\"') " +
                "WHERE AvailablePanPresetIds LIKE '%\"stor-langpanne-30x40\"%';");
        }
    }
}

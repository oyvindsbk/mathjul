# Research: OneNote export (Task 1)

Tool: `tools/onenote-export` (Rust, `onenote_parser` 2.1.0). It writes one JSON file per section to `tools/onenote-export/out/`, which is gitignored and private.

## Result

| | |
|---|---|
| Sections exported | 307 of 309 `.one` files |
| Failed | `2018/Uke 26.one` ("page space is missing") and `Fag/Azure faggruppe.one` (out of scope) |
| Pages in weekly sections (2017–2026) | 1,629 |
| Paragraphs | 52,909 |
| To-dos | 34,800 (10,259 ticked) |
| æøå | Correct in every year. There are no U+FFFD replacement characters |

The structure comes through intact:
- **Page boundaries and title.**
- **Paragraph order.**
- **Indentation**, through outline children.
- **To-do checkbox state**, from `ActionItemStatus.completed`.
- **Hyperlink targets.**

The 2025–2026 "8-bit text" seen in the raw string scan is handled by the parser.

## Page format (stable since 2017)

```
Start: 08:00
Slutt: 15:30
Møter                       ← meetings are to-do tagged: "[x] Standup (kl. 09:30)"
[table: one cell per context: Hobby | Jobb | Prosjekt B | …]
Dagens TODOs
[ ] …
Jobb:                   ← context heading, colon optional ("Oppgaver <prosjekt>:" in 2017–18)
[ ] …
    [ ] …                   ← indented child
```

## Findings that change the import (spec R12–R14 updated)

1. **Open to-dos in the past aren't really open.** OneNote carry-over was done by copying, so the old copy stays unticked: 24,500 historical to-dos are "open". The importer sets imported open to-dos to **Carried**, except on the **last imported day**, where they stay **Open** so R9 carries them into today.
2. **Dates come from the weekday name plus the section week, not just the title.** The section's `Uke N` equals the ISO week in 1,247 of 1,254 pages. Titles have typos ("Onsdag 4. juni" in week 27 = 4 July; "Fredag 29. februar" 2020 = the 28th), and some sections sit in the wrong year folder (`2018/Uke 47.json` holds November 2017). Resolution order:
   1. Title day, month and weekday all agree in a candidate year (the created year, folder year, or ±1), with ISO week = section week.
   2. Otherwise, the section week + weekday name (in the created or folder year). Record it as *corrected*.
   3. Otherwise, the title day/month in the candidate year whose weekday matches, within ±60 days of the created time.
   4. Otherwise, the page is undated.

   Month typos are matched fuzzily (`feburar` → februar), and a missing dot is accepted (`31 oktober`). Result: 1,256 dated, of which 8 were corrected.
3. **Undated pages with content (≈340) are meeting and topic notes inside a week** ("Notater møte med X", "1-1 med …", "Timeføring"). Skipping them would lose real notes. They are attached to the day of their created time if it falls in the section's week, otherwise to the Monday of that week. The page title becomes a note at indent 0, and its paragraphs are indented one level below it. The 31 empty pages are skipped.
4. **Duplicate dates (5)** come from sections copied into two year folders, plus one meeting page titled with a date ("Standup 13. desember"). These are **merged**: the second page's items are appended after a note line "— fra <section>/<page title>". Nothing is dropped.
5. **The context table** (one cell per context) is not content. It names the contexts in use, so the importer creates contexts from it, then maps headings ("Jobb:", "Oppgaver <prosjekt>:") to them, case-insensitive, with any trailing ':' and leading "Oppgaver " stripped. A heading only sets the context when it matches a known context name. Unmatched lines stay notes under the current context.
6. **"Møter" items are tagged to-dos.** They are imported as to-dos, which is faithful. There is no meeting entity (out of scope).
7. **Text cleanup in the exporter:**
   - OneNote's hyperlink field codes (`U+FDDF HYPERLINK "url"`) are stripped, leaving the display text. The URL goes in `links`.
   - Vertical tab (Shift+Enter) becomes `\n`.
8. **`2018/Uke 26` can't be parsed.** One week is lost unless it is opened in OneNote and re-saved. It's accepted as a known gap, and listed in the import report.

## Data-model impact
None beyond the spec: `State = Carried` and `Indent` cover findings 1 and 3. The import payload carries a resolved `date` per day, so all date logic stays in the local importer (Task 8), not the API.

## Privacy
The exports include 1-1 and feedback notes about colleagues. `out/` is gitignored, and the import only goes to the allowlisted API.

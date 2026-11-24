"""Maps onenote-export JSON to Notater days and posts them to the import endpoint.

Usage:
  python -I notes_import.py <export-dir> --dry-run
  python -I notes_import.py <export-dir> --url http://localhost:3100 --dev
  NOTES_TOKEN=<jwt> python -I notes_import.py <export-dir> --url https://<notes-web>

The rules (date resolution, carried to-dos, undated pages, duplicates, contexts) are in
specs/068-notater/research.md. Only the weekly sections (year folders) are imported.
Requests go through the frontend's /api/proxy with a Bearer token. The export and the
report hold private notes: keep them out of git.
"""

from __future__ import annotations

import argparse
import datetime as dt
import difflib
import http.cookiejar
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

MONTHS = "januar februar mars april mai juni juli august september oktober november desember".split()
WEEKDAYS = "mandag tirsdag onsdag torsdag fredag lørdag søndag".split()
TITLE = re.compile(r"^\s*(?:(\w+)\W+)?(\d{1,2})\.?\s*([A-Za-zæøåÆØÅ]+)", re.UNICODE)
WEEK = re.compile(r"Uke (\d+)")
MAX_INDENT = 6
BATCH_DAYS = 100
ARCHIVE_AFTER_DAYS = 90


@dataclass
class Line:
    kind: str  # Todo | Note
    text: str
    state: str  # Open | Done (Carried is decided at the end)
    indent: int
    context: str | None

    def payload(self) -> dict:
        return {"kind": self.kind, "text": self.text, "state": self.state,
                "indent": min(self.indent, MAX_INDENT), "context": self.context}


@dataclass
class ImportedDay:
    date: dt.date
    lines: list[Line] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)


@dataclass
class Report:
    corrected: list[str] = field(default_factory=list)
    undated_attached: list[str] = field(default_factory=list)
    merged: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def month_of(word: str) -> int | None:
    match = difflib.get_close_matches(word.lower(), MONTHS, n=1, cutoff=0.75)
    return MONTHS.index(match[0]) + 1 if match else None


def safe_date(year: int, month: int, day: int) -> dt.date | None:
    try:
        return dt.date(year, month, day)
    except ValueError:
        return None


def resolve_date(title: str, folder_year: int, week: int | None, created: dt.date) -> tuple[dt.date | None, bool]:
    """Returns (date, corrected). research.md §2: exact > section week + weekday > weekday only."""
    match = TITLE.match(title)
    if not match:
        return None, False
    weekday_word = (match.group(1) or "").lower()
    weekday = WEEKDAYS.index(weekday_word) if weekday_word in WEEKDAYS else None
    month = month_of(match.group(3))
    if month is None:
        return None, False
    day = int(match.group(2))
    years = list(dict.fromkeys([created.year, folder_year, folder_year - 1, folder_year + 1]))

    for year in years:
        candidate = safe_date(year, month, day)
        if candidate and (weekday is None or candidate.weekday() == weekday) \
                and (week is None or candidate.isocalendar()[1] == week):
            return candidate, False

    if weekday is not None and week is not None:
        for year in dict.fromkeys([created.year, folder_year]):
            try:
                candidate = dt.date.fromisocalendar(year, week, weekday + 1)
            except ValueError:
                continue
            if abs((candidate - created).days) <= 60:
                return candidate, True

    if weekday is not None:
        for year in years:
            candidate = safe_date(year, month, day)
            if candidate and candidate.weekday() == weekday and abs((candidate - created).days) <= 60:
                return candidate, True

    return None, False


def normalize_context(text: str) -> str:
    name = text.strip().rstrip(":").strip()
    if name.lower().startswith("oppgaver "):
        name = name[len("oppgaver "):].strip()
    return name


def key_of(name: str) -> str:
    """Matching key: "Team - Plattform" and "Team Plattform:" are the same context."""
    return re.sub(r"[^0-9a-zæøå]", "", name.lower())


def is_dagens_todos(text: str) -> bool:
    return text.strip().rstrip(":").strip().lower() == "dagens todos"


def page_lines(paragraphs: list[dict], known: dict[str, str]) -> list[Line]:
    """research.md §5: headings that name a known context set the context of the lines below."""
    lines: list[Line] = []
    context: str | None = None
    for p in paragraphs:
        if p["in_table"]:
            continue
        text = p["text"].strip()
        todo = p.get("todo")
        if not todo and p["indent"] == 0:
            if is_dagens_todos(text):
                context = None
                continue
            candidate = normalize_context(text)
            # A known context name, or a 2017-18 style "Oppgaver <prosjekt>:" heading.
            is_section_heading = text.lower().startswith("oppgaver ") and text.endswith(":")
            if candidate and len(candidate) <= 60 and (key_of(candidate) in known or is_section_heading):
                context = known.setdefault(key_of(candidate), candidate)
                continue
        lines.append(Line(
            kind="Todo" if todo else "Note",
            text=text,
            state="Done" if todo and todo["completed"] else "Open",
            indent=p["indent"],
            context=context,
        ))
    return lines


def load_sections(export_dir: Path) -> list[tuple[Path, dict]]:
    sections = []
    for path in sorted(export_dir.glob("*/*.json")):
        if re.fullmatch(r"\d{4}", path.parent.name):
            sections.append((path, json.loads(path.read_text(encoding="utf-8"))))
    return sections


def build(export_dir: Path) -> tuple[list[ImportedDay], list[str], Report]:
    report = Report()
    sections = load_sections(export_dir)

    # Context candidates: names in the daily context table. Other tables (data, priorities)
    # also exist, so a name counts only if it recurs on at least 3 pages, like the roster does.
    pages_with: dict[str, set[int]] = {}
    spelling: dict[str, str] = {}
    for _, section in sections:
        for page in section["pages"]:
            for p in page["paragraphs"]:
                name = normalize_context(p["text"]) if p["in_table"] else ""
                if 0 < len(name) <= 40 and re.match(r"[A-Za-zÆØÅæøå]", name) and not re.match(r"(?i)(start|slutt)\b", name):
                    pages_with.setdefault(key_of(name), set()).add(id(page))
                    spelling[key_of(name)] = name
    known: dict[str, str] = {k: spelling[k] for k, pages in pages_with.items() if len(pages) >= 3}
    known.pop("dagenstodos", None)
    last_seen: dict[str, dt.date] = {}

    days: dict[dt.date, ImportedDay] = {}
    undated: list[tuple[str, dict, int, int | None]] = []

    for path, section in sections:
        folder_year = int(path.parent.name)
        week_match = WEEK.search(path.stem)
        week = int(week_match.group(1)) if week_match else None
        label = f"{path.parent.name}/{path.stem}"
        for page in section["pages"]:
            title = (page["title"] or "").strip()
            if not page["paragraphs"]:
                report.skipped.append(f"{label} / {title or '(uten tittel)'}: tom side")
                continue
            created = dt.date.fromisoformat(page["created"][:10])
            date, corrected = resolve_date(title, folder_year, week, created)
            if date is None:
                undated.append((label, page, folder_year, week))
                continue
            if corrected:
                report.corrected.append(f"{label} / {title} -> {date}")
            lines = page_lines(page["paragraphs"], known)
            for line in lines:
                if line.context:
                    last_seen[key_of(line.context)] = max(last_seen.get(key_of(line.context), date), date)
            day = days.get(date)
            if day is None:
                days[date] = ImportedDay(date, lines, [f"{label} / {title}"])
            else:
                report.merged.append(f"{date}: {label} / {title}")
                day.lines.append(Line("Note", f"— fra {label} / {title}", "Open", 0, None))
                day.lines.extend(lines)
                day.sources.append(f"{label} / {title}")

    # research.md §3: undated pages hang off a day in their week, under their title.
    for label, page, folder_year, week in undated:
        created = dt.date.fromisoformat(page["created"][:10])
        target = created
        if week is not None:
            try:
                monday = dt.date.fromisocalendar(folder_year, week, 1)
                if not (monday <= created <= monday + dt.timedelta(days=6)):
                    target = monday
            except ValueError:
                pass
        title = (page["title"] or "Notat").strip()
        day = days.setdefault(target, ImportedDay(target))
        day.lines.append(Line("Note", title, "Open", 0, None))
        for p in page["paragraphs"]:
            if p["in_table"]:
                continue
            todo = p.get("todo")
            day.lines.append(Line("Todo" if todo else "Note", p["text"].strip(),
                                  "Done" if todo and todo["completed"] else "Open", p["indent"] + 1, None))
        day.sources.append(f"{label} / {title}")
        report.undated_attached.append(f"{label} / {title} -> {target}")

    ordered = sorted(days.values(), key=lambda d: d.date)
    # research.md §1: unticked to-dos were carried by copying; only the last day's stay open.
    for day in ordered[:-1]:
        for line in day.lines:
            if line.kind == "Todo" and line.state == "Open":
                line.state = "Carried"

    # Only contexts that some line ended up under, most recently used first.
    contexts = sorted({known[k] for k in last_seen if k in known}, key=lambda n: last_seen[key_of(n)], reverse=True)
    return ordered, contexts, report


class Client:
    def __init__(self, base_url: str, token: str | None):
        self.base = base_url.rstrip("/")
        self.token = token

    def dev_login(self) -> None:
        jar = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        opener.open(urllib.request.Request(f"{self.base}/api/auth/dev-login", method="POST", data=b""))
        token = next((c.value for c in jar if c.name == "notes_token"), None)
        if not token:
            raise SystemExit("Dev login gave no notes_token cookie")
        self.token = token

    def call(self, method: str, path: str, body: object | None = None) -> object:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(f"{self.base}/api/proxy/{path}", data=data, method=method, headers={
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        })
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raise SystemExit(f"{method} {path} failed: {e.code} {e.read()[:500]!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export_dir", type=Path)
    parser.add_argument("--url", help="Notater frontend base URL")
    parser.add_argument("--dev", action="store_true", help="sign in with the local dev login")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    days, contexts, report = build(args.export_dir)
    lines = sum(len(d.lines) for d in days)
    todos = [l for d in days for l in d.lines if l.kind == "Todo"]
    print(f"{len(days)} days {days[0].date}..{days[-1].date}, {lines} lines, {len(todos)} to-dos "
          f"({sum(l.state == 'Done' for l in todos)} done, {sum(l.state == 'Carried' for l in todos)} carried, "
          f"{sum(l.state == 'Open' for l in todos)} open on {days[-1].date}), {len(contexts)} contexts")
    print(f"corrected dates: {len(report.corrected)}, undated pages attached: {len(report.undated_attached)}, "
          f"merged duplicates: {len(report.merged)}, skipped: {len(report.skipped)}")

    report_path = args.export_dir / "import-report.txt"
    with report_path.open("w", encoding="utf-8") as f:
        for title, entries in [("Corrected dates", report.corrected), ("Undated pages attached", report.undated_attached),
                               ("Merged duplicate dates", report.merged), ("Skipped", report.skipped)]:
            f.write(f"## {title} ({len(entries)})\n" + "".join(f"{e}\n" for e in entries) + "\n")
        f.write("## Not exported\nSee the exporter log: sections the parser could not read (e.g. 2018/Uke 26).\n")
    print(f"report: {report_path}")

    if args.dry_run:
        return
    if not args.url:
        raise SystemExit("--url is required unless --dry-run")

    client = Client(args.url, os.environ.get("NOTES_TOKEN"))
    if args.dev:
        client.dev_login()
    if not client.token:
        raise SystemExit("Set NOTES_TOKEN (the notes_token cookie) or use --dev locally")

    for start in range(0, len(days), BATCH_DAYS):
        batch = days[start:start + BATCH_DAYS]
        result = client.call("POST", "import/onenote", {
            "contexts": contexts if start == 0 else None,
            "days": [{"date": d.date.isoformat(), "items": [l.payload() for l in d.lines if l.text]} for d in batch],
        })
        print(f"  {batch[0].date}..{batch[-1].date}: {result}")

    # Contexts not used recently are archived so they don't crowd the day view.
    cutoff = days[-1].date - dt.timedelta(days=ARCHIVE_AFTER_DAYS)
    recent = {key_of(l.context) for d in days if d.date >= cutoff for l in d.lines if l.context}
    archived = 0
    for context in client.call("GET", "contexts"):  # type: ignore[union-attr]
        if key_of(context["name"]) not in recent and not context["isArchived"]:
            client.call("PATCH", f"contexts/{context['id']}", {"isArchived": True})
            archived += 1
    print(f"archived {archived} contexts not used since {cutoff}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

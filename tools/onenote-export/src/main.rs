//! Exports OneNote section files (`.one`) to JSON for the Notater import.
//!
//! Usage: `onenote-export <notebook-root> <out-dir> [relative/section.one ...]`
//!
//! With no section paths, every `.one` file under the root is exported. Each
//! section becomes `<out-dir>/<relative path>.json`. The output holds private
//! notes: keep `<out-dir>` out of git.

use std::fs;
use std::path::{Path, PathBuf};

use onenote_parser::Parser;
use onenote_parser::contents::{Content, OutlineElement, OutlineItem, RichText};
use onenote_parser::page::{Page, PageContent};
use serde::Serialize;
use typed_path::TypedPath;

#[derive(Serialize)]
struct SectionOut {
    file: String,
    section: String,
    pages: Vec<PageOut>,
}

#[derive(Serialize)]
struct PageOut {
    title: Option<String>,
    created: String,
    /// Subpage level: 0 for a top-level page.
    level: i32,
    paragraphs: Vec<ParagraphOut>,
}

#[derive(Serialize)]
struct ParagraphOut {
    /// Index of the outline (text box) on the page, in parser order.
    outline: usize,
    indent: usize,
    text: String,
    /// Set when the paragraph carries a checkable note tag (a OneNote to-do).
    todo: Option<TodoOut>,
    /// Labels of non-checkable note tags (e.g. "Important", "Question").
    tags: Vec<String>,
    links: Vec<String>,
    in_table: bool,
}

#[derive(Serialize)]
struct TodoOut {
    completed: bool,
    label: String,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("usage: onenote-export <notebook-root> <out-dir> [relative/section.one ...]");
        std::process::exit(2);
    }
    let root = PathBuf::from(&args[1]);
    let out_dir = PathBuf::from(&args[2]);

    let sections: Vec<PathBuf> = if args.len() > 3 {
        args[3..].iter().map(|p| root.join(p)).collect()
    } else {
        let mut found = Vec::new();
        collect_sections(&root, &mut found);
        found.sort();
        found
    };

    let parser = Parser::new();
    let (mut ok, mut failed) = (0, 0);
    for path in &sections {
        let rel = path.strip_prefix(&root).unwrap_or(path);
        match export_section(&parser, path, rel) {
            Ok(section) => {
                let target = out_dir.join(rel).with_extension("json");
                fs::create_dir_all(target.parent().unwrap()).expect("create out dir");
                let json = serde_json::to_string_pretty(&section).expect("serialize");
                fs::write(&target, json).expect("write json");
                println!("ok    {} ({} pages)", rel.display(), section.pages.len());
                ok += 1;
            }
            Err(e) => {
                println!("FAIL  {}: {e}", rel.display());
                failed += 1;
            }
        }
    }
    println!("\n{ok} exported, {failed} failed");
    if failed > 0 {
        std::process::exit(1);
    }
}

fn collect_sections(dir: &Path, found: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if path.file_name().is_some_and(|n| n == "OneNote_RecycleBin") {
                continue;
            }
            collect_sections(&path, found);
        } else if path.extension().is_some_and(|e| e.eq_ignore_ascii_case("one")) {
            found.push(path);
        }
    }
}

fn export_section(parser: &Parser, path: &Path, rel: &Path) -> Result<SectionOut, String> {
    let path_str = path.to_string_lossy();
    let section = parser
        .parse_section(TypedPath::derive(path_str.as_ref()))
        .map_err(|e| e.to_string())?;

    let pages = section
        .page_series()
        .iter()
        .flat_map(|series| series.pages())
        .map(export_page)
        .collect();

    Ok(SectionOut {
        file: rel.to_string_lossy().replace('\\', "/"),
        section: section.display_name().to_string(),
        pages,
    })
}

fn export_page(page: &Page) -> PageOut {
    let mut paragraphs = Vec::new();
    let outlines = page.contents().iter().filter_map(PageContent::outline);
    for (index, outline) in outlines.enumerate() {
        walk_items(outline.items(), index, 0, false, &mut paragraphs);
    }
    PageOut {
        title: page.title_text().map(str::to_string),
        created: page.created_time().to_string(),
        level: page.level(),
        paragraphs,
    }
}

fn walk_items(
    items: &[OutlineItem],
    outline: usize,
    indent: usize,
    in_table: bool,
    out: &mut Vec<ParagraphOut>,
) {
    for item in items {
        match item {
            OutlineItem::Element(element) => walk_element(element, outline, indent, in_table, out),
            OutlineItem::Group(group) => walk_items(group.outlines(), outline, indent, in_table, out),
        }
    }
}

fn walk_element(
    element: &OutlineElement,
    outline: usize,
    indent: usize,
    in_table: bool,
    out: &mut Vec<ParagraphOut>,
) {
    for content in element.contents() {
        match content {
            Content::RichText(text) => push_text(text, outline, indent, in_table, out),
            Content::Table(table) => {
                for row in table.contents() {
                    for cell in row.contents() {
                        for cell_element in cell.contents() {
                            walk_element(cell_element, outline, indent, true, out);
                        }
                    }
                }
            }
            // Images, files and ink are out of scope for the import.
            _ => {}
        }
    }
    walk_items(element.children(), outline, indent + 1, in_table, out);
}

fn push_text(
    text: &RichText,
    outline: usize,
    indent: usize,
    in_table: bool,
    out: &mut Vec<ParagraphOut>,
) {
    let cleaned = clean_text(text.text());
    let body = cleaned.trim();
    if body.is_empty() {
        return;
    }

    let mut todo = None;
    let mut tags = Vec::new();
    for tag in text.note_tags() {
        let label = tag.definition().map(|d| d.label().to_string()).unwrap_or_default();
        if tag.item_status().task_tag() || is_checkbox_label(&label) {
            todo = Some(TodoOut { completed: tag.item_status().completed(), label });
        } else if !label.is_empty() {
            tags.push(label);
        }
    }

    out.push(ParagraphOut {
        outline,
        indent,
        text: body.to_string(),
        todo,
        tags,
        links: text.hyperlinks().iter().map(|l| l.target().to_string()).collect(),
        in_table,
    });
}

/// Strips OneNote's hyperlink field codes (`U+FDDF HYPERLINK "url"`, leaving the
/// display text; the target is exported in `links`) and turns soft line breaks
/// (vertical tab, Shift+Enter) into newlines.
fn clean_text(raw: &str) -> String {
    const FIELD_START: &str = "\u{FDDF}HYPERLINK \"";
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(start) = rest.find(FIELD_START) {
        out.push_str(&rest[..start]);
        let after = &rest[start + FIELD_START.len()..];
        rest = match after.find('"') {
            Some(end) => &after[end + 1..],
            None => after,
        };
    }
    out.push_str(rest);
    out.replace('\u{FDDF}', "").replace('\u{000B}', "\n")
}

/// OneNote's built-in checkable tags, in English and Norwegian.
fn is_checkbox_label(label: &str) -> bool {
    let l = label.to_lowercase();
    l.contains("to do") || l.contains("gjøremål") || l.contains("oppgave")
}

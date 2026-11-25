'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { shortDay } from '@/lib/dates';
import type { Item, Project } from '@/lib/types';

export interface ItemHandlers {
  commit: (item: Item, text: string) => void;
  enter: (item: Item, text: string) => void;
  toggle: (item: Item) => void;
  indent: (item: Item, delta: number, text: string) => void;
  removeEmpty: (item: Item, refocus: boolean) => void;
  reorder: (item: Item, delta: number, text: string) => void;
  navigate: (item: Item, delta: number) => void;
  toggleKind: (item: Item) => void;
  moveToProject: (item: Item, projectId: number | null) => void;
  remove: (item: Item) => void;
}

interface Props {
  item: Item;
  projects: Project[];
  handlers: ItemHandlers;
}

/** One line of the day: checkbox or bullet, the text, and controls revealed on hover/focus. */
export function ItemRow({ item, projects, handlers: h }: Props) {
  const [draft, setDraft] = useState(item.text);
  // Server responses replace the item; keep the editor in step without remounting it.
  useEffect(() => setDraft(item.text), [item.text]);

  const carried = item.state === 'Carried';
  const done = item.state === 'Done';

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (item.kind === 'Todo' && !carried) h.toggle(item);
    } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (carried) h.navigate(item, 1);
      else if (draft.trim() === '' && item.indent > 0) h.indent(item, -1, draft);
      else if (draft.trim() !== '') h.enter(item, draft);
    } else if (e.key === 'Tab' && !carried) {
      e.preventDefault();
      h.indent(item, e.shiftKey ? -1 : 1, draft);
    } else if (e.key === 'Backspace' && draft === '' && !carried) {
      e.preventDefault();
      h.removeEmpty(item, true);
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (!carried) h.reorder(item, e.key === 'ArrowUp' ? -1 : 1, draft);
    } else if (e.key === 'ArrowUp' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault();
      h.navigate(item, -1);
    } else if (e.key === 'ArrowDown' && el.selectionStart === el.value.length) {
      e.preventDefault();
      h.navigate(item, 1);
    }
  }

  function onBlur() {
    if (carried) return;
    if (draft.trim() === '') h.removeEmpty(item, false);
    else h.commit(item, draft);
  }

  const projectChoices = projects.filter((c) => !c.isArchived || c.id === item.projectId);

  return (
    <div
      className="group flex items-start gap-2 rounded py-0.5 pr-1 hover:bg-accent-soft/40"
      style={{ paddingLeft: `${item.indent * 1.5}rem` }}
      data-testid="item-row"
      data-state={item.state}
      data-kind={item.kind}
    >
      {item.kind === 'Todo' ? (
        <input
          type="checkbox"
          className="mt-1.5 size-4 shrink-0 accent-accent"
          checked={done}
          disabled={carried}
          onChange={() => h.toggle(item)}
          aria-label={done ? 'Marker som ikke ferdig' : 'Marker som ferdig'}
          title={carried ? 'Flyttet til en senere dag' : undefined}
        />
      ) : (
        <span aria-hidden className="mt-0.5 w-4 shrink-0 text-center text-muted">
          •
        </span>
      )}

      <textarea
        data-item-id={item.id}
        rows={1}
        value={draft}
        readOnly={carried}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        aria-label={item.kind === 'Todo' ? 'Oppgave' : 'Notat'}
        className={`item-text min-w-0 flex-1 resize-none bg-transparent leading-6 outline-none ${
          done || carried ? 'text-done' : ''
        } ${done ? 'line-through' : ''}`}
      />

      {item.carriedFromDate && (
        <span className="mt-1 shrink-0 text-xs text-muted" title="Overført fra en tidligere dag">
          fra {shortDay(item.carriedFromDate)}
        </span>
      )}
      {carried && <span className="mt-1 shrink-0 text-xs text-muted">flyttet →</span>}

      {!carried && (
        <div className="mt-0.5 flex shrink-0 items-center gap-1 text-xs sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <button
            type="button"
            className="rounded px-1 text-muted hover:text-foreground"
            onClick={() => h.toggleKind(item)}
            title={item.kind === 'Todo' ? 'Gjør til notat' : 'Gjør til oppgave'}
          >
            {item.kind === 'Todo' ? '•' : '☐'}
          </button>
          <select
            className="max-w-28 rounded border border-border bg-surface px-1 py-0.5 text-muted"
            value={item.projectId ?? ''}
            onChange={(e) => h.moveToProject(item, e.target.value === '' ? null : Number(e.target.value))}
            aria-label="Prosjekt"
          >
            <option value="">Dagens TODOs</option>
            {projectChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded px-1 text-muted hover:text-foreground"
            onClick={() => h.remove(item)}
            title="Slett"
            aria-label="Slett"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

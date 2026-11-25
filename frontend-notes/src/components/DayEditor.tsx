'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { todayInOslo } from '@/lib/dates';
import { projectColorVar, type ProjectColor } from '@/lib/projectColors';
import { MAX_INDENT, type Day, type Item, type ItemKind, type Project } from '@/lib/types';
import { ItemRow, type ItemHandlers } from './ItemRow';

interface Props {
  date: string;
  projects: Project[];
  /** Called after anything changes, so a surrounding week view can refresh its counts. */
  onChanged?: () => void;
}

interface Group {
  id: number | null;
  name: string;
  archived: boolean;
  color: ProjectColor | null;
}

const NO_PROJECT = 'Dagens TODOs';

const message = (e: unknown) => (e instanceof Error ? e.message : 'Noe gikk galt');

let nextTempId = -1;

/**
 * Edits one day. Opening today runs carry-over on the server, so the first load of today
 * already contains yesterday's open to-dos.
 *
 * New lines are inserted optimistically with a negative temporary id and focused at once,
 * so typing straight after Enter never lands on the previous line. Their stable clientKey
 * keeps the same textarea mounted when the real id arrives.
 */
export function DayEditor({ date, projects, onChanged }: Props) {
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  /** Temporary id -> promise of the real id, for operations on a line still being created. */
  const pending = useRef(new Map<number, Promise<number>>());
  /** Saves still in flight; leaving the page now would drop them. */
  const [saving, setSaving] = useState(0);

  useEffect(() => {
    if (saving === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saving]);

  const load = useCallback(async () => {
    try {
      const fresh = await api.day(date);
      // Keep rows that are still being created, and every row's clientKey, so a reload neither
      // drops a line someone is typing into nor remounts (and blurs) the rows on screen.
      setDay((previous) => {
        if (!previous) return fresh;
        const keys = new Map(previous.items.map((i) => [i.id, i.clientKey]));
        return {
          ...fresh,
          items: [
            ...fresh.items.map((i) => ({ ...i, clientKey: keys.get(i.id) })),
            ...previous.items.filter((i) => i.id < 0),
          ],
        };
      });
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  // Focus a row once it has rendered (after add, delete or reorder).
  useEffect(() => {
    if (focusId === null) return;
    const el = container.current?.querySelector<HTMLTextAreaElement>(`textarea[data-item-id="${focusId}"]`);
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    setFocusId(null);
  }, [focusId, day]);

  const items = useMemo(() => day?.items ?? [], [day]);

  const groups: Group[] = useMemo(() => {
    const used = new Set(items.map((i) => i.projectId));
    // Past days show only the groups they used; today and later offer every active project.
    const planning = date >= todayInOslo();
    return [
      { id: null, name: NO_PROJECT, archived: false, color: null },
      ...projects
        .filter((c) => used.has(c.id) || (planning && !c.isArchived))
        .map((c) => ({
          id: c.id,
          name: c.isArchived ? `${c.name} (arkivert)` : c.name,
          archived: c.isArchived,
          color: c.color,
        })),
    ];
  }, [projects, items, date]);

  const inGroup = useCallback(
    (projectId: number | null) =>
      items.filter((i) => i.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  /** Replaces an item, keeping its clientKey so its row is not remounted. */
  const replace = (item: Item, previousId: number = item.id) =>
    setDay(
      (d) =>
        d && {
          ...d,
          items: d.items.map((i) => (i.id === previousId ? { ...item, clientKey: i.clientKey } : i)),
        }
    );

  const realId = async (id: number) => (id > 0 ? id : ((await pending.current.get(id)) ?? id));

  const run = useCallback(
    async (action: () => Promise<unknown>, reload: boolean) => {
      setSaving((n) => n + 1);
      try {
        await action();
        if (reload) await load();
        onChanged?.();
      } catch (e) {
        setError(message(e));
        await load();
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [load, onChanged]
  );

  const neighbourId = (item: Item, delta: number): number | null => {
    const rows = Array.from(
      container.current?.querySelectorAll<HTMLTextAreaElement>('textarea[data-item-id]') ?? []
    );
    const index = rows.findIndex((r) => r.dataset.itemId === String(item.id));
    const next = rows[index + delta];
    return next ? Number(next.dataset.itemId) : null;
  };

  /** Inserts a blank line right away, then creates it on the server and swaps in the real id. */
  const insertLine = (
    kind: ItemKind,
    projectId: number | null,
    indent: number,
    after: Item | null,
    beforeCreate?: () => Promise<unknown>
  ) => {
    const tempId = nextTempId--;
    const sortOrder = after ? after.sortOrder + 0.5 : Number.MAX_SAFE_INTEGER;
    const temp: Item = {
      id: tempId,
      clientKey: `new${tempId}`,
      kind,
      text: '',
      state: 'Open',
      indent,
      sortOrder,
      projectId,
      carriedFromDate: null,
      completedAt: null,
    };
    setDay((d) => d && { ...d, items: [...d.items, temp] });
    setFocusId(tempId);

    const creation = (async () => {
      await beforeCreate?.();
      const afterItemId = after ? await realId(after.id) : undefined;
      const created = await api.addItem(date, { kind, text: '', projectId, indent, afterItemId });
      setDay(
        (d) =>
          d && {
            ...d,
            // A reload may already have brought the created row from the server; keep the local one.
            items: d.items.filter((i) => i.id !== created.id).map((i) => {
              if (i.id === tempId) return { ...created, text: i.text, clientKey: i.clientKey };
              // The server shifted the rest of the group down by one; mirror it.
              if (i.projectId === projectId && i.id > 0 && i.sortOrder >= created.sortOrder)
                return { ...i, sortOrder: i.sortOrder + 1 };
              return i;
            }),
          }
      );
      return created.id;
    })();
    pending.current.set(tempId, creation);
    void run(() => creation, false);
  };

  const handlers: ItemHandlers = {
    commit: (item, text) => {
      if (text === item.text) return;
      setDay((d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, text } : i)) });
      void run(async () => {
        const id = await realId(item.id);
        replace(await api.updateItem(id, { text }), id);
      }, false);
    },
    enter: (item, text) => {
      let commit: (() => Promise<void>) | undefined;
      if (text !== item.text) {
        setDay((d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, text } : i)) });
        commit = async () => {
          const id = await realId(item.id);
          replace(await api.updateItem(id, { text }), id);
        };
      }
      insertLine(item.kind, item.projectId, item.indent, { ...item, text }, commit);
    },
    toggle: (item) =>
      void run(async () => {
        const id = await realId(item.id);
        replace(await api.updateItem(id, { state: item.state === 'Done' ? 'Open' : 'Done' }), id);
      }, false),
    indent: (item, delta, text) => {
      const indent = Math.min(MAX_INDENT, Math.max(0, item.indent + delta));
      if (indent === item.indent && text === item.text) return;
      setDay((d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, indent, text } : i)) });
      void run(async () => {
        const id = await realId(item.id);
        replace(await api.updateItem(id, { indent, text }), id);
      }, false);
    },
    removeEmpty: (item, refocus) => {
      const previous = refocus ? neighbourId(item, -1) : null;
      setDay((d) => d && { ...d, items: d.items.filter((i) => i.id !== item.id) });
      if (previous !== null) setFocusId(previous);
      void run(async () => api.deleteItem(await realId(item.id)), false);
    },
    reorder: (item, delta, text) => {
      const group = inGroup(item.projectId);
      const target = group.findIndex((i) => i.id === item.id) + delta;
      if (target < 0 || target >= group.length) return;
      void run(async () => {
        const id = await realId(item.id);
        if (text !== item.text) await api.updateItem(id, { text });
        await api.moveItem(id, item.projectId, target);
        setFocusId(id);
      }, true);
    },
    navigate: (item, delta) => {
      const id = neighbourId(item, delta);
      if (id !== null) setFocusId(id);
    },
    toggleKind: (item) =>
      void run(async () => {
        const id = await realId(item.id);
        replace(await api.updateItem(id, { kind: item.kind === 'Todo' ? 'Note' : 'Todo' }), id);
      }, false),
    moveToProject: (item, projectId) =>
      void run(async () => api.moveItem(await realId(item.id), projectId), true),
    remove: (item) => void run(async () => api.deleteItem(await realId(item.id)), true),
  };

  if (!day) {
    return <p className="py-2 text-sm text-muted">{error ?? 'Laster …'}</p>;
  }

  return (
    <div ref={container} className="space-y-4" data-testid={`day-${date}`} data-saving={saving > 0}>
      {error && (
        <p role="alert" className="rounded border border-border bg-surface px-3 py-1.5 text-sm">
          {error}
        </p>
      )}
      {groups.map((group) => {
        const groupItems = inGroup(group.id);
        return (
          <section
            key={group.id ?? 'none'}
            data-testid={`group-${group.name}`}
            data-color={group.color ?? ''}
            // Every group gets the border so items line up; uncolored ones keep it transparent.
            className="border-l-4 pl-3"
            style={{ borderColor: group.color ? projectColorVar(group.color) : 'transparent' }}
          >
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-muted">
              {group.color && (
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: projectColorVar(group.color) }}
                />
              )}
              {group.name}
            </h3>
            {groupItems.map((item) => (
              <ItemRow key={item.clientKey ?? item.id} item={item} projects={projects} handlers={handlers} />
            ))}
            {!group.archived && (
              <button
                type="button"
                onClick={() => insertLine('Todo', group.id, 0, null)}
                className="mt-0.5 pl-6 text-sm text-muted hover:text-accent"
              >
                + Ny
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

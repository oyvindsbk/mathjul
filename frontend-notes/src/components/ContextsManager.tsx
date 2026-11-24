'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { WorkContext } from '@/lib/types';

/** Create, rename, reorder and archive the headings that group a day's items. */
export function ContextsManager() {
  const [contexts, setContexts] = useState<WorkContext[] | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.contexts().then(setContexts, (e: Error) => setError(e.message));
  }, []);

  const attempt = async (action: () => Promise<WorkContext[]>) => {
    try {
      setContexts(await action());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt');
    }
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    void attempt(async () => {
      await api.createContext(name);
      setNewName('');
      return api.contexts();
    });
  };

  const rename = (context: WorkContext, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === context.name) return;
    void attempt(async () => {
      await api.updateContext(context.id, { name: trimmed });
      return api.contexts();
    });
  };

  const setArchived = (context: WorkContext, isArchived: boolean) =>
    void attempt(async () => {
      await api.updateContext(context.id, { isArchived });
      return api.contexts();
    });

  const move = (index: number, delta: number) => {
    if (!contexts) return;
    const ids = contexts.map((c) => c.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void attempt(() => api.reorderContexts(ids));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Kontekster</h1>
      <p className="mt-1 text-sm text-muted">
        Overskriftene oppgavene grupperes under. Arkiverte kontekster får ikke nye oppgaver, men historikken
        beholdes.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded border border-border bg-surface px-3 py-1.5 text-sm">
          {error}
        </p>
      )}

      <form onSubmit={create} className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ny kontekst"
          maxLength={60}
          aria-label="Navn på ny kontekst"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-white dark:text-black">
          Legg til
        </button>
      </form>

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
        {contexts?.map((context, index) => (
          <li
            key={`${context.id}-${context.name}`}
            className="flex items-center gap-2 px-3 py-2"
            data-testid="context-row"
          >
            <input
              defaultValue={context.name}
              maxLength={60}
              aria-label={`Navn på ${context.name}`}
              onBlur={(e) => rename(context, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={`min-w-0 flex-1 bg-transparent py-1 outline-none ${context.isArchived ? 'text-muted' : ''}`}
            />
            {context.isArchived && <span className="text-xs text-muted">Arkivert</span>}
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="px-1 text-muted disabled:opacity-30"
              aria-label={`Flytt ${context.name} opp`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === contexts.length - 1}
              className="px-1 text-muted disabled:opacity-30"
              aria-label={`Flytt ${context.name} ned`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setArchived(context, !context.isArchived)}
              className="rounded px-2 py-1 text-sm text-muted hover:text-foreground"
            >
              {context.isArchived ? 'Gjenopprett' : 'Arkiver'}
            </button>
          </li>
        ))}
        {contexts?.length === 0 && <li className="px-3 py-2 text-sm text-muted">Ingen kontekster ennå.</li>}
      </ul>
    </main>
  );
}

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';

/** Create, rename, reorder and archive the headings that group a day's items. */
export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.projects().then(setProjects, (e: Error) => setError(e.message));
  }, []);

  const attempt = async (action: () => Promise<Project[]>) => {
    try {
      setProjects(await action());
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
      await api.createProject(name);
      setNewName('');
      return api.projects();
    });
  };

  const rename = (project: Project, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) return;
    void attempt(async () => {
      await api.updateProject(project.id, { name: trimmed });
      return api.projects();
    });
  };

  const setArchived = (project: Project, isArchived: boolean) =>
    void attempt(async () => {
      await api.updateProject(project.id, { isArchived });
      return api.projects();
    });

  const move = (index: number, delta: number) => {
    if (!projects) return;
    const ids = projects.map((c) => c.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void attempt(() => api.reorderProjects(ids));
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Prosjekter</h1>
      <p className="mt-1 text-sm text-muted">
        Overskriftene oppgavene grupperes under. Arkiverte prosjekter får ikke nye oppgaver, men historikken
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
          placeholder="Nytt prosjekt"
          maxLength={60}
          aria-label="Navn på nytt prosjekt"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-white dark:text-black">
          Legg til
        </button>
      </form>

      <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
        {projects?.map((project, index) => (
          <li
            key={`${project.id}-${project.name}`}
            className="flex items-center gap-2 px-3 py-2"
            data-testid="project-row"
          >
            <input
              defaultValue={project.name}
              maxLength={60}
              aria-label={`Navn på ${project.name}`}
              onBlur={(e) => rename(project, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={`min-w-0 flex-1 bg-transparent py-1 outline-none ${project.isArchived ? 'text-muted' : ''}`}
            />
            {project.isArchived && <span className="text-xs text-muted">Arkivert</span>}
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="px-1 text-muted disabled:opacity-30"
              aria-label={`Flytt ${project.name} opp`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === projects.length - 1}
              className="px-1 text-muted disabled:opacity-30"
              aria-label={`Flytt ${project.name} ned`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setArchived(project, !project.isArchived)}
              className="rounded px-2 py-1 text-sm text-muted hover:text-foreground"
            >
              {project.isArchived ? 'Gjenopprett' : 'Arkiver'}
            </button>
          </li>
        ))}
        {projects?.length === 0 && <li className="px-3 py-2 text-sm text-muted">Ingen prosjekter ennå.</li>}
      </ul>
    </main>
  );
}

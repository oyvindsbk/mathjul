'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addDays, dayTitle, isoWeekKey, weekNumber } from '@/lib/dates';
import type { DaySummary, Week, Project } from '@/lib/types';
import { DayEditor } from './DayEditor';

const rangeFormat = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function summaryText(day: DaySummary): string {
  const parts = [
    day.open && `${day.open} åpne`,
    day.done && `${day.done} ferdig`,
    day.notes && `${day.notes} notater`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Tom';
}

const isEmpty = (d: DaySummary) => d.open + d.done + d.carried + d.notes === 0;

/** A week of days, Monday to Friday plus any weekend day with content. Today starts expanded. */
export function WeekView({ weekKey, monday }: { weekKey: string; monday: string }) {
  const [week, setWeek] = useState<Week | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWeek = useCallback(async () => {
    try {
      setWeek(await api.week(weekKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt');
    }
  }, [weekKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [w, c] = await Promise.all([api.week(weekKey), api.projects()]);
        if (cancelled) return;
        setWeek(w);
        setProjects(c);
        setExpanded(new Set(w.days.some((d) => d.date === w.today) ? [w.today] : []));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Noe gikk galt');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekKey]);

  const toggle = (date: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  const sunday = addDays(monday, 6);
  const previous = isoWeekKey(addDays(monday, -7));
  const next = isoWeekKey(addDays(monday, 7));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold" data-testid="week-title">
          Uke {weekNumber(weekKey)}
        </h1>
        <span className="text-sm text-muted">
          {rangeFormat.format(new Date(`${monday}T00:00:00Z`))} – {rangeFormat.format(new Date(`${sunday}T00:00:00Z`))}
        </span>
        <nav className="ml-auto flex gap-3 text-sm">
          <Link href={`/uke/${previous}`} className="text-muted hover:text-foreground">
            ← Forrige
          </Link>
          <Link href="/" className="text-muted hover:text-foreground">
            I dag
          </Link>
          <Link href={`/uke/${next}`} className="text-muted hover:text-foreground">
            Neste →
          </Link>
        </nav>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm">
          {error}
        </p>
      )}

      {week && expanded && (
        <div className="space-y-3">
          {week.days
            .filter((d, i) => i < 5 || !isEmpty(d) || d.date === week.today || expanded.has(d.date))
            .map((d) => {
              const open = expanded.has(d.date);
              const isToday = d.date === week.today;
              return (
                <article
                  key={d.date}
                  className={`rounded-lg border bg-surface ${isToday ? 'border-accent' : 'border-border'}`}
                >
                  <header className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(d.date)}
                      aria-expanded={open}
                      className="flex flex-1 items-baseline gap-3 text-left"
                    >
                      <span className="font-medium">{dayTitle(d.date)}</span>
                      {isToday && (
                        <span className="rounded bg-accent-soft px-1.5 text-xs text-accent">I dag</span>
                      )}
                      {!open && <span className="text-xs text-muted">{summaryText(d)}</span>}
                    </button>
                    <Link href={`/dag/${d.date}`} className="text-xs text-muted hover:text-foreground">
                      Åpne
                    </Link>
                  </header>
                  {open && (
                    <div className="border-t border-border px-4 py-3">
                      <DayEditor date={d.date} projects={projects} onChanged={loadWeek} />
                    </div>
                  )}
                </article>
              );
            })}
        </div>
      )}
    </main>
  );
}

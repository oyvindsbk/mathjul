'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { addDays, isoWeekKey, mondayOfWeek, sidebarDayLabel, todayInOslo, weekNumber, weekRange } from '@/lib/dates';
import type { DaySummary, Week } from '@/lib/types';

const WEEKS_PER_PAGE = 8;

interface Props {
  /** Per week key; a change reloads that week's days. */
  versions: Record<string, number>;
  /** Called when a link is chosen, so an overlay can close. */
  onNavigate?: () => void;
}

/** What the URL points at: a day (/dag/…) or a week (/uke/…). */
function useViewed() {
  const pathname = usePathname();
  const date = /^\/dag\/(\d{4}-\d{2}-\d{2})$/.exec(pathname)?.[1] ?? null;
  const weekFromPath = /^\/uke\/(\d{4}-W\d{2})$/.exec(pathname)?.[1] ?? null;
  const week = date ? isoWeekKey(date) : weekFromPath && mondayOfWeek(weekFromPath) ? weekFromPath : null;
  return { date, week, isWeekPage: weekFromPath !== null };
}

/** OneNote-style page list: today, then weeks newest first, each expanding to its days. */
export function Sidebar({ versions, onNavigate }: Props) {
  const viewed = useViewed();
  const [today] = useState(todayInOslo);
  const currentWeek = isoWeekKey(today);
  const [count, setCount] = useState(WEEKS_PER_PAGE);
  const [expanded, setExpanded] = useState(() => new Set([currentWeek, ...(viewed.week ? [viewed.week] : [])]));

  // Navigating to another week (e.g. with Neste →) opens it here too.
  const [seenWeek, setSeenWeek] = useState(viewed.week);
  if (viewed.week !== seenWeek) {
    setSeenWeek(viewed.week);
    if (viewed.week && !expanded.has(viewed.week)) setExpanded(new Set(expanded).add(viewed.week));
  }

  const weeks = useMemo(() => {
    const monday = mondayOfWeek(currentWeek) ?? today;
    const keys = Array.from({ length: count }, (_, i) => isoWeekKey(addDays(monday, -7 * i)));
    // A week outside the list (a future one, or far back) still shows while it is open.
    if (viewed.week && !keys.includes(viewed.week)) keys.push(viewed.week);
    // Keys are zero-padded ("2026-W08"), so they sort as text.
    return keys.sort().reverse();
  }, [count, currentWeek, today, viewed.week]);

  const toggle = (key: string) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  };

  return (
    <nav aria-label="Dager" className="px-2 py-3 text-sm" data-testid="sidebar">
      <Link
        href={`/dag/${today}`}
        onClick={onNavigate}
        aria-current={viewed.date === today ? 'page' : undefined}
        className="mb-2 block rounded px-2 py-1.5 font-medium hover:bg-accent-soft aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent"
      >
        I dag
      </Link>
      <ul className="space-y-0.5">
        {weeks.map((key) => (
          <SidebarWeek
            key={key}
            weekKey={key}
            open={expanded.has(key)}
            onToggle={() => toggle(key)}
            version={versions[key] ?? 0}
            today={today}
            viewedDate={viewed.date}
            isViewedWeekPage={viewed.isWeekPage && viewed.week === key}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setCount((c) => c + WEEKS_PER_PAGE)}
        className="mt-2 w-full rounded px-2 py-1.5 text-left text-muted hover:bg-accent-soft hover:text-foreground"
      >
        Eldre uker
      </button>
    </nav>
  );
}

const isEmpty = (d: DaySummary) => d.open + d.done + d.carried + d.notes === 0;

interface WeekProps {
  weekKey: string;
  open: boolean;
  onToggle: () => void;
  version: number;
  today: string;
  viewedDate: string | null;
  isViewedWeekPage: boolean;
  onNavigate?: () => void;
}

function SidebarWeek({ weekKey, open, onToggle, version, today, viewedDate, isViewedWeekPage, onNavigate }: WeekProps) {
  const [week, setWeek] = useState<Week | null>(null);
  const [failed, setFailed] = useState(false);
  const monday = mondayOfWeek(weekKey);

  // Days are fetched only once a week is opened, and again when an edit bumps its version.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.week(weekKey).then(
      (w) => {
        if (cancelled) return;
        setWeek(w);
        setFailed(false);
      },
      () => !cancelled && setFailed(true)
    );
    return () => {
      cancelled = true;
    };
  }, [open, weekKey, version]);

  const days = week?.days.filter((d, i) => i < 5 || !isEmpty(d) || d.date === today) ?? [];

  return (
    <li data-testid={`sidebar-week-${weekKey}`}>
      <div className="flex items-center rounded hover:bg-accent-soft/50">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Skjul' : 'Vis'} dager i uke ${weekNumber(weekKey)}`}
          className="flex size-7 shrink-0 items-center justify-center text-muted hover:text-foreground"
        >
          <span aria-hidden className={`text-xs transition-transform ${open ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
        <Link
          href={`/uke/${weekKey}`}
          onClick={onNavigate}
          aria-current={isViewedWeekPage ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-baseline gap-2 py-1 pr-2 aria-[current=page]:text-accent"
        >
          <span className="font-medium">Uke {weekNumber(weekKey)}</span>
          {monday && <span className="truncate text-xs text-muted">{weekRange(monday)}</span>}
        </Link>
      </div>
      {open && (
        <ul className="mb-1 ml-7 space-y-px">
          {failed && <li className="px-2 py-1 text-xs text-muted">Kunne ikke laste</li>}
          {!week && !failed && <li className="px-2 py-1 text-xs text-muted">Laster …</li>}
          {days.map((d) => (
            <li key={d.date}>
              <Link
                href={`/dag/${d.date}`}
                onClick={onNavigate}
                aria-current={d.date === viewedDate ? 'page' : undefined}
                data-testid={`sidebar-day-${d.date}`}
                className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-accent-soft aria-[current=page]:bg-accent-soft aria-[current=page]:font-medium ${
                  isEmpty(d) ? 'text-muted' : ''
                }`}
              >
                <span>{sidebarDayLabel(d.date)}</span>
                {d.date === today && (
                  <span className="rounded bg-accent-soft px-1 text-[0.65rem] text-accent">I dag</span>
                )}
                {d.open > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-muted" title={`${d.open} åpne oppgaver`}>
                    {d.open}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addDays, dayTitle, isoWeekKey, weekNumber } from '@/lib/dates';
import type { WorkContext } from '@/lib/types';
import { DayEditor } from './DayEditor';

export function DayPage({ date }: { date: string }) {
  const [contexts, setContexts] = useState<WorkContext[] | null>(null);

  useEffect(() => {
    void api.contexts().then(setContexts);
  }, []);

  const week = isoWeekKey(date);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold">{dayTitle(date)}</h1>
        <span className="text-sm text-muted">{date.slice(0, 4)}</span>
        <nav className="ml-auto flex gap-3 text-sm">
          <Link href={`/dag/${addDays(date, -1)}`} className="text-muted hover:text-foreground">
            ← Forrige
          </Link>
          <Link href={`/uke/${week}`} className="text-muted hover:text-foreground">
            Uke {weekNumber(week)}
          </Link>
          <Link href={`/dag/${addDays(date, 1)}`} className="text-muted hover:text-foreground">
            Neste →
          </Link>
        </nav>
      </div>
      <div className="rounded-lg border border-border bg-surface px-4 py-3">
        {contexts ? <DayEditor date={date} contexts={contexts} /> : <p className="text-sm text-muted">Laster …</p>}
      </div>
    </main>
  );
}

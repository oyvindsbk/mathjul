'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { Sidebar } from './Sidebar';

const SidebarRefresh = createContext<(week: string) => void>(() => {});

/** Lets a day editor tell the sidebar that a week's counts have changed. */
export const useSidebarRefresh = () => useContext(SidebarRefresh);

/**
 * Header, OneNote-style day sidebar and page. The sidebar sits beside the page from `md` up;
 * below that it opens as an overlay from the header's ☰ button. The login page gets neither.
 */
export function NotesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  /** Bumped per week key to make the sidebar reload that week. */
  const [versions, setVersions] = useState<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // Edits come in bursts (typing, Enter, ticking); reload a week once they settle.
  const refresh = useCallback((week: string) => {
    clearTimeout(timers.current.get(week));
    timers.current.set(
      week,
      setTimeout(() => setVersions((v) => ({ ...v, [week]: (v[week] ?? 0) + 1 })), 400)
    );
  }, []);

  if (pathname === '/login') return <>{children}</>;

  return (
    <SidebarRefresh.Provider value={refresh}>
      <AppHeader onMenu={() => setMenuOpen(true)} />
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-border md:block">
          <Sidebar versions={versions} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Dager"
            className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-surface shadow-xl"
          >
            <Sidebar versions={versions} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}
    </SidebarRefresh.Provider>
  );
}

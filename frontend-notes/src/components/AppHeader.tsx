import Link from 'next/link';

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="flex items-center gap-4 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={onMenu}
          className="-ml-1 px-1 text-lg leading-none text-muted hover:text-foreground md:hidden"
          aria-label="Vis dager"
        >
          ☰
        </button>
        <Link href="/" className="font-semibold">
          Notater
        </Link>
        <Link href="/prosjekter" className="text-muted hover:text-foreground">
          Prosjekter
        </Link>
        <form action="/api/auth/logout" method="post" className="ml-auto">
          <button type="submit" className="text-muted hover:text-foreground">
            Logg ut
          </button>
        </form>
      </nav>
    </header>
  );
}

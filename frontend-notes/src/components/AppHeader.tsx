import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold">
          Notater
        </Link>
        <Link href="/" className="text-muted hover:text-foreground">
          Denne uka
        </Link>
        <Link href="/kontekster" className="text-muted hover:text-foreground">
          Kontekster
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

const ERRORS: Record<string, string> = {
  not_allowed: 'Denne kontoen har ikke tilgang.',
  auth_failed: 'Innloggingen feilet. Prøv igjen.',
  expired: 'Innloggingen har utløpt. Logg inn på nytt.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Notater</h1>
      <p className="mt-1 text-sm text-muted">Daglig arbeidslogg</p>

      {error && (
        <p role="alert" className="mt-6 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          {ERRORS[error] ?? ERRORS.auth_failed}
        </p>
      )}

      <a
        href="/api/auth/google"
        className="mt-8 rounded-md bg-accent px-4 py-2.5 text-center font-medium text-white dark:text-black"
      >
        Logg inn med Google
      </a>

      {isDev && (
        <form action="/api/auth/dev-login" method="post" className="mt-3">
          <button
            type="submit"
            className="w-full rounded-md border border-border px-4 py-2.5 font-medium"
          >
            Logg inn (utvikling)
          </button>
        </form>
      )}
    </main>
  );
}

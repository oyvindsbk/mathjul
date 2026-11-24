import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE, notesApiUrl } from '@/lib/server/notesApi';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };

/**
 * Forwards /api/proxy/<path> to NotesApi /api/<path> with a Bearer token. The token comes from
 * the httpOnly cookie for the browser, or from an Authorization header for scripts (the importer).
 */
async function forward(request: NextRequest, { params }: Context): Promise<NextResponse> {
  const { path } = await params;
  if (path.some((segment) => segment === '..' || segment === '.' || segment === '')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const authorization =
    request.headers.get('authorization') ??
    (request.cookies.get(TOKEN_COOKIE)?.value
      ? `Bearer ${request.cookies.get(TOKEN_COOKIE)?.value}`
      : null);
  if (!authorization) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const target = `${notesApiUrl()}/api/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const hasBody = request.method !== 'GET' && request.method !== 'DELETE';
  const upstream = await fetch(target, {
    method: request.method,
    headers: {
      authorization,
      ...(hasBody ? { 'content-type': request.headers.get('content-type') ?? 'application/json' } : {}),
    },
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
    // Generous for import batches; a dead API should still fail rather than hang.
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json({ error: 'Notes API is unavailable' }, { status: 502 });
  }

  return new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;

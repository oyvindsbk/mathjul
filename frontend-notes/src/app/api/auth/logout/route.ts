import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE, appUrl } from '@/lib/server/notesApi';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', appUrl(request.nextUrl.origin)), 303);
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}

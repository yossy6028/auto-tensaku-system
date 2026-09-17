import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAuthRouteClient } from '@/lib/auth/server';
import { authRedirectURL, safeAuthNextPath } from '@/lib/auth/navigation';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeAuthNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createAuthRouteClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(authRedirectURL(next, origin));
    }
  }

  return NextResponse.redirect(authRedirectURL('/auth/error?reason=callback_invalid', origin));
}

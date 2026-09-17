import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createAuthRouteClient } from '@/lib/auth/server';
import { authRedirectURL, safeAuthNextPath } from '@/lib/auth/navigation';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeAuthNextPath(searchParams.get('next'));

  if (token_hash && type) {
    const supabase = await createAuthRouteClient();

    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      return NextResponse.redirect(authRedirectURL(next, origin));
    }
  }

  return NextResponse.redirect(authRedirectURL('/auth/error?reason=confirmation_invalid', origin));
}

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/ensure-profile
 *
 * 認証済みユーザーにプロファイルが存在しない場合（孤立ユーザー）に
 * プロファイルを自動作成するエンドポイント。
 *
 * 発生条件: handle_new_user トリガーが normalized_email の UNIQUE 制約違反で
 * EXCEPTION → RETURN NEW し、auth.users は作成されたが user_profiles が未作成。
 */

function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('[ensure-profile] SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function POST() {
  try {
    // 1. セッションからユーザーを取得（認証確認）
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Server Component からの呼び出し時は無視
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 2. プロファイルが既に存在するか確認
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, created: false });
    }

    // 3. プロファイルを作成（service role で RLS バイパス）
    const { error: insertError } = await admin
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name
          ?? user.email?.split('@')[0]
          ?? 'User',
        free_trial_started_at: new Date().toISOString(),
      });

    if (insertError) {
      // normalized_email の UNIQUE 制約違反 — 別のユーザーが同じ正規化メールで既に存在
      if (insertError.code === '23505') {
        console.warn(
          '[ensure-profile] normalized_email conflict for user %s (%s). Profile not created.',
          user.id, user.email
        );
        return NextResponse.json(
          { error: 'このメールアドレスは別のアカウントで既に使用されています。' },
          { status: 409 }
        );
      }

      console.error('[ensure-profile] Insert error:', insertError);
      return NextResponse.json(
        { error: 'プロファイルの作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('[ensure-profile] Created profile for orphaned user %s (%s)', user.id, user.email);
    return NextResponse.json({ ok: true, created: true });
  } catch (error) {
    console.error('[ensure-profile] Unexpected error:', error);
    return NextResponse.json(
      { error: 'プロファイルの作成に失敗しました' },
      { status: 500 }
    );
  }
}

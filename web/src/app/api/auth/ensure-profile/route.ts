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
      if (insertError.code === '23505') {
        // 23505（UNIQUE 制約違反）には2系統あるため、id を再SELECTして判別する:
        //   (a) 同一ユーザーの同時POST → 主キー(id)衝突。プロファイルは競合した別リクエストが
        //       作成済み → 冪等に成功(created:false)を返すべき。
        //   (b) 別ユーザーが同じ normalized_email で既存 → 本物の衝突 → サポート誘導。
        // 旧実装は両者を一律 (b) 扱いで 409 にしていたため、(a) が誤って 409 になっていた。
        const { data: nowExisting } = await admin
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (nowExisting) {
          // (a) 競合した別リクエストが既に作成済み → 成功扱い
          return NextResponse.json({ ok: true, created: false });
        }

        // (b) 自分の id は存在しない = normalized_email の衝突。
        // 自動マージは別アカウント乗っ取りに直結するため行わず、サポート誘導に留める。
        // （このAPIは認証必須なので任意メールの列挙には使えないが、条件は断定しない文言にする）
        console.warn(
          '[ensure-profile] normalized_email conflict for user %s (%s). Profile not created.',
          user.id, user.email
        );
        return NextResponse.json(
          { error: 'アカウントの初期設定を完了できませんでした。お手数ですがサポートまでお問い合わせください。' },
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

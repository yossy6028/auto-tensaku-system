import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 遅延初期化 — ビルド時にはenv未設定のためランタイムで生成
function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('[check-email] SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

/**
 * メールアドレスを正規化する（Gmailエイリアス等の同一人物検出用）
 * DB側の normalize_email() 関数と同じロジックを維持すること
 */
function normalizeEmail(email: string): string {
  email = email.toLowerCase().trim();
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;

  let localPart = email.substring(0, atIndex);
  let domain = email.substring(atIndex + 1);

  // +エイリアスを除去: user+alias@example.com → user@example.com
  const plusIndex = localPart.indexOf('+');
  if (plusIndex !== -1) {
    localPart = localPart.substring(0, plusIndex);
  }

  // Gmail/Googlemail: ドットを除去 + ドメイン統一
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    localPart = localPart.replace(/\./g, '');
    domain = 'gmail.com';
  }

  return `${localPart}@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'メールアドレスが必要です' },
        { status: 400 }
      );
    }

    const normalized = normalizeEmail(email);

    const { data, error } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('id')
      .eq('normalized_email', normalized)
      .maybeSingle();

    if (error) {
      console.error('[check-email] DB query error:', error);
      return NextResponse.json({ ok: true });
    }

    if (data) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています。' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'メールアドレスの確認に失敗しました' },
      { status: 500 }
    );
  }
}

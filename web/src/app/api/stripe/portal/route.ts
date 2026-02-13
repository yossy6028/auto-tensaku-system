import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

// 許可するリダイレクト先ドメインのホワイトリスト
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'https://auto-tensaku-system.vercel.app',
  'http://localhost:3000',
].filter(Boolean);

function getSafeReturnUrl(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed!))) {
    return `${origin}/subscription`;
  }
  return `${ALLOWED_ORIGINS[0] || 'https://auto-tensaku-system.vercel.app'}/subscription`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      );
    }

    // ユーザープロファイルからStripe customer_idを取得
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(profile as any)?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'サブスクリプションが見つかりません' },
        { status: 404 }
      );
    }

    // カスタマーポータルセッション作成（リダイレクト先はサーバー固定）
    const portalSession = await stripe.billingPortal.sessions.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customer: (profile as any).stripe_customer_id,
      return_url: getSafeReturnUrl(request),
    });

    return NextResponse.json({
      redirectUrl: portalSession.url,
    });
  } catch (error) {
    console.error('Portal session creation error:', error);
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}

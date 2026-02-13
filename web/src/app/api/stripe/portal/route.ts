import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

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

    const { returnUrl } = await request.json().catch(() => ({}));

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

    // カスタマーポータルセッション作成
    const portalSession = await stripe.billingPortal.sessions.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customer: (profile as any).stripe_customer_id,
      return_url: returnUrl || `${request.headers.get('origin')}/subscription`,
    });

    return NextResponse.json({
      redirectUrl: portalSession.url,
    });
  } catch (error) {
    console.error('Portal session creation error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}


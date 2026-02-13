import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getStripePriceId } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

// 許可するリダイレクト先ドメインのホワイトリスト
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  'https://auto-tensaku-system.vercel.app',
  'http://localhost:3000',
].filter(Boolean);

function getSafeOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.some(allowed => origin === allowed)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0] || 'https://auto-tensaku-system.vercel.app';
}

interface CheckoutRequestBody {
  planName: string;
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

    const body: CheckoutRequestBody = await request.json();
    const { planName } = body;

    // プラン名からStripe Price IDを取得
    const priceId = getStripePriceId(planName);
    if (!priceId) {
      return NextResponse.json(
        { error: '無効なプラン名です' },
        { status: 400 }
      );
    }

    // ユーザープロファイルを取得
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let customerId = (profile as any)?.stripe_customer_id;

    // Stripe顧客が存在しない場合は作成
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Supabaseにcustomer_idを保存
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // 既存のアクティブなサブスクリプションをチェック
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 既にアクティブなサブスクリプションがある場合
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((existingSubscription as any)?.stripe_subscription_id) {
      // カスタマーポータルにリダイレクトしてプラン変更させる
      const safeOrigin = getSafeOrigin(request);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${safeOrigin}/subscription`,
      });

      return NextResponse.json({ 
        redirectUrl: portalSession.url,
        isPortal: true,
      });
    }

    // 安全なベースURL取得
    const safeOrigin = getSafeOrigin(request);

    // Checkout Session作成
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${safeOrigin}/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${safeOrigin}/pricing?checkout=cancelled`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_name: planName,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        plan_name: planName,
      },
      // 日本語ローカライズ
      locale: 'ja',
      // 請求先住所収集
      billing_address_collection: 'auto',
      // 税金自動計算（日本の消費税）
      automatic_tax: { enabled: false },
    });

    return NextResponse.json({
      sessionId: session.id,
      redirectUrl: session.url,
    });

  } catch (error) {
    console.error('Checkout session creation error:', error);
    return NextResponse.json(
      { error: '決済セッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}

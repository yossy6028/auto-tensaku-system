import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPlanIdFromStripePriceId } from '@/lib/stripe/config';
import { createClient } from '@/lib/supabase/server';

const PLAN_LIMITS: Record<string, number> = {
  light: 10,
  standard: 30,
  unlimited: 999999,
};

const PLAN_PRICES: Record<string, number> = {
  light: 980,
  standard: 1980,
  unlimited: 4980,
};

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';

const mapStripeStatus = (stripeStatus?: string | null): SubscriptionStatus => {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') return 'cancelled';
  return 'past_due';
};

export async function POST(_request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase設定が不足しています' }, { status: 503 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe設定が不足しています' }, { status: 503 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client型の互換性問題を回避
    const supabase = (await createClient()) as any;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
    }

    // プロファイルからStripe顧客IDを取得
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    // 明示キャストで型崩れを回避
    const stripeCustomerId = (
      profileData as { stripe_customer_id: string | null } | null
    )?.stripe_customer_id ?? null;

    if (profileError || !stripeCustomerId) {
      return NextResponse.json({ error: 'Stripe顧客IDが見つかりません' }, { status: 404 });
    }

    const customerId = stripeCustomerId;

    // 最新のサブスクリプションをStripeから取得
    const stripe = getStripe();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: 'Stripe上にサブスクリプションがありません' }, { status: 404 });
    }

    // active/trialing を優先し、同一ステータス内ではcreatedの新しい順にソート
    const statusPriority: Record<string, number> = { active: 0, trialing: 0, past_due: 1, unpaid: 2 };
    const sorted = [...subscriptions.data].sort((a, b) => {
      const pa = statusPriority[a.status] ?? 3;
      const pb = statusPriority[b.status] ?? 3;
      if (pa !== pb) return pa - pb;
      return b.created - a.created;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = sorted[0] as any;

    const priceId = subscription.items.data[0]?.price?.id || null;
    const resolvedPlanId = getPlanIdFromStripePriceId(priceId || '');
    if (!resolvedPlanId) {
      console.error('[Stripe Sync] Unknown stripe_price_id, cannot map to plan:', priceId);
    }
    const planId = resolvedPlanId || 'light';
    const usageLimit = PLAN_LIMITS[planId] ?? null;
    const pricePaid = PLAN_PRICES[planId] ?? PLAN_PRICES.light;

    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    const status: SubscriptionStatus = mapStripeStatus(subscription.status);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

    // 古いactiveサブスクリプションをcancelledに更新（同じユーザーの他のサブスクリプション）
    const { error: updateOldError } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .neq('stripe_subscription_id', subscription.id);

    if (updateOldError) {
      console.warn('[Stripe Sync] Failed to cancel old subscriptions:', updateOldError.message);
    }

    // 既存レコードを確認（usage_countを保持するため）
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    const subscriptionPayload = {
      user_id: user.id,
      plan_id: planId,
      status,
      usage_limit: usageLimit,
      price_paid: pricePaid,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      expires_at: currentPeriodEnd,
    };

    // Supabaseに反映（既存レコードはusage_countを保持、新規は0で作成）
    const { error: upsertError } = existingSub
      ? await supabase
          .from('subscriptions')
          .update({ ...subscriptionPayload, updated_at: new Date().toISOString() })
          .eq('id', existingSub.id)
      : await supabase
          .from('subscriptions')
          .insert({
            ...subscriptionPayload,
            usage_count: 0,
            purchased_at: currentPeriodStart || new Date().toISOString(),
          });

    if (upsertError) {
      return NextResponse.json({ error: 'サブスクリプションの同期に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ synced: true });
  } catch (error) {
    console.error('Stripe sync error:', error);
    return NextResponse.json({ error: 'サブスクリプションの同期に失敗しました' }, { status: 500 });
  }
}

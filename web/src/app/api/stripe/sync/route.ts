import { NextRequest, NextResponse } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPlanIdFromStripePriceId } from '@/lib/stripe/config';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

const PLAN_LIMITS: Record<string, number> = {
  light: 10,
  standard: 30,
  unlimited: 999999,
};

const PLAN_PRICES: Record<string, number> = {
  light: 980,
  standard: 2980,
  unlimited: 5980,
};

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';

const mapStripeStatus = (stripeStatus?: string | null): SubscriptionStatus => {
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') return 'cancelled';
  return 'active';
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    type ProfileRow = Database['public']['Tables']['user_profiles']['Row'];
    type ProfileStripeId = Pick<ProfileRow, 'stripe_customer_id'>;
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

    const stripeCustomerId = (profileData as ProfileStripeId | null)?.stripe_customer_id ?? null;

    if (profileError || !stripeCustomerId) {
      return NextResponse.json({ error: 'Stripe顧客IDが見つかりません' }, { status: 404 });
    }

    const customerId = stripeCustomerId;

    // 最新のサブスクリプションをStripeから取得
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: 'Stripe上にサブスクリプションがありません' }, { status: 404 });
    }

    // createdの新しい順にソートして最新を取得
    const sorted = [...subscriptions.data].sort((a, b) => b.created - a.created);
    const subscription = sorted[0];

    const priceId = subscription.items.data[0]?.price?.id || null;
    const planId = getPlanIdFromStripePriceId(priceId || '') || 'light';
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

    // Supabaseに反映（既存があれば更新）
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan_id: planId,
          status,
          usage_count: 0,
          usage_limit: usageLimit,
          price_paid: pricePaid,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          purchased_at: currentPeriodStart || new Date().toISOString(),
          expires_at: currentPeriodEnd,
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      return NextResponse.json({ error: 'サブスクリプションの同期に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ synced: true });
  } catch (error) {
    console.error('Stripe sync error:', error);
    return NextResponse.json({ error: 'サブスクリプションの同期に失敗しました' }, { status: 500 });
  }
}

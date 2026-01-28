import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_WEBHOOK_SECRET, getPlanIdFromStripePriceId } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logger } from '@/lib/security/logger';

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';

// Supabase Admin Client (サービスロールキー使用)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// プラン情報
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

interface PlanResolution {
  planId: string;
  usageLimit: number | null;
  pricePaid: number;
}

const mapStripeStatus = (stripeStatus?: string | null): SubscriptionStatus => {
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') return 'cancelled';
  return 'active';
};

// Supabaseユーザーを特定する
async function resolveUserIdFromStripe(params: {
  explicitUserId?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
}): Promise<string | null> {
  const { explicitUserId, customerId, customerEmail } = params;

  if (explicitUserId) {
    return explicitUserId;
  }

  // 1) stripe_customer_id で user_profiles を検索
  if (customerId) {
    const { data: profileByCustomer } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (profileByCustomer?.id) {
      return profileByCustomer.id;
    }
  }

  // 2) email で検索
  if (customerEmail) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .ilike('email', customerEmail)
      .maybeSingle();
    if (profileByEmail?.id) {
      return profileByEmail.id;
    }
  }

  return null;
}

// pricing_plansテーブルに紐づくプラン情報を解決し、存在しなければ作成する
async function resolvePlan(stripePriceId?: string | null): Promise<PlanResolution> {
  // 1) price_id で紐づくプランを探す
  const { data: planByPrice, error: planByPriceError } = await supabaseAdmin
    .from('pricing_plans')
    .select('id, usage_limit, price_yen')
    .eq('stripe_price_id', stripePriceId || '')
    .maybeSingle();

  if (planByPriceError) {
    logger.warn('Failed to lookup pricing plan by stripe_price_id:', planByPriceError);
  }

  if (planByPrice) {
    return {
      planId: planByPrice.id,
      usageLimit: planByPrice.usage_limit,
      pricePaid: planByPrice.price_yen,
    };
  }

  // 2) price_id からプランIDを解決し、既存IDで探す
  const fallbackPlanId = getPlanIdFromStripePriceId(stripePriceId || '') || 'light';
  const { data: planById, error: planByIdError } = await supabaseAdmin
    .from('pricing_plans')
    .select('id, usage_limit, price_yen')
    .eq('id', fallbackPlanId)
    .maybeSingle();

  if (planByIdError) {
    logger.warn('Failed to lookup pricing plan by id:', planByIdError);
  }

  if (planById) {
    return {
      planId: planById.id,
      usageLimit: planById.usage_limit,
      pricePaid: planById.price_yen,
    };
  }

  // 3) なければ最低限の情報でプランを作成（外部キー制約エラー防止）
  const usageLimit = PLAN_LIMITS[fallbackPlanId] ?? null;
  const pricePaid = PLAN_PRICES[fallbackPlanId] ?? PLAN_PRICES.light;
  const { data: insertedPlan, error: insertPlanError } = await supabaseAdmin
    .from('pricing_plans')
    .insert({
      id: fallbackPlanId,
      name: `自動登録プラン (${fallbackPlanId})`,
      description: null,
      usage_limit: usageLimit,
      price_yen: pricePaid,
      is_active: true,
      sort_order: 0,
    })
    .select('id, usage_limit, price_yen')
    .maybeSingle();

  if (insertPlanError) {
    logger.error('Failed to auto-create pricing plan:', insertPlanError);
  }

  return {
    planId: insertedPlan?.id || fallbackPlanId,
    usageLimit: insertedPlan?.usage_limit ?? usageLimit,
    pricePaid: insertedPlan?.price_yen ?? pricePaid,
  };
}

// サブスクリプションレコードの保存（既存があれば更新）
async function upsertSubscriptionRecord(params: {
  userId: string;
  subscriptionId: string;
  priceId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  resetUsageCount?: boolean;
  purchasedAt?: Date;
}) {
  const {
    userId,
    subscriptionId,
    priceId,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    resetUsageCount = false,
    purchasedAt,
  } = params;

  const { planId, usageLimit, pricePaid } = await resolvePlan(priceId);
  const nowIso = new Date().toISOString();
  const periodStartIso = currentPeriodStart ? currentPeriodStart.toISOString() : null;
  const periodEndIso = currentPeriodEnd ? currentPeriodEnd.toISOString() : null;

  const basePayload = {
    user_id: userId,
    plan_id: planId,
    status,
    usage_limit: usageLimit,
    price_paid: pricePaid,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    current_period_start: periodStartIso,
    current_period_end: periodEndIso,
    cancel_at_period_end: !!cancelAtPeriodEnd,
    expires_at: periodEndIso,
    updated_at: nowIso,
  };

  // 既存レコードをstripe_subscription_id優先で取得、なければuser_idで取得
  const { data: existingByStripe, error: existingByStripeError } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (existingByStripeError) {
    logger.warn('Failed to lookup subscription by stripe_subscription_id:', existingByStripeError);
  }

  let targetId = existingByStripe?.id;

  if (!targetId) {
    const { data: existingByUser, error: existingByUserError } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingByUserError) {
      logger.warn('Failed to lookup subscription by user_id:', existingByUserError);
    }

    targetId = existingByUser?.id;
  }

  if (targetId) {
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        ...basePayload,
        ...(resetUsageCount ? { usage_count: 0 } : {}),
      })
      .eq('id', targetId);

    if (updateError) {
      logger.error('Failed to update subscription:', updateError);
    } else {
      logger.info('Subscription updated for user:', userId);
    }
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      ...basePayload,
      usage_count: 0,
      purchased_at: purchasedAt ? purchasedAt.toISOString() : nowIso,
    });

  if (insertError) {
    logger.error('Failed to insert subscription:', insertError);
  } else {
    logger.info('Subscription inserted for user:', userId);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    logger.error('No stripe-signature header');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  logger.info('Webhook event received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const userId = await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id || session.metadata?.supabase_user_id,
            customerId: subscription.customer as string | undefined,
            customerEmail: (subscription.customer as Stripe.Customer)?.email || (session.customer_details?.email ?? undefined),
          });
          
          if (!userId) {
            logger.error('No user ID in subscription metadata');
            break;
          }

          const priceId = subscription.items.data[0]?.price?.id;
          await upsertSubscriptionRecord({
            userId,
            subscriptionId,
            priceId: priceId || null,
            status: 'active',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            resetUsageCount: true,
            purchasedAt: new Date(),
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerObj = subscription.customer as Stripe.Customer | string | undefined;
        const customerId = typeof customerObj === 'string' ? customerObj : customerObj?.id;
        const customerEmail = typeof customerObj === 'object' ? customerObj?.email : undefined;
        const userId = await resolveUserIdFromStripe({
          explicitUserId: subscription.metadata?.supabase_user_id,
          customerId,
          customerEmail,
        });
        
        if (!userId) {
          logger.error('No user ID in subscription metadata');
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        await upsertSubscriptionRecord({
          userId,
          subscriptionId: subscription.id,
          priceId: priceId || null,
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerObj = subscription.customer as Stripe.Customer | string | undefined;
        const customerId = typeof customerObj === 'string' ? customerObj : customerObj?.id;
        const customerEmail = typeof customerObj === 'object' ? customerObj?.email : undefined;
        const userId = await resolveUserIdFromStripe({
          explicitUserId: subscription.metadata?.supabase_user_id,
          customerId,
          customerEmail,
        });
        
        if (!userId) break;

        await upsertSubscriptionRecord({
          userId,
          subscriptionId: subscription.id,
          priceId: subscription.items?.data?.[0]?.price?.id || null,
          status: 'cancelled',
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : undefined,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : undefined,
          cancelAtPeriodEnd: true,
        });
        break;
      }

      case 'invoice.paid': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        
        if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
          const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const customerObj = subscription.customer as Stripe.Customer | string | undefined;
          const customerId = typeof customerObj === 'string' ? customerObj : customerObj?.id;
          const customerEmail = typeof customerObj === 'object' ? customerObj?.email : undefined;
          const userId = await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          });
          
          if (!userId) break;

          await upsertSubscriptionRecord({
            userId,
            subscriptionId,
            priceId: subscription.items?.data?.[0]?.price?.id || null,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            resetUsageCount: true,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription.id;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const customerObj = subscription.customer as Stripe.Customer | string | undefined;
          const customerId = typeof customerObj === 'string' ? customerObj : customerObj?.id;
          const customerEmail = typeof customerObj === 'object' ? customerObj?.email : undefined;
          const userId = await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          });
          
          if (!userId) break;

          await upsertSubscriptionRecord({
            userId,
            subscriptionId,
            priceId: subscription.items?.data?.[0]?.price?.id || null,
            status: 'past_due',
            currentPeriodStart: subscription.current_period_start
              ? new Date(subscription.current_period_start * 1000)
              : undefined,
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          });
        }
        break;
      }

      default:
        logger.info('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

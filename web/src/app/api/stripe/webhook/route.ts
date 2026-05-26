import { NextRequest, NextResponse } from 'next/server';
import { getStripe, STRIPE_WEBHOOK_SECRET, getPlanIdFromStripePriceId } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logger } from '@/lib/security/logger';

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';

// Supabase Admin Client (遅延初期化 — ビルド時にはenv未設定のためランタイムで生成)
function getSupabaseAdmin() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error('[Stripe Webhook] SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseServiceRoleKey
  );
}

// プラン情報
const PLAN_LIMITS: Record<string, number> = {
  light: 10,
  standard: 30,
  unlimited: 999999,
};

const PLAN_PRICES: Record<string, number> = {
  light: 480,
  standard: 980,
  unlimited: 1580,
};

interface PlanResolution {
  planId: string;
  usageLimit: number | null;
  pricePaid: number;
}

// Stripe API 2025-11-17+ では current_period_start/end が
// トップレベルから items.data[0] に移動されたため、両方をフォールバックで取得する
function getSubscriptionPeriod(subscription: Record<string, unknown>): { start?: Date; end?: Date } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = (subscription.items as any)?.data?.[0];
  const startTs = (subscription.current_period_start as number | undefined) ?? (item?.current_period_start as number | undefined);
  const endTs = (subscription.current_period_end as number | undefined) ?? (item?.current_period_end as number | undefined);
  return {
    start: startTs ? new Date(startTs * 1000) : undefined,
    end: endTs ? new Date(endTs * 1000) : undefined,
  };
}

const mapStripeStatus = (stripeStatus?: string | null): SubscriptionStatus => {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') return 'cancelled';
  // incomplete, incomplete_expired, past_due, unpaid, paused など → past_due扱い
  return 'past_due';
};

function getCustomerId(customer?: string | Stripe.Customer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

async function getCustomerEmail(
  stripe: Stripe,
  customer?: string | Stripe.Customer | null,
  fallbackEmail?: string | null
): Promise<string | null> {
  if (fallbackEmail) return fallbackEmail;
  if (!customer) return null;

  if (typeof customer !== 'string') {
    return customer.email ?? null;
  }

  try {
    const retrievedCustomer = await stripe.customers.retrieve(customer);
    if ('deleted' in retrievedCustomer && retrievedCustomer.deleted) {
      return null;
    }
    return retrievedCustomer.email ?? null;
  } catch (error) {
    logger.warn('Failed to retrieve Stripe customer for user resolution:', error);
    return null;
  }
}

function requireResolvedUserId(userId: string | null, context: string): string {
  if (userId) return userId;
  throw new Error(`[Stripe Webhook] Could not resolve Supabase user for ${context}`);
}

async function getPlanIdFromLegacyStripePrice(stripePriceId: string): Promise<string | null> {
  try {
    const stripePrice = await getStripe().prices.retrieve(stripePriceId);
    if (stripePrice.currency !== 'jpy' || typeof stripePrice.unit_amount !== 'number') {
      return null;
    }

    const matchedPlan = Object.entries(PLAN_PRICES).find(([, price]) => price === stripePrice.unit_amount)?.[0] ?? null;
    if (matchedPlan) {
      logger.warn('Legacy Stripe price id matched by amount:', {
        price_id: stripePriceId,
        matched_plan: matchedPlan,
      });
    }
    return matchedPlan;
  } catch (error) {
    logger.warn('Failed to retrieve Stripe price for legacy plan resolution:', error);
    return null;
  }
}

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
    const { data: profileByCustomer } = await getSupabaseAdmin()
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
    const { data: profileByEmail } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('id, stripe_customer_id')
      .ilike('email', customerEmail)
      .maybeSingle();
    if (profileByEmail?.id) {
      if (customerId && !profileByEmail.stripe_customer_id) {
        const { error: updateCustomerError } = await getSupabaseAdmin()
          .from('user_profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', profileByEmail.id);
        if (updateCustomerError) {
          logger.warn('Resolved user by email but failed to backfill stripe_customer_id:', updateCustomerError);
        }
      }
      return profileByEmail.id;
    }
  }

  return null;
}

// pricing_plansテーブルに紐づくプラン情報を解決し、存在しなければ作成する
async function resolvePlan(stripePriceId?: string | null): Promise<PlanResolution> {
  // 1) price_id で紐づくプランを探す
  const { data: planByPrice, error: planByPriceError } = await getSupabaseAdmin()
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

  // 2) price_id からプランIDを解決し、料金改訂前のPrice IDは金額で補完する
  const resolvedPlanId = getPlanIdFromStripePriceId(stripePriceId || '')
    || (stripePriceId ? await getPlanIdFromLegacyStripePrice(stripePriceId) : null);
  if (!resolvedPlanId) {
    logger.error('Unknown stripe_price_id, cannot map to plan:', stripePriceId);
    throw new Error(`[Stripe Webhook] Unknown Stripe price id: ${stripePriceId || 'empty'}`);
  }
  const fallbackPlanId = resolvedPlanId;
  const { data: planById, error: planByIdError } = await getSupabaseAdmin()
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
  const { data: insertedPlan, error: insertPlanError } = await getSupabaseAdmin()
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
    throw new Error('[Stripe Webhook] Failed to auto-create pricing plan');
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
  const { data: existingByStripe, error: existingByStripeError } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (existingByStripeError) {
    logger.warn('Failed to lookup subscription by stripe_subscription_id:', existingByStripeError);
  }

  let targetId = existingByStripe?.id;

  if (!targetId) {
    const { data: existingByUser, error: existingByUserError } = await getSupabaseAdmin()
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
    const { error: updateError } = await getSupabaseAdmin()
      .from('subscriptions')
      .update({
        ...basePayload,
        ...(resetUsageCount ? { usage_count: 0 } : {}),
      })
      .eq('id', targetId);

    if (updateError) {
      logger.error('Failed to update subscription:', updateError);
      throw new Error('[Stripe Webhook] Failed to update subscription');
    } else {
      logger.info('Subscription updated for user:', userId);
    }
    return;
  }

  const { error: insertError } = await getSupabaseAdmin()
    .from('subscriptions')
    .insert({
      ...basePayload,
      usage_count: 0,
      purchased_at: purchasedAt ? purchasedAt.toISOString() : nowIso,
    });

  if (insertError) {
    logger.error('Failed to insert subscription:', insertError);
    throw new Error('[Stripe Webhook] Failed to insert subscription');
  } else {
    logger.info('Subscription inserted for user:', userId);
  }
}

async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('stripe_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to check Stripe event idempotency:', error);
    throw new Error('[Stripe Webhook] Failed to check event idempotency');
  }

  return Boolean(data?.id);
}

async function persistProcessedStripeEvent(event: Stripe.Event): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('stripe_events')
    .upsert(
      {
        event_id: event.id,
        event_type: event.type,
        data: event.data,
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    );

  if (error) {
    logger.error('Failed to persist processed Stripe event:', error);
    throw new Error('[Stripe Webhook] Failed to persist processed event');
  }
}

async function recordAppEvent(userId: string, eventName: string, properties: Record<string, string | number | boolean | null>) {
  const { error } = await getSupabaseAdmin()
    .from('app_events')
    .insert({
      user_id: userId,
      event_name: eventName,
      properties,
      path: '/api/stripe/webhook',
    });

  if (error) {
    logger.warn('Failed to record app event from Stripe webhook:', error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    logger.error('No stripe-signature header');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook設定が不足しています' }, { status: 503 });
  }

  const stripe = getStripe();
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
    // 処理前に保存すると、途中失敗したイベントまで処理済み扱いになるため、成功後に保存する。
    if (await hasProcessedStripeEvent(event.id)) {
      logger.info('Duplicate event skipped:', event.id);
      return NextResponse.json({ received: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const customerId = getCustomerId(subscription.customer);
          const customerEmail = await getCustomerEmail(stripe, subscription.customer, session.customer_details?.email ?? null);
          const userId = requireResolvedUserId(
            await resolveUserIdFromStripe({
              explicitUserId: subscription.metadata?.supabase_user_id || session.metadata?.supabase_user_id,
              customerId,
              customerEmail,
            }),
            `${event.type}:${subscriptionId}`
          );

          const priceId = subscription.items.data[0]?.price?.id;
          const period = getSubscriptionPeriod(subscription);
          await upsertSubscriptionRecord({
            userId,
            subscriptionId,
            priceId: priceId || null,
            status: 'active',
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            resetUsageCount: true,
            purchasedAt: new Date(),
          });
          await recordAppEvent(userId, 'checkout_completed', {
            source: 'stripe_webhook',
            price_id_known: priceId ? 1 : 0,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerId = getCustomerId(subscription.customer);
        const customerEmail = await getCustomerEmail(stripe, subscription.customer);
        const userId = requireResolvedUserId(
          await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          }),
          `${event.type}:${subscription.id}`
        );

        // プラン変更（price_id変更）を検出 → usage_count をリセット
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const previousAttributes = (event.data as any).previous_attributes;
        const planChanged = previousAttributes?.items !== undefined;
        const shouldResetUsage = event.type === 'customer.subscription.created' || planChanged;

        const priceId = subscription.items.data[0]?.price?.id;
        const period = getSubscriptionPeriod(subscription);
        await upsertSubscriptionRecord({
          userId,
          subscriptionId: subscription.id,
          priceId: priceId || null,
          status: mapStripeStatus(subscription.status),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          resetUsageCount: shouldResetUsage,
        });

        if (planChanged) {
          logger.info('Plan changed for user, usage_count reset:', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const customerId = getCustomerId(subscription.customer);
        const customerEmail = await getCustomerEmail(stripe, subscription.customer);
        const userId = requireResolvedUserId(
          await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          }),
          `${event.type}:${subscription.id}`
        );

        const deletedPeriod = getSubscriptionPeriod(subscription);
        await upsertSubscriptionRecord({
          userId,
          subscriptionId: subscription.id,
          priceId: subscription.items?.data?.[0]?.price?.id || null,
          status: 'cancelled',
          currentPeriodStart: deletedPeriod.start,
          currentPeriodEnd: deletedPeriod.end,
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
          const customerId = getCustomerId(subscription.customer);
          const customerEmail = await getCustomerEmail(stripe, subscription.customer);
          const userId = requireResolvedUserId(
            await resolveUserIdFromStripe({
              explicitUserId: subscription.metadata?.supabase_user_id,
              customerId,
              customerEmail,
            }),
            `${event.type}:${subscriptionId}`
          );

          const invoicePeriod = getSubscriptionPeriod(subscription);
          await upsertSubscriptionRecord({
            userId,
            subscriptionId,
            priceId: subscription.items?.data?.[0]?.price?.id || null,
            status: mapStripeStatus(subscription.status),
            currentPeriodStart: invoicePeriod.start,
            currentPeriodEnd: invoicePeriod.end,
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
          const customerId = getCustomerId(subscription.customer);
          const customerEmail = await getCustomerEmail(stripe, subscription.customer);
          const userId = requireResolvedUserId(
            await resolveUserIdFromStripe({
              explicitUserId: subscription.metadata?.supabase_user_id,
              customerId,
              customerEmail,
            }),
            `${event.type}:${subscriptionId}`
          );

          const failedPeriod = getSubscriptionPeriod(subscription);
          await upsertSubscriptionRecord({
            userId,
            subscriptionId,
            priceId: subscription.items?.data?.[0]?.price?.id || null,
            status: 'past_due',
            currentPeriodStart: failedPeriod.start,
            currentPeriodEnd: failedPeriod.end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          });
        }
        break;
      }

      default:
        logger.info('Unhandled event type:', event.type);
    }

    await persistProcessedStripeEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

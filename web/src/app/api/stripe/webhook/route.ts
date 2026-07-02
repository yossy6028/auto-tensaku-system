import { NextRequest, NextResponse } from 'next/server';
import { getStripe, STRIPE_WEBHOOK_SECRET, getPlanIdFromStripePriceId } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logger } from '@/lib/security/logger';

type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';

// リトライしても直らない（＝コード/設定を修正しない限り永久に失敗する）webhook 処理エラー。
// これを投げると catch 節で status='failed' に確定させ 200 を返すことで、
// 「500 → 再送 → また 500」を最大3日繰り返す poison ループを打ち切る。
class NonRetryableWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableWebhookError';
  }
}

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

function logSkippedUnlinkedStripeEvent(context: string, details: Record<string, string | null | undefined>) {
  logger.warn('Skipping Stripe event because no matching Supabase user was found:', {
    context,
    ...details,
  });
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
    // 未知の price id は再送しても解決しない（Stripe 側の price 追加か当方のマッピング修正が必要）。
    // リトライ不可能として分類し、poison ループを避ける。
    throw new NonRetryableWebhookError(`[Stripe Webhook] Unknown Stripe price id: ${stripePriceId || 'empty'}`);
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

// ---- Stripe webhook 冪等性（status 列ベースの状態機械） --------------------
//
// stripe_events.status は 'processing' → 'processed' / 'failed' と遷移する。
// claim で行を 'processing' で挿入して処理権を獲得し、成功で 'processed'、
// リトライ不可能な失敗で 'failed'、リトライ可能な失敗では行を削除して Stripe に委ねる。
//
// これにより次の2つの弱点を塞ぐ:
//   (1) 処理途中の kill（maxDuration超過/OOM/デプロイ差替）で行が processing のまま
//       取り残されても、一定時間後に「孤児」として回収し再処理できる。
//   (2) 未知 price id 等のリトライ不可能な失敗を 'failed' で確定し、再送ループを打ち切る。

// claim の結果。'retry_later' は「他が処理中かもしれない」ため 500 を返して Stripe 再送に委ねる。
type ClaimResult = 'claimed' | 'duplicate' | 'retry_later';

// processing のまま放置された行を「孤児（=処理プロセスが死んだ）」とみなす閾値。
// この webhook は maxDuration を設定しておらず関数寿命は十数秒程度なので、
// 5分を超えて processing の行は確実にプロセスが消えている。生存中ワーカーを誤って
// 奪わないため、閾値は関数の最大寿命より十分大きく取る。
// このルートに maxDuration を設定する場合は、必ずこの閾値もその寿命より十分大きく取り直すこと。
const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000;

// status 列が存在するスキーマ（本マイグレーション適用後）かどうか。
// マイグレーション適用前の本番にこのコードが出た場合、claim で列不在を検知したら
// false に倒し、旧方式（行の存在＝処理済み、失敗時 DELETE）へ自動縮退して webhook を落とさない。
// 全環境でマイグレーション適用が完了したら、このフォールバック分岐は削除してよい。
let statusColumnAvailable = true;

// PostgREST は未知列への書き込みで PGRST204、素の SQL 経由なら 42703 を返す。
function isMissingStatusColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const message = error.message ?? '';
  return message.includes('status') && message.includes('column');
}

// 冪等性の関所: event_id を 'processing' で INSERT（ON CONFLICT DO NOTHING）して処理権を獲得する。
// 衝突（既存行あり）時は行の状態を見て、処理済み/処理中/孤児/打ち切り済みを判定する。
async function claimStripeEvent(event: Stripe.Event): Promise<ClaimResult> {
  const admin = getSupabaseAdmin();

  // 並行 release により行が消えて claim をやり直す場合に備え、回数を制限してループする。
  for (let attempt = 0; attempt < 3; attempt++) {
    const insertPayload = {
      event_id: event.id,
      event_type: event.type,
      data: event.data,
      ...(statusColumnAvailable ? { status: 'processing' } : {}),
    };

    const { data: inserted, error: insertError } = await admin
      .from('stripe_events')
      .upsert(insertPayload, { onConflict: 'event_id', ignoreDuplicates: true })
      .select('event_id');

    if (insertError) {
      if (statusColumnAvailable && isMissingStatusColumn(insertError)) {
        logger.warn('stripe_events.status 列が無いため冪等性を旧方式へ縮退します:', event.id);
        statusColumnAvailable = false;
        continue; // status を外して再試行
      }
      logger.error('Failed to claim Stripe event idempotency:', insertError);
      throw new Error('[Stripe Webhook] Failed to claim event idempotency');
    }

    // 挿入できた（RETURNING に行が返る）= 新規イベント → 処理権を獲得。
    if (inserted && inserted.length > 0) {
      return 'claimed';
    }

    // ここに来る = event_id 衝突（既存行あり）。旧スキーマは状態を持たないので即スキップ。
    if (!statusColumnAvailable) {
      return 'duplicate';
    }

    const { data: existing, error: selectError } = await admin
      .from('stripe_events')
      .select('status, created_at')
      .eq('event_id', event.id)
      .maybeSingle();

    if (selectError) {
      logger.error('Failed to read existing Stripe event state:', selectError);
      throw new Error('[Stripe Webhook] Failed to read event state');
    }

    if (!existing) {
      continue; // 並行 release で行が消えた直後 → 再 claim を試みる
    }

    // (a) 処理完了済み → スキップ
    if (existing.status === 'processed') {
      return 'duplicate';
    }

    // (b) processing のまま → 孤児かどうかを経過時間で判定
    if (existing.status === 'processing') {
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      if (ageMs < ORPHAN_THRESHOLD_MS) {
        // まだ新しい = 別配信が処理中の可能性。ここで 200 スキップすると、もし相手が
        // kill 済みだった場合にイベントを永久に取りこぼす。非2xx を返して Stripe に再送させ、
        // 次の配信までに相手が完了(processed)するか孤児化(閾値超過)するのを待つ方が安全。
        return 'retry_later';
      }
      // 閾値超過 = プロセスは確実に死んでいる。created_at を現在時刻に更新して奪い返す。
      // WHERE に status='processing' と「閾値より古い created_at」を課すことで、
      // 同時に孤児を拾った別配信との競合を防ぐ（更新に成功した1つだけが処理権を得る）。
      const staleBefore = new Date(Date.now() - ORPHAN_THRESHOLD_MS).toISOString();
      const { data: reclaimed, error: reclaimError } = await admin
        .from('stripe_events')
        .update({ status: 'processing', created_at: new Date().toISOString() })
        .eq('event_id', event.id)
        .eq('status', 'processing')
        .lt('created_at', staleBefore)
        .select('event_id');

      if (reclaimError) {
        logger.error('Failed to reclaim orphaned Stripe event:', reclaimError);
        throw new Error('[Stripe Webhook] Failed to reclaim orphaned event');
      }
      if (reclaimed && reclaimed.length > 0) {
        logger.warn('Reclaimed orphaned Stripe event for reprocessing:', event.id);
        return 'claimed';
      }
      return 'duplicate'; // 競合に負けた = 他が奪って処理中
    }

    // (c) status === 'failed' = リトライ不可として打ち切り済み → スキップ
    return 'duplicate';
  }

  // 3回とも行が消え続けた異常系。二重処理を避けるため安全側（500・再送に委ねる）に倒す。
  logger.error('Stripe event claim exhausted retries:', event.id);
  throw new Error('[Stripe Webhook] Failed to claim event after retries');
}

// 処理成功を確定する。行を 'processed' にして以降の再送を確実にスキップさせる。
async function markStripeEventProcessed(eventId: string): Promise<void> {
  if (!statusColumnAvailable) {
    return; // 旧スキーマでは行が存在するだけで「処理済み」を意味する
  }
  const { error } = await getSupabaseAdmin()
    .from('stripe_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (error) {
    // マークに失敗しても業務処理自体は完了済みで 200 を返す。行は processing のまま残るが、
    // 成功済みイベントに Stripe が再送してくることは基本無いので実害は無い（ログのみ）。
    logger.error('Failed to mark Stripe event as processed:', eventId, error);
  }
}

// リトライ不可能な失敗を確定する。行を 'failed' で残し 200 を返すことで再送ループを打ち切る。
async function markStripeEventFailed(eventId: string): Promise<void> {
  if (!statusColumnAvailable) {
    // 旧スキーマでは status を持てない。行を残すと再送が常にスキップされ「失敗のまま沈黙」に
    // なるため、行を削除して Stripe 側の再送機会だけは残す（従来の release 相当）。
    await releaseStripeEvent(eventId);
    return;
  }
  const { error } = await getSupabaseAdmin()
    .from('stripe_events')
    .update({ status: 'failed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (error) {
    logger.error('Failed to mark Stripe event as failed:', eventId, error);
  }
}

// リトライ可能な失敗時に処理権を解放する。行を削除しないと再送が claim でスキップされ
// 取りこぼすため、DELETE して Stripe の自動再送に委ねる。
async function releaseStripeEvent(eventId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('stripe_events')
    .delete()
    .eq('event_id', eventId);

  if (error) {
    // 解放に失敗してもレスポンスは 500 のままにして Stripe 再送に委ねる（ログのみ）。
    logger.error('Failed to release Stripe event after processing failure:', eventId, error);
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

  // 冪等性の関所: イベントIDを先に 'processing' で INSERT（ON CONFLICT DO NOTHING）して
  // 「処理権」を獲得する。旧実装は check(存在確認)→処理→保存 の順だったため、同一イベントの
  // 並行配信時に両スレッドが存在確認をすり抜け、usage_count リセット等が二重実行されうった（TOCTOU）。
  // DB の一意制約をアトミックな関所にすることで二重処理を構造的に防ぐ。
  const claim = await claimStripeEvent(event);
  if (claim === 'duplicate') {
    logger.info('Duplicate event skipped:', event.id);
    return NextResponse.json({ received: true });
  }
  if (claim === 'retry_later') {
    // 直近に処理中（かもしれない）配信がある。取りこぼしを避けるため非2xx（409）を返し、
    // Stripe に再送させる。次の配信までに相手が完了(processed)するか孤児化するのを待つ。
    logger.info('Event is being processed by another delivery, asking Stripe to retry:', event.id);
    return NextResponse.json({ error: 'Event in progress, retry later' }, { status: 409 });
  }

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
          const customerId = getCustomerId(subscription.customer);
          const customerEmail = await getCustomerEmail(stripe, subscription.customer, session.customer_details?.email ?? null);
          const userId = await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id || session.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          });

          if (!userId) {
            logSkippedUnlinkedStripeEvent(`${event.type}:${subscriptionId}`, {
              customerId,
              customerEmail,
              sessionId: session.id,
              paymentLink: typeof session.payment_link === 'string' ? session.payment_link : null,
            });
            break;
          }

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
        const userId = await resolveUserIdFromStripe({
          explicitUserId: subscription.metadata?.supabase_user_id,
          customerId,
          customerEmail,
        });

        if (!userId) {
          logSkippedUnlinkedStripeEvent(`${event.type}:${subscription.id}`, {
            customerId,
            customerEmail,
            subscriptionId: subscription.id,
          });
          break;
        }

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
        const userId = await resolveUserIdFromStripe({
          explicitUserId: subscription.metadata?.supabase_user_id,
          customerId,
          customerEmail,
        });

        if (!userId) {
          logSkippedUnlinkedStripeEvent(`${event.type}:${subscription.id}`, {
            customerId,
            customerEmail,
            subscriptionId: subscription.id,
          });
          break;
        }

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
          const userId = await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          });

          if (!userId) {
            logSkippedUnlinkedStripeEvent(`${event.type}:${subscriptionId}`, {
              customerId,
              customerEmail,
              subscriptionId,
            });
            break;
          }

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
          const userId = await resolveUserIdFromStripe({
            explicitUserId: subscription.metadata?.supabase_user_id,
            customerId,
            customerEmail,
          });

          if (!userId) {
            logSkippedUnlinkedStripeEvent(`${event.type}:${subscriptionId}`, {
              customerId,
              customerEmail,
              subscriptionId,
            });
            break;
          }

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

    // 業務処理が成功したので処理権を 'processed' に確定し、以降の再送をスキップさせる。
    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);

    if (error instanceof NonRetryableWebhookError) {
      // リトライ不可能な失敗（例: 未知の price id）。再送しても直らないので 'failed' で確定し、
      // 200 を返して「500 → 再送 → また 500」の poison ループ（最大3日）を打ち切る。
      await markStripeEventFailed(event.id);
      return NextResponse.json({ received: true, skipped: 'non_retryable' });
    }

    // リトライで直りうる失敗 → 先頭で獲得した「処理権」を解放して 500 を返す。
    // これにより Stripe の自動再送で同じイベントを最初から再処理できる。
    await releaseStripeEvent(event.id);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

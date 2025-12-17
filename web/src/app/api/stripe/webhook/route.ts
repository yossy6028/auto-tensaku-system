import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_WEBHOOK_SECRET, getPlanIdFromStripePriceId } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('No stripe-signature header');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  console.log('Webhook event received:', event.type);

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
          const userId = subscription.metadata?.supabase_user_id || session.metadata?.supabase_user_id;
          
          if (!userId) {
            console.error('No user ID in subscription metadata');
            break;
          }

          const priceId = subscription.items.data[0]?.price?.id;
          const planId = getPlanIdFromStripePriceId(priceId || '') || 'light';
          
          // サブスクリプションをデータベースに保存
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: userId,
              plan_id: planId,
              status: 'active',
              usage_count: 0,
              usage_limit: PLAN_LIMITS[planId] || 10,
              price_paid: PLAN_PRICES[planId] || 980,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              purchased_at: new Date().toISOString(),
              expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            }, {
              onConflict: 'user_id',
            });

          if (error) {
            console.error('Failed to save subscription:', error);
          } else {
            console.log('Subscription saved successfully for user:', userId);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.supabase_user_id;
        
        if (!userId) {
          console.error('No user ID in subscription metadata');
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const planId = getPlanIdFromStripePriceId(priceId || '') || 'light';
        const status = subscription.status === 'active' ? 'active' : 
                       subscription.status === 'canceled' ? 'cancelled' : subscription.status;

        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_id: planId,
            status: status,
            usage_limit: PLAN_LIMITS[planId] || 10,
            price_paid: PLAN_PRICES[planId] || 980,
            stripe_price_id: priceId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Failed to update subscription:', error);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.supabase_user_id;
        
        if (!userId) break;

        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Failed to cancel subscription:', error);
        }
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
          const userId = subscription.metadata?.supabase_user_id;
          
          if (!userId) break;

          // 利用回数をリセット
          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({
              usage_count: 0,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          if (error) {
            console.error('Failed to reset usage:', error);
          }
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
          const userId = subscription.metadata?.supabase_user_id;
          
          if (!userId) break;

          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          if (error) {
            console.error('Failed to update subscription status:', error);
          }
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

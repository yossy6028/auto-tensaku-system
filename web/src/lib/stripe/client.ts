'use client';

import { loadStripe, Stripe } from '@stripe/stripe-js';

// クライアントサイド用Stripeインスタンス（シングルトン）
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error('Stripe publishable key is not configured');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

// Checkoutセッションにリダイレクトする
export async function redirectToCheckout(sessionId: string) {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  
  // Stripe.js v4+ではredirectToCheckoutの代わりにURLリダイレクトを使用
  // sessionIdからCheckout URLへリダイレクト
  // 注: 現在の実装ではAPIからURLを直接返しているため、この関数は使用していない
  const result = await (stripe as unknown as { redirectToCheckout: (opts: { sessionId: string }) => Promise<{ error?: Error }> }).redirectToCheckout({ sessionId });
  if (result.error) {
    throw result.error;
  }
}


import Stripe from 'stripe';

// サーバーサイド用Stripeインスタンス
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

// 料金プランIDのマッピング
// Stripeダッシュボードで作成したPrice IDをここに設定
export const STRIPE_PRICE_IDS = {
  light: process.env.STRIPE_PRICE_LIGHT_ID!,      // ライトプラン (¥980/月)
  standard: process.env.STRIPE_PRICE_STANDARD_ID!, // スタンダードプラン (¥2,980/月)
  unlimited: process.env.STRIPE_PRICE_UNLIMITED_ID!, // 無制限プラン (¥5,980/月)
} as const;

// プラン名からStripe Price IDを取得
export function getStripePriceId(planName: string): string | null {
  const normalizedName = planName.toLowerCase();
  
  if (normalizedName.includes('ライト') || normalizedName === 'light') {
    return STRIPE_PRICE_IDS.light;
  }
  if (normalizedName.includes('スタンダード') || normalizedName === 'standard') {
    return STRIPE_PRICE_IDS.standard;
  }
  if (normalizedName.includes('無制限') || normalizedName === 'unlimited') {
    return STRIPE_PRICE_IDS.unlimited;
  }
  
  return null;
}

// プラン名からDB用plan_idを取得
export function getPlanIdFromStripePriceId(stripePriceId: string): string | null {
  if (stripePriceId === STRIPE_PRICE_IDS.light) {
    return 'light';
  }
  if (stripePriceId === STRIPE_PRICE_IDS.standard) {
    return 'standard';
  }
  if (stripePriceId === STRIPE_PRICE_IDS.unlimited) {
    return 'unlimited';
  }
  
  return null;
}

// Webhook署名検証用シークレット
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;


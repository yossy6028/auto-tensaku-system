import Stripe from 'stripe';

// 環境変数の存在チェック（サーバーサイドのみ）
function getRequiredStripeEnv(key: string): string {
  const value = process.env[key];
  if (!value && typeof window === 'undefined') {
    console.error(`[Stripe] 必須の環境変数 ${key} が設定されていません`);
    // 空文字を返すとStripeインスタンス生成時にエラーになる
    return '';
  }
  return value || '';
}

const stripeSecretKey = getRequiredStripeEnv('STRIPE_SECRET_KEY');

// サーバーサイド用Stripeインスタンス（キーが空の場合は初期化を遅延）
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { typescript: true })
  : (null as unknown as Stripe); // 開発環境でStripeを使わない場合用

// 料金プランIDのマッピング
// Stripeダッシュボードで作成したPrice IDをここに設定
export const STRIPE_PRICE_IDS = {
  light: getRequiredStripeEnv('STRIPE_PRICE_LIGHT_ID'),      // ライトプラン (¥780/月)※期間限定
  standard: getRequiredStripeEnv('STRIPE_PRICE_STANDARD_ID'), // スタンダードプラン (¥1,980/月)※期間限定
  unlimited: getRequiredStripeEnv('STRIPE_PRICE_UNLIMITED_ID'), // 無制限プラン (¥4,980/月)※期間限定
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
export const STRIPE_WEBHOOK_SECRET = getRequiredStripeEnv('STRIPE_WEBHOOK_SECRET');


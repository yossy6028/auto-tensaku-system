import Stripe from 'stripe';

function getRequiredStripeEnv(key: string): string {
  const value = process.env[key];
  if (!value && typeof window === 'undefined') {
    console.error(`[Stripe] 必須の環境変数 ${key} が設定されていません`);
    return '';
  }
  return value || '';
}

function getStripeSecretKey(): string {
  return getRequiredStripeEnv('STRIPE_SECRET_KEY');
}

let stripeClient: Stripe | null = null;

/**
 * Lazy Stripe client getter.
 * ビルド時に即時初期化しないことで、環境変数未設定でもビルドを落とさない。
 */
export function getStripe(): Stripe {
  if (typeof window !== 'undefined') {
    throw new Error('[Stripe] getStripe() can only be used on server side.');
  }

  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error('[Stripe] STRIPE_SECRET_KEY is not set. Stripe API calls will fail.');
  }

  stripeClient = new Stripe(secretKey, { typescript: true });
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const STRIPE_PRICE_IDS = {
  light: getRequiredStripeEnv('STRIPE_PRICE_LIGHT_ID'),
  standard: getRequiredStripeEnv('STRIPE_PRICE_STANDARD_ID'),
  unlimited: getRequiredStripeEnv('STRIPE_PRICE_UNLIMITED_ID'),
} as const;

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

export const STRIPE_WEBHOOK_SECRET = getRequiredStripeEnv('STRIPE_WEBHOOK_SECRET');

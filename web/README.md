This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 環境変数のセットアップ

```bash
cp .env.local.example .env.local
```

以下の値を設定してください。

### Supabase

| 変数名 | 取得場所 |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ダッシュボード > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase ダッシュボード > Settings > API > `anon` `public` キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase ダッシュボード > Settings > API > `service_role` キー（Webhook処理で使用） |

### Stripe

| 変数名 | 取得場所 |
|--------|---------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [Stripeダッシュボード](https://dashboard.stripe.com/test/apikeys) > 開発者 > APIキー > 公開可能キー (`pk_test_...`) |
| `STRIPE_SECRET_KEY` | 同上 > シークレットキー (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | **ローカル開発**: `stripe listen --forward-to localhost:3000/api/stripe/webhook` 実行時に表示される `whsec_...` / **本番**: Stripeダッシュボード > 開発者 > Webhook > エンドポイント詳細 > 署名シークレット |
| `STRIPE_PRICE_LIGHT_ID` | Stripeダッシュボード > 商品カタログ > ライトプラン > 価格ID (`price_...`) |
| `STRIPE_PRICE_STANDARD_ID` | 同上 > スタンダードプラン > 価格ID |
| `STRIPE_PRICE_UNLIMITED_ID` | 同上 > 無制限プラン > 価格ID |

> **注意**: テスト環境では `pk_test_` / `sk_test_` 系キー、本番では `pk_live_` / `sk_live_` 系キーを使ってください。

### Gemini AI

| 変数名 | 取得場所 |
|--------|---------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |

詳細は [STRIPE_SETUP.md](./STRIPE_SETUP.md) を参照してください。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

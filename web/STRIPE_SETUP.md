# Stripe課金システム セットアップガイド

## 概要

このドキュメントでは、auto-tensaku-system のStripe課金システムのセットアップ手順を説明します。

## 1. 環境変数の設定

### 必要な環境変数

以下の環境変数を `.env.local` (ローカル開発) と Vercel の環境変数に設定してください。

```bash
# =================================
# Stripe API Keys
# =================================

# 公開可能キー（フロントエンド用）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx

# シークレットキー（サーバーサイド用）
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx

# Webhook署名シークレット
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# =================================
# Stripe Price IDs (商品価格ID)
# =================================

# ライトプラン (¥980/月, 10回)
STRIPE_PRICE_LIGHT_ID=price_xxxxxxxxxxxx

# スタンダードプラン (¥2,980/月, 30回)
STRIPE_PRICE_STANDARD_ID=price_xxxxxxxxxxxx

# 無制限プラン (¥5,980/月, 無制限)
STRIPE_PRICE_UNLIMITED_ID=price_xxxxxxxxxxxx
```

### APIキーの取得方法

1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. 「開発者」→「APIキー」を開く
3. 以下をコピー:
   - **公開可能キー** (`pk_test_xxx` または `pk_live_xxx`)
   - **シークレットキー** (`sk_test_xxx` または `sk_live_xxx`)

### Price IDの取得方法

1. Stripeダッシュボード →「商品」→「商品カタログ」
2. 各商品をクリック
3. 「価格」セクションで Price ID (`price_xxx`) をコピー

## 2. Stripe商品の作成

### 商品設定

Stripeダッシュボードで以下の3つの商品（サブスクリプション）を作成してください。

| プラン名 | 価格 | 請求周期 | 説明 |
|---------|------|---------|------|
| 自動添削システム【ライト】 | ¥980 | 月額 | 月10回まで採点可能 |
| 自動添削システム【スタンダード】 | ¥2,980 | 月額 | 月30回まで採点可能 |
| 自動添削システム【無制限】 | ¥5,980 | 月額 | 採点回数無制限 |

### 商品作成手順

1. Stripeダッシュボード →「商品」→「商品を作成」
2. 商品名: `自動添削システム【ライト】`
3. 価格情報:
   - 価格: `980`
   - 通貨: `JPY`
   - 請求期間: `月次`
   - 税種別: `General - Electronically Supplied Services` (電子サービス)
4. 「商品を保存」
5. 他の2プランも同様に作成

## 3. Webhook設定

### ローカル開発環境

#### Stripe CLIのインストール

```bash
# macOS (Homebrew)
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# その他: https://stripe.com/docs/stripe-cli
```

#### Webhookのリッスン

```bash
# Stripeにログイン
stripe login

# Webhookをローカルに転送
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**重要**: 出力される `whsec_xxx` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に設定してください。

### 本番環境 (Vercel)

1. Stripeダッシュボード →「開発者」→「Webhooks」
2. 「エンドポイントを追加」をクリック
3. エンドポイントURL: `https://your-domain.vercel.app/api/stripe/webhook`
4. リッスンするイベント:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. 「エンドポイントを追加」
6. 「署名シークレット」をコピーしてVercelの環境変数に設定

## 4. カスタマーポータル設定

### ポータルの有効化

1. Stripeダッシュボード →「設定」→「Billing」→「Customer Portal」
2. 以下を有効化:
   - サブスクリプションのキャンセル
   - サブスクリプションの一時停止（オプション）
   - プランの変更
   - 請求情報の更新
   - 支払い方法の更新
3. 「変更を保存」

### ポータルの日本語化

1. Customer Portal設定ページ
2. 「外観」セクション
3. 言語: `日本語` を選択

## 5. 動作確認

### テストモードでの確認

1. Stripeがテストモード (`pk_test_xxx`) であることを確認
2. テスト用カード番号: `4242 4242 4242 4242`
   - 有効期限: 将来の任意の日付
   - CVC: 任意の3桁
   - 郵便番号: 任意の数字
3. 決済フローをテスト:
   - 料金プランページでプランを選択
   - Checkoutページで決済を完了
   - Webhookが正常に処理されることを確認

### 確認ポイント

- [ ] Checkoutページが日本語で表示される
- [ ] 決済完了後、DBの`subscriptions`テーブルにレコードが作成される
- [ ] `user_profiles`テーブルに`stripe_customer_id`が保存される
- [ ] 利用状況ページでプラン情報が表示される
- [ ] カスタマーポータルでサブスクリプション管理ができる

## 6. 本番環境への移行

### チェックリスト

- [ ] StripeダッシュボードをLiveモードに切り替え
- [ ] Live APIキー (`pk_live_xxx`, `sk_live_xxx`) を取得
- [ ] Live環境で商品を作成し、Price IDを取得
- [ ] VercelにLive環境の環境変数を設定
- [ ] Live Webhookエンドポイントを設定
- [ ] テスト決済を実行（実際のカードで少額テスト）

## トラブルシューティング

### Webhookエラー: 署名検証失敗

**原因**: `STRIPE_WEBHOOK_SECRET` が正しくない

**解決策**:
- ローカル: `stripe listen` の出力から正しいシークレットをコピー
- 本番: Stripeダッシュボードのエンドポイント詳細から「署名シークレット」をコピー

### 決済後にDBが更新されない

**原因**: Webhookが受信されていない、またはエラーが発生

**解決策**:
1. Stripeダッシュボード →「開発者」→「イベント」で送信状況を確認
2. Vercelのログでエラーを確認
3. `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認

### カスタマーポータルが開かない

**原因**: `stripe_customer_id` がDBに保存されていない

**解決策**:
1. `user_profiles`テーブルの`stripe_customer_id`カラムを確認
2. 最初のCheckout時に顧客が作成されるまで待つ

## 関連ファイル

- `web/src/lib/stripe/config.ts` - Stripe設定
- `web/src/lib/stripe/client.ts` - クライアントサイドStripe
- `web/src/app/api/stripe/checkout/route.ts` - Checkout API
- `web/src/app/api/stripe/webhook/route.ts` - Webhook処理
- `web/src/app/api/stripe/portal/route.ts` - カスタマーポータルAPI
- `web/src/app/pricing/page.tsx` - 料金プランページ


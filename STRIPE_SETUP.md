# Stripe課金システム セットアップガイド

このドキュメントでは、auto-tensaku-systemにStripe課金システムを導入するための手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [Stripeアカウント設定](#stripeアカウント設定)
3. [商品・価格の作成](#商品価格の作成)
4. [環境変数の設定](#環境変数の設定)
5. [Webhookの設定](#webhookの設定)
6. [Supabaseマイグレーション](#supabaseマイグレーション)
7. [テスト方法](#テスト方法)
8. [本番環境への移行](#本番環境への移行)

---

## 前提条件

- Stripeアカウント（日本の事業者として登録）
- Vercelにデプロイされたアプリケーション
- Supabaseプロジェクト

---

## Stripeアカウント設定

### 1. Stripeアカウント作成

1. [Stripe](https://stripe.com/jp) にアクセス
2. 「今すぐ始める」をクリック
3. メールアドレスとパスワードを入力してアカウント作成
4. ビジネス情報を入力（後からでも可能）

### 2. 本人確認（本番環境で必要）

- 事業情報の入力
- 銀行口座の登録
- 本人確認書類のアップロード

---

## 商品・価格の作成

Stripeダッシュボードで以下の商品を作成してください。

### 1. 商品作成手順

1. Stripeダッシュボード → 「商品カタログ」
2. 「+ 商品を作成」をクリック

### 2. 作成する商品

#### ライトプラン
- **名前**: 自動添削システム【ライト】
- **価格**: ¥980/月（定期）
- **請求期間**: 毎月
- **メタデータ**: `plan_id: light`

#### スタンダードプラン
- **名前**: 自動添削システム【スタンダード】
- **価格**: ¥2,980/月（定期）
- **請求期間**: 毎月
- **メタデータ**: `plan_id: standard`

#### 無制限プラン
- **名前**: 自動添削システム【無制限】
- **価格**: ¥5,980/月（定期）
- **請求期間**: 毎月
- **メタデータ**: `plan_id: unlimited`

### 3. Price IDの取得

各価格を作成後、Price ID（`price_xxx...`形式）をメモしておきます。

---

## 環境変数の設定

### ローカル開発環境（.env.local）

```bash
# Stripe API Keys（テスト環境）
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe Price IDs
STRIPE_PRICE_LIGHT_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_STANDARD_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_UNLIMITED_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx

# Supabase Service Role Key（Webhook用）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Vercel環境変数

Vercelダッシュボード → Settings → Environment Variables で以下を設定:

| 変数名 | 説明 | 環境 |
|--------|------|------|
| `STRIPE_SECRET_KEY` | Stripe秘密鍵 | Production, Preview |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開鍵 | Production, Preview |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名シークレット | Production, Preview |
| `STRIPE_PRICE_LIGHT_ID` | ライトプランのPrice ID | Production, Preview |
| `STRIPE_PRICE_STANDARD_ID` | スタンダードプランのPrice ID | Production, Preview |
| `STRIPE_PRICE_UNLIMITED_ID` | 無制限プランのPrice ID | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロールキー | Production, Preview |

⚠️ **注意**: 本番環境では `sk_live_xxx`, `pk_live_xxx` のライブキーを使用してください。

---

## Webhookの設定

### 1. Stripeダッシュボードでのエンドポイント設定

1. Stripeダッシュボード → 開発者 → Webhooks
2. 「エンドポイントを追加」をクリック
3. 以下を設定:
   - **エンドポイントURL**: `https://your-domain.vercel.app/api/stripe/webhook`
   - **イベント**: 以下を選択
     - `checkout.session.completed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

### 2. Webhook Secretの取得

エンドポイント作成後、「署名シークレット」をクリックして `whsec_xxx...` をコピーします。

### 3. ローカル開発でのテスト

Stripe CLIを使用してローカルでWebhookをテストできます：

```bash
# Stripe CLIのインストール
brew install stripe/stripe-cli/stripe

# ログイン
stripe login

# Webhookのフォワーディング
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

表示されるWebhook Secretを `.env.local` に設定してください。

---

## Supabaseマイグレーション

### 1. マイグレーション実行

1. Supabaseダッシュボードにログイン
2. SQL Editor を開く
3. `supabase_migration_stripe.sql` の内容をコピー＆実行

### 2. 確認項目

- `user_profiles` テーブルに `stripe_customer_id` カラムが追加されている
- `subscriptions` テーブルに Stripe関連カラムが追加されている
- `stripe_events` テーブルが作成されている
- `get_stripe_subscription` 関数が作成されている

---

## テスト方法

### 1. テストカード

Stripeテスト環境では以下のカード番号を使用：

| カード番号 | 説明 |
|------------|------|
| `4242 4242 4242 4242` | 成功 |
| `4000 0000 0000 0341` | カード拒否 |
| `4000 0000 0000 9995` | 残高不足 |

- **有効期限**: 将来の任意の日付
- **CVC**: 任意の3桁
- **郵便番号**: 任意

### 2. テストフロー

1. 料金ページにアクセス
2. プランを選択
3. テストカードで決済
4. 成功ページにリダイレクトされることを確認
5. `/usage` ページでサブスクリプション状態を確認

### 3. Webhook テスト

```bash
# Stripe CLIでイベントをトリガー
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

---

## 本番環境への移行

### チェックリスト

- [ ] Stripeアカウントの本人確認完了
- [ ] 本番用APIキー（`sk_live_xxx`, `pk_live_xxx`）を取得
- [ ] 本番用の商品・価格を作成
- [ ] Vercel環境変数を本番用に更新
- [ ] 本番用Webhookエンドポイントを設定
- [ ] テスト決済を実施

### 環境変数の切り替え

```bash
# テスト環境 → 本番環境
STRIPE_SECRET_KEY=sk_live_xxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx (本番用)
STRIPE_PRICE_LIGHT_ID=price_xxxxxxxx (本番用)
STRIPE_PRICE_STANDARD_ID=price_xxxxxxxx (本番用)
STRIPE_PRICE_UNLIMITED_ID=price_xxxxxxxx (本番用)
```

---

## カスタマーポータル

### 設定方法

1. Stripeダッシュボード → 設定 → 顧客ポータル
2. 以下を有効化：
   - サブスクリプションのキャンセル
   - プランの変更
   - 支払い方法の更新
   - 請求履歴の表示

### 使用方法

ユーザーがサブスクリプション管理ページ（`/usage`など）からポータルにアクセスできます。

---

## トラブルシューティング

### Webhook が 400 エラーを返す

1. `STRIPE_WEBHOOK_SECRET` が正しく設定されているか確認
2. Webhookエンドポイントが正しいURLか確認
3. Stripeダッシュボードでイベントログを確認

### サブスクリプションが作成されない

1. `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認
2. メタデータに `supabase_user_id` が含まれているか確認
3. Vercelのログでエラーを確認

### 決済ページにリダイレクトされない

1. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` が正しいか確認
2. `STRIPE_PRICE_xxx_ID` が有効なPrice IDか確認
3. ブラウザのコンソールログを確認

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `web/src/lib/stripe/config.ts` | Stripe設定 |
| `web/src/lib/stripe/client.ts` | クライアント側Stripe |
| `web/src/app/api/stripe/checkout/route.ts` | Checkoutセッション作成 |
| `web/src/app/api/stripe/webhook/route.ts` | Webhookハンドラー |
| `web/src/app/api/stripe/portal/route.ts` | カスタマーポータル |
| `web/src/app/pricing/page.tsx` | 料金ページ |
| `supabase_migration_stripe.sql` | DBマイグレーション |

---

## サポート

問題が発生した場合：
1. Stripeダッシュボードのログを確認
2. Vercelのログを確認
3. Supabaseのログを確認
4. [Stripe公式ドキュメント](https://stripe.com/docs/ja)を参照


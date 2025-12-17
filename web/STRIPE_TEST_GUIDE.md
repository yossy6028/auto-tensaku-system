# Stripe課金システム テストガイド

このガイドでは、Stripe課金システムの動作をテストする手順を説明します。

## 📋 テスト前の確認事項

### 環境変数の確認

`.env.local` に以下が設定されていることを確認：

```bash
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Price IDs
STRIPE_PRICE_LIGHT_ID=price_xxx
STRIPE_PRICE_STANDARD_ID=price_xxx
STRIPE_PRICE_UNLIMITED_ID=price_xxx
```

### 必要なサービスの起動

1. **Next.js開発サーバー**
   ```bash
   cd web
   npm run dev
   ```

2. **Stripe CLI（Webhook転送用）**
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   - 別のターミナルで実行
   - `whsec_...` が表示されることを確認

---

## 🧪 テスト手順

### ステップ1: 料金ページの確認

1. ブラウザで http://localhost:3000/pricing にアクセス
2. 3つのプラン（ライト、スタンダード、無制限）が表示されることを確認
3. 各プランの価格が正しいことを確認

### ステップ2: ログイン

1. 右上の「ログイン」ボタンをクリック
2. 既存アカウントでログイン、または新規登録
3. ログイン後、ユーザーメニューが表示されることを確認

### ステップ3: プラン選択と決済

1. **プランを選択**
   - 料金ページで「このプランを選択」ボタンをクリック
   - 例: 「ライト」プラン（¥980/月）

2. **Stripe Checkoutページにリダイレクト**
   - Stripeの決済ページが表示されることを確認
   - 日本語で表示されていることを確認

3. **テストカードで決済**
   - **カード番号**: `4242 4242 4242 4242`
   - **有効期限**: 将来の任意の日付（例: 12/25）
   - **CVC**: 任意の3桁（例: 123）
   - **郵便番号**: 任意（例: 12345）
   - 「**支払いを完了**」をクリック

### ステップ4: 決済完了後の確認

1. **成功ページへのリダイレクト**
   - `/usage?checkout=success` にリダイレクトされることを確認
   - または、成功メッセージが表示されることを確認

2. **Webhookの動作確認**
   - Stripe CLIのターミナルでイベントが受信されることを確認
   - `checkout.session.completed` イベントが表示される

3. **データベースの確認**

   Supabaseダッシュボードで以下を確認：

   **user_profilesテーブル:**
   - `stripe_customer_id` が保存されている（`cus_...`）

   **subscriptionsテーブル:**
   - 新しいレコードが作成されている
   - `status` = `active`
   - `plan_id` = 選択したプラン（`light`, `standard`, `unlimited`）
   - `stripe_subscription_id` が保存されている（`sub_...`）
   - `usage_count` = 0
   - `usage_limit` = プランに応じた値（ライト: 10, スタンダード: 30, 無制限: null）

### ステップ5: 利用状況ページの確認

1. **利用状況ページにアクセス**
   - `/subscription` または `/usage` にアクセス
   - または、ユーザーメニューから「サブスクリプション管理」をクリック

2. **プラン情報の表示確認**
   - 現在のプラン名が表示される
   - 使用回数が表示される（無制限プランの場合は「無制限」）
   - 請求期間が表示される

3. **カスタマーポータルの確認**
   - 「支払い情報・プラン変更」ボタンをクリック
   - Stripeのカスタマーポータルが開くことを確認
   - 日本語で表示されることを確認

---

## 🧪 追加テストケース

### テストケース1: プラン変更

1. カスタマーポータルでプランを変更
2. Webhookで `customer.subscription.updated` が受信されることを確認
3. DBの `subscriptions` テーブルが更新されることを確認

### テストケース2: 支払い失敗

1. テストカード `4000 0000 0000 0341` で決済を試みる
2. エラーメッセージが表示されることを確認
3. Webhookで `invoice.payment_failed` が受信されることを確認

### テストケース3: サブスクリプションキャンセル

1. カスタマーポータルでサブスクリプションをキャンセル
2. Webhookで `customer.subscription.deleted` が受信されることを確認
3. DBの `subscriptions` テーブルの `status` が `cancelled` になることを確認

---

## ✅ チェックリスト

### 基本動作
- [ ] 料金ページが表示される
- [ ] プラン選択ボタンが動作する
- [ ] Stripe Checkoutページが表示される
- [ ] テストカードで決済が成功する
- [ ] 決済完了後にリダイレクトされる

### Webhook
- [ ] Stripe CLIでWebhookイベントが受信される
- [ ] `checkout.session.completed` が受信される
- [ ] Webhookエラーが発生しない

### データベース
- [ ] `user_profiles.stripe_customer_id` が保存される
- [ ] `subscriptions` テーブルにレコードが作成される
- [ ] プラン情報が正しく保存される

### UI
- [ ] 利用状況ページでプラン情報が表示される
- [ ] カスタマーポータルが開く
- [ ] エラーメッセージが適切に表示される

---

## 🐛 トラブルシューティング

### 問題1: Checkoutページが開かない

**症状**: プラン選択ボタンをクリックしても何も起こらない

**確認事項**:
- ブラウザのコンソールでエラーを確認
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` が正しく設定されているか
- ネットワークタブでAPIリクエストが送信されているか

**解決策**:
```bash
# 環境変数を確認
cd web
cat .env.local | grep STRIPE
```

### 問題2: Webhookが受信されない

**症状**: Stripe CLIでイベントが表示されない

**確認事項**:
- Stripe CLIが起動しているか
- `stripe listen --forward-to localhost:3000/api/stripe/webhook` が実行されているか
- Next.jsサーバーが起動しているか

**解決策**:
```bash
# Stripe CLIを再起動
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 問題3: DBにレコードが作成されない

**症状**: 決済は成功したが、DBにデータが保存されない

**確認事項**:
- Webhookが正常に受信されているか
- Supabaseのログでエラーがないか
- `SUPABASE_SERVICE_ROLE_KEY` が設定されているか（Webhook用）

**解決策**:
- Stripeダッシュボード → 開発者 → イベント でWebhookの送信状況を確認
- Vercelのログ（本番環境の場合）でエラーを確認

### 問題4: カスタマーポータルが開かない

**症状**: 「支払い情報・プラン変更」ボタンをクリックしても何も起こらない

**確認事項**:
- `stripe_customer_id` がDBに保存されているか
- ブラウザのコンソールでエラーを確認

**解決策**:
```sql
-- Supabaseで確認
SELECT id, email, stripe_customer_id 
FROM user_profiles 
WHERE id = 'your-user-id';
```

---

## 📊 テスト結果の記録

テスト実施日: _______________

| テスト項目 | 結果 | 備考 |
|----------|------|------|
| 料金ページ表示 | ☐ OK / ☐ NG | |
| プラン選択 | ☐ OK / ☐ NG | |
| Checkout表示 | ☐ OK / ☐ NG | |
| テスト決済 | ☐ OK / ☐ NG | |
| Webhook受信 | ☐ OK / ☐ NG | |
| DB保存 | ☐ OK / ☐ NG | |
| 利用状況表示 | ☐ OK / ☐ NG | |
| カスタマーポータル | ☐ OK / ☐ NG | |

---

## 🚀 本番環境でのテスト

本番環境（Vercel）でも同様のテストを実施：

1. **環境変数の確認**
   - Vercelダッシュボードで環境変数が設定されているか確認
   - Live APIキーを使用しているか確認

2. **Webhookエンドポイントの確認**
   - Stripeダッシュボードで本番用Webhookエンドポイントが作成されているか
   - エンドポイントURLが正しいか

3. **テスト決済の実行**
   - 本番環境でもテストモードで決済をテスト
   - または、少額の実際のカードでテスト

---

## 📝 参考

- [Stripeテストカード一覧](https://stripe.com/docs/testing)
- [Stripe Webhookテスト](https://stripe.com/docs/webhooks/test)
- [Stripe CLIドキュメント](https://stripe.com/docs/stripe-cli)


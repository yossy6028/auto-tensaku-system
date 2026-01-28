# 🔧 管理者クイックリファレンス

> 運用担当者向けの操作ガイド・トラブルシューティング集

---

## 目次

1. [日常運用](#1-日常運用)
2. [ユーザー管理](#2-ユーザー管理)
3. [トラブルシューティング](#3-トラブルシューティング)
4. [システム設定](#4-システム設定)

---

## 1. 日常運用

### 管理ダッシュボードへのアクセス

```
URL: https://[your-domain]/admin
```

管理者権限を持つアカウントでログイン後、アクセス可能。

### 確認すべき指標

| 指標 | 確認頻度 | 異常の目安 |
|------|----------|------------|
| 日次アクティブユーザー | 毎日 | 前日比50%以上の減少 |
| 採点エラー率 | 毎日 | 5%以上 |
| 平均レスポンス時間 | 週1回 | 30秒以上 |
| サブスク解約率 | 月1回 | 10%以上 |

---

## 2. ユーザー管理

### 新規ユーザー作成（Supabase）

1. [Supabaseダッシュボード](https://supabase.com/dashboard) にログイン
2. プロジェクト選択 → **Authentication** → **Users**
3. **Add User** → **Create New User**
4. 入力項目:
   - Email: ユーザーのメールアドレス
   - Password: 初期パスワード
   - ☑️ **Auto Confirm User** ← **重要！忘れずにチェック**
5. **Create User** をクリック

> ⚠️ 「Auto Confirm User」をチェックしないと、ユーザーがログインできません。

### トライアルアカウントの作成

トライアル日数・回数をカスタマイズしたい場合：

```sql
-- Supabase SQL Editor で実行
UPDATE user_profiles
SET
  trial_days_remaining = 14,      -- トライアル日数
  trial_usage_limit = 10,         -- トライアル採点回数
  trial_usage_count = 0           -- 使用回数リセット
WHERE user_id = 'ユーザーのUUID';
```

詳細は [TRIAL_ACCOUNTS.md](../TRIAL_ACCOUNTS.md) を参照。

### ユーザーのデバイス制限解除

デバイス制限でログインできないユーザーへの対応：

```sql
-- 特定ユーザーのデバイスを全削除
DELETE FROM user_devices
WHERE user_id = 'ユーザーのUUID';
```

または管理画面から：
1. Admin → Users → 該当ユーザーを検索
2. 「Devices」タブ → 削除したいデバイスを選択
3. 「Remove Device」

---

## 3. トラブルシューティング

### よくある問題と対処法

#### 採点が60秒以上かかる

**原因**: ファイルサイズが大きい / サーバー負荷

**対処**:
1. Vercelダッシュボードでfunction実行時間を確認
2. Fluid Compute設定を確認（300秒タイムアウト必須）
3. 画像圧縮設定が有効か確認

```bash
# Vercel設定確認
vercel env ls | grep -i timeout
```

#### Stripe Webhookがエラーを返す

**原因**: Webhook Secretの不一致 / エンドポイントURL誤り

**確認手順**:
1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) でWebhookを確認
2. Endpoint URLが `https://[domain]/api/stripe/webhook` か確認
3. Signing Secretを環境変数と照合

```bash
# 環境変数確認
vercel env ls | grep STRIPE_WEBHOOK_SECRET
```

#### ユーザーがログインできない

**チェックリスト**:
- [ ] Supabaseでユーザーが存在するか
- [ ] `email_confirmed_at` が設定されているか（NULLなら未確認）
- [ ] デバイス制限に達していないか

```sql
-- ユーザー状態確認
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'user@example.com';

-- デバイス数確認
SELECT COUNT(*) FROM user_devices
WHERE user_id = 'ユーザーUUID';
```

#### OCR精度が低い

**改善策**:
1. ユーザーに撮影のコツを案内（[使い方ガイド](./USER_GUIDE.md#撮影のコツ)）
2. スキャナー利用を推奨
3. 画像前処理パラメータの調整（要コード変更）

---

## 4. システム設定

### 環境変数一覧

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `GEMINI_API_KEY` | Gemini API認証 | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase接続 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase認証 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバーサイド操作 | ✅ |
| `STRIPE_SECRET_KEY` | Stripe決済 | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開キー | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Webhook検証 | ✅ |
| `STRIPE_PRICE_LIGHT_ID` | ライトプラン価格ID | ✅ |
| `STRIPE_PRICE_STANDARD_ID` | スタンダード価格ID | ✅ |
| `STRIPE_PRICE_UNLIMITED_ID` | 無制限プラン価格ID | ✅ |

### システム設定テーブル

Supabaseの `system_settings` テーブルで以下を制御：

| キー | デフォルト | 説明 |
|------|------------|------|
| `free_trial_days` | 7 | 無料トライアル日数 |
| `free_trial_usage_limit` | 5 | トライアル採点回数上限 |
| `max_devices_per_user` | 2 | 1ユーザーあたりのデバイス上限 |

```sql
-- 設定変更例: トライアル期間を14日に延長
UPDATE system_settings
SET value = '14'
WHERE key = 'free_trial_days';
```

### Vercel設定

| 設定項目 | 推奨値 | 理由 |
|----------|--------|------|
| Root Directory | `web` | Next.jsプロジェクトの場所 |
| Build Command | `npm run build` | 標準 |
| Output Directory | `.next` | 標準 |
| maxDuration | 300 | OCR/採点の処理時間確保 |
| Region | `hnd1` (Tokyo) | 日本ユーザー向け最適化 |

---

## クイックコマンド集

### ログ確認

```bash
# Vercel関数ログ（リアルタイム）
vercel logs --follow

# 特定のエンドポイントのみ
vercel logs | grep "/api/grade"
```

### データベース操作

```sql
-- 今日の採点数
SELECT COUNT(*) FROM grading_history
WHERE created_at >= CURRENT_DATE;

-- エラー率（過去7日）
SELECT
  COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*) as error_rate
FROM grading_history
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- アクティブサブスクリプション数
SELECT
  plan_id,
  COUNT(*)
FROM subscriptions
WHERE status = 'active'
GROUP BY plan_id;
```

### 緊急時対応

```bash
# サービス一時停止（Vercel）
vercel remove [deployment-url] --safe

# 最新デプロイにロールバック
vercel rollback
```

---

## 関連ドキュメント

- [デプロイガイド](../DEPLOY.md)
- [Stripeセットアップ](../STRIPE_SETUP.md)
- [トライアルアカウント作成](../TRIAL_ACCOUNTS.md)
- [ユーザー作成ガイド（詳細）](./SUPABASE_USER_CREATION_GUIDE.md)
- [サブスクリプション修正ガイド](./SUBSCRIPTION_FIX_GUIDE.md)

---

**最終更新**: 2025年1月

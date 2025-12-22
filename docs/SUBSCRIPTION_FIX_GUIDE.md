# サブスクリプション表示問題の根本解決ガイド

## 問題の概要

ライトプランに課金しているにもかかわらず、サブスクリプション管理画面で「有効なプランがありません」と表示される問題が発生していました。

## 根本原因（5 Whys分析）

### Why 1: なぜ「有効なプランがありません」と表示されるのか？
→ AuthProviderの`subscription`がnullまたは未定義だから

### Why 2: なぜ`subscription`が取得できないのか？
→ Supabaseの`subscriptions`テーブルから`status='active'`のレコードが取得できないから

### Why 3: なぜactiveなレコードが取得できないのか？
→ Stripe同期API（`/api/stripe/sync`）がサブスクリプションを正しくSupabaseに反映していないから

### Why 4: なぜStripe同期APIが正しく反映できないのか？
→ `upsert`の`onConflict: 'user_id'`が機能していないから

### Why 5（根本原因）: なぜ`onConflict: 'user_id'`が機能しないのか？
→ **subscriptionsテーブルの`user_id`カラムにユニーク制約が設定されていないため、upsertが常に新規挿入（INSERT）を行い、既存のactiveレコードを更新（UPDATE）しないから**

## 技術的詳細

### 問題の詳細

1. **データベース設計**: subscriptionsテーブルは「1ユーザーが複数のサブスクリプションを持てる」設計（user_idにユニーク制約なし）
2. **API実装**: Stripe同期APIは「1ユーザーが1つのサブスクリプションを持つ」前提で実装（`onConflict: 'user_id'`）

この不整合により：
- Stripe同期を実行するたびに新しいレコードが挿入される
- 古いactiveレコードが残り続ける
- 複数のactiveレコードが存在する可能性がある
- fetchSubscriptionが最初に見つけたレコードを返すが、それが最新のものとは限らない

### 修正内容

#### 1. Stripe同期APIの修正 (`web/src/app/api/stripe/sync/route.ts`)

**変更前**:
```typescript
const { error: upsertError } = await supabase
  .from('subscriptions')
  .upsert({ ... }, { onConflict: 'user_id' });
```

**変更後**:
```typescript
// 古いactiveサブスクリプションをcancelledに更新
await supabase
  .from('subscriptions')
  .update({ status: 'cancelled', updated_at: new Date().toISOString() })
  .eq('user_id', user.id)
  .eq('status', 'active')
  .neq('stripe_subscription_id', subscription.id);

// stripe_subscription_idでupsert
const { error: upsertError } = await supabase
  .from('subscriptions')
  .upsert({ ... }, { onConflict: 'stripe_subscription_id' });
```

#### 2. データベーススキーマの修正

`stripe_subscription_id`にユニーク制約を追加するマイグレーションを作成：
- ファイル: `supabase_migration_fix_subscription_unique.sql`
- 内容:
  - 重複データのクリーンアップ
  - `stripe_subscription_id`にユニーク制約を追加

## 解決手順

### ステップ1: マイグレーションの実行

Supabaseダッシュボードで以下のSQLを実行してください：

```bash
# ファイルの内容をSupabaseダッシュボードのSQL Editorで実行
cat supabase_migration_fix_subscription_unique.sql
```

または、Supabase CLIを使用：

```bash
supabase db push
```

### ステップ2: アプリケーションの再起動

```bash
cd web
npm run dev
```

### ステップ3: 動作確認

1. アプリケーションにログイン
2. サブスクリプション管理画面（`/subscription`）にアクセス
3. ライトプランが正しく表示されることを確認

### ステップ4: Stripe同期のテスト（オプション）

ブラウザのコンソールで以下を実行：

```javascript
fetch('/api/stripe/sync', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log('Sync result:', data));
```

## 期待される結果

- ✅ サブスクリプション管理画面でライトプランが表示される
- ✅ 使用回数と残り回数が正しく表示される
- ✅ Stripe同期を実行しても重複レコードが作成されない
- ✅ 古いactiveレコードは自動的にcancelledに更新される

## トラブルシューティング

### 問題1: マイグレーション実行時にエラーが発生する

**原因**: すでにユニーク制約が存在する可能性があります

**解決策**:
```sql
-- 既存の制約を確認
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'subscriptions'
  AND constraint_type = 'UNIQUE';

-- 既存の制約を削除（必要な場合）
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_stripe_subscription_id_unique;
```

### 問題2: サブスクリプションが依然として表示されない

**確認事項**:
1. マイグレーションが正しく実行されたか
2. Stripe同期APIが正しく動作しているか
3. RLSポリシーが正しく設定されているか

**デバッグ手順**:
```sql
-- 現在のサブスクリプションを確認
SELECT id, user_id, plan_id, status, stripe_subscription_id, created_at
FROM public.subscriptions
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

## 今後の改善提案

1. **Webhookの実装**: Stripe Webhookを実装し、サブスクリプションの変更をリアルタイムで反映
2. **定期的な同期**: cron jobで定期的にStripe同期を実行
3. **エラーハンドリングの強化**: Stripe同期エラーをログに記録し、管理者に通知
4. **テストの追加**: Stripe同期APIのユニットテストを追加

## 参考情報

- Supabase Upsert Documentation: https://supabase.com/docs/reference/javascript/upsert
- Stripe Subscriptions API: https://stripe.com/docs/api/subscriptions
- PostgreSQL Unique Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS

## 変更履歴

- 2025-12-18: 初版作成（根本原因の特定と解決策の実装）

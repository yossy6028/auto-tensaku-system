# マイグレーション実行手順

## 準備

### 1. DATABASE_URLの取得

1. https://app.supabase.com にアクセス
2. プロジェクト（kwvakmokxxtgguiyognn）を選択
3. 左メニューから「Settings」をクリック
4. 「Database」を選択
5. 「Connection string」セクションで「URI」をクリック
6. 表示された接続文字列をコピー
7. `[YOUR-PASSWORD]` の部分を実際のデータベースパスワードに置き換え

接続文字列の例：
```
postgresql://postgres:your-password@db.kwvakmokxxtgguiyognn.supabase.co:5432/postgres
```

⚠️ **注意**: データベースパスワードは、Supabaseプロジェクト作成時に設定したものです。もし忘れた場合は、Supabase Settings > Database > Database password からリセットできます。

## マイグレーション実行

### 方法1: 環境変数として指定（推奨）

```bash
# プロジェクトのルートディレクトリで実行
CONFIRM=yes DATABASE_URL="postgresql://postgres:your-password@db.kwvakmokxxtgguiyognn.supabase.co:5432/postgres" npx tsx scripts/run-migration.ts
```

### 方法2: .env.localに追加

1. `.env.local` ファイルを開く
2. 以下の行を追加：
   ```
   DATABASE_URL=postgresql://postgres:your-password@db.kwvakmokxxtgguiyognn.supabase.co:5432/postgres
   ```
3. 以下のコマンドを実行：
   ```bash
   CONFIRM=yes npx tsx scripts/run-migration.ts
   ```

## 実行結果の確認

スクリプトが成功すると、以下のような出力が表示されます：

```
🚀 マイグレーション実行を開始します...

📄 マイグレーションファイルを読み込み: /path/to/supabase_migration_fix_subscription_unique.sql
📊 マイグレーション内容:
  - 重複したstripe_subscription_idのクリーンアップ
  - stripe_subscription_idにユニーク制約を追加

🔄 データベースに接続中...

✅ データベースに接続しました

🔄 マイグレーションを実行中...

✅ マイグレーションが正常に完了しました！

🔍 制約が正しく追加されたか確認中...
✅ ユニーク制約が正常に追加されました: { constraint_name: 'subscriptions_stripe_subscription_id_unique', constraint_type: 'UNIQUE' }

🔍 重複データがないか確認中...
✅ 重複データはありません

✨ 次のステップ:
  1. アプリケーションを再起動: cd web && npm run dev
  2. サブスクリプション管理画面で動作確認
  3. Stripe同期APIをテスト: fetch('/api/stripe/sync', { method: 'POST' })
```

## トラブルシューティング

### エラー: 接続できません

**原因**: DATABASE_URLが正しくないか、ネットワークの問題

**解決策**:
1. DATABASE_URLのパスワードが正しいか確認
2. ネットワーク接続を確認
3. Supabaseのステータスページを確認: https://status.supabase.com

### エラー: ユニーク制約違反

**原因**: 既に同じstripe_subscription_idを持つレコードが複数存在する

**解決策**:
マイグレーションスクリプトが自動的に重複をクリーンアップしますが、エラーが発生する場合は、手動で重複を削除してください：

```sql
-- 重複を確認
SELECT stripe_subscription_id, COUNT(*) as cnt
FROM public.subscriptions
WHERE stripe_subscription_id IS NOT NULL
GROUP BY stripe_subscription_id
HAVING COUNT(*) > 1;

-- 古いレコードを手動で削除（最新のもの以外をcancelledに）
-- ⚠️ 実行前に必ず確認してください
```

### エラー: pgパッケージが見つかりません

**解決策**:
```bash
npm install --save-dev pg @types/pg tsx
```

## 代替方法: Supabaseダッシュボードから実行

スクリプト実行が困難な場合は、Supabaseダッシュボードから直接SQLを実行できます：

1. https://app.supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから「SQL Editor」をクリック
4. 新しいクエリを作成
5. `supabase_migration_fix_subscription_unique.sql` ファイルの内容をコピー＆ペースト
6. 「Run」をクリック

## 実行後の確認

### 1. アプリケーションの再起動

```bash
cd web
npm run dev
```

### 2. サブスクリプション管理画面で確認

1. ブラウザで http://localhost:3000/subscription にアクセス
2. ライトプランが表示されることを確認

### 3. Stripe同期のテスト（オプション）

ブラウザのコンソールで：
```javascript
fetch('/api/stripe/sync', { method: 'POST' })
  .then(res => res.json())
  .then(data => console.log('Sync result:', data));
```

## よくある質問

### Q: マイグレーションは何回実行できますか？

A: マイグレーションは冪等性があるため、何回実行しても安全です。既にユニーク制約が存在する場合は、エラーメッセージが表示されますが、データには影響しません。

### Q: 実行前にバックアップは必要ですか？

A: Supabaseは自動的にバックアップを取っていますが、重要なデータがある場合は、念のため手動でエクスポートすることをお勧めします。

Settings > Database > Database backups から確認できます。

### Q: ロールバックはできますか？

A: ユニーク制約を削除する場合は、以下のSQLを実行してください：

```sql
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_stripe_subscription_id_unique;
```

ただし、重複データのクリーンアップは元に戻せないため、注意してください。

# トライアルアカウント作成ガイド

## 📋 アカウント情報

以下の3つのトライアルアカウントを作成します：

| アカウント | メールアドレス | パスワード | トライアル期間 | 利用回数上限 |
|---------|------------|----------|------------|------------|
| アカウント1 | `trial1@example.com` | `Trial1@2024` | 5日間 | 15回 |
| アカウント2 | `trial2@example.com` | `Trial2@2024` | 5日間 | 15回 |
| アカウント3 | `trial3@example.com` | `Trial3@2024` | 5日間 | 15回 |

---

## 🚀 作成手順

### ステップ1: Supabaseダッシュボードでユーザーを作成

1. **Supabaseダッシュボードにアクセス**
   - https://app.supabase.com/ にログイン
   - プロジェクトを選択

2. **各アカウントを作成**
   - 左メニューから「**Authentication**」→「**Users**」を選択
   - 「**Add user**」ボタンをクリック
   - 「**Create new user**」を選択
   - 以下の情報を入力：
     - **Email**: `trial1@example.com`
     - **Password**: `Trial1@2024`
     - **Auto Confirm User**: ✅ **チェックを入れる**（重要：メール確認をスキップ）
   - 「**Create user**」をクリック
   - 同様に`trial2@example.com`と`trial3@example.com`も作成

### ステップ2: SQLでプロファイルを設定

1. **SQL Editorを開く**
   - 左メニューから「**SQL Editor**」を選択
   - 「**New query**」をクリック

2. **SQLスクリプトを実行**
   - `scripts/setup_trial_accounts.sql`の内容をコピー＆ペースト
   - 「**Run**」ボタンをクリック
   - 成功メッセージが表示されることを確認

### ステップ3: 確認

以下のSQLで作成されたアカウントを確認できます：

```sql
SELECT 
    u.email as "メールアドレス",
    up.free_trial_started_at as "トライアル開始日",
    up.free_trial_usage_count as "使用回数",
    up.custom_trial_days as "トライアル期間(日)",
    up.custom_trial_usage_limit as "利用回数上限",
    (up.free_trial_started_at + (COALESCE(up.custom_trial_days, 7) || ' days')::INTERVAL) as "トライアル終了日"
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE u.email IN ('trial1@example.com', 'trial2@example.com', 'trial3@example.com')
ORDER BY u.email;
```

---

## 🔧 自動化スクリプト（オプション）

Service Role Keyがある場合、Node.jsスクリプトで自動化できます：

```bash
# 環境変数を設定
export SUPABASE_URL="https://kwvakmokxxtgguiyognn.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# スクリプトを実行
cd web
node ../scripts/create_trial_accounts.js
```

**Service Role Keyの取得方法:**
- Supabaseダッシュボード → Settings → API
- 「service_role」キーをコピー（⚠️ 機密情報のため注意）

---

## ✅ 完了確認

以下の条件が満たされていれば完了です：

- [ ] 3つのユーザーが`auth.users`テーブルに存在する
- [ ] 各ユーザーの`user_profiles`に以下が設定されている：
  - `custom_trial_days = 5`
  - `custom_trial_usage_limit = 15`
  - `free_trial_started_at = 現在の日時`
  - `free_trial_usage_count = 0`

---

## 📝 注意事項

- パスワードは強力なもの（大文字・小文字・数字・記号を含む）を使用してください
- 「Auto Confirm User」にチェックを入れないと、メール確認が必要になります
- トライアル期間は作成日時から5日間です
- 利用回数は15回までです


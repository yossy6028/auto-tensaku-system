# トライアルアカウント情報

## 📋 アカウント情報（3セット）

### アカウント1
- **ID（メールアドレス）**: `trial1@example.com`
- **パスワード**: （管理者が設定 - 大文字・小文字・数字・記号を含む8文字以上）
- **トライアル期間**: 5日間
- **利用回数上限**: 15回

### アカウント2
- **ID（メールアドレス）**: `trial2@example.com`
- **パスワード**: （管理者が設定 - 大文字・小文字・数字・記号を含む8文字以上）
- **トライアル期間**: 5日間
- **利用回数上限**: 15回

### アカウント3
- **ID（メールアドレス）**: `trial3@example.com`
- **パスワード**: （管理者が設定 - 大文字・小文字・数字・記号を含む8文字以上）
- **トライアル期間**: 5日間
- **利用回数上限**: 15回

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
     - **Password**: （管理者が決めた強力なパスワード）
     - **Auto Confirm User**: ✅ **チェックを入れる**（重要：メール確認をスキップ）
   - 「**Create user**」をクリック
   - 同様に`trial2@example.com`と`trial3@example.com`も作成

### ステップ2: SQLでプロファイルを設定

1. **SQL Editorを開く**
   - 左メニューから「**SQL Editor**」を選択
   - 「**New query**」をクリック

2. **SQLスクリプトを実行**
   - `scripts/setup_trial_accounts.sql`の内容をコピー＆ペースト
   - または、以下のSQLを実行：

```sql
-- アカウント1のプロファイルを設定
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'trial1@example.com' 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO user_profiles (id, email, display_name, free_trial_started_at, free_trial_usage_count, custom_trial_days, custom_trial_usage_limit, updated_at)
        VALUES (v_user_id, 'trial1@example.com', 'トライアルユーザー1', NOW(), 0, 5, 15, NOW())
        ON CONFLICT (id) DO UPDATE SET
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW();
    END IF;
END $$;

-- アカウント2のプロファイルを設定
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'trial2@example.com' 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO user_profiles (id, email, display_name, free_trial_started_at, free_trial_usage_count, custom_trial_days, custom_trial_usage_limit, updated_at)
        VALUES (v_user_id, 'trial2@example.com', 'トライアルユーザー2', NOW(), 0, 5, 15, NOW())
        ON CONFLICT (id) DO UPDATE SET
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW();
    END IF;
END $$;

-- アカウント3のプロファイルを設定
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'trial3@example.com' 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO user_profiles (id, email, display_name, free_trial_started_at, free_trial_usage_count, custom_trial_days, custom_trial_usage_limit, updated_at)
        VALUES (v_user_id, 'trial3@example.com', 'トライアルユーザー3', NOW(), 0, 5, 15, NOW())
        ON CONFLICT (id) DO UPDATE SET
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW();
    END IF;
END $$;
```

3. **「Run」ボタンをクリック**

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












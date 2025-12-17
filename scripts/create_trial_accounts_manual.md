# トライアルアカウント作成手順

## 作成するアカウント情報

以下の3つのアカウントを作成してください：

### アカウント1
- **ID（メールアドレス）**: `trial1@example.com`
- **パスワード**: `Trial1@2024`
- **トライアル期間**: 5日間
- **利用回数上限**: 15回

### アカウント2
- **ID（メールアドレス）**: `trial2@example.com`
- **パスワード**: `Trial2@2024`
- **トライアル期間**: 5日間
- **利用回数上限**: 15回

### アカウント3
- **ID（メールアドレス）**: `trial3@example.com`
- **パスワード**: `Trial3@2024`
- **トライアル期間**: 5日間
- **利用回数上限**: 15回

---

## 作成方法

### 方法1: Supabaseダッシュボードで手動作成（推奨）

1. **Supabaseダッシュボードにログイン**
   - https://app.supabase.com/ にアクセス
   - プロジェクトを選択

2. **各アカウントを作成**
   - 左メニューから「Authentication」→「Users」を選択
   - 「Add user」→「Create new user」をクリック
   - メールアドレスとパスワードを入力
   - 「Auto Confirm User」にチェックを入れる（メール確認をスキップ）
   - 「Create user」をクリック

3. **プロファイルを更新**
   - 左メニューから「SQL Editor」を選択
   - 以下のSQLを実行：

```sql
-- アカウント1のプロファイルを更新
UPDATE user_profiles
SET 
    free_trial_started_at = NOW(),
    free_trial_usage_count = 0,
    custom_trial_days = 5,
    custom_trial_usage_limit = 15,
    updated_at = NOW()
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'trial1@example.com'
);

-- アカウント2のプロファイルを更新
UPDATE user_profiles
SET 
    free_trial_started_at = NOW(),
    free_trial_usage_count = 0,
    custom_trial_days = 5,
    custom_trial_usage_limit = 15,
    updated_at = NOW()
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'trial2@example.com'
);

-- アカウント3のプロファイルを更新
UPDATE user_profiles
SET 
    free_trial_started_at = NOW(),
    free_trial_usage_count = 0,
    custom_trial_days = 5,
    custom_trial_usage_limit = 15,
    updated_at = NOW()
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'trial3@example.com'
);
```

### 方法2: Node.jsスクリプトを使用（自動化）

1. **環境変数を設定**
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

2. **スクリプトを実行**
```bash
cd web
node ../scripts/create_trial_accounts.js
```

**注意**: Service Role Keyは機密情報です。環境変数に設定する際は、他のプロセスから見えないようにしてください。

---

## 確認方法

作成後、以下のSQLで確認できます：

```sql
SELECT 
    u.email,
    u.id as user_id,
    up.free_trial_started_at,
    up.free_trial_usage_count,
    up.custom_trial_days,
    up.custom_trial_usage_limit,
    up.free_trial_started_at + (COALESCE(up.custom_trial_days, 7) || ' days')::INTERVAL as trial_end_date
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
WHERE u.email IN ('trial1@example.com', 'trial2@example.com', 'trial3@example.com')
ORDER BY u.email;
```





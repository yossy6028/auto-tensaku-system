-- =====================================================
-- トライアルアカウント設定SQL
-- =====================================================
-- 
-- このSQLは、Supabaseダッシュボードで手動でユーザーを作成した後に実行してください
-- 
-- 手順:
-- 1. Supabaseダッシュボード → Authentication → Users で以下3つのユーザーを作成:
--    - trial1@example.com / Trial1@2024
--    - trial2@example.com / Trial2@2024
--    - trial3@example.com / Trial3@2024
--    各ユーザー作成時に「Auto Confirm User」にチェックを入れる
--
-- 2. このSQLをSupabaseダッシュボードのSQL Editorで実行
-- =====================================================

-- アカウント1のプロファイルを更新
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = 'trial1@example.com' 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- プロファイルが存在しない場合は作成
        INSERT INTO user_profiles (id, email, display_name, free_trial_started_at, free_trial_usage_count, custom_trial_days, custom_trial_usage_limit, updated_at)
        VALUES (v_user_id, 'trial1@example.com', 'トライアルユーザー1', NOW(), 0, 5, 15, NOW())
        ON CONFLICT (id) DO UPDATE SET
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW();
        
        RAISE NOTICE '✅ アカウント1を設定しました: trial1@example.com (ID: %)', v_user_id;
    ELSE
        RAISE NOTICE '⚠️  ユーザーが見つかりません: trial1@example.com - 先にSupabaseダッシュボードでユーザーを作成してください';
    END IF;
END $$;

-- アカウント2のプロファイルを更新
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
        
        RAISE NOTICE '✅ アカウント2を設定しました: trial2@example.com (ID: %)', v_user_id;
    ELSE
        RAISE NOTICE '⚠️  ユーザーが見つかりません: trial2@example.com - 先にSupabaseダッシュボードでユーザーを作成してください';
    END IF;
END $$;

-- アカウント3のプロファイルを更新
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
        
        RAISE NOTICE '✅ アカウント3を設定しました: trial3@example.com (ID: %)', v_user_id;
    ELSE
        RAISE NOTICE '⚠️  ユーザーが見つかりません: trial3@example.com - 先にSupabaseダッシュボードでユーザーを作成してください';
    END IF;
END $$;

-- 作成されたアカウントの確認
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











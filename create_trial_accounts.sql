-- =====================================================
-- トライアルアカウント作成スクリプト
-- 5日間、15回限定のトライアルアカウントを3つ作成
-- =====================================================
-- 
-- 使用方法:
-- 1. SupabaseダッシュボードのSQL Editorで実行
-- 2. または、Supabase CLIで実行: supabase db execute -f create_trial_accounts.sql
--
-- 注意: このスクリプトはSupabase Admin権限が必要です
-- =====================================================

-- トライアルアカウント1
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'trial1@example.com';
    -- パスワードはSupabaseダッシュボードで設定するため、ここでは使用しない
BEGIN
    -- auth.usersにユーザーを作成（Supabase Admin APIを使用する場合は別途実装が必要）
    -- 注意: auth.usersへの直接INSERTは通常できないため、
    -- SupabaseダッシュボードのAuthentication > Usersから手動で作成するか、
    -- Admin APIを使用してください
    
    -- ユーザーが既に存在する場合、user_profilesを更新
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = v_email 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- user_profilesを更新（カスタムトライアル設定）
        UPDATE user_profiles
        SET 
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW()
        WHERE id = v_user_id;
        
        RAISE NOTICE 'トライアルアカウント1を更新しました: % (ID: %)', v_email, v_user_id;
    ELSE
        RAISE NOTICE 'ユーザーが見つかりません: %. Supabaseダッシュボードで先にユーザーを作成してください。', v_email;
    END IF;
END $$;

-- トライアルアカウント2
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'trial2@example.com';
    -- パスワードはSupabaseダッシュボードで設定するため、ここでは使用しない
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = v_email 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        UPDATE user_profiles
        SET 
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW()
        WHERE id = v_user_id;
        
        RAISE NOTICE 'トライアルアカウント2を更新しました: % (ID: %)', v_email, v_user_id;
    ELSE
        RAISE NOTICE 'ユーザーが見つかりません: %. Supabaseダッシュボードで先にユーザーを作成してください。', v_email;
    END IF;
END $$;

-- トライアルアカウント3
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'trial3@example.com';
    -- パスワードはSupabaseダッシュボードで設定するため、ここでは使用しない
BEGIN
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = v_email 
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        UPDATE user_profiles
        SET 
            free_trial_started_at = NOW(),
            free_trial_usage_count = 0,
            custom_trial_days = 5,
            custom_trial_usage_limit = 15,
            updated_at = NOW()
        WHERE id = v_user_id;
        
        RAISE NOTICE 'トライアルアカウント3を更新しました: % (ID: %)', v_email, v_user_id;
    ELSE
        RAISE NOTICE 'ユーザーが見つかりません: %. Supabaseダッシュボードで先にユーザーを作成してください。', v_email;
    END IF;
END $$;

-- =====================================================
-- 作成されたアカウントの確認
-- =====================================================
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












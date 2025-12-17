-- =====================================================
-- 個別トライアル設定対応マイグレーション
-- =====================================================

-- user_profilesテーブルに個別トライアル設定カラムを追加
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS custom_trial_days INTEGER,
ADD COLUMN IF NOT EXISTS custom_trial_usage_limit INTEGER;

-- コメント追加
COMMENT ON COLUMN user_profiles.custom_trial_days IS '個別設定のトライアル期間（日数）。NULLの場合はシステム設定を使用';
COMMENT ON COLUMN user_profiles.custom_trial_usage_limit IS '個別設定のトライアル利用回数上限。NULLの場合はシステム設定を使用';

-- =====================================================
-- can_use_service関数を更新（カスタムトライアル対応）
-- =====================================================
CREATE OR REPLACE FUNCTION can_use_service(p_user_id UUID)
RETURNS TABLE (
    can_use BOOLEAN,
    message TEXT,
    usage_count INTEGER,
    usage_limit INTEGER,
    remaining_count INTEGER,
    plan_name TEXT
) AS $$
DECLARE
    v_profile user_profiles%ROWTYPE;
    v_subscription subscriptions%ROWTYPE;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
    v_free_trial_days INTEGER;
    v_free_trial_usage_limit INTEGER;
    v_trial_end_date TIMESTAMPTZ;
BEGIN
    -- システム設定を取得
    SELECT (value = 'true') INTO v_free_access_enabled
    FROM system_settings WHERE key = 'free_access_enabled';
    
    SELECT CASE WHEN value = 'null' OR value IS NULL THEN NULL 
           ELSE REPLACE(value, '"', '')::TIMESTAMPTZ END INTO v_free_access_until
    FROM system_settings WHERE key = 'free_access_until';
    
    SELECT COALESCE(value::INTEGER, 7) INTO v_free_trial_days
    FROM system_settings WHERE key = 'free_trial_days';
    
    SELECT COALESCE(value::INTEGER, 3) INTO v_free_trial_usage_limit
    FROM system_settings WHERE key = 'free_trial_usage_limit';

    -- 期間限定無料開放チェック
    IF v_free_access_enabled AND (v_free_access_until IS NULL OR v_free_access_until > NOW()) THEN
        RETURN QUERY SELECT 
            true,
            '期間限定無料開放中です！'::TEXT,
            0::INTEGER,
            NULL::INTEGER,
            NULL::INTEGER,
            '無料開放'::TEXT;
        RETURN;
    END IF;

    -- ユーザープロファイル取得
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN QUERY SELECT 
            false,
            'ユーザープロファイルが見つかりません。'::TEXT,
            0::INTEGER,
            0::INTEGER,
            0::INTEGER,
            NULL::TEXT;
        RETURN;
    END IF;

    -- アクティブなサブスクリプション取得
    SELECT * INTO v_subscription 
    FROM subscriptions 
    WHERE user_id = p_user_id 
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY purchased_at DESC
    LIMIT 1;

    -- サブスクリプションがある場合
    IF v_subscription IS NOT NULL THEN
        -- 無制限プランの場合
        IF v_subscription.usage_limit IS NULL THEN
            RETURN QUERY SELECT 
                true,
                '無制限プランをご利用中です。'::TEXT,
                v_subscription.usage_count,
                NULL::INTEGER,
                NULL::INTEGER,
                (SELECT name FROM pricing_plans WHERE id = v_subscription.plan_id);
            RETURN;
        END IF;

        -- 回数制限プランの場合
        IF v_subscription.usage_count < v_subscription.usage_limit THEN
            RETURN QUERY SELECT 
                true,
                format('残り%s回利用可能です。', v_subscription.usage_limit - v_subscription.usage_count)::TEXT,
                v_subscription.usage_count,
                v_subscription.usage_limit,
                v_subscription.usage_limit - v_subscription.usage_count,
                (SELECT name FROM pricing_plans WHERE id = v_subscription.plan_id);
            RETURN;
        ELSE
            RETURN QUERY SELECT 
                false,
                '利用回数の上限に達しました。新しいプランを購入してください。'::TEXT,
                v_subscription.usage_count,
                v_subscription.usage_limit,
                0::INTEGER,
                (SELECT name FROM pricing_plans WHERE id = v_subscription.plan_id);
            RETURN;
        END IF;
    END IF;

    -- 個別トライアル設定がある場合はそれを使用、なければシステム設定を使用
    IF v_profile.custom_trial_days IS NOT NULL THEN
        v_free_trial_days := v_profile.custom_trial_days;
    END IF;
    
    IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
        v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
    END IF;

    -- 無料体験期間チェック
    v_trial_end_date := v_profile.free_trial_started_at + (v_free_trial_days || ' days')::INTERVAL;
    
    IF NOW() < v_trial_end_date THEN
        IF v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
            RETURN QUERY SELECT 
                true,
                format('無料体験中です（残り%s回、%s日まで）', 
                       v_free_trial_usage_limit - v_profile.free_trial_usage_count,
                       to_char(v_trial_end_date, 'MM/DD'))::TEXT,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                v_free_trial_usage_limit - v_profile.free_trial_usage_count,
                '無料体験'::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT 
                false,
                '無料体験の利用回数上限に達しました。プランを購入してください。'::TEXT,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                0::INTEGER,
                '無料体験'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 無料体験期間終了
    RETURN QUERY SELECT 
        false,
        '無料体験期間が終了しました。プランを購入してください。'::TEXT,
        v_profile.free_trial_usage_count,
        v_free_trial_usage_limit,
        0::INTEGER,
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;





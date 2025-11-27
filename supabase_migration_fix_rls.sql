-- =====================================================
-- RLSポリシー修正 - 無限再帰問題の解消
-- =====================================================
-- 問題: user_profilesへのアクセス時に、管理者チェックで
-- 再度user_profilesを参照するため無限再帰が発生
-- 
-- 解決策: 管理者チェックを削除し、シンプルなポリシーに変更
-- 管理者機能はSECURITY DEFINER付きのRPC関数で実装済み
-- =====================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "pricing_plans_select" ON pricing_plans;
DROP POLICY IF EXISTS "pricing_plans_admin" ON pricing_plans;
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
DROP POLICY IF EXISTS "usage_logs_select" ON usage_logs;
DROP POLICY IF EXISTS "usage_logs_insert" ON usage_logs;
DROP POLICY IF EXISTS "system_settings_select" ON system_settings;
DROP POLICY IF EXISTS "system_settings_admin" ON system_settings;

-- =====================================================
-- 新しいRLSポリシー（再帰なし）
-- =====================================================

-- pricing_plans: 全員読み取り可能
CREATE POLICY "pricing_plans_select" ON pricing_plans 
    FOR SELECT USING (true);

-- pricing_plans: 認証済みユーザーは全操作可能（管理機能はアプリ側で制御）
CREATE POLICY "pricing_plans_all" ON pricing_plans 
    FOR ALL USING (auth.role() = 'authenticated');

-- user_profiles: 自分のプロファイルのみアクセス可能（シンプル化）
CREATE POLICY "user_profiles_select" ON user_profiles 
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "user_profiles_update" ON user_profiles 
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "user_profiles_insert" ON user_profiles 
    FOR INSERT WITH CHECK (id = auth.uid());

-- subscriptions: 自分のサブスクリプションのみアクセス可能
CREATE POLICY "subscriptions_select" ON subscriptions 
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "subscriptions_insert" ON subscriptions 
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_update" ON subscriptions 
    FOR UPDATE USING (user_id = auth.uid());

-- usage_logs: 自分のログのみアクセス可能
CREATE POLICY "usage_logs_select" ON usage_logs 
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "usage_logs_insert" ON usage_logs 
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- system_settings: 全員読み取り可能
CREATE POLICY "system_settings_select" ON system_settings 
    FOR SELECT USING (true);

-- system_settings: 認証済みユーザーは全操作可能（管理機能はアプリ側で制御）
CREATE POLICY "system_settings_all" ON system_settings 
    FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- 管理者用RPC関数（SECURITY DEFINERでRLSをバイパス）
-- =====================================================

-- 管理者チェック関数
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM user_profiles WHERE id = p_user_id;
    RETURN v_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 全ユーザープロファイル取得（管理者用）
CREATE OR REPLACE FUNCTION get_all_user_profiles()
RETURNS SETOF user_profiles AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF NOT is_admin(v_user_id) THEN
        RAISE EXCEPTION 'Permission denied: admin access required';
    END IF;
    
    RETURN QUERY SELECT * FROM user_profiles ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 全サブスクリプション取得（管理者用）
CREATE OR REPLACE FUNCTION get_all_subscriptions()
RETURNS SETOF subscriptions AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF NOT is_admin(v_user_id) THEN
        RAISE EXCEPTION 'Permission denied: admin access required';
    END IF;
    
    RETURN QUERY SELECT * FROM subscriptions ORDER BY purchased_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 全利用ログ取得（管理者用）
CREATE OR REPLACE FUNCTION get_all_usage_logs()
RETURNS SETOF usage_logs AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF NOT is_admin(v_user_id) THEN
        RAISE EXCEPTION 'Permission denied: admin access required';
    END IF;
    
    RETURN QUERY SELECT * FROM usage_logs ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- can_use_service関数を更新（access_typeを追加）
-- =====================================================
DROP FUNCTION IF EXISTS can_use_service(UUID);

CREATE OR REPLACE FUNCTION can_use_service(p_user_id UUID)
RETURNS TABLE (
    can_use BOOLEAN,
    message TEXT,
    usage_count INTEGER,
    usage_limit INTEGER,
    remaining_count INTEGER,
    plan_name TEXT,
    access_type TEXT
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
    -- ユーザープロファイル取得（管理者チェック用）
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
    
    -- 管理者の場合は無制限アクセス
    IF v_profile IS NOT NULL AND v_profile.role = 'admin' THEN
        RETURN QUERY SELECT 
            true,
            '管理者アカウント: 無制限で利用可能です。'::TEXT,
            0::INTEGER,
            NULL::INTEGER,
            NULL::INTEGER,
            '管理者プラン'::TEXT,
            'admin'::TEXT;
        RETURN;
    END IF;

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
            '無料開放'::TEXT,
            'promo'::TEXT;
        RETURN;
    END IF;

    IF v_profile IS NULL THEN
        RETURN QUERY SELECT 
            false,
            'ユーザープロファイルが見つかりません。'::TEXT,
            0::INTEGER,
            0::INTEGER,
            0::INTEGER,
            NULL::TEXT,
            'none'::TEXT;
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
                (SELECT name FROM pricing_plans WHERE id = v_subscription.plan_id),
                'subscription'::TEXT;
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
                (SELECT name FROM pricing_plans WHERE id = v_subscription.plan_id),
                'subscription'::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT 
                false,
                '利用回数の上限に達しました。新しいプランを購入してください。'::TEXT,
                v_subscription.usage_count,
                v_subscription.usage_limit,
                0::INTEGER,
                (SELECT name FROM pricing_plans WHERE id = v_subscription.plan_id),
                'subscription'::TEXT;
            RETURN;
        END IF;
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
                '無料体験'::TEXT,
                'trial'::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT 
                false,
                '無料体験の利用回数上限に達しました。プランを購入してください。'::TEXT,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                0::INTEGER,
                '無料体験'::TEXT,
                'trial'::TEXT;
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
        NULL::TEXT,
        'none'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- check_free_access関数も更新
-- =====================================================
CREATE OR REPLACE FUNCTION check_free_access(p_user_id UUID)
RETURNS TABLE (
    has_free_access BOOLEAN,
    free_access_type TEXT,
    message TEXT,
    trial_days_remaining INTEGER,
    trial_usage_remaining INTEGER,
    promo_end_date TIMESTAMPTZ
) AS $$
DECLARE
    v_profile user_profiles%ROWTYPE;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
    v_free_trial_days INTEGER;
    v_free_trial_usage_limit INTEGER;
    v_trial_end_date TIMESTAMPTZ;
    v_has_subscription BOOLEAN;
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
            'promo'::TEXT,
            '期間限定無料開放中です！'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            v_free_access_until;
        RETURN;
    END IF;

    -- ユーザープロファイル取得
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN QUERY SELECT 
            false,
            'none'::TEXT,
            'ユーザープロファイルが見つかりません。'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- アクティブなサブスクリプションがあるかチェック
    SELECT EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE user_id = p_user_id 
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_subscription;

    -- サブスクリプションがある場合は無料アクセスではない
    IF v_has_subscription THEN
        RETURN QUERY SELECT 
            false,
            'none'::TEXT,
            '有料プランをご利用中です。'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 無料体験期間チェック
    v_trial_end_date := v_profile.free_trial_started_at + (v_free_trial_days || ' days')::INTERVAL;
    
    IF NOW() < v_trial_end_date THEN
        IF v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
            RETURN QUERY SELECT 
                true,
                'trial'::TEXT,
                format('無料体験中です（残り%s回）', v_free_trial_usage_limit - v_profile.free_trial_usage_count)::TEXT,
                EXTRACT(DAY FROM v_trial_end_date - NOW())::INTEGER,
                v_free_trial_usage_limit - v_profile.free_trial_usage_count,
                NULL::TIMESTAMPTZ;
            RETURN;
        ELSE
            RETURN QUERY SELECT 
                false,
                'expired'::TEXT,
                '無料体験の利用回数上限に達しました。'::TEXT,
                EXTRACT(DAY FROM v_trial_end_date - NOW())::INTEGER,
                0::INTEGER,
                NULL::TIMESTAMPTZ;
            RETURN;
        END IF;
    END IF;

    -- 無料体験期間終了
    RETURN QUERY SELECT 
        false,
        'expired'::TEXT,
        '無料体験期間が終了しました。'::TEXT,
        0::INTEGER,
        0::INTEGER,
        NULL::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


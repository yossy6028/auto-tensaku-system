-- =====================================================
-- 個別トライアル設定対応マイグレーション
-- 更新日: 2024-12-21
-- =====================================================
--
-- このマイグレーションは以下を行います:
-- 1. user_profilesにcustom_trial_days, custom_trial_usage_limitカラムを追加
-- 2. check_free_access関数をカスタムトライアル対応に更新
-- 3. can_use_service関数を管理者チェック+カスタムトライアル対応に更新
--
-- 実行順序: supabase_migration.sql → supabase_migration_stripe.sql → このファイル
-- =====================================================

-- =====================================================
-- 1. user_profilesテーブルに個別トライアル設定カラムを追加
-- =====================================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS custom_trial_days INTEGER,
ADD COLUMN IF NOT EXISTS custom_trial_usage_limit INTEGER;

COMMENT ON COLUMN user_profiles.custom_trial_days IS '個別設定のトライアル期間（日数）。NULLの場合はシステム設定を使用';
COMMENT ON COLUMN user_profiles.custom_trial_usage_limit IS '個別設定のトライアル利用回数上限。NULLの場合はシステム設定を使用';

-- =====================================================
-- 2. check_free_access関数を更新（カスタムトライアル対応）
-- =====================================================
-- 注意: 戻り値の型が変わる場合はDROP FUNCTIONが必要
DROP FUNCTION IF EXISTS check_free_access(uuid);

CREATE OR REPLACE FUNCTION check_free_access(p_user_id UUID)
RETURNS TABLE (
    has_free_access BOOLEAN,
    free_access_type TEXT,
    message TEXT,
    trial_days_remaining INTEGER,
    trial_usage_remaining INTEGER,
    free_access_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile user_profiles%ROWTYPE;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
    v_free_trial_days INTEGER;
    v_free_trial_usage_limit INTEGER;
    v_trial_end TIMESTAMPTZ;
    v_has_subscription BOOLEAN;
BEGIN
    -- システム設定を取得
    SELECT (value = 'true') INTO v_free_access_enabled FROM system_settings WHERE key = 'free_access_enabled';
    SELECT CASE WHEN value = 'null' THEN NULL ELSE value::TIMESTAMPTZ END INTO v_free_access_until FROM system_settings WHERE key = 'free_access_until';
    SELECT COALESCE(value::INTEGER, 7) INTO v_free_trial_days FROM system_settings WHERE key = 'free_trial_days';
    SELECT COALESCE(value::INTEGER, 3) INTO v_free_trial_usage_limit FROM system_settings WHERE key = 'free_trial_usage_limit';

    -- 期間限定無料開放チェック
    IF v_free_access_enabled AND (v_free_access_until IS NULL OR v_free_access_until > NOW()) THEN
        RETURN QUERY SELECT true, 'promo'::TEXT, '期間限定無料開放中！'::TEXT, NULL::INTEGER, NULL::INTEGER, v_free_access_until;
        RETURN;
    END IF;

    -- ユーザープロファイル取得
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
    IF v_profile IS NULL THEN
        RETURN QUERY SELECT false, 'none'::TEXT, 'プロファイルなし'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- アクティブなサブスクリプションがあれば無料アクセスは不要
    SELECT EXISTS (SELECT 1 FROM subscriptions WHERE user_id = p_user_id AND status = 'active') INTO v_has_subscription;
    IF v_has_subscription THEN
        RETURN QUERY SELECT false, 'none'::TEXT, 'サブスクリプションあり'::TEXT, NULL::INTEGER, NULL::INTEGER, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- ★ カスタムトライアル設定を優先
    IF v_profile.custom_trial_days IS NOT NULL THEN
        v_free_trial_days := v_profile.custom_trial_days;
    END IF;
    IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
        v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
    END IF;

    -- 無料体験期間計算
    v_trial_end := v_profile.free_trial_started_at + (v_free_trial_days || ' days')::INTERVAL;

    -- 無料体験チェック
    IF NOW() < v_trial_end AND v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
        RETURN QUERY SELECT
            true,
            'trial'::TEXT,
            format('無料体験中（残り%s回、%sまで）', v_free_trial_usage_limit - v_profile.free_trial_usage_count, to_char(v_trial_end, 'MM/DD'))::TEXT,
            EXTRACT(DAY FROM v_trial_end - NOW())::INTEGER,
            v_free_trial_usage_limit - v_profile.free_trial_usage_count,
            v_trial_end;
        RETURN;
    END IF;

    -- 無料体験終了
    RETURN QUERY SELECT false, 'expired'::TEXT, '無料体験終了'::TEXT, 0::INTEGER, 0::INTEGER, v_trial_end;
END;
$$;

-- =====================================================
-- 3. can_use_service関数を更新（管理者チェック+カスタムトライアル対応）
-- =====================================================
-- 重要: この関数は以下の順序でチェックを行う
-- 1. 管理者チェック（最優先）
-- 2. check_free_access（無料開放・トライアル）
-- 3. サブスクリプションチェック
-- 4. 無料体験チェック（フォールバック）
-- =====================================================
DROP FUNCTION IF EXISTS can_use_service(uuid);

CREATE OR REPLACE FUNCTION public.can_use_service(p_user_id UUID)
RETURNS TABLE (
    can_use BOOLEAN,
    message TEXT,
    usage_count INTEGER,
    usage_limit INTEGER,
    remaining_count INTEGER,
    plan_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_profile user_profiles%ROWTYPE;
    v_free_trial_days INTEGER;
    v_free_trial_usage_limit INTEGER;
    v_trial_end_date TIMESTAMPTZ;
BEGIN
    -- ★ 1. 管理者チェック（最優先）
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = p_user_id;

    IF v_is_admin THEN
        RETURN QUERY SELECT
            TRUE,
            '管理者はサービスを無制限に利用できます'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::INTEGER,
            'admin'::TEXT;
        RETURN;
    END IF;

    -- ★ 2. check_free_access（無料開放・トライアル）
    DECLARE v_free_access RECORD;
    BEGIN
        SELECT * INTO v_free_access FROM public.check_free_access(p_user_id);
        IF v_free_access.has_free_access THEN
            RETURN QUERY SELECT
                TRUE,
                v_free_access.message,
                NULL::INTEGER,
                NULL::INTEGER,
                v_free_access.trial_usage_remaining::INTEGER,
                v_free_access.free_access_type;
            RETURN;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- check_free_access関数がない場合は無視
    END;

    -- ★ 3. サブスクリプションチェック
    SELECT s.*, pp.name as plan_name INTO v_subscription
    FROM public.subscriptions s
    LEFT JOIN public.pricing_plans pp ON s.plan_id = pp.id
    WHERE s.user_id = p_user_id AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1;

    IF FOUND THEN
        -- Stripe期限切れチェック
        IF v_subscription.stripe_subscription_id IS NOT NULL
            AND v_subscription.current_period_end IS NOT NULL
            AND v_subscription.current_period_end < NOW() THEN
            RETURN QUERY SELECT
                FALSE,
                'サブスクリプションの有効期限が切れています。'::TEXT,
                v_subscription.usage_count,
                v_subscription.usage_limit,
                0::INTEGER,
                v_subscription.plan_name;
            RETURN;
        END IF;

        -- 使用回数上限チェック
        IF v_subscription.usage_limit IS NOT NULL
            AND v_subscription.usage_count >= v_subscription.usage_limit THEN
            RETURN QUERY SELECT
                FALSE,
                '今月の採点回数上限に達しました。'::TEXT,
                v_subscription.usage_count,
                v_subscription.usage_limit,
                0::INTEGER,
                v_subscription.plan_name;
            RETURN;
        END IF;

        -- 利用可能
        RETURN QUERY SELECT
            TRUE,
            'サービスを利用できます'::TEXT,
            v_subscription.usage_count,
            v_subscription.usage_limit,
            CASE WHEN v_subscription.usage_limit IS NULL THEN NULL
                 ELSE v_subscription.usage_limit - v_subscription.usage_count END,
            v_subscription.plan_name;
        RETURN;
    END IF;

    -- ★ 4. 無料体験チェック（フォールバック）
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;

    IF v_profile IS NOT NULL AND v_profile.free_trial_started_at IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 7) INTO v_free_trial_days FROM system_settings WHERE key = 'free_trial_days';
        SELECT COALESCE(value::INTEGER, 3) INTO v_free_trial_usage_limit FROM system_settings WHERE key = 'free_trial_usage_limit';

        -- カスタム設定を優先
        IF v_profile.custom_trial_days IS NOT NULL THEN
            v_free_trial_days := v_profile.custom_trial_days;
        END IF;
        IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
            v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
        END IF;

        v_trial_end_date := v_profile.free_trial_started_at + (v_free_trial_days || ' days')::INTERVAL;

        IF NOW() < v_trial_end_date THEN
            IF v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
                RETURN QUERY SELECT
                    TRUE,
                    format('無料体験中です（残り%s回、%sまで）', v_free_trial_usage_limit - v_profile.free_trial_usage_count, to_char(v_trial_end_date, 'MM/DD'))::TEXT,
                    v_profile.free_trial_usage_count,
                    v_free_trial_usage_limit,
                    v_free_trial_usage_limit - v_profile.free_trial_usage_count,
                    '無料体験'::TEXT;
                RETURN;
            ELSE
                RETURN QUERY SELECT
                    FALSE,
                    '無料体験の利用回数上限に達しました。'::TEXT,
                    v_profile.free_trial_usage_count,
                    v_free_trial_usage_limit,
                    0::INTEGER,
                    '無料体験'::TEXT;
                RETURN;
            END IF;
        END IF;
    END IF;

    -- 何もなければ利用不可
    RETURN QUERY SELECT
        FALSE,
        '無料体験期間が終了しました。プランを購入してください。'::TEXT,
        COALESCE(v_profile.free_trial_usage_count, 0),
        v_free_trial_usage_limit,
        0::INTEGER,
        NULL::TEXT;
END;
$$;

-- =====================================================
-- 完了メッセージ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'カスタムトライアル対応マイグレーションが完了しました';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '更新内容:';
    RAISE NOTICE '1. user_profilesにcustom_trial_days, custom_trial_usage_limitカラム追加';
    RAISE NOTICE '2. check_free_access関数をカスタムトライアル対応に更新';
    RAISE NOTICE '3. can_use_service関数を管理者チェック+カスタムトライアル対応に更新';
    RAISE NOTICE '';
    RAISE NOTICE '確認クエリ:';
    RAISE NOTICE 'SELECT u.email, up.role, cus.* FROM auth.users u JOIN user_profiles up ON u.id = up.id CROSS JOIN LATERAL can_use_service(u.id) cus WHERE up.role = ''admin'' OR u.email LIKE ''trial%'';';
END $$;




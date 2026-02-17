-- =====================================================
-- マイグレーション: アトミックな利用枠予約/解放
-- 目的: can_use_service → increment_usage 間のレースコンディション解消
-- 適用: Supabase SQL Editor で実行
-- =====================================================

-- =====================================================
-- 1. reserve_usage: 利用可否チェック＋枠確保をアトミックに実行
-- =====================================================
CREATE OR REPLACE FUNCTION public.reserve_usage(
    p_user_id UUID,
    p_count INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    subscription_id UUID,
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
    v_free_access RECORD;
    v_free_trial_days INTEGER;
    v_free_trial_usage_limit INTEGER;
    v_trial_end_date TIMESTAMPTZ;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
BEGIN
    -- ★ 1. 管理者チェック（枠消費不要）
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = p_user_id;

    IF v_is_admin THEN
        RETURN QUERY SELECT
            TRUE, '管理者はサービスを無制限に利用できます'::TEXT,
            NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, 'admin'::TEXT;
        RETURN;
    END IF;

    -- ★ 2. 無料開放チェック（枠消費不要）
    BEGIN
        SELECT * INTO v_free_access FROM public.check_free_access(p_user_id);
        IF v_free_access.has_free_access AND v_free_access.free_access_type = 'system_free_access' THEN
            RETURN QUERY SELECT
                TRUE, v_free_access.message,
                NULL::UUID, NULL::INTEGER, NULL::INTEGER,
                v_free_access.trial_usage_remaining::INTEGER,
                v_free_access.free_access_type;
            RETURN;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- ★ 3. サブスクリプション: FOR UPDATE でロック → 枠確認 → インクリメント
    SELECT s.id AS sub_id, s.usage_count AS sub_usage_count,
           s.usage_limit AS sub_usage_limit, s.status, s.stripe_subscription_id,
           s.current_period_end, s.expires_at, s.created_at,
           pp.name AS pn
    INTO v_subscription
    FROM public.subscriptions s
    LEFT JOIN public.pricing_plans pp ON s.plan_id = pp.id
    WHERE s.user_id = p_user_id AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
    ORDER BY s.created_at DESC LIMIT 1
    FOR UPDATE OF s;

    IF FOUND THEN
        -- Stripe期限切れチェック
        IF v_subscription.stripe_subscription_id IS NOT NULL
            AND v_subscription.current_period_end IS NOT NULL
            AND v_subscription.current_period_end < NOW() THEN
            RETURN QUERY SELECT
                FALSE, 'サブスクリプションの有効期限が切れています。'::TEXT,
                v_subscription.sub_id, v_subscription.sub_usage_count,
                v_subscription.sub_usage_limit, 0::INTEGER, v_subscription.pn;
            RETURN;
        END IF;

        -- 使用回数上限チェック（予約分を含めて判定）
        IF v_subscription.sub_usage_limit IS NOT NULL
            AND v_subscription.sub_usage_count + p_count > v_subscription.sub_usage_limit THEN
            RETURN QUERY SELECT
                FALSE, '今月の採点回数上限に達しました。'::TEXT,
                v_subscription.sub_id, v_subscription.sub_usage_count,
                v_subscription.sub_usage_limit,
                GREATEST(0, v_subscription.sub_usage_limit - v_subscription.sub_usage_count),
                v_subscription.pn;
            RETURN;
        END IF;

        -- ★ アトミックにインクリメント（枠確保）
        UPDATE public.subscriptions
        SET usage_count = usage_count + p_count, updated_at = NOW()
        WHERE id = v_subscription.sub_id;

        RETURN QUERY SELECT
            TRUE, '利用枠を確保しました'::TEXT,
            v_subscription.sub_id,
            v_subscription.sub_usage_count + p_count,
            v_subscription.sub_usage_limit,
            CASE WHEN v_subscription.sub_usage_limit IS NULL THEN NULL
                 ELSE v_subscription.sub_usage_limit - v_subscription.sub_usage_count - p_count END,
            v_subscription.pn;
        RETURN;
    END IF;

    -- ★ 4. 無料体験: FOR UPDATE でロック → 枠確認 → インクリメント
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;

    IF v_profile IS NOT NULL AND v_profile.free_trial_started_at IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 7) INTO v_free_trial_days
        FROM system_settings WHERE key = 'free_trial_days';
        SELECT COALESCE(value::INTEGER, 3) INTO v_free_trial_usage_limit
        FROM system_settings WHERE key = 'free_trial_usage_limit';

        IF v_profile.custom_trial_days IS NOT NULL THEN
            v_free_trial_days := v_profile.custom_trial_days;
        END IF;
        IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
            v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
        END IF;

        v_trial_end_date := v_profile.free_trial_started_at + (v_free_trial_days || ' days')::INTERVAL;

        IF NOW() < v_trial_end_date THEN
            IF v_profile.free_trial_usage_count + p_count <= v_free_trial_usage_limit THEN
                UPDATE user_profiles
                SET free_trial_usage_count = free_trial_usage_count + p_count, updated_at = NOW()
                WHERE id = p_user_id;

                RETURN QUERY SELECT
                    TRUE, '無料体験の利用枠を確保しました'::TEXT,
                    NULL::UUID,
                    v_profile.free_trial_usage_count + p_count,
                    v_free_trial_usage_limit,
                    v_free_trial_usage_limit - v_profile.free_trial_usage_count - p_count,
                    'free_trial'::TEXT;
                RETURN;
            ELSE
                RETURN QUERY SELECT
                    FALSE, '無料体験の採点回数上限に達しました。'::TEXT,
                    NULL::UUID,
                    v_profile.free_trial_usage_count,
                    v_free_trial_usage_limit,
                    GREATEST(0, v_free_trial_usage_limit - v_profile.free_trial_usage_count),
                    'free_trial'::TEXT;
                RETURN;
            END IF;
        ELSE
            RETURN QUERY SELECT
                FALSE, '無料体験期間が終了しました。プランを購入してください。'::TEXT,
                NULL::UUID,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                0::INTEGER,
                'free_trial_expired'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- ★ 5. いずれにも該当しない
    RETURN QUERY SELECT
        FALSE, '利用可能なプランがありません。プランを購入してください。'::TEXT,
        NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::TEXT;
END;
$$;

-- =====================================================
-- 2. release_usage: 予約した枠を解放（採点失敗時のロールバック）
-- =====================================================
CREATE OR REPLACE FUNCTION public.release_usage(
    p_user_id UUID,
    p_count INTEGER DEFAULT 1
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription RECORD;
    v_profile user_profiles%ROWTYPE;
BEGIN
    -- サブスクリプションから解放
    SELECT s.id AS sub_id, s.usage_count AS sub_usage_count
    INTO v_subscription
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
    ORDER BY s.created_at DESC LIMIT 1
    FOR UPDATE OF s;

    IF FOUND THEN
        UPDATE public.subscriptions
        SET usage_count = GREATEST(0, usage_count - p_count), updated_at = NOW()
        WHERE id = v_subscription.sub_id;

        RETURN QUERY SELECT TRUE, '利用枠を解放しました'::TEXT;
        RETURN;
    END IF;

    -- 無料体験から解放
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;

    IF v_profile IS NOT NULL THEN
        UPDATE user_profiles
        SET free_trial_usage_count = GREATEST(0, free_trial_usage_count - p_count), updated_at = NOW()
        WHERE id = p_user_id;

        RETURN QUERY SELECT TRUE, '無料体験の利用枠を解放しました'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT FALSE, '解放対象が見つかりませんでした'::TEXT;
END;
$$;

-- =====================================================
-- 3. increment_usage に上限チェックを追加（安全弁）
-- 既存の increment_usage を置き換え
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_metadata JSONB DEFAULT NULL)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    subscription_id UUID,
    new_usage_count INTEGER,
    usage_limit INTEGER,
    remaining_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription RECORD;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
BEGIN
    -- システム設定を取得
    SELECT (value = 'true') INTO v_free_access_enabled
    FROM system_settings WHERE key = 'free_access_enabled';

    SELECT CASE WHEN value = 'null' OR value IS NULL THEN NULL
           ELSE REPLACE(value, '"', '')::TIMESTAMPTZ END INTO v_free_access_until
    FROM system_settings WHERE key = 'free_access_until';

    -- 期間限定無料開放中はカウントしない
    IF v_free_access_enabled AND (v_free_access_until IS NULL OR v_free_access_until > NOW()) THEN
        INSERT INTO usage_logs (user_id, action_type, metadata)
        VALUES (p_user_id, 'grading', p_metadata);

        RETURN QUERY SELECT true, '無料開放中のため利用回数はカウントされません。'::TEXT,
            NULL::UUID, 0::INTEGER, NULL::INTEGER, NULL::INTEGER;
        RETURN;
    END IF;

    -- アクティブなサブスクリプション取得（FOR UPDATE でロック）
    SELECT s.id AS sub_id, s.usage_count AS sub_usage_count,
           s.usage_limit AS sub_usage_limit
    INTO v_subscription
    FROM subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
    ORDER BY s.purchased_at DESC
    LIMIT 1
    FOR UPDATE OF s;

    IF FOUND THEN
        -- ★ 安全弁: 上限チェック
        IF v_subscription.sub_usage_limit IS NOT NULL
            AND v_subscription.sub_usage_count >= v_subscription.sub_usage_limit THEN
            RETURN QUERY SELECT
                false, '利用回数上限に達しているため記録できません。'::TEXT,
                v_subscription.sub_id, v_subscription.sub_usage_count,
                v_subscription.sub_usage_limit, 0::INTEGER;
            RETURN;
        END IF;

        UPDATE subscriptions
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = v_subscription.sub_id;

        INSERT INTO usage_logs (user_id, subscription_id, action_type, metadata)
        VALUES (p_user_id, v_subscription.sub_id, 'grading', p_metadata);

        RETURN QUERY SELECT
            true, '利用回数を記録しました。'::TEXT,
            v_subscription.sub_id,
            v_subscription.sub_usage_count + 1,
            v_subscription.sub_usage_limit,
            CASE WHEN v_subscription.sub_usage_limit IS NULL THEN NULL
                 ELSE v_subscription.sub_usage_limit - v_subscription.sub_usage_count - 1 END;
        RETURN;
    ELSE
        -- 無料体験の利用回数をインクリメント
        UPDATE user_profiles
        SET free_trial_usage_count = free_trial_usage_count + 1, updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO usage_logs (user_id, action_type, metadata)
        VALUES (p_user_id, 'grading', p_metadata);

        RETURN QUERY SELECT
            true, '無料体験の利用回数を記録しました。'::TEXT,
            NULL::UUID,
            (SELECT free_trial_usage_count FROM user_profiles WHERE id = p_user_id),
            NULL::INTEGER,
            NULL::INTEGER;
        RETURN;
    END IF;
END;
$$;

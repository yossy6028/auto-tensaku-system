-- =====================================================
-- マイグレーション: 無料添削回数を3回→5回に変更
-- 適用日: 2026-03-23
-- 目的: 無料体験の利用回数上限を5回に統一
-- =====================================================

-- 1. system_settings テーブルの値を更新（既にUPDATE済みだが冪等性のため含む）
UPDATE system_settings SET value = '5' WHERE key = 'free_trial_usage_limit';

-- 2. check_free_access 関数を再作成（COALESCE フォールバック値を5に変更）
CREATE OR REPLACE FUNCTION public.check_free_access(p_user_id uuid)
 RETURNS TABLE(has_free_access boolean, free_access_type text, message text, trial_days_remaining integer, trial_usage_remaining integer, free_access_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_profile user_profiles%ROWTYPE;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
    v_free_trial_usage_limit INTEGER;
    v_has_subscription BOOLEAN;
BEGIN
    -- システム設定を取得
    SELECT (value = 'true') INTO v_free_access_enabled FROM system_settings WHERE key = 'free_access_enabled';
    SELECT CASE WHEN value = 'null' THEN NULL ELSE value::TIMESTAMPTZ END INTO v_free_access_until FROM system_settings WHERE key = 'free_access_until';
    SELECT COALESCE(value::INTEGER, 5) INTO v_free_trial_usage_limit FROM system_settings WHERE key = 'free_trial_usage_limit';

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

    -- カスタムトライアル設定を優先
    IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
        v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
    END IF;

    -- 無料体験チェック（回数のみ）
    IF v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
        RETURN QUERY SELECT
            true,
            'trial'::TEXT,
            format('無料体験中（残り%s回）', v_free_trial_usage_limit - v_profile.free_trial_usage_count)::TEXT,
            NULL::INTEGER,
            v_free_trial_usage_limit - v_profile.free_trial_usage_count,
            NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 無料体験終了（回数上限到達）
    RETURN QUERY SELECT false, 'expired'::TEXT, '無料体験終了'::TEXT, NULL::INTEGER, 0::INTEGER, NULL::TIMESTAMPTZ;
END;
$function$;

-- 3. can_use_service 関数を再作成（COALESCE フォールバック値を5に変更）
CREATE OR REPLACE FUNCTION public.can_use_service(p_user_id uuid)
 RETURNS TABLE(can_use boolean, message text, usage_count integer, usage_limit integer, remaining_count integer, plan_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_subscription RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_profile user_profiles%ROWTYPE;
    v_free_trial_usage_limit INTEGER;
BEGIN
    -- 1. 管理者チェック（最優先）
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

    -- 2. check_free_access（無料開放・トライアル）
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

    -- 3. サブスクリプションチェック
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

    -- 4. 無料体験チェック（フォールバック・回数のみ）
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;

    IF v_profile IS NOT NULL AND v_profile.free_trial_started_at IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 5) INTO v_free_trial_usage_limit FROM system_settings WHERE key = 'free_trial_usage_limit';

        -- カスタム設定を優先
        IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
            v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
        END IF;

        IF v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
            RETURN QUERY SELECT
                TRUE,
                format('無料体験中です（残り%s回）', v_free_trial_usage_limit - v_profile.free_trial_usage_count)::TEXT,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                v_free_trial_usage_limit - v_profile.free_trial_usage_count,
                '無料体験'::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT
                FALSE,
                '無料体験の利用回数上限に達しました。プランを購入してください。'::TEXT,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                0::INTEGER,
                '無料体験'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 何もなければ利用不可
    RETURN QUERY SELECT
        FALSE,
        '無料体験の利用回数上限に達しました。プランを購入してください。'::TEXT,
        COALESCE(v_profile.free_trial_usage_count, 0),
        v_free_trial_usage_limit,
        0::INTEGER,
        NULL::TEXT;
END;
$function$;

-- 4. reserve_usage 関数を再作成（COALESCE フォールバック値を5に変更）
CREATE OR REPLACE FUNCTION public.reserve_usage(p_user_id uuid, p_count integer DEFAULT 1)
 RETURNS TABLE(success boolean, message text, subscription_id uuid, usage_count integer, usage_limit integer, remaining_count integer, plan_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_subscription RECORD;
    v_is_admin BOOLEAN := FALSE;
    v_profile user_profiles%ROWTYPE;
    v_free_access RECORD;
    v_free_trial_usage_limit INTEGER;
    v_free_access_enabled BOOLEAN;
    v_free_access_until TIMESTAMPTZ;
BEGIN
    -- 1. 管理者チェック（枠消費不要）
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = p_user_id;

    IF v_is_admin THEN
        RETURN QUERY SELECT
            TRUE, '管理者はサービスを無制限に利用できます'::TEXT,
            NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, 'admin'::TEXT;
        RETURN;
    END IF;

    -- 2. 無料開放チェック（枠消費不要）
    BEGIN
        SELECT * INTO v_free_access FROM public.check_free_access(p_user_id);
        IF v_free_access.has_free_access AND v_free_access.free_access_type = 'promo' THEN
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

    -- 3. サブスクリプション: FOR UPDATE でロック → 枠確認 → インクリメント
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

        -- アトミックにインクリメント（枠確保）
        UPDATE public.subscriptions AS s
        SET usage_count = s.usage_count + p_count, updated_at = NOW()
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

    -- 4. 無料体験: FOR UPDATE でロック → 回数のみで判定 → インクリメント
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id FOR UPDATE;

    IF FOUND AND v_profile.free_trial_started_at IS NOT NULL THEN
        SELECT COALESCE(value::INTEGER, 5) INTO v_free_trial_usage_limit
        FROM system_settings WHERE key = 'free_trial_usage_limit';

        IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
            v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
        END IF;

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
                FALSE, '無料体験の採点回数上限に達しました。プランを購入してください。'::TEXT,
                NULL::UUID,
                v_profile.free_trial_usage_count,
                v_free_trial_usage_limit,
                GREATEST(0, v_free_trial_usage_limit - v_profile.free_trial_usage_count),
                'free_trial'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 5. いずれにも該当しない
    RETURN QUERY SELECT
        FALSE, '利用可能なプランがありません。プランを購入してください。'::TEXT,
        NULL::UUID, NULL::INTEGER, NULL::INTEGER, NULL::INTEGER, NULL::TEXT;
END;
$function$;

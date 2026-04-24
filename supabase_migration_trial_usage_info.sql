-- =====================================================
-- マイグレーション: 無料体験の利用回数情報を can_use_service に返す
-- 目的:
--   check_free_access 経由の trial 判定では usage_count / usage_limit が NULL になり、
--   カスタム無料体験回数（例: 15回）が画面に正しく表示されない問題を解消する。
-- 適用: Supabase SQL Editor で実行
-- =====================================================

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
SET search_path = public
AS $$
DECLARE
    v_profile public.user_profiles%ROWTYPE;
    v_subscription RECORD;
    v_free_access RECORD;
    v_free_trial_usage_limit INTEGER := 5;
    v_trial_usage_count INTEGER := 0;
BEGIN
    -- 1. プロファイル取得
    SELECT * INTO v_profile
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            'ユーザープロファイルが見つかりません。'::TEXT,
            0::INTEGER,
            0::INTEGER,
            0::INTEGER,
            NULL::TEXT;
        RETURN;
    END IF;

    -- 2. 管理者チェック
    IF v_profile.role = 'admin' THEN
        RETURN QUERY SELECT
            TRUE,
            '管理者はサービスを無制限に利用できます'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::INTEGER,
            'admin'::TEXT;
        RETURN;
    END IF;

    -- 3. 期間限定無料開放チェック（枠消費なし）
    BEGIN
        SELECT * INTO v_free_access
        FROM public.check_free_access(p_user_id);

        IF v_free_access.has_free_access AND v_free_access.free_access_type = 'promo' THEN
            RETURN QUERY SELECT
                TRUE,
                v_free_access.message,
                NULL::INTEGER,
                NULL::INTEGER,
                NULL::INTEGER,
                'promo'::TEXT;
            RETURN;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- check_free_access が古い環境では後続チェックへ進む
        NULL;
    END;

    -- 4. サブスクリプションチェック
    SELECT s.*, pp.name AS plan_name INTO v_subscription
    FROM public.subscriptions s
    LEFT JOIN public.pricing_plans pp ON s.plan_id = pp.id
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        IF v_subscription.stripe_subscription_id IS NOT NULL
            AND v_subscription.current_period_end IS NOT NULL
            AND v_subscription.current_period_end < NOW() THEN
            RETURN QUERY SELECT
                FALSE,
                'サブスクリプションの有効期限が切れています。'::TEXT,
                COALESCE(v_subscription.usage_count, 0)::INTEGER,
                v_subscription.usage_limit::INTEGER,
                0::INTEGER,
                v_subscription.plan_name::TEXT;
            RETURN;
        END IF;

        IF v_subscription.usage_limit IS NOT NULL
            AND COALESCE(v_subscription.usage_count, 0) >= v_subscription.usage_limit THEN
            RETURN QUERY SELECT
                FALSE,
                '今月の採点回数上限に達しました。'::TEXT,
                COALESCE(v_subscription.usage_count, 0)::INTEGER,
                v_subscription.usage_limit::INTEGER,
                0::INTEGER,
                v_subscription.plan_name::TEXT;
            RETURN;
        END IF;

        RETURN QUERY SELECT
            TRUE,
            'サービスを利用できます'::TEXT,
            COALESCE(v_subscription.usage_count, 0)::INTEGER,
            v_subscription.usage_limit::INTEGER,
            CASE WHEN v_subscription.usage_limit IS NULL THEN NULL
                 ELSE v_subscription.usage_limit - COALESCE(v_subscription.usage_count, 0) END::INTEGER,
            v_subscription.plan_name::TEXT;
        RETURN;
    END IF;

    -- 5. 無料体験チェック（時間制限なし、回数のみ）
    SELECT COALESCE(NULLIF(value, '')::INTEGER, 5) INTO v_free_trial_usage_limit
    FROM public.system_settings
    WHERE key = 'free_trial_usage_limit';

    IF v_free_trial_usage_limit IS NULL THEN
        v_free_trial_usage_limit := 5;
    END IF;

    IF v_profile.custom_trial_usage_limit IS NOT NULL THEN
        v_free_trial_usage_limit := v_profile.custom_trial_usage_limit;
    END IF;

    v_trial_usage_count := COALESCE(v_profile.free_trial_usage_count, 0);

    IF v_profile.free_trial_started_at IS NOT NULL THEN
        IF v_trial_usage_count < v_free_trial_usage_limit THEN
            RETURN QUERY SELECT
                TRUE,
                format('無料体験中です（残り%s回）', v_free_trial_usage_limit - v_trial_usage_count)::TEXT,
                v_trial_usage_count,
                v_free_trial_usage_limit,
                v_free_trial_usage_limit - v_trial_usage_count,
                'trial'::TEXT;
            RETURN;
        END IF;

        RETURN QUERY SELECT
            FALSE,
            '無料体験の利用回数上限に達しました。プランを購入してください。'::TEXT,
            v_trial_usage_count,
            v_free_trial_usage_limit,
            0::INTEGER,
            'free_trial_expired'::TEXT;
        RETURN;
    END IF;

    -- 6. いずれにも該当しない
    RETURN QUERY SELECT
        FALSE,
        '利用可能なプランがありません。プランを購入してください。'::TEXT,
        0::INTEGER,
        v_free_trial_usage_limit,
        0::INTEGER,
        NULL::TEXT;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE 'can_use_service now returns trial usage_count and usage_limit.';
END $$;

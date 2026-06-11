-- =====================================================
-- マイグレーション: can_use_service の %ROWTYPE IS NOT NULL 罠を修正
-- 適用日: 2026-06-11
-- 目的:
--   20260323 の can_use_service ステップ4(無料体験フォールバック)が
--   `IF v_profile IS NOT NULL` を使っていた。%ROWTYPE への IS NOT NULL は
--   「全カラム非NULL」判定のため、custom_trial_days 等の NULL 許可カラムが
--   NULL だと行が存在しても FALSE になり、check_free_access が例外で
--   握り潰された場合にトライアルユーザーが「プランを購入してください」に落ちる。
--   行の存在判定を FOUND に統一し、SET search_path も明示する。
-- 参照: supabase-auth-guard Phase 6f
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_use_service(p_user_id uuid)
 RETURNS TABLE(can_use boolean, message text, usage_count integer, usage_limit integer, remaining_count integer, plan_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

    -- %ROWTYPE の存在判定は必ず FOUND（IS NOT NULL は全カラム非NULL判定で罠）
    IF FOUND AND v_profile.free_trial_started_at IS NOT NULL THEN
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

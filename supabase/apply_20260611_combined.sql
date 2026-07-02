-- ==========================================================
-- 一括適用スクリプト (2026-06-11) — origin/main 同期後の最新版
-- Supabase SQL Editor にこの全文を貼り付けて実行してください。
-- 価格は 480/980/1580（期間限定価格）に設定済み。
-- 末尾の Stripe Price ID は実値に置き換えてから実行すること。
-- ==========================================================

-- ===== ① can_use_service の FOUND 修正 =====
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

-- ===== ② pricing_plans のコード基準正規化（価格480/980/1580）=====
-- =====================================================
-- マイグレーション: pricing_plans のプランIDをコード基準に統一
-- 適用日: 2026-06-11
-- 目的:
--   コード(PLAN_LIMITS/config.ts/料金ページ)・Stripeメタデータが
--   light/standard/unlimited を使う一方、旧シードは plan_15/40/100/unlimited
--   だったため、webhook の resolvePlan() が毎回「自動登録プラン」を生成し
--   pricing_plans に正規行と自動生成行が混在していた。
--   コードを唯一の真実とし、light/standard/unlimited に正規化する。
-- 参照: webhook/route.ts PLAN_LIMITS, lib/stripe/config.ts, STRIPE_SETUP.md
-- =====================================================

-- 1. 正規プラン(コード基準)を投入。既存なら値を更新（冪等）
--    usage_limit / price_yen はコードの PLAN_LIMITS / PLAN_PRICES と一致させる。
-- 価格は webhook の PLAN_PRICES（期間限定価格 480/980/1580）と一致させる。
INSERT INTO public.pricing_plans (id, name, description, usage_limit, price_yen, is_active, sort_order) VALUES
    ('light',     'ライトプラン',   '月10回まで利用可能',  10,    480, true, 1),
    ('standard',  'スタンダードプラン', '月30回まで利用可能',  30,    980, true, 2),
    ('unlimited', '無制限プラン',   '回数無制限で利用可能', NULL, 1580, true, 3)
ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    usage_limit = EXCLUDED.usage_limit,
    price_yen   = EXCLUDED.price_yen,
    is_active   = true,
    sort_order  = EXCLUDED.sort_order;

-- 2. 既存サブスクリプションの plan_id を旧ID→新IDへ1:1で再マッピング。
--    FK(subscriptions.plan_id → pricing_plans.id)を壊さないよう、
--    正規行を投入した後に実行する。
--    plan_15(15回980円)→light / plan_40(40回1980円)→standard / plan_unlimited(4980円)→unlimited
UPDATE public.subscriptions SET plan_id = 'light'     WHERE plan_id = 'plan_15';
UPDATE public.subscriptions SET plan_id = 'standard'  WHERE plan_id = 'plan_40';
UPDATE public.subscriptions SET plan_id = 'unlimited' WHERE plan_id = 'plan_unlimited';
-- plan_100(プレミアム100回)はコード/Stripeに対応プランが存在しないため、
-- 上位の unlimited に寄せる（回数ダウングレードによる既存ユーザーの不利益を防ぐ）。
UPDATE public.subscriptions SET plan_id = 'unlimited' WHERE plan_id = 'plan_100';

-- 3. webhook が誤って生成した自動登録プラン名を正規名に補正
UPDATE public.pricing_plans SET name = 'ライトプラン',     description = '月10回まで利用可能'  WHERE id = 'light'     AND name LIKE '自動登録プラン%';
UPDATE public.pricing_plans SET name = 'スタンダードプラン', description = '月30回まで利用可能'  WHERE id = 'standard'  AND name LIKE '自動登録プラン%';
UPDATE public.pricing_plans SET name = '無制限プラン',     description = '回数無制限で利用可能' WHERE id = 'unlimited' AND name LIKE '自動登録プラン%';

-- 4. 旧プラン行を無効化（参照され得るため DELETE はせず is_active=false に留める）
UPDATE public.pricing_plans
SET is_active = false
WHERE id IN ('plan_15', 'plan_40', 'plan_100', 'plan_unlimited');

-- 5. 各プランの stripe_price_id を実IDに紐付ける（要手動: Stripeダッシュボードの実Price IDに置換）
--    紐付け後は webhook の resolvePlan() がステップ1(price_id検索)で解決でき、
--    自動登録プランの生成が起きなくなる。
-- UPDATE public.pricing_plans SET stripe_price_id = 'price_xxx_light'     WHERE id = 'light';
-- UPDATE public.pricing_plans SET stripe_price_id = 'price_xxx_standard'  WHERE id = 'standard';
-- UPDATE public.pricing_plans SET stripe_price_id = 'price_xxx_unlimited' WHERE id = 'unlimited';

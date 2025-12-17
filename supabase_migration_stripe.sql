-- Stripe課金システム連携用マイグレーション
-- auto-tensaku-system用
-- 実行日: 2024年12月

-- ======================================
-- 1. user_profilesテーブルにStripe顧客ID追加
-- ======================================

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- stripe_customer_idにインデックスを作成（検索高速化）
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id 
ON public.user_profiles(stripe_customer_id);

-- ======================================
-- 2. subscriptionsテーブルにStripe関連カラム追加
-- ======================================

-- Stripeサブスクリプション関連カラム
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- status列に'past_due'を追加（支払い遅延状態）
-- 既存のENUM制約がある場合は一度削除して再作成
DO $$
BEGIN
    -- 既存のCHECK制約を確認・削除
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'subscriptions' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.subscriptions 
        DROP CONSTRAINT IF EXISTS subscriptions_status_check;
    END IF;
    
    -- 新しいCHECK制約を追加
    ALTER TABLE public.subscriptions 
    ADD CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('active', 'expired', 'cancelled', 'past_due'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
ON public.subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_price_id 
ON public.subscriptions(stripe_price_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end 
ON public.subscriptions(current_period_end);

-- ======================================
-- 3. pricing_plansテーブルにStripe価格ID追加
-- ======================================

ALTER TABLE public.pricing_plans 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- 既存プランにStripe Price IDを設定（後で実際のIDに更新する）
-- 注意: 以下はプレースホルダーです。Stripeダッシュボードで作成した実際のPrice IDに置き換えてください

-- UPDATE public.pricing_plans SET stripe_price_id = 'price_xxxxxxxxxxxxx' WHERE id = 'light';
-- UPDATE public.pricing_plans SET stripe_price_id = 'price_xxxxxxxxxxxxx' WHERE id = 'standard';
-- UPDATE public.pricing_plans SET stripe_price_id = 'price_xxxxxxxxxxxxx' WHERE id = 'unlimited';

-- ======================================
-- 4. Stripe Webhookイベントログテーブル作成
-- ======================================

CREATE TABLE IF NOT EXISTS public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id 
ON public.stripe_events(event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_type 
ON public.stripe_events(event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at 
ON public.stripe_events(created_at);

-- RLSを有効化（管理者のみアクセス可能）
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧可能なポリシー
CREATE POLICY "Admins can view stripe events" ON public.stripe_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ======================================
-- 5. サブスクリプション自動更新用関数
-- ======================================

-- 期限切れサブスクリプションを自動的にexpiredに更新する関数
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.subscriptions
    SET 
        status = 'expired',
        updated_at = NOW()
    WHERE 
        status = 'active'
        AND current_period_end IS NOT NULL
        AND current_period_end < NOW()
        AND stripe_subscription_id IS NULL; -- Stripe管理外のもののみ
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ======================================
-- 6. ユーザーのアクティブなStripeサブスクリプション取得関数
-- ======================================

CREATE OR REPLACE FUNCTION public.get_stripe_subscription(p_user_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id TEXT,
    status TEXT,
    usage_count INTEGER,
    usage_limit INTEGER,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.plan_id,
        s.status::TEXT,
        s.usage_count,
        s.usage_limit,
        s.stripe_subscription_id,
        s.stripe_price_id,
        s.current_period_start,
        s.current_period_end,
        s.cancel_at_period_end
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
        AND s.status = 'active'
        AND s.stripe_subscription_id IS NOT NULL
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$;

-- 関数にアクセス権を付与
GRANT EXECUTE ON FUNCTION public.get_stripe_subscription(UUID) TO authenticated;

-- ======================================
-- 7. 既存のcan_use_service関数を更新
-- ======================================

-- Stripe連携を考慮したサービス利用可否チェック
-- 注意: この関数は既存の関数を上書きします
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
    v_plan RECORD;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- 管理者チェック
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.user_profiles
    WHERE id = p_user_id;

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

    -- 無料アクセスチェック
    DECLARE
        v_free_access RECORD;
    BEGIN
        SELECT * INTO v_free_access
        FROM public.check_free_access(p_user_id);
        
        IF v_free_access.has_free_access THEN
            -- トライアル/プロモーション使用可能
            RETURN QUERY SELECT 
                TRUE,
                v_free_access.message,
                NULL::INTEGER,
                NULL::INTEGER,
                v_free_access.trial_usage_remaining::INTEGER,
                v_free_access.free_access_type;
            RETURN;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- check_free_access関数がない場合は無視
            NULL;
    END;

    -- アクティブなサブスクリプションを取得
    SELECT s.*, pp.name as plan_name
    INTO v_subscription
    FROM public.subscriptions s
    LEFT JOIN public.pricing_plans pp ON s.plan_id = pp.id
    WHERE s.user_id = p_user_id
        AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- サブスクリプションがない場合
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE,
            'アクティブなサブスクリプションがありません。プランを選択してください。'::TEXT,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::INTEGER,
            NULL::TEXT;
        RETURN;
    END IF;

    -- Stripeサブスクリプションの期限切れチェック
    IF v_subscription.stripe_subscription_id IS NOT NULL 
        AND v_subscription.current_period_end IS NOT NULL 
        AND v_subscription.current_period_end < NOW() THEN
        RETURN QUERY SELECT 
            FALSE,
            'サブスクリプションの有効期限が切れています。お支払い情報をご確認ください。'::TEXT,
            v_subscription.usage_count,
            v_subscription.usage_limit,
            CASE 
                WHEN v_subscription.usage_limit IS NULL THEN NULL
                ELSE GREATEST(0, v_subscription.usage_limit - v_subscription.usage_count)
            END,
            v_subscription.plan_name;
        RETURN;
    END IF;

    -- 使用回数上限チェック（無制限プランは除く）
    IF v_subscription.usage_limit IS NOT NULL 
        AND v_subscription.usage_count >= v_subscription.usage_limit THEN
        RETURN QUERY SELECT 
            FALSE,
            '今月の採点回数上限に達しました。次回更新日までお待ちいただくか、上位プランへのアップグレードをご検討ください。'::TEXT,
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
        CASE 
            WHEN v_subscription.usage_limit IS NULL THEN NULL
            ELSE v_subscription.usage_limit - v_subscription.usage_count
        END,
        v_subscription.plan_name;
END;
$$;

-- ======================================
-- 完了メッセージ
-- ======================================
DO $$
BEGIN
    RAISE NOTICE 'Stripe課金システム連携用マイグレーションが完了しました';
    RAISE NOTICE '次のステップ:';
    RAISE NOTICE '1. Stripeダッシュボードで商品・価格を作成';
    RAISE NOTICE '2. 環境変数にStripeのAPIキーを設定';
    RAISE NOTICE '3. Webhookエンドポイントを設定';
    RAISE NOTICE '4. pricing_plansテーブルのstripe_price_idを更新';
END $$;


-- =====================================================
-- Auto-tensaku-system 課金システム用テーブル作成
-- =====================================================

-- 1. 料金プランテーブル
CREATE TABLE IF NOT EXISTS pricing_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    usage_limit INTEGER,  -- NULL = 無制限
    price_yen INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ユーザープロファイルテーブル
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    free_trial_started_at TIMESTAMPTZ DEFAULT NOW(),
    free_trial_usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. サブスクリプションテーブル
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES pricing_plans(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    usage_count INTEGER DEFAULT 0,
    usage_limit INTEGER,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 利用ログテーブル
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    action_type TEXT DEFAULT 'grading',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. システム設定テーブル
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 初期データ挿入
-- =====================================================

-- 料金プラン初期データ
INSERT INTO pricing_plans (id, name, description, usage_limit, price_yen, sort_order) VALUES
    ('plan_15', 'ライトプラン', '15回まで利用可能', 15, 980, 1),
    ('plan_40', 'スタンダードプラン', '40回まで利用可能', 40, 1980, 2),
    ('plan_100', 'プレミアムプラン', '100回まで利用可能', 100, 3980, 3),
    ('plan_unlimited', '無制限プラン', '無制限に利用可能', NULL, 4980, 4)
ON CONFLICT (id) DO NOTHING;

-- システム設定初期データ
INSERT INTO system_settings (key, value, description) VALUES
    ('free_trial_days', '7', '無料体験期間（日数）'),
    ('free_trial_usage_limit', '3', '無料体験中の利用回数上限'),
    ('free_access_enabled', 'false', '期間限定無料開放フラグ'),
    ('free_access_until', 'null', '無料開放終了日時')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- インデックス作成
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- =====================================================
-- Row Level Security (RLS) 設定
-- =====================================================

-- RLS有効化
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- pricing_plans: 全員読み取り可能、管理者のみ編集可能
DROP POLICY IF EXISTS "pricing_plans_select" ON pricing_plans;
CREATE POLICY "pricing_plans_select" ON pricing_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "pricing_plans_admin" ON pricing_plans;
CREATE POLICY "pricing_plans_admin" ON pricing_plans FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- user_profiles: 自分のプロファイルのみアクセス可能
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT USING (
    id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT WITH CHECK (id = auth.uid());

-- subscriptions: 自分のサブスクリプションのみアクセス可能
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- usage_logs: 自分のログのみアクセス可能
DROP POLICY IF EXISTS "usage_logs_select" ON usage_logs;
CREATE POLICY "usage_logs_select" ON usage_logs FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "usage_logs_insert" ON usage_logs;
CREATE POLICY "usage_logs_insert" ON usage_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- system_settings: 全員読み取り可能、管理者のみ編集可能
DROP POLICY IF EXISTS "system_settings_select" ON system_settings;
CREATE POLICY "system_settings_select" ON system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_settings_admin" ON system_settings;
CREATE POLICY "system_settings_admin" ON system_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- トリガー: 新規ユーザー登録時にプロファイル自動作成
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, display_name, free_trial_started_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name);
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- normalized_email の UNIQUE 制約違反でもプロファイルは必ず作成する。
        -- normalized_email を NULL にして再試行し、孤立ユーザーを防ぐ。
        RAISE WARNING 'handle_new_user: unique_violation for user % (email: %), retrying without normalized_email', NEW.id, NEW.email;
        INSERT INTO public.user_profiles (id, email, display_name, free_trial_started_at, normalized_email)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
            NOW(),
            NULL
        )
        ON CONFLICT (id) DO NOTHING;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RPC関数: サービス利用可否チェック
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

-- =====================================================
-- RPC関数: 利用回数インクリメント
-- =====================================================
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_metadata JSONB DEFAULT NULL)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_usage_count INTEGER
) AS $$
DECLARE
    v_subscription subscriptions%ROWTYPE;
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
        -- ログは記録
        INSERT INTO usage_logs (user_id, action_type, metadata)
        VALUES (p_user_id, 'grading', p_metadata);
        
        RETURN QUERY SELECT true, '無料開放中のため利用回数はカウントされません。'::TEXT, 0::INTEGER;
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

    IF v_subscription IS NOT NULL THEN
        -- サブスクリプションの利用回数をインクリメント
        UPDATE subscriptions 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = v_subscription.id;

        -- ログ記録
        INSERT INTO usage_logs (user_id, subscription_id, action_type, metadata)
        VALUES (p_user_id, v_subscription.id, 'grading', p_metadata);

        RETURN QUERY SELECT 
            true, 
            '利用回数を記録しました。'::TEXT, 
            v_subscription.usage_count + 1;
        RETURN;
    ELSE
        -- 無料体験の利用回数をインクリメント
        UPDATE user_profiles 
        SET free_trial_usage_count = free_trial_usage_count + 1, updated_at = NOW()
        WHERE id = p_user_id;

        -- ログ記録
        INSERT INTO usage_logs (user_id, action_type, metadata)
        VALUES (p_user_id, 'grading', p_metadata);

        RETURN QUERY SELECT 
            true, 
            '無料体験の利用回数を記録しました。'::TEXT, 
            (SELECT free_trial_usage_count FROM user_profiles WHERE id = p_user_id);
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RPC関数: 無料体験ステータス取得
-- =====================================================
CREATE OR REPLACE FUNCTION get_free_trial_status(p_user_id UUID)
RETURNS TABLE (
    is_trial BOOLEAN,
    is_trial_ended BOOLEAN,
    remaining_days INTEGER,
    remaining_usage INTEGER,
    trial_end_date TIMESTAMPTZ
) AS $$
DECLARE
    v_profile user_profiles%ROWTYPE;
    v_free_trial_days INTEGER;
    v_free_trial_usage_limit INTEGER;
    v_trial_end TIMESTAMPTZ;
    v_has_subscription BOOLEAN;
BEGIN
    -- システム設定を取得
    SELECT COALESCE(value::INTEGER, 7) INTO v_free_trial_days
    FROM system_settings WHERE key = 'free_trial_days';
    
    SELECT COALESCE(value::INTEGER, 3) INTO v_free_trial_usage_limit
    FROM system_settings WHERE key = 'free_trial_usage_limit';

    -- ユーザープロファイル取得
    SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN QUERY SELECT false, false, NULL::INTEGER, NULL::INTEGER, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- アクティブなサブスクリプションがあるかチェック
    SELECT EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE user_id = p_user_id 
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_subscription;

    -- サブスクリプションがある場合は無料体験ではない
    IF v_has_subscription THEN
        RETURN QUERY SELECT false, false, NULL::INTEGER, NULL::INTEGER, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_trial_end := v_profile.free_trial_started_at + (v_free_trial_days || ' days')::INTERVAL;

    -- 無料体験期間中かどうか
    IF NOW() < v_trial_end AND v_profile.free_trial_usage_count < v_free_trial_usage_limit THEN
        RETURN QUERY SELECT 
            true,
            false,
            EXTRACT(DAY FROM v_trial_end - NOW())::INTEGER,
            v_free_trial_usage_limit - v_profile.free_trial_usage_count,
            v_trial_end;
        RETURN;
    END IF;

    -- 無料体験終了
    RETURN QUERY SELECT 
        false,
        true,
        0::INTEGER,
        0::INTEGER,
        v_trial_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

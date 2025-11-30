-- =====================================================
-- Auto-tensaku-system デバイス制限機能用マイグレーション
-- 1アカウントあたり最大2台のデバイスに制限
-- =====================================================

-- =====================================================
-- 1. デバイス管理テーブル作成
-- =====================================================
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,  -- ブラウザ/OS情報
    user_agent TEXT,
    ip_address TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- 同一ユーザー・同一デバイスの重複を防ぐ
    UNIQUE(user_id, device_fingerprint)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_active ON user_devices(last_active_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(device_fingerprint);

-- =====================================================
-- 2. RLS設定
-- =====================================================
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- 自分のデバイスのみ参照可能
DROP POLICY IF EXISTS "user_devices_select" ON user_devices;
CREATE POLICY "user_devices_select" ON user_devices FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 自分のデバイスのみ挿入可能
DROP POLICY IF EXISTS "user_devices_insert" ON user_devices;
CREATE POLICY "user_devices_insert" ON user_devices FOR INSERT WITH CHECK (user_id = auth.uid());

-- 自分のデバイスのみ更新可能
DROP POLICY IF EXISTS "user_devices_update" ON user_devices;
CREATE POLICY "user_devices_update" ON user_devices FOR UPDATE USING (user_id = auth.uid());

-- 自分のデバイスのみ削除可能
DROP POLICY IF EXISTS "user_devices_delete" ON user_devices;
CREATE POLICY "user_devices_delete" ON user_devices FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- 3. システム設定追加（デバイス上限数）
-- =====================================================
INSERT INTO system_settings (key, value, description) VALUES
    ('max_devices_per_user', '2', 'ユーザーあたりの最大デバイス数')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 4. RPC関数: デバイス登録・検証
-- =====================================================

-- デバイス登録/更新関数
CREATE OR REPLACE FUNCTION register_device(
    p_user_id UUID,
    p_device_fingerprint TEXT,
    p_device_name TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    device_id UUID,
    is_new_device BOOLEAN,
    current_device_count INTEGER,
    max_devices INTEGER
) AS $$
DECLARE
    v_max_devices INTEGER;
    v_current_count INTEGER;
    v_existing_device_id UUID;
    v_is_new BOOLEAN := false;
    v_profile_role TEXT;
BEGIN
    -- 管理者は制限なし
    SELECT role INTO v_profile_role FROM user_profiles WHERE id = p_user_id;
    IF v_profile_role = 'admin' THEN
        -- 既存デバイスを確認・更新
        SELECT id INTO v_existing_device_id 
        FROM user_devices 
        WHERE user_id = p_user_id AND device_fingerprint = p_device_fingerprint;
        
        IF v_existing_device_id IS NOT NULL THEN
            -- 既存デバイスの最終アクセス日時を更新
            UPDATE user_devices 
            SET last_active_at = NOW(),
                device_name = COALESCE(p_device_name, device_name),
                user_agent = COALESCE(p_user_agent, user_agent),
                ip_address = COALESCE(p_ip_address, ip_address)
            WHERE id = v_existing_device_id;
        ELSE
            -- 新規デバイスを登録
            INSERT INTO user_devices (user_id, device_fingerprint, device_name, user_agent, ip_address)
            VALUES (p_user_id, p_device_fingerprint, p_device_name, p_user_agent, p_ip_address)
            RETURNING id INTO v_existing_device_id;
            v_is_new := true;
        END IF;
        
        SELECT COUNT(*) INTO v_current_count FROM user_devices WHERE user_id = p_user_id;
        
        RETURN QUERY SELECT 
            true,
            '管理者アカウント: デバイス制限なし'::TEXT,
            v_existing_device_id,
            v_is_new,
            v_current_count,
            NULL::INTEGER;
        RETURN;
    END IF;

    -- 最大デバイス数を取得
    SELECT COALESCE(value::INTEGER, 2) INTO v_max_devices
    FROM system_settings WHERE key = 'max_devices_per_user';

    -- 既存デバイスを確認
    SELECT id INTO v_existing_device_id 
    FROM user_devices 
    WHERE user_id = p_user_id AND device_fingerprint = p_device_fingerprint;

    -- 既存デバイスの場合は最終アクセス日時を更新
    IF v_existing_device_id IS NOT NULL THEN
        UPDATE user_devices 
        SET last_active_at = NOW(),
            device_name = COALESCE(p_device_name, device_name),
            user_agent = COALESCE(p_user_agent, user_agent),
            ip_address = COALESCE(p_ip_address, ip_address)
        WHERE id = v_existing_device_id;

        SELECT COUNT(*) INTO v_current_count FROM user_devices WHERE user_id = p_user_id;

        RETURN QUERY SELECT 
            true,
            'デバイスを認識しました。'::TEXT,
            v_existing_device_id,
            false,
            v_current_count,
            v_max_devices;
        RETURN;
    END IF;

    -- 現在のデバイス数を確認
    SELECT COUNT(*) INTO v_current_count FROM user_devices WHERE user_id = p_user_id;

    -- デバイス上限チェック
    IF v_current_count >= v_max_devices THEN
        RETURN QUERY SELECT 
            false,
            format('デバイス登録数が上限（%s台）に達しています。他のデバイスを削除してください。', v_max_devices)::TEXT,
            NULL::UUID,
            false,
            v_current_count,
            v_max_devices;
        RETURN;
    END IF;

    -- 新規デバイスを登録
    INSERT INTO user_devices (user_id, device_fingerprint, device_name, user_agent, ip_address)
    VALUES (p_user_id, p_device_fingerprint, p_device_name, p_user_agent, p_ip_address)
    RETURNING id INTO v_existing_device_id;
    v_is_new := true;

    RETURN QUERY SELECT 
        true,
        format('新しいデバイスを登録しました。（%s/%s台）', v_current_count + 1, v_max_devices)::TEXT,
        v_existing_device_id,
        v_is_new,
        v_current_count + 1,
        v_max_devices;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RPC関数: デバイス一覧取得
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_devices(p_user_id UUID)
RETURNS TABLE (
    device_id UUID,
    device_fingerprint TEXT,
    device_name TEXT,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    is_current BOOLEAN
) AS $$
BEGIN
    RETURN QUERY SELECT 
        ud.id,
        ud.device_fingerprint,
        ud.device_name,
        ud.user_agent,
        ud.last_active_at,
        ud.created_at,
        false as is_current  -- クライアント側で現在のデバイスを判定
    FROM user_devices ud
    WHERE ud.user_id = p_user_id
    ORDER BY ud.last_active_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. RPC関数: デバイス削除
-- =====================================================
CREATE OR REPLACE FUNCTION remove_device(p_user_id UUID, p_device_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM user_devices 
    WHERE id = p_device_id AND user_id = p_user_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RETURN QUERY SELECT true, 'デバイスを削除しました。'::TEXT;
    ELSE
        RETURN QUERY SELECT false, 'デバイスが見つからないか、削除権限がありません。'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. RPC関数: 古いデバイスの自動クリーンアップ
--    (30日以上アクセスのないデバイスを削除)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_inactive_devices(p_days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (
    cleaned_count INTEGER
) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM user_devices 
    WHERE last_active_at < NOW() - (p_days_threshold || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. デバイス検証関数（サービス利用時のチェック用）
-- =====================================================
CREATE OR REPLACE FUNCTION check_device_access(
    p_user_id UUID,
    p_device_fingerprint TEXT
)
RETURNS TABLE (
    has_access BOOLEAN,
    message TEXT,
    device_count INTEGER,
    max_devices INTEGER
) AS $$
DECLARE
    v_max_devices INTEGER;
    v_current_count INTEGER;
    v_device_exists BOOLEAN;
    v_profile_role TEXT;
BEGIN
    -- 管理者は制限なし
    SELECT role INTO v_profile_role FROM user_profiles WHERE id = p_user_id;
    IF v_profile_role = 'admin' THEN
        RETURN QUERY SELECT 
            true,
            '管理者アカウント: デバイス制限なし'::TEXT,
            0::INTEGER,
            NULL::INTEGER;
        RETURN;
    END IF;

    -- 最大デバイス数を取得
    SELECT COALESCE(value::INTEGER, 2) INTO v_max_devices
    FROM system_settings WHERE key = 'max_devices_per_user';

    -- 現在のデバイス数を取得
    SELECT COUNT(*) INTO v_current_count FROM user_devices WHERE user_id = p_user_id;

    -- このデバイスが登録されているか確認
    SELECT EXISTS (
        SELECT 1 FROM user_devices 
        WHERE user_id = p_user_id AND device_fingerprint = p_device_fingerprint
    ) INTO v_device_exists;

    IF v_device_exists THEN
        -- デバイスの最終アクセス日時を更新
        UPDATE user_devices 
        SET last_active_at = NOW()
        WHERE user_id = p_user_id AND device_fingerprint = p_device_fingerprint;
        
        RETURN QUERY SELECT 
            true,
            'デバイスアクセス許可'::TEXT,
            v_current_count,
            v_max_devices;
    ELSE
        -- デバイスが登録されていない
        IF v_current_count >= v_max_devices THEN
            RETURN QUERY SELECT 
                false,
                format('このデバイスは登録されていません。デバイス上限（%s台）に達しているため、他のデバイスを削除してください。', v_max_devices)::TEXT,
                v_current_count,
                v_max_devices;
        ELSE
            -- 自動登録可能
            RETURN QUERY SELECT 
                false,
                '新しいデバイスです。登録が必要です。'::TEXT,
                v_current_count,
                v_max_devices;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


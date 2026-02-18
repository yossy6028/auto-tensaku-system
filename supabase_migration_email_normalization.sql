-- =====================================================
-- メールアドレス正規化マイグレーション
-- 目的: Gmailエイリアス等を利用した無料体験の不正利用を防止
-- =====================================================

-- 1. normalized_email カラムを追加
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS normalized_email TEXT;

-- 2. メールアドレス正規化関数
CREATE OR REPLACE FUNCTION normalize_email(raw_email TEXT) RETURNS TEXT AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
BEGIN
  IF raw_email IS NULL OR raw_email = '' THEN RETURN NULL; END IF;

  raw_email := LOWER(TRIM(raw_email));
  local_part := SPLIT_PART(raw_email, '@', 1);
  domain_part := SPLIT_PART(raw_email, '@', 2);

  -- + エイリアスを除去 (user+alias@example.com → user@example.com)
  IF POSITION('+' IN local_part) > 0 THEN
    local_part := SPLIT_PART(local_part, '+', 1);
  END IF;

  -- Gmail/Googlemail: ドットを除去 (u.s.e.r@gmail.com → user@gmail.com)
  IF domain_part IN ('gmail.com', 'googlemail.com') THEN
    local_part := REPLACE(local_part, '.', '');
    domain_part := 'gmail.com';  -- googlemail.com を統一
  END IF;

  RETURN local_part || '@' || domain_part;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. 既存データをバックフィル
UPDATE user_profiles
SET normalized_email = normalize_email(email)
WHERE normalized_email IS NULL AND email IS NOT NULL;

-- 4. 自動正規化トリガー（INSERT / UPDATE of email 時に発火）
-- GoTrue (supabase_auth_admin) のコンテキストでも normalize_email() を
-- 解決できるよう、search_path を明示的に設定する。
CREATE OR REPLACE FUNCTION set_normalized_email() RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_email := public.normalize_email(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_normalized_email ON user_profiles;
CREATE TRIGGER trg_set_normalized_email
  BEFORE INSERT OR UPDATE OF email ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_normalized_email();

-- 5. UNIQUE 制約（DB レベルで重複防止 — 最後の砦）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_normalized_email
  ON user_profiles(normalized_email) WHERE normalized_email IS NOT NULL;

-- =====================================================
-- マイグレーション: メール配信問題の修正
-- 適用日: 2026-03-23
-- =====================================================

-- 1. normalize_email に SET search_path = public を追加
-- GoTrue コンテキストでの実行を保証（孤立ユーザー防止）
CREATE OR REPLACE FUNCTION public.normalize_email(raw_email text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $function$
  DECLARE
    local_part TEXT;
    domain_part TEXT;
  BEGIN
    IF raw_email IS NULL OR raw_email = '' THEN RETURN NULL; END IF;

    raw_email := LOWER(TRIM(raw_email));
    local_part := SPLIT_PART(raw_email, '@', 1);
    domain_part := SPLIT_PART(raw_email, '@', 2);

    IF POSITION('+' IN local_part) > 0 THEN
      local_part := SPLIT_PART(local_part, '+', 1);
    END IF;

    IF domain_part IN ('gmail.com', 'googlemail.com') THEN
      local_part := REPLACE(local_part, '.', '');
      domain_part := 'gmail.com';
    END IF;

    RETURN local_part || '@' || domain_part;
  END;
$function$;

-- 注: DNS修正（SPF/DMARC）は Cloudflare API 経由で適用済み:
-- SPF: v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
-- DMARC: v=DMARC1; p=none;
-- 旧Brevo SPFレコードと検証コードを削除

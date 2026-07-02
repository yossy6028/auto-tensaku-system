-- ==========================================================
-- 診断SQL (2026-06-12) — 採点時「利用状況の確認中にエラー」調査用
-- Supabase SQL Editor に貼り付けて実行し、結果を共有してください。
-- ①〜③は読み取りのみ。④はトランザクション内でROLLBACKするため
-- データは一切変更されません。
-- ==========================================================

-- ① 必須RPC関数の存在確認
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       COALESCE(array_to_string(p.proconfig, ','), '(search_path未設定)') AS config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('reserve_usage', 'release_usage', 'can_use_service',
                    'check_free_access', 'check_device_access')
ORDER BY p.proname;

-- ② デプロイ済み reserve_usage に既知の罠が残っていないか
SELECT proname,
       CASE WHEN prosrc LIKE '%v_profile IS NOT NULL%'
            THEN '⚠️ IS NOT NULL 検出（FOUND に要修正）' ELSE 'OK' END AS rowtype_check,
       CASE WHEN prosrc LIKE '%sub_usage_count%'
            THEN 'OK（曖昧参照対策版）' ELSE '⚠️ 旧版の可能性（usage_count曖昧参照）' END AS ambiguity_check
FROM pg_proc
WHERE proname IN ('reserve_usage', 'release_usage');

-- ②b 【最重要】関数の実行権限（ACL）確認
--     proacl が NULL なら「デフォルト権限（PUBLIC実行可）」で正常。
--     "=X" や anon/authenticated が見当たらない場合は権限が剥がれている。
SELECT p.proname,
       COALESCE(p.proacl::text, '(NULL=デフォルト権限)') AS acl,
       CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE')
            THEN '✅ authenticated 実行可'
            ELSE '❌ authenticated 実行不可 ← 採点500の原因' END AS auth_check,
       CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
            THEN 'anon 実行可' ELSE 'anon 実行不可' END AS anon_check
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('reserve_usage', 'release_usage', 'can_use_service',
                    'check_free_access', 'check_device_access')
ORDER BY p.proname;

-- ③ 無料体験設定の確認
SELECT key, value FROM public.system_settings
WHERE key IN ('free_trial_usage_limit', 'free_access_enabled', 'free_access_until');

-- ④ reserve_usage の実行テスト（ROLLBACKするのでデータ変更なし）
--    ※ 無料体験ユーザーのメールアドレスを書き換えてから実行
BEGIN;
SELECT r.* FROM auth.users u, LATERAL public.reserve_usage(u.id, 1) r
WHERE u.email = '体験ユーザーのメールアドレスに置換@example.com';
ROLLBACK;

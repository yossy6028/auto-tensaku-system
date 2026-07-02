-- ==========================================================
-- 修正SQL (2026-06-12) — 関数のEXECUTE権限を復旧
-- ⚠️ 診断SQL ②b で「❌ authenticated 実行不可」が出た場合のみ実行。
-- アプリ(authenticated)とサーバー(service_role)に実行権限を付与する。
-- anon には付与しない（未ログインからの呼び出しは不要のため）。
-- ==========================================================

-- アプリが使用する全RPC関数（web/src の .rpc() 呼び出しを網羅）
GRANT EXECUTE ON FUNCTION public.reserve_usage(uuid, integer)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_usage(uuid, integer)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_use_service(uuid)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_free_access(uuid)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_device_access(uuid, text)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_devices(uuid)              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_device(uuid, text, text)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_device(uuid, text)           TO authenticated, service_role;

-- ※ 引数シグネチャが診断① の args と異なる関数があれば、その表記に合わせて修正。
--   実行後、体験ユーザーで「採点実行」を再テストして復旧を確認すること。

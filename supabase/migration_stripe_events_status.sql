-- ============================================================
-- stripe_events に status 列を追加し、冪等性を「状態機械」に強化する
-- （2026-07-02 / Stripe webhook 信頼性監査対応）
--
-- 目的:
--   1. 処理途中でプロセスが kill された孤児イベントを回収可能にする
--      （status='processing' のまま一定時間放置された行を再処理する）
--   2. リトライ不可能な poison イベントを status='failed' で確定させ、
--      Stripe の再送ループ（最大3日）を打ち切れるようにする
--
-- ⚠️ デプロイ順序:
--   この SQL を「先に」適用してから web をデプロイするのが正順。
--   ただし route.ts は status 列が無い場合に旧方式（行の存在＝処理済み）へ
--   自動縮退するため、順序が前後しても入金の取りこぼしは起きない。
--   （縮退中は孤児回収と poison 打ち切りが効かないだけで、従来挙動と同等）
--
-- 冪等: 何度再実行しても安全（IF NOT EXISTS / 制約の存在チェック / DROP DEFAULT）。
-- 実行方法: Supabase SQL エディタに貼り付けて実行。
-- ============================================================

-- 1. status 列を追加。
--    既存行は DEFAULT 'processed' が入るため「処理済み」とみなされ後方互換になる。
--    新規 claim は明示的に 'processing' を INSERT するので DEFAULT は使われない。
ALTER TABLE public.stripe_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed';

-- 2. status の取りうる値を制約する。
--    "ADD CONSTRAINT IF NOT EXISTS" は無いため、存在チェックしてから付与する。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stripe_events_status_check'
      AND conrelid = 'public.stripe_events'::regclass
  ) THEN
    ALTER TABLE public.stripe_events
      ADD CONSTRAINT stripe_events_status_check
      CHECK (status IN ('processing', 'processed', 'failed'));
  END IF;
END $$;

-- 3. processed_at の意味を「処理完了時刻」に変更する。
--    processing 中の行では NULL を許したいので DEFAULT NOW() を外す。
--    （完了時に route.ts が processed_at=NOW() を明示セットする）
--    既存行の値はそのまま残る。
ALTER TABLE public.stripe_events
  ALTER COLUMN processed_at DROP DEFAULT;

-- 4. 孤児（processing のまま放置された行）の検索を速くする部分インデックス。
CREATE INDEX IF NOT EXISTS idx_stripe_events_processing
  ON public.stripe_events(created_at)
  WHERE status = 'processing';

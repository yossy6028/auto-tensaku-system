-- =====================================================
-- Subscriptionsテーブルのstripe_subscription_id
-- ユニーク制約追加マイグレーション
-- =====================================================
-- 実行日: 2025年
-- 目的: stripe_subscription_idにユニーク制約を追加し、
--      Stripe同期APIのupsertを正しく機能させる

-- 1. 重複データのクリーンアップ（実行前に必要な場合）
-- 同じstripe_subscription_idを持つレコードが複数ある場合、
-- 最新のもの以外をcancelledに更新

DO $$
DECLARE
  dup_record RECORD;
BEGIN
  -- 重複しているstripe_subscription_idを検出
  FOR dup_record IN
    SELECT stripe_subscription_id, COUNT(*) as cnt
    FROM public.subscriptions
    WHERE stripe_subscription_id IS NOT NULL
    GROUP BY stripe_subscription_id
    HAVING COUNT(*) > 1
  LOOP
    -- 最新のレコード以外をcancelledに更新
    UPDATE public.subscriptions
    SET
      status = 'cancelled',
      updated_at = NOW()
    WHERE stripe_subscription_id = dup_record.stripe_subscription_id
      AND id NOT IN (
        SELECT id
        FROM public.subscriptions
        WHERE stripe_subscription_id = dup_record.stripe_subscription_id
        ORDER BY created_at DESC
        LIMIT 1
      );

    RAISE NOTICE 'Cleaned up % duplicate records for stripe_subscription_id: %',
                 dup_record.cnt - 1,
                 dup_record.stripe_subscription_id;
  END LOOP;
END $$;

-- 2. stripe_subscription_idにユニーク制約を追加
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_stripe_subscription_id_unique
UNIQUE (stripe_subscription_id);

-- 3. 制約が正しく追加されたか確認
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'subscriptions_stripe_subscription_id_unique'
      AND table_name = 'subscriptions'
  ) THEN
    RAISE NOTICE '✅ ユニーク制約が正常に追加されました: subscriptions_stripe_subscription_id_unique';
  ELSE
    RAISE WARNING '⚠️ ユニーク制約の追加に失敗しました';
  END IF;
END $$;

-- =====================================================
-- 完了メッセージ
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Subscriptions修正マイグレーションが完了しました';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '変更内容:';
  RAISE NOTICE '1. 重複したstripe_subscription_idのクリーンアップ';
  RAISE NOTICE '2. stripe_subscription_idにユニーク制約を追加';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '1. アプリケーションを再起動';
  RAISE NOTICE '2. Stripe同期APIをテスト';
  RAISE NOTICE '3. サブスクリプション管理画面で動作確認';
END $$;

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

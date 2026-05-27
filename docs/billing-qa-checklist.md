# 課金まわり動作確認チェックリスト

このチェックリストは、Taskal AI の Stripe 課金、Supabase の購読状態、アプリ内の利用可否を突き合わせるためのものです。

Stripe の本番キーでは、実決済・解約・プラン変更などの破壊的操作を行わないでください。更新、解約、カード期限切れ、支払い失敗は Stripe の sandbox/test 環境とテストクロックで再現します。

## 参照元

- Stripe Go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Stripe Test clocks / Simulations: https://docs.stripe.com/billing/testing/test-clocks
- Stripe Customer Portal: https://docs.stripe.com/customer-management
- Stripe Webhooks: https://docs.stripe.com/webhooks
- Stripe Testing: https://docs.stripe.com/testing

## 事前確認

- [ ] `STRIPE_SECRET_KEY` と `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` の mode が一致している
- [ ] `STRIPE_PRICE_LIGHT_ID`、`STRIPE_PRICE_STANDARD_ID`、`STRIPE_PRICE_UNLIMITED_ID` が現在の料金と一致している
- [ ] Supabase `pricing_plans.stripe_price_id` が環境変数の Price ID と一致している
- [ ] 本番 webhook endpoint が `/api/stripe/webhook` を向いている
- [ ] webhook の対象イベントが必要最小限になっている
- [ ] live と sandbox/test の webhook secret を取り違えていない
- [ ] Stripe 側の商品・Price が active で、通貨が `jpy`、interval が `month` になっている

## Checkout

- [ ] 未ログインで `/api/stripe/checkout` を叩くと `401` が返る
- [ ] ログイン後、ライトプランで Checkout Session が作成される
- [ ] Checkout Session の `mode` が `subscription` になっている
- [ ] `client_reference_id` または `metadata.supabase_user_id` が設定されている
- [ ] Checkout Session の customer が `user_profiles.stripe_customer_id` に保存される
- [ ] 成功URLが `/subscription?checkout=success...` になっている
- [ ] キャンセルURLが `/pricing?checkout=cancelled` になっている
- [ ] 無関係な Payment Link や別サービスの商品が Taskal の購読として登録されない

## Webhook

- [ ] `checkout.session.completed` で `subscriptions` に購読が作成または更新される
- [ ] `customer.subscription.created` / `updated` で `plan_id`、`stripe_price_id`、期間、解約予定が同期される
- [ ] `invoice.paid` の更新時に `usage_count` がリセットされる
- [ ] `invoice.payment_failed` で `status` が `past_due` になる
- [ ] `customer.subscription.deleted` で `status` が `cancelled` になる
- [ ] 同じ webhook event を再送しても二重処理されない
- [ ] 処理成功後だけ `stripe_events` に保存される
- [ ] 無関係なStripeイベントは 500 にせず、ログに残してスキップする
- [ ] 遅延・重複・順不同のイベントでも最終状態が破綻しない

## Customer Portal

- [ ] 購読なしで `/api/stripe/portal` を叩くと `404` が返る
- [ ] 購読ありで Customer Portal URL が作成される
- [ ] 支払い方法の変更ができる
- [ ] プラン変更ができる
- [ ] 解約予約ができる
- [ ] 解約予約後、アプリの `cancel_at_period_end` 表示が更新される
- [ ] 解約取り消し後、アプリの表示が有効状態に戻る

## テストクロックで必ず再現する項目

- [ ] 初回サブスク作成
- [ ] 月次更新
- [ ] 更新後の `current_period_start` / `current_period_end` 更新
- [ ] 更新後の `usage_count` リセット
- [ ] 支払い失敗
- [ ] カード期限切れ
- [ ] 支払い方法更新後の回復
- [ ] 解約予約
- [ ] 契約期間終了後の解約完了
- [ ] プラン変更時の即時反映または次回更新適用

## アプリ内利用可否

- [ ] active の購読では採点できる
- [ ] past_due の購読では想定どおり制限される
- [ ] cancelled かつ期間終了後の購読では採点できない
- [ ] ライトは 10 回/月、スタンダードは 30 回/月、無制限は回数制限なしで判定される
- [ ] 利用回数が上限に達した場合は次回更新まで採点できない
- [ ] 更新後に回数がリセットされる

## 本番照合

- [ ] Stripe active subscriptions と Supabase `subscriptions` の active 行が一致する
- [ ] Stripe customer と Supabase `user_profiles.stripe_customer_id` が一致する
- [ ] Stripe Price ID と Supabase `subscriptions.stripe_price_id` が一致する
- [ ] Stripe 上の金額と Supabase `price_paid` が一致する
- [ ] `stripe_events` に無関係な別サービスのイベントが混ざっていないか確認する
- [ ] 混ざっている場合、Taskal 用 webhook endpoint をイベント種別・商品・metadata で防御する

## 今回確認した状態

- 本番環境は live Stripe キーを使用しているため、破壊的な課金操作は未実施。
- 現行の Stripe Price ID と Supabase `pricing_plans` は、ライト 480 円、スタンダード 980 円、無制限 1,580 円で一致。
- `/api/stripe/checkout`、`/api/stripe/portal`、`/api/stripe/sync` は未ログイン時に `401` を返す。
- 同じStripeアカウント内の別サービスと思われる Payment Link 由来イベントが `stripe_events` に存在した。Taskal側のユーザーに紐づかないイベントはスキップする修正を入れた。
- Stripe Test Clock を使った更新・支払い失敗・期限切れカード検証は、sandbox/test 環境が未準備のため未完了。

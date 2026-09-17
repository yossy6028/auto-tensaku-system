# 新規登録の実認証E2E

`auth-real.spec.ts` は実際のローカルSupabase AuthとMailpitを使います。アプリの認証をモックせず、メールのリンク、セッション、無料枠、端末登録を検証します。本番メール配送やStripe決済、AI採点は対象外です。

## 接続先

- アプリ: `http://127.0.0.1:3218`
- Supabase: `http://127.0.0.1:55431`
- Mailpit: `http://127.0.0.1:55434`
- PostgreSQL: `127.0.0.1:55432`
- 専用プロジェクト: `tascal-signup-e2e-20260917`

すべて127.0.0.1だけに公開します。既存のデフォルト54321番プロジェクトやリモートデータベースは使用しません。テストは毎回ランダムな `@example.test` アカウントとパスワードを作ります。

## 準備

1. 専用の一時ディレクトリの `supabase/config.toml` に、このディレクトリの `config.toml` をコピーします。
2. ローカルSupabaseを起動します。今回はCLI 2.117.0、PostgreSQL 17、GoTrue、PostgREST、Kong、Mailpitで検証しました。不要なRealtime、Storage、Studio、Edge Runtime、Analyticsは除外できます。
3. 実際のDockerポート割当を確認し、55431・55432・55434がすべて `127.0.0.1` に限定されていることを確認します。CLI 2.117.0ではネットワークの `host_binding_ipv4` 指定だけでは制限されないため、起動成功だけで判断しないでください。
4. 空の専用データベースに `python3 tests/e2e/local-supabase/bootstrap.py` を実行します。既存のユーザーまたはアプリのテーブルがあれば停止します。rootの歴史的な基礎SQLを先に適用し、その後 `supabase/migrations/` の最新版を順に適用します。
5. CLIのローカル接続情報から環境変数を設定します。値はログ・コード・Gitに保存しないでください。アプリには `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_APP_URL=http://127.0.0.1:3218` が必要です。AI・Stripe・実SMTPのキーを渡さないでください。
6. アプリを `npm run dev -- --webpack --hostname 127.0.0.1 --port 3218` で起動します。ファイル監視の上限に当たる環境では `WATCHPACK_POLLING=true` を使用します。

## 実行と終了

同じローカルSupabaseの環境変数をテストプロセスにも渡して、webディレクトリで実行します。

```sh
npx playwright test --config=playwright.auth.config.ts
```

ブラウザーが未導入の場合は、PlaywrightのChromiumを事前にインストールしてください。結果のtraceには合成アカウントの入力やセッション情報を含み得るため、`test-results/` はGit対象外です。

終了後は、専用アプリプロセスとこのプロジェクトのコンテナーだけを停止します。テストデータを削除するときも、専用プロジェクトを明示し、既存の別プロジェクトには触れないでください。

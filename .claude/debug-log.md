# Debug Log

## 2026-06-27 — Grok指摘ハードニング作業中の型エラー

### 事象
`web/` で `npx tsc --noEmit` 実行時、追加した OCR 枠ガードの行で型エラー:
`src/app/api/ocr/route.ts: error TS2345: Argument of type '{ p_user_id: string; }' is not assignable to parameter of type 'undefined'.`
（`supabase.rpc('can_use_service', { p_user_id: user.id })` 呼び出し）

### 根本原因
`@supabase/ssr` の `createServerClient<Database>` が返すクライアントの `.rpc()` は、
Database 型を渡してもジェネリック解決が不完全で、オーバーロードが `args: undefined` に
縮退することがある。grade ルートでは既にこれを把握しており、構造型
`SupabaseRpcClient = { rpc: (fn, args) => Promise<{data, error}> }` へキャストして回避していた。
OCR ルートで生の `supabase.rpc()` を新規に呼んだため同じ型エラーが顕在化した。

### 対処
grade ルートと同じ流儀に合わせ、OCR ルートにも `SupabaseRpcClient` 構造型を定義し、
`supabase as unknown as SupabaseRpcClient` でキャストして `.rpc()` を呼ぶよう修正。
新しい回避パターンを持ち込まず既存流儀に統一。

### 再発防止
- RPC を新規に呼ぶ際は `as unknown as SupabaseRpcClient` キャスト経由が本リポの作法、と本ログに明記。
- 検証は `tsc --noEmit`（src/ 配下のみ抽出）→ `eslint` → `next build`（exit 0 / Compiled successfully）で確認するフローを踏襲。

### 備考（既存・スコープ外）
`tests/e2e/smoke.spec.ts` の8件の型エラー（@playwright/test 未解決・implicit any）は
今回の変更前から存在する既存問題。本作業では未変更。

---

## 2026-06-27 — ツール操作上の良性エラー（自己訂正済み）

### 事象
- `package.json` / `.github/workflows/ci-minimal.yml` への Edit/Write が
  「File has not been read yet」で失敗。
- 一部 Edit/Write が「malformed tool call」で失敗。

### 根本原因
1. Bash の `cat`/`sed` でファイル内容を確認しただけで、ハーネスの read 追跡を満たす
   Read ツールを使っていなかった → 編集前 read 要件を満たさず失敗。
2. ツール呼び出しXMLの名前空間付きタグを一部で誤記。

### 対処 / 再発防止
- Edit/Write の直前は必ず Read ツールで対象を開く（Bash cat は read 追跡に不十分）。
- 未読の既存ファイルを編集する場合は Read を挟む。
- いずれも即訂正し、最終的に `next build` exit 0 で全体整合を確認済み。成果物への影響なし。

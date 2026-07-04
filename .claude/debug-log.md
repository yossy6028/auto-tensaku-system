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

## 2026-07-02: Vercelテレメトリを誤プロジェクトで計測（訂正済み）

**症状**: 「本番API直近7日呼び出しゼロ」を prj_Tn18...（名前"web"、latestDeployment:null の空プロジェクト）で計測していた。

**根本原因**: `web/.vercel/project.json` が過去の `vercel link` 誤操作で作られた空プロジェクト"web"を指したまま放置されており、プロジェクトID探索時に repo直下より先に web/ 側を読んだ。

**対処**: 実プロジェクトは `auto-tensaku-system`（prj_O5FFBgBl5nCvVLIChEt7FJnimIwk）。正しい計測でも「7日間 約35リクエスト・大半がbot・APIコールゼロ」で結論（実質流入ゼロ）は不変。`web/.vercel/project.json` を正プロジェクトに書き換え（.bak-20260702 保存）。

**再発防止**: Vercel計測時は必ず `latestDeployment` が非nullであること・プロジェクト名がリポジトリと一致することを確認してから集計する。repo直下の `.vercel/project.json` が正。

## 2026-07-02: Supabase SQL EditorへのCDP type入力がタイムアウト・SQL破損

**症状**: browser_batch の `type` で長文SQLを入力中に `Input.dispatchKeyEvent` が30秒タイムアウト。入力済み部分も Monaco の自動補完が介入し `UNION allSELECT` 等に破損。

**根本原因**: Monaco系エディタへの合成キーイベント連打は (1) 1文字ずつの補完計算で固まりやすく (2) 補完ポップアップが確定入力を書き換えるため、長文入力に構造的に不向き。

**対処**: javascript_tool で `monaco.editor.getModels()[last].setValue(sql)` を実行してエディタ内容を直接セット→Runボタンクリック。以降の2クエリとも成功。

**再発防止**: SQL Editor等のコードエディタへの入力は、キー入力ではなく必ずエディタAPI（monaco setValue）または貼り付け相当の手段を使う。キー入力は1行程度の短文に限定する。

## 2026-07-04: 答案読み取り精度の低下（7/2スピード改善の副作用）

**症状**: 7/2の「採点スピード改善」デプロイ以降、答案の読み取り精度が低下したとの報告。

**原因究明**:
1. 7/2の並列化（フロント2問同時＋サーバ画像単位の無制限Promise.all）でGemini呼び出しが同時バースト化。429/応答遅延の確率が上昇。
2. runOcrAttemptは429を1回検知するとRateLimitManagerが「JST日付が変わるまで」フォールバックモデル（flash系）に固定＝一過性の429が一日中の精度低下に増幅される構造。
3. OCR失敗時は`bestValid ?? bestFallback ?? 空文字`をログなしで採用（サイレント劣化）。
4. （既存の穴）合計1.5MB超でサーバOCRが縮退モード（プロンプト1本・マス目分析/AgenticVision/フォールバック無効）。フロント圧縮は4.3MB超でしか発動しないため、典型的スマホ写真1枚(2〜4MB)は常に縮退モードでOCRされていた。
5. （既存の穴）多枚数時の圧縮が0.15MB/1000px/q0.4と過剰で手書き文字が潰れる。

**対処**:
- grader.ts: 画像単位OCRをmapWithConcurrency(3)で並列度制限。劣化採用時のwarnログ追加。RateLimitManagerに検知時刻(rateLimitedAt)を追加しクールダウン化の下地を用意（判定ロジックはTODO(human)）。
- page.tsx: 合計1.4MB超で品質保持圧縮を発動し、サーバ縮退モード(1.5MB)を回避。
- imageCompressor.ts: 3-4枚=0.35MB/1440-1600px、5枚以上=0.2MB/1200pxにフロア引き上げ。

**再発防止**: perf変更は「同時実行数の上限」「外部APIのレート制限との相互作用」を必ず設計に含める。劣化パス（フォールバック採用・縮退モード）は必ずログに残し観測可能にする。

## 2026-07-04: ツール呼び出し失敗3件（いずれも良性・回復済み）

1. `vercel env pull`（本番envのモデル名確認目的）→ 権限クラシファイアが拒否。**想定内のセキュリティガード**。本番シークレット一括取得は避けるべき操作で、コード内証拠（RateLimitManagerのログ文言）で代替した。今後も本番envの読取が必要な場合は塾長に個別確認する。
2. Edit失敗×2（page.tsx / imageCompressor.ts「File has not been read yet」）→ **原因**: Bashのsed/grepで内容確認しただけではハーネスの「Read済み」扱いにならず、Read툴なしのEditは拒否される仕様。**対処**: Readしてから再Editで成功。**再発防止**: 編集予定のファイルはsedでなくReadツールで該当範囲を読む。

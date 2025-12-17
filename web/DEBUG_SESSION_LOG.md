# デバッグセッションログ

---

## セッション2: 画像最適化が止まる問題（スマホ）

### 発生日時
2025-12-17

### 問題の症状
- スマホで写真を撮ってアップロードすると「画像を最適化中...0%」で止まる
- 時々発生（3回に1回程度）
- 特に3枚目で必ず止まる

### 問題の経緯と対応

#### フェーズ1: 初期調査とデバッグログ追加
- **仮説**: `browser-image-compression`ライブラリがハング
- **対応**: デバッグログを追加（compressWithTimeout, compressImage, compressMultipleImages）
- **結果**: ログが収集できず、本番環境での問題のためローカル再現が必要

#### フェーズ2: Canvas APIフォールバック追加
- **仮説**: ライブラリがハングした場合のフォールバックが必要
- **対応**: 
  - Canvas APIベースのフォールバック圧縮を追加
  - タイムアウト短縮: 15秒→8秒、45秒→30秒、20秒→12秒
- **結果**: 6枚目で止まる（改善したが未解決）

#### フェーズ3: browser-image-compression完全廃止
- **仮説**: ライブラリ自体が不安定
- **対応**:
  - `browser-image-compression`を完全に廃止
  - Canvas APIのみの実装に変更
  - ファイル間に100ms遅延を追加
- **結果**: 3枚目で止まる（悪化）

#### フェーズ4: toBlob→toDataURL変更
- **仮説**: `canvas.toBlob()`のコールバックがスマホで呼ばれない
- **対応**:
  - `toBlob`（非同期コールバック）を`toDataURL`（同期）に変更
  - `dataURLtoBlob`変換関数を追加
  - タイムアウト短縮: 8秒→4秒、30秒→20秒、12秒→8秒
  - maxWidthOrHeight縮小: 2048→1600px
- **結果**: 依然として3枚目で止まる

#### フェーズ5: スマホメモリ制限対策（最終対応）
- **根本原因**: スマホブラウザ（特にiOS Safari）のメモリ制限
  - 大きな画像を連続処理すると3枚目あたりでメモリ枯渇
  - `toDataURL`の同期処理中にUIスレッドがブロック
  - ガベージコレクションが間に合わない
- **対応**:
  - maxWidthOrHeight: 1600px → **1000px**（メモリ使用量60%削減）
  - ファイル間遅延: 50ms → **500ms**（GC時間確保）
  - `requestAnimationFrame`でUI更新を保証
  - 各処理前後に`waitForNextFrame()`を追加
  - 処理フロー: 連続処理 → **各処理前後にフレーム待機**

#### フェーズ6: 非同期toBlob化 + createImageBitmap活用（現対応）
- **新たな仮説**: `toDataURL`が同期でブロッキングし、3枚目でUIフリーズが再発
- **対応**:
  - `canvas.toBlob`を優先（1.5sタイムアウト付き）、失敗時のみ`toDataURL`フォールバック
  - `createImageBitmap`を使ってデコードとリサイズを同時実行（成功時は1回のデコードで完結）
  - `withTimeout`ユーティリティで`createImageBitmap`/`toBlob`の両方に外部タイムアウトを付与
  - `drawToCanvas`が事前デコード済みの`ImageBitmap`/`HTMLImageElement`を再利用して余計なデコードを回避
- **目的**: メインスレッドのブロッキング削減とメモリ削減で「画像最適化0%フリーズ」を潰す

### 修正内容の詳細

| 項目 | 初期値 | 最終値 | 理由 |
|------|--------|--------|------|
| 圧縮ライブラリ | browser-image-compression | Canvas APIのみ | ライブラリが不安定 |
| 圧縮方式 | toBlob（非同期） | toDataURL（同期） | コールバックが呼ばれない |
| maxWidthOrHeight | 2048px | 1000px | メモリ使用量削減 |
| ファイル間遅延 | なし | 500ms | GC時間確保 |
| UI更新 | setTimeout | requestAnimationFrame | 確実なUI更新 |
| 1ファイルタイムアウト | 15秒 | 5秒 | 早めにフォールバック |
| 全体タイムアウト | 45秒 | 30秒 | 早めに打ち切り |

### コミット履歴
1. `eea7a0c` - fix: 画像最適化の安定性向上 - Canvas APIフォールバック追加
2. `4bf7dcd` - fix: 画像圧縮を完全にCanvas API化 - browser-image-compression廃止
3. `838efa7` - fix: 画像圧縮を同期的toDataURLベースに完全書き換え
4. `a0e73f5` - fix: スマホ対応 - メモリ制限対策

### 技術的学び
- スマホブラウザ（特にiOS Safari）はメモリ制限が厳しい
- `canvas.toBlob()`のコールバックは信頼できない（特にスマホ）
- `toDataURL`は同期処理で確実に値を返す
- 連続処理ではメモリ解放の時間を確保する必要がある
- `requestAnimationFrame`はUI更新とGCのタイミングを保証する

### 関連ファイル
- `web/src/lib/utils/imageCompressor.ts` - 画像圧縮ロジック（完全書き換え）
- `web/src/app/page.tsx` - フロントエンドUI（タイムアウト調整）

### 状態
- **最終対応**: スマホメモリ制限対策を実装
- **検証待ち**: ユーザーによる実機テスト

---

## セッション1: 2問中1問しか読み取れない問題

### 発生日時
2025-12-15

## 問題の経緯（モグラたたき状態の履歴）

### 1. AI採点が10分近くスタック
- **原因**: 4.2MBファイルがVercelペイロード制限（4.5MB）を超過
- **対応**: 画像圧縮の追加、サイズ制限チェック

### 2. 画像圧縮が0%から進まない  
- **原因**: WebWorkerが一部のブラウザ/環境で動作しない
- **対応**: `useWebWorker: false` に設定、30秒タイムアウト追加

### 3. 「無料体験期間が終了しました」エラー
- **原因**: `can_use_service`関数にadminロールチェック漏れ
- **対応**: Supabaseマイグレーションで関数修正（adminは無制限利用可能に）

### 4. 【現在】2問中1問しか答案を読み取れない
- **状態**: 調査中

---

## 修正済みの項目

1. **can_use_service関数** (Supabase)
   - adminロールの場合は無制限で利用可能に修正
   - マイグレーション: `fix_can_use_service_admin_check`

2. **imageCompressor.ts**
   - `useWebWorker: false` - メインスレッドで処理
   - 30秒のタイムアウト追加
   - 全体の圧縮タイムアウト: 120秒

---

## 現在のデバッグ仮説

| ID | 仮説 | 検証ポイント |
|----|------|-------------|
| A | 圧縮処理でサイズ制限（3.5MB）超過 | compressedFilesが途中で切られている |
| B | OCRループで1問目失敗後にreturn | OCR処理がエラーで中断されている |
| C | targetLabelsに2問目が含まれていない | selectedProblemsが正しく設定されていない |
| D | ocrResultsの状態が上書き | 結果が正しく蓄積されていない |
| E | ファイル追加時の問題 | pendingFilesからuploadedFilesへの移行が失敗 |

---

## 挿入したデバッグログ

### imageCompressor.ts
- `imageCompressor.ts:165` - compressMultipleImages開始時（仮説A）
- `imageCompressor.ts:240` - 各ファイル圧縮完了時（仮説A）
- `imageCompressor.ts:248` - サイズ制限超過時（仮説A）

### page.tsx
- `page.tsx:handleOcrStart` - OCR開始時（仮説C）
- `page.tsx:handleOcrStart:targetLabels` - targetLabels決定時（仮説C）
- `page.tsx:OCRLoop:start` - OCRループ開始時（仮説B）
- `page.tsx:OCRLoop:iteration` - 各ラベルの処理開始時（仮説B）
- `page.tsx:OCRLoop:success` - OCR成功時（仮説B,D）
- `page.tsx:OCRLoop:error` - OCRエラー時（仮説B）
- `page.tsx:OCRLoop:complete` - OCRループ完了時（仮説B,D）
- `page.tsx:FileRoleModal:confirm` - ファイル役割確定時（仮説E）

---

## 関連ファイル

- `web/src/lib/utils/imageCompressor.ts` - 画像圧縮ロジック
- `web/src/app/page.tsx` - フロントエンドUI、OCR処理
- `web/src/app/api/ocr/route.ts` - OCR APIルート
- `web/src/app/api/grade/route.ts` - 採点APIルート

---

## 技術的制約

- Vercelペイロード制限: 4.5MB
- 設定した内部制限: 3.5MB（安全マージン）
- maxDuration: 300秒（Vercel Pro）
- 画像圧縮: browser-image-compression使用

---

## 次のステップ

1. ユーザーに再現操作を依頼
2. デバッグログを収集（`.cursor/debug.log`）
3. 仮説を検証（CONFIRMED/REJECTED/INCONCLUSIVE）
4. 根本原因を特定して修正
5. 修正後の検証
6. デバッグログを削除

---

## 再現手順

1. Vercelのデプロイが完了するまで1-2分待つ
2. ブラウザを強制リロード（Ctrl+Shift+R または Cmd+Shift+R）
3. スマホで撮影した問題画像（2枚）、解答画像（1枚）、答案画像（1枚）をアップロード
4. ファイルの役割を設定して「確定」
5. 2問分の問題番号を選択（例：(1)と(2)）
6. 「答案を読み取る」ボタンをクリック
7. 1問しか読み取れない状態が再現されることを確認

# デバッグセッションログ: 2問中1問しか読み取れない問題

## 発生日時
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


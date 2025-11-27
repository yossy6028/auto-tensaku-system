# AGENT

- 返答は必ず日本語で行うこと。
- プロジェクト: auto-tensaku-system（国語記述答案の自動採点）。複数PDF/画像のアップロードでは答案・問題文・模範解答を区別して処理する設計。
- 編集時は既存のTypeScript/Next.js構成とプロンプト仕様を尊重し、破壊的変更を避けること。

## デプロイ関連の問題と解消法

### 問題1: Vercelデプロイ時のモジュール解決エラー

**症状:**
- `Module not found: Can't resolve '@supabase/ssr'` エラー
- `Module not found: Can't resolve './essayGradingGuide'` エラー
- ビルドがルートディレクトリで実行される（`web`ディレクトリが認識されない）

**原因:**
1. **Root Directoryが設定されていない**: Vercelがリポジトリのルートディレクトリをプロジェクトルートとして認識し、`web`ディレクトリ内の`package.json`を見つけられない
2. **必要なファイルがGitに追加されていない**: `gradingCriteria.ts`、`supabase`関連ファイル、認証コンポーネントなどがGitに含まれていない
3. **依存関係の不足**: `@supabase/ssr`や`@supabase/supabase-js`が`package.json`に明示的に追加されていない

**解消法:**

#### 1. VercelダッシュボードでのRoot Directory設定（必須）
1. Vercelダッシュボード → プロジェクト → **Settings** → **General**
2. **Root Directory** を `web` に設定
3. **Save** をクリック
4. 最新のコミットで再デプロイ

#### 2. 必要なファイルをGitに追加
以下のファイルがGitに含まれていることを確認：
- `web/src/lib/prompts/gradingCriteria.ts`
- `web/src/lib/prompts/essayGradingGuide.ts`
- `web/src/lib/supabase/` (client.ts, server.ts, types.ts)
- `web/src/components/AuthProvider.tsx`
- `web/src/components/AuthModal.tsx`
- `web/src/middleware.ts`
- その他の認証・管理画面関連ファイル

#### 3. 依存関係の確認
`web/package.json`に以下が含まれていることを確認：
```json
{
  "dependencies": {
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.84.0"
  }
}
```

#### 4. vercel.jsonの扱い
- **ルートディレクトリの`vercel.json`は削除**: VercelダッシュボードのRoot Directory設定を使用
- **`web/vercel.json`は残す**: Next.jsプロジェクトの設定として（オプション）

### 問題2: Turbopackのroot誤認

**症状:**
- Turbopackがリポジトリ直下をworkspace rootと誤認する

**解消法:**
`web/next.config.ts`に以下を追加：
```typescript
import { fileURLToPath } from "url";
import path from "path";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: {
    root: dirname, // Turbopackのroot誤検出を防ぐ
  },
};

export default nextConfig;
```

### チェックリスト（デプロイ前）

- [ ] VercelダッシュボードでRoot Directoryが`web`に設定されている
- [ ] すべての必要なファイルがGitに追加されている（`git status`で確認）
- [ ] `web/package.json`に必要な依存関係が含まれている
- [ ] 最新のコミットでデプロイしている
- [ ] 環境変数がVercelに設定されている（GEMINI_API_KEY, MODEL_NAME, Supabase関連）

### トラブルシューティング

**ビルドログで古いコミットが表示される場合:**
- Vercelダッシュボードで最新のコミットを選択して再デプロイ
- デプロイキャッシュをクリアして再デプロイ

**Root Directory設定が反映されない場合:**
- Settings → General でRoot Directoryを一度削除してから再度`web`を設定
- プロジェクトを削除して再インポート（最終手段）

## ⚠️ セキュリティ: 機密情報の漏洩対策

### 機密情報がGitHubにプッシュされた場合の対応

**重要**: 機密情報（APIキー、パスワード、トークンなど）がGitHubに公開された場合、以下を**即座に実行**してください：

#### 1. 現在のファイルから機密情報を削除（完了済み）
- ✅ `DEPLOY.md`から機密情報を削除済み

#### 2. **即座にAPIキーを無効化・再生成（最重要）**
1. **Gemini APIキー**:
   - Google Cloud Console (https://console.cloud.google.com/) にアクセス
   - 「APIとサービス」→「認証情報」を開く
   - 漏洩したAPIキーを**削除または無効化**
   - 新しいAPIキーを生成
   - `.env.local`とVercelの環境変数を新しいキーに更新

2. **Supabaseキー**:
   - Supabaseダッシュボード (https://app.supabase.com/) にアクセス
   - 「Settings」→「API」を開く
   - 漏洩したキーを確認
   - 必要に応じてキーをローテーション
   - Vercelの環境変数を更新

#### 3. Git履歴から機密情報を削除
Git履歴には機密情報が残っているため、以下を実行：

```bash
# BFG Repo-Cleanerを使用（推奨）
# または git filter-repo を使用

# 機密情報を含むコミットを特定
git log --all --full-history -p -S "AIzaSy" -- DEPLOY.md

# 機密情報を置換（例：git filter-repo使用）
# 注意: これは破壊的操作です。共有リポジトリの場合は全員に周知が必要です
```

#### 4. 今後の対策
- ✅ `.gitignore`に`.env*`ファイルが追加されていることを確認済み
- ✅ `DEPLOY.md`などのドキュメントに機密情報を含めない
- 環境変数は`.env.local`に保存し、Gitにコミットしない
- ドキュメントに環境変数の例を書く場合は、`<YOUR_API_KEY>`のようなプレースホルダーを使用

### チェックリスト（機密情報漏洩時）

- [ ] 漏洩したAPIキー/トークンを無効化
- [ ] 新しいAPIキー/トークンを生成
- [ ] `.env.local`とVercelの環境変数を更新
- [ ] 現在のファイルから機密情報を削除
- [ ] Git履歴から機密情報を削除（可能であれば）
- [ ] `.gitignore`に`.env*`が含まれていることを確認

## ⚠️ AI支援時の注意事項

### 問題: AIのカットオフ日による最新情報の欠落

**発生した事象（2024年11月）:**
- Gemini APIのモデル名 `gemini-3-pro-image-preview` が正しく認識されなかった
- AIがカットオフ日以前の情報に基づき、「このモデルは存在しない」と誤判断
- 結果として、長時間のデバッグが発生

**根本原因:**
- AIの学習データにはカットオフ日があり、それ以降にリリースされたAPI/モデル/ライブラリの情報を持っていない
- 特に、プレビュー版やベータ版のモデル名は頻繁に変更される

**教訓と対策:**

#### AIに依頼する側（ユーザー）
1. **最新のAPI/モデル名は公式ドキュメントで確認**してからAIに伝える
2. APIエラーが発生した場合、**正確なモデルコード**を公式サイトから取得して共有する
3. AIが「存在しない」と言っても、**公式ドキュメントを優先**する

#### AIアシスタント側
1. **外部API/モデル名の判断には慎重に** - カットオフ日以降の情報は持っていない可能性がある
2. 不明なモデル名やAPIについては、**ユーザーに公式ドキュメントでの確認を依頼**する
3. 「このモデルは存在しない」と断定せず、「カットオフ日の関係で最新情報を持っていない可能性がある」と伝える
4. APIエラーが発生した場合、**まずモデル名/エンドポイントの正確性をユーザーに確認**する

### チェックリスト（API関連の問題発生時）

- [ ] 使用しているモデル名/APIバージョンは公式ドキュメントで確認したか
- [ ] 環境変数（MODEL_NAME等）の値は正確か
- [ ] プレビュー版/ベータ版のモデルは名称が変更されていないか
- [ ] AIの回答が最新情報と矛盾していないか（カットオフ日の問題）

## 技術的な注意事項

### Vercelサーバーレス環境の制限

**問題: pdf-to-imgライブラリが動作しない**

**症状:**
- ローカル開発環境では動作するが、Vercelではタイムアウト
- `FUNCTION_INVOCATION_TIMEOUT` エラー

**原因:**
- `pdf-to-img`はCanvas/Popplerなどのネイティブ依存関係を必要とする
- Vercelのサーバーレス環境にはこれらがインストールされていない

**解消法:**
- PDF変換をスキップし、PDFを直接Gemini APIに送信（Gemini 2.0以降はPDFを直接読める）
- または、純粋なJavaScript実装のPDFライブラリを使用

### Next.js App Routerでのタイムアウト設定

**正しい設定方法:**
```typescript
// src/app/api/grade/route.ts
export const maxDuration = 60; // 秒数（Proプランで最大60秒）
export const dynamic = 'force-dynamic';
```

**注意:**
- `vercel.json`の`functions`設定はApp Routerでは効かない
- ルートファイル内で`export const maxDuration`を設定する必要がある
- Hobbyプランは最大10秒、Proプランは最大60秒

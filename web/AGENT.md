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

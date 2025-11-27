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

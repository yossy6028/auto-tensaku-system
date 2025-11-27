# デプロイ手順

## Vercelへのデプロイ（推奨）

### 前提条件
- GitHubアカウント
- Vercelアカウント（https://vercel.com）
- Supabaseプロジェクト（既に設定済み）

### 手順

#### 1. Vercelアカウントの作成・ログイン
1. https://vercel.com にアクセス
2. GitHubアカウントでログイン

#### 2. プロジェクトのインポート
1. Vercelダッシュボードで「Add New...」→「Project」
2. GitHubリポジトリ `yossy6028/auto-tensaku-system` を選択
3. **⚠️ 最重要**: 「Configure Project」画面で「Root Directory」を設定
   - 「Root Directory」の右側の「Edit」ボタンをクリック
   - テキストボックスに `web` と入力
   - これにより、`web`ディレクトリがプロジェクトのルートとして認識されます
4. 「Framework Preset」は「Next.js」が自動検出されます
5. 「Build and Output Settings」は自動検出されます（`web/vercel.json`の設定を使用）

#### 3. 環境変数の設定
Vercelのプロジェクト設定で以下の環境変数を設定：

```
GEMINI_API_KEY=<あなたのGemini APIキー>
MODEL_NAME=gemini-3-pro-image-preview
NEXT_PUBLIC_SUPABASE_URL=<あなたのSupabase URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<あなたのSupabase Anon Key>
```

⚠️ **重要**: 機密情報は絶対にGitリポジトリにコミットしないでください。環境変数は`.env.local`ファイルに保存し、`.gitignore`で除外されています。

**設定方法:**
1. Vercelプロジェクトの「Settings」→「Environment Variables」
2. 各環境変数を追加（Production, Preview, Developmentすべてに設定推奨）

#### 4. ビルド設定の確認
- **Root Directory**: `web`
- **Build Command**: `npm run build` (自動検出)
- **Output Directory**: `.next` (自動検出)
- **Install Command**: `npm install` (自動検出)

#### 5. デプロイ実行
1. 「Deploy」ボタンをクリック
2. デプロイが完了すると、URLが生成されます（例: `https://auto-tensaku-system.vercel.app`）

### 環境変数のセキュリティ
⚠️ **本番環境では環境変数の値を再生成することを推奨します**

特に：
- `GEMINI_API_KEY`: 新しいAPIキーを生成
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseのダッシュボードで確認

---

## その他のデプロイ方法

### Railway
1. https://railway.app にサインアップ
2. GitHubリポジトリを接続
3. Root Directoryを `web` に設定
4. 環境変数を設定
5. デプロイ

### Render
1. https://render.com にサインアップ
2. 「New Web Service」を選択
3. GitHubリポジトリを接続
4. Root Directory: `web`
5. Build Command: `npm run build`
6. Start Command: `npm start`
7. 環境変数を設定

### 自前サーバー
1. サーバーにNode.js 18+をインストール
2. リポジトリをクローン
3. `cd web && npm install && npm run build`
4. `npm start`で起動
5. Nginxなどでリバースプロキシ設定

---

## トラブルシューティング

### ビルドエラー

#### 「Module not found: Can't resolve '@supabase/ssr'」エラー
このエラーが出た場合、以下を確認してください：

1. **Root Directoryが`web`に設定されているか確認**
   - Vercelダッシュボード → Settings → General
   - 「Root Directory」が`web`になっているか確認
   - なっていない場合、`web`に変更して再デプロイ

2. **package.jsonが正しく認識されているか確認**
   - `web/package.json`に`@supabase/ssr`が含まれているか確認
   - 含まれている場合は、Root Directoryの設定が間違っている可能性が高い

3. **vercel.jsonの場所**
   - `web/vercel.json`が存在することを確認
   - ルートディレクトリに`vercel.json`がある場合は削除

#### その他のビルドエラー
- 環境変数が正しく設定されているか確認
- ビルドログを確認して、エラーの詳細を把握

### APIエラー
- 環境変数がVercelに正しく設定されているか確認
- Supabaseの接続設定を確認

### PDF変換エラー
- `pdf-to-img`ライブラリが動作しない場合、PDFを直接Geminiに送信します
- 本番環境では問題ありません（GeminiがPDFを直接読めます）


#!/bin/bash

# 自動添削システム - 統合起動スクリプト
# 使用方法: ./自動添削システム.sh [dev|build|start]

cd "$(dirname "$0")/../web"

# コマンドの取得（デフォルトはdev）
COMMAND=${1:-dev}

echo "=========================================="
echo "自動添削システム"
echo "=========================================="
echo ""

# 環境変数ファイルの確認
if [ ! -f .env.local ]; then
    echo "⚠️  警告: .env.local ファイルが見つかりません"
    echo "   環境変数を設定してください"
    echo ""
fi

# node_modulesの確認
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストールしています..."
    npm install
    echo ""
fi

case $COMMAND in
    dev)
        # ポート3000が使用中の場合は停止
        if lsof -ti:3000 > /dev/null 2>&1; then
            echo "⚠️  ポート3000が使用中です。既存のプロセスを停止します..."
            lsof -ti:3000 | xargs kill -9 2>/dev/null || true
            sleep 2
        fi

        echo "🚀 開発サーバーを起動しています..."
        echo "   ブラウザで http://localhost:3000 を開いてください"
        echo "   停止するには Ctrl+C を押してください"
        echo ""

        # サーバー起動後にブラウザを自動で開く
        npm run dev &
        DEV_PID=$!

        # サーバーが起動するまで待機（最大15秒）
        echo "⏳ サーバーの起動を待機しています..."
        for i in {1..15}; do
            if curl -s http://localhost:3000 > /dev/null 2>&1; then
                echo ""
                echo "✅ サーバーが起動しました。ブラウザを開いています..."
                sleep 1
                # macOSでブラウザを開く
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    open http://localhost:3000
                elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                    xdg-open http://localhost:3000
                elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
                    start http://localhost:3000
                fi
                break
            fi
            echo -n "."
            sleep 1
        done
        echo ""

        # フォアグラウンドで実行を継続
        wait $DEV_PID
        ;;
    build)
        echo "🔨 ビルドを実行しています..."
        npm run build
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ ビルドが完了しました"
            echo "   本番サーバーを起動するには: ./自動添削システム.sh start"
        else
            echo ""
            echo "❌ ビルドに失敗しました"
            exit 1
        fi
        ;;
    start)
        if [ ! -d ".next" ]; then
            echo "⚠️  警告: .next ディレクトリが見つかりません"
            echo "   事前にビルドを実行してください: ./自動添削システム.sh build"
            echo ""
            exit 1
        fi

        # ポート3000が使用中の場合は停止
        if lsof -ti:3000 > /dev/null 2>&1; then
            echo "⚠️  ポート3000が使用中です。既存のプロセスを停止します..."
            lsof -ti:3000 | xargs kill -9 2>/dev/null || true
            sleep 2
        fi

        echo "🚀 本番サーバーを起動しています..."
        echo "   ブラウザで http://localhost:3000 を開いてください"
        echo "   停止するには Ctrl+C を押してください"
        echo ""

        # サーバー起動後にブラウザを自動で開く
        npm start &
        START_PID=$!

        # サーバーが起動するまで待機（最大15秒）
        echo "⏳ サーバーの起動を待機しています..."
        for i in {1..15}; do
            if curl -s http://localhost:3000 > /dev/null 2>&1; then
                echo ""
                echo "✅ サーバーが起動しました。ブラウザを開いています..."
                sleep 1
                # macOSでブラウザを開く
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    open http://localhost:3000
                elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                    xdg-open http://localhost:3000
                elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
                    start http://localhost:3000
                fi
                break
            fi
            echo -n "."
            sleep 1
        done
        echo ""

        # フォアグラウンドで実行を継続
        wait $START_PID
        ;;
    *)
        echo "使用方法: ./自動添削システム.sh [dev|build|start]"
        echo ""
        echo "コマンド:"
        echo "  dev    - 開発サーバーを起動します（デフォルト）"
        echo "  build  - 本番用にビルドします"
        echo "  start  - 本番サーバーを起動します（事前にビルドが必要）"
        echo ""
        echo "例:"
        echo "  ./自動添削システム.sh        # 開発サーバーを起動"
        echo "  ./自動添削システム.sh dev    # 開発サーバーを起動"
        echo "  ./自動添削システム.sh build  # ビルドを実行"
        echo "  ./自動添削システム.sh start  # 本番サーバーを起動"
        exit 1
        ;;
esac


@echo off
REM 自動添削システム - 開発サーバー起動スクリプト（Windows用）
REM 使用方法: start_dev.bat

cd /d "%~dp0\..\web"

echo ==========================================
echo 自動添削システム - 開発サーバーを起動します
echo ==========================================
echo.

REM 環境変数ファイルの確認
if not exist .env.local (
    echo ⚠️  警告: .env.local ファイルが見つかりません
    echo    環境変数を設定してください
    echo.
)

REM node_modulesの確認
if not exist "node_modules" (
    echo 📦 依存関係をインストールしています...
    call npm install
    echo.
)

REM ポート3000が使用中の場合は停止（PowerShellを使用）
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo 🚀 開発サーバーを起動しています...
echo    ブラウザで http://localhost:3000 を開いてください
echo.

REM バックグラウンドでサーバーを起動し、少し待ってからブラウザを開く
start /B npm run dev

REM サーバーが起動するまで待機（最大10秒）
echo ⏳ サーバーの起動を待機しています...
timeout /t 5 /nobreak >nul

REM ブラウザを開く
start http://localhost:3000

echo ✅ ブラウザを開きました。
echo.

REM サーバープロセスをフォアグラウンドで実行
call npm run dev

pause


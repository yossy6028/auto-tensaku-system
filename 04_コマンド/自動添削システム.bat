@echo off
REM 自動添削システム - 統合起動スクリプト（Windows用）
REM 使用方法: 自動添削システム.bat [dev|build|start]

cd /d "%~dp0\..\web"

REM コマンドの取得（デフォルトはdev）
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=dev

echo ==========================================
echo 自動添削システム
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

if "%COMMAND%"=="dev" goto dev
if "%COMMAND%"=="build" goto build
if "%COMMAND%"=="start" goto start
goto usage

:dev
REM ポート3000が使用中の場合は停止（PowerShellを使用）
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo 🚀 開発サーバーを起動しています...
echo    ブラウザで http://localhost:3000 を開いてください
echo    停止するには Ctrl+C を押してください
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
goto end

:build
echo 🔨 ビルドを実行しています...
call npm run build
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ ビルドが完了しました
    echo    本番サーバーを起動するには: 自動添削システム.bat start
) else (
    echo.
    echo ❌ ビルドに失敗しました
    exit /b 1
)
goto end

:start
if not exist ".next" (
    echo ⚠️  警告: .next ディレクトリが見つかりません
    echo    事前にビルドを実行してください: 自動添削システム.bat build
    echo.
    exit /b 1
)

REM ポート3000が使用中の場合は停止（PowerShellを使用）
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

echo 🚀 本番サーバーを起動しています...
echo    ブラウザで http://localhost:3000 を開いてください
echo    停止するには Ctrl+C を押してください
echo.

REM バックグラウンドでサーバーを起動し、少し待ってからブラウザを開く
start /B npm start

REM サーバーが起動するまで待機（最大10秒）
echo ⏳ サーバーの起動を待機しています...
timeout /t 5 /nobreak >nul

REM ブラウザを開く
start http://localhost:3000

echo ✅ ブラウザを開きました。
echo.

REM サーバープロセスをフォアグラウンドで実行
call npm start
goto end

:usage
echo 使用方法: 自動添削システム.bat [dev^|build^|start]
echo.
echo コマンド:
echo   dev    - 開発サーバーを起動します（デフォルト）
echo   build  - 本番用にビルドします
echo   start  - 本番サーバーを起動します（事前にビルドが必要）
echo.
echo 例:
echo   自動添削システム.bat        # 開発サーバーを起動
echo   自動添削システム.bat dev    # 開発サーバーを起動
echo   自動添削システム.bat build  # ビルドを実行
echo   自動添削システム.bat start  # 本番サーバーを起動
exit /b 1

:end
pause


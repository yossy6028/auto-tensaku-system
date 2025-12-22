/**
 * Supabaseマイグレーション自動実行スクリプト
 *
 * 使用方法:
 *   CONFIRM=yes npx tsx scripts/run-migration.ts
 *
 * 必要な環境変数:
 *   DATABASE_URL または SUPABASE_DB_URL (PostgreSQL接続文字列)
 *
 * DATABASE_URLの取得方法:
 *   1. https://app.supabase.com にアクセス
 *   2. プロジェクトを選択
 *   3. Settings > Database
 *   4. Connection string > URI をコピー
 *   5. [YOUR-PASSWORD] を実際のパスワードに置き換え
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

// 環境変数の読み込み
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ エラー: DATABASE_URLが設定されていません\n');
  console.log('環境変数に以下を設定してください:');
  console.log('  DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[HOST]/postgres\n');
  console.log('DATABASE_URLの取得方法:');
  console.log('  1. https://app.supabase.com にアクセス');
  console.log('  2. プロジェクトを選択');
  console.log('  3. Settings > Database');
  console.log('  4. Connection string > URI をコピー');
  console.log('  5. [YOUR-PASSWORD] を実際のパスワードに置き換え\n');
  console.log('例:');
  console.log('  DATABASE_URL=postgresql://postgres:your-password@db.kwvakmokxxtgguiyognn.supabase.co:5432/postgres npx tsx scripts/run-migration.ts\n');
  process.exit(1);
}

async function runMigration() {
  console.log('🚀 マイグレーション実行を開始します...\n');

  // PostgreSQLクライアントを作成
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Supabaseの場合、SSLが必要
  });

  try {
    // マイグレーションファイルを読み込み
    const migrationPath = join(process.cwd(), 'supabase_migration_fix_subscription_unique.sql');
    console.log(`📄 マイグレーションファイルを読み込み: ${migrationPath}`);

    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📊 マイグレーション内容:');
    console.log('  - 重複したstripe_subscription_idのクリーンアップ');
    console.log('  - stripe_subscription_idにユニーク制約を追加\n');

    // 重要な警告メッセージ
    console.log('⚠️  重要: 続行する前に以下を確認してください:');
    console.log('  1. データベースの最新バックアップがあることを確認');
    console.log('  2. Supabase Settings > Database > Database backups で確認可能');
    console.log('  3. 可能であれば、本番環境のコピーでテスト実行してください\n');

    // マイグレーション実行の確認
    console.log('⚠️  本番環境のデータベースを変更します。続行しますか？');
    console.log('続行する場合は、次のコマンドで実行してください:');
    console.log('  CONFIRM=yes DATABASE_URL=your-db-url npx tsx scripts/run-migration.ts\n');

    if (process.env.CONFIRM !== 'yes') {
      console.log('ℹ️  安全のため、マイグレーションは実行されませんでした');
      console.log('実行する場合は、CONFIRM=yes を設定してください');
      process.exit(0);
    }

    console.log('🔄 データベースに接続中...\n');
    await client.connect();
    console.log('✅ データベースに接続しました\n');

    // 実行前のデータ状態を記録
    console.log('📊 実行前のデータ状態を記録中...');
    const beforeState = await client.query(`
      SELECT
        COUNT(*) as total_subscriptions,
        COUNT(DISTINCT stripe_subscription_id) as unique_stripe_ids,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM public.subscriptions
    `);
    console.log('実行前の状態:', beforeState.rows[0], '\n');

    // トランザクション開始
    console.log('🔒 トランザクションを開始します...');
    await client.query('BEGIN');

    console.log('🔄 マイグレーションを実行中...\n');

    // SQLを実行
    const result = await client.query(migrationSQL);

    // トランザクションをコミット
    await client.query('COMMIT');
    console.log('✅ トランザクションをコミットしました\n');

    console.log('✅ マイグレーションが正常に完了しました！\n');

    // 実行後のデータ状態を記録
    console.log('📊 実行後のデータ状態を確認中...');
    const afterState = await client.query(`
      SELECT
        COUNT(*) as total_subscriptions,
        COUNT(DISTINCT stripe_subscription_id) as unique_stripe_ids,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM public.subscriptions
    `);
    console.log('実行後の状態:', afterState.rows[0]);

    // 変更の比較
    const before = beforeState.rows[0];
    const after = afterState.rows[0];
    console.log('\n📈 変更のサマリー:');
    console.log(`  - 総サブスクリプション数: ${before.total_subscriptions} → ${after.total_subscriptions}`);
    console.log(`  - アクティブ数: ${before.active_count} → ${after.active_count}`);
    console.log(`  - キャンセル数: ${before.cancelled_count} → ${after.cancelled_count}\n`);

    // 確認クエリを実行
    console.log('🔍 制約が正しく追加されたか確認中...');
    const checkResult = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'subscriptions'
        AND constraint_name = 'subscriptions_stripe_subscription_id_unique'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ ユニーク制約が正常に追加されました:', checkResult.rows[0]);
    } else {
      console.warn('⚠️  ユニーク制約が見つかりませんでした。手動で確認してください。');
    }

    // 重複チェック
    console.log('\n🔍 重複データがないか確認中...');
    const dupCheck = await client.query(`
      SELECT stripe_subscription_id, COUNT(*) as cnt
      FROM public.subscriptions
      WHERE stripe_subscription_id IS NOT NULL
      GROUP BY stripe_subscription_id
      HAVING COUNT(*) > 1
    `);

    if (dupCheck.rows.length > 0) {
      console.warn('⚠️  まだ重複データが存在します:');
      console.table(dupCheck.rows);
    } else {
      console.log('✅ 重複データはありません');
    }

    console.log('\n✨ 次のステップ:');
    console.log('  1. アプリケーションを再起動: cd web && npm run dev');
    console.log('  2. サブスクリプション管理画面で動作確認');
    console.log('  3. Stripe同期APIをテスト: fetch(\'/api/stripe/sync\', { method: \'POST\' })');

  } catch (error: any) {
    // エラー発生時はロールバック
    console.error('\n❌ マイグレーション実行エラー:', error.message);

    try {
      console.log('🔄 トランザクションをロールバック中...');
      await client.query('ROLLBACK');
      console.log('✅ ロールバックしました。データベースは変更されていません。\n');
    } catch (rollbackError) {
      console.error('⚠️  ロールバック中にエラーが発生しました:', rollbackError);
    }

    if (error.code) {
      console.error('エラーコード:', error.code);
    }
    if (error.detail) {
      console.error('詳細:', error.detail);
    }
    if (error.hint) {
      console.error('ヒント:', error.hint);
    }

    console.log('\n💡 代替方法: Supabaseダッシュボードから手動で実行');
    console.log('  1. https://app.supabase.com にアクセス');
    console.log('  2. プロジェクトを選択');
    console.log('  3. SQL Editorを開く');
    console.log('  4. supabase_migration_fix_subscription_unique.sql の内容を貼り付けて実行');
    process.exit(1);
  } finally {
    // 接続を閉じる
    await client.end();
  }
}

// スクリプト実行
runMigration();

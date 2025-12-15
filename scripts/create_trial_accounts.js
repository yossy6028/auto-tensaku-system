/**
 * トライアルアカウント作成スクリプト
 * 5日間、15回限定のトライアルアカウントを3つ作成
 * 
 * 使用方法:
 * 1. 環境変数を設定:
 *    export SUPABASE_URL="your-project-url"
 *    export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
 * 
 * 2. スクリプトを実行:
 *    node scripts/create_trial_accounts.js
 */

// webディレクトリのnode_modulesを使用
const path = require('path');
const { createClient } = require(path.join(__dirname, '../web/node_modules/@supabase/supabase-js'));

// 環境変数から設定を取得
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('エラー: SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  console.error('');
  console.error('環境変数の設定方法:');
  console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

// Service Role Keyを使用してAdmin権限のクライアントを作成
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// トライアルアカウント情報
const trialAccounts = [
  {
    email: 'trial1@example.com',
    password: 'Trial1@2024',
    displayName: 'トライアルユーザー1'
  },
  {
    email: 'trial2@example.com',
    password: 'Trial2@2024',
    displayName: 'トライアルユーザー2'
  },
  {
    email: 'trial3@example.com',
    password: 'Trial3@2024',
    displayName: 'トライアルユーザー3'
  }
];

async function createTrialAccount(account) {
  try {
    console.log(`\nアカウント作成中: ${account.email}`);
    
    // 1. ユーザーを作成
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // メール確認をスキップ
      user_metadata: {
        display_name: account.displayName
      }
    });

    if (authError) {
      // ユーザーが既に存在する場合
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log(`  ⚠️  ユーザーは既に存在します: ${account.email}`);
        
        // 既存ユーザーのIDを取得
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === account.email);
        
        if (!existingUser) {
          throw new Error(`ユーザー ${account.email} が見つかりません`);
        }
        
        // プロファイルを更新
        const { error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            free_trial_started_at: new Date().toISOString(),
            free_trial_usage_count: 0,
            custom_trial_days: 5,
            custom_trial_usage_limit: 15,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);
        
        if (profileError) {
          throw profileError;
        }
        
        console.log(`  ✅ プロファイルを更新しました (ID: ${existingUser.id})`);
        return {
          email: account.email,
          password: account.password,
          userId: existingUser.id,
          isNew: false
        };
      }
      throw authError;
    }

    if (!authData?.user) {
      throw new Error('ユーザー作成に失敗しました');
    }

    const userId = authData.user.id;
    console.log(`  ✅ ユーザーを作成しました (ID: ${userId})`);

    // 2. プロファイルを更新（カスタムトライアル設定）
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        free_trial_started_at: new Date().toISOString(),
        free_trial_usage_count: 0,
        custom_trial_days: 5,
        custom_trial_usage_limit: 15,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error(`  ⚠️  プロファイル更新エラー: ${profileError.message}`);
      // プロファイルはトリガーで自動作成される可能性があるため、少し待ってから再試行
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { error: retryError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          free_trial_started_at: new Date().toISOString(),
          free_trial_usage_count: 0,
          custom_trial_days: 5,
          custom_trial_usage_limit: 15,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (retryError) {
        throw retryError;
      }
    }

    console.log(`  ✅ プロファイルを更新しました`);
    
    return {
      email: account.email,
      password: account.password,
      userId: userId,
      isNew: true
    };
  } catch (error) {
    console.error(`  ❌ エラー: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('========================================');
  console.log('トライアルアカウント作成スクリプト');
  console.log('========================================\n');

  const results = [];
  
  for (const account of trialAccounts) {
    try {
      const result = await createTrialAccount(account);
      results.push(result);
    } catch (error) {
      console.error(`アカウント作成失敗: ${account.email} - ${error.message}`);
      results.push({
        email: account.email,
        password: account.password,
        error: error.message
      });
    }
  }

  console.log('\n========================================');
  console.log('作成結果');
  console.log('========================================\n');
  
  console.log('以下のアカウント情報を使用してください:\n');
  
  results.forEach((result, index) => {
    if (result.error) {
      console.log(`${index + 1}. ${result.email}`);
      console.log(`   パスワード: ${result.password}`);
      console.log(`   ❌ エラー: ${result.error}\n`);
    } else {
      console.log(`${index + 1}. ${result.email}`);
      console.log(`   パスワード: ${result.password}`);
      console.log(`   ユーザーID: ${result.userId}`);
      console.log(`   トライアル期間: 5日間`);
      console.log(`   利用回数上限: 15回`);
      console.log(`   ステータス: ${result.isNew ? '新規作成' : '既存ユーザーを更新'}\n`);
    }
  });

  console.log('========================================');
  console.log('アカウント情報まとめ');
  console.log('========================================\n');
  
  const successResults = results.filter(r => !r.error);
  if (successResults.length > 0) {
    console.log('【アカウント1】');
    console.log(`ID: ${successResults[0]?.email}`);
    console.log(`パスワード: ${successResults[0]?.password}\n`);
    
    if (successResults[1]) {
      console.log('【アカウント2】');
      console.log(`ID: ${successResults[1]?.email}`);
      console.log(`パスワード: ${successResults[1]?.password}\n`);
    }
    
    if (successResults[2]) {
      console.log('【アカウント3】');
      console.log(`ID: ${successResults[2]?.email}`);
      console.log(`パスワード: ${successResults[2]?.password}\n`);
    }
  }
}

main().catch(error => {
  console.error('致命的なエラー:', error);
  process.exit(1);
});


# サブスクリプション・アカウント制御トラブルシューティング

## 2024年12月21日 トラブル事例と対策

### 発生した問題の時系列

#### 問題1: トライアルアカウントが3回/0日のまま
- **症状**: trial2, trial3を15回/12月31日まで設定したが、UIでは3回表示
- **原因**: `user_profiles`テーブルは更新されたが、`can_use_service`関数が`custom_trial_usage_limit`を読んでいなかった
- **教訓**: DBの値を更新しても、それを読む関数が対応していなければ意味がない

#### 問題2: 関数更新時のエラー
- **症状**: `ERROR: cannot change return type of existing function`
- **原因**: 戻り値の型（カラム構成）が変わったため、`CREATE OR REPLACE`では更新できない
- **解決**: `DROP FUNCTION IF EXISTS xxx(uuid);` を先に実行

#### 問題3: 管理者アカウントが使えなくなった（重大）
- **症状**: 管理者で「無料体験期間が終了しました」と表示
- **原因**: 新しい`can_use_service`関数に「管理者チェック」が欠落していた
- **教訓**: 関数を置き換える際は、元の関数のすべてのロジックを理解してから行う

#### 問題4: カスタムトライアル設定が反映されない
- **症状**: `custom_trial_usage_limit=15`なのに残り3回と表示
- **原因**: `can_use_service` → `check_free_access` の依存関係があり、`check_free_access`がカスタム設定を読んでいなかった
- **教訓**: 関数の呼び出しチェーン全体を把握する必要がある

---

### 根本原因分析（5 Whys）

```
Q: なぜtrial2/trial3が15回にならなかった？
A: can_use_serviceがcustom_trial_usage_limitを読んでいなかった

Q: なぜcan_use_serviceを更新したのに直らなかった？
A: can_use_serviceがcheck_free_accessを呼び出しており、そちらも更新が必要だった

Q: なぜcheck_free_accessの存在を見落とした？
A: 関数間の依存関係が文書化されていなかった

Q: なぜ管理者が使えなくなった？
A: 元の関数にあった管理者チェックを新関数に含めなかった

Q: なぜ元の関数を完全に理解せずに更新した？
A: マイグレーションファイルが複数あり、どれが最新かわかりにくかった
```

---

### 関数の依存関係（重要）

```
can_use_service(p_user_id)
├── 1. 管理者チェック (user_profiles.role = 'admin')
├── 2. check_free_access(p_user_id) ← 別関数を呼び出し
│   ├── 期間限定無料開放チェック (system_settings)
│   ├── サブスクリプション存在チェック
│   └── 無料体験チェック (custom_trial_* を参照)
├── 3. サブスクリプションチェック (subscriptions)
└── 4. 無料体験チェック（フォールバック）
```

---

### 再発防止策

#### 1. 関数変更時のチェックリスト
- [ ] 元の関数のソースを `SELECT prosrc FROM pg_proc WHERE proname = '関数名';` で取得
- [ ] 管理者チェックが含まれているか確認
- [ ] 呼び出している他の関数を特定
- [ ] 変更後に全ユーザータイプ（admin, 有料, 無料体験）でテスト

#### 2. 変更前の確認クエリ
```sql
-- 変更前に現状を保存
SELECT u.email, up.role, cus.*
FROM auth.users u
JOIN user_profiles up ON u.id = up.id
CROSS JOIN LATERAL can_use_service(u.id) cus
WHERE up.role = 'admin'
   OR u.email LIKE 'trial%'
ORDER BY up.role DESC, u.email;
```

#### 3. ロールバック用SQL
関数を変更する前に、元の関数定義を保存しておく：
```sql
-- 関数定義を取得
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'can_use_service';
```

#### 4. 関数変更時の必須手順
1. 元の関数定義をバックアップ
2. 変更前の状態を確認クエリで記録
3. `DROP FUNCTION` → `CREATE FUNCTION` の順で実行
4. 変更後の状態を確認クエリで検証
5. 問題があればバックアップからロールバック

---

### 現在の正しい関数構成

#### can_use_service
- 管理者チェック（最優先）
- check_free_access呼び出し
- サブスクリプションチェック
- 無料体験チェック（カスタム設定対応）

#### check_free_access
- 期間限定無料開放チェック
- サブスクリプション存在チェック
- **カスタムトライアル設定対応**（custom_trial_days, custom_trial_usage_limit）

---

### カスタムトライアル設定方法

特定ユーザーに個別のトライアル設定を行う場合：

```sql
-- 1. user_profilesを更新
UPDATE user_profiles
SET
    free_trial_started_at = NOW(),
    free_trial_usage_count = 0,
    custom_trial_days = 30,  -- 30日間
    custom_trial_usage_limit = 15,  -- 15回
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'target@example.com');

-- 2. 既存のサブスクリプションがあれば無効化（無料体験を優先させるため）
UPDATE subscriptions
SET status = 'cancelled', updated_at = NOW()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'target@example.com')
AND status = 'active';

-- 3. 確認
SELECT u.email, cus.*
FROM auth.users u
CROSS JOIN LATERAL can_use_service(u.id) cus
WHERE u.email = 'target@example.com';
```

---

### 関連ファイル

| ファイル | 内容 |
|---------|------|
| `supabase_migration.sql` | 基本マイグレーション |
| `supabase_migration_stripe.sql` | Stripe連携・can_use_service |
| `supabase_migration_custom_trial.sql` | カスタムトライアル対応 |
| `fix_trial2_trial3.sql` | トライアルアカウント修正用（一時ファイル） |

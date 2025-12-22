/**
 * レートリミット機能
 * 
 * ユーザーごとのAPIリクエスト頻度を制限し、
 * DoS攻撃やブルートフォース攻撃を防止します。
 */

type RateLimitEntry = {
    count: number;
    firstRequest: number;
};

// インメモリのレートリミットストア
// 注意: サーバーレス環境では各インスタンスで独立したストアになります
// より堅牢な実装にはRedisやVercel KVを使用することを推奨
const rateLimitStore = new Map<string, RateLimitEntry>();

// 定期的な古いエントリのクリーンアップ（メモリリーク防止）
const CLEANUP_INTERVAL = 60 * 1000; // 1分ごと
let lastCleanup = Date.now();

function cleanupOldEntries(windowMs: number) {
    const now = Date.now();
    
    // 前回のクリーンアップから十分な時間が経過していない場合はスキップ
    if (now - lastCleanup < CLEANUP_INTERVAL) {
        return;
    }
    
    lastCleanup = now;
    
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now - entry.firstRequest > windowMs * 2) {
            rateLimitStore.delete(key);
        }
    }
}

export type RateLimitConfig = {
    maxRequests: number;  // 許可する最大リクエスト数
    windowMs: number;     // 時間枠（ミリ秒）
};

export type RateLimitResult = {
    success: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;  // リクエストが拒否された場合の待機時間（秒）
};

/**
 * レートリミットのデフォルト設定
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 10,     // 1分あたり10リクエスト
    windowMs: 60 * 1000, // 1分
};

/**
 * 採点APIのレートリミット設定（より厳しい）
 */
export const GRADING_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 5,       // 1分あたり5リクエスト
    windowMs: 60 * 1000,  // 1分
};

/**
 * 採点APIの短時間バースト抑止（連打対策）
 */
export const GRADING_BURST_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 2,      // 10秒あたり2リクエスト
    windowMs: 10 * 1000, // 10秒
};

/**
 * 認証関連のレートリミット設定（ブルートフォース対策）
 */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 5,        // 5分あたり5リクエスト
    windowMs: 5 * 60 * 1000, // 5分
};

/**
 * レートリミットをチェック
 * 
 * @param identifier - ユーザーID、IPアドレス、またはその他の識別子
 * @param config - レートリミット設定
 * @returns レートリミットの結果
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = DEFAULT_RATE_LIMIT
): RateLimitResult {
    const { maxRequests, windowMs } = config;
    const now = Date.now();
    
    // 古いエントリをクリーンアップ
    cleanupOldEntries(windowMs);
    
    const entry = rateLimitStore.get(identifier);
    
    // 新規ユーザーまたは時間枠が経過した場合
    if (!entry || now - entry.firstRequest > windowMs) {
        rateLimitStore.set(identifier, {
            count: 1,
            firstRequest: now,
        });
        
        return {
            success: true,
            remaining: maxRequests - 1,
            resetTime: now + windowMs,
        };
    }
    
    // 時間枠内のリクエスト
    if (entry.count >= maxRequests) {
        const retryAfter = Math.ceil((entry.firstRequest + windowMs - now) / 1000);
        
        return {
            success: false,
            remaining: 0,
            resetTime: entry.firstRequest + windowMs,
            retryAfter,
        };
    }
    
    // リクエストをカウント
    entry.count++;
    
    return {
        success: true,
        remaining: maxRequests - entry.count,
        resetTime: entry.firstRequest + windowMs,
    };
}

/**
 * 特定の識別子のレートリミットをリセット
 * （管理者用、テスト用）
 */
export function resetRateLimit(identifier: string): void {
    rateLimitStore.delete(identifier);
}

/**
 * すべてのレートリミットをクリア
 * （テスト用）
 */
export function clearAllRateLimits(): void {
    rateLimitStore.clear();
}





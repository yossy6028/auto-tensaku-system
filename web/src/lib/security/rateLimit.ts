/**
 * レートリミット機能
 *
 * ユーザーごとのAPIリクエスト頻度を制限し、
 * DoS攻撃やブルートフォース攻撃を防止します。
 *
 * ─────────────────────────────────────────────────────────────
 * ■ 既知の限界（Grok指摘#2）— あえて現状維持している理由
 *   このストアは下記のとおりインメモリ（Map）であり、Vercel のサーバーレスは
 *   リクエストごとに別インスタンスへ振り分けられ得るため、インスタンスを跨いだ
 *   連打は完全には抑止できない。これは「分散レートリミットが必要なら Redis/Vercel KV」
 *   という一般論どおりの制約。
 *
 * ■ それでも“課金の正当性”は守られている
 *   実際の利用枠消費は DB 側の RPC `reserve_usage` が行い、対象行を
 *   `FOR UPDATE` でロックしてから枠確認→インクリメントする（サブスク・無料体験とも）。
 *   つまり同時に何回叩かれても、枠を超えた予約や二重課金は DB レベルで物理的に不可能。
 *   このレートリミットは「お金の門番」ではなく、その手前で過剰リクエスト（DoS・連打・
 *   OCR/Gemini APIの乱用）を緩和する“多層防御の一層”という位置づけ。
 *
 * ■ 将来分散化する場合
 *   トラフィック増で跨インスタンス連打が実害になったら、本モジュールの API
 *   （checkRateLimit）を保ったまま内部実装を Upstash Redis / Vercel KV に差し替える。
 *   呼び出し側（grade/ocr ルート）の変更は不要。
 * ─────────────────────────────────────────────────────────────
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





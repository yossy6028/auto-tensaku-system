/**
 * セキュアなロガー
 * 
 * 本番環境ではデバッグ情報を出力せず、
 * エラーや警告のみを記録します。
 */

const isDevelopment = process.env.NODE_ENV === 'development';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 機密情報をマスクするパターン
 */
const SENSITIVE_PATTERNS = [
    /api[_-]?key/i,
    /password/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /bearer/i,
    /credential/i,
];

/**
 * オブジェクト内の機密情報をマスク
 */
function maskSensitiveData(obj: unknown, depth = 0): unknown {
    if (depth > 10) return '[Max depth reached]';
    
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'string') {
        // URLパラメータ内のトークンなどをマスク
        return obj.replace(/([?&](token|key|secret|password)=)[^&]*/gi, '$1[MASKED]');
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => maskSensitiveData(item, depth + 1));
    }
    
    if (typeof obj === 'object') {
        const masked: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
            masked[key] = isSensitive ? '[MASKED]' : maskSensitiveData(value, depth + 1);
        }
        return masked;
    }
    
    return obj;
}

/**
 * ログを出力
 */
function toSafeErrorPayload(error: Error): Record<string, string | undefined> {
    return {
        name: error.name,
        message: error.message,
        stack: error.stack
    };
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    // 本番環境ではdebugとinfoをスキップ
    if (!isDevelopment && (level === 'debug' || level === 'info')) {
        return;
    }
    
    // 本番環境では機密情報をマスク
    const normalizedArgs = args.map((arg) => {
        if (arg instanceof Error) {
            return toSafeErrorPayload(arg);
        }
        return arg;
    });
    const safeArgs = isDevelopment ? normalizedArgs : normalizedArgs.map(arg => maskSensitiveData(arg));
    
    switch (level) {
        case 'debug':
            console.log(prefix, message, ...safeArgs);
            break;
        case 'info':
            console.info(prefix, message, ...safeArgs);
            break;
        case 'warn':
            console.warn(prefix, message, ...safeArgs);
            break;
        case 'error':
            console.error(prefix, message, ...safeArgs);
            break;
    }
}

/**
 * ロガーオブジェクト
 */
export const logger = {
    /**
     * デバッグログ（開発環境のみ）
     */
    debug: (message: string, ...args: unknown[]): void => {
        log('debug', message, ...args);
    },
    
    /**
     * 情報ログ（開発環境のみ）
     */
    info: (message: string, ...args: unknown[]): void => {
        log('info', message, ...args);
    },
    
    /**
     * 警告ログ（常に出力）
     */
    warn: (message: string, ...args: unknown[]): void => {
        log('warn', message, ...args);
    },
    
    /**
     * エラーログ（常に出力）
     */
    error: (message: string, ...args: unknown[]): void => {
        log('error', message, ...args);
    },
};

export default logger;





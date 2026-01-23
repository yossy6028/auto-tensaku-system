// dotenv is handled by Next.js automatically

export const CONFIG = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    // デフォルトは最新の高精度モデルを使用（環境変数で上書き可能）
    MODEL_NAME: process.env.MODEL_NAME || 'gemini-3-pro-preview',
    // OCR専用モデル（未指定ならMODEL_NAMEを使用）
    OCR_MODEL_NAME: process.env.OCR_MODEL_NAME || '',
    // OCR失敗時のフォールバックモデル（未指定なら無効）
    OCR_FALLBACK_MODEL_NAME: process.env.OCR_FALLBACK_MODEL_NAME || '',
    // レート制限時の代替モデル（gemini-3-proが制限に達した場合に使用）
    RATE_LIMIT_FALLBACK_MODEL: process.env.RATE_LIMIT_FALLBACK_MODEL || 'gemini-2.5-pro-preview-05-06',
};

// dotenv is handled by Next.js automatically

export const CONFIG = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    // Gemini 3 Pro Image Preview - 最新の画像認識特化モデル
    // 参照: https://ai.google.dev/gemini-api/docs/models?hl=ja#gemini-3-pro
    // 代替: 'gemini-3-pro-preview' (テキスト重視の場合)
    MODEL_NAME: process.env.MODEL_NAME || 'gemini-3-pro-image-preview',
};

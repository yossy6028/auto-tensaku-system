export type AppConfig = {
    GEMINI_API_KEY: string;
    MODEL_NAME: string;
};

export function loadConfig(): AppConfig {
    return {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        // 2026-05-20: Use Gemini 3.5 Flash as the default Gemini API model.
        MODEL_NAME: process.env.MODEL_NAME || "gemini-3.5-flash"
    };
}

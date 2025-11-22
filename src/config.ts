import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    // Using gemini-1.5-pro as a proxy for "Gemini 3 Pro" capabilities
    // or gemini-2.0-flash-exp if available and preferred for speed/experimental features
    MODEL_NAME: process.env.MODEL_NAME || 'gemini-1.5-pro',
};

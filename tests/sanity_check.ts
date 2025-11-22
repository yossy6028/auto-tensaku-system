import { EduShiftGrader } from "../src/core/grader";

// Mock the config to avoid API key error during instantiation if not set
jest.mock('../src/config', () => ({
    CONFIG: {
        GEMINI_API_KEY: 'dummy_key',
        MODEL_NAME: 'gemini-1.5-pro'
    }
}));

// Mock GoogleGenerativeAI
jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: jest.fn().mockResolvedValue({
                    response: {
                        text: () => JSON.stringify({
                            status: "success",
                            user_message: "Mock success",
                            grading_result: { score: 10 }
                        })
                    }
                })
            })
        }))
    };
});

async function test() {
    console.log("Running sanity check...");
    try {
        const grader = new EduShiftGrader();
        console.log("Grader instantiated successfully.");
        // We won't call gradeAnswer here because it requires real file paths, 
        // and we just want to check imports and class structure.
    } catch (e) {
        console.error("Sanity check failed:", e);
        process.exit(1);
    }
    console.log("Sanity check passed.");
}

test();

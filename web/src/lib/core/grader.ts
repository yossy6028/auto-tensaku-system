import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "../config";
import { SYSTEM_INSTRUCTION } from "../prompts/eduShift";
import { fileToGenerativePart, getMimeType } from "../utils/image";

export class EduShiftGrader {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        if (!CONFIG.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment variables.");
        }
        this.genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({
            model: CONFIG.MODEL_NAME,
            systemInstruction: SYSTEM_INSTRUCTION
        });
    }

    async gradeAnswer(targetLabel: string, studentImagePath: string, answerKeyImagePath: string, problemImagePath: string) {
        try {
            const studentImagePart = fileToGenerativePart(studentImagePath, getMimeType(studentImagePath));
            const answerKeyImagePart = fileToGenerativePart(answerKeyImagePath, getMimeType(answerKeyImagePath));
            const problemImagePart = fileToGenerativePart(problemImagePath, getMimeType(problemImagePath));
            return this.executeGrading(targetLabel, studentImagePart, answerKeyImagePart, problemImagePart);
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    async gradeAnswerFromBuffer(targetLabel: string, studentBuffer: Buffer, studentMime: string, answerKeyBuffer: Buffer, answerKeyMime: string, problemBuffer: Buffer, problemMime: string) {
        try {
            const studentImagePart = {
                inlineData: {
                    data: studentBuffer.toString("base64"),
                    mimeType: studentMime
                }
            };
            const answerKeyImagePart = {
                inlineData: {
                    data: answerKeyBuffer.toString("base64"),
                    mimeType: answerKeyMime
                }
            };
            const problemImagePart = {
                inlineData: {
                    data: problemBuffer.toString("base64"),
                    mimeType: problemMime
                }
            };
            return this.executeGrading(targetLabel, studentImagePart, answerKeyImagePart, problemImagePart);
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    async gradeAnswerFromMultipleFiles(targetLabel: string, files: Array<{ buffer: Buffer; mimeType: string; name: string }>) {
        try {
            // すべてのファイルを画像パートに変換
            const imageParts = files.map(file => ({
                inlineData: {
                    data: file.buffer.toString("base64"),
                    mimeType: file.mimeType
                }
            }));

            return this.executeGradingWithMultipleFiles(targetLabel, imageParts);
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    private async executeGrading(targetLabel: string, studentImagePart: any, answerKeyImagePart: any, problemImagePart: any) {
        const prompt = `
Target Problem Label: ${targetLabel}

Please analyze the attached images (Student Answer Sheet, Answer Key, and Problem Text) and perform the grading process as defined in the System Instruction.
Output the result strictly in JSON format.
`;

        const result = await this.model.generateContent([
            prompt,
            studentImagePart,
            answerKeyImagePart,
            problemImagePart
        ]);

        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonString = text.replace(/```json\n|\n```/g, "").trim();

        try {
            const parsed = JSON.parse(jsonString);
            if (parsed?.debug_info) {
                delete parsed.debug_info;
            }
            return parsed;
        } catch (e) {
            console.error("Failed to parse JSON response:", text);
            return {
                status: "error",
                message: "System Error: Failed to parse AI response.",
                debug_info: { raw_response: text }
            };
        }
    }

    private async executeGradingWithMultipleFiles(targetLabel: string, imageParts: any[]) {
        const prompt = `
Target Problem Label: ${targetLabel}

Please analyze the attached images. These images may contain:
- Student Answer Sheet (本人の答案)
- Answer Key (模範解答)
- Problem Text (問題文)

The images may be in a single file or multiple files. Please identify and analyze all relevant content (Student Answer Sheet, Answer Key, and Problem Text) from the provided images and perform the grading process as defined in the System Instruction.

Important: Ensure that the student's answer and the problem are clearly visible in the images. If the images are not clear or complete, please note this in your response.

Output the result strictly in JSON format.
`;

        const result = await this.model.generateContent([
            prompt,
            ...imageParts
        ]);

        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonString = text.replace(/```json\n|\n```/g, "").trim();

        try {
            const parsed = JSON.parse(jsonString);
            if (parsed?.debug_info) {
                delete parsed.debug_info;
            }
            return parsed;
        } catch (e) {
            console.error("Failed to parse JSON response:", text);
            return {
                status: "error",
                message: "System Error: Failed to parse AI response.",
                debug_info: { raw_response: text }
            };
        }
    }

    private handleError(error: any) {
        console.error("Error during grading:", error);
        return {
            status: "error",
            message: `System Error: ${error.message}`
        };
    }
}

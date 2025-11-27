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
            const parsedResult = JSON.parse(jsonString);

            // Enforce 5% step for deductions and recalculate score
            if (parsedResult.grading_result && Array.isArray(parsedResult.grading_result.deduction_details)) {
                let totalDeduction = 0;
                parsedResult.grading_result.deduction_details = parsedResult.grading_result.deduction_details.map((detail: any) => {
                    // Round up to nearest 5
                    const originalDeduction = detail.deduction_percentage || 0;
                    const roundedDeduction = Math.ceil(originalDeduction / 5) * 5;
                    // Ensure at least 5% if there is a deduction reason but 0% was returned (edge case)
                    const finalDeduction = (originalDeduction > 0 && roundedDeduction === 0) ? 5 : roundedDeduction;

                    totalDeduction += finalDeduction;

                    return {
                        ...detail,
                        deduction_percentage: finalDeduction
                    };
                });

                // Recalculate score
                parsedResult.grading_result.score = Math.max(0, 100 - totalDeduction);
            }

            return parsedResult;
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

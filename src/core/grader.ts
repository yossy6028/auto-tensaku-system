import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "../config";
import { SYSTEM_INSTRUCTION } from "../prompts/eduShift";
import { fileToGenerativePart, getMimeType } from "../utils/image";

// OCR用の設定（Gemini 3対応）
// thinkingConfig: 要約/補完を抑える
// mediaResolution: マス目の細かい文字を拾う
// responseMimeType: JSON強制で出力ブレを抑える
// temperature: 0でOCRは決定的に
const OCR_CONFIG: Record<string, unknown> = {
    temperature: 0,
    topP: 0.4,
    topK: 32,
    maxOutputTokens: 4096,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: "low" },
    mediaResolution: "high"
};

const GRADING_CONFIG = {
    temperature: 0,
    topP: 0.4,
    topK: 32,
    maxOutputTokens: 8192
};

export class EduShiftGrader {
    private genAI: GoogleGenerativeAI;
    private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
    private ocrModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

    constructor() {
        if (!CONFIG.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment variables.");
        }
        this.genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({
            model: CONFIG.MODEL_NAME,
            systemInstruction: SYSTEM_INSTRUCTION
        });
        this.ocrModel = this.genAI.getGenerativeModel({
            model: CONFIG.MODEL_NAME,
            systemInstruction: "You are a high-accuracy OCR engine. Transcribe characters exactly as written without summarizing or correcting."
        });
    }

    async gradeAnswer(targetLabel: string, studentImagePath: string, answerKeyImagePath: string, problemImagePath: string) {
        try {
            const studentImagePart = fileToGenerativePart(studentImagePath, getMimeType(studentImagePath));
            const answerKeyImagePart = fileToGenerativePart(answerKeyImagePath, getMimeType(answerKeyImagePath));
            const problemImagePart = fileToGenerativePart(problemImagePath, getMimeType(problemImagePath));
            return this.executeWithOcr(targetLabel, studentImagePart, answerKeyImagePart, problemImagePart);
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
            return this.executeWithOcr(targetLabel, studentImagePart, answerKeyImagePart, problemImagePart);
        } catch (error: any) {
            return this.handleError(error);
        }
    }

    private async executeWithOcr(targetLabel: string, studentImagePart: any, answerKeyImagePart: any, problemImagePart: any) {
        const ocrResult = await this.performOcr(targetLabel, studentImagePart);
        return this.executeGrading(targetLabel, ocrResult, answerKeyImagePart, problemImagePart);
    }

    private async performOcr(targetLabel: string, studentImagePart: any): Promise<{ text: string; charCount: number }> {
        const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, "").trim() || "target";
        const ocrPrompt = [
            `Transcribe only the answer area for "${sanitizedLabel}".`,
            "Do not summarize or correct. Keep punctuation. Unreadable characters must be \"〓\".",
            "Vertical writing: read top-to-bottom in the rightmost column, then move left column by column.",
            "Ignore other questions, headers, and grader marks.",
            "Return JSON: { \"text\": \"<verbatim answer>\", \"char_count\": <integer of characters without spaces/newlines> }"
        ].join("\n");

        const result = await this.ocrModel.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [{ text: ocrPrompt }, studentImagePart]
                }
            ],
            generationConfig: OCR_CONFIG
        });

        const raw = (await result.response.text()) || "";
        const cleaned = raw.replace(/```json\\s*|```/g, "").trim();

        try {
            const parsed = JSON.parse(cleaned);
            const text = String(parsed.text ?? "").trim();
            const charCount = Number.isFinite(parsed.char_count)
                ? Number(parsed.char_count)
                : text.replace(/\\s+/g, "").length;
            return { text, charCount };
        } catch (e) {
            console.error("Failed to parse OCR response, returning raw text", cleaned);
            const fallbackText = cleaned;
            return { text: fallbackText, charCount: fallbackText.replace(/\\s+/g, "").length };
        }
    }

    private async executeGrading(targetLabel: string, ocr: { text: string; charCount: number }, answerKeyImagePart: any, problemImagePart: any) {
        const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, "").trim() || "target";
        const recognizedText = ocr.text || "";
        const charCount = ocr.charCount ?? recognizedText.replace(/\\s+/g, "").length;

        const prompt = `
Target Problem Label: ${sanitizedLabel}

Use the provided recognized_text exactly as written. Do NOT re-OCR or modify characters/punctuation.
If recognized_text is empty, return an error status and message.

recognized_text (verbatim):
${recognizedText || "(empty)"}

character_count_no_spaces: ${charCount}
`;

        const result = await this.model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        { text: "Answer key image for the target problem:" },
                        answerKeyImagePart,
                        { text: "Problem text image for context:" },
                        problemImagePart
                    ]
                }
            ],
            generationConfig: GRADING_CONFIG
        });

        const response = await result.response;
        const text = response.text();

        const jsonString = text.replace(/```json\\n|\\n```/g, "").trim();

        try {
            const parsedResult = JSON.parse(jsonString);

            // Ensure recognized_text is retained verbatim
            if (parsedResult.grading_result) {
                if (!parsedResult.grading_result.recognized_text) {
                    parsedResult.grading_result.recognized_text = recognizedText;
                }

                if (Array.isArray(parsedResult.grading_result.deduction_details)) {
                    let totalDeduction = 0;
                    parsedResult.grading_result.deduction_details = parsedResult.grading_result.deduction_details.map((detail: any) => {
                        const originalDeduction = detail.deduction_percentage || 0;
                        const roundedDeduction = Math.ceil(originalDeduction / 5) * 5;
                        const finalDeduction = (originalDeduction > 0 && roundedDeduction === 0) ? 5 : roundedDeduction;

                        totalDeduction += finalDeduction;

                        return {
                            ...detail,
                            deduction_percentage: finalDeduction
                        };
                    });

                    parsedResult.grading_result.score = Math.max(0, 100 - totalDeduction);
                }
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

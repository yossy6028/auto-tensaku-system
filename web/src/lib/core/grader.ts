import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "../config";
import { SYSTEM_INSTRUCTION } from "../prompts/eduShift";

// 型定義
type UploadedFilePart = {
    buffer: Buffer;
    mimeType: string;
    name: string;
    pageNumber?: number;
    sourceFileName?: string;
};

type CategorizedFiles = {
    studentFiles: UploadedFilePart[];
    problemFiles: UploadedFilePart[];
    modelAnswerFiles: UploadedFilePart[];
    otherFiles: UploadedFilePart[];
};

type GenerativePart = { inlineData: { data: string; mimeType: string } };
type ContentPart = { text: string } | GenerativePart;
type GradingResult = Record<string, unknown> & { 
    score?: number; 
    recognized_text?: string;
    deduction_details?: Array<{ deduction_percentage?: number }>;
};

// ファイル分類用の正規表現パターン
const FILE_PATTERNS = {
    answer: /(answer|ans|student|解答|答案|生徒)/i,
    problem: /(problem|question|課題|設問|問題|本文)/i,
    model: /(model|key|模範|解説|正解|解答例)/i
};

export class EduShiftGrader {
    private genAI: GoogleGenerativeAI;
    private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
    
    // 採点用の設定（systemInstructionと組み合わせて使用）
    private readonly gradingConfig = {
        temperature: 0.2,
        topP: 0.6,
        topK: 32,
        responseMimeType: "application/json" as const
    };

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

    /**
     * 複数ファイルから採点を実行
     */
    async gradeAnswerFromMultipleFiles(
        targetLabel: string, 
        files: UploadedFilePart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null
    ) {
        try {
            const categorizedFiles = this.categorizeFiles(files, pdfPageInfo);
            const imageParts = this.buildContentSequence(categorizedFiles);
            return await this.executeGrading(targetLabel, imageParts, pdfPageInfo, categorizedFiles);
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    /**
     * スコアを正規化（0-100の範囲に収める）
     */
    private normalizeScore(raw: unknown): number | null {
        if (typeof raw !== "number" || Number.isNaN(raw)) return null;
        if (raw > 0 && raw <= 1) return Math.round(raw * 100);
        return Math.min(100, Math.max(0, Math.round(raw)));
    }

    /**
     * 減点詳細からスコアを計算
     */
    private computeFinalScore(gradingResult: GradingResult | null): number | null {
        if (!gradingResult) return null;
        
        const normalized = this.normalizeScore(gradingResult.score);
        const deductions = Array.isArray(gradingResult.deduction_details) ? gradingResult.deduction_details : [];
        
        const totalDeduction = deductions.reduce((sum, d) => {
            const n = typeof d?.deduction_percentage === "number" 
                ? d.deduction_percentage 
                : Number(d?.deduction_percentage);
            return Number.isFinite(n) ? sum + n : sum;
        }, 0);

        const deductionScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));

        // 減点がある場合は減点スコアを優先
        if (totalDeduction > 0) {
            return Math.max(0, Math.min(100, Math.round(deductionScore / 10) * 10));
        }
        if (normalized !== null) {
            return Math.max(0, Math.min(100, Math.round(normalized / 10) * 10));
        }
        return deductionScore ? Math.max(0, Math.min(100, Math.round(deductionScore / 10) * 10)) : null;
    }

    /**
     * ページ範囲文字列をパース（例: "1,3-5" → Set{1,3,4,5}）
     */
    private parsePageRange(pageStr?: string): Set<number> {
        const pages = new Set<number>();
        if (!pageStr) return pages;

        for (const part of pageStr.split(/[,、]/)) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            if (trimmed.includes("-")) {
                const [start, end] = trimmed.split("-").map(s => parseInt(s.trim(), 10));
                if (!Number.isNaN(start) && !Number.isNaN(end)) {
                    for (let i = start; i <= end; i++) pages.add(i);
                }
            } else {
                const num = parseInt(trimmed, 10);
                if (!Number.isNaN(num)) pages.add(num);
            }
        }
        return pages;
    }

    /**
     * ファイルをカテゴリ別に分類
     */
    private categorizeFiles(
        files: UploadedFilePart[], 
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null
    ): CategorizedFiles {
        const answerPages = this.parsePageRange(pdfPageInfo?.answerPage);
        const problemPages = this.parsePageRange(pdfPageInfo?.problemPage);
        const modelPages = this.parsePageRange(pdfPageInfo?.modelAnswerPage);

        const buckets: CategorizedFiles = {
            studentFiles: [],
            problemFiles: [],
            modelAnswerFiles: [],
            otherFiles: []
        };

        for (const file of files) {
            const name = file.name || "";
            const pageNumber = file.pageNumber;

            // ページ番号による分類を優先
            if (pageNumber !== undefined) {
                if (answerPages.has(pageNumber)) { buckets.studentFiles.push(file); continue; }
                if (problemPages.has(pageNumber)) { buckets.problemFiles.push(file); continue; }
                if (modelPages.has(pageNumber)) { buckets.modelAnswerFiles.push(file); continue; }
            }

            // ファイル名による分類
            if (FILE_PATTERNS.answer.test(name)) { buckets.studentFiles.push(file); continue; }
            if (FILE_PATTERNS.problem.test(name)) { buckets.problemFiles.push(file); continue; }
            if (FILE_PATTERNS.model.test(name)) { buckets.modelAnswerFiles.push(file); continue; }

            buckets.otherFiles.push(file);
        }

        // 不足カテゴリにその他から補充
        const fallbackPool = [...buckets.otherFiles];
        const ensureAtLeastOne = (target: UploadedFilePart[]) => {
            if (target.length === 0 && fallbackPool.length > 0) {
                target.push(fallbackPool.shift()!);
            }
        };

        ensureAtLeastOne(buckets.studentFiles);
        ensureAtLeastOne(buckets.problemFiles);
        ensureAtLeastOne(buckets.modelAnswerFiles);
        buckets.otherFiles = fallbackPool;

        return buckets;
    }

    /**
     * ファイルをGenerativePart形式に変換
     */
    private toGenerativePart(file: UploadedFilePart): GenerativePart {
        return {
            inlineData: {
                data: file.buffer.toString("base64"),
                mimeType: file.mimeType
            }
        };
    }

    /**
     * カテゴリ別にコンテンツシーケンスを構築
     */
    private buildContentSequence(categorizedFiles: CategorizedFiles): ContentPart[] {
        const sequence: ContentPart[] = [];

        const pushCategory = (label: string, files: UploadedFilePart[]) => {
            if (files.length === 0) return;
            sequence.push({ text: `【${label}】` });
            files.forEach((file, idx) => {
                const pageInfo = file.pageNumber ? ` (page ${file.pageNumber})` : "";
                sequence.push({ text: `${label} ${idx + 1}${pageInfo} - ${file.name}` });
                sequence.push(this.toGenerativePart(file));
            });
        };

        pushCategory("生徒の答案画像", categorizedFiles.studentFiles);
        pushCategory("問題文の画像", categorizedFiles.problemFiles);
        pushCategory("模範解答の画像", categorizedFiles.modelAnswerFiles);

        if (categorizedFiles.otherFiles.length > 0) {
            sequence.push({ text: "【その他の画像】（上記に分類できなかったもの。必要な場合のみ参照してください）" });
            categorizedFiles.otherFiles.forEach((file, idx) => {
                const pageInfo = file.pageNumber ? ` (page ${file.pageNumber})` : "";
                sequence.push({ text: `その他 ${idx + 1}${pageInfo} - ${file.name}` });
                sequence.push(this.toGenerativePart(file));
            });
        }

        return sequence;
    }

    /**
     * テキストからJSONを抽出
     */
    private extractJsonFromText(text: string): Record<string, unknown> | null {
        const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
        
        try {
            return JSON.parse(cleaned);
        } catch {
            // パース失敗時は { } で囲まれた部分を抽出
        }
        
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
            return null;
        }
        
        try {
            return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
        } catch {
            return null;
        }
    }

    /**
     * 採点を実行
     */
    private async executeGrading(
        targetLabel: string, 
        imageParts: ContentPart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        categorizedFiles?: CategorizedFiles
    ) {
        const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, '').trim();

        // PDFページ指定ヒントを構築
        let pdfPageHint = '';
        const hasPdf = imageParts.some(part => 
            typeof part === 'object' && 'inlineData' in part && 
            part.inlineData.mimeType === 'application/pdf'
        );
        
        if (hasPdf && pdfPageInfo) {
            const hints: string[] = [];
            if (pdfPageInfo.answerPage) hints.push(`生徒の答案: ${pdfPageInfo.answerPage}ページ目`);
            if (pdfPageInfo.problemPage) hints.push(`問題文: ${pdfPageInfo.problemPage}ページ目`);
            if (pdfPageInfo.modelAnswerPage) hints.push(`模範解答: ${pdfPageInfo.modelAnswerPage}ページ目`);
            if (hints.length > 0) {
                pdfPageHint = `\n【PDFページ指定】\n${hints.join('\n')}\n`;
            }
        }

        // OCRステップは廃止（過去の修正記録より）
        // 2段階処理（OCR→採点）はsystemInstructionの適用漏れで精度低下を招くため、
        // 1回のAPI呼び出しで画像から直接読み取りながら採点する方式に統一
        const recognizedText = "";

        // 採点プロンプト
        const prompt = `Target Problem Label: ${sanitizedLabel}
${pdfPageHint}
添付された画像から「${sanitizedLabel}」を見つけて、System Instructionに従って採点を行ってください。

【OCR結果（推測や補完をせず、このテキストをそのまま採点に使う）】
${recognizedText || "（OCRが利用できなかったため、モデルに画像から直接読ませてください）"}

【必須チェック項目 - 必ず実行してください】

1. **OCR誤読の検出と修正（重要）:**
   - OCR読み取り結果で意味が通じない箇所がある場合、以下を確認してください：
     a. 文字形状が類似しているか（例：「数」と「教」、「し」と「心」、「ご」と「心」）
     b. **文字数が同じか**（1文字→1文字のみ。文字数が異なる変換は不可）
     c. 修正すると文脈が通るか
     d. 画像を直接確認して形状類似性を確認できるか
   - すべて満たす場合のみ修正してください

2. **常体・敬体の統一チェック（必須）:**
   - 常体（だ・である調）と敬体（です・ます調）の混在を厳しくチェックしてください
   - 混在が1箇所でも見つかった場合は必ず-10%減点してください

3. **自由作文（タイプB）の内容検討（必須）:**
   - 誤字脱字の修正のみで高得点を与えないでください
   - 内容面（テーマ応答、論理性、具体例、深さ、多角性）を厳しく評価してください

【重要】
- System Instruction の「OCR Rules」および「採点基準」を厳密に従ってください
- 結果はJSON形式で出力してください`;

        const result = await this.model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
            generationConfig: this.gradingConfig
        });

        const text = result.response.text();
        const parsed = this.extractJsonFromText(text);

        if (parsed) {
            delete parsed.debug_info;
            const gradingResult = parsed.grading_result as GradingResult | undefined;
            if (gradingResult) {
                if (!gradingResult.recognized_text && recognizedText) {
                    gradingResult.recognized_text = recognizedText;
                }
                const finalScore = this.computeFinalScore(gradingResult);
                if (finalScore !== null) {
                    gradingResult.score = finalScore;
                }
            }
            return parsed;
        }

        return {
            status: "error",
            message: "System Error: Failed to parse AI response."
        };
    }

    /**
     * エラーハンドリング
     */
    private handleError(error: unknown) {
        console.error("Error during grading:", error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
            status: "error",
            message: `System Error: ${message}`
        };
    }
}

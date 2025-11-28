import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "../config";
import { SYSTEM_INSTRUCTION } from "../prompts/eduShift";

// 型定義
// ファイルの役割タイプ（エクスポート）
export type FileRole = 'answer' | 'problem' | 'model' | 'problem_model' | 'answer_problem' | 'all' | 'other';

type UploadedFilePart = {
    buffer: Buffer;
    mimeType: string;
    name: string;
    pageNumber?: number;
    sourceFileName?: string;
    role?: FileRole;  // ユーザー指定の役割
};

type CategorizedFiles = {
    studentFiles: UploadedFilePart[];
    problemFiles: UploadedFilePart[];
    modelAnswerFiles: UploadedFilePart[];
    otherFiles: UploadedFilePart[];
};

type GenerativePart = { inlineData: { data: string; mimeType: string } };
type ContentPart = { text: string } | GenerativePart;

// 必須チェック項目の型定義
type StyleCheckResult = {
    detected_style: "常体" | "敬体" | "混在";
    keigo_count: number;
    jotai_count: number;
    examples: string[];
    is_mixed: boolean;
    deduction: number;
};

type VocabularyCheckResult = {
    repeated_words: Array<{ word: string; count: number }>;
    deduction: number;
};

type MandatoryChecks = {
    style_check: StyleCheckResult;
    vocabulary_check: VocabularyCheckResult;
    programmatic_validation: boolean;  // プログラムによる検証が行われたか
};

type DeductionDetail = {
    reason: string;
    deduction_percentage: number;
};

type GradingResult = Record<string, unknown> & { 
    score?: number; 
    recognized_text?: string;
    deduction_details?: DeductionDetail[];
    mandatory_checks?: MandatoryChecks;
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
    
    // OCR用の設定（JSON強制なし - Web版Geminiと同等の条件）
    // JSON出力を強制すると、モデルは「正しいJSON」を優先し、OCR精度が落ちる
    private readonly ocrConfig = {
        temperature: 0,
        topP: 0.1,
        topK: 16
        // responseMimeType なし - 自由形式でOCRに集中させる
    };
    
    // 採点用の設定（JSON出力を強制）
    private readonly gradingConfig = {
        temperature: 0,
        topP: 0.1,
        topK: 16,
        responseMimeType: "application/json" as const
    };

    // OCR専用モデル（systemInstructionを最小化してOCRに集中）
    private ocrModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

    constructor() {
        if (!CONFIG.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment variables.");
        }
        this.genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);
        
        // 採点用モデル（フルのsystemInstruction）
        this.model = this.genAI.getGenerativeModel({
            model: CONFIG.MODEL_NAME,
            systemInstruction: SYSTEM_INSTRUCTION
        });
        
        // OCR専用モデル（最小限のsystemInstruction - Web版Geminiに近い条件）
        this.ocrModel = this.genAI.getGenerativeModel({
            model: CONFIG.MODEL_NAME,
            systemInstruction: `あなたは高精度OCRエンジンです。
画像内のテキストを一字一句正確に読み取ってください。

【絶対ルール】
1. 画像に書かれている文字を「そのまま」出力する
2. 意味が通らなくても、文法的に変でも、そのまま出力する
3. 読めない文字は「〓」で出力する
4. 推測や補完は絶対にしない
5. 縦書きの場合は右から左、上から下の順で読む`
        });
    }

    /**
     * 複数ファイルから採点を実行
     */
    async gradeAnswerFromMultipleFiles(
        targetLabel: string, 
        files: UploadedFilePart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        fileRoles?: Record<string, FileRole>
    ) {
        try {
            // ファイルに役割情報がすでに付与されていない場合は付与
            if (fileRoles) {
                files.forEach((file, idx) => {
                    if (!file.role) {
                        file.role = fileRoles[idx.toString()];
                    }
                });
            }
            const categorizedFiles = this.categorizeFiles(files, pdfPageInfo);
            const imageParts = this.buildContentSequence(categorizedFiles);
            return await this.executeTwoStageGrading(targetLabel, imageParts, pdfPageInfo, categorizedFiles);
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    /**
     * Stage 1: OCR専用（JSON強制なし - Web版Geminiと同等の条件）
     * 画像からテキストを高精度で読み取ることだけに集中
     */
    private async performOcr(imageParts: ContentPart[]): Promise<string> {
        console.log("[Grader] Stage 1: OCR開始（JSON強制なし）");
        
        // 答案画像のみを抽出
        const answerParts = imageParts.filter((part, idx) => {
            // 「生徒の答案画像」ラベルの後の画像を抽出
            if (idx > 0) {
                const prevPart = imageParts[idx - 1];
                if ('text' in prevPart && prevPart.text?.includes('答案')) {
                    return true;
                }
            }
            return false;
        });

        // 答案画像がない場合は全画像を使用
        const targetParts = answerParts.length > 0 ? answerParts : imageParts.filter(p => 'inlineData' in p);

        const ocrPrompt = `この画像に書かれているテキストを読み取ってください。

【重要】
- 一字一句正確に、そのまま出力してください
- 意味が通らなくても、文法的に変でも、書いてある通りに出力してください
- 縦書きの場合は右から左、上から下の順で読んでください
- 読めない文字は「〓」で出力してください
- 推測や補完は絶対にしないでください

読み取ったテキストのみを出力してください（説明は不要です）。`;

        const result = await this.ocrModel.generateContent({
            contents: [{ role: "user", parts: [{ text: ocrPrompt }, ...targetParts] }],
            generationConfig: this.ocrConfig
        });

        const ocrText = result.response.text().trim();
        console.log("[Grader] Stage 1 完了: OCR結果 =", ocrText.substring(0, 100) + "...");
        return ocrText;
    }

    /**
     * スコアを正規化（0-100の範囲に収める）
     */
    private normalizeScore(raw: unknown): number | null {
        if (typeof raw !== "number" || Number.isNaN(raw)) return null;
        if (raw > 0 && raw <= 1) return Math.round(raw * 100);
        return Math.min(100, Math.max(0, Math.round(raw)));
    }

    // ========================================
    // プログラムによる検証（AIの出力を補完・修正）
    // ========================================

    /**
     * 文体チェック（常体/敬体の混在検出）
     * プログラムで確実に検出する
     */
    private checkStyleProgrammatically(text: string): StyleCheckResult {
        // 敬体（です・ます調）のパターン
        const keigoPatterns = [
            /です[。、]/g,
            /ます[。、]/g,
            /でした[。、]/g,
            /ました[。、]/g,
            /ですか[。、？]/g,
            /ますか[。、？]/g,
            /ません[。、]/g,
            /ですが/g,
            /ますが/g,
        ];
        
        // 常体（だ・である調）のパターン
        const jotaiPatterns = [
            /だ[。、]/g,
            /である[。、]/g,
            /だった[。、]/g,
            /だから/g,
            /ないが/g,
            /あるが/g,
            /思う[。、]/g,
            /考える[。、]/g,
            /感じる[。、]/g,
        ];

        let keigoCount = 0;
        let jotaiCount = 0;
        const keigoExamples: string[] = [];
        const jotaiExamples: string[] = [];

        // 敬体のカウント
        for (const pattern of keigoPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                keigoCount += matches.length;
                matches.slice(0, 2).forEach(m => {
                    if (!keigoExamples.includes(m)) keigoExamples.push(m);
                });
            }
        }

        // 常体のカウント
        for (const pattern of jotaiPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                jotaiCount += matches.length;
                matches.slice(0, 2).forEach(m => {
                    if (!jotaiExamples.includes(m)) jotaiExamples.push(m);
                });
            }
        }

        const isMixed = keigoCount > 0 && jotaiCount > 0;
        let detectedStyle: "常体" | "敬体" | "混在" = "常体";
        
        if (isMixed) {
            detectedStyle = "混在";
        } else if (keigoCount > jotaiCount) {
            detectedStyle = "敬体";
        } else {
            detectedStyle = "常体";
        }

        const examples = [
            ...keigoExamples.map(e => `${e}（敬体）`),
            ...jotaiExamples.map(e => `${e}（常体）`)
        ];

        return {
            detected_style: detectedStyle,
            keigo_count: keigoCount,
            jotai_count: jotaiCount,
            examples: examples.slice(0, 4),
            is_mixed: isMixed,
            deduction: isMixed ? 10 : 0
        };
    }

    /**
     * 語彙チェック（同じ単語の繰り返し検出）
     * プログラムで確実に検出する
     */
    private checkVocabularyProgrammatically(text: string): VocabularyCheckResult {
        // 重複をチェックする単語パターン（2文字以上の形容詞・副詞・名詞）
        const wordsToCheck = [
            "あたたかい", "あたたか", "温かい", "暖かい",
            "うれしい", "嬉しい", "楽しい", "たのしい",
            "すばらしい", "素晴らしい", "素敵", "すてき",
            "大切", "たいせつ", "大事", "だいじ",
            "好き", "すき", "きれい", "綺麗",
            "やさしい", "優しい", "親切", "しんせつ",
            "安心", "あんしん", "幸せ", "しあわせ",
            "特別", "とくべつ", "大好き", "だいすき",
        ];

        const repeatedWords: Array<{ word: string; count: number }> = [];

        for (const word of wordsToCheck) {
            const regex = new RegExp(word, 'g');
            const matches = text.match(regex);
            if (matches && matches.length >= 2) {
                repeatedWords.push({ word, count: matches.length });
            }
        }

        // 減点計算: 2回→5%, 3回以上→10%
        let deduction = 0;
        for (const item of repeatedWords) {
            if (item.count >= 3) {
                deduction = Math.max(deduction, 10);
            } else if (item.count === 2) {
                deduction = Math.max(deduction, 5);
            }
        }

        return {
            repeated_words: repeatedWords,
            deduction
        };
    }

    /**
     * AIの出力を検証し、不足があればプログラムで補完する
     */
    private validateAndEnhanceGrading(parsed: Record<string, unknown>): Record<string, unknown> {
        const gradingResult = parsed.grading_result as GradingResult | undefined;
        if (!gradingResult) return parsed;

        const recognizedText = gradingResult.recognized_text as string || "";
        
        // 既存のdeduction_detailsを取得
        let deductionDetails: DeductionDetail[] = 
            Array.isArray(gradingResult.deduction_details) 
                ? [...gradingResult.deduction_details] 
                : [];

        // プログラムによる検証結果を格納
        const programmaticChecks: MandatoryChecks = {
            style_check: this.checkStyleProgrammatically(recognizedText),
            vocabulary_check: this.checkVocabularyProgrammatically(recognizedText),
            programmatic_validation: true
        };

        // ========================================
        // AIの出力に不足があれば補完
        // ========================================

        // 1. 文体チェックの補完
        const aiStyleCheck = (gradingResult.mandatory_checks as MandatoryChecks | undefined)?.style_check;
        const styleDeductionExists = deductionDetails.some(d => 
            d.reason?.includes("文体") || d.reason?.includes("敬体") || d.reason?.includes("常体") || d.reason?.includes("混在")
        );

        if (programmaticChecks.style_check.is_mixed && !styleDeductionExists) {
            // AIが文体混在を見落としている場合、追加
            console.log("[Grader] プログラム検証: 文体混在を検出、減点を追加");
            deductionDetails.push({
                reason: `文体の混在（${programmaticChecks.style_check.examples.join(", ")}）`,
                deduction_percentage: 10
            });
        }

        // 2. 語彙チェックの補完
        const vocabDeductionExists = deductionDetails.some(d => 
            d.reason?.includes("繰り返し") || d.reason?.includes("重複") || d.reason?.includes("語彙")
        );

        if (programmaticChecks.vocabulary_check.deduction > 0 && !vocabDeductionExists) {
            // AIが語彙重複を見落としている場合、追加
            const repeatedList = programmaticChecks.vocabulary_check.repeated_words
                .map(w => `「${w.word}」${w.count}回`)
                .join(", ");
            console.log("[Grader] プログラム検証: 語彙重複を検出、減点を追加");
            deductionDetails.push({
                reason: `同じ表現の繰り返し（${repeatedList}）`,
                deduction_percentage: programmaticChecks.vocabulary_check.deduction
            });
        }

        // 3. OCR列ごと読み取りの検証（エラーが発生しても採点は続行）
        try {
            this.validateOcrDebug(parsed);
        } catch (e) {
            console.warn("[Grader] OCR検証中にエラー:", e);
        }

        // 更新したdeduction_detailsを設定
        gradingResult.deduction_details = deductionDetails;

        // mandatory_checksにプログラム検証結果を追加
        gradingResult.mandatory_checks = programmaticChecks;

        // スコアを再計算
        const finalScore = this.computeFinalScore(gradingResult);
        if (finalScore !== null) {
            gradingResult.score = finalScore;
        }

        return parsed;
    }

    /**
     * OCRの列ごと読み取り結果を検証
     * AIがocr_debugを正しく出力しているか、列ごとの文字数が一致しているかを確認
     */
    private validateOcrDebug(parsed: Record<string, unknown>): void {
        const ocrDebug = parsed.ocr_debug as {
            chars_per_column?: number;
            columns_used?: number;
            column_readings?: string[];
            verification?: string;
        } | undefined;

        if (!ocrDebug) {
            console.warn("[Grader] ⚠️ ocr_debugがありません - AIが列ごと読み取りを実行していない可能性");
            return;
        }

        const { chars_per_column, columns_used, column_readings, verification } = ocrDebug;
        
        console.log("[Grader] OCR検証:", {
            基準マス数: chars_per_column,
            使用列数: columns_used,
            列ごと読み取り結果: column_readings?.length,
            AI自己検証: verification
        });

        if (!column_readings || !Array.isArray(column_readings)) {
            console.warn("[Grader] ⚠️ column_readingsがありません - 列ごと読み取りが未実行");
            return;
        }

        if (!chars_per_column || chars_per_column < 15 || chars_per_column > 40) {
            console.warn(`[Grader] ⚠️ 基準マス数が異常: ${chars_per_column} (通常は20〜30)`);
        }

        // 各列の文字数を検証（最後の列以外はchars_per_columnと一致すべき）
        const errors: string[] = [];
        for (let i = 0; i < column_readings.length; i++) {
            const columnText = column_readings[i];
            const charCount = columnText?.length || 0;
            const isLastColumn = i === column_readings.length - 1;

            if (!isLastColumn && chars_per_column && charCount !== chars_per_column) {
                errors.push(`列${i + 1}: ${charCount}文字（期待: ${chars_per_column}文字）`);
            }
        }

        if (errors.length > 0) {
            console.error("[Grader] ❌ 列ごと文字数不一致（読み飛ばしの可能性）:", errors);
        } else {
            console.log("[Grader] ✅ 列ごと文字数検証OK");
        }
    }

    /**
     * 減点詳細からスコアを計算
     * 5%刻みで正確に計算（切り捨て）
     * 例: 5%減点 → 95%、10%減点 → 90%、15%減点 → 85%
     */
    private computeFinalScore(gradingResult: GradingResult | null): number | null {
        if (!gradingResult) return null;
        
        const deductions = Array.isArray(gradingResult.deduction_details) ? gradingResult.deduction_details : [];
        
        const totalDeduction = deductions.reduce((sum, d) => {
            const n = typeof d?.deduction_percentage === "number" 
                ? d.deduction_percentage 
                : Number(d?.deduction_percentage);
            return Number.isFinite(n) ? sum + n : sum;
        }, 0);

        // 減点がある場合は減点スコアを計算（5%刻みで切り捨て）
        // 例: 5%減点 → 95%、7%減点 → 95%、10%減点 → 90%
        if (totalDeduction > 0) {
            const rawScore = 100 - totalDeduction;
            const finalScore = Math.floor(rawScore / 5) * 5;
            return Math.max(0, Math.min(100, finalScore));
        }
        
        // モデルが返したスコアを正規化
        const normalized = this.normalizeScore(gradingResult.score);
        if (normalized !== null) {
            // 5%刻みに切り捨て
            return Math.max(0, Math.min(100, Math.floor(normalized / 5) * 5));
        }
        
        return null;
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

            // 1. ユーザー指定の役割を最優先
            if (file.role) {
                // 単一役割
                if (file.role === 'answer') { buckets.studentFiles.push(file); continue; }
                if (file.role === 'problem') { buckets.problemFiles.push(file); continue; }
                if (file.role === 'model') { buckets.modelAnswerFiles.push(file); continue; }
                if (file.role === 'other') { buckets.otherFiles.push(file); continue; }
                
                // 複合役割（1つのファイルを複数カテゴリに追加）
                if (file.role === 'problem_model') {
                    buckets.problemFiles.push(file);
                    buckets.modelAnswerFiles.push(file);
                    continue;
                }
                if (file.role === 'answer_problem') {
                    buckets.studentFiles.push(file);
                    buckets.problemFiles.push(file);
                    continue;
                }
                if (file.role === 'all') {
                    buckets.studentFiles.push(file);
                    buckets.problemFiles.push(file);
                    buckets.modelAnswerFiles.push(file);
                    continue;
                }
            }

            // 2. ページ番号による分類
            if (pageNumber !== undefined) {
                if (answerPages.has(pageNumber)) { buckets.studentFiles.push(file); continue; }
                if (problemPages.has(pageNumber)) { buckets.problemFiles.push(file); continue; }
                if (modelPages.has(pageNumber)) { buckets.modelAnswerFiles.push(file); continue; }
            }

            // 3. ファイル名による分類
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
     * 2段階採点を実行
     * Stage 1: OCR（JSON強制なし - Web版Geminiと同等の高精度）
     * Stage 2: 採点（OCR結果を使用してJSON出力）
     */
    private async executeTwoStageGrading(
        targetLabel: string, 
        imageParts: ContentPart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        categorizedFiles?: CategorizedFiles
    ) {
        const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, '').trim();

        // ========================================
        // Stage 1: OCR（JSON強制なし）
        // Web版Geminiと同等の条件で高精度読み取り
        // ========================================
        const ocrText = await this.performOcr(imageParts);
        
        // ========================================
        // Stage 2: 採点（OCR結果を使用）
        // ========================================
        console.log("[Grader] Stage 2: 採点開始（JSON出力）");

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

        // Stage 2用プロンプト（OCR結果を明示的に渡す）
        const prompt = `Target Problem Label: ${sanitizedLabel}
${pdfPageHint}

【Stage 1で読み取った生徒の答案テキスト】
以下のテキストは、事前にOCRで正確に読み取った生徒の答案です。
このテキストを「そのまま」使用して採点してください（再度の読み取りは不要です）。

---
${ocrText}
---

上記のテキストと、添付された画像（問題文、模範解答）を参照し、「${sanitizedLabel}」の採点を行ってください。

System Instructionに定義された以下のルールを厳密に適用してください：
- Global Rules: 5大原則に基づく採点
- 採点基準: 減点基準リファレンステーブルに従う
- recognized_text には上記のOCR結果をそのまま使用すること

結果はJSON形式で出力してください。`;

        const result = await this.model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
            generationConfig: this.gradingConfig
        });

        const text = result.response.text();
        const parsed = this.extractJsonFromText(text);

        if (parsed) {
            delete parsed.debug_info;
            
            // OCR結果を強制的に設定（AIが変更しないように）
            if (parsed.grading_result && typeof parsed.grading_result === 'object') {
                (parsed.grading_result as Record<string, unknown>).recognized_text = ocrText;
            }
            
            // プログラムによる検証・補完を実行
            const validated = this.validateAndEnhanceGrading(parsed);
            
            console.log("[Grader] Stage 2 完了: プログラム検証完了", {
                ocrLength: ocrText.length,
                styleCheck: (validated.grading_result as GradingResult | undefined)?.mandatory_checks?.style_check,
                vocabCheck: (validated.grading_result as GradingResult | undefined)?.mandatory_checks?.vocabulary_check,
                finalScore: (validated.grading_result as GradingResult | undefined)?.score
            });
            
            return validated;
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

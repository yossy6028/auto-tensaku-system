import { GoogleGenAI } from "@google/genai";
import { CONFIG } from "../config";
import { SYSTEM_INSTRUCTION } from "../prompts/eduShift";

// API呼び出しのタイムアウト設定（ミリ秒）
// Vercel Proプラン + maxDuration=300秒対応
const OCR_TIMEOUT_MS = 120000;     // 120秒
const GRADING_TIMEOUT_MS = 170000; // 170秒（合計290秒以内）
// 合計270秒以内（300秒制限に余裕を持たせる）

/**
 * タイムアウト付きでPromiseを実行
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${operation}がタイムアウトしました（${timeoutMs / 1000}秒）。再度お試しください。`));
        }, timeoutMs);
    });
    
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);
        return result;
    } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
    }
}

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

type GridCheckResult = {
    expected_cells: number;
    recognized_length: number;
    columns_used?: number;
    consistent: boolean;
    message?: string;
};

type MandatoryChecks = {
    style_check: StyleCheckResult;
    vocabulary_check: VocabularyCheckResult;
    grid_check?: GridCheckResult;
    programmatic_validation: boolean;  // プログラムによる検証が行われたか
};

type DeductionDetail = {
    reason: string;
    deduction_percentage: number;
};

type GradingResult = Record<string, unknown> & { 
    score?: number; 
    recognized_text?: string;
    recognized_text_full?: string;
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
    private ai: GoogleGenAI;
    
    // OCR用の設定（シンプルに）
    private readonly ocrConfig = {
        temperature: 0,
        maxOutputTokens: 4096
    };
    
    // 採点用の設定（JSON出力を強制）
    private readonly gradingConfig = {
        temperature: 0,
        topP: 0.1,
        topK: 16,
        responseMimeType: "application/json" as const
    };
    
    // OCR用のsystemInstruction（最小限）
    private readonly ocrSystemInstruction = `OCR。省略禁止。`;

    constructor() {
        if (!CONFIG.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment variables.");
        }
        // 新SDK: 通常のAPIを使用（v1alphaはVercelで不安定なため無効化）
        this.ai = new GoogleGenAI({
            apiKey: CONFIG.GEMINI_API_KEY
        });
    }

    /**
     * OCRのみ実行（ユーザー確認用）
     * 採点前にユーザーが読み取り結果を確認・修正できるよう、OCRのみを実行
     */
    async performOcrOnly(
        targetLabel: string, 
        files: UploadedFilePart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        fileRoles?: Record<string, FileRole>
    ): Promise<{ text: string; charCount: number }> {
        try {
            // ファイルに役割情報を付与
            if (fileRoles) {
                files.forEach((file, idx) => {
                    if (!file.role) {
                        file.role = fileRoles[idx.toString()];
                    }
                });
            }
            const categorizedFiles = this.categorizeFiles(files, pdfPageInfo);
            const imageParts = this.buildContentSequence(categorizedFiles);
            
            const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, '').trim();
            const ocrResult = await this.performOcr(sanitizedLabel, imageParts, categorizedFiles);
            const text = (ocrResult.text || ocrResult.fullText).trim();
            const charCount = text.replace(/\s+/g, "").length;
            
            return { text, charCount };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'OCRエラー';
            throw new Error(message);
        }
    }

    /**
     * 確認済みテキストで採点を実行（OCR結果の修正後）
     */
    async gradeWithConfirmedText(
        targetLabel: string, 
        confirmedText: string,
        files: UploadedFilePart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        fileRoles?: Record<string, FileRole>
    ) {
        try {
            // ファイルに役割情報を付与
            if (fileRoles) {
                files.forEach((file, idx) => {
                    if (!file.role) {
                        file.role = fileRoles[idx.toString()];
                    }
                });
            }
            const categorizedFiles = this.categorizeFiles(files, pdfPageInfo);
            const imageParts = this.buildContentSequence(categorizedFiles);
            
            const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, '').trim();
            
            // Stage 2のみ実行（confirmedTextを使用）
            return await this.executeGradingWithText(sanitizedLabel, confirmedText, imageParts, pdfPageInfo);
        } catch (error: unknown) {
            return this.handleError(error);
        }
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
     * Stage 1: OCR専用（JSON強制なし）
     * 答案ファイルからテキストを高精度で読み取る
     */
    private async performOcr(targetLabel: string, imageParts: ContentPart[], categorizedFiles?: CategorizedFiles): Promise<{ text: string; fullText: string; matchedTarget: boolean }> {
        console.log("[Grader] Stage 1: OCR開始");

        // OCR対象を選択（答案優先、なければ全画像）
        let targetParts: ContentPart[];
        if (categorizedFiles && categorizedFiles.studentFiles.length > 0) {
            console.log(`[Grader] 答案ファイル数: ${categorizedFiles.studentFiles.length}`);
            targetParts = categorizedFiles.studentFiles.map(file => this.toGenerativePart(file));
        } else {
            const answerParts = imageParts.filter((part, idx) => {
                if (idx > 0) {
                    const prevPart = imageParts[idx - 1];
                    if ("text" in prevPart && prevPart.text?.includes("答案")) {
                        return true;
                    }
                }
                return false;
            });
            targetParts = answerParts.length > 0 ? answerParts : imageParts.filter(p => "inlineData" in p);
        }

        if (targetParts.length === 0) {
            console.error("[Grader] ❌ OCR対象の画像がありません");
            throw new Error("答案画像が見つかりません。ファイルを正しくアップロードしてください。");
        }

        const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, "").trim() || "target";
        // 高精度だったシンプルなプロンプト
        const ocrPrompt = `「${sanitizedLabel}」の手書き文字を全て書き出してください。縦書きは右から左へ読みます。一字も省略せず、書いてある通りに出力してください。`;

        let result;
        try {
            // 新SDK: ai.models.generateContent()を使用
            // OCRもgemini-3-pro-previewを使用（高精度）
            result = await withTimeout(
                this.ai.models.generateContent({
                    model: CONFIG.MODEL_NAME,
                    contents: [{ role: "user", parts: [{ text: ocrPrompt }, ...targetParts] }],
                    config: {
                        ...this.ocrConfig,
                        systemInstruction: this.ocrSystemInstruction
                    }
                }),
                OCR_TIMEOUT_MS,
                "OCR処理"
            );
        } catch (error) {
            console.error("[Grader] OCR API呼び出しエラー:", error);
            throw new Error(`OCR処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }

        let raw = "";
        try {
            raw = result.text?.trim() ?? "";
        } catch (error) {
            console.error("[Grader] OCRレスポンスの読み取りエラー:", error);
            throw new Error("OCR結果の取得に失敗しました。画像が破損している可能性があります。");
        }

        // プレーンテキストとして処理（改行を削除）
        let text = raw.replace(/[\r\n]+/g, "").trim();
        // 文字数：シンプルに空白除去してカウント
        let charCount = text.replace(/\s+/g, "").length;
        
        console.log("[Grader] OCR結果:", { text: text.substring(0, 100), charCount });

        if (!text) {
            console.error("[Grader] ❌ OCRが空の結果を返しました");
            text = "（回答を読み取れませんでした）";
            charCount = 0;
        }

        console.log("[Grader] Stage 1 完了:", {
            textLength: text.length,
            charCount,
            preview: text.substring(0, 120)
        });

        return { text, fullText: text, matchedTarget: true };
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
     * ラベル文字列から数値を抽出（例: "問9" -> 9, "問九" -> 9）
     */
    private parseLabelNumber(label: string): number | null {
        const digitMatch = label.match(/[0-9０-９]+/);
        if (digitMatch) {
            const halfWidth = digitMatch[0].replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
            const parsed = parseInt(halfWidth, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }

        const kanjiMatch = label.match(/[一二三四五六七八九十百千]+/);
        if (kanjiMatch) {
            const kanji = kanjiMatch[0];
            const map: Record<string, number> = {
                "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
                "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10
            };
            if (kanji === "十") return 10;
            if (kanji.length === 1 && map[kanji] !== undefined) return map[kanji];
            if (kanji.includes("十")) {
                const [tens, ones] = kanji.split("十");
                const tensValue = tens ? map[tens] ?? 1 : 1;
                const onesValue = ones ? map[ones] ?? 0 : 0;
                const total = tensValue * 10 + onesValue;
                return Number.isFinite(total) ? total : null;
            }
        }

        return null;
    }

    /**
     * 数値の表記ゆれをバリエーション生成
     */
    private numberVariants(num: number | null): string[] {
        if (num === null) return [];
        const fullWidth = num.toString().replace(/[0-9]/g, d => String.fromCharCode(d.charCodeAt(0) + 0xFEE0));

        const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
        const toKanji = (n: number): string | null => {
            if (n < 0 || n > 20) return null;
            if (n <= 10) return map[n] ?? null;
            if (n < 20) return "十" + (map[n - 10] ?? "");
            if (n === 20) return "二十";
            return null;
        };

        const circled = (n: number): string | null => {
            if (n < 1 || n > 20) return null;
            return String.fromCharCode(0x245F + n); // 0x2460 is ①
        };

        const roman = (n: number): string | null => {
            const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
            if (n < 1 || n > romans.length) return null;
            return romans[n - 1];
        };

        return [
            num.toString(),
            fullWidth,
            toKanji(num),
            circled(num),
            roman(num),
            roman(num)?.toLowerCase()
        ].filter((v): v is string => Boolean(v));
    }

    /**
     * ターゲット設問の開始行を検出する正規表現を構築
     */
    private buildTargetLabelPatterns(targetLabel: string, parsedNumber: number | null): RegExp[] {
        const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cleaned = targetLabel.replace(/\s+/g, "");

        const patterns: RegExp[] = [
            new RegExp(`^\\s*${escape(cleaned)}[\\s:：．\\.、)）】】\\]\\}]?`, "i")
        ];

        if (parsedNumber !== null) {
            const variants = this.numberVariants(parsedNumber)
                .map(v => escape(v))
                .join("|");

            patterns.push(new RegExp(
                `^\\s*(?:第\\s*)?(?:問|設問|問題|大問|Q)\\s*[\\(（【\\[\\{□■\\<]?\\s*(?:${variants})\\s*[\\)）】\\]\\}□■\\>]?(?:[\\.．、:：】】])?`,
                "i"
            ));

            patterns.push(new RegExp(
                `^\\s*[\\(（【\\[\\{<〈［｛〔〖【]??\\s*(?:${variants})\\s*[\\)）】\\]\\}>〉］｝〕〗】]??\\s*[\\.．、)）】】]*`,
                "i"
            ));
        }

        return patterns;
    }

    /**
     * 次の設問境界らしい行かどうかを判定
     */
    private isLikelyQuestionBoundary(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed) return false;

        const boundaryPatterns = [
            /^(?:問|設問|問題|大問|Q)[\s　]*[（(【\[]?\s*[0-9０-９一二三四五六七八九十百千]/i,
            /^[（(【\[<〈［｛〔〖【]?\s*[0-9０-９]{1,2}\s*[)）】\]>〉］｝〕〗】][\s．.、：:]?/,
            /^[①-⑳ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/
        ];

        return boundaryPatterns.some(r => r.test(trimmed));
    }

    /**
     * OCR結果からターゲット設問部分のみを抽出
     */
    private extractTargetAnswerSection(ocrText: string, targetLabel: string): { text: string; matched: boolean } {
        const lines = ocrText.split(/\r?\n/);
        const parsedNumber = this.parseLabelNumber(targetLabel);
        const patterns = this.buildTargetLabelPatterns(targetLabel, parsedNumber);

        let startIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]?.trim() ?? "";
            if (!line) continue;
            if (patterns.some(r => r.test(line))) {
                startIndex = i;
                break;
            }
        }

        if (startIndex === -1) {
            return { text: ocrText.trim(), matched: false };
        }

        let endIndex = lines.length;
        for (let i = startIndex + 1; i < lines.length; i++) {
            if (this.isLikelyQuestionBoundary(lines[i])) {
                endIndex = i;
                break;
            }
        }

        const extracted = lines.slice(startIndex, endIndex).join("\n").trim();
        if (!extracted) {
            return { text: ocrText.trim(), matched: false };
        }

        return { text: extracted, matched: true };
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

        // recognized_text の検証と復元
        const placeholderPattern = /読み取れませんでした|画像が不鮮明|見つかりません|〓{3,}|取得できませんでした/;
        const currentText = String(gradingResult.recognized_text || "").trim();
        const currentLength = currentText.replace(/\s+/g, "").length;
        const needsRecovery = !currentText || placeholderPattern.test(currentText);
        
        // ocr_debug から最適なテキストを探す
        if (parsed.ocr_debug) {
            const ocrDebug = parsed.ocr_debug as { 
                column_readings?: string[];
                corrected_text?: string;
                original_text?: string;
                total_chars?: number;
            } | undefined;
            
            const candidates: { source: string; text: string; length: number }[] = [];
            
            // 1. corrected_text（AIが修正したテキスト）
            if (ocrDebug?.corrected_text && typeof ocrDebug.corrected_text === 'string') {
                const text = ocrDebug.corrected_text.trim();
                if (text && !placeholderPattern.test(text)) {
                    candidates.push({ source: "corrected_text", text, length: text.replace(/\s+/g, "").length });
                }
            }
            
            // 2. column_readings の連結
            if (ocrDebug?.column_readings && Array.isArray(ocrDebug.column_readings)) {
                const rebuilt = ocrDebug.column_readings.join("");
                if (rebuilt.trim() && !placeholderPattern.test(rebuilt)) {
                    candidates.push({ source: "column_readings", text: rebuilt.trim(), length: rebuilt.replace(/\s+/g, "").length });
                }
            }
            
            // 3. 現在のテキスト（プレースホルダーでない場合）
            if (currentText && !placeholderPattern.test(currentText)) {
                candidates.push({ source: "current", text: currentText, length: currentLength });
            }
            
            // 最も長いテキストを選択
            if (candidates.length > 0) {
                const best = candidates.reduce((a, b) => a.length > b.length ? a : b);
                if (best.length > currentLength || needsRecovery) {
                    console.log(`[Grader] OCR復元: ${best.source} から recognized_text を更新 (${best.length}文字)`);
                    gradingResult.recognized_text = best.text;
                }
            }
        }

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
            const gridCheck = this.validateOcrDebug(parsed);
            if (gridCheck) {
                programmaticChecks.grid_check = gridCheck;
                // OCRズレをdeduction_detailsに反映（減点しないが情報として保持）
                if (!gridCheck.consistent) {
                    deductionDetails.push({
                        reason: `マス数と文字数の不一致（期待${gridCheck.expected_cells}文字/読み取り${gridCheck.recognized_length}文字）`,
                        deduction_percentage: 0
                    });
                }
            }
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
    private validateOcrDebug(parsed: Record<string, unknown>): GridCheckResult | undefined {
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

        // 文字数整合チェック
        try {
            const expectedCells = column_readings.reduce((sum, col, idx) => {
                if (col === undefined || col === null) return sum;
                const isLast = idx === column_readings.length - 1;
                if (chars_per_column && !isLast) {
                    return sum + chars_per_column; // 基準マス数
                }
                return sum + col.length;
            }, 0);
            const recognizedText = (parsed.grading_result as GradingResult | undefined)?.recognized_text;
            const recognizedLength = recognizedText ? String(recognizedText).replace(/\s+/g, "").length : 0;
            const consistent = expectedCells === recognizedLength;

            const gridCheck: GridCheckResult = {
                expected_cells: expectedCells,
                recognized_length: recognizedLength,
                columns_used,
                consistent,
                message: consistent ? "マス数と文字数が一致" : "マス数と文字数が不一致"
            };

            if (!consistent) {
                console.error("[Grader] ❌ マス数とOCR文字数が一致しません", {
                    expectedCells,
                    recognizedLength
                });
            }

            return gridCheck;
        } catch (err) {
            console.warn("[Grader] グリッド整合チェックでエラー:", err);
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
        
        console.log("[Grader] extractJsonFromText: cleaned length =", cleaned.length);
        
        try {
            const result = JSON.parse(cleaned);
            console.log("[Grader] ✅ JSON parse success (first try)");
            return result;
        } catch (e) {
            console.log("[Grader] ⚠️ JSON parse failed (first try), trying to extract {...}");
        }
        
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        
        console.log("[Grader] Brace positions:", { firstBrace, lastBrace });
        
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
            console.error("[Grader] ❌ No valid JSON braces found");
            return null;
        }
        
        const extracted = cleaned.substring(firstBrace, lastBrace + 1);
        console.log("[Grader] Extracted JSON length:", extracted.length);
        console.log("[Grader] Extracted JSON preview:", extracted.substring(0, 200));
        
        try {
            const result = JSON.parse(extracted);
            console.log("[Grader] ✅ JSON parse success (second try)");
            return result;
        } catch (e) {
            console.error("[Grader] ❌ JSON parse failed (second try):", e);
            return null;
        }
    }

    /**
     * 確認済みテキストで採点のみ実行（Stage 2のみ）
     */
    private async executeGradingWithText(
        targetLabel: string,
        confirmedText: string,
        imageParts: ContentPart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null
    ) {
        console.log("[Grader] 確認済みテキストで採点開始");
        
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

        const charCount = confirmedText.replace(/\s+/g, "").length;
        
        const prompt = `Target Problem Label: ${targetLabel}
${pdfPageHint}

【ユーザーが確認・修正した生徒の答案テキスト】（${charCount}文字）
---
${confirmedText}
---

上記のテキストを recognized_text として使用してください（これはユーザーが確認済みです）。

添付された画像（問題文、模範解答）を参照し、「${targetLabel}」の採点を行ってください。

System Instructionに定義された以下のルールを厳密に適用してください：
- Global Rules: 5大原則に基づく採点
- 採点基準: 減点基準リファレンステーブルに従う
- recognized_text は上記の確認済みテキストをそのまま出力すること

結果はJSON形式で出力してください。`;

        const result = await withTimeout(
            this.ai.models.generateContent({
                model: CONFIG.MODEL_NAME,
                contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
                config: {
                    ...this.gradingConfig,
                    systemInstruction: SYSTEM_INSTRUCTION
                }
            }),
            GRADING_TIMEOUT_MS,
            "採点処理"
        );

        const text = result.text ?? "";
        console.log("[Grader] 採点AIレスポンス長:", text.length);
        
        const parsed = this.extractJsonFromText(text);
        
        if (parsed) {
            delete parsed.debug_info;
            
            const gradingResultObj = (parsed.grading_result && typeof parsed.grading_result === 'object')
                ? parsed.grading_result as Record<string, unknown>
                : (parsed.grading_result = {} as Record<string, unknown>);

            // 確認済みテキストを強制的に設定
            gradingResultObj.recognized_text = confirmedText;
            gradingResultObj.recognized_text_full = confirmedText;
            gradingResultObj.user_confirmed = true;
            
            // プログラムによる検証・補完を実行
            const validated = this.validateAndEnhanceGrading(parsed);
            
            console.log("[Grader] 採点完了（確認済みテキスト使用）");
            return validated;
        }

        console.error("[Grader] ❌ JSONパース失敗");
        return {
            status: "error",
            message: "System Error: Failed to parse AI response.",
            grading_result: {
                recognized_text: confirmedText,
                user_confirmed: true
            }
        };
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
        // 答案ファイルのみを使用して高精度読み取り
        // ========================================
        const ocrResult = await this.performOcr(sanitizedLabel, imageParts, categorizedFiles);
        const ocrText = (ocrResult.text || ocrResult.fullText).trim();
        
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

        // OCR結果がプレースホルダーかどうかを判定
        const ocrIsPlaceholder = /読み取れませんでした|画像が不鮮明|見つかりません/.test(ocrText);
        const ocrCharCount = ocrText.replace(/\s+/g, "").length;
        
        // Stage 2用プロンプト
        const ocrSection = ocrIsPlaceholder
            ? `【重要】事前のOCRで回答テキストを読み取れませんでした。
添付画像から「${sanitizedLabel}」の生徒の回答を**マス目を1つずつ確認して**読み取り、recognized_text に出力してください。

マス目（原稿用紙形式）の場合：
- 縦書き: 右の列から左へ、各列は上から下へ
- 1マス1文字として、すべてのマスを読み取る
- 句読点も1文字として数える
- 読めない文字は「〓」で出力
- 推測や補完は禁止

ocr_debug にマス目の詳細を出力：
{
  "chars_per_column": 1列あたりの文字数,
  "columns_used": 使用した列数,
  "column_readings": ["列1の文字", "列2の文字", ...],
  "total_chars": 総文字数
}`
            : `【Stage 1で読み取った生徒の答案テキスト】（${ocrCharCount}文字）
---
${ocrText}
---

上記のテキストを recognized_text として使用してください。
ただし、**マス目の画像を確認し、文字の抜けや誤りがないか検証**してください。

もし抜けや誤りを発見した場合は、正しいテキストに修正して recognized_text に出力してください。
その場合、ocr_debug に修正内容を記録：
{
  "original_text": "事前OCRの結果",
  "corrected_text": "修正後のテキスト",
  "corrections": ["修正1の説明", "修正2の説明", ...],
  "chars_per_column": 1列あたりの文字数,
  "columns_used": 使用した列数,
  "column_readings": ["列1の文字", "列2の文字", ...]
}`;

        const prompt = `Target Problem Label: ${sanitizedLabel}
${pdfPageHint}

${ocrSection}

添付された画像（問題文、模範解答、生徒の答案）を参照し、「${sanitizedLabel}」の採点を行ってください。

System Instructionに定義された以下のルールを厳密に適用してください：
- Global Rules: 5大原則に基づく採点
- 採点基準: 減点基準リファレンステーブルに従う
- recognized_text は必ず出力すること（生徒が書いた回答テキスト）
- 可能な場合、マス目の列ごとの読み取りを ocr_debug として出力すること（例: chars_per_column, columns_used, column_readings[], verification）

結果はJSON形式で出力してください。`;

        const result = await withTimeout(
            this.ai.models.generateContent({
                model: CONFIG.MODEL_NAME,
                contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
                config: {
                    ...this.gradingConfig,
                    systemInstruction: SYSTEM_INSTRUCTION
                }
            }),
            GRADING_TIMEOUT_MS,
            "採点処理"
        );

        const text = result.text ?? "";
        console.log("[Grader] Stage 2 AIレスポンス長:", text.length);
        console.log("[Grader] Stage 2 AIレスポンスプレビュー:", text.substring(0, 500));
        
        const parsed = this.extractJsonFromText(text);
        
        if (!parsed) {
            console.error("[Grader] ❌ JSONパース失敗");
            console.error("[Grader] レスポンス全文:", text);
        }

        if (parsed) {
            delete parsed.debug_info;
            
            // grading_resultを確実に持たせる
            const gradingResultObj = (parsed.grading_result && typeof parsed.grading_result === 'object')
                ? parsed.grading_result as Record<string, unknown>
                : (parsed.grading_result = {} as Record<string, unknown>);

            // プレースホルダーパターン（これにマッチするテキストは「読み取り失敗」とみなす）
            const placeholderPattern = /読み取れませんでした|画像が不鮮明|見つかりません|〓{3,}/;
            
            // 候補テキストを収集（優先順）
            const candidates: { source: string; text: string }[] = [];
            
            // 1. AIが返したrecognized_text（検証・修正済みの可能性）
            const aiRecognized = String(gradingResultObj.recognized_text || "").trim();
            if (aiRecognized && !placeholderPattern.test(aiRecognized)) {
                candidates.push({ source: "ai_response", text: aiRecognized });
            }
            
            // 2. ocr_debug.column_readings から復元
            const ocrDebug = parsed.ocr_debug as { column_readings?: string[] } | undefined;
            if (ocrDebug?.column_readings && Array.isArray(ocrDebug.column_readings)) {
                const rebuilt = ocrDebug.column_readings.join("");
                if (rebuilt.trim() && !placeholderPattern.test(rebuilt)) {
                    candidates.push({ source: "column_readings", text: rebuilt.trim() });
                }
            }
            
            // 3. Stage 1のOCR結果（fullText優先）
            const normalizedFull = (ocrResult.fullText || "").trim();
            if (normalizedFull && !placeholderPattern.test(normalizedFull)) {
                candidates.push({ source: "ocr_fullText", text: normalizedFull });
            }
            
            // 4. Stage 1のOCR結果（ターゲット抽出済み）
            const normalizedText = (ocrText || "").trim();
            if (normalizedText && !placeholderPattern.test(normalizedText)) {
                candidates.push({ source: "ocr_text", text: normalizedText });
            }
            
            // 優先順位ベースで選択し、極端に短い場合のみより長い候補に差し替える
            // （少し長いだけの誤読で文字数超過にならないようにする）
            let finalRecognized = "";
            let selectedSource = "none";

            for (const candidate of candidates) {
                if (!finalRecognized) {
                    finalRecognized = candidate.text;
                    selectedSource = candidate.source;
                    continue;
                }

                const isSignificantlyLonger = candidate.text.length > finalRecognized.length * 1.2;
                if (isSignificantlyLonger) {
                    finalRecognized = candidate.text;
                    selectedSource = candidate.source;
                }
            }
            
            // どれも有効でない場合はプレースホルダー
            if (!finalRecognized) {
                console.error("[Grader] ❌ 有効なOCR結果が見つかりません。candidates:", candidates);
                finalRecognized = "（回答テキストを取得できませんでした）";
                selectedSource = "placeholder";
            } else {
                console.log(`[Grader] ✅ recognized_text選択: ${selectedSource} (${finalRecognized.length}文字)`);
            }

            gradingResultObj.recognized_text = finalRecognized;
            gradingResultObj.recognized_text_full = normalizedFull || finalRecognized;
            gradingResultObj.recognized_text_source = {
                matched_target: ocrResult.matchedTarget,
                full_length: ocrResult.fullText?.length ?? 0
            };
            
            // プログラムによる検証・補完を実行
            const validated = this.validateAndEnhanceGrading(parsed);
            
            console.log("[Grader] Stage 2 完了: プログラム検証完了", {
                ocrLength: ocrText.length,
                hasGradingResult: !!validated.grading_result,
                hasScore: !!(validated.grading_result as GradingResult | undefined)?.score,
                hasFeedback: !!(validated.grading_result as GradingResult | undefined)?.feedback_content,
                styleCheck: (validated.grading_result as GradingResult | undefined)?.mandatory_checks?.style_check,
                vocabCheck: (validated.grading_result as GradingResult | undefined)?.mandatory_checks?.vocabulary_check,
                finalScore: (validated.grading_result as GradingResult | undefined)?.score
            });
            
            // 検証結果の構造をログ出力
            console.log("[Grader] validated keys:", Object.keys(validated));
            if (validated.grading_result) {
                console.log("[Grader] grading_result keys:", Object.keys(validated.grading_result as object));
            }
            
            return validated;
        }

        console.error("[Grader] ❌ JSONパース失敗後のフォールバック");
        return {
            status: "error",
            message: "System Error: Failed to parse AI response.",
            grading_result: {
                recognized_text: ocrText,
                recognized_text_full: ocrResult.fullText || ocrText,
                recognized_text_source: {
                    matched_target: ocrResult.matchedTarget,
                    full_length: ocrResult.fullText?.length ?? 0
                }
            }
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

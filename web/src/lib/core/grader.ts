import { GoogleGenAI } from "@google/genai";
import { CONFIG } from "../config";
import { SYSTEM_INSTRUCTION } from "../prompts/eduShift";

// API呼び出しのタイムアウト設定（ミリ秒）
// Vercel Pro + Fluid Compute対応: maxDuration=300秒
// 2024-12-21: 大きなファイル（2-3MB）でタイムアウトするため設定を最適化
// - OCRと採点の合計が300秒以内に収まるよう調整
// - 大きなファイルではリトライ回数とタイムアウトを抑制
const OCR_TIMEOUT_MS = 180_000;     // 180秒（Gemini APIの応答遅延に対応）
const GRADING_TIMEOUT_MS = 150_000; // 150秒（採点はOCRより長めに）
const OCR_RETRY_ATTEMPTS = 2;       // 2回に削減（3回→2回）
const OCR_RETRY_BACKOFF_MS = 500;   // 500msに短縮（800ms→500ms）
const OCR_RETRY_JITTER_MS = 200;    // 200msに短縮（400ms→200ms）
// シンプルなプロンプトに変更したため、思考バジェットを削減
// 過剰な思考を防ぐため1024トークンに制限
const OCR_THINKING_BUDGET = 1024;
// 合計タイムアウト想定: OCR(120秒×2回) + 採点(150秒) = 最大390秒
// ただし通常は1回目で成功するため問題なし

// 採点の厳しさ（3段階）
export type GradingStrictness = "lenient" | "standard" | "strict";
const DEFAULT_STRICTNESS: GradingStrictness = "standard";

function buildStrictnessInstruction(strictness: GradingStrictness): string {
    // 既存の採点基準・5大原則は維持しつつ、判断の「寄せ方」だけを変える
    switch (strictness) {
        case "lenient":
            return [
                "採点の厳しさ: 甘め（lenient）",
                "- 減点は慎重に行い、明確な根拠がある場合のみ適用する",
                "- 模範解答と完全一致でなくても、本文根拠に沿う言い換え・類義表現は積極的に正解扱いする",
                "- 形式（文末・呼応）による減点は、意味が十分に合っている場合は最小限にする（ただし致命的な誤りは減点）",
            ].join("\n");
        case "strict":
            return [
                "採点の厳しさ: 厳しめ（strict）",
                "- 設問の要求（要素・形式・文末）を満たしているかを厳格に確認し、不足があれば確実に減点する",
                "- 要素不足・因果の欠落・対比の不均衡などは見逃さず、根拠に基づいて減点理由を分離して記載する",
                "- 表現の曖昧さや論理の飛躍がある場合は、具体的に指摘し減点する（ただし本文根拠のない推測は禁止）",
            ].join("\n");
        case "standard":
        default:
            return [
                "採点の厳しさ: 標準（standard）",
                "- 既定の採点ルール（5大原則・減点基準）に従い、過不足のない減点を行う",
            ].join("\n");
    }
}

function buildGradingSystemInstruction(strictness: GradingStrictness): string {
    return `${SYSTEM_INSTRUCTION}\n\n# Strictness (採点の厳しさ)\n${buildStrictnessInstruction(strictness)}\n`;
}

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

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gemini APIのレート制限状態を管理するシングルトンクラス
 *
 * gemini-3-pro-previewには1日あたりの利用制限があり、
 * 制限に達した場合はgemini-2.5-proへ自動的にフォールバックする。
 * 日付が変わると自動的にリセットされ、gemini-3-proに戻る。
 */
class RateLimitManager {
    private static instance: RateLimitManager;
    private rateLimitedDate: string | null = null; // YYYY-MM-DD形式（JST）

    private constructor() {}

    static getInstance(): RateLimitManager {
        if (!RateLimitManager.instance) {
            RateLimitManager.instance = new RateLimitManager();
        }
        return RateLimitManager.instance;
    }

    /**
     * 現在の日付を取得（JST）
     */
    private getCurrentDateJST(): string {
        const now = new Date();
        // JSTはUTC+9
        const jstOffset = 9 * 60 * 60 * 1000;
        const jstDate = new Date(now.getTime() + jstOffset);
        return jstDate.toISOString().split('T')[0];
    }

    /**
     * レート制限に達したことを記録
     */
    markRateLimited(): void {
        this.rateLimitedDate = this.getCurrentDateJST();
        console.warn(`[RateLimitManager] ⚠️ Gemini 3 Pro がレート制限に達しました（${this.rateLimitedDate}）。フォールバックモデルに切り替えます。`);
    }

    /**
     * レート制限中かどうかをチェック
     * 日付が変わっていたら自動的にリセット
     */
    isRateLimited(): boolean {
        if (!this.rateLimitedDate) {
            return false;
        }

        const currentDate = this.getCurrentDateJST();
        if (currentDate !== this.rateLimitedDate) {
            // 日付が変わったのでリセット
            console.info(`[RateLimitManager] ✅ 日付が変わりました（${this.rateLimitedDate} → ${currentDate}）。Gemini 3 Pro に復帰します。`);
            this.rateLimitedDate = null;
            return false;
        }

        return true;
    }

    /**
     * 現在のステータスを取得
     */
    getStatus(): { isLimited: boolean; limitedDate: string | null } {
        return {
            isLimited: this.isRateLimited(),
            limitedDate: this.rateLimitedDate
        };
    }

    /**
     * エラーメッセージがレート制限エラーかどうかを判定
     */
    static isRateLimitError(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error);
        // Gemini APIのレート制限エラーパターン
        const rateLimitPatterns = [
            /429/i,                           // HTTP 429 Too Many Requests
            /RESOURCE_EXHAUSTED/i,            // gRPCステータス
            /quota/i,                         // quota exceeded
            /rate.*limit/i,                   // rate limit
            /too.*many.*requests/i,           // too many requests
            /daily.*limit/i,                  // daily limit
            /requests.*per.*day/i,            // requests per day limit
        ];

        return rateLimitPatterns.some(pattern => pattern.test(message));
    }
}

// グローバルインスタンス
const rateLimitManager = RateLimitManager.getInstance();

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

// フィードバック内容の型定義
type FeedbackContent = {
    good_point?: string;
    improvement_advice?: string;
    rewrite_example?: string;
};

type GradingResult = Record<string, unknown> & {
    score?: number;
    recognized_text?: string;
    recognized_text_full?: string;
    deduction_details?: DeductionDetail[];
    mandatory_checks?: MandatoryChecks;
    feedback_content?: FeedbackContent;
};

// 品質検証結果の型定義
type QualityValidationResult = {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
};

// ファイル分類用の正規表現パターン
const FILE_PATTERNS = {
    answer: /(answer|ans|student|解答|答案|生徒)/i,
    problem: /(problem|question|課題|設問|問題|本文)/i,
    model: /(model|key|模範|解説|正解|解答例)/i
};

export class EduShiftGrader {
    private ai: GoogleGenAI;
    private ocrThinkingMode: "disabled" | "enabled" | "unsupported" = "disabled";
    
    // OCR用の設定（安定性優先）
    // Geminiの思考モードがthinkingBudgetを無視して~8000トークン使用するため、
    // maxOutputTokensを32768に設定して出力用の余裕を確保
    // (thinking: ~8000 + output: ~2000 = ~10000で十分な余裕あり)
    private readonly ocrConfig = {
        temperature: 0,
        topP: 0.1,
        topK: 16,
        maxOutputTokens: 32768,
        responseMimeType: "application/json" as const
    };
    
    // 採点用の設定（JSON出力を強制）
    private readonly gradingConfig = {
        temperature: 0,
        topP: 0.1,
        topK: 16,
        responseMimeType: "application/json" as const
    };
    
    // OCR用のsystemInstruction（安定性重視）
    private readonly ocrSystemInstruction = [
        "あなたは高精度OCRエンジンです。",
        "画像に書かれた文字をそのまま転写します。要約・補完・校正は禁止。",
        "判読不能な文字は必ず「〓」に置き換える。",
        "縦書きは右から左、上から下に読む。",
        "出力はJSONのみ: {\"text\":\"...\",\"char_count\":123}"
    ].join("\n");

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
     * layout情報（行数、段落数、字下げ位置）も返す
     */
    async performOcrOnly(
        targetLabel: string,
        files: UploadedFilePart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        fileRoles?: Record<string, FileRole>
    ): Promise<{
        text: string;
        charCount: number;
        layout?: {
            total_lines: number;
            paragraph_count: number;
            indented_columns: number[];
        };
    }> {
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

            const sanitizedLabel = targetLabel.replace(/[<>\\"'`]/g, "").trim() || "target";
            const ocrResult = await this.performOcr(sanitizedLabel, imageParts, categorizedFiles, pdfPageInfo);
            const text = (ocrResult.text || ocrResult.fullText).trim();
            const charCount = text.replace(/\s+/g, "").length;

            return { text, charCount, layout: ocrResult.layout };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "OCRエラー";
            throw new Error(message);
        }
    }

    async gradeWithConfirmedText(
        targetLabel: string,
        confirmedText: string,
        files: UploadedFilePart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        fileRoles?: Record<string, FileRole>,
        strictness: GradingStrictness = DEFAULT_STRICTNESS,
        problemCondition?: string,
        layout?: { total_lines: number; paragraph_count: number; indented_columns: number[] },
        modelAnswerText?: string
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

            const sanitizedLabel = targetLabel.replace(/[<>\\"'`]/g, "").trim() || "target";

            // Stage 2のみ実行（confirmedTextとlayout情報を使用）
            return await this.executeGradingWithText(sanitizedLabel, confirmedText, imageParts, pdfPageInfo, strictness, problemCondition, layout, modelAnswerText);
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
        fileRoles?: Record<string, FileRole>,
        strictness: GradingStrictness = DEFAULT_STRICTNESS,
        modelAnswerText?: string
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
            return await this.executeTwoStageGrading(targetLabel, imageParts, pdfPageInfo, categorizedFiles, strictness, modelAnswerText);
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    private async performOcr(
        targetLabel: string,
        imageParts: ContentPart[],
        categorizedFiles?: CategorizedFiles,
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null
    ): Promise<{
        text: string;
        fullText: string;
        matchedTarget: boolean;
        layout?: {
            total_lines: number;
            paragraph_count: number;
            indented_columns: number[];
        };
    }> {
        console.log("[Grader] Stage 1: OCR開始");

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:performOcr:entry',message:'OCR開始',data:{targetLabel,studentFilesCount:categorizedFiles?.studentFiles.length,studentFileNames:categorizedFiles?.studentFiles.map(f=>({name:f.name,role:f.role})),problemFilesCount:categorizedFiles?.problemFiles.length,modelFilesCount:categorizedFiles?.modelAnswerFiles.length,hasAllRole:categorizedFiles?.studentFiles.some(f=>f.role==='all')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D'})}).catch(()=>{});
        // #endregion

        // OCR対象を選択（答案優先、なければ全画像）
        let targetParts: ContentPart[];
        if (categorizedFiles && categorizedFiles.studentFiles.length > 0) {
            console.log(`[Grader] 答案ファイル数: ${categorizedFiles.studentFiles.length}`);
            const answerPages = this.parsePageRange(pdfPageInfo?.answerPage);
            const MAX_ANSWER_PAGES = 10;

            // ページ指定がある場合は該当ページのみ優先（pageNumber付きファイルが対象）
            const prioritized = answerPages.size > 0
                ? categorizedFiles.studentFiles.filter(f => f.pageNumber !== undefined && answerPages.has(f.pageNumber))
                : categorizedFiles.studentFiles;

            const selectedAnswers = (prioritized.length > 0 ? prioritized : categorizedFiles.studentFiles).slice(0, MAX_ANSWER_PAGES);
            if (selectedAnswers.length < categorizedFiles.studentFiles.length) {
                console.warn(`[Grader] 複数の答案が指定されたため、先頭から最大${MAX_ANSWER_PAGES}件を使用してOCRを実行します`);
            }
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:performOcr:targetSelect',message:'OCR対象ファイル選択',data:{selectedCount:selectedAnswers.length,selectedFiles:selectedAnswers.map(f=>({name:f.name,role:f.role}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            targetParts = selectedAnswers.map(file => this.toGenerativePart(file));
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

        // 画像数が多い場合の警告（6枚以上でOCR精度が低下する傾向がある）
        const RECOMMENDED_MAX_IMAGES = 5;
        const usePerImageOnly = targetParts.length > RECOMMENDED_MAX_IMAGES;
        if (usePerImageOnly) {
            console.warn(`[Grader] ⚠️ 画像数が多い（${targetParts.length}枚）: 個別OCRに切り替えます。推奨は${RECOMMENDED_MAX_IMAGES}枚以下です。`);
        }

        // ファイルサイズを推定（base64エンコードされたデータから）
        // 2024-12-21: 大きなファイルではプロンプト数とリトライを削減してタイムアウトを防ぐ
        const estimatedTotalBytes = targetParts.reduce((sum, part) => {
            if ("inlineData" in part && part.inlineData?.data) {
                // Base64は元のサイズの約1.33倍なので逆算
                return sum + Math.floor(part.inlineData.data.length * 0.75);
            }
            return sum;
        }, 0);
        const estimatedMB = estimatedTotalBytes / (1024 * 1024);
        const isLargeFile = estimatedMB > 1.5; // 1.5MB以上を大きなファイルとみなす

        if (isLargeFile) {
            console.warn(`[Grader] ⚠️ 大きなファイル検出（推定${estimatedMB.toFixed(2)}MB）: タイムアウト防止のためOCRを最適化モードで実行`);
        }

        const sanitizedLabel = targetLabel.replace(/[<>\\"'`]/g, "").trim() || "target";
        const ocrModelName = CONFIG.OCR_MODEL_NAME || CONFIG.MODEL_NAME;
        const fallbackModelName = CONFIG.OCR_FALLBACK_MODEL_NAME || "";

        // 複合ファイル（role='all'）かどうかをチェック
        const hasAllRole = categorizedFiles?.studentFiles.some(f => f.role === 'all') ?? false;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:performOcr:hasAllRoleCheck',message:'複合ファイルチェック',data:{hasAllRole,sanitizedLabel},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C'})}).catch(()=>{});
        // #endregion

        // 2段階OCR: まずマス目構造を分析（大きなファイルではスキップ）
        let gridInfo: { columns: number; rows: number } | null = null;
        if (!isLargeFile) {
            console.log("[Grader] マス目構造分析を開始...");
            gridInfo = await this.analyzeGridStructure(targetParts, ocrModelName);
            // 分析結果はログに出力済み（成功/失敗問わず既存フローを続行）
        }

        // 大きなファイルではプロンプト数を1つに削減（タイムアウト防止）
        const ocrPrompts = isLargeFile
            ? [this.buildOcrPrompt(sanitizedLabel, "primary", hasAllRole)]  // 大きなファイル: 1プロンプトのみ
            : [
                this.buildOcrPrompt(sanitizedLabel, "primary", hasAllRole, gridInfo ?? undefined),
                this.buildOcrPrompt(sanitizedLabel, "retry", hasAllRole, gridInfo ?? undefined),
                this.buildOcrPrompt(sanitizedLabel, "detail", hasAllRole, gridInfo ?? undefined)
            ];
        const fallbackPrompt = ocrPrompts[ocrPrompts.length - 1];
        // 大きなファイルではフォールバックモデルも無効化（タイムアウト防止）
        const shouldUseFallbackModel = !isLargeFile && Boolean(fallbackModelName && fallbackModelName !== ocrModelName);
        let fallbackLogged = false;
        let finalText = "";
        let charCount = 0;
        let finalLayout: { total_lines: number; paragraph_count: number; indented_columns: number[] } | undefined;

        // OcrResult型を定義（layout情報を含む）
        type OcrResult = ReturnType<typeof this.parseOcrResponse>;

        if (usePerImageOnly) {
            const perImageTexts: string[] = [];
            for (const part of targetParts) {
                let bestValid: OcrResult | null = null;
                let bestFallback: OcrResult | null = null;
                let bestFallbackCount = -1;

                for (const prompt of ocrPrompts) {
                    const attempt = await this.runOcrAttempt(prompt, [part], ocrModelName);

                    if (attempt.text && !this.isOcrFailure(attempt.text)) {
                        bestValid = attempt;
                        break;
                    }

                    if (attempt.text && attempt.charCount > bestFallbackCount) {
                        bestFallback = attempt;
                        bestFallbackCount = attempt.charCount;
                    }
                }

                if (!bestValid && shouldUseFallbackModel) {
                    if (!fallbackLogged) {
                        console.warn("[Grader] OCRフォールバックモデルで再試行します:", fallbackModelName);
                        fallbackLogged = true;
                    }
                    const fallbackAttempt = await this.runOcrAttempt(fallbackPrompt, [part], fallbackModelName);
                    if (fallbackAttempt.text && !this.isOcrFailure(fallbackAttempt.text)) {
                        bestValid = fallbackAttempt;
                    } else if (fallbackAttempt.text && fallbackAttempt.charCount > bestFallbackCount) {
                        bestFallback = fallbackAttempt;
                        bestFallbackCount = fallbackAttempt.charCount;
                    }
                }

                const selected = bestValid ?? bestFallback ?? { text: "", charCount: 0 };
                perImageTexts.push(selected.text);
                charCount += selected.charCount;
                // 最初の有効なlayout情報を使用
                if (!finalLayout && (bestValid?.layout || bestFallback?.layout)) {
                    finalLayout = bestValid?.layout ?? bestFallback?.layout;
                }
            }

            finalText = perImageTexts.join("\n").trim();
        } else {
            let bestValid: OcrResult | null = null;
            let bestFallback: OcrResult | null = null;
            let bestValidCount = -1;
            let bestFallbackCount = -1;

            for (const prompt of ocrPrompts) {
                const attempt = await this.runOcrAttempt(prompt, targetParts, ocrModelName);

                if (attempt.text && !this.isOcrFailure(attempt.text)) {
                    if (attempt.charCount > bestValidCount) {
                        bestValid = attempt;
                        bestValidCount = attempt.charCount;
                    }
                    break;
                }

                if (attempt.text && attempt.charCount > bestFallbackCount) {
                    bestFallback = attempt;
                    bestFallbackCount = attempt.charCount;
                }
            }

            if (!bestValid && shouldUseFallbackModel) {
                console.warn("[Grader] OCRフォールバックモデルで再試行します:", fallbackModelName);
                const fallbackAttempt = await this.runOcrAttempt(fallbackPrompt, targetParts, fallbackModelName);
                if (fallbackAttempt.text && !this.isOcrFailure(fallbackAttempt.text)) {
                    bestValid = fallbackAttempt;
                    bestValidCount = fallbackAttempt.charCount;
                } else if (fallbackAttempt.text && fallbackAttempt.charCount > bestFallbackCount) {
                    bestFallback = fallbackAttempt;
                    bestFallbackCount = fallbackAttempt.charCount;
                }
            }

            finalText = bestValid?.text ?? bestFallback?.text ?? "";
            charCount = bestValid?.charCount ?? bestFallback?.charCount ?? 0;
            finalLayout = bestValid?.layout ?? bestFallback?.layout;
        }

        // layout情報をログ出力
        if (finalLayout) {
            console.log("[Grader] Layout検出:", {
                total_lines: finalLayout.total_lines,
                paragraph_count: finalLayout.paragraph_count,
                indented_columns: finalLayout.indented_columns
            });
        }

        console.log("[Grader] OCR結果:", { text: finalText.substring(0, 100), charCount });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:performOcr:result',message:'OCR結果',data:{hasAllRole,charCount,textPreview:finalText.substring(0,200),textFull:finalText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,E'})}).catch(()=>{});
        // #endregion

        if (!finalText || this.isOcrFailure(finalText)) {
            console.error("[Grader] ❌ OCRが空の結果を返しました");
            const fallbackText = "（回答を読み取れませんでした）";
            return { text: fallbackText, fullText: fallbackText, matchedTarget: true, layout: undefined };
        }

        console.log("[Grader] Stage 1 完了:", {
            textLength: finalText.length,
            charCount,
            preview: finalText.substring(0, 120),
            layout: finalLayout
        });

        return { text: finalText, fullText: finalText, matchedTarget: true, layout: finalLayout };
    }

    private buildOcrPrompt(
        label: string,
        mode: "primary" | "retry" | "detail",
        hasAllRole?: boolean,
        gridInfo?: { columns: number; rows: number }
    ): string {
        // 複合ラベル（大問X問Y形式）をパースして詳細な指示を生成
        const compound = this.parseCompoundLabel(label);
        let targetDescription: string;

        if (compound.mainNum !== null && compound.subNum !== null) {
            const mainVariants = this.numberVariants(compound.mainNum).slice(0, 3).join("/");
            const subVariants = this.numberVariants(compound.subNum).slice(0, 3).join("/");
            targetDescription = `読み取り対象：「大問${mainVariants}」の中の「問${subVariants}」の解答欄のみ。他の大問の解答は絶対に読み取らないこと。`;
        } else {
            targetDescription = `読み取り対象：「${label}」の解答欄のみ。`;
        }

        // シンプルなOCRプロンプト（レイアウト情報付き）
        // 縦書き（原稿用紙）と横書き（短文記述）の両方に対応
        const gridDescription = gridInfo
            ? `マス目検出済み: ${gridInfo.columns}列×${gridInfo.rows}行（最大${gridInfo.columns * gridInfo.rows}文字）`
            : "";
        const isShortAnswer = gridInfo && (gridInfo.columns * gridInfo.rows <= 100); // 100文字以下は短文記述

        const cotPrompt = isShortAnswer
            ? `マス目OCR（短文記述問題）。${targetDescription}
${hasAllRole ? `手書きの答案部分のみ読み取り。印刷文字は無視。` : ""}${gridDescription}

【タスク】
1. マス目を1つずつ確認して文字を読み取る
2. 横書きの場合：左上から右へ、上から下へ読む
3. 縦書きの場合：右上から下へ、右から左へ読む
4. 空マスは無視（文末の空白は除外）

【出力JSON】
{
  "text": "<読み取ったテキスト>",
  "char_count": <文字数（空白除く）>,
  "layout": {
    "total_lines": <行数>,
    "paragraph_count": 1,
    "indented_columns": []
  }
}`
            : `原稿用紙OCR。${targetDescription}
${hasAllRole ? `手書きの答案部分のみ読み取り。印刷文字は無視。` : ""}${gridDescription}

【タスク】
1. 各列の1マス目を見て、空白なら字下げ（段落開始）と判断
2. 字下げ部分は全角スペース「　」で表現
3. 文字を読み取り

【出力JSON】
{
  "text": "<全文（字下げ=全角スペース）>",
  "char_count": <文字数>,
  "layout": {
    "total_lines": <列数>,
    "paragraph_count": <段落数>,
    "indented_columns": [<字下げ列番号>]
  }
}`;

        let finalPrompt = cotPrompt;

        if (mode === "retry") {
            finalPrompt = `【再試行】前回の読み取りが不十分でした。特に各列の1マス目の状態を慎重に観察してください。

` + cotPrompt;
        }

        if (mode === "detail") {
            finalPrompt = `【最終パス】1文字ずつ確認し、特に段落冒頭の字下げ（1マス目の空白）を正確に検出してください。

` + cotPrompt;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:buildOcrPrompt',message:'OCRプロンプト構築(CoT)',data:{label,mode,hasAllRole},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,C,D'})}).catch(()=>{});
        // #endregion

        return finalPrompt;
    }

    private isOcrFailure(text: string): boolean {
        const normalized = text.replace(/\s+/g, "");
        if (!normalized) return true;
        return /読み取れませんでした|読めません|判読不能|不鮮明|見つかりません|認識できません|空です/.test(text);
    }

    /**
     * マス目構造を分析する（2段階OCRの1段階目）
     * 失敗してもnullを返し、既存のOCRフローに影響を与えない
     */
    private async analyzeGridStructure(
        parts: ContentPart[],
        modelName?: string
    ): Promise<{ columns: number; rows: number } | null> {
        // レート制限チェック: 制限中ならフォールバックモデルを使用
        let resolvedModel = modelName || CONFIG.OCR_MODEL_NAME || CONFIG.MODEL_NAME;
        if (rateLimitManager.isRateLimited() && CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
            resolvedModel = CONFIG.RATE_LIMIT_FALLBACK_MODEL;
        }

        // 改善されたプロンプト: 原稿用紙だけでなく、短い記述問題のマス目も検出
        const prompt = `この画像の解答欄にマス目があるか確認してください。

【検出対象】
- 原稿用紙形式（縦書き）のマス目
- 横書きの解答欄のマス目
- 短い記述問題（20〜50字程度）のマス目

【出力形式】
マス目がある場合: {"has_grid": true, "columns": <列数（縦書き）or行数（横書き）>, "rows": <1列の文字数>}
マス目がない場合: {"has_grid": false}

JSONのみ出力してください。`;

        try {
            const result = await withTimeout(
                this.ai.models.generateContent({
                    model: resolvedModel,
                    contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
                    config: {
                        ...this.ocrConfig,
                        systemInstruction: this.ocrSystemInstruction
                    }
                }),
                20000, // 20秒タイムアウト（短い記述問題のマス目検出にも対応）
                "マス目構造分析"
            );

            const raw = result?.text?.trim() ?? "";
            if (!raw) {
                console.log("[Grader] マス目構造分析: 応答が空");
                return null;
            }

            const parsed = this.extractJsonFromText(raw);
            if (!parsed || parsed.has_grid === false) {
                console.log("[Grader] マス目構造分析: マス目なし");
                return null;
            }

            const columns = typeof parsed.columns === "number" ? parsed.columns : null;
            const rows = typeof parsed.rows === "number" ? parsed.rows : null;

            if (columns && rows && columns > 0 && rows > 0) {
                console.log(`[Grader] ✅ マス目構造検出: ${columns}列 × ${rows}行 = 最大${columns * rows}文字`);
                return { columns, rows };
            }

            console.log("[Grader] マス目構造分析: 無効な値", { columns, rows });
            return null;
        } catch (error) {
            // 失敗しても既存フローに影響を与えない
            console.warn("[Grader] マス目構造分析失敗（既存フローで続行）:", error instanceof Error ? error.message : error);
            return null;
        }
    }

    private parseOcrResponse(raw: string): {
        text: string;
        charCount: number;
        layout?: {
            total_lines: number;
            paragraph_count: number;
            indented_columns: number[];
        };
        step1_observation?: {
            total_columns: number;
            columns: Array<{ col: number; first_cell: string; indent: boolean }>;
        };
    } {
        const parsed = this.extractJsonFromText(raw);
        const parsedText = typeof parsed?.text === "string" ? parsed.text : "";
        const baseText = parsedText || raw;
        const normalized = baseText.replace(/[\r\n]+/g, "").trim();
        const parsedCount = typeof parsed?.char_count === "number" ? parsed.char_count : null;
        const charCount = parsedCount !== null && Number.isFinite(parsedCount)
            ? parsedCount
            : normalized.replace(/\s+/g, "").length;

        // 新しいCoT形式のlayout情報を抽出
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedLayout = parsed?.layout as any;
        const layout = parsedLayout && typeof parsedLayout === "object" ? {
            total_lines: typeof parsedLayout.total_lines === "number" ? parsedLayout.total_lines : 0,
            paragraph_count: typeof parsedLayout.paragraph_count === "number" ? parsedLayout.paragraph_count : 0,
            indented_columns: Array.isArray(parsedLayout.indented_columns) ? parsedLayout.indented_columns : []
        } : undefined;

        // Step1の観察結果も抽出（デバッグ用）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsedStep1 = parsed?.step1_observation as any;
        const step1_observation = parsedStep1 && typeof parsedStep1 === "object" ? {
            total_columns: typeof parsedStep1.total_columns === "number" ? parsedStep1.total_columns : 0,
            columns: Array.isArray(parsedStep1.columns) ? parsedStep1.columns : []
        } : undefined;

        return { text: normalized, charCount, layout, step1_observation };
    }

    private async runOcrAttempt(
        prompt: string,
        parts: ContentPart[],
        modelName?: string
    ): Promise<{
        text: string;
        charCount: number;
        layout?: {
            total_lines: number;
            paragraph_count: number;
            indented_columns: number[];
        };
        step1_observation?: {
            total_columns: number;
            columns: Array<{ col: number; first_cell: string; indent: boolean }>;
        };
    }> {
        // レート制限チェック: 制限中ならフォールバックモデルを使用
        let resolvedModel = modelName || CONFIG.OCR_MODEL_NAME || CONFIG.MODEL_NAME;
        const originalModel = resolvedModel;
        
        if (rateLimitManager.isRateLimited() && CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
            resolvedModel = CONFIG.RATE_LIMIT_FALLBACK_MODEL;
            console.info(`[Grader] レート制限中のため、フォールバックモデルを使用: ${resolvedModel}`);
        }
        
        let best: ReturnType<typeof this.parseOcrResponse> | null = null;
        let bestCount = -1;
        let lastError: unknown = null;

        for (let attemptIndex = 0; attemptIndex < OCR_RETRY_ATTEMPTS; attemptIndex += 1) {
            try {
                const baseConfig = {
                    ...this.ocrConfig,
                    systemInstruction: this.ocrSystemInstruction
                };
                const buildConfig = (mode: "disabled" | "enabled" | "unsupported") => {
                    if (mode === "unsupported") {
                        return baseConfig;
                    }
                    return {
                        ...baseConfig,
                        thinkingConfig: {
                            thinkingBudget: mode === "enabled" ? OCR_THINKING_BUDGET : 0
                        }
                    };
                };
                const configWithThinking = buildConfig(this.ocrThinkingMode);
                let result;
                try {
                    result = await withTimeout(
                        this.ai.models.generateContent({
                            model: resolvedModel,
                            contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
                            config: configWithThinking
                        }),
                        OCR_TIMEOUT_MS,
                        "OCR処理"
                    );
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    
                    // レート制限エラーの検出
                    if (RateLimitManager.isRateLimitError(error) && CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
                        rateLimitManager.markRateLimited();
                        
                        // フォールバックモデルで再試行
                        if (resolvedModel !== CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
                            console.warn(`[Grader] レート制限エラー検出。${CONFIG.RATE_LIMIT_FALLBACK_MODEL} で再試行します。`);
                            resolvedModel = CONFIG.RATE_LIMIT_FALLBACK_MODEL;
                            result = await withTimeout(
                                this.ai.models.generateContent({
                                    model: resolvedModel,
                                    contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
                                    config: configWithThinking
                                }),
                                OCR_TIMEOUT_MS,
                                "OCR処理（フォールバック）"
                            );
                        } else {
                            throw error;
                        }
                    } else {
                        const thinkingUnsupported = /thinking/i.test(message) && /unsupported|not supported|does not support|not available/i.test(message);
                        const thinkingRequired = /thinking/i.test(message) && /only works in thinking mode|budget 0 is invalid|requires thinking/i.test(message);
                        if (this.ocrThinkingMode !== "enabled" && thinkingRequired) {
                            console.warn("[Grader] thinkingモード必須のため有効化します:", message);
                            this.ocrThinkingMode = "enabled";
                            result = await withTimeout(
                                this.ai.models.generateContent({
                                    model: resolvedModel,
                                    contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
                                    config: buildConfig("enabled")
                                }),
                                OCR_TIMEOUT_MS,
                                "OCR処理"
                            );
                        } else if (this.ocrThinkingMode !== "unsupported" && thinkingUnsupported) {
                            console.warn("[Grader] thinkingConfigが未対応のため無効化します:", message);
                            this.ocrThinkingMode = "unsupported";
                            result = await withTimeout(
                                this.ai.models.generateContent({
                                    model: resolvedModel,
                                    contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
                                    config: buildConfig("unsupported")
                                }),
                                OCR_TIMEOUT_MS,
                                "OCR処理"
                            );
                        } else {
                            throw error;
                        }
                    }
                }

                const raw = result?.text?.trim() ?? "";
                if (!raw) {
                    const candidate = result?.candidates?.[0];
                    const promptFeedback = result?.promptFeedback;
                    console.warn("[Grader] OCR応答が空でした", {
                        responseId: result?.responseId,
                        candidateCount: result?.candidates?.length ?? 0,
                        finishReason: candidate?.finishReason,
                        finishMessage: candidate?.finishMessage,
                        promptBlockReason: promptFeedback?.blockReason,
                        promptBlockMessage: promptFeedback?.blockReasonMessage,
                        thoughtsTokenCount: result?.usageMetadata?.thoughtsTokenCount,
                        candidatesTokenCount: result?.usageMetadata?.candidatesTokenCount,
                        totalTokenCount: result?.usageMetadata?.totalTokenCount
                    });
                    lastError = new Error("OCR応答が空でした");
                } else {
                    const parsed = this.parseOcrResponse(raw);
                    if (parsed.text && !this.isOcrFailure(parsed.text)) {
                        // 成功時、使用モデルをログ出力
                        if (resolvedModel !== originalModel) {
                            console.info(`[Grader] ✅ OCR成功（フォールバックモデル: ${resolvedModel}）`);
                        }
                        return parsed;
                    }
                    if (parsed.text && parsed.charCount > bestCount) {
                        best = parsed;
                        bestCount = parsed.charCount;
                    }
                }
            } catch (error) {
                console.error("[Grader] OCR API呼び出しエラー:", error);
                lastError = error;
                
                // レート制限エラーの場合、リトライ前にフォールバックモデルに切り替え
                if (RateLimitManager.isRateLimitError(error) && CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
                    rateLimitManager.markRateLimited();
                    if (resolvedModel !== CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
                        resolvedModel = CONFIG.RATE_LIMIT_FALLBACK_MODEL;
                        console.warn(`[Grader] 次回リトライは ${resolvedModel} を使用します。`);
                    }
                }
            }

            if (attemptIndex < OCR_RETRY_ATTEMPTS - 1) {
                const jitter = Math.floor(Math.random() * OCR_RETRY_JITTER_MS);
                const backoff = OCR_RETRY_BACKOFF_MS * (attemptIndex + 1) + jitter;
                await sleep(backoff);
            }
        }

        if (best) {
            return best;
        }

        if (lastError) {
            console.error("[Grader] OCR処理に失敗しました:", lastError);
        }

        return { text: "", charCount: 0, layout: undefined, step1_observation: undefined };
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

    /**
     * 数字文字列（半角/全角/漢数字）を数値に変換
     */
    private parseNumberString(numStr: string): number | null {
        // 全角数字を半角に変換
        const halfWidth = numStr.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
        
        // 半角数字の場合
        if (/^[0-9]+$/.test(halfWidth)) {
            const parsed = parseInt(halfWidth, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }

        // 漢数字の場合
        const map: Record<string, number> = {
            "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
            "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10
        };

        if (numStr === "十") return 10;
        if (numStr.length === 1 && map[numStr] !== undefined) return map[numStr];
        if (numStr.includes("十")) {
            const [tens, ones] = numStr.split("十");
            const tensValue = tens ? map[tens] ?? 1 : 1;
            const onesValue = ones ? map[ones] ?? 0 : 0;
            const total = tensValue * 10 + onesValue;
            return Number.isFinite(total) ? total : null;
        }

        return null;
    }

    private parseLabelNumber(label: string): number | null {
        const cleanedLabel = label.replace(/\s+/g, "");

        // パターン1: 「大問X問Y」「大問X-問Y」形式 → Y（小問番号）を返す
        const daimonPattern = cleanedLabel.match(/大問[0-9０-９一二三四五六七八九十]+[の\-ー]?問([0-9０-９一二三四五六七八九十]+)/);
        if (daimonPattern) {
            return this.parseNumberString(daimonPattern[1]);
        }

        // パターン2: 「問X(Y)」「問X-Y」「問X（Y）」形式 → Y（枝番号）を返す
        const subPattern = cleanedLabel.match(/問[0-9０-９一二三四五六七八九十]+[\(（\-ー]([0-9０-９一二三四五六七八九十]+)/);
        if (subPattern) {
            return this.parseNumberString(subPattern[1]);
        }

        // パターン3: 複合でない場合、最初の数値を返す（既存の動作）
        const digitMatch = label.match(/[0-9０-９]+/);
        if (digitMatch) {
            const halfWidth = digitMatch[0].replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
            const parsed = parseInt(halfWidth, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }

        // 漢数字のフォールバック
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
     * 複合ラベル（大問X問Y形式）から大問番号と小問番号の両方を抽出
     */
    private parseCompoundLabel(label: string): { mainNum: number | null; subNum: number | null } {
        const cleanedLabel = label.replace(/\s+/g, "");

        // パターン: 「大問X問Y」「大問X-問Y」「大問Xの問Y」形式
        const daimonPattern = cleanedLabel.match(/大問([0-9０-９一二三四五六七八九十]+)[の\-ー]?問([0-9０-９一二三四五六七八九十]+)/);
        if (daimonPattern) {
            return {
                mainNum: this.parseNumberString(daimonPattern[1]),
                subNum: this.parseNumberString(daimonPattern[2])
            };
        }

        // 複合ラベルでない場合はnullを返す
        return { mainNum: null, subNum: null };
    }

    /**
     * ターゲット設問の開始行を検出する正規表現を構築
     */
    private buildTargetLabelPatterns(targetLabel: string, parsedNumber: number | null): RegExp[] {
        const escape = (value: string) => value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
        const cleaned = targetLabel.replace(/\s+/g, "");

        const patterns: RegExp[] = [
            new RegExp(`^\\s*${escape(cleaned)}[\\s:：．\\.、)）】】\\]\\}]?`, "i")
        ];

        // 複合ラベル（大問X問Y形式）をチェック
        const compound = this.parseCompoundLabel(targetLabel);
        
        if (compound.mainNum !== null && compound.subNum !== null) {
            // 複合ラベルの場合: 大問番号と小問番号の両方を使ってマッチング
            const mainVariants = this.numberVariants(compound.mainNum)
                .map(v => escape(v))
                .join("|");
            const subVariants = this.numberVariants(compound.subNum)
                .map(v => escape(v))
                .join("|");

            // パターン: 「大問X」の後に「問Y」が続く形式
            patterns.push(new RegExp(
                `^\\s*(?:第\\s*)?大問\\s*[\\(（【\\[\\{]?\\s*(?:${mainVariants})\\s*[\\)）】\\]\\}]?[\\s:：．\\.、の\\-ー]*問\\s*[\\(（【\\[\\{]?\\s*(?:${subVariants})\\s*[\\)）】\\]\\}]?`,
                "i"
            ));
            
            // パターン: 「大問X-問Y」「大問X問Y」などの連続形式
            patterns.push(new RegExp(
                `大問\\s*(?:${mainVariants})[\\s\\-ー]*問\\s*(?:${subVariants})`,
                "i"
            ));

        } else if (parsedNumber !== null) {
            // 単純なラベルの場合: 既存の動作
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
     * 語彙チェック（違和感のある繰り返し表現のみ検出）
     * 
     * 【方針】柔軟に判断し、実際に違和感が生じる繰り返しのみを減点する
     * - 「〜から〜から」のように同じ接続助詞が近接して繰り返される場合 → 減点
     * - 文章全体で同じ単語が複数回出現しても、自然な文脈なら減点しない
     * - 「〜ている」「〜ていた」などの補助動詞の繰り返しは自然なので減点しない
     */
    private checkVocabularyProgrammatically(text: string): VocabularyCheckResult {
        const repeatedWords: Array<{ word: string; count: number }> = [];

        // 【重要】違和感が生じる「近接した同一表現の繰り返し」のみを検出
        // パターン: 同じ接続助詞が20文字以内に連続して出現する場合
        const awkwardPatterns = [
            // 「〜から〜から」パターン（因果の「から」が近接して繰り返される）
            { pattern: /から.{1,15}から/g, display: "「から」の連続使用" },
            // 「〜ので〜ので」パターン
            { pattern: /ので.{1,15}ので/g, display: "「ので」の連続使用" },
            // 「〜ため〜ため」パターン
            { pattern: /ため.{1,15}ため/g, display: "「ため」の連続使用" },
            // 「〜けど〜けど」「〜けれど〜けれど」パターン
            { pattern: /けれ?ど.{1,15}けれ?ど/g, display: "「けど/けれど」の連続使用" },
            // 「〜のに〜のに」パターン
            { pattern: /のに.{1,15}のに/g, display: "「のに」の連続使用" },
            // 「〜と思う〜と思う」パターン（短文内での繰り返し）
            { pattern: /と思[うっ].{1,20}と思[うっ]/g, display: "「と思う」の連続使用" },
            // 「〜という〜という」パターン
            { pattern: /という.{1,15}という/g, display: "「という」の連続使用" },
            // 「〜ている〜ている〜ている」3回以上の過度な繰り返し（2回は自然）
            { pattern: /ている.{1,20}ている.{1,20}ている/g, display: "「ている」の過度な繰り返し" },
        ];

        for (const { pattern, display } of awkwardPatterns) {
            const matches = text.match(pattern);
            if (matches && matches.length >= 1) {
                // 既に同じ表示名で登録されていなければ追加
                if (!repeatedWords.some(w => w.word === display)) {
                    repeatedWords.push({ word: display, count: matches.length + 1 });
                }
            }
        }

        // 減点計算: 違和感のある繰り返しが見つかった場合のみ5%減点
        // （過度に厳しくしない）
        let deduction = 0;
        if (repeatedWords.length > 0) {
            deduction = 5;
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
        // AIの文体チェック結果（参考情報として保持、プログラムチェックを優先）
        const _aiStyleCheck = (gradingResult.mandatory_checks as MandatoryChecks | undefined)?.style_check;
        void _aiStyleCheck; // 明示的に未使用であることを示す
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

        // 2. 語彙チェック（プログラム検出を最優先 - AIの判断に依存しない）
        // AIの判断にブレがあるため、プログラムで検出した場合は必ず減点を適用
        if (programmaticChecks.vocabulary_check.deduction > 0) {
            // まず、AIが追加した語彙関連の減点を削除（重複防止）
            deductionDetails = deductionDetails.filter(d => 
                !d.reason?.includes("繰り返し") && 
                !d.reason?.includes("重複") && 
                !d.reason?.includes("語彙") &&
                !d.reason?.includes("反復")
            );
            
            // プログラム検出結果で上書き（AIの判断に関係なく適用）
            const repeatedList = programmaticChecks.vocabulary_check.repeated_words
                .map(w => `「${w.word}」${w.count}回`)
                .join(", ");
            console.log("[Grader] プログラム検証: 表現の反復を検出、減点を適用:", repeatedList);
            deductionDetails.push({
                reason: `表現の反復（${repeatedList}）`,
                deduction_percentage: programmaticChecks.vocabulary_check.deduction
            });
        } else {
            // プログラムで検出しなかった場合、AIが誤って減点していたら削除
            const aiVocabDeduction = deductionDetails.find(d => 
                d.reason?.includes("繰り返し") || 
                d.reason?.includes("重複") || 
                d.reason?.includes("語彙") ||
                d.reason?.includes("反復")
            );
            if (aiVocabDeduction) {
                console.log("[Grader] プログラム検証: 反復なし、AIの誤検出を削除:", aiVocabDeduction.reason);
                deductionDetails = deductionDetails.filter(d => d !== aiVocabDeduction);
            }
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
     * 採点結果の品質を検証
     * 必須フィールド（good_point, improvement_advice, rewrite_example等）が含まれているかを確認
     * 不完全な結果は課金対象外とするため、この検証でエラーを返す
     */
    private validateGradingQuality(parsed: Record<string, unknown>): QualityValidationResult {
        const missingFields: string[] = [];
        const warnings: string[] = [];

        const gradingResult = parsed.grading_result as GradingResult | undefined;

        // grading_result自体の存在チェック
        if (!gradingResult) {
            missingFields.push("grading_result");
            return { isValid: false, missingFields, warnings };
        }

        // 必須フィールドのチェック
        // 1. recognized_text（OCR結果）
        const recognizedText = String(gradingResult.recognized_text || "").trim();
        const placeholderPattern = /読み取れませんでした|画像が不鮮明|見つかりません|〓{5,}|取得できませんでした|回答テキストを取得できませんでした/;

        if (!recognizedText || placeholderPattern.test(recognizedText)) {
            missingFields.push("recognized_text（生徒の解答）");
        } else if (recognizedText.length < 5) {
            warnings.push("recognized_textが極端に短い（5文字未満）");
        }

        // 2. score（スコア）
        if (typeof gradingResult.score !== "number" || Number.isNaN(gradingResult.score)) {
            missingFields.push("score（採点スコア）");
        }

        // 3. feedback_content（フィードバック内容）
        const feedbackContent = gradingResult.feedback_content as FeedbackContent | undefined;

        if (!feedbackContent) {
            missingFields.push("feedback_content（フィードバック）");
        } else {
            // good_point（良い点）は必須
            const goodPoint = String(feedbackContent.good_point || "").trim();
            if (!goodPoint || goodPoint.length < 5) {
                missingFields.push("good_point（良い点）");
            }

            // improvement_advice（改善アドバイス）は必須
            const advice = String(feedbackContent.improvement_advice || "").trim();
            if (!advice || advice.length < 5) {
                missingFields.push("improvement_advice（改善アドバイス）");
            }

            // rewrite_example（書き直し例）は必須
            const rewrite = String(feedbackContent.rewrite_example || "").trim();
            if (!rewrite || rewrite.length < 5) {
                missingFields.push("rewrite_example（書き直し例）");
            }
        }

        const isValid = missingFields.length === 0;

        if (!isValid) {
            console.error("[Grader] ❌ 品質検証失敗 - 必須フィールドが不足:", missingFields);
        } else if (warnings.length > 0) {
            console.warn("[Grader] ⚠️ 品質検証警告:", warnings);
        } else {
            console.log("[Grader] ✅ 品質検証OK");
        }

        return { isValid, missingFields, warnings };
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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:computeFinalScore:entry',message:'computeFinalScore開始',data:{deductionsCount:deductions.length,deductions:deductions.map(d=>({reason:d.reason,percentage:d.deduction_percentage,percentageType:typeof d.deduction_percentage})),aiScore:gradingResult.score,aiScoreType:typeof gradingResult.score},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C,D'})}).catch(()=>{});
        // #endregion
        
        const totalDeduction = deductions.reduce((sum, d) => {
            const n = typeof d?.deduction_percentage === "number" 
                ? d.deduction_percentage 
                : Number(d?.deduction_percentage);
            return Number.isFinite(n) ? sum + n : sum;
        }, 0);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:computeFinalScore:totalDeduction',message:'減点合計計算',data:{totalDeduction,willComputeFromDeductions:totalDeduction>0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion

        // 減点がある場合は減点スコアを計算（5%刻みで切り捨て）
        // 例: 5%減点 → 95%、7%減点 → 95%、10%減点 → 90%
        if (totalDeduction > 0) {
            const rawScore = 100 - totalDeduction;
            const finalScore = Math.floor(rawScore / 5) * 5;
            const result = Math.max(0, Math.min(100, finalScore));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:computeFinalScore:fromDeductions',message:'減点からスコア計算',data:{totalDeduction,rawScore,finalScore,result},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            return result;
        }
        
        // モデルが返したスコアを正規化
        const normalized = this.normalizeScore(gradingResult.score);
        if (normalized !== null) {
            // 5%刻みに切り捨て
            const result = Math.max(0, Math.min(100, Math.floor(normalized / 5) * 5));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:computeFinalScore:fromAIScore',message:'AIスコアから計算',data:{aiScore:gradingResult.score,normalized,result},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D'})}).catch(()=>{});
            // #endregion
            return result;
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

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:categorizeFiles:entry',message:'categorizeFiles開始',data:{fileCount:files.length,files:files.map(f=>({name:f.name,role:f.role,pageNumber:f.pageNumber})),pdfPageInfo},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion

        for (const file of files) {
            const name = file.name || "";
            const pageNumber = file.pageNumber;

            // 1. ユーザー指定の役割を最優先
            if (file.role) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:categorizeFiles:roleCheck',message:'ファイルロール処理',data:{fileName:name,role:file.role},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
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
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'grader.ts:categorizeFiles:roleAll',message:'複合ファイル(all)を3カテゴリに追加',data:{fileName:name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C'})}).catch(()=>{});
                    // #endregion
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
        } catch {
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
     * @param problemCondition 問題条件オーバーライド（AIが誤読した字数制限などを手動で指定）
     */
    private async executeGradingWithText(
        targetLabel: string,
        confirmedText: string,
        imageParts: ContentPart[],
        pdfPageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
        strictness: GradingStrictness = DEFAULT_STRICTNESS,
        problemCondition?: string,
        layout?: { total_lines: number; paragraph_count: number; indented_columns: number[] },
        modelAnswerText?: string
    ) {
        console.log("[Grader] 確認済みテキストで採点開始");
        if (problemCondition) {
            console.log("[Grader] 問題条件オーバーライド:", problemCondition);
        }
        if (layout) {
            console.log("[Grader] Layout情報使用:", layout);
        }

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

        // 問題条件オーバーライドセクション
        const problemConditionSection = problemCondition ? `
【重要：ユーザーが指定した問題条件】
以下の条件はユーザーが手動で指定したものです。画像から読み取った条件よりも**こちらを優先**してください。
---
${problemCondition}
---
※ この条件に基づいて字数制限や形式要件を判定してください。
` : '';

        // Layout情報セクション（OCRで検出した物理レイアウト）
        // これがあれば、採点AIは画像を再分析する必要がない
        const layoutSection = layout ? `
【⚠️ 重要：事前検証済みレイアウト情報（OCRで物理的に確認済み）】
以下のレイアウト情報は、画像のマス目を物理的に解析して取得したものです。
**この情報を信頼し、画像から再度レイアウトを判断しないでください。**

・総行数（列数）: ${layout.total_lines}行
・段落数: ${layout.paragraph_count}段落
・字下げ（1マス目が空白）がある列: ${layout.indented_columns.length > 0 ? layout.indented_columns.map(c => `${c}列目`).join(', ') : 'なし'}

※ 上記の情報に基づき、以下は採点対象外です：
  - 字下げ（段落冒頭の1マス空け）→ 上記で検証済み、減点禁止
  - 行数 → 上記で検証済み、減点禁止
  - 段落構成 → 上記で検証済み、減点禁止
` : '';

        // 模範解答テキストセクション（ユーザーが手入力した場合）
        const modelAnswerSection = modelAnswerText ? `
【⚠️ 重要：ユーザーが手入力した模範解答】
以下の模範解答はユーザーが直接入力したものです。画像内の模範解答よりも**こちらを優先**して採点の基準としてください。
---
${modelAnswerText}
---
※ この模範解答と生徒の答案を比較して採点してください。
` : '';

        if (modelAnswerText) {
            console.log("[Grader] ユーザー入力の模範解答使用:", modelAnswerText.substring(0, 50) + (modelAnswerText.length > 50 ? '...' : ''));
        }

        const prompt = `Target Problem Label: ${targetLabel}
${pdfPageHint}
${problemConditionSection}${layoutSection}${modelAnswerSection}
【ユーザーが確認・修正した生徒の答案テキスト】（${charCount}文字）
---
${confirmedText}
---

上記のテキストを recognized_text として使用してください（これはユーザーが確認済みです）。

添付された画像（問題文、模範解答）を参照し、「${targetLabel}」の採点を行ってください。
${problemCondition ? `
**採点時の注意:** ユーザーが問題条件（字数制限など）を手動で指定しています。
画像から読み取った条件ではなく、上記の【ユーザーが指定した問題条件】に従って採点してください。
例えば「40字以上50字以内」と指定されている場合、生徒の答案が${charCount}文字であれば、
${charCount >= 40 && charCount <= 50 ? '字数条件を満たしています。' : '字数条件を満たしていません。'}
` : ''}
System Instructionに定義された以下のルールを厳密に適用してください：
- Global Rules: 5大原則に基づく採点
- 採点基準: 減点基準リファレンステーブルに従う
- recognized_text は上記の確認済みテキストをそのまま出力すること
${layout ? '- 【重要】上記のレイアウト情報を信頼し、字下げ・行数・段落構成での減点は禁止' : ''}

結果はJSON形式で出力してください。`;

        // レート制限チェック: 制限中ならフォールバックモデルを使用
        let gradingModel = CONFIG.MODEL_NAME;
        if (rateLimitManager.isRateLimited() && CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
            gradingModel = CONFIG.RATE_LIMIT_FALLBACK_MODEL;
            console.info(`[Grader] レート制限中のため、採点にフォールバックモデルを使用: ${gradingModel}`);
        }

        let result;
        try {
            result = await withTimeout(
                this.ai.models.generateContent({
                    model: gradingModel,
                    contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
                    config: {
                        ...this.gradingConfig,
                        systemInstruction: buildGradingSystemInstruction(strictness)
                    }
                }),
                GRADING_TIMEOUT_MS,
                "採点処理"
            );
        } catch (error) {
            // レート制限エラーの場合、フォールバックモデルで再試行
            if (RateLimitManager.isRateLimitError(error) && CONFIG.RATE_LIMIT_FALLBACK_MODEL && gradingModel !== CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
                rateLimitManager.markRateLimited();
                console.warn(`[Grader] 採点でレート制限エラー検出。${CONFIG.RATE_LIMIT_FALLBACK_MODEL} で再試行します。`);
                result = await withTimeout(
                    this.ai.models.generateContent({
                        model: CONFIG.RATE_LIMIT_FALLBACK_MODEL,
                        contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
                        config: {
                            ...this.gradingConfig,
                            systemInstruction: buildGradingSystemInstruction(strictness)
                        }
                    }),
                    GRADING_TIMEOUT_MS,
                    "採点処理（フォールバック）"
                );
            } else {
                throw error;
            }
        }

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

            // 品質検証: 必須フィールドが揃っているかチェック
            const qualityResult = this.validateGradingQuality(validated);
            if (!qualityResult.isValid) {
                console.error("[Grader] ❌ 採点結果の品質検証失敗（課金対象外）");
                return {
                    status: "error",
                    message: `採点結果が不完全です。以下の項目が正しく読み取れませんでした: ${qualityResult.missingFields.join(", ")}。画像の品質を確認し、再度お試しください。`,
                    incomplete_grading: true,  // 不完全な採点フラグ（課金対象外の判定に使用）
                    grading_result: validated.grading_result,
                    missing_fields: qualityResult.missingFields
                };
            }

            console.log("[Grader] 採点完了（確認済みテキスト使用）");
            return validated;
        }

        console.error("[Grader] ❌ JSONパース失敗");
        return {
            status: "error",
            message: "System Error: Failed to parse AI response.",
            incomplete_grading: true,  // 不完全な採点フラグ
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
        categorizedFiles?: CategorizedFiles,
        strictness: GradingStrictness = DEFAULT_STRICTNESS,
        modelAnswerText?: string
    ) {
        const sanitizedLabel = targetLabel.replace(/[<>\\\"'`]/g, '').trim();

        // ========================================
        // Stage 1: OCR（JSON強制なし）
        // 答案ファイルのみを使用して高精度読み取り
        // ========================================
        const ocrResult = await this.performOcr(sanitizedLabel, imageParts, categorizedFiles, pdfPageInfo);
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

        // 模範解答テキストセクション（ユーザーが手入力した場合）
        const modelAnswerSection = modelAnswerText ? `
【⚠️ 重要：ユーザーが手入力した模範解答】
以下の模範解答はユーザーが直接入力したものです。画像内の模範解答よりも**こちらを優先**して採点の基準としてください。
---
${modelAnswerText}
---
※ この模範解答と生徒の答案を比較して採点してください。
` : '';

        if (modelAnswerText) {
            console.log("[Grader] ユーザー入力の模範解答使用:", modelAnswerText.substring(0, 50) + (modelAnswerText.length > 50 ? '...' : ''));
        }

        const prompt = `Target Problem Label: ${sanitizedLabel}
${pdfPageHint}
${modelAnswerSection}
${ocrSection}

添付された画像（問題文${modelAnswerText ? '' : '、模範解答'}、生徒の答案）を参照し、「${sanitizedLabel}」の採点を行ってください。

System Instructionに定義された以下のルールを厳密に適用してください：
- Global Rules: 5大原則に基づく採点
- 採点基準: 減点基準リファレンステーブルに従う
- recognized_text は必ず出力すること（生徒が書いた回答テキスト）
- 可能な場合、マス目の列ごとの読み取りを ocr_debug として出力すること（例: chars_per_column, columns_used, column_readings[], verification）

結果はJSON形式で出力してください。`;

        // レート制限チェック: 制限中ならフォールバックモデルを使用
        let gradingModel = CONFIG.MODEL_NAME;
        if (rateLimitManager.isRateLimited() && CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
            gradingModel = CONFIG.RATE_LIMIT_FALLBACK_MODEL;
            console.info(`[Grader] レート制限中のため、Stage 2採点にフォールバックモデルを使用: ${gradingModel}`);
        }

        let result;
        try {
            result = await withTimeout(
                this.ai.models.generateContent({
                    model: gradingModel,
                    contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
                    config: {
                        ...this.gradingConfig,
                        systemInstruction: buildGradingSystemInstruction(strictness)
                    }
                }),
                GRADING_TIMEOUT_MS,
                "採点処理"
            );
        } catch (error) {
            // レート制限エラーの場合、フォールバックモデルで再試行
            if (RateLimitManager.isRateLimitError(error) && CONFIG.RATE_LIMIT_FALLBACK_MODEL && gradingModel !== CONFIG.RATE_LIMIT_FALLBACK_MODEL) {
                rateLimitManager.markRateLimited();
                console.warn(`[Grader] Stage 2採点でレート制限エラー検出。${CONFIG.RATE_LIMIT_FALLBACK_MODEL} で再試行します。`);
                result = await withTimeout(
                    this.ai.models.generateContent({
                        model: CONFIG.RATE_LIMIT_FALLBACK_MODEL,
                        contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
                        config: {
                            ...this.gradingConfig,
                            systemInstruction: buildGradingSystemInstruction(strictness)
                        }
                    }),
                    GRADING_TIMEOUT_MS,
                    "採点処理（フォールバック）"
                );
            } else {
                throw error;
            }
        }

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

            // 品質検証: 必須フィールドが揃っているかチェック
            const qualityResult = this.validateGradingQuality(validated);
            if (!qualityResult.isValid) {
                console.error("[Grader] ❌ 採点結果の品質検証失敗（課金対象外）");
                return {
                    status: "error",
                    message: `採点結果が不完全です。以下の項目が正しく読み取れませんでした: ${qualityResult.missingFields.join(", ")}。画像の品質を確認し、再度お試しください。`,
                    incomplete_grading: true,  // 不完全な採点フラグ（課金対象外の判定に使用）
                    grading_result: validated.grading_result,
                    missing_fields: qualityResult.missingFields
                };
            }

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
            incomplete_grading: true,  // 不完全な採点フラグ
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

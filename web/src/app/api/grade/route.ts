import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EduShiftGrader, type FileRole, type GradingStrictness } from '@/lib/core/grader';
import type { Database } from '@/lib/supabase/types';
import { checkRateLimit, GRADING_BURST_RATE_LIMIT, GRADING_RATE_LIMIT } from '@/lib/security/rateLimit';
import { enqueueGradingJob, QueueFullError, getQueueState } from '@/lib/security/gradingQueue';
import { logger } from '@/lib/security/logger';
import { createRegradeToken, verifyRegradeToken } from '@/lib/security/regradeToken';
import { isHeicMimeType, hasHeicExtension, convertHeicBufferToJpeg } from '@/lib/utils/serverHeicConverter';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

// Vercel Proプラン + Fluid Compute: 最大300秒のタイムアウト
export const maxDuration = 300;

// Note: Vercel Proプランではデフォルトで最大100MBのボディサイズに対応
// 本システムでは20MBまでのファイルをサポート（コード内で検証）

// 型定義
type UploadedFilePart = {
    buffer: Buffer;
    mimeType: string;
    name: string;
    pageNumber?: number;
    sourceFileName?: string;
    role?: FileRole;
};

type CanUseServiceResult = Database['public']['Functions']['can_use_service']['Returns'][number];

type SupabaseRpcClient = {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

/**
 * Supabaseクライアントを取得
 */
async function getSupabaseClient() {
    const cookieStore = await cookies();
    
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // Server Component からの呼び出し時は無視
                    }
                },
            },
        }
    );
}

/**
 * PDFファイルを処理（Geminiに直接送信）
 * 注意: pdf-to-imgはVercelサーバーレス環境で動作しないため、PDFは直接Geminiに送信
 */
function processPdfFile(pdfBuffer: Buffer, fileName: string): UploadedFilePart[] {
    return [{
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
        name: fileName,
        sourceFileName: fileName
    }];
}

/**
 * 許可されるMIMEタイプ
 */
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
];

/**
 * ファイルサイズ制限
 * Vercel Serverless Functions: 4.5MBペイロード上限（プランに関係なく）
 * FormDataオーバーヘッドを考慮して4.3MBに設定
 */
const MAX_SINGLE_FILE_SIZE = 4.3 * 1024 * 1024; // 4.3MB（単一ファイル）
const MAX_TOTAL_SIZE = 4.3 * 1024 * 1024; // 4.3MB（Vercelペイロード上限対応）
const MAX_FILES_COUNT = 10; // 最大ファイル数

// 無料再採点（もっと厳しく/甘く）用の設定
const REGRADE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日
const REGRADE_MAX_FREE_TIMES_PER_LABEL = 2; // 初回採点後に無料で再採点できる回数

type RegradeInfo = {
    token: string;
    remaining: number;
};

type GradingApiResultItem = {
    label: string;
    result?: unknown;
    error?: string;
    status?: string;
    strictness?: GradingStrictness;
    regradeToken?: string | null;
    regradeRemaining?: number | null;
    regradeMode?: 'new' | 'free' | 'none';
    incompleteGrading?: boolean;  // 不完全な採点（課金対象外）
    missingFields?: string[];     // 不足しているフィールド
};

function parseStrictness(value: unknown): GradingStrictness {
    if (value === 'lenient' || value === 'standard' || value === 'strict') return value;
    return 'standard';
}

function sanitizeDeviceFingerprint(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    // 端末指紋（SHA-256など）の想定。過度に長いものは拒否。
    if (trimmed.length < 8 || trimmed.length > 200) return '';
    // 制御文字などは除外
    if (/[\x00-\x1f]/.test(trimmed)) return '';
    return trimmed;
}

/**
 * ファイルのセキュリティ検証
 */
function validateFile(file: File): void {
    // MIMEタイプ検証
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(`許可されていないファイル形式です: ${file.type}。画像（JPEG、PNG、GIF、WebP、HEIC）またはPDFをアップロードしてください。`);
    }
    
    // ファイルサイズ検証
    if (file.size > MAX_SINGLE_FILE_SIZE) {
        const isPdf = file.type === 'application/pdf';
        const advice = isPdf 
            ? 'PDFは容量オーバーしやすいため、スマホ等で写真を撮ってアップロードすることをおすすめします。または、オンライン圧縮ツール（iLovePDF等）で圧縮してから再度お試しください。'
            : 'スマホで撮影した画像は自動圧縮されますが、圧縮に失敗した可能性があります。画像を小さくするか、別のファイル形式でお試しください。';
        throw new Error(`ファイル「${file.name}」が大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。${advice}`);
    }
    
    // ファイル名検証（パストラバーサル防止）
    const dangerousNamePatterns = [
        /\.\./,           // 親ディレクトリ参照
        /[\/\\]/,         // パス区切り文字
        /[\x00-\x1f]/,    // 制御文字
        /^\.+$/,          // ドットのみ
    ];
    
    for (const pattern of dangerousNamePatterns) {
        if (pattern.test(file.name)) {
            throw new Error('不正なファイル名です。');
        }
    }
    
    // ファイル名の長さ制限
    if (file.name.length > 255) {
        throw new Error('ファイル名が長すぎます。255文字以下にしてください。');
    }
}

/**
 * 複数ファイルの一括検証
 */
function validateFiles(files: File[]): void {
    // ファイル数の制限
    if (files.length > MAX_FILES_COUNT) {
        throw new Error(`アップロードできるファイルは最大${MAX_FILES_COUNT}個までです。`);
    }
    
    // 合計サイズの検証
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
        const hasPdf = files.some(f => f.type === 'application/pdf');
        const advice = hasPdf 
            ? 'PDFは容量オーバーしやすいため、スマホ等で写真を撮ってアップロードすることをおすすめします。または、オンライン圧縮ツール（iLovePDF等）で圧縮してから再度お試しください。'
            : '合計4.3MB以下になるように、ファイルを分割するか、写真の枚数を減らしてください。';
        throw new Error(`ファイルの合計サイズが大きすぎます（${(totalSize / 1024 / 1024).toFixed(1)}MB）。${advice}`);
    }
    
    // 各ファイルの検証
    for (const file of files) {
        validateFile(file);
    }
}

/**
 * 入力ラベルのサニタイズ（プロンプトインジェクション対策）
 */
function sanitizeLabel(label: string): string {
    const dangerousPatterns = [
        /ignore\s+previous\s+instructions/gi,
        /system\s*:\s*/gi,
        /you\s+are\s+now/gi,
        /forget\s+all/gi,
        /new\s+instructions/gi,
        /<script/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
    ];
    
    let sanitized = label;
    dangerousPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });
    sanitized = sanitized.trim();
    
    if (sanitized.length > 50) {
        throw new Error(`問題番号が長すぎます（50文字以下にしてください）: ${label}`);
    }
    
    if (sanitized.length === 0) {
        throw new Error('問題番号を入力してください');
    }
    
    const allowedPattern = /^[\u3000-\u9FFF\u4E00-\u9FAFa-zA-Z0-9\s\-_（）\(\)\[\]【】「」・、。]+$/;
    if (!allowedPattern.test(sanitized)) {
        throw new Error(`問題番号に使用できない文字が含まれています: ${label}`);
    }
    
    return sanitized;
}

/**
 * ファイルをバッファに変換
 */
async function convertFilesToBuffers(
    files: File[],
    pdfPageInfo: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null,
    fileRoles: Record<string, FileRole> = {}
): Promise<UploadedFilePart[]> {
    const fileBuffersNested = await Promise.all<UploadedFilePart[]>(
        files.map(async (file, index) => {
            let buffer = Buffer.from(await file.arrayBuffer());
            let mimeType = file.type;
            let fileName = file.name;
            const role = fileRoles[index.toString()] || 'other';

            // HEIC/HEIF形式の場合はJPEGに変換（Gemini API互換性のため）
            if (isHeicMimeType(mimeType) || hasHeicExtension(fileName)) {
                logger.info(`[Grade API] HEIC detected: ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB), starting server-side conversion`);
                const jpegBuffer = await convertHeicBufferToJpeg(buffer, 85, fileName);
                if (jpegBuffer) {
                    // Buffer.from()で再ラップして型の互換性を確保
                    buffer = Buffer.from(jpegBuffer);
                    mimeType = 'image/jpeg';
                    const newFileName = fileName.replace(/\.(heic|heif)$/i, '.jpeg');
                    logger.info(`[Grade API] HEIC conversion successful: ${fileName} → ${newFileName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
                    fileName = newFileName;
                } else {
                    // 変換失敗時はエラーを投げる（HEICのままではGeminiで処理できない可能性が高い）
                    logger.error(`[Grade API] HEIC conversion failed for: ${fileName}`);
                    throw new Error(`HEIC画像「${file.name}」の変換に失敗しました。iPhoneのカメラ設定で「互換性優先」を選択するか、写真アプリでJPEG形式に変換してから再度アップロードしてください。`);
                }
            }

            if (mimeType === 'application/pdf') {
                // PDFの場合は各ページに役割を引き継ぐ
                const pdfPages = await processPdfFile(buffer, fileName);
                return pdfPages.map(page => ({ ...page, role }));
            }

            return [{
                buffer,
                mimeType,
                name: fileName,
                sourceFileName: file.name,
                role  // 役割情報を追加
            }];
        })
    );

    return fileBuffersNested.flat();
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient();
        const supabaseRpc = supabase as unknown as SupabaseRpcClient;
        
        // ユーザー認証チェック
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json(
                { status: 'error', message: 'ログインが必要です。アカウントにログインしてください。' },
                { status: 401 }
            );
        }

        // レートリミットチェック（短時間バースト + 分単位）
        const burstLimitResult = checkRateLimit(`${user.id}:burst`, GRADING_BURST_RATE_LIMIT);
        if (!burstLimitResult.success) {
            return NextResponse.json(
                { 
                    status: 'error', 
                    message: `リクエストが多すぎます。${burstLimitResult.retryAfter}秒後に再試行してください。`,
                    retryAfter: burstLimitResult.retryAfter
                },
                { 
                    status: 429,
                    headers: {
                        'Retry-After': String(burstLimitResult.retryAfter),
                        'X-RateLimit-Limit': String(GRADING_BURST_RATE_LIMIT.maxRequests),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Math.ceil(burstLimitResult.resetTime / 1000)),
                    }
                }
            );
        }

        const rateLimitResult = checkRateLimit(`${user.id}:minute`, GRADING_RATE_LIMIT);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { 
                    status: 'error', 
                    message: `リクエストが多すぎます。${rateLimitResult.retryAfter}秒後に再試行してください。`,
                    retryAfter: rateLimitResult.retryAfter
                },
                { 
                    status: 429,
                    headers: {
                        'Retry-After': String(rateLimitResult.retryAfter),
                        'X-RateLimit-Limit': String(GRADING_RATE_LIMIT.maxRequests),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000)),
                    }
                }
            );
        }

        // フォームデータ解析
        const formData = await req.formData();
        const deviceFingerprintRaw = formData.get('deviceFingerprint');
        
        // デバイス制限チェック（デバイスフィンガープリントが提供されている場合）
        if (deviceFingerprintRaw && typeof deviceFingerprintRaw === 'string') {
            const { data: deviceCheckData, error: deviceCheckError } = await supabaseRpc
                .rpc('check_device_access', {
                    p_user_id: user.id,
                    p_device_fingerprint: deviceFingerprintRaw,
                });
            
            if (deviceCheckError) {
                logger.warn('Device access check error:', deviceCheckError);
                // エラーが発生しても続行（後方互換性のため）
            } else if (deviceCheckData && Array.isArray(deviceCheckData) && deviceCheckData.length > 0) {
                const deviceCheck = deviceCheckData[0] as {
                    has_access: boolean;
                    message: string;
                    device_count: number;
                    max_devices: number | null;
                };
                
                if (!deviceCheck.has_access) {
                    return NextResponse.json(
                        {
                            status: 'error',
                            message: deviceCheck.message || 'デバイス制限により利用できません。',
                            deviceLimitReached: true,
                            deviceCount: deviceCheck.device_count,
                            maxDevices: deviceCheck.max_devices || 2,
                        },
                        { status: 403 }
                    );
                }
            }
        }
        const targetLabelsJson = formData.get('targetLabels') as string;
        const files = formData.getAll('files') as File[];
        const pdfPageInfoJson = formData.get('pdfPageInfo') as string | null;
        const fileRolesJson = formData.get('fileRoles') as string | null;
        // ユーザー確認済みテキスト（OCR結果をユーザーが修正した場合）
        const confirmedTextsJson = formData.get('confirmedTexts') as string | null;
        const strictnessRaw = formData.get('strictness');
        const regradeTokensJson = formData.get('regradeTokens') as string | null;
        // 模範解答テキスト（手入力モードの場合）
        const modelAnswerText = formData.get('modelAnswerText') as string | null;

        if (!targetLabelsJson || !files || files.length === 0) {
            return NextResponse.json(
                { status: 'error', message: 'ファイルをアップロードしてください。本人の答案、問題がすべてクリアに写っていることを確認してください。' },
                { status: 400 }
            );
        }
        
        // 確認済みテキストを解析
        let confirmedTexts: Record<string, string> = {};
        if (confirmedTextsJson) {
            try {
                confirmedTexts = JSON.parse(confirmedTextsJson);
                logger.debug('[API] Confirmed texts provided:', Object.keys(confirmedTexts));
            } catch {
                // パース失敗時は無視
            }
        }

        // 問題条件オーバーライドを解析（AIが誤読した字数制限などを手動で指定）
        const problemConditionsJson = formData.get('problemConditions') as string | null;
        let problemConditions: Record<string, string> = {};
        if (problemConditionsJson) {
            try {
                problemConditions = JSON.parse(problemConditionsJson);
                logger.debug('[API] Problem conditions override provided:', problemConditions);
            } catch {
                // パース失敗時は無視
            }
        }

        // Layout情報を解析（OCRで検出した物理レイアウト情報）
        const layoutsJson = formData.get('layouts') as string | null;
        let layouts: Record<string, { total_lines: number; paragraph_count: number; indented_columns: number[] }> = {};
        if (layoutsJson) {
            try {
                layouts = JSON.parse(layoutsJson);
                logger.debug('[API] Layout info provided:', Object.keys(layouts));
            } catch {
                // パース失敗時は無視
            }
        }

        // ファイルのセキュリティ検証
        try {
            validateFiles(files);
        } catch (validationError) {
            const message = validationError instanceof Error ? validationError.message : '不正なファイルです。';
            return NextResponse.json(
                { status: 'error', message },
                { status: 400 }
            );
        }

        const targetLabels = JSON.parse(targetLabelsJson) as string[];
        
        // PDFページ番号情報を解析
        let pdfPageInfo: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null = null;
        if (pdfPageInfoJson) {
            try {
                pdfPageInfo = JSON.parse(pdfPageInfoJson);
            } catch {
                // パース失敗時は無視
            }
        }
        
        // ファイル役割情報を解析
        let fileRoles: Record<string, FileRole> = {};
        if (fileRolesJson) {
            try {
                fileRoles = JSON.parse(fileRolesJson);
                logger.debug('[API] File roles:', fileRoles);
            } catch {
                // パース失敗時は無視
            }
        }
        
        if (!Array.isArray(targetLabels) || targetLabels.length === 0) {
            return NextResponse.json(
                { status: 'error', message: 'Invalid target labels' },
                { status: 400 }
            );
        }

        // ラベルのサニタイズ
        const sanitizedLabels = targetLabels.map(sanitizeLabel);

        // 採点の厳しさ（3段階）
        const strictness = parseStrictness(strictnessRaw);

        // 端末指紋（無料再採点トークンの紐付けに使用）
        const deviceFingerprint = sanitizeDeviceFingerprint(deviceFingerprintRaw) || (req.headers.get('user-agent') || 'unknown');

        // 再採点トークン（label -> token）
        let regradeTokens: Record<string, string> = {};
        if (regradeTokensJson) {
            try {
                const parsed = JSON.parse(regradeTokensJson) as Record<string, unknown>;
                if (parsed && typeof parsed === 'object') {
                    const next: Record<string, string> = {};
                    for (const [k, v] of Object.entries(parsed)) {
                        if (typeof v === 'string' && v.length < 5000) next[k] = v;
                    }
                    regradeTokens = next;
                }
            } catch {
                // パース失敗時は無視
            }
        }

        // 無料再採点として扱えるラベルを判定
        const regradeSecret = process.env.REGRADE_TOKEN_SECRET || '';
        const freeRegradeByLabel = new Map<string, RegradeInfo>();
        if (regradeSecret) {
            for (const label of sanitizedLabels) {
                const token = regradeTokens[label];
                if (!token) continue;
                const verified = verifyRegradeToken({ secret: regradeSecret, token });
                if (!verified.ok) continue;
                const payload = verified.payload;
                if (payload.sub !== user.id) continue;
                if (payload.label !== label) continue;
                if (payload.fp !== deviceFingerprint) continue;
                if (payload.remaining <= 0) continue;
                freeRegradeByLabel.set(label, { token, remaining: payload.remaining });
            }
        } else if (regradeTokensJson) {
            // トークンが送られてきたのにサーバ側で検証用secretがない場合はログだけ残す
            logger.warn('[API] REGRADE_TOKEN_SECRET is not set. Regrade tokens will be ignored.');
        }

        const requiresPaidUsage = sanitizedLabels.some((label) => !freeRegradeByLabel.has(label));

        // 利用可否チェック（無料再採点のみの場合はスキップ）
        if (requiresPaidUsage) {
            const { data: usageData, error: usageError } = await supabaseRpc
                .rpc('can_use_service', { p_user_id: user.id });
            const usageRows = usageData as CanUseServiceResult[] | null;
            
            if (usageError) {
                logger.error('Usage check error:', usageError);
                return NextResponse.json(
                    { status: 'error', message: '利用状況の確認中にエラーが発生しました。' },
                    { status: 500 }
                );
            }

            if (!usageRows || usageRows.length === 0 || !usageRows[0].can_use) {
                return NextResponse.json(
                    { 
                        status: 'error', 
                        message: usageRows?.[0]?.message || '利用可能なプランがありません。プランを購入してください。',
                        requirePlan: true
                    },
                    { status: 403 }
                );
            }
        }

        // ファイルをバッファに変換（役割情報を付与）
        const fileBuffers = await convertFilesToBuffers(files, pdfPageInfo, fileRoles);

        try {
            const queuedJob = enqueueGradingJob(async () => {
                // 2024-12-21: ファイルサイズと問題数のログ（並列処理により5問程度まで対応可能）
                const totalFileSize = fileBuffers.reduce((sum, f) => sum + f.buffer.length, 0);
                const totalFileSizeMB = totalFileSize / (1024 * 1024);
                const questionCount = sanitizedLabels.length;

        // 並列処理のため、問題数が多くても対応可能（ただしログは残す）
        if (totalFileSizeMB > 1.5 && questionCount > 1) {
            logger.info(`[API] 大きなファイル（${totalFileSizeMB.toFixed(2)}MB）で${questionCount}問を並列採点`);
        }

        // 極端なケース（6問以上 or 4MB以上）のみ警告
        if (questionCount > 5 || totalFileSizeMB > 4) {
            logger.warn(`[API] ⚠️ 大規模リクエスト: ${totalFileSizeMB.toFixed(2)}MB / ${questionCount}問`);
        }

        // 画像数の警告（6枚以上でOCR精度が低下する傾向がある）
        const RECOMMENDED_MAX_IMAGES = 5;
        const imageFileCount = fileBuffers.filter(f => f.mimeType.startsWith('image/')).length;
        let imageCountWarning: string | null = null;
        if (imageFileCount > RECOMMENDED_MAX_IMAGES) {
            imageCountWarning = `画像が${imageFileCount}枚あります。画像数が多い（${RECOMMENDED_MAX_IMAGES}枚以上）とOCR精度が低下する場合があります。採点結果が不完全な場合は、画像を分割して再度お試しください。`;
            logger.warn(`[API] ⚠️ 画像数警告: ${imageFileCount}枚（推奨: ${RECOMMENDED_MAX_IMAGES}枚以下）`);
        }

        // 採点実行（2024-12-21: 並列処理に変更 - 3〜5問を同時処理可能に）
        const grader = new EduShiftGrader();

        // 各問題の採点を並列実行
        logger.info(`[API] ${sanitizedLabels.length}問を並列処理開始`);
        const gradingPromises = sanitizedLabels.map(async (label): Promise<GradingApiResultItem> => {
            try {
                let result;

                // 確認済みテキストがある場合はそれを使用（OCRスキップ）
                if (confirmedTexts[label]) {
                    logger.info(`[API] Using confirmed text for ${label}: ${confirmedTexts[label].length} chars`);
                    // 問題条件オーバーライドがある場合は渡す
                    const problemCondition = problemConditions[label] || undefined;
                    if (problemCondition) {
                        logger.info(`[API] Problem condition override for ${label}: ${problemCondition}`);
                    }
                    // Layout情報がある場合は渡す（字下げ・行数・段落構成の判定に使用）
                    const layout = layouts[label] || undefined;
                    if (layout) {
                        logger.info(`[API] Layout info for ${label}: ${layout.total_lines} lines, ${layout.paragraph_count} paragraphs, indented: [${layout.indented_columns.join(', ')}]`);
                    }
                    // 模範解答テキストがある場合はログ出力
                    if (modelAnswerText) {
                        logger.info(`[API] Using manual model answer text for ${label}: ${modelAnswerText.length} chars`);
                    }
                    result = await grader.gradeWithConfirmedText(label, confirmedTexts[label], fileBuffers, pdfPageInfo, fileRoles, strictness, problemCondition, layout, modelAnswerText || undefined);
                } else {
                    // 従来通りOCR + 採点
                    if (modelAnswerText) {
                        logger.info(`[API] Using manual model answer text for ${label}: ${modelAnswerText.length} chars`);
                    }
                    result = await grader.gradeAnswerFromMultipleFiles(label, fileBuffers, pdfPageInfo, fileRoles, strictness, modelAnswerText || undefined);
                }

                // 不完全な採点結果のチェック（課金対象外）
                const resultObj = result as { incomplete_grading?: boolean; missing_fields?: string[] } | undefined;
                if (resultObj?.incomplete_grading) {
                    logger.warn(`[API] Incomplete grading for ${label}: missing ${resultObj.missing_fields?.join(', ')}`);
                    return {
                        label,
                        result,
                        strictness,
                        incompleteGrading: true,
                        missingFields: resultObj.missing_fields,
                        error: resultObj.missing_fields ? `採点結果が不完全: ${resultObj.missing_fields.join(', ')}` : '採点結果が不完全です'
                    };
                } else {
                    return { label, result, strictness };
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Error grading ${label}:`, error);
                return { label, error: message, status: 'error', strictness };
            }
        });

        // 全ての採点を並列で待機（Promise.allSettledで個別のエラーも処理）
        const settledResults = await Promise.allSettled(gradingPromises);
        const results: GradingApiResultItem[] = settledResults.map((settled, index) => {
            if (settled.status === 'fulfilled') {
                return settled.value;
            } else {
                // Promise自体が reject された場合（通常は発生しないが安全のため）
                const label = sanitizedLabels[index];
                const message = settled.reason instanceof Error ? settled.reason.message : 'Unknown error';
                logger.error(`Promise rejected for ${label}:`, settled.reason);
                return { label, error: message, status: 'error', strictness };
            }
        });

        logger.info(`[API] 並列処理完了: ${results.filter(r => r.result && !r.error).length}/${results.length}問成功`);

        // 採点成功時に利用回数をインクリメント（不完全な採点は除外）
        const successfulGradings = results.filter(r => r.result && !r.error && !r.incompleteGrading);
        
        // #region agent log
        const logBeforeIncrement = {location:'route.ts:572',message:'Before increment_usage',data:{successfulGradingsCount:successfulGradings.length,freeRegradeLabels:Array.from(freeRegradeByLabel.keys()),userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
        logger.info('[DEBUG] Before increment_usage:', logBeforeIncrement);
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logBeforeIncrement)}).catch((err) => logger.warn('[DEBUG] Failed to send log:', err));
        // #endregion
        
        for (const grading of successfulGradings) {
            // 無料再採点の場合は消費しない
            if (freeRegradeByLabel.has(grading.label)) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:577',message:'Skipping increment (free regrade)',data:{label:grading.label},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                continue;
            }
            // #region agent log
            const logCallingIncrement = {location:'route.ts:580',message:'Calling increment_usage',data:{label:grading.label,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
            logger.info('[DEBUG] Calling increment_usage:', logCallingIncrement);
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logCallingIncrement)}).catch((err) => logger.warn('[DEBUG] Failed to send log:', err));
            // #endregion
            const { error: incrementError } = await supabaseRpc
                .rpc('increment_usage', { 
                    p_user_id: user.id,
                    p_metadata: { 
                        label: grading.label,
                        strictness,
                        timestamp: new Date().toISOString()
                    }
                });
            
            // #region agent log
            const logIncrementResult = {location:'route.ts:590',message:'increment_usage result',data:{label:grading.label,hasError:!!incrementError,errorMessage:incrementError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
            logger.info('[DEBUG] increment_usage result:', logIncrementResult);
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logIncrementResult)}).catch((err) => logger.warn('[DEBUG] Failed to send log:', err));
            // #endregion
            
            if (incrementError) {
                logger.error('Failed to increment usage:', incrementError);
            }
        }

        // 更新後の利用情報を取得
        // #region agent log
        const logBeforeCanUse = {location:'route.ts:598',message:'Before can_use_service call',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        logger.info('[DEBUG] Before can_use_service call:', logBeforeCanUse);
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logBeforeCanUse)}).catch((err) => logger.warn('[DEBUG] Failed to send log:', err));
        // #endregion
        let updatedUsageRows: CanUseServiceResult[] | null = null;
        try {
            const { data: updatedUsageData } = await supabaseRpc
                .rpc('can_use_service', { p_user_id: user.id });
            updatedUsageRows = updatedUsageData as CanUseServiceResult[] | null;
            // #region agent log
            const logCanUseResult = {location:'route.ts:600',message:'can_use_service result',data:{hasData:!!updatedUsageRows,usageCount:updatedUsageRows?.[0]?.usage_count??null,remainingCount:updatedUsageRows?.[0]?.remaining_count??null,usageLimit:updatedUsageRows?.[0]?.usage_limit??null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
            logger.info('[DEBUG] can_use_service result:', logCanUseResult);
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logCanUseResult)}).catch((err) => logger.warn('[DEBUG] Failed to send log:', err));
            // #endregion
        } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:602',message:'can_use_service error',data:{errorMessage:error instanceof Error?error.message:'Unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            // 無視（無料再採点のみでプランが無い等の場合に備える）
        }
        
        const usageInfo = updatedUsageRows?.[0] ? {
            remainingCount: updatedUsageRows[0].remaining_count,
            usageCount: updatedUsageRows[0].usage_count,
            usageLimit: updatedUsageRows[0].usage_limit,
            planName: updatedUsageRows[0].plan_name,
        } : null;
        
        // #region agent log
        const logFinalUsageInfo = {location:'route.ts:610',message:'Final usageInfo to return',data:{usageInfo:usageInfo?{remainingCount:usageInfo.remainingCount,usageCount:usageInfo.usageCount,usageLimit:usageInfo.usageLimit}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
        logger.info('[DEBUG] Final usageInfo to return:', logFinalUsageInfo);
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logFinalUsageInfo)}).catch((err) => logger.warn('[DEBUG] Failed to send log:', err));
        // #endregion

        // 再採点トークンを発行／更新（成功したラベルのみ）
        if (regradeSecret) {
            for (const item of results) {
                if (!item.result || item.error) continue;

                // 無料再採点（トークン消費）
                const existing = freeRegradeByLabel.get(item.label);
                if (existing) {
                    const verified = verifyRegradeToken({ secret: regradeSecret, token: existing.token });
                    if (verified.ok) {
                        const remaining = Math.max(0, verified.payload.remaining - 1);
                        const nextToken = createRegradeToken({
                            secret: regradeSecret,
                            userId: user.id,
                            label: item.label,
                            fingerprint: deviceFingerprint,
                            remaining,
                            ttlSeconds: REGRADE_TOKEN_TTL_SECONDS,
                        });
                        item.regradeToken = nextToken;
                        item.regradeRemaining = remaining;
                        item.regradeMode = 'free';
                        continue;
                    }
                }

                // 初回（または有料）採点後に新規トークンを発行
                const nextToken = createRegradeToken({
                    secret: regradeSecret,
                    userId: user.id,
                    label: item.label,
                    fingerprint: deviceFingerprint,
                    remaining: REGRADE_MAX_FREE_TIMES_PER_LABEL,
                    ttlSeconds: REGRADE_TOKEN_TTL_SECONDS,
                });
                item.regradeToken = nextToken;
                item.regradeRemaining = REGRADE_MAX_FREE_TIMES_PER_LABEL;
                item.regradeMode = 'new';
            }
        } else {
            // secretが無い場合はトークンを返さない（再採点無料の保証ができないため）
            for (const item of results) {
                item.regradeToken = null;
                item.regradeRemaining = null;
                item.regradeMode = 'none';
            }
        }

                return {
                    status: 'success',
                    results,
                    usageInfo,
                    warnings: imageCountWarning ? [imageCountWarning] : undefined
                };
            });

            const payload = await queuedJob.promise;
            const queueState = getQueueState();
            return NextResponse.json(payload, {
                headers: {
                    'X-Queue-Position': String(queuedJob.position),
                    'X-Queue-Size': String(queueState.queuedCount),
                }
            });
        } catch (error) {
            if (error instanceof QueueFullError) {
                const queueState = getQueueState();
                return NextResponse.json(
                    {
                        status: 'error',
                        message: 'ただいま混雑しています。しばらく待ってから再度お試しください。',
                        queue: {
                            queued: queueState.queuedCount,
                            maxQueue: queueState.maxQueueLength,
                        }
                    },
                    { status: 429 }
                );
            }
            throw error;
        }

    } catch (error: unknown) {
        logger.error('API Error:', error);
        // 本番環境ではエラー詳細を隠す
        const isDev = process.env.NODE_ENV === 'development';
        const message = isDev 
            ? (error instanceof Error ? error.message : 'Unknown error')
            : 'システムエラーが発生しました。しばらく時間をおいてから再度お試しください。';
        return NextResponse.json(
            { status: 'error', message },
            { status: 500 }
        );
    }
}

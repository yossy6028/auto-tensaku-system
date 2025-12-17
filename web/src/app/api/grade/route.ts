import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EduShiftGrader, type FileRole, type GradingStrictness } from '@/lib/core/grader';
import type { Database } from '@/lib/supabase/types';
import { checkRateLimit, GRADING_RATE_LIMIT } from '@/lib/security/rateLimit';
import { logger } from '@/lib/security/logger';
import { createRegradeToken, verifyRegradeToken } from '@/lib/security/regradeToken';

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
            ? 'PDFはオンライン圧縮ツール（iLovePDF等）で圧縮するか、画像として撮影し直してください。'
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
        throw new Error(`ファイルの合計サイズが大きすぎます（${(totalSize / 1024 / 1024).toFixed(1)}MB）。合計4.3MB以下になるようにしてください。PDFの場合はオンライン圧縮ツール（iLovePDF等）で圧縮してから再度お試しください。`);
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
            const buffer = Buffer.from(await file.arrayBuffer());
            const role = fileRoles[index.toString()] || 'other';
            
            if (file.type === 'application/pdf') {
                // PDFの場合は各ページに役割を引き継ぐ
                const pdfPages = await processPdfFile(buffer, file.name);
                return pdfPages.map(page => ({ ...page, role }));
            }
            
            return [{
                buffer,
                mimeType: file.type,
                name: file.name,
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

        // レートリミットチェック
        const rateLimitResult = checkRateLimit(user.id, GRADING_RATE_LIMIT);
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

        // 採点実行
        const grader = new EduShiftGrader();
        const results: GradingApiResultItem[] = [];

        for (const label of sanitizedLabels) {
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
                    result = await grader.gradeWithConfirmedText(label, confirmedTexts[label], fileBuffers, pdfPageInfo, fileRoles, strictness, problemCondition);
                } else {
                    // 従来通りOCR + 採点
                    result = await grader.gradeAnswerFromMultipleFiles(label, fileBuffers, pdfPageInfo, fileRoles, strictness);
                }
                
                results.push({ label, result, strictness });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Error grading ${label}:`, error);
                results.push({ label, error: message, status: 'error', strictness });
            }
        }

        // 採点成功時に利用回数をインクリメント
        const successfulGradings = results.filter(r => r.result && !r.error);
        
        for (const grading of successfulGradings) {
            // 無料再採点の場合は消費しない
            if (freeRegradeByLabel.has(grading.label)) {
                continue;
            }
            const { error: incrementError } = await supabaseRpc
                .rpc('increment_usage', { 
                    p_user_id: user.id,
                    p_metadata: { 
                        label: grading.label,
                        strictness,
                        timestamp: new Date().toISOString()
                    }
                });
            
            if (incrementError) {
                logger.error('Failed to increment usage:', incrementError);
            }
        }

        // 更新後の利用情報を取得
        let updatedUsageRows: CanUseServiceResult[] | null = null;
        try {
            const { data: updatedUsageData } = await supabaseRpc
                .rpc('can_use_service', { p_user_id: user.id });
            updatedUsageRows = updatedUsageData as CanUseServiceResult[] | null;
        } catch {
            // 無視（無料再採点のみでプランが無い等の場合に備える）
        }
        
        const usageInfo = updatedUsageRows?.[0] ? {
            remainingCount: updatedUsageRows[0].remaining_count,
            usageCount: updatedUsageRows[0].usage_count,
            usageLimit: updatedUsageRows[0].usage_limit,
            planName: updatedUsageRows[0].plan_name,
        } : null;

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

        return NextResponse.json({ 
            status: 'success', 
            results,
            usageInfo
        });

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

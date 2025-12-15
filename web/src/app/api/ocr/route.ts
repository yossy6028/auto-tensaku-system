import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EduShiftGrader, type FileRole } from '@/lib/core/grader';
import type { Database } from '@/lib/supabase/types';
import { checkRateLimit, GRADING_RATE_LIMIT } from '@/lib/security/rateLimit';
import { logger } from '@/lib/security/logger';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

// OCR処理時間の延長（Vercel Pro + Fluid Compute対応）
// 大きなPDFやページ数が多い場合、Gemini APIの応答に時間がかかるため
export const maxDuration = 300;

// 型定義
type UploadedFilePart = {
    buffer: Buffer;
    mimeType: string;
    name: string;
    pageNumber?: number;
    sourceFileName?: string;
    role?: FileRole;
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
 * PDFファイルを処理
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

const MAX_SINGLE_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TOTAL_SIZE = 4 * 1024 * 1024;
const MAX_FILES_COUNT = 10;

/**
 * ファイルのセキュリティ検証
 */
function validateFile(file: File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(`許可されていないファイル形式です: ${file.type}`);
    }
    
    if (file.size > MAX_SINGLE_FILE_SIZE) {
        throw new Error(`ファイル「${file.name}」が大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。4MB以下のファイルをアップロードしてください。`);
    }
    
    const dangerousNamePatterns = [/\.\./, /[\/\\]/, /[\x00-\x1f]/, /^\.+$/];
    for (const pattern of dangerousNamePatterns) {
        if (pattern.test(file.name)) {
            throw new Error('不正なファイル名です。');
        }
    }
    
    if (file.name.length > 255) {
        throw new Error('ファイル名が長すぎます。');
    }
}

function validateFiles(files: File[]): void {
    if (files.length > MAX_FILES_COUNT) {
        throw new Error(`アップロードできるファイルは最大${MAX_FILES_COUNT}個までです。`);
    }
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
        throw new Error(`ファイルの合計サイズが大きすぎます。`);
    }
    
    for (const file of files) {
        validateFile(file);
    }
}

function sanitizeLabel(label: string): string {
    const dangerousPatterns = [
        /ignore\s+previous\s+instructions/gi,
        /system\s*:\s*/gi,
        /you\s+are\s+now/gi,
    ];
    
    let sanitized = label;
    dangerousPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });
    sanitized = sanitized.trim();
    
    if (sanitized.length > 50) {
        throw new Error(`問題番号が長すぎます`);
    }
    
    if (sanitized.length === 0) {
        throw new Error('問題番号を入力してください');
    }
    
    return sanitized;
}

async function convertFilesToBuffers(
    files: File[],
    fileRoles: Record<string, FileRole> = {}
): Promise<UploadedFilePart[]> {
    const fileBuffersNested = await Promise.all<UploadedFilePart[]>(
        files.map(async (file, index) => {
            const buffer = Buffer.from(await file.arrayBuffer());
            const role = fileRoles[index.toString()] || 'other';
            
            if (file.type === 'application/pdf') {
                const pdfPages = processPdfFile(buffer, file.name);
                return pdfPages.map(page => ({ ...page, role }));
            }
            
            return [{
                buffer,
                mimeType: file.type,
                name: file.name,
                sourceFileName: file.name,
                role
            }];
        })
    );
    
    return fileBuffersNested.flat();
}

/**
 * OCRのみ実行するエンドポイント
 * ユーザーが読み取り結果を確認・修正できるよう、OCRだけを先に実行
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient();
        
        // ユーザー認証チェック
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json(
                { status: 'error', message: 'ログインが必要です。' },
                { status: 401 }
            );
        }

        // レートリミットチェック（OCRもカウント）
        const rateLimitResult = checkRateLimit(user.id, GRADING_RATE_LIMIT);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { status: 'error', message: `リクエストが多すぎます。${rateLimitResult.retryAfter}秒後に再試行してください。` },
                { status: 429 }
            );
        }

        // フォームデータ解析
        let formData: FormData;
        let targetLabel: string;
        let files: File[];
        let pdfPageInfoJson: string | null;
        let fileRolesJson: string | null;
        
        try {
            formData = await req.formData();
            targetLabel = formData.get('targetLabel') as string;
            files = formData.getAll('files') as File[];
            pdfPageInfoJson = formData.get('pdfPageInfo') as string | null;
            fileRolesJson = formData.get('fileRoles') as string | null;
        } catch (formDataError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:204',message:'OCR API formData parse error',data:{error:formDataError instanceof Error?formDataError.message:String(formDataError),contentLength:req.headers.get('content-length')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            return NextResponse.json(
                { status: 'error', message: 'リクエストサイズが大きすぎます。ファイルを圧縮するか、分割してください。' },
                { status: 413 }
            );
        }
        
        if (!targetLabel || !files || files.length === 0) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:225',message:'OCR API validation failed',data:{hasTargetLabel:!!targetLabel,filesCount:files?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            return NextResponse.json(
                { status: 'error', message: 'ファイルと問題番号を指定してください。' },
                { status: 400 }
            );
        }

        // リクエストサイズチェック（413エラー対策）
        // フロントエンドで既にチェックしているが、念のためサーバー側でもチェック
        const totalFileSize = files.reduce((sum, f) => sum + f.size, 0);
        const MAX_REQUEST_SIZE = 3.5 * 1024 * 1024; // 3.5MB（Vercelの制限4.5MBに安全マージン）
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:218',message:'OCR API formData received',data:{targetLabel,filesCount:files.length,totalFileSizeMB:(totalFileSize/1024/1024).toFixed(2),maxAllowedMB:4.5,contentLength:req.headers.get('content-length')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        if (totalFileSize > MAX_REQUEST_SIZE) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:244',message:'OCR API file size exceeded',data:{totalFileSizeMB:(totalFileSize/1024/1024).toFixed(2),maxAllowedMB:(MAX_REQUEST_SIZE/1024/1024).toFixed(2),filesCount:files.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            const totalMB = (totalFileSize / 1024 / 1024).toFixed(1);
            const maxMB = (MAX_REQUEST_SIZE / 1024 / 1024).toFixed(1);
            return NextResponse.json(
                { status: 'error', message: `ファイルの合計サイズが大きすぎます（${totalMB}MB）。合計${maxMB}MB以下になるように、ファイルを圧縮するか分割してください。` },
                { status: 413 }
            );
        }

        // ファイル検証
        try {
            validateFiles(files);
        } catch (validationError) {
            const message = validationError instanceof Error ? validationError.message : '不正なファイルです。';
            return NextResponse.json(
                { status: 'error', message },
                { status: 400 }
            );
        }

        const sanitizedLabel = sanitizeLabel(targetLabel);
        
        let pdfPageInfo: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null = null;
        if (pdfPageInfoJson) {
            try {
                pdfPageInfo = JSON.parse(pdfPageInfoJson);
            } catch {
                // パース失敗時は無視
            }
        }
        
        let fileRoles: Record<string, FileRole> = {};
        if (fileRolesJson) {
            try {
                fileRoles = JSON.parse(fileRolesJson);
            } catch {
                // パース失敗時は無視
            }
        }

        // デバッグ: ファイルとロールの対応を出力
        logger.info(`[OCR API] targetLabel: ${sanitizedLabel}`);
        logger.info(`[OCR API] fileRoles受信: ${JSON.stringify(fileRoles)}`);
        files.forEach((file, idx) => {
            const role = fileRoles[idx.toString()] || 'other';
            logger.info(`[OCR API] File[${idx}]: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → role: ${role}`);
        });

        // ファイルをバッファに変換
        const fileBuffers = await convertFilesToBuffers(files, fileRoles);

        // OCRのみ実行
        const grader = new EduShiftGrader();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:258',message:'Starting OCR processing',data:{label:sanitizedLabel,fileBuffersCount:fileBuffers.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        let ocrResult;
        try {
            ocrResult = await grader.performOcrOnly(sanitizedLabel, fileBuffers, pdfPageInfo, fileRoles);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:263',message:'OCR processing completed',data:{charCount:ocrResult.charCount,hasText:!!ocrResult.text,textLength:ocrResult.text?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
        } catch (ocrError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:267',message:'OCR processing error',data:{error:ocrError instanceof Error?ocrError.message:String(ocrError),errorStack:ocrError instanceof Error?ocrError.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            throw ocrError;
        }

        logger.info(`[OCR API] OCR完了: ${sanitizedLabel} - ${ocrResult.charCount}文字`);

        const responseData = { 
            status: 'success', 
            ocrResult: {
                text: ocrResult.text,
                charCount: ocrResult.charCount,
                label: sanitizedLabel
            }
        };
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:280',message:'Sending OCR response',data:{status:responseData.status,hasOcrResult:!!responseData.ocrResult,ocrResultKeys:responseData.ocrResult?Object.keys(responseData.ocrResult):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        return NextResponse.json(responseData);

    } catch (error: unknown) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e78e9fd7-3fa2-45c5-b036-a4f10b20798a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ocr/route.ts:275',message:'OCR API catch block error',data:{error:error instanceof Error?error.message:String(error),errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        logger.error('OCR API Error:', error);
        const message = error instanceof Error ? error.message : 'OCRエラーが発生しました。';
        return NextResponse.json(
            { status: 'error', message },
            { status: 500 }
        );
    }
}


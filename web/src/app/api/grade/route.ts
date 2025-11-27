import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EduShiftGrader, type FileRole } from '@/lib/core/grader';
import type { Database } from '@/lib/supabase/types';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

// Vercel Proプラン + Fluid Compute: 最大300秒のタイムアウト
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

        // 利用可否チェック
        const { data: usageData, error: usageError } = await supabaseRpc
            .rpc('can_use_service', { p_user_id: user.id });
        const usageRows = usageData as CanUseServiceResult[] | null;
        
        if (usageError) {
            console.error('Usage check error:', usageError);
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

        // フォームデータ解析
        const formData = await req.formData();
        const targetLabelsJson = formData.get('targetLabels') as string;
        const files = formData.getAll('files') as File[];
        const pdfPageInfoJson = formData.get('pdfPageInfo') as string | null;
        const fileRolesJson = formData.get('fileRoles') as string | null;

        if (!targetLabelsJson || !files || files.length === 0) {
            return NextResponse.json(
                { status: 'error', message: 'ファイルをアップロードしてください。本人の答案、問題がすべてクリアに写っていることを確認してください。' },
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
                console.log('[API] File roles:', fileRoles);
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

        // ファイルをバッファに変換（役割情報を付与）
        const fileBuffers = await convertFilesToBuffers(files, pdfPageInfo, fileRoles);

        // 採点実行
        const grader = new EduShiftGrader();
        const results: Array<{ label: string; result?: unknown; error?: string; status?: string }> = [];

        for (const label of sanitizedLabels) {
            try {
                const result = await grader.gradeAnswerFromMultipleFiles(label, fileBuffers, pdfPageInfo, fileRoles);
                results.push({ label, result });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Error grading ${label}:`, error);
                results.push({ label, error: message, status: 'error' });
            }
        }

        // 採点成功時に利用回数をインクリメント
        const successfulGradings = results.filter(r => r.result && !r.error);
        
        for (const grading of successfulGradings) {
            const { error: incrementError } = await supabaseRpc
                .rpc('increment_usage', { 
                    p_user_id: user.id,
                    p_metadata: { 
                        label: grading.label,
                        timestamp: new Date().toISOString()
                    }
                });
            
            if (incrementError) {
                console.error('Failed to increment usage:', incrementError);
            }
        }

        // 更新後の利用情報を取得
        const { data: updatedUsageData } = await supabaseRpc
            .rpc('can_use_service', { p_user_id: user.id });
        const updatedUsageRows = updatedUsageData as CanUseServiceResult[] | null;
        
        const usageInfo = updatedUsageRows?.[0] ? {
            remainingCount: updatedUsageRows[0].remaining_count,
            usageCount: updatedUsageRows[0].usage_count,
            usageLimit: updatedUsageRows[0].usage_limit,
            planName: updatedUsageRows[0].plan_name,
        } : null;

        return NextResponse.json({ 
            status: 'success', 
            results,
            usageInfo
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('API Error:', error);
        return NextResponse.json(
            { status: 'error', message },
            { status: 500 }
        );
    }
}

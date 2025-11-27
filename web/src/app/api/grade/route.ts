import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EduShiftGrader } from '@/lib/core/grader';
import type { Database } from '@/lib/supabase/types';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

type UploadedFilePart = {
    buffer: Buffer;
    mimeType: string;
    name: string;
    pageNumber?: number;
    sourceFileName?: string;
};

type CanUseServiceResult = Database['public']['Functions']['can_use_service']['Returns'][number];

// PDFを画像に変換する関数
async function convertPdfToImages(
    pdfBuffer: Buffer,
    fileName: string,
    pageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null
): Promise<UploadedFilePart[]> {
    try {
        // Dynamic import for pdf-to-img (ESM module)
        const { pdf } = await import('pdf-to-img');
        
        const images: UploadedFilePart[] = [];
        
        // ページ番号指定がある場合、対象ページを解析
        const targetPages = new Set<number>();
        if (pageInfo) {
            const parsePageRange = (pageStr: string | undefined): number[] => {
                if (!pageStr) return [];
                const pages: number[] = [];
                const parts = pageStr.split(/[,、]/);
                for (const part of parts) {
                    const trimmed = part.trim();
                    if (trimmed.includes('-')) {
                        const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
                        if (!isNaN(start) && !isNaN(end)) {
                            for (let i = start; i <= end; i++) {
                                pages.push(i);
                            }
                        }
                    } else {
                        const num = parseInt(trimmed);
                        if (!isNaN(num)) {
                            pages.push(num);
                        }
                    }
                }
                return pages;
            };
            
            parsePageRange(pageInfo.answerPage).forEach(p => targetPages.add(p));
            parsePageRange(pageInfo.problemPage).forEach(p => targetPages.add(p));
            parsePageRange(pageInfo.modelAnswerPage).forEach(p => targetPages.add(p));
        }
        
        console.log('[PDF Converter] Converting PDF to images...');
        console.log('[PDF Converter] Target pages:', targetPages.size > 0 ? Array.from(targetPages) : 'all');
        
        let pageNum = 0;
        // pdf-to-imgはasync iteratorを返す
        for await (const image of await pdf(pdfBuffer, { scale: 2.0 })) {
            pageNum++;
            
            // ページ指定がある場合、対象ページのみ変換
            if (targetPages.size > 0 && !targetPages.has(pageNum)) {
                console.log(`[PDF Converter] Skipping page ${pageNum}`);
                continue;
            }
            
            console.log(`[PDF Converter] Converting page ${pageNum}`);
            
            // imageはBufferとして返される
            images.push({
                buffer: Buffer.from(image),
                mimeType: 'image/png',
                name: `${fileName}_page${pageNum}.png`,
                pageNumber: pageNum,
                sourceFileName: fileName
            });
        }
        
        console.log(`[PDF Converter] Converted ${images.length} pages to images`);
        return images;
        
    } catch (error) {
        console.warn('[PDF Converter] ⚠️ PDF to image conversion failed. Sending PDF directly to Gemini.');
        console.warn('[PDF Converter] Error details:', error instanceof Error ? error.message : error);
        console.warn('[PDF Converter] Note: Gemini can still read PDFs directly, but page extraction may be less precise.');
        // 変換に失敗した場合は元のPDFをそのまま返す（GeminiはPDFを直接読める）
        return [{
            buffer: pdfBuffer,
            mimeType: 'application/pdf',
            name: fileName,
            sourceFileName: fileName
        }];
    }
}

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

export async function POST(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient();
        
        // ユーザー認証チェック
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json(
                { status: 'error', message: 'ログインが必要です。アカウントにログインしてください。' },
                { status: 401 }
            );
        }

        // RPCクライアントを定義（後で使用するため）
        const supabaseRpc = supabase as unknown as {
            rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
        };

        // 管理者アカウントの場合は利用可能として扱う
        let isAdmin = false;
        try {
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();

            if (profileError) {
                console.warn('[Grade API] Profile fetch error (may be RLS issue):', profileError.message);
                // RLSエラーの場合は続行（SECURITY DEFINER付きRPCで再確認）
            } else {
                isAdmin = !!(profile && (profile as { role?: string }).role === 'admin');
            }
        } catch (profileErr) {
            console.warn('[Grade API] Profile fetch exception:', profileErr);
        }

        // 利用可否チェック（RPC関数はSECURITY DEFINERなのでRLSをバイパス）
        let canProceed = isAdmin;
        
        if (!isAdmin) {
            try {
                const { data: usageData, error: usageError } = await supabaseRpc
                    .rpc('can_use_service', { p_user_id: user.id });
                const usageRows = usageData as CanUseServiceResult[] | null;
                
                if (usageError) {
                    // RLSエラーの可能性 - 一時的に続行を許可
                    console.warn('[Grade API] Usage check error (may be RLS issue):', usageError.message);
                    console.log('[Grade API] Allowing access temporarily due to RLS error');
                    canProceed = true;
                } else if (!usageRows || usageRows.length === 0) {
                    // データが取得できない場合も一時的に続行を許可
                    console.warn('[Grade API] No usage data returned, allowing access temporarily');
                    canProceed = true;
                } else if (usageRows[0].can_use) {
                    canProceed = true;
                } else {
                    return NextResponse.json(
                        { 
                            status: 'error', 
                            message: usageRows[0].message || '利用可能なプランがありません。プランを購入してください。',
                            requirePlan: true
                        },
                        { status: 403 }
                    );
                }
            } catch (usageErr) {
                console.warn('[Grade API] Usage check exception:', usageErr);
                // 例外発生時も一時的に続行を許可
                canProceed = true;
            }
        }
        
        if (isAdmin) {
            console.log('[Grade API] Admin user detected, allowing access');
        } else if (canProceed) {
            console.log('[Grade API] User can proceed with grading');
        }

        const formData = await req.formData();
        const targetLabelsJson = formData.get('targetLabels') as string;
        const files = formData.getAll('files') as File[];
        const pdfPageInfoJson = formData.get('pdfPageInfo') as string | null;

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
        if (!Array.isArray(targetLabels) || targetLabels.length === 0) {
            return NextResponse.json(
                { status: 'error', message: 'Invalid target labels' },
                { status: 400 }
            );
        }

        // プロンプトインジェクション対策: 入力値の検証とサニタイズ
        const sanitizedLabels = targetLabels.map(label => {
            // 危険な文字列パターンを検出・除去
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
            
            // サニタイズ後の文字列をトリム
            sanitized = sanitized.trim();
            
            // 長さ制限（50文字以下）
            if (sanitized.length > 50) {
                throw new Error(`問題番号が長すぎます（50文字以下にしてください）: ${label}`);
            }
            
            // 空文字チェック
            if (sanitized.length === 0) {
                throw new Error('問題番号を入力してください');
            }
            
            // 許可する文字種のみ通す（日本語、英数字、括弧、ハイフン、スペース、アンダースコア）
            // これにより特殊な制御文字やスクリプト的な記号を排除
            const allowedPattern = /^[\u3000-\u9FFF\u4E00-\u9FAFa-zA-Z0-9\s\-_（）\(\)\[\]【】「」・、。]+$/;
            if (!allowedPattern.test(sanitized)) {
                throw new Error(`問題番号に使用できない文字が含まれています: ${label}`);
            }
            
            return sanitized;
        });

        // Convert Files to Buffers (PDFは画像に変換)
        const fileBuffersNested = await Promise.all<UploadedFilePart[]>(
            files.map(async (file) => {
                const buffer = Buffer.from(await file.arrayBuffer());
                
                // PDFの場合は画像に変換
                if (file.type === 'application/pdf') {
                    console.log(`[API] Converting PDF to images: ${file.name}`);
                    return await convertPdfToImages(buffer, file.name, pdfPageInfo);
                }
                
                // 画像の場合はそのまま
                return [{
                    buffer,
                    mimeType: file.type,
                    name: file.name,
                    sourceFileName: file.name
                }];
            })
        );
        
        // ネストした配列をフラット化
        const fileBuffers = fileBuffersNested.flat();
        console.log(`[API] Total files to process: ${fileBuffers.length}`);

        const grader = new EduShiftGrader();
        const results: Array<{ label: string; result?: unknown; error?: string; status?: string }> = [];

        for (const label of sanitizedLabels) {
            try {
                const result = await grader.gradeAnswerFromMultipleFiles(
                    label,
                    fileBuffers,
                    pdfPageInfo  // PDFページ番号情報を渡す
                );
                results.push({ label, result });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Error grading ${label}:`, error);
                results.push({ label, error: message, status: 'error' });
            }
        }

        // 採点成功時に利用回数をインクリメント（管理者は除く）
        const successfulGradings = results.filter(r => r.result && !r.error);
        
        if (successfulGradings.length > 0 && !isAdmin) {
            // 各採点成功ごとに利用回数をインクリメント
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
        }

        // 更新後の利用情報を取得（管理者は除く）
        let updatedUsageRows: CanUseServiceResult[] | null = null;
        if (!isAdmin) {
            const { data: updatedUsageData } = await supabaseRpc
                .rpc('can_use_service', { p_user_id: user.id });
            updatedUsageRows = updatedUsageData as CanUseServiceResult[] | null;
        }
        
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

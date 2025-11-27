import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { EduShiftGrader } from '@/lib/core/grader';
import type { Database } from '@/lib/supabase/types';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

// Vercel Proプラン: タイムアウトを300秒（5分）に設定
export const maxDuration = 300;

type UploadedFilePart = {
    buffer: Buffer;
    mimeType: string;
    name: string;
    pageNumber?: number;
    sourceFileName?: string;
};

type CanUseServiceResult = Database['public']['Functions']['can_use_service']['Returns'][number];

// PDFを処理する関数
// 注意: pdf-to-imgはVercelサーバーレス環境で動作しないため、
// PDFは直接Geminiに送信する（Gemini 2.0はPDFを直接読める）
async function processPdfFile(
    pdfBuffer: Buffer,
    fileName: string,
    _pageInfo?: { answerPage?: string; problemPage?: string; modelAnswerPage?: string } | null
): Promise<UploadedFilePart[]> {
    console.log(`[PDF Processor] Processing PDF: ${fileName} (${Math.round(pdfBuffer.length / 1024)} KB)`);
    console.log('[PDF Processor] Sending PDF directly to Gemini (no image conversion)');
    
    // Gemini 2.0はPDFを直接処理できるので、変換せずにそのまま送信
    return [{
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
        name: fileName,
        sourceFileName: fileName
    }];
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
    const startTime = Date.now();
    const log = (msg: string) => console.log(`[Grade API] [${Date.now() - startTime}ms] ${msg}`);
    
    // 本番モード: Supabaseチェックを有効化
    const DEBUG_SKIP_SUPABASE = false;
    // デバッグモード: Gemini APIの最小テスト (false=実際の採点を実行)
    const DEBUG_MINIMAL_TEST = false;
    
    try {
        log('Starting request processing...');
        
        let user: { id: string } | null = null;
        
        if (DEBUG_SKIP_SUPABASE) {
            log('DEBUG MODE: Skipping Supabase checks');
            user = { id: 'debug-user' };
        } else {
            log('Getting Supabase client...');
            const supabase = await getSupabaseClient();
            log('Supabase client obtained');
            
            // ユーザー認証チェック
            log('Checking user authentication...');
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
            log(`Auth check complete: ${authUser ? 'user found' : 'no user'}, error: ${authError?.message || 'none'}`);
            
            if (authError || !authUser) {
                return NextResponse.json(
                    { status: 'error', message: 'ログインが必要です。アカウントにログインしてください。' },
                    { status: 401 }
                );
            }
            user = authUser;
        }

        if (!DEBUG_SKIP_SUPABASE) {
            const supabase = await getSupabaseClient();
            const supabaseRpc = supabase as unknown as {
                rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
            };

            // 利用可否チェック
            log('Calling can_use_service RPC...');
            const { data: usageData, error: usageError } = await supabaseRpc
                .rpc('can_use_service', { p_user_id: user.id });
            log(`RPC complete: error=${usageError?.message || 'none'}`);
            const usageRows = usageData as CanUseServiceResult[] | null;
            
            if (usageError) {
                console.error('Usage check error:', usageError);
                return NextResponse.json(
                    { status: 'error', message: '利用状況の確認中にエラーが発生しました。' },
                    { status: 500 }
                );
            }

            if (!usageRows || usageRows.length === 0 || !usageRows[0].can_use) {
                log('User cannot use service');
                return NextResponse.json(
                    { 
                        status: 'error', 
                        message: usageRows?.[0]?.message || '利用可能なプランがありません。プランを購入してください。',
                        requirePlan: true
                    },
                    { status: 403 }
                );
            }
            log('User can use service');
        } else {
            log('DEBUG MODE: Skipping usage check');
        }

        log('Parsing form data...');
        const formData = await req.formData();
        log('Form data parsed');
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
                    return await processPdfFile(buffer, file.name, pdfPageInfo);
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

        const results: Array<{ label: string; result?: unknown; error?: string; status?: string }> = [];

        if (DEBUG_MINIMAL_TEST) {
            // 最小限のGemini APIテスト
            log('DEBUG: Running minimal Gemini API test...');
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                log('DEBUG: GoogleGenerativeAI imported');
                
                const apiKey = process.env.GEMINI_API_KEY;
                const modelName = process.env.MODEL_NAME || 'gemini-2.0-flash';
                log(`DEBUG: API Key exists: ${!!apiKey}, Model: ${modelName}`);
                
                if (!apiKey) {
                    throw new Error('GEMINI_API_KEY is not set');
                }
                
                const genAI = new GoogleGenerativeAI(apiKey);
                log('DEBUG: GoogleGenerativeAI instance created');
                
                const model = genAI.getGenerativeModel({ model: modelName });
                log('DEBUG: Model obtained');
                
                // 最小限のテキスト生成
                log('DEBUG: Calling generateContent with simple text...');
                const result = await model.generateContent('Say "Hello" in Japanese');
                log('DEBUG: generateContent returned');
                
                const response = await result.response;
                const text = response.text();
                log(`DEBUG: Response text: ${text.substring(0, 100)}`);
                
                results.push({ 
                    label: 'MINIMAL_TEST', 
                    result: { 
                        success: true, 
                        message: 'Gemini API is working',
                        response: text 
                    } 
                });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                log(`DEBUG: Minimal test error: ${message}`);
                console.error('DEBUG: Minimal test error:', error);
                results.push({ label: 'MINIMAL_TEST', error: message, status: 'error' });
            }
        } else {
            log('Creating EduShiftGrader instance...');
            const grader = new EduShiftGrader();
            log('Grader created');

            for (const label of sanitizedLabels) {
                try {
                    log(`Starting grading for: ${label}`);
                    const result = await grader.gradeAnswerFromMultipleFiles(
                        label,
                        fileBuffers,
                        pdfPageInfo  // PDFページ番号情報を渡す
                    );
                    log(`Grading complete for: ${label}`);
                    results.push({ label, result });
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    log(`Grading error for ${label}: ${message}`);
                    console.error(`Error grading ${label}:`, error);
                    results.push({ label, error: message, status: 'error' });
                }
            }
        }
        log('All processing complete');

        let usageInfo = null;

        if (!DEBUG_SKIP_SUPABASE) {
            // 採点成功時に利用回数をインクリメント
            const successfulGradings = results.filter(r => r.result && !r.error);
            const supabase = await getSupabaseClient();
            const supabaseRpc = supabase as unknown as {
                rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
            };
            
            if (successfulGradings.length > 0) {
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

            // 更新後の利用情報を取得
            const { data: updatedUsageData } = await supabaseRpc
                .rpc('can_use_service', { p_user_id: user.id });
            const updatedUsageRows = updatedUsageData as CanUseServiceResult[] | null;
            
            usageInfo = updatedUsageRows?.[0] ? {
                remainingCount: updatedUsageRows[0].remaining_count,
                usageCount: updatedUsageRows[0].usage_count,
                usageLimit: updatedUsageRows[0].usage_limit,
                planName: updatedUsageRows[0].plan_name,
            } : null;
        } else {
            log('DEBUG MODE: Skipping usage increment');
        }

        log('Returning success response');
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

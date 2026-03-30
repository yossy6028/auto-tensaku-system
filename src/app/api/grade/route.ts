import { NextRequest, NextResponse } from 'next/server';
import { EduShiftGrader } from '@/lib/core/grader';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const targetLabelsJson = formData.get('targetLabels') as string;
        const studentFile = formData.get('studentImage') as File;
        const answerKeyFile = formData.get('answerKeyImage') as File;
        const problemFile = formData.get('problemImage') as File;

        if (!targetLabelsJson || !studentFile || !answerKeyFile || !problemFile) {
            return NextResponse.json(
                { status: 'error', message: 'Missing required fields' },
                { status: 400 }
            );
        }

        const targetLabels = JSON.parse(targetLabelsJson) as string[];
        if (!Array.isArray(targetLabels) || targetLabels.length === 0) {
            return NextResponse.json(
                { status: 'error', message: 'Invalid target labels' },
                { status: 400 }
            );
        }

        // Convert Files to Buffers
        const studentBuffer = Buffer.from(await studentFile.arrayBuffer());
        const answerKeyBuffer = Buffer.from(await answerKeyFile.arrayBuffer());
        const problemBuffer = Buffer.from(await problemFile.arrayBuffer());

        const grader = new EduShiftGrader();
        const results = [];

        for (const label of targetLabels) {
            let lastError: any = null;
            let result: any = null;
            const MAX_RETRIES = 2;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                try {
                    result = await grader.gradeAnswerFromBuffer(
                        label,
                        studentBuffer,
                        studentFile.type,
                        answerKeyBuffer,
                        answerKeyFile.type,
                        problemBuffer,
                        problemFile.type
                    );
                    lastError = null;

                    // If the grader returned an error status, check if it's retryable
                    if (result?.status === 'error' && attempt < MAX_RETRIES - 1 && result?.debug_info?.raw_response) {
                        console.warn(`Grader returned error for ${label} on attempt ${attempt + 1}, retrying...`);
                        lastError = result;
                        result = null;
                        continue;
                    }
                    break;
                } catch (error: any) {
                    console.error(`Error grading ${label} (attempt ${attempt + 1}):`, error);
                    lastError = error;
                    if (attempt < MAX_RETRIES - 1) {
                        // Brief pause before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            if (result) {
                results.push({ label, result });
            } else {
                const errorMessage = lastError?.message || lastError?.user_message || 'AIの応答処理中にエラーが発生しました。';
                results.push({ label, error: errorMessage, status: 'error' });
            }
        }

        return NextResponse.json({ status: 'success', results });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { status: 'error', message: error.message },
            { status: 500 }
        );
    }
}

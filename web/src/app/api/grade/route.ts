import { NextRequest, NextResponse } from 'next/server';
import { EduShiftGrader } from '@/lib/core/grader';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const targetLabelsJson = formData.get('targetLabels') as string;
        const files = formData.getAll('files') as File[];

        if (!targetLabelsJson || !files || files.length === 0) {
            return NextResponse.json(
                { status: 'error', message: 'ファイルをアップロードしてください。本人の答案、問題がすべてクリアに写っていることを確認してください。' },
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
        const fileBuffers = await Promise.all(
            files.map(async (file) => ({
                buffer: Buffer.from(await file.arrayBuffer()),
                mimeType: file.type,
                name: file.name
            }))
        );

        const grader = new EduShiftGrader();
        const results = [];

        for (const label of targetLabels) {
            try {
                const result = await grader.gradeAnswerFromMultipleFiles(
                    label,
                    fileBuffers
                );
                results.push({ label, result });
            } catch (error: any) {
                console.error(`Error grading ${label}:`, error);
                results.push({ label, error: error.message, status: 'error' });
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

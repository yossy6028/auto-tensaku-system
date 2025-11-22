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
            try {
                const result = await grader.gradeAnswerFromBuffer(
                    label,
                    studentBuffer,
                    studentFile.type,
                    answerKeyBuffer,
                    answerKeyFile.type,
                    problemBuffer,
                    problemFile.type
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

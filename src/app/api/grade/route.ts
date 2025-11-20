import { NextRequest, NextResponse } from 'next/server';
import { EduShiftGrader } from '@/lib/core/grader';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const targetLabel = formData.get('targetLabel') as string;
        const studentFile = formData.get('studentImage') as File;
        const answerKeyFile = formData.get('answerKeyImage') as File;

        if (!targetLabel || !studentFile || !answerKeyFile) {
            return NextResponse.json(
                { status: 'error', message: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Convert Files to Buffers
        const studentBuffer = Buffer.from(await studentFile.arrayBuffer());
        const answerKeyBuffer = Buffer.from(await answerKeyFile.arrayBuffer());

        const grader = new EduShiftGrader();

        const result = await grader.gradeAnswerFromBuffer(
            targetLabel,
            studentBuffer,
            studentFile.type,
            answerKeyBuffer,
            answerKeyFile.type
        );

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { status: 'error', message: error.message },
            { status: 500 }
        );
    }
}

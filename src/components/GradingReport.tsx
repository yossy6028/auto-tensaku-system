import React from 'react';

interface DeductionDetail {
    reason: string;
    deduction_percentage: number;
}

interface FeedbackContent {
    good_point: string;
    improvement_advice: string;
    rewrite_example: string;
}

interface GradingResult {
    recognized_text?: string;
    score: number;
    deduction_details?: DeductionDetail[];
    feedback_content: FeedbackContent;
}

interface GradingReportProps {
    result: { grading_result?: GradingResult } | null;
    targetLabel: string;
    studentFile: File | null;
}

const normalizeScore = (score: number): number => {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    if (score <= 10) return Math.min(100, Math.round(score * 10));
    return Math.min(100, Math.round(score));
};

export const GradingReport = React.forwardRef<HTMLDivElement, GradingReportProps>(
    ({ result, targetLabel, studentFile }, ref) => {
        const gradingResult = result?.grading_result;
        if (!gradingResult) return null;

        const today = new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const score = normalizeScore(gradingResult.score);
        const deductionDetails = gradingResult.deduction_details ?? [];

        return (
            <div
                ref={ref}
                className="p-8 bg-white text-slate-800 font-sans max-w-[210mm] mx-auto print:max-w-none h-full"
            >
                <div className="border-b-2 border-slate-800 pb-4 mb-8 flex justify-between items-end">
                    <div className="flex items-end gap-4">
                        <img
                            src="/logo.jpg"
                            alt="EduShift"
                            className="w-10 h-10 rounded-lg border border-slate-200 shadow-sm object-cover"
                        />
                        <div>
                            <h1 className="text-2xl font-bold mb-2">採点レポート</h1>
                            <p className="text-slate-500 text-sm">{targetLabel}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500">実施日: {today}</p>
                    </div>
                </div>

                <div className="flex gap-8 mb-8">
                    <div className="w-1/3 bg-slate-50 rounded-xl p-6 border border-slate-200 text-center flex flex-col justify-center">
                        <h2 className="text-slate-500 font-bold mb-2 text-sm uppercase tracking-widest">
                            総合スコア (100%満点)
                        </h2>
                        <div className="flex items-baseline justify-center">
                            <span className="text-6xl font-black text-slate-800">{score}</span>
                            <span className="text-xl font-bold text-slate-400 ml-1">%</span>
                        </div>
                        {deductionDetails.length > 0 && (
                            <ul className="mt-3 text-sm text-slate-600 space-y-1">
                                {deductionDetails.map((item) => (
                                    <li key={`${item.reason}-${item.deduction_percentage}`}>
                                        ・{item.reason} で -{item.deduction_percentage}%
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="w-2/3 grid grid-cols-1 gap-4">
                        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                            <h3 className="font-bold text-green-800 mb-1 text-sm">👍 良かった点</h3>
                            <p className="text-sm text-slate-700">
                                {gradingResult.feedback_content.good_point}
                            </p>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                            <h3 className="font-bold text-indigo-800 mb-1 text-sm">💡 改善のアドバイス</h3>
                            <p className="text-sm text-slate-700">
                                {gradingResult.feedback_content.improvement_advice}
                            </p>
                        </div>
                    </div>
                </div>

                {gradingResult.recognized_text && (
                    <div className="mb-8">
                        <h2 className="text-lg font-bold border-l-4 border-blue-400 pl-3 mb-4">AI読み取り結果（確認用）</h2>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                                {gradingResult.recognized_text}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 text-right">
                                ※文字数判定の基準となります。誤読がある場合は撮影し直してください。
                            </p>
                        </div>
                    </div>
                )}

                {deductionDetails.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 mb-4">減点ポイント</h2>
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="p-3 border-b border-slate-200 font-bold">理由</th>
                                    <th className="p-3 border-b border-slate-200 font-bold w-28 text-right">
                                        減点幅
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {deductionDetails.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100">
                                        <td className="p-3 text-slate-700">{item.reason}</td>
                                        <td className="p-3 text-red-600 font-bold text-right">-{item.deduction_percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mb-8">
                    <h2 className="text-lg font-bold border-l-4 border-yellow-400 pl-3 mb-4">満点の書き直し例</h2>
                    <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-100">
                        <p className="text-slate-800 font-medium leading-relaxed font-serif">
                            {gradingResult.feedback_content.rewrite_example}
                        </p>
                    </div>
                </div>

                <div className="break-inside-avoid">
                    <h2 className="text-lg font-bold border-l-4 border-slate-400 pl-3 mb-4">提出された答案</h2>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-3">
                        {studentFile && (
                            studentFile.type === 'application/pdf' ? (
                                <div className="w-full h-64 bg-white flex items-center justify-center text-slate-400 text-sm">
                                    (PDFプレビューは印刷時に表示されない場合があります)
                                </div>
                            ) : (
                                <img
                                    src={URL.createObjectURL(studentFile)}
                                    alt="Student Answer"
                                    className="w-full h-auto object-contain max-h-[520px] bg-white mx-auto"
                                />
                            )
                        )}
                    </div>
                </div>
            </div>
        );
    }
);

GradingReport.displayName = 'GradingReport';

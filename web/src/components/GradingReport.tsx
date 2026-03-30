import React from 'react';
import Image from 'next/image';
import logo from '@/../public/taskal-main-logo.png';

interface DeductionDetail {
    reason?: string;
    deduction_percentage?: number;
}

interface FeedbackContent {
    good_point?: string;
    improvement_advice?: string;
    rewrite_example?: string;
}

interface EssayEvaluationItem {
    grade: string;
    score: number;
    comment: string;
}

interface BonusPoint {
    reason: string;
    points: number;
}

interface EssayEvaluation {
    theme_response?: EssayEvaluationItem;
    structure?: EssayEvaluationItem;
    evidence?: EssayEvaluationItem;
    depth?: EssayEvaluationItem;
    expression?: EssayEvaluationItem;
    bonus_points?: BonusPoint[];
}

interface GradingResult {
    recognized_text?: string;
    recognized_text_full?: string;
    score: number;
    problem_type?: 'reading' | 'essay';
    essay_evaluation?: EssayEvaluation;
    deduction_details?: DeductionDetail[];
    feedback_content?: FeedbackContent;
}

interface GradingReportProps {
    result: { grading_result?: GradingResult } | null;
    targetLabel: string;
    studentName?: string;
    teacherName?: string;
    maxPoints?: number | null;
    editedFeedback?: {
        good_point?: string;
        improvement_advice?: string;
        rewrite_example?: string;
    };
}

const normalizeScore = (score: number): number => {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    return Math.max(0, Math.min(100, Math.round(score)));
};

const formatPoints = (value: number): string => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '');
};

const getGradeColor = (grade: string): string => {
    switch (grade.toUpperCase()) {
        case 'A':
            return 'bg-green-500 text-white';
        case 'B':
            return 'bg-blue-500 text-white';
        case 'C':
            return 'bg-yellow-500 text-white';
        case 'D':
            return 'bg-orange-500 text-white';
        case 'E':
            return 'bg-red-500 text-white';
        default:
            return 'bg-gray-400 text-white';
    }
};

export const GradingReport = React.forwardRef<HTMLDivElement, GradingReportProps>(
    ({ result, targetLabel, studentName, teacherName, editedFeedback, maxPoints }, ref) => {
        const gradingResult = result?.grading_result;
        if (!gradingResult) return null;

        const today = new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const score = normalizeScore(gradingResult.score);
        const safeMaxPoints = typeof maxPoints === 'number' && Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : null;
        const earnedPoints = safeMaxPoints ? Math.round((score / 100) * safeMaxPoints) : null;
        const deductionDetails = gradingResult.deduction_details ?? [];

        // 編集されたフィードバックを優先して使用
        const displayFeedback = {
            good_point: editedFeedback?.good_point ?? gradingResult.feedback_content?.good_point ?? '',
            improvement_advice: editedFeedback?.improvement_advice ?? gradingResult.feedback_content?.improvement_advice ?? '',
            rewrite_example: editedFeedback?.rewrite_example ?? gradingResult.feedback_content?.rewrite_example ?? '',
        };

        return (
            <div
                ref={ref}
                className="p-8 bg-white text-slate-800 font-sans max-w-[210mm] mx-auto print:max-w-none print:p-4 h-full"
            >
                {/* Brand (small) */}
                <div className="flex items-center gap-3 mb-4 print:mb-3">
                    <Image
                        src={logo}
                        alt="Taskal AI"
                        className="rounded-lg border border-slate-200 shadow-sm object-cover print:w-8 print:h-8"
                        width={40}
                        height={40}
                        priority
                    />
                    <div className="leading-tight">
                        <p className="text-xs text-slate-500 print:text-[11px]">EduShift</p>
                        <p className="text-sm font-bold text-slate-800 print:text-xs">Taskal AI</p>
                    </div>
                </div>

                {/* 問題番号を最上部に大きく表示 */}
                <div className="mb-6 pb-4 border-b-2 border-indigo-500 print:break-after-avoid print:mb-4 print:pb-3">
                    <div className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-md print:bg-indigo-600 print:text-white">
                        <span className="text-2xl font-bold tracking-wide print:text-xl">{targetLabel}</span>
                    </div>
                </div>

                <div className="border-b-2 border-slate-800 pb-4 mb-8 flex justify-between items-end print:break-after-avoid print:mb-4 print:pb-3">
                    <div>
                        <h1 className="text-2xl font-bold mb-2 print:text-xl print:mb-1">採点レポート</h1>
                        {studentName && (
                            <p className="text-base text-slate-700 print:text-sm">
                                <span className="font-medium">生徒名:</span> {studentName}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 print:text-xs">実施日: {today}</p>
                        {teacherName && (
                            <p className="text-sm text-slate-600 print:text-xs">
                                添削担当: {teacherName}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-8 mb-8 print:break-inside-avoid print:mb-4">
                    <div className="w-1/3 bg-slate-50 rounded-xl p-6 border border-slate-200 text-center flex flex-col justify-center print:break-inside-avoid print:p-4">
                        <h2 className="text-slate-500 font-bold mb-2 text-sm uppercase tracking-widest print:text-xs">
                            総合スコア (100%満点)
                        </h2>
                        <div className="flex items-baseline justify-center">
                            <span className="text-6xl font-black text-slate-800 print:text-5xl">{score}</span>
                            <span className="text-xl font-bold text-slate-400 ml-1 print:text-lg">%</span>
                        </div>
                        {safeMaxPoints && earnedPoints !== null && (
                            <p className="mt-2 text-sm text-slate-600 font-semibold print:text-xs">
                                得点: {formatPoints(earnedPoints)} / {formatPoints(safeMaxPoints)} 点
                            </p>
                        )}
                        {gradingResult.problem_type === 'essay' && (
                            <div className="mt-2 inline-block bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-medium print:text-[10px]">
                                📝 作文・自由記述
                            </div>
                        )}
                        {deductionDetails.length > 0 && (
                            <ul className="mt-3 text-sm text-slate-600 space-y-1 print:text-xs print:mt-2">
                                {deductionDetails.map((item) => (
                                    <li key={`${item.reason}-${item.deduction_percentage}`}>
                                        ・{item.reason} で -{item.deduction_percentage}%
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="w-2/3 grid grid-cols-1 gap-4 print:break-inside-avoid print:gap-3">
                        <div className="bg-green-50 rounded-xl p-4 border border-green-100 print:break-inside-avoid print:p-3">
                            <h3 className="font-bold text-green-800 mb-1 text-sm print:text-xs">👍 良かった点</h3>
                            <p className="text-sm text-slate-700 print:text-xs">
                                {displayFeedback.good_point}
                            </p>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 print:break-inside-avoid print:p-3">
                            <h3 className="font-bold text-indigo-800 mb-1 text-sm print:text-xs">💡 改善のアドバイス</h3>
                            <p className="text-sm text-slate-700 print:text-xs">
                                {displayFeedback.improvement_advice}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 作文・自由記述の観点別評価 */}
                {gradingResult.problem_type === 'essay' && gradingResult.essay_evaluation && (
                    <div className="mb-8 print:break-inside-avoid print:mb-4">
                        <h2 className="text-lg font-bold border-l-4 border-purple-500 pl-3 mb-4 print:text-base print:mb-2 print:break-after-avoid">
                            📊 観点別評価（作文・自由記述）
                        </h2>
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 print:break-inside-avoid print:p-3">
                            <table className="w-full text-sm print:text-xs">
                                <thead className="bg-purple-100 text-purple-800">
                                    <tr>
                                        <th className="p-2 text-left font-bold print:p-1">観点</th>
                                        <th className="p-2 text-center font-bold w-16 print:p-1 print:w-12">評価</th>
                                        <th className="p-2 text-center font-bold w-20 print:p-1 print:w-16">得点</th>
                                        <th className="p-2 text-left font-bold print:p-1">コメント</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gradingResult.essay_evaluation.theme_response && (
                                        <tr className="border-b border-purple-100">
                                            <td className="p-2 font-medium text-slate-700 print:p-1">テーマ・設問への応答</td>
                                            <td className="p-2 text-center print:p-1">
                                                <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${getGradeColor(gradingResult.essay_evaluation.theme_response.grade)}`}>
                                                    {gradingResult.essay_evaluation.theme_response.grade}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center font-bold text-slate-700 print:p-1">
                                                {gradingResult.essay_evaluation.theme_response.score}/20
                                            </td>
                                            <td className="p-2 text-slate-600 print:p-1">
                                                {gradingResult.essay_evaluation.theme_response.comment}
                                            </td>
                                        </tr>
                                    )}
                                    {gradingResult.essay_evaluation.structure && (
                                        <tr className="border-b border-purple-100">
                                            <td className="p-2 font-medium text-slate-700 print:p-1">構成・論理展開</td>
                                            <td className="p-2 text-center print:p-1">
                                                <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${getGradeColor(gradingResult.essay_evaluation.structure.grade)}`}>
                                                    {gradingResult.essay_evaluation.structure.grade}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center font-bold text-slate-700 print:p-1">
                                                {gradingResult.essay_evaluation.structure.score}/20
                                            </td>
                                            <td className="p-2 text-slate-600 print:p-1">
                                                {gradingResult.essay_evaluation.structure.comment}
                                            </td>
                                        </tr>
                                    )}
                                    {gradingResult.essay_evaluation.evidence && (
                                        <tr className="border-b border-purple-100">
                                            <td className="p-2 font-medium text-slate-700 print:p-1">根拠・具体例</td>
                                            <td className="p-2 text-center print:p-1">
                                                <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${getGradeColor(gradingResult.essay_evaluation.evidence.grade)}`}>
                                                    {gradingResult.essay_evaluation.evidence.grade}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center font-bold text-slate-700 print:p-1">
                                                {gradingResult.essay_evaluation.evidence.score}/20
                                            </td>
                                            <td className="p-2 text-slate-600 print:p-1">
                                                {gradingResult.essay_evaluation.evidence.comment}
                                            </td>
                                        </tr>
                                    )}
                                    {gradingResult.essay_evaluation.depth && (
                                        <tr className="border-b border-purple-100">
                                            <td className="p-2 font-medium text-slate-700 print:p-1">考えの深さ・多角的視点</td>
                                            <td className="p-2 text-center print:p-1">
                                                <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${getGradeColor(gradingResult.essay_evaluation.depth.grade)}`}>
                                                    {gradingResult.essay_evaluation.depth.grade}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center font-bold text-slate-700 print:p-1">
                                                {gradingResult.essay_evaluation.depth.score}/20
                                            </td>
                                            <td className="p-2 text-slate-600 print:p-1">
                                                {gradingResult.essay_evaluation.depth.comment}
                                            </td>
                                        </tr>
                                    )}
                                    {gradingResult.essay_evaluation.expression && (
                                        <tr className="border-b border-purple-100">
                                            <td className="p-2 font-medium text-slate-700 print:p-1">表現・言語運用</td>
                                            <td className="p-2 text-center print:p-1">
                                                <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${getGradeColor(gradingResult.essay_evaluation.expression.grade)}`}>
                                                    {gradingResult.essay_evaluation.expression.grade}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center font-bold text-slate-700 print:p-1">
                                                {gradingResult.essay_evaluation.expression.score}/20
                                            </td>
                                            <td className="p-2 text-slate-600 print:p-1">
                                                {gradingResult.essay_evaluation.expression.comment}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* 加点要素 */}
                            {gradingResult.essay_evaluation.bonus_points && gradingResult.essay_evaluation.bonus_points.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-purple-200">
                                    <h4 className="font-bold text-purple-700 mb-2 text-sm print:text-xs">✨ 加点要素</h4>
                                    <ul className="space-y-1">
                                        {gradingResult.essay_evaluation.bonus_points.map((bonus, idx) => (
                                            <li key={idx} className="text-sm text-green-700 print:text-xs">
                                                ・{bonus.reason} <span className="font-bold">+{bonus.points}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {(gradingResult.recognized_text || gradingResult.recognized_text_full) && (
                    <div className="mb-8 print:break-inside-avoid print:mb-4">
                        <h2 className="text-lg font-bold border-l-4 border-blue-400 pl-3 mb-4 print:text-base print:mb-2 print:break-after-avoid">AI読み取り結果（確認用）</h2>
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 print:break-inside-avoid print:p-3">
                            <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono print:text-xs">
                                {gradingResult.recognized_text || gradingResult.recognized_text_full}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 text-right print:text-[10px] print:mt-1">
                                ※文字数判定の基準となります。誤読がある場合は撮影し直してください。
                            </p>
                        </div>
                    </div>
                )}

                {deductionDetails.length > 0 && (
                    <div className="mb-8 print:break-inside-avoid print:mb-4">
                        <h2 className="text-lg font-bold border-l-4 border-red-500 pl-3 mb-4 print:text-base print:mb-2 print:break-after-avoid">減点ポイント</h2>
                        <table className="w-full text-sm text-left border-collapse print:text-xs print:break-inside-avoid">
                            <thead className="bg-slate-100 text-slate-600">
                                <tr>
                                    <th className="p-3 border-b border-slate-200 font-bold print:p-2">理由</th>
                                    <th className="p-3 border-b border-slate-200 font-bold w-28 text-right print:p-2 print:w-20">
                                        減点幅
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {deductionDetails.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 print:break-inside-avoid">
                                        <td className="p-3 text-slate-700 print:p-2">{item.reason}</td>
                                        <td className="p-3 text-red-600 font-bold text-right print:p-2">-{item.deduction_percentage}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mb-8 print:break-inside-avoid print:mb-4">
                    <h2 className="text-lg font-bold border-l-4 border-yellow-400 pl-3 mb-4 print:text-base print:mb-2 print:break-after-avoid">満点の書き直し例</h2>
                    <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-100 print:break-inside-avoid print:p-4">
                        <p className="text-slate-800 font-medium leading-relaxed font-serif print:text-sm print:leading-relaxed">
                            {displayFeedback.rewrite_example}
                        </p>
                    </div>
                </div>

                {/* 提出された答案セクションは撤廃（AI読み取り結果のみ表示） */}
            </div>
        );
    }
);

GradingReport.displayName = 'GradingReport';

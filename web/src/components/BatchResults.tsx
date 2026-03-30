'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Download, FileDown, CheckCircle, AlertCircle, User, ChevronDown, ChevronUp, Sparkles, TrendingUp, Edit3, Save, X, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { StudentEntry, GradingResponseItem } from '@/lib/types/batch';
import { GradingReport } from '@/components/GradingReport';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// モバイル検出（iOS Safari特にPDF印刷ダイアログが閉じにくい問題の対策）
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua) ||
         (navigator.maxTouchPoints > 0 && /Mobile|Tablet/i.test(ua));
};

interface BatchResultsProps {
  students: StudentEntry[];
  selectedProblems: string[];
  problemPoints: Record<string, number>;
  teacherName?: string;
  onDownloadZip: () => void;
  isGeneratingZip?: boolean;
  onUpdateResult?: (studentId: string, label: string, updates: ResultUpdates) => void;
}

interface StudentResultCardProps {
  student: StudentEntry;
  index: number;
  problemPoints: Record<string, number>;
  teacherName?: string;
  onUpdateResult?: (label: string, updates: ResultUpdates) => void;
}

interface ResultUpdates {
  score?: number;
  good_point?: string;
  improvement_advice?: string;
  rewrite_example?: string;
  recognized_text?: string;
}

// スコアを0-100に正規化
const normalizeScore = (score: number | undefined | null): number | null => {
  if (score === undefined || score === null) return null;
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
};

// スコアに応じた色を取得
const getScoreColor = (score: number | null): string => {
  if (score === null) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
};

const getScoreBgColor = (score: number | null): string => {
  if (score === null) return 'from-slate-400 to-slate-500';
  if (score >= 80) return 'from-emerald-500 to-teal-500';
  if (score >= 60) return 'from-blue-500 to-indigo-500';
  if (score >= 40) return 'from-amber-500 to-orange-500';
  return 'from-red-500 to-rose-500';
};

// 採点が有効かどうかチェック
const isValidGrading = (result: GradingResponseItem): boolean => {
  const gr = result.result?.grading_result;
  if (!gr) return false;
  // incomplete_grading フラグがある場合は無効
  if (result.result?.incomplete_grading) return false;
  // scoreがundefinedまたはnullの場合は無効
  if (gr.score === undefined || gr.score === null) return false;
  return true;
};

const StudentResultCard: React.FC<StudentResultCardProps> = ({
  student,
  index,
  problemPoints,
  teacherName,
  onUpdateResult,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ResultUpdates>({});
  const reportRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const printRef = useRef<HTMLDivElement | null>(null);
  const [printingLabel, setPrintingLabel] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // クライアントサイドでモバイル検出
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `採点レポート_${student.name || `生徒${index + 1}`}_${printingLabel || ''}`,
    onAfterPrint: () => setPrintingLabel(null),
  });

  // モバイル用: html2canvas + jsPDF で直接PDFダウンロード
  const downloadPdfMobile = useCallback(async (label: string) => {
    const element = reportRefs.current[label];
    if (!element) return;

    setIsGeneratingPdf(true);
    try {
      // レポート要素を一時的に表示
      const originalDisplay = element.parentElement?.style.display;
      if (element.parentElement) {
        element.parentElement.style.display = 'block';
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // 元に戻す
      if (element.parentElement && originalDisplay !== undefined) {
        element.parentElement.style.display = originalDisplay;
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      const fileName = `採点レポート_${student.name || `生徒${index + 1}`}_${label}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDFの生成に失敗しました。もう一度お試しください。');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [student.name, index]);

  // PCではreact-to-print、モバイルではjsPDFを使用
  const downloadPdf = useCallback(
    (label: string) => {
      if (isMobile) {
        downloadPdfMobile(label);
      } else {
        printRef.current = reportRefs.current[label] || null;
        setPrintingLabel(label);
        setTimeout(() => {
          handlePrint();
        }, 100);
      }
    },
    [handlePrint, isMobile, downloadPdfMobile]
  );

  const startEdit = (label: string, result: GradingResponseItem) => {
    const gr = result.result?.grading_result;
    setEditingLabel(label);
    setEditValues({
      score: gr?.score !== undefined ? normalizeScore(gr.score) ?? 0 : 0,
      good_point: gr?.feedback_content?.good_point || '',
      improvement_advice: gr?.feedback_content?.improvement_advice || '',
      rewrite_example: gr?.feedback_content?.rewrite_example || '',
      recognized_text: gr?.recognized_text || gr?.recognized_text_full || '',
    });
  };

  const cancelEdit = () => {
    setEditingLabel(null);
    setEditValues({});
  };

  const saveEdit = (label: string) => {
    if (onUpdateResult) {
      onUpdateResult(label, editValues);
    }
    setEditingLabel(null);
    setEditValues({});
  };

  if (student.status !== 'success' || !student.results) {
    return null;
  }

  // 有効な採点結果のみカウント
  const validResults = student.results.filter(isValidGrading);
  const invalidResults = student.results.filter(r => !isValidGrading(r));

  const avgScore =
    validResults.length > 0
      ? Math.round(
          validResults.reduce((sum, r) => {
            const score = normalizeScore(r.result?.grading_result?.score);
            return sum + (score ?? 0);
          }, 0) / validResults.length
        )
      : null;

  // 配点がある場合の合計得点を計算
  const totalEarnedPoints = validResults.reduce((sum, r) => {
    const maxPts = problemPoints[r.label];
    if (!maxPts) return sum;
    const score = normalizeScore(r.result?.grading_result?.score);
    if (score === null) return sum;
    return sum + Math.round((score / 100) * maxPts);
  }, 0);

  const totalMaxPoints = validResults.reduce((sum, r) => {
    const maxPts = problemPoints[r.label];
    return sum + (maxPts || 0);
  }, 0);

  const hasPointsConfig = totalMaxPoints > 0;

  return (
    <div className="border-2 rounded-2xl bg-white overflow-hidden shadow-lg">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center',
            avgScore === null ? 'bg-slate-100' :
            avgScore >= 80 ? 'bg-emerald-100' : avgScore >= 60 ? 'bg-blue-100' : avgScore >= 40 ? 'bg-amber-100' : 'bg-red-100'
          )}>
            {avgScore === null ? (
              <AlertCircle className="w-6 h-6 text-slate-400" />
            ) : (
              <CheckCircle className={clsx('w-6 h-6', getScoreColor(avgScore))} />
            )}
          </div>
          <div className="text-left">
            <p className="font-bold text-lg text-slate-800">{student.name || `生徒${index + 1}`}</p>
            <p className="text-sm text-slate-500">
              {validResults.length}問完了
              {invalidResults.length > 0 && (
                <span className="text-amber-600 ml-2">（{invalidResults.length}問要確認）</span>
              )}
              {avgScore !== null && !hasPointsConfig && (
                <> / 平均スコア: <span className={clsx('font-bold', getScoreColor(avgScore))}>{avgScore}%</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avgScore !== null ? (
            hasPointsConfig ? (
              // 配点が設定されている場合は合計得点を表示
              <span className={clsx(
                'px-4 py-1.5 rounded-full text-base font-bold',
                (totalEarnedPoints / totalMaxPoints * 100) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                (totalEarnedPoints / totalMaxPoints * 100) >= 60 ? 'bg-blue-100 text-blue-700' :
                (totalEarnedPoints / totalMaxPoints * 100) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              )}>
                {totalEarnedPoints}/{totalMaxPoints}点
              </span>
            ) : (
              // 配点がない場合はパーセンテージを表示
              <span className={clsx(
                'px-3 py-1 rounded-full text-sm font-bold',
                avgScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                avgScore >= 60 ? 'bg-blue-100 text-blue-700' :
                avgScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              )}>
                {avgScore}%
              </span>
            )
          ) : (
            <span className="px-3 py-1 rounded-full text-sm font-bold bg-slate-100 text-slate-500">
              要確認
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-6 h-6 text-slate-400" />
          ) : (
            <ChevronDown className="w-6 h-6 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content - Detailed Report */}
      {isExpanded && (
        <div className="border-t-2 border-slate-100">
          {student.results.map((result, resultIdx) => {
            const label = result.label;
            const gradingResult = result.result?.grading_result;
            const isValid = isValidGrading(result);
            const isEditing = editingLabel === label;

            // 編集中の値または元の値を使用
            const displayScore = isEditing
              ? editValues.score ?? 0
              : normalizeScore(gradingResult?.score);
            const maxPoints = problemPoints[label];
            const earnedPoints = maxPoints && displayScore !== null ? Math.round((displayScore / 100) * maxPoints) : null;
            const deductionDetails = gradingResult?.deduction_details ?? [];
            const feedback = gradingResult?.feedback_content;

            return (
              <div key={resultIdx} className="p-6 border-b border-slate-100 last:border-b-0">
                {/* Problem Label and Score */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-lg font-bold">
                      {label}
                    </span>
                    {!isValid && (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        採点エラー - 手動で入力してください
                      </span>
                    )}
                    {isValid && !isEditing && (
                      <>
                        {/* 配点が設定されている場合は得点を大きく表示 */}
                        {earnedPoints !== null ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Sparkles className={clsx('w-6 h-6', getScoreColor(displayScore))} />
                              <span className={clsx('text-4xl font-black', getScoreColor(displayScore))}>{earnedPoints}</span>
                              <span className="text-slate-400 text-xl">/{maxPoints}点</span>
                            </div>
                            <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              ({displayScore}%)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Sparkles className={clsx('w-5 h-5', getScoreColor(displayScore))} />
                            <span className={clsx('text-3xl font-black', getScoreColor(displayScore))}>{displayScore}</span>
                            <span className="text-slate-400 text-lg">%</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => startEdit(label, result)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                          編集
                        </button>
                        {isValid && (
                          <button
                            onClick={() => downloadPdf(label)}
                            disabled={isGeneratingPdf}
                            className={clsx(
                              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-md",
                              isGeneratingPdf
                                ? "bg-slate-400 text-slate-200 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white hover:shadow-lg"
                            )}
                          >
                            <Download className="w-5 h-5" />
                            {isGeneratingPdf ? 'PDF生成中...' : 'PDFダウンロード'}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
                        >
                          <X className="w-4 h-4" />
                          キャンセル
                        </button>
                        <button
                          onClick={() => saveEdit(label)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                        >
                          <Save className="w-4 h-4" />
                          保存
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 編集モード */}
                {isEditing ? (
                  <div className="space-y-4 bg-slate-50 rounded-xl p-6">
                    {/* スコア編集 */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">スコア (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editValues.score ?? 0}
                        onChange={(e) => setEditValues({ ...editValues, score: parseInt(e.target.value) || 0 })}
                        className="w-32 px-4 py-2 border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none text-2xl font-bold"
                      />
                    </div>

                    {/* 読み取り結果編集 */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">AI読み取り結果（確認・修正）</label>
                      <textarea
                        value={editValues.recognized_text || ''}
                        onChange={(e) => setEditValues({ ...editValues, recognized_text: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none font-mono text-sm"
                        placeholder="生徒の答案テキスト"
                      />
                      <p className="text-xs text-slate-500 mt-1">文字数: {editValues.recognized_text?.length || 0}文字</p>
                    </div>

                    {/* 良い点 */}
                    <div>
                      <label className="block text-sm font-bold text-emerald-700 mb-2">👍 良かった点</label>
                      <textarea
                        value={editValues.good_point || ''}
                        onChange={(e) => setEditValues({ ...editValues, good_point: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-emerald-50"
                      />
                    </div>

                    {/* 改善アドバイス */}
                    <div>
                      <label className="block text-sm font-bold text-blue-700 mb-2">💡 改善のアドバイス</label>
                      <textarea
                        value={editValues.improvement_advice || ''}
                        onChange={(e) => setEditValues({ ...editValues, improvement_advice: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:outline-none bg-blue-50"
                      />
                    </div>

                    {/* 書き直し例 */}
                    <div>
                      <label className="block text-sm font-bold text-amber-700 mb-2">✨ 満点の書き直し例</label>
                      <textarea
                        value={editValues.rewrite_example || ''}
                        onChange={(e) => setEditValues({ ...editValues, rewrite_example: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-amber-200 rounded-xl focus:border-amber-500 focus:outline-none bg-amber-50"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Score Bar */}
                    {displayScore !== null && (
                      <div className="mb-6">
                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-500', getScoreBgColor(displayScore))}
                            style={{ width: `${displayScore}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Deduction Details */}
                    {deductionDetails.length > 0 && (
                      <div className="mb-6 bg-red-50 rounded-xl p-4 border border-red-100">
                        <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                          <Edit3 className="w-4 h-4" />
                          減点ポイント
                        </h4>
                        <div className="space-y-2">
                          {deductionDetails.map((d, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                              <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                -{d.deduction_percentage || 0}%
                              </span>
                              <div>
                                <p className="text-red-700 font-medium">{d.reason}</p>
                                {d.advice && <p className="text-red-600 text-xs mt-1">{d.advice}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback Sections */}
                    <div className="grid gap-4">
                      {/* Good Point */}
                      {feedback?.good_point && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                          <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            良い点
                          </h4>
                          <p className="text-emerald-700 leading-relaxed">{feedback.good_point}</p>
                        </div>
                      )}

                      {/* Improvement Advice */}
                      {feedback?.improvement_advice && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            改善アドバイス
                          </h4>
                          <p className="text-blue-700 leading-relaxed">{feedback.improvement_advice}</p>
                        </div>
                      )}

                      {/* Rewrite Example */}
                      {feedback?.rewrite_example && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                          <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            満点の書き直し例
                          </h4>
                          <p className="text-amber-900 leading-relaxed font-medium bg-white/60 p-3 rounded-lg border border-amber-200">
                            {feedback.rewrite_example}
                          </p>
                        </div>
                      )}

                      {/* 採点エラー時のメッセージ */}
                      {!isValid && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                          <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            採点を完了できませんでした
                          </h4>
                          <p className="text-amber-700 leading-relaxed">
                            AIによる採点処理中にエラーが発生しました。「編集」ボタンから手動でスコアとフィードバックを入力してください。
                          </p>
                          <p className="text-green-700 text-sm mt-2 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                            この問題のクレジットは消費されていません
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Hidden Report for Print */}
                <div className="hidden">
                  <div ref={(el) => { reportRefs.current[label] = el; }}>
                    <GradingReport
                      result={result.result ?? null}
                      targetLabel={label}
                      studentName={student.name}
                      teacherName={teacherName}
                      maxPoints={problemPoints[label] ?? null}
                      editedFeedback={editingLabel === label ? {
                        good_point: editValues.good_point,
                        improvement_advice: editValues.improvement_advice,
                        rewrite_example: editValues.rewrite_example,
                      } : undefined}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const BatchResults: React.FC<BatchResultsProps> = ({
  students,
  selectedProblems: _selectedProblems,
  problemPoints,
  teacherName,
  onDownloadZip,
  isGeneratingZip = false,
  onUpdateResult,
}) => {
  void _selectedProblems; // Reserved for future use
  const successStudents = students.filter((s) => s.status === 'success' && s.results);
  const errorStudents = students.filter((s) => s.status === 'error');

  // 要確認（採点エラー）がある生徒をカウント
  const studentsWithErrors = successStudents.filter((s) =>
    s.results?.some((r) => !isValidGrading(r))
  );

  if (successStudents.length === 0 && errorStudents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 mt-8">
      {/* Header with ZIP Download */}
      <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border-2 border-emerald-200">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3 text-emerald-800">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
            採点結果 ({successStudents.length}名完了)
          </h2>
          {studentsWithErrors.length > 0 && (
            <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {studentsWithErrors.length}名に要確認の結果があります（編集ボタンから手動入力可能）
            </p>
          )}
        </div>
        {successStudents.length > 0 && (
          <button
            onClick={onDownloadZip}
            disabled={isGeneratingZip}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-md',
              isGeneratingZip
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white hover:shadow-lg'
            )}
          >
            <FileDown className="w-5 h-5" />
            {isGeneratingZip ? 'PDF生成中...' : '全員分をZIPでダウンロード'}
          </button>
        )}
      </div>

      {/* Success Results - Detailed Cards */}
      <div className="space-y-4">
        {successStudents.map((student) => (
          <StudentResultCard
            key={student.id}
            student={student}
            index={students.indexOf(student)}
            problemPoints={problemPoints}
            teacherName={teacherName}
            onUpdateResult={onUpdateResult ? (label, updates) => onUpdateResult(student.id, label, updates) : undefined}
          />
        ))}
      </div>

      {/* Error Results */}
      {errorStudents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5" />
            エラー ({errorStudents.length}名)
          </h3>
          <div className="space-y-3">
            {errorStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl"
              >
                <User className="w-6 h-6 text-red-400" />
                <div>
                  <p className="font-bold text-red-700">
                    {student.name || `生徒${students.indexOf(student) + 1}`}
                  </p>
                  <p className="text-sm text-red-600">{student.errorMessage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

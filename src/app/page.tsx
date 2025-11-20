'use client';

import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { GradingReport } from '@/components/GradingReport';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Sparkles, ArrowRight, BookOpen, PenTool, GraduationCap } from 'lucide-react';
import { clsx } from 'clsx';

export default function Home() {
  const [targetLabel, setTargetLabel] = useState('2024年度 第1回 実力テスト 国語 大問2');
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'EduShift_Grading_Report',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFile || !answerKeyFile) {
      setError('両方の画像をアップロードしてください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('targetLabel', targetLabel);
    formData.append('studentImage', studentFile);
    formData.append('answerKeyImage', answerKeyFile);

    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.status === 'error') {
        setError(data.message);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeScore = (score: number): number => {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    if (score <= 10) return Math.min(100, Math.round(score * 10));
    return Math.min(100, Math.round(score));
  };

  const gradingResult = result?.grading_result;
  const deductionDetails = gradingResult?.deduction_details ?? [];
  const normalizedScore = gradingResult ? normalizeScore(gradingResult.score) : 0;
  const totalDeduction = deductionDetails.reduce(
    (sum: number, item: any) => sum + (Number(item?.deduction_percentage) || 0),
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">

      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px] animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-400/20 blur-[100px] animate-pulse-slow delay-2000"></div>
      </div>

      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header Section */}
        <div className="text-center mb-16 animate-fade-in relative">
          {/* Floating Icons */}
          <div className="absolute top-10 left-[10%] text-indigo-200/60 hidden lg:block animate-float-slow">
            <BookOpen className="w-16 h-16" />
          </div>
          <div className="absolute bottom-10 right-[10%] text-violet-200/60 hidden lg:block animate-float-slower">
            <PenTool className="w-14 h-14" />
          </div>
          <div className="absolute top-0 right-[15%] text-blue-200/60 hidden lg:block animate-float-slow delay-700">
            <GraduationCap className="w-12 h-12" />
          </div>

          <div className="flex justify-center mb-8 transform hover:scale-105 transition-transform duration-500">
            <div className="relative w-48 h-auto drop-shadow-2xl">
              <img
                src="/logo.jpg"
                alt="EduShift Logo"
                className="w-full h-auto object-contain rounded-2xl"
              />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-800 tracking-tight mb-6 leading-tight">
            国語記述式問題<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 animate-gradient-x">
              自動添削システム
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、<br className="md:hidden" />あなたの思考に寄り添うフィードバックを。
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2.5rem] overflow-hidden border border-white/60 ring-1 ring-white/50 transition-all duration-500 hover:shadow-[0_20px_40px_rgb(79,70,229,0.1)]">
          <div className="p-8 md:p-14">
            <form onSubmit={handleSubmit} className="space-y-12">

              {/* Target Label Input */}
              <div className="max-w-sm mx-auto">
                <label htmlFor="targetLabel" className="block text-sm font-bold text-slate-600 mb-3 text-center tracking-wide">
                  採点対象の問題番号
                </label>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                  <input
                    type="text"
                    id="targetLabel"
                    value={targetLabel}
                    onChange={(e) => setTargetLabel(e.target.value)}
                    className="relative block w-full rounded-xl border-0 bg-white shadow-sm text-center text-2xl font-bold text-slate-800 p-4 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300"
                    placeholder="例: 問9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Student Answer Upload */}
                <div className="group">
                  <label className="block text-sm font-bold text-slate-600 mb-4 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-2 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                    生徒の解答画像
                  </label>
                  <div className={clsx(
                    "relative h-72 border-2 border-dashed rounded-3xl transition-all duration-300 ease-out cursor-pointer overflow-hidden",
                    studentFile
                      ? "border-indigo-500 bg-indigo-50/40"
                      : "border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/50"
                  )}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, setStudentFile)}
                      className="hidden"
                      id="student-upload"
                    />
                    <label htmlFor="student-upload" className="absolute inset-0 flex flex-col items-center justify-center p-6 cursor-pointer">
                      {studentFile ? (
                        <div className="animate-scale-in text-center w-full">
                          <div className="w-20 h-20 bg-white rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center mx-auto mb-4 text-indigo-600 transform group-hover:scale-110 transition-transform duration-300">
                            <CheckCircle className="w-10 h-10" />
                          </div>
                          <span className="text-base text-indigo-900 font-bold block truncate w-full px-4">{studentFile.name}</span>
                          <span className="inline-block mt-2 px-3 py-1 bg-indigo-100 text-indigo-600 text-xs font-bold rounded-full">変更する</span>
                        </div>
                      ) : (
                        <div className="text-center group-hover:scale-105 transition-transform duration-300">
                          <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-5 text-slate-300 group-hover:text-indigo-500 group-hover:shadow-xl group-hover:shadow-indigo-100 transition-all duration-300">
                            <Upload className="w-9 h-9" />
                          </div>
                          <span className="text-base text-slate-600 font-bold block">画像・PDFをアップロード</span>
                          <span className="text-sm text-slate-400 mt-2 block">ドラッグ＆ドロップ<br />またはクリック</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Answer Key Upload */}
                <div className="group">
                  <label className="block text-sm font-bold text-slate-600 mb-4 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 mr-2 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></span>
                    模範解答画像
                  </label>
                  <div className={clsx(
                    "relative h-72 border-2 border-dashed rounded-3xl transition-all duration-300 ease-out cursor-pointer overflow-hidden",
                    answerKeyFile
                      ? "border-violet-500 bg-violet-50/40"
                      : "border-slate-200 bg-slate-50/50 hover:border-violet-300 hover:bg-white hover:shadow-lg hover:shadow-violet-100/50"
                  )}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, setAnswerKeyFile)}
                      className="hidden"
                      id="key-upload"
                    />
                    <label htmlFor="key-upload" className="absolute inset-0 flex flex-col items-center justify-center p-6 cursor-pointer">
                      {answerKeyFile ? (
                        <div className="animate-scale-in text-center w-full">
                          <div className="w-20 h-20 bg-white rounded-2xl shadow-xl shadow-violet-100 flex items-center justify-center mx-auto mb-4 text-violet-600 transform group-hover:scale-110 transition-transform duration-300">
                            <CheckCircle className="w-10 h-10" />
                          </div>
                          <span className="text-base text-violet-900 font-bold block truncate w-full px-4">{answerKeyFile.name}</span>
                          <span className="inline-block mt-2 px-3 py-1 bg-violet-100 text-violet-600 text-xs font-bold rounded-full">変更する</span>
                        </div>
                      ) : (
                        <div className="text-center group-hover:scale-105 transition-transform duration-300">
                          <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-5 text-slate-300 group-hover:text-violet-500 group-hover:shadow-xl group-hover:shadow-violet-100 transition-all duration-300">
                            <FileText className="w-9 h-9" />
                          </div>
                          <span className="text-base text-slate-600 font-bold block">画像・PDFをアップロード</span>
                          <span className="text-sm text-slate-400 mt-2 block">ドラッグ＆ドロップ<br />またはクリック</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 p-5 flex items-center border border-red-100 animate-shake shadow-sm">
                  <div className="bg-red-100 p-2 rounded-full mr-4">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <p className="text-sm text-red-700 font-bold">{error}</p>
                </div>
              )}

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full group relative flex justify-center py-5 px-6 border-0 rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] text-lg font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto] hover:bg-[position:right_center] focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-500 transform hover:-translate-y-1"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin -ml-1 mr-3 h-6 w-6" />
                      AIが思考中...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      採点を開始する
                      <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Result Display */}
        {result && gradingResult && (
          <div className="mt-20 animate-fade-in-up">
            <div className="bg-white/80 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden border border-white/60 ring-1 ring-white/50">

              {/* Result Header */}
              <div className="p-8 md:p-14 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center">
                  <h2 className="text-3xl font-bold text-slate-800 flex items-center">
                    <Sparkles className="mr-3 h-6 w-6 text-yellow-400 animate-pulse" />
                    採点レポート
                  </h2>
                  <span className="ml-4 text-white/80 text-sm font-bold bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 relative z-10 bg-slate-800">
                    {targetLabel}
                  </span>
                </div>

                <button
                  onClick={() => handlePrint()}
                  className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDFで出力
                </button>
              </div>

              {/* Hidden Report Component for Printing */}
              <div style={{ display: 'none' }}>
                <GradingReport
                  ref={componentRef}
                  result={result}
                  targetLabel={targetLabel}
                  studentFile={studentFile}
                />
              </div>


              <div className="p-8 md:p-14">

                {/* Original Answer & Correction Section */}
                <div className="mb-16">
                  <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                    <span className="bg-indigo-100 text-indigo-600 rounded-lg w-8 h-8 flex items-center justify-center mr-3">📝</span>
                    あなたの答案
                  </h3>

                  {/* Image Preview (Full Width) */}
                  <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200 mb-8">
                    {studentFile && (
                      studentFile.type === 'application/pdf' ? (
                        <iframe
                          src={URL.createObjectURL(studentFile)}
                          className="w-full h-[640px] rounded-xl bg-white"
                          title="Student Answer PDF"
                        />
                      ) : (
                        <img
                          src={URL.createObjectURL(studentFile)}
                          alt="Student Answer"
                          className="w-full h-auto rounded-xl object-contain max-h-[720px] bg-white"
                        />
                      )
                    )}
                    <p className="text-center text-xs text-slate-400 mt-2">提出された答案</p>
                  </div>

                  {/* Deduction Details */}
                  {deductionDetails.length > 0 && (
                    <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-red-800 flex items-center">
                          <AlertCircle className="w-5 h-5 mr-2" />
                          減点ポイント
                        </h4>
                        <span className="text-red-700 font-bold bg-white px-3 py-1 rounded-full border border-red-100 text-sm">
                          合計 -{totalDeduction}%
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {deductionDetails.map((item: any, idx: number) => (
                          <li key={idx} className="flex items-start justify-between bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                            <span className="text-red-700 font-medium">{item.reason}</span>
                            <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-sm whitespace-nowrap ml-4">
                              -{item.deduction_percentage}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Score Section (Updated) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                  <div className="md:col-span-1 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                    <h3 className="text-indigo-100 font-bold mb-1 relative z-10">総合スコア (100%満点)</h3>
                    <div className="flex items-baseline relative z-10">
                      <span className="text-7xl font-black tracking-tighter">
                        {normalizedScore}
                      </span>
                      <span className="text-2xl font-medium ml-2 opacity-80">%</span>
                    </div>
                    <div className="mt-4 w-full bg-black/20 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-white h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${normalizedScore}%` }}
                      ></div>
                    </div>
                    {totalDeduction > 0 && (
                      <p className="mt-3 text-sm text-indigo-100/90">
                        減点合計: -{totalDeduction}% / 最終 {normalizedScore}%
                      </p>
                    )}
                    {deductionDetails.length > 0 && (
                      <ul className="mt-3 text-sm text-indigo-50/90 space-y-1">
                        {deductionDetails.map((item: any, idx: number) => (
                          <li key={`${item?.reason ?? 'deduction'}-${idx}`}>
                            ・{item?.reason} で -{item?.deduction_percentage}%
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Feedback Cards */}
                  <div className="md:col-span-2 grid grid-cols-1 gap-6">
                    <div className="bg-green-50 rounded-3xl p-6 border border-green-100 hover:shadow-lg transition-shadow duration-300">
                      <h3 className="font-bold text-green-800 mb-3 flex items-center">
                        <span className="bg-green-200 text-green-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg">👍</span>
                        良かった点
                      </h3>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {gradingResult.feedback_content.good_point}
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100 hover:shadow-lg transition-shadow duration-300">
                      <h3 className="font-bold text-indigo-800 mb-3 flex items-center">
                        <span className="bg-indigo-200 text-indigo-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg">💡</span>
                        改善のアドバイス
                      </h3>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {gradingResult.feedback_content.improvement_advice}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rewrite Example */}
                <div className="bg-yellow-50/80 rounded-3xl p-8 border border-yellow-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                  <h3 className="text-xl font-bold text-yellow-900 mb-6 flex items-center relative z-10">
                    <span className="bg-yellow-200 text-yellow-700 rounded-lg w-8 h-8 flex items-center justify-center mr-3">✨</span>
                    満点の書き直し例
                  </h3>
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-yellow-200/50 shadow-sm relative z-10">
                    <p className="text-lg leading-loose text-slate-800 font-medium font-serif">
                      {gradingResult.feedback_content.rewrite_example}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

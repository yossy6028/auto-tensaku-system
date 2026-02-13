'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Upload, FileText, CheckCircle, Image, FileCheck, Lightbulb } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function UsagePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px] animate-pulse-slow delay-1000"></div>
      </div>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Back Link */}
        <Link
          href="/grading"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-8 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          トップページに戻る
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-4 rounded-2xl shadow-xl">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4">
            使い方ガイド
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            自動添削システムの基本的な使い方をご紹介します
          </p>
        </div>

        {/* Content */}
        <div className="bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden border border-white/60 ring-1 ring-white/50">
          <div className="p-8 md:p-12 space-y-10">
            
            {/* Step 1 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 text-indigo-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4 font-bold text-lg">
                  1
                </div>
                <h2 className="text-2xl font-bold text-slate-800">問題番号を入力</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  採点したい問題の番号を入力します。以下の形式に対応しています：
                </p>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span><strong>大問+小問形式</strong>：問1、問2-1、問3-2など</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span><strong>小問のみ形式</strong>：(1)、(2)、(a)、(b)など</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span><strong>自由入力形式</strong>：任意の文字列（例：第一問、設問Aなど）</span>
                  </li>
                </ul>
                <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                  <p className="text-indigo-800 text-sm">
                    <strong>💡 ヒント：</strong>複数の問題を一度に採点する場合は、「まとめて追加」機能を使用すると便利です。
                  </p>
                </div>
              </div>
            </section>

            {/* Step 2 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-violet-100 text-violet-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4 font-bold text-lg">
                  2
                </div>
                <h2 className="text-2xl font-bold text-slate-800">ファイルをアップロード</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  採点に必要なファイルをアップロードします。以下のファイルタイプに対応しています：
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                    <div className="flex items-center mb-2">
                      <Image className="w-5 h-5 text-violet-600 mr-2" />
                      <strong className="text-violet-800">画像ファイル</strong>
                    </div>
                    <p className="text-violet-700 text-sm">JPEG、PNG、GIF、WebP、HEIC形式</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                    <div className="flex items-center mb-2">
                      <FileText className="w-5 h-5 text-violet-600 mr-2" />
                      <strong className="text-violet-800">PDFファイル</strong>
                    </div>
                    <p className="text-violet-700 text-sm">複数ページのPDFにも対応</p>
                  </div>
                </div>
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                  <p className="text-amber-800 text-sm">
                    <strong>⚠️ 注意：</strong>1ファイルあたり4MB以下、合計4MB以下にしてください。ファイルが大きい場合は圧縮するか、ページを分割してください。
                  </p>
                </div>
              </div>
            </section>

            {/* Step 3 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 text-blue-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4 font-bold text-lg">
                  3
                </div>
                <h2 className="text-2xl font-bold text-slate-800">ファイルの役割を指定</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  アップロードした各ファイルが何を表しているかを指定します：
                </p>
                <ul className="space-y-3 text-slate-700">
                  <li className="flex items-start">
                    <FileCheck className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>答案</strong>：生徒が書いた答案
                    </div>
                  </li>
                  <li className="flex items-start">
                    <FileCheck className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>問題</strong>：問題文
                    </div>
                  </li>
                  <li className="flex items-start">
                    <FileCheck className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>模範解答</strong>：正解例や模範解答
                    </div>
                  </li>
                  <li className="flex items-start">
                    <FileCheck className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>問題+模範解答</strong>：問題文と模範解答が一緒に写っているファイル
                    </div>
                  </li>
                </ul>
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                  <p className="text-blue-800 text-sm">
                    <strong>💡 ヒント：</strong>答案ファイルは必須です。問題や模範解答がない場合は、答案のみでも採点可能です。
                  </p>
                </div>
              </div>
            </section>

            {/* Step 4 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-green-100 text-green-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4 font-bold text-lg">
                  4
                </div>
                <h2 className="text-2xl font-bold text-slate-800">採点を実行</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  「採点開始」ボタンをクリックすると、AIによる自動採点が開始されます。
                </p>
                <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                  <h3 className="font-bold text-green-800 mb-2">採点結果には以下が含まれます：</h3>
                  <ul className="space-y-2 text-green-700">
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span>得点（％表示。配点入力時は点数も表示）</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span>良かった点のフィードバック</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span>改善のアドバイス</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span>減点ポイントの詳細</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span>満点の書き直し例</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Tips */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-amber-100 text-amber-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">便利な機能</h2>
              </div>
              <div className="pl-14 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <h3 className="font-bold text-amber-800 mb-2">再採点機能</h3>
                    <p className="text-amber-700 text-sm">
                      採点結果に納得できない場合、「もっと厳しく」または「もっと甘く」で再採点できます。初回採点後は無料で2回まで再採点可能です。
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <h3 className="font-bold text-amber-800 mb-2">PDFレポート出力</h3>
                    <p className="text-amber-700 text-sm">
                      採点結果をPDF形式でダウンロードできます。印刷して保存したり、生徒に配布したりできます。
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <h3 className="font-bold text-amber-800 mb-2">OCR結果の確認</h3>
                    <p className="text-amber-700 text-sm">
                      採点前に、AIが読み取ったテキストを確認・修正できます。誤読があれば手動で修正してから採点できます。
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <h3 className="font-bold text-amber-800 mb-2">採点の厳しさ調整</h3>
                    <p className="text-amber-700 text-sm">
                      「標準」「厳しく」「甘く」から採点の厳しさを選択できます。用途に応じて調整してください。
                    </p>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <Link
            href="/grading"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors px-6 py-3 rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

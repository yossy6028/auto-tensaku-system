'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Camera, FileText, ArrowRight, CheckCircle } from 'lucide-react';

export function RealSampleSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="real-sample" className="relative bg-gradient-to-b from-slate-50 to-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-bold tracking-widest text-es-teal uppercase">
            実際の採点結果
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            この手書き答案が、<span className="text-es-teal">ここまで読める</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            生徒が実際に書いた答案用紙をスマホで撮影。AIが文字を正確に読み取り、採点根拠を明示したレポートを自動生成します。
          </p>
        </motion.div>

        {/* Before → After */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: Handwritten answer */}
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100">
                <Camera className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-sm font-bold text-amber-700 uppercase tracking-wide">Step 1</span>
              <span className="text-sm font-semibold text-slate-700">スマホで撮影</span>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
              <Image
                src="/sample-handwritten.png"
                alt="生徒の手書き答案"
                width={815}
                height={1514}
                className="w-full h-auto"
                priority
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <p className="text-white text-sm font-medium">
                  中学受験 国語 記述問題 — 生徒の手書き答案
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right: Grading report */}
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-es-teal/10">
                <FileText className="w-4 h-4 text-es-teal" />
              </div>
              <span className="text-sm font-bold text-es-teal uppercase tracking-wide">Step 2</span>
              <span className="text-sm font-semibold text-slate-700">AIが即座に採点</span>
            </div>

            {/* Report card recreation */}
            <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
              {/* Score header */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs font-medium">問5 採点レポート</p>
                    <p className="text-white text-sm mt-1">総合スコア（100%満点）</p>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black text-white">50<span className="text-2xl text-slate-400">%</span></p>
                  </div>
                </div>
              </div>

              {/* AI読み取り結果 */}
              <div className="p-6 border-b border-slate-100">
                <p className="text-xs font-bold text-es-teal uppercase tracking-wider mb-2">AI読み取り結果</p>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    嘘つきの太郎君の言葉だったが愛国号が来ているらしい新舞子にはよく飛行機が来ていてまんざら嘘ではないと思ったから。
                  </p>
                </div>
              </div>

              {/* 減点ポイント */}
              <div className="p-6 border-b border-slate-100">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3">減点ポイント</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-12 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">-30%</span>
                    <p className="text-sm text-slate-600">「退屈していて何か出来事を望んでいた」という当時の状況・心情の要素が不足</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-12 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">-20%</span>
                    <p className="text-sm text-slate-600">「飛行機の曲芸が見られる」という目的・期待の要素が不足</p>
                  </div>
                </div>
              </div>

              {/* 良かった点 */}
              <div className="p-6 border-b border-slate-100">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">良かった点</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  太郎君の話に「新舞子によく飛行機が来る」という事実が混ざっていたため、嘘ではないと信じたという理由を的確に読み取ってまとめられています。
                </p>
              </div>

              {/* 改善アドバイス */}
              <div className="p-6 border-b border-slate-100">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">改善のアドバイス</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  彼らが「退屈していて何か面白い出来事を望んでいた」ことや、愛国号の「曲芸」が見られるという期待感を補うと、より深い解答になります。
                </p>
              </div>

              {/* 満点の書き直し例 */}
              <div className="p-6 bg-amber-50">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">満点の書き直し例</p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  退屈して何か出来事を望んでいた時に、太郎君が事実を交えて愛国号の曲芸という面白そうな話をしたため、本当だと思って見に行きたくなったから。
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Arrow connecting the two */}
        <motion.div
          className="hidden md:flex justify-center -mt-[50%] mb-[50%] relative z-10"
          initial={reducedMotion ? undefined : { opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-es-teal shadow-lg shadow-es-teal/30">
            <ArrowRight className="w-6 h-6 text-white" />
          </div>
        </motion.div>

        {/* Bottom highlights */}
        <motion.div
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {[
            { text: '手書き文字を正確にOCR認識', sub: '崩れた文字も読み取り可能' },
            { text: '減点根拠を明示', sub: '何が足りないか一目でわかる' },
            { text: '満点の模範解答を自動生成', sub: '生徒が自分で書き直せる' },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-3 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <CheckCircle className="w-5 h-5 text-es-teal shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.text}</p>
                <p className="text-xs text-slate-500 mt-1">{item.sub}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

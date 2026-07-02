'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ScanLine, CheckCircle, AlertCircle, ArrowRight, Play } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { SAMPLE_DEMO_RESULT } from '@/lib/sampleDemoResult';

type Stage = 'idle' | 'grading' | 'result';

const GRADING_STEPS = ['答案を読み取り中', '内容を分析中', '採点結果を作成中'] as const;

export function DemoSection() {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('idle');
  const [gradingStep, setGradingStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  const startGrading = () => {
    setStage('grading');
    setGradingStep(0);

    const stepDelay = reducedMotion ? 150 : 800;
    timers.current = [
      setTimeout(() => setGradingStep(1), stepDelay),
      setTimeout(() => setGradingStep(2), stepDelay * 2),
      setTimeout(() => setStage('result'), stepDelay * 3),
    ];
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStage('idle');
    setGradingStep(0);
  };

  return (
    <section id="demo" className="relative bg-es-teal-light/40 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div
          className="text-center mb-12"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-es-teal shadow-sm ring-1 ring-es-teal/20">
            <Sparkles className="h-4 w-4" />
            登録不要・10秒で見られる採点デモ
          </p>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            まずは<span className="text-es-teal">採点の流れ</span>を体験してみる
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            この手書き答案を、AIがどう採点するか。ボタンを押して確かめてください。
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          {/* Left: problem + handwritten answer */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">問題</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {SAMPLE_DEMO_RESULT.problemStatement}
            </p>
            <div className="relative mt-4 max-w-[220px] mx-auto overflow-hidden rounded-xl border border-slate-200">
              <Image
                src={SAMPLE_DEMO_RESULT.imagePath}
                alt={SAMPLE_DEMO_RESULT.imageCaption}
                width={815}
                height={1514}
                sizes="220px"
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* Right: interactive panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-h-[320px] flex flex-col">
            <AnimatePresence mode="wait">
              {stage === 'idle' && (
                <motion.div
                  key="idle"
                  className="flex flex-1 flex-col items-center justify-center py-10 text-center"
                  initial={reducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-es-teal-light">
                    <ScanLine className="h-8 w-8 text-es-teal" />
                  </div>
                  <p className="mt-4 text-sm text-slate-500">
                    左の答案をAIが採点します
                  </p>
                  <button
                    onClick={startGrading}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:-translate-y-0.5"
                  >
                    <Play className="h-5 w-5" />
                    採点する
                  </button>
                </motion.div>
              )}

              {stage === 'grading' && (
                <motion.div
                  key="grading"
                  className="flex flex-1 flex-col items-center justify-center py-10"
                  initial={reducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    {!reducedMotion && (
                      <motion.span
                        className="absolute inset-0 rounded-full border-4 border-es-teal/20 border-t-es-teal"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      />
                    )}
                    <ScanLine className="h-7 w-7 text-es-teal" />
                  </div>
                  <div className="mt-8 w-full max-w-xs space-y-3">
                    {GRADING_STEPS.map((label, i) => (
                      <div key={label} className="flex items-center gap-3">
                        {i < gradingStep ? (
                          <CheckCircle className="h-5 w-5 shrink-0 text-es-teal" />
                        ) : i === gradingStep ? (
                          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-es-teal border-t-transparent motion-safe:animate-spin" />
                        ) : (
                          <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
                        )}
                        <span
                          className={`text-sm ${
                            i <= gradingStep ? 'font-medium text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {stage === 'result' && (
                <motion.div
                  key="result"
                  className="flex-1"
                  initial={reducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <DemoResult reducedMotion={reducedMotion} onReset={reset} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          ※ 実際の答案をAIが採点した結果を、そのまま再現しています。
        </p>
      </div>
    </section>
  );
}

function DemoResult({
  reducedMotion,
  onReset,
}: {
  reducedMotion: boolean;
  onReset: () => void;
}) {
  const result = SAMPLE_DEMO_RESULT;

  const reveal = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, delay },
        };

  return (
    <div className="space-y-4">
      <motion.div
        className="flex items-center justify-between rounded-xl bg-slate-800 px-5 py-4"
        {...reveal(0)}
      >
        <div>
          <p className="text-xs font-medium text-slate-400">総合スコア（100%満点）</p>
          <p className="text-xs text-slate-500">AI採点レポート</p>
        </div>
        <p className="text-4xl font-black text-white">
          {result.totalScore}
          <span className="text-xl text-slate-400">%</span>
        </p>
      </motion.div>

      <motion.div className="grid grid-cols-3 gap-2" {...reveal(0.1)}>
        {result.axes.map((axis) => (
          <div
            key={axis.label}
            className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center"
          >
            <div className="flex items-center justify-center gap-1">
              {axis.status === 'good' ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm font-bold text-slate-700">{axis.label}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{axis.comment}</p>
          </div>
        ))}
      </motion.div>

      <motion.div {...reveal(0.2)}>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-500">減点ポイント</p>
        <div className="space-y-2">
          {result.deductions.map((d) => (
            <div key={d.reason} className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                {d.points}
              </span>
              <p className="text-sm text-slate-600">{d.reason}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className="rounded-xl bg-amber-50 p-4" {...reveal(0.3)}>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
          満点の書き直し例
        </p>
        <p className="text-sm font-medium leading-relaxed text-slate-700">
          {result.modelRewrite}
        </p>
      </motion.div>

      <motion.div className="border-t border-slate-100 pt-4" {...reveal(0.4)}>
        <Link
          href="/grading"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-es-teal px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:-translate-y-0.5"
        >
          自分の答案で試す
          <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="mt-2 text-center text-xs text-slate-500">
          無料5回・メールアドレスだけで登録1分／クレジットカード不要
        </p>
        <button
          onClick={onReset}
          className="mt-3 block w-full text-center text-xs text-slate-400 transition-colors hover:text-es-teal"
        >
          もう一度デモを見る
        </button>
      </motion.div>
    </div>
  );
}

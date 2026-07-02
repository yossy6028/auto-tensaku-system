'use client';

import { motion } from 'framer-motion';
import { Clock, ArrowRight } from 'lucide-react';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.2 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

export function TimeROISection() {
  return (
    <section id="time-roi" className="bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            記述の添削、月に<span className="text-es-teal">何時間</span>使っていますか？
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-600">
            記述答案1枚の採点と講評の記入に20分かかると仮定すると、
            月30枚で約10時間。Taskal AI なら、読み取りの確認まで含めて約1/5に短縮できます。
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid items-stretch gap-6 md:grid-cols-[1fr_auto_1fr]"
        >
          {/* 従来 */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg"
          >
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Clock className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-500">手作業での添削</p>
            <p className="mt-2 text-4xl font-bold text-slate-700 md:text-5xl">
              約10<span className="ml-1 text-2xl font-bold">時間</span>
              <span className="text-lg font-medium text-slate-400">/月</span>
            </p>
            <p className="mt-3 text-sm text-slate-500">記述30枚 × 1枚あたり約20分</p>
          </motion.div>

          {/* Arrow */}
          <motion.div
            variants={cardVariants}
            className="flex items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-es-teal/10">
              <ArrowRight className="h-6 w-6 rotate-90 text-es-teal md:rotate-0" />
            </span>
          </motion.div>

          {/* Taskal AI */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col items-center justify-center rounded-2xl border border-es-teal/20 bg-es-teal-light p-8 text-center shadow-lg"
          >
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-es-teal/10">
              <Clock className="h-7 w-7 text-es-teal" />
            </div>
            <p className="text-sm font-semibold text-es-teal-dark">Taskal AI での添削</p>
            <p className="mt-2 text-4xl font-bold text-es-teal-dark md:text-5xl">
              約2<span className="ml-1 text-2xl font-bold">時間</span>
              <span className="text-lg font-medium text-es-teal/60">/月</span>
            </p>
            <p className="mt-3 text-sm text-es-teal-dark/80">読み取りの確認まで含めて約1/5</p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-10 max-w-2xl rounded-2xl border border-es-teal/20 bg-white p-6 text-center shadow-sm md:p-8"
        >
          <p className="text-lg font-bold leading-relaxed text-slate-900 md:text-xl">
            浮くのは、月あたり約8時間。
          </p>
          <p className="mt-3 leading-relaxed text-slate-600">
            この8時間をご自身の時給に換算すると、いくら分の時間でしょうか。
            採点に追われていた時間を、生徒一人ひとりへの指導に戻せます。
          </p>
        </motion.div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          ※ 1枚あたりの添削時間・月間の枚数は試算のための仮定です。実際の時間は答案の量や内容によって変わります。
        </p>
      </div>
    </section>
  );
}

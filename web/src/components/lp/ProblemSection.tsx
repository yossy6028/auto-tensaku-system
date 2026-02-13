'use client';

import { motion } from 'framer-motion';
import { Clock, Scale, TrendingDown } from 'lucide-react';
import type { ComponentType } from 'react';

type PainPoint = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accentBg: string;
  accentText: string;
};

const painPoints: PainPoint[] = [
  {
    icon: Clock,
    title: '膨大な添削時間',
    description:
      '1クラス分の記述問題、添削に1時間以上…他の業務が圧迫されていませんか？',
    accentBg: 'bg-es-teal-light',
    accentText: 'text-es-teal',
  },
  {
    icon: Scale,
    title: '採点基準のブレ',
    description:
      '疲労や時間帯で採点が変わる…生徒への公平性に不安はありませんか？',
    accentBg: 'bg-es-blue-light',
    accentText: 'text-es-blue',
  },
  {
    icon: TrendingDown,
    title: '家庭での採点が難しい',
    description:
      '塾の記述宿題をどう採点していいかわからない…テストの解き直しで記述をどう指導すればいいか迷っていませんか？',
    accentBg: 'bg-es-dark-blue-light',
    accentText: 'text-es-dark-blue',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
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

export function ProblemSection() {
  return (
    <section id="problems" className="py-20 bg-slate-50 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            こんな<span className="text-rose-600">お悩み</span>ありませんか？
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-8 md:grid-cols-3"
        >
          {painPoints.map((point) => {
            const Icon = point.icon;
            return (
              <motion.div
                key={point.title}
                variants={cardVariants}
                className="rounded-2xl bg-white p-8 shadow-lg transition-shadow hover:shadow-xl"
              >
                <div
                  className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full ${point.accentBg}`}
                >
                  <Icon className={`h-7 w-7 ${point.accentText}`} />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">
                  {point.title}
                </h3>
                <p className="leading-relaxed text-slate-600">
                  {point.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

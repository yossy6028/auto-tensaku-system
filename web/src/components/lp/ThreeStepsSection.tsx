'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { UserPlus, Upload, CheckCircle } from 'lucide-react';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import type { ComponentType, SVGProps } from 'react';

type Step = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  number: string;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: UserPlus,
    number: '1',
    title: '無料で登録',
    description: 'メールアドレスだけで簡単登録。クレジットカードは不要です。',
  },
  {
    icon: Upload,
    number: '2',
    title: '答案をアップロード',
    description: '生徒の答案を撮影またはPDFでアップロード。問題文も一緒に登録できます。',
  },
  {
    icon: CheckCircle,
    number: '3',
    title: '添削結果を受け取る',
    description: 'AIが数分で採点。点数・改善ポイント・書き直し例をまとめて表示します。',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.2 },
  },
};

const stepVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function ThreeStepsSection() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skipAnimation = reducedMotion || isMobile;

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={skipAnimation ? { opacity: 1, y: 0 } : undefined}
          whileInView={skipAnimation ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            始め方は<span className="text-es-teal">かんたん3ステップ</span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            初回3回無料。今すぐお試しいただけます。
          </p>
        </motion.div>

        <motion.div
          className="mt-16 grid gap-8 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate={skipAnimation ? 'visible' : undefined}
          whileInView={skipAnimation ? undefined : 'visible'}
          viewport={{ once: true }}
        >
          {steps.map((step) => (
            <motion.div
              key={step.number}
              className="relative rounded-2xl border border-slate-100 bg-slate-50 p-8 text-center shadow-sm transition-shadow hover:shadow-md"
              variants={stepVariants}
            >
              {/* Step number badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-es-teal text-sm font-bold text-white shadow">
                  {step.number}
                </span>
              </div>

              {/* Icon */}
              <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-es-teal/10">
                <step.icon className="h-8 w-8 text-es-teal" />
              </div>

              <h3 className="mt-6 text-lg font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={skipAnimation ? { opacity: 1, y: 0 } : undefined}
          whileInView={skipAnimation ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link
            href="/grading"
            className="inline-flex items-center rounded-full bg-es-teal px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-es-teal/25 transition-transform hover:scale-105"
          >
            無料で始める
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

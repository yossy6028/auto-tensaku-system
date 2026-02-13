'use client';

import { motion } from 'framer-motion';
import { Camera, Sparkles, FileCheck } from 'lucide-react';
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
    icon: Camera,
    number: '1',
    title: '撮影する',
    description:
      '生徒の答案をスマホで撮影。PDFやスキャンデータにも対応。',
  },
  {
    icon: Sparkles,
    number: '2',
    title: 'AIが分析',
    description:
      'ベテラン講師のノウハウを学んだAIが内容・表現・構成を瞬時に評価。',
  },
  {
    icon: FileCheck,
    number: '3',
    title: '結果を確認',
    description:
      '点数・フィードバック・書き直し例をまとめてレポート出力。',
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

function ConnectingPath() {
  return (
    <motion.svg
      className="absolute top-16 left-0 hidden h-1 w-full lg:block"
      viewBox="0 0 1000 4"
      preserveAspectRatio="none"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
    >
      <defs>
        <linearGradient id="pathGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1565C0" />
          <stop offset="50%" stopColor="#2DB3A0" />
          <stop offset="100%" stopColor="#1565C0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 170 2 L 830 2"
        stroke="url(#pathGradient)"
        strokeWidth="3"
        strokeDasharray="8 6"
        fill="none"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 1.2, ease: 'easeInOut' as const },
          },
        }}
      />
    </motion.svg>
  );
}

export function HowItWorksSection() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skipAnimation = reducedMotion || isMobile;

  return (
    <section id="how-it-works" className="bg-es-surface-light py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.h2
          className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          animate={skipAnimation ? { opacity: 1, y: 0 } : undefined}
          whileInView={skipAnimation ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          かんたん3ステップ
        </motion.h2>

        <div className="relative mt-16">
          {!isMobile && !reducedMotion && <ConnectingPath />}

          <motion.div
            className="relative grid gap-12 md:grid-cols-3 md:gap-8"
            variants={containerVariants}
            initial="hidden"
            animate={skipAnimation ? "visible" : undefined}
            whileInView={skipAnimation ? undefined : "visible"}
            viewport={{ once: true }}
          >
            {steps.map((step) => (
              <motion.div
                key={step.number}
                className="flex flex-col items-center text-center"
                variants={stepVariants}
              >
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-sky-100" />
                  <step.icon className="relative z-10 h-12 w-12 text-es-blue" />
                  <span className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-es-blue text-sm font-bold text-white shadow-lg">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-6 text-lg font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

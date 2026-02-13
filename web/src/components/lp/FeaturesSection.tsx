'use client';

import { motion } from 'framer-motion';
import { Zap, BarChart3, Camera } from 'lucide-react';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import type { ComponentType, SVGProps } from 'react';

type Feature = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  accent: string;
};

const features: Feature[] = [
  {
    icon: Zap,
    title: '瞬時の添削',
    description:
      'わずか5分で採点完了。1クラス分の添削も、休み時間のうちに。',
    accent: 'ring-es-blue',
  },
  {
    icon: BarChart3,
    title: '詳細な3軸フィードバック',
    description:
      '内容・表現・構成の3軸で評価。生徒の弱点が一目でわかります。',
    accent: 'ring-es-dark-blue',
  },
  {
    icon: Camera,
    title: '写真を撮るだけ',
    description:
      '手書き答案をスマホで撮影するだけ。特別な機材は不要です。',
    accent: 'ring-es-teal',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function FeaturesSection() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skipAnimation = reducedMotion || isMobile;

  return (
    <section id="features" className="relative bg-es-surface-dark py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.h2
          className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl"
          initial={skipAnimation ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          3つの特長
        </motion.h2>

        <motion.div
          className="mt-16 grid gap-8 md:grid-cols-3"
          variants={skipAnimation ? undefined : containerVariants}
          initial={skipAnimation ? undefined : "hidden"}
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={skipAnimation ? undefined : cardVariants}
            >
              <div style={skipAnimation ? undefined : { perspective: 1000 }}>
                <motion.div
                  className={`flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-sm ring-1 ${feature.accent}`}
                  whileHover={
                    skipAnimation
                      ? undefined
                      : { rotateX: 5, rotateY: 5, scale: 1.05 }
                  }
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <feature.icon className="h-10 w-10 text-white" />
                  <h3 className="mt-6 text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {feature.description}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';

type Plan = {
  name: string;
  price: string;
  frequency: string;
  features: string[];
  accent: string;
  accentBorder: string;
  badge?: string;
  recommended?: boolean;
};

const plans: Plan[] = [
  {
    name: 'ライト',
    price: '¥980',
    frequency: '月10回',
    features: ['AI自動添削', '3軸評価', '写真アップロード'],
    accent: 'text-es-teal',
    accentBorder: 'border-es-teal/30',
  },
  {
    name: 'スタンダード',
    price: '¥1,980',
    frequency: '月30回',
    features: ['AI自動添削', '3軸評価', '写真アップロード', '一括添削'],
    accent: 'text-es-blue',
    accentBorder: 'border-es-blue/30',
    badge: '人気No.1',
    recommended: true,
  },
  {
    name: '無制限',
    price: '¥4,980',
    frequency: '回数無制限',
    features: [
      'AI自動添削',
      '3軸評価',
      '写真アップロード',
      '一括添削',
      '優先サポート',
    ],
    accent: 'text-es-dark-blue',
    accentBorder: 'border-es-dark-blue/30',
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

export function PricingPreview() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skipAnimation = reducedMotion || isMobile;

  return (
    <section
      id="pricing"
      className="bg-gradient-to-b from-slate-900 to-[#0D47A1] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.h2
          className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl"
          initial={skipAnimation ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          シンプルな料金プラン
        </motion.h2>

        <motion.div
          className="mt-16 grid items-center gap-8 sm:grid-cols-2 lg:grid-cols-3"
          variants={skipAnimation ? undefined : containerVariants}
          initial={skipAnimation ? undefined : "hidden"}
          whileInView="visible"
          viewport={{ once: true }}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              className={`relative ${plan.recommended ? 'z-10 md:scale-105' : ''}`}
              variants={skipAnimation ? undefined : cardVariants}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1 text-sm font-semibold text-white shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div
                className={`flex h-full flex-col rounded-2xl border p-8 backdrop-blur-sm ${plan.recommended
                    ? 'border-es-blue/50 bg-white/10 shadow-lg shadow-es-blue/20 ring-1 ring-es-blue/30'
                    : `border-white/10 bg-white/5 ${plan.accentBorder}`
                  }`}
              >
                <h3 className={`text-lg font-semibold ${plan.accent}`}>
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="ml-1 text-sm text-slate-400">/月</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{plan.frequency}</p>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-slate-300"
                    >
                      <span className={`text-xs ${plan.accent}`}>&#10003;</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.recommended ? '/pricing' : '/grading'}
                  className={`mt-8 block rounded-lg px-6 py-3 text-center text-sm font-semibold transition-all ${plan.recommended
                      ? 'bg-gradient-to-r from-es-blue to-es-teal text-white shadow-md hover:shadow-lg hover:brightness-110'
                      : 'border border-white/20 text-white hover:bg-white/10'
                    }`}
                >
                  {plan.recommended ? '無料で試す' : '無料で試す'}
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-12 text-center"
          initial={skipAnimation ? undefined : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link
            href="/pricing"
            className="text-sm font-medium text-es-teal transition-colors hover:text-es-teal/80"
          >
            詳しく見る →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

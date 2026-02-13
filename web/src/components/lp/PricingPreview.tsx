'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useReducedMotion } from '@/hooks/useMediaQuery';

type Plan = {
  name: string;
  price: string;
  frequency: string;
  features: string[];
  accent: string;
  accentBorder: string;
  badge?: string;
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
    price: '¥2,980',
    frequency: '月30回',
    features: ['AI自動添削', '3軸評価', '写真アップロード', '一括添削'],
    accent: 'text-es-blue',
    accentBorder: 'border-es-blue/30',
    badge: '人気No.1',
  },
  {
    name: '無制限',
    price: '¥5,980',
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

  return (
    <section
      id="pricing"
      className="bg-gradient-to-b from-slate-900 to-[#0D47A1] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.h2
          className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          シンプルな料金プラン
        </motion.h2>

        <motion.div
          className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
          variants={reducedMotion ? undefined : containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              className="relative"
              variants={reducedMotion ? undefined : cardVariants}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2">
                  <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-1 text-sm font-semibold text-white shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div
                className={`flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm ${plan.accentBorder}`}
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
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-12 text-center"
          initial={reducedMotion ? undefined : { opacity: 0 }}
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

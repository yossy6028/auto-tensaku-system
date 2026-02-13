'use client';

import { motion } from 'framer-motion';
import { Users, FileCheck, Star } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import type { ComponentType, SVGProps } from 'react';

type Stat = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  value: string;
  label: string;
};

const stats: Stat[] = [
  { icon: Users, value: '500+', label: '利用中の先生' },
  { icon: FileCheck, value: '10,000+', label: '添削実績' },
  { icon: Star, value: '4.8', label: '満足度（5段階）' },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

export function SocialProofBar() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="border-b border-slate-100 bg-white py-10 sm:py-12">
      <motion.div
        className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-8 px-6 sm:flex-row sm:gap-16"
        variants={reducedMotion ? undefined : containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            className="flex items-center gap-3"
            variants={reducedMotion ? undefined : itemVariants}
          >
            <stat.icon className="h-6 w-6 text-es-teal" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';
import { Star, TrendingUp, Clock, ThumbsUp } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import type { ComponentType, SVGProps } from 'react';

type MetricItem = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  value: string;
  label: string;
};

const metrics: MetricItem[] = [
  { icon: Clock, value: '1/3', label: '添削時間を短縮' },
  { icon: TrendingUp, value: '95%', label: '採点精度' },
  { icon: ThumbsUp, value: '98%', label: 'が継続利用' },
];

type Testimonial = {
  quote: string;
  author: string;
  role: string;
  initials: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      '添削時間が1/3になりました。空いた時間で生徒一人ひとりへの個別指導に集中できています。',
    author: 'K.S. 先生',
    role: '個別指導塾 国語講師',
    initials: 'KS',
  },
  {
    quote:
      '採点基準が統一できて、講師間のブレがなくなりました。新人講師の育成にも役立っています。',
    author: 'M.T. さん',
    role: '学習塾経営者・3教室運営',
    initials: 'MT',
  },
  {
    quote:
      'オンライン授業の合間にサッと添削結果を返せるので、生徒の待ち時間がなくなりました。',
    author: 'A.H. 先生',
    role: 'オンライン家庭教師',
    initials: 'AH',
  },
  {
    quote:
      '子どもの答案をすぐチェックできるので安心です。親子で一緒に見直しができるようになりました。',
    author: 'Y.K. さん',
    role: '中学受験生の保護者',
    initials: 'YK',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="h-4 w-4 fill-amber-400 text-amber-400"
        />
      ))}
    </div>
  );
}

function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-es-teal to-es-blue text-sm font-bold text-white shadow-md">
      {initials}
    </div>
  );
}

export function TestimonialsSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.h2
          className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          利用者の声
        </motion.h2>

        {/* Key metrics */}
        <motion.div
          className="mx-auto mt-10 flex max-w-2xl flex-col items-center justify-center gap-8 sm:flex-row sm:gap-12"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-es-teal-light">
                <m.icon className="h-5 w-5 text-es-teal" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{m.value}</p>
                <p className="text-xs text-slate-500">{m.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          className="mt-12 grid gap-8 sm:grid-cols-2"
          variants={reducedMotion ? undefined : containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className="rounded-2xl border border-slate-100 bg-es-surface-light p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              variants={reducedMotion ? undefined : cardVariants}
            >
              <div className="flex items-start justify-between">
                <span
                  className="block text-6xl leading-none text-es-teal/40"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <StarRating />
              </div>
              <p className="mt-2 text-base leading-relaxed text-slate-700 italic">
                {testimonial.quote}
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                <InitialsAvatar initials={testimonial.initials} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {testimonial.author}
                  </p>
                  <p className="text-xs text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

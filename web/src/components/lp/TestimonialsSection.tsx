'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useMediaQuery';

type Testimonial = {
  quote: string;
  author: string;
  role: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      '添削時間が1/10になりました。その分、生徒との面談に時間を使えています。',
    author: '利用者の声',
    role: '',
  },
  {
    quote:
      '採点基準が統一されて、生徒からの"不公平"という声がなくなりました。',
    author: '利用者の声',
    role: '',
  },
  {
    quote:
      '手書き答案の写真を撮るだけなので、ITが苦手な私でも簡単に使えます。',
    author: '利用者の声',
    role: '',
  },
  {
    quote:
      '深夜の添削作業から解放されました。もっと早く出会いたかったです。',
    author: '利用者の声',
    role: '',
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

export function TestimonialsSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-slate-50 py-24 sm:py-32">
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

        <motion.div
          className="mt-16 grid gap-8 sm:grid-cols-2"
          variants={reducedMotion ? undefined : containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              className="rounded-2xl bg-white p-6 shadow-md"
              variants={reducedMotion ? undefined : cardVariants}
            >
              <span
                className="block text-6xl leading-none text-es-teal/30"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <p className="mt-2 text-base leading-relaxed text-slate-700 italic">
                {testimonial.quote}
              </p>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-900">
                  {testimonial.author}
                </p>
                <p className="text-xs text-slate-500">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

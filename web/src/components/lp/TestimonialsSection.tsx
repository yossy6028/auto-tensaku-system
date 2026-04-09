'use client';

import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { useReducedMotion } from '@/hooks/useMediaQuery';

export function TestimonialsSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-es-teal-light">
            <Users className="h-8 w-8 text-es-teal" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            先生方のフィードバックを募集中
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            現在、塾講師・家庭教師の先生方にご協力いただける<br className="hidden sm:inline" />
            ベータモニターを募集しています。<br />
            <span className="font-semibold text-slate-800">3ヶ月間無料</span>でスタンダードプランをご利用いただけます。
          </p>
          <div className="mt-8">
            <Link
              href="/grading"
              className="inline-flex items-center justify-center rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5"
            >
              無料でモニター体験する
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

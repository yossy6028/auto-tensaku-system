'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

const beforeItems = [
  '1問あたり5〜10分かかる',
  '担当者によって採点基準がブレる',
  '疲労で質が低下',
  'フィードバックが画一的',
];

const afterItems = [
  'わずか5分で添削完了',
  'AI基準で一貫した評価',
  'いつでも安定した品質',
  '3軸の詳細フィードバック',
];

export function SolutionSection() {
  return (
    <section
      id="solution"
      className="py-20 bg-gradient-to-br from-sky-50 to-teal-50 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            EduShift AIが、添削の
            <span className="text-es-blue">常識を変えます</span>
          </h2>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Before card */}
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="rounded-2xl border border-red-200 bg-red-50/70 p-8 shadow-lg"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-red-800">従来の添削</h3>
            </div>
            <ul className="space-y-4">
              {beforeItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <X className="h-4 w-4 text-red-500" />
                  </span>
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* After card */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="rounded-2xl border border-green-200 bg-green-50/70 p-8 shadow-lg"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-green-800">EduShift AI</h3>
            </div>
            <ul className="space-y-4">
              {afterItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-4 w-4 text-green-500" />
                  </span>
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

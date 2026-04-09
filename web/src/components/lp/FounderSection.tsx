'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { BookOpen, Award, Users } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';

export function FounderSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            開発者について
          </h2>
        </motion.div>

        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl bg-white p-8 shadow-lg sm:p-10"
        >
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-full shadow-lg ring-4 ring-white">
              <Image
                src="/founder.png"
                alt="吉井 勝彦"
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>

            <div className="text-center sm:text-left">
              <h3 className="text-2xl font-bold text-slate-900">
                吉井 勝彦
              </h3>
              <p className="mt-1 text-sm font-medium text-es-teal">
                EduShift 代表 / 中学受験専門 国語講師
              </p>

              <div className="mt-4 space-y-3 leading-relaxed text-slate-700">
                <p>
                  大手進学塾で20年以上、教室長・管理職を歴任。現在は独立し、Zoomを使った中学受験国語のオンライン家庭教師として、小4〜小6の生徒をマンツーマンで指導しています。
                </p>
                <p>
                  国語の指導で最も負担になるのが添削指導です。授業が終わった後に夜遅くまで、一人ひとりの記述問題をどのように直せばよいか、それぞれの思考の癖を踏まえながらアドバイスを書いていく。大変時間がかかり、添削の在り方には個人差があるため、なかなか他人に依頼することも難しい作業でした。
                </p>
                <p>
                  しかし、記述力を高める上で添削指導は欠かせません。子どもたちの記述力を高めるには、少しずつ木をカンナで磨き上げるように、一歩一歩修正していく根気のいる作業です。これを安定的かつ高精度で行えないか――それが、Taskal AI の開発動機です。
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-4 sm:justify-start">
                <div className="flex items-center gap-2 rounded-full bg-es-teal-light px-4 py-2">
                  <BookOpen className="h-4 w-4 text-es-teal" />
                  <span className="text-sm font-medium text-es-teal">指導歴20年超</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-es-blue-light px-4 py-2">
                  <Award className="h-4 w-4 text-es-blue" />
                  <span className="text-sm font-medium text-es-blue">大手進学塾 教室長経験</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-600">中学受験 国語専門</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

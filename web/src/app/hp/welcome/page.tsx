'use client';

import { motion } from 'framer-motion';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import {
  BookOpen, Brain, Zap, ChevronDown, CheckCircle,
  Users, Star, Target, Lightbulb, MessageCircle,
  MapPin, Shield, Rocket,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function WelcomeHP() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skip = reducedMotion || isMobile;

  return (
    <main className="overflow-x-hidden bg-white">
      {/* ── ヘッダー ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-blue-800">個別指導ウェルカム</span>
          <div className="hidden items-center gap-6 md:flex">
            {['特長', 'プログラム', 'コース', 'お問い合わせ'].map((l) => (
              <a key={l} href={`#${l}`} className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">{l}</a>
            ))}
          </div>
          <a href="#お問い合わせ" className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 transition">
            お問い合わせ
          </a>
        </nav>
      </header>

      {/* ── ヒーロー ── */}
      <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 pt-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={skip ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p className="mb-4 inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-semibold text-blue-700">
              山形市 ｜ 個別指導 + 独自プログラム
            </p>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl md:text-6xl">
              学力×<span className="text-blue-600">人間力</span>を<br />
              同時に伸ばす。
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 leading-relaxed">
              7つの習慣J&reg;・速読解など独自プログラムを取り入れた個別指導塾。
              学力向上だけでなく、自ら考え行動できる力を育てます。
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a href="#お問い合わせ" className="inline-flex items-center justify-center rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                無料体験を申し込む
              </a>
              <a href="#特長" className="inline-flex items-center justify-center rounded-full border-2 border-blue-600 px-8 py-4 text-lg font-bold text-blue-700 hover:bg-blue-50 transition-all">
                特長を見る
              </a>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
              <ChevronDown className="h-8 w-8 text-slate-400" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 独自プログラム ── */}
      <section id="プログラム" className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            className="mb-4 text-center text-3xl font-bold text-slate-900 sm:text-4xl"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            他にはない<span className="text-blue-600">独自プログラム</span>
          </motion.h2>
          <motion.p
            className="mb-16 text-center text-slate-600"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            学力だけでなく、社会で活きる力を育てるプログラムを導入しています。
          </motion.p>
          <motion.div
            className="grid gap-8 md:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                icon: Shield,
                title: '7つの習慣J®',
                desc: '世界的ベストセラー「7つの習慣」を子ども向けにアレンジ。主体性・目標設定・協調性など、人間力の土台を築きます。',
                color: 'bg-indigo-100 text-indigo-600',
              },
              {
                icon: Zap,
                title: '速読解力講座',
                desc: '読むスピードと理解力を同時にトレーニング。全教科の学力底上げにつながる「読む力」を鍛えます。',
                color: 'bg-sky-100 text-sky-600',
              },
              {
                icon: Brain,
                title: '思考力養成',
                desc: '論理的思考力・問題解決力を養うオリジナルカリキュラム。受験だけでなく将来に活きる力を育成します。',
                color: 'bg-violet-100 text-violet-600',
              },
            ].map((p) => (
              <motion.div key={p.title} variants={fadeUp} className="rounded-2xl bg-slate-50 p-8 border border-slate-200 hover:shadow-lg transition-shadow">
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${p.color}`}>
                  <p.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{p.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 特長 ── */}
      <section id="特長" className="bg-gradient-to-b from-blue-50 to-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold text-slate-900 sm:text-4xl"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            ウェルカムが選ばれる<span className="text-blue-600">理由</span>
          </motion.h2>
          <motion.div
            className="grid gap-8 sm:grid-cols-2"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                icon: Target,
                title: '個別指導 × コンサル体制',
                desc: '一人ひとりの目標に合わせた個別指導に加え、定期的な面談で学習計画を見直し、常に最適な学びを提供します。',
              },
              {
                icon: Lightbulb,
                title: '独自の差別化プログラム',
                desc: '7つの習慣J®や速読解など、他の塾にはないプログラムで「学力＋人間力」のバランスの取れた成長を実現します。',
              },
              {
                icon: Users,
                title: '少人数制で手厚いサポート',
                desc: '一人ひとりに目が行き届く少人数制。質問しやすい環境で、苦手を克服し得意を伸ばします。',
              },
              {
                icon: Rocket,
                title: '自立学習の習慣づくり',
                desc: '「教えてもらう」だけでなく「自分で学ぶ力」を育成。将来にわたって活きる学習習慣を身につけます。',
              },
            ].map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="flex gap-4 rounded-2xl bg-white p-6 shadow-md border border-blue-100">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <f.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── コース案内 ── */}
      <section id="コース" className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-6">
          <motion.h2
            className="mb-12 text-center text-3xl font-bold text-slate-900"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            コース・料金
          </motion.h2>
          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                title: '個別指導コース',
                desc: '1対1〜1対3の個別指導。全教科対応。',
                features: ['定期テスト対策', '受験対策', '苦手克服'],
                color: 'border-blue-200 bg-blue-50',
                accent: 'text-blue-700',
              },
              {
                title: '7つの習慣J®コース',
                desc: '人間力を育てるリーダーシッププログラム。',
                features: ['主体性の育成', '目標設定力', 'コミュニケーション力'],
                color: 'border-indigo-200 bg-indigo-50',
                accent: 'text-indigo-700',
              },
              {
                title: '速読解力コース',
                desc: '読む速さと正確さを同時にトレーニング。',
                features: ['読解速度UP', '全教科の底上げ', '集中力向上'],
                color: 'border-sky-200 bg-sky-50',
                accent: 'text-sky-700',
              },
            ].map((c) => (
              <motion.div key={c.title} variants={fadeUp} className={`rounded-2xl border p-6 ${c.color}`}>
                <h3 className={`text-xl font-bold ${c.accent}`}>{c.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{c.desc}</p>
                <ul className="mt-4 space-y-2">
                  {c.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className={`h-4 w-4 shrink-0 ${c.accent}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
          <motion.p
            className="mt-8 text-center text-sm text-slate-500"
            initial={skip ? undefined : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            ※料金の詳細はお問い合わせください。無料体験授業も随時受付中です。
          </motion.p>
        </div>
      </section>

      {/* ── 利用の流れ ── */}
      <section className="bg-blue-50 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold text-slate-900"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            入塾までの流れ
          </motion.h2>
          <motion.div
            className="space-y-8"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { step: '01', title: 'お問い合わせ', desc: 'お電話またはフォームでご連絡ください。' },
              { step: '02', title: 'カウンセリング', desc: 'お子さまの現状・目標をじっくりヒアリング。最適なプランをご提案します。' },
              { step: '03', title: '無料体験授業', desc: '実際の授業を体験いただけます。独自プログラムもお試し可能です。' },
              { step: '04', title: '入塾・スタート', desc: 'ご納得いただけましたら入塾手続きへ。一緒に目標に向かいましょう！' },
            ].map((s) => (
              <motion.div key={s.step} variants={fadeUp} className="flex gap-6 items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── お問い合わせ CTA ── */}
      <section id="お問い合わせ" className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h2
            className="mb-4 text-3xl font-bold text-white sm:text-4xl"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            まずはお気軽にお問い合わせください
          </motion.h2>
          <motion.p
            className="mb-10 text-blue-200"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            無料体験授業・カウンセリング 受付中！
          </motion.p>
          <motion.div
            className="space-y-4"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <a
              href="https://shunichi0214.wixsite.com/welcome"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-lg font-bold text-blue-800 shadow-lg hover:bg-blue-50 transition mx-auto max-w-md"
            >
              <MessageCircle className="h-6 w-6" />
              お問い合わせフォームへ
            </a>
            <div className="flex items-center justify-center gap-4 text-blue-200 text-sm pt-4">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />山形市</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="bg-slate-900 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} 個別指導ウェルカム. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

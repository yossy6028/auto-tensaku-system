'use client';

import { motion } from 'framer-motion';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import {
  BookOpen, Users, MapPin, ChevronDown, CheckCircle,
  Clock, Star, Sparkles, GraduationCap, Heart, Building2,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function NaraiyaHP() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skip = reducedMotion || isMobile;

  return (
    <main className="overflow-x-hidden bg-white">
      {/* ── ヘッダー ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-orange-700">ならいや 前田塾</span>
          <div className="hidden items-center gap-6 md:flex">
            {['特長', 'コース', '教室案内', '料金', 'お問い合わせ'].map((l) => (
              <a key={l} href={`#${l}`} className="text-sm font-medium text-slate-600 hover:text-orange-600 transition-colors">{l}</a>
            ))}
          </div>
          <a href="#お問い合わせ" className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow hover:bg-orange-600 transition">
            お問い合わせ
          </a>
        </nav>
      </header>

      {/* ── ヒーロー ── */}
      <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 pt-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={skip ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p className="mb-4 inline-block rounded-full bg-orange-100 px-4 py-1 text-sm font-semibold text-orange-700">
              三重県松阪市 ｜ 2022年開校
            </p>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl md:text-6xl">
              一人ひとりの<br />
              <span className="text-orange-600">「わかった！」</span>を<br />
              大切にする塾。
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 leading-relaxed">
              小学1年生から高校3年生まで対応。
              兄弟割引あり・2025年には2校目も開校予定。
              地域に根ざした丁寧な指導で、お子さまの成長を支えます。
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a href="#お問い合わせ" className="inline-flex items-center justify-center rounded-full bg-orange-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 hover:-translate-y-0.5 transition-all">
                無料体験を申し込む
              </a>
              <a href="#特長" className="inline-flex items-center justify-center rounded-full border-2 border-orange-500 px-8 py-4 text-lg font-bold text-orange-600 hover:bg-orange-50 transition-all">
                塾の特長を見る
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

      {/* ── 数字で見るならいや ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            className="grid gap-8 sm:grid-cols-4"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { num: '2022年', label: '開校', icon: Sparkles },
              { num: '小1〜高3', label: '対象学年', icon: GraduationCap },
              { num: '2校', label: '教室展開（2025年〜）', icon: Building2 },
              { num: 'あり', label: '兄弟割引', icon: Heart },
            ].map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="flex flex-col items-center rounded-2xl border border-orange-100 bg-orange-50/50 p-6 text-center">
                <s.icon className="h-9 w-9 text-orange-500 mb-2" />
                <p className="text-2xl font-extrabold text-orange-700">{s.num}</p>
                <p className="mt-1 text-xs text-slate-600">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 特長 ── */}
      <section id="特長" className="bg-gradient-to-b from-white to-orange-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold text-slate-900 sm:text-4xl"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            ならいやが選ばれる<span className="text-orange-600">3つの理由</span>
          </motion.h2>
          <motion.div
            className="grid gap-8 md:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                icon: BookOpen,
                title: '一人ひとりに合わせた指導',
                desc: 'お子さまの理解度・ペースに合わせた個別カリキュラム。「わからない」を「わかった！」に変える丁寧な指導です。',
              },
              {
                icon: Users,
                title: '兄弟割引で家計にやさしい',
                desc: 'ご兄弟で通塾される場合は割引を適用。複数のお子さまの学びを応援します。',
              },
              {
                icon: Star,
                title: '成長中の活気ある教室',
                desc: '2022年の開校から着実に成長し、2024年に移転拡大、2025年には2校目を開校予定。勢いのある環境で学べます。',
              },
            ].map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="rounded-2xl bg-white p-8 shadow-lg shadow-orange-100/50 border border-orange-100">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100">
                  <f.icon className="h-7 w-7 text-orange-500" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
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
            コース案内
          </motion.h2>
          <motion.div
            className="grid gap-6 sm:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                title: '小学生コース',
                grades: '小1〜小6',
                color: 'bg-amber-50 border-amber-200',
                accent: 'text-amber-700',
                items: ['学校の授業フォロー', '中学受験対策', '学習習慣づくり'],
              },
              {
                title: '中学生コース',
                grades: '中1〜中3',
                color: 'bg-orange-50 border-orange-200',
                accent: 'text-orange-700',
                items: ['定期テスト対策', '高校受験対策', '内申点アップ'],
              },
              {
                title: '高校生コース',
                grades: '高1〜高3',
                color: 'bg-red-50 border-red-200',
                accent: 'text-red-700',
                items: ['大学受験対策', '定期テスト対策', '推薦・AO対策'],
              },
            ].map((c) => (
              <motion.div key={c.title} variants={fadeUp} className={`rounded-2xl border p-6 ${c.color}`}>
                <h3 className={`text-xl font-bold ${c.accent}`}>{c.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{c.grades}</p>
                <ul className="mt-4 space-y-2">
                  {c.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className={`h-4 w-4 shrink-0 ${c.accent}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 教室案内 ── */}
      <section id="教室案内" className="bg-orange-50 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.h2
            className="mb-12 text-center text-3xl font-bold text-slate-900"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            教室案内
          </motion.h2>
          <motion.div
            className="grid gap-6 sm:grid-cols-2"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { name: '本校（松阪市）', status: '2024年移転・拡大リニューアル', open: true },
              { name: '第2校', status: '2025年 開校予定', open: false },
            ].map((school) => (
              <motion.div key={school.name} variants={fadeUp} className="rounded-2xl bg-white p-6 shadow-md border border-orange-100">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="h-6 w-6 text-orange-500" />
                  <h3 className="text-lg font-bold text-slate-900">{school.name}</h3>
                </div>
                <p className="text-sm text-slate-600">{school.status}</p>
                <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${school.open ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {school.open ? '開校中' : '準備中'}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 利用の流れ ── */}
      <section className="bg-white py-24">
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
              { step: '01', title: 'お問い合わせ', desc: 'フォームまたはお電話でお気軽にご連絡ください。' },
              { step: '02', title: '面談・教室見学', desc: 'お子さまの状況をヒアリングし、最適なコースをご提案します。' },
              { step: '03', title: '無料体験授業', desc: '実際の授業を体験。お子さまに合うかどうかをご確認いただけます。' },
              { step: '04', title: '入塾・指導開始', desc: 'ご納得いただけましたら入塾手続きへ。一緒にがんばりましょう！' },
            ].map((s) => (
              <motion.div key={s.step} variants={fadeUp} className="flex gap-6 items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white">
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

      {/* ── 料金 ── */}
      <section id="料金" className="bg-orange-50 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h2
            className="mb-6 text-3xl font-bold text-slate-900"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            料金のご案内
          </motion.h2>
          <motion.div
            className="rounded-2xl border-2 border-orange-200 bg-white p-8"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <p className="mb-6 text-lg text-slate-700">
              学年・コースに応じた<span className="font-bold text-orange-600">明瞭な料金体系</span>です。
            </p>
            <div className="mb-6 space-y-2 text-left">
              {[
                '入塾金は初回のみ',
                '兄弟割引あり',
                '教材費込みのシンプルな月謝制',
                '無料体験授業あり',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-500 shrink-0" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              ※詳細な料金はコース・学年により異なります。お気軽にお問い合わせください。
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── お問い合わせ CTA ── */}
      <section id="お問い合わせ" className="bg-gradient-to-br from-orange-600 via-orange-700 to-amber-800 py-24">
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
            className="mb-10 text-orange-200"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            無料体験授業・教室見学 受付中！
          </motion.p>
          <motion.div
            className="space-y-4"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <a
              href="https://naraiya0326.wixsite.com/-site"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-lg font-bold text-orange-700 shadow-lg hover:bg-orange-50 transition mx-auto max-w-md"
            >
              <BookOpen className="h-6 w-6" />
              お問い合わせフォームへ
            </a>
            <div className="flex items-center justify-center gap-4 text-orange-200 text-sm pt-4">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />三重県松阪市</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer className="bg-slate-900 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} ならいや 前田塾. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

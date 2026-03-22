'use client';

import { motion } from 'framer-motion';
import { useReducedMotion, useIsMobile } from '@/hooks/useMediaQuery';
import {
  BookOpen, GraduationCap, Heart, Phone, Mail, MapPin,
  CheckCircle, Star, Users, Clock, ChevronDown, MessageCircle,
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function SuzukiHP() {
  const reducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const skip = reducedMotion || isMobile;

  return (
    <main className="overflow-x-hidden bg-white">
      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-emerald-800">プロ家庭教師 鈴木雄太</span>
          <div className="hidden items-center gap-6 md:flex">
            {['特長', '実績', '対応', '料金', 'お問い合わせ'].map((l) => (
              <a key={l} href={`#${l}`} className="text-sm font-medium text-slate-600 hover:text-emerald-700 transition-colors">{l}</a>
            ))}
          </div>
          <a href="#お問い合わせ" className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 transition">
            無料相談
          </a>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={skip ? undefined : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-1 text-sm font-semibold text-emerald-700">
              千葉県野田市 ｜ 個人契約の家庭教師
            </p>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl md:text-6xl">
              指導歴<span className="text-emerald-600">16年</span>、<br />
              <span className="text-emerald-600">900名</span>以上の実績。
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 leading-relaxed">
              お子さま一人ひとりに合わせたオーダーメイド指導で、
              学力だけでなく学ぶ力そのものを育てます。
              不登校のお子さまにも安心してご利用いただけます。
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <a href="#お問い合わせ" className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all">
                無料相談を申し込む
              </a>
              <a href="#特長" className="inline-flex items-center justify-center rounded-full border-2 border-emerald-600 px-8 py-4 text-lg font-bold text-emerald-700 hover:bg-emerald-50 transition-all">
                詳しく見る
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

      {/* ── 数字で見る実績 ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            className="grid gap-8 sm:grid-cols-3"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { num: '16年', label: '指導歴', icon: Clock },
              { num: '900名+', label: '指導実績', icon: Users },
              { num: '明治大卒', label: '学歴', icon: GraduationCap },
            ].map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-emerald-50/50 p-8 text-center">
                <s.icon className="h-10 w-10 text-emerald-600 mb-3" />
                <p className="text-3xl font-extrabold text-emerald-700">{s.num}</p>
                <p className="mt-1 text-sm text-slate-600">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 特長 ── */}
      <section id="特長" className="bg-gradient-to-b from-white to-emerald-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold text-slate-900 sm:text-4xl"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            選ばれる<span className="text-emerald-600">3つの理由</span>
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
                title: '完全オーダーメイド指導',
                desc: 'お子さまの学力・性格・目標に合わせて、教材・進度・指導法をすべてカスタマイズ。画一的なカリキュラムでは得られない成長を実現します。',
              },
              {
                icon: Heart,
                title: '不登校・学び直し対応',
                desc: '不登校のお子さまの学習再開をサポート。心理的な安心感を大切にしながら、学校復帰や受験に向けた学力を着実に積み上げます。',
              },
              {
                icon: Star,
                title: '個人契約で安心の料金',
                desc: '仲介業者を挟まない個人契約だから、高品質な指導を適正価格で。指導料は明確で、追加の教材費等は一切かかりません。',
              },
            ].map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="rounded-2xl bg-white p-8 shadow-lg shadow-emerald-100/50 border border-emerald-100">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100">
                  <f.icon className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 対応科目・学年 ── */}
      <section id="対応" className="bg-white py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.h2
            className="mb-12 text-center text-3xl font-bold text-slate-900"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            対応科目・学年
          </motion.h2>
          <motion.div
            className="grid gap-6 sm:grid-cols-2"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { title: '小学生', items: ['国語', '算数', '理科', '社会', '英語'] },
              { title: '中学生', items: ['国語', '数学', '英語', '理科', '社会'] },
              { title: '高校生', items: ['現代文', '古文', '漢文', '英語', '数学'] },
              { title: 'その他', items: ['不登校サポート', '学び直し', '受験対策', '定期テスト対策', '小論文'] },
            ].map((g) => (
              <motion.div key={g.title} variants={fadeUp} className="rounded-xl border border-slate-200 p-6">
                <h3 className="mb-3 text-lg font-bold text-emerald-700">{g.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((item) => (
                    <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700 border border-emerald-200">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 指導の流れ ── */}
      <section className="bg-emerald-50 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.h2
            className="mb-16 text-center text-3xl font-bold text-slate-900"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            ご利用の流れ
          </motion.h2>
          <motion.div
            className="space-y-8"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { step: '01', title: '無料相談', desc: 'メールまたはお電話にてお気軽にご連絡ください。お子さまの状況やご希望をお聞きします。' },
              { step: '02', title: '体験授業', desc: '実際の授業を無料で体験いただけます。お子さまとの相性もご確認ください。' },
              { step: '03', title: 'カリキュラム作成', desc: 'お子さまに最適な指導計画を作成します。目標・ペースをご一緒に決めましょう。' },
              { step: '04', title: '指導開始', desc: '定期的な指導がスタート。進捗に合わせて柔軟にカリキュラムを調整します。' },
            ].map((s) => (
              <motion.div key={s.step} variants={fadeUp} className="flex gap-6 items-start">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
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
      <section id="料金" className="bg-white py-24">
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
            className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-8"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <p className="mb-4 text-lg text-slate-700">
              個人契約のため、一般的な家庭教師派遣会社よりも<span className="font-bold text-emerald-700">お得な料金設定</span>です。
            </p>
            <div className="mb-6 space-y-2 text-left">
              {[
                '入会金・教材費なし',
                '月謝制（指導回数×1回あたりの料金）',
                '交通費は実費のみ',
                '体験授業は無料',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              ※具体的な料金は、学年・科目・指導回数により異なります。お気軽にお問い合わせください。
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── お問い合わせ ── */}
      <section id="お問い合わせ" className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h2
            className="mb-4 text-3xl font-bold text-white sm:text-4xl"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            まずはお気軽にご相談ください
          </motion.h2>
          <motion.p
            className="mb-10 text-emerald-200"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            無料体験授業も受付中です
          </motion.p>
          <motion.div
            className="space-y-4"
            initial={skip ? undefined : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <a
              href="mailto:k0nan728@icloud.com"
              className="flex items-center justify-center gap-3 rounded-xl bg-white px-8 py-4 text-lg font-bold text-emerald-800 shadow-lg hover:bg-emerald-50 transition mx-auto max-w-md"
            >
              <Mail className="h-6 w-6" />
              メールで問い合わせ
            </a>
            <div className="flex items-center justify-center gap-6 text-emerald-200 text-sm pt-4">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />千葉県野田市</span>
              <span className="flex items-center gap-2"><Mail className="h-4 w-4" />k0nan728@icloud.com</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} プロ家庭教師 鈴木雄太. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin, ExternalLink } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const hpList = [
  {
    slug: 'suzuki',
    name: 'プロ家庭教師 鈴木雄太',
    location: '千葉県野田市',
    description: '指導歴16年・900名超の実績。個人契約・不登校対応・明治大卒。完全オーダーメイドの家庭教師。',
    color: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-200 hover:border-emerald-400',
    tag: '家庭教師',
    tagColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    slug: 'naraiya',
    name: 'ならいや 前田塾',
    location: '三重県松阪市',
    description: '2022年開校、小1〜高3対応。兄弟割引あり。2024年移転拡大、2025年には2校目を開校予定の成長中の個人塾。',
    color: 'from-orange-500 to-amber-600',
    border: 'border-orange-200 hover:border-orange-400',
    tag: '学習塾',
    tagColor: 'bg-orange-100 text-orange-700',
  },
  {
    slug: 'welcome',
    name: '個別指導ウェルカム',
    location: '山形市',
    description: '7つの習慣J®・速読解など独自プログラム導入。個別指導+コンサル体制で学力×人間力を同時に伸ばす。',
    color: 'from-blue-500 to-indigo-600',
    border: 'border-blue-200 hover:border-blue-400',
    tag: '個別指導塾',
    tagColor: 'bg-blue-100 text-blue-700',
  },
];

export default function HPIndexPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 transition">
            &larr; トップへ戻る
          </Link>
          <span className="text-sm font-medium text-slate-700">HP制作実績</span>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="mx-auto max-w-5xl px-6 py-20">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            HPリニューアル実績
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            教育事業者さま向けに制作したホームページのリニューアル事例をご紹介します。
          </p>
        </motion.div>

        <motion.div
          className="grid gap-8 md:grid-cols-1 lg:grid-cols-1"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {hpList.map((hp) => (
            <motion.div key={hp.slug} variants={fadeUp}>
              <Link
                href={`/hp/${hp.slug}`}
                className={`block rounded-2xl border-2 bg-white p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 ${hp.border}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${hp.tagColor}`}>
                        {hp.tag}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />
                        {hp.location}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{hp.name}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{hp.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 sm:mt-2">
                    <span>HPを見る</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
                {/* カラーバー */}
                <div className={`mt-6 h-1.5 rounded-full bg-gradient-to-r ${hp.color}`} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* フッター */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} EduShift HP制作サービス
          </p>
        </div>
      </footer>
    </main>
  );
}

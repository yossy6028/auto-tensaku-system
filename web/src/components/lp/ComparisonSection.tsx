'use client';

import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';

type Row = {
  feature: string;
  taskal: string;
  generic: string;
};

const rows: Row[] = [
  {
    feature: '手書き答案の読み取り（マス目対応OCR）',
    taskal: 'マス目の答案用紙を前提に読み取り。結果を画面で確認できます。',
    generic:
      '画像の読み取りはできますが、マス目答案に最適化されておらず、読み違いを確認・修正する仕組みはありません。',
  },
  {
    feature: '採点基準の固定と観点別評価（内容・表現・構成）',
    taskal: '観点別の採点基準を固定し、毎回同じものさしで評価します。',
    generic:
      '毎回プロンプトで基準を指定する必要があり、同じ指示でも評価がぶれやすくなります。',
  },
  {
    feature: '減点理由と満点の書き直し例',
    taskal: 'どこで何点引かれたかと、満点の書き直し例をセットで返します。',
    generic:
      '指示すれば出せますが、書式や説明の細かさは回答ごとにばらつきます。',
  },
  {
    feature: '読み取りテキストの確認・修正と無料再採点',
    taskal: '読み取り結果を直してから、追加費用なしで採点し直せます。',
    generic:
      '読み取りを直して採点をやり直す、という決まった流れはありません。',
  },
  {
    feature: '印刷用レポート出力',
    taskal: '点数・講評・書き直し例を、そのまま印刷できる形で出力します。',
    generic: '配布できる形に整えるには、自分で整形する手間がかかります。',
  },
  {
    feature: 'プロンプト設計不要',
    taskal: '答案をアップロードするだけ。指示文を書く必要はありません。',
    generic: '狙った結果を得るには、プロンプトを工夫することが前提になります。',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export function ComparisonSection() {
  return (
    <section id="comparison" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            「ChatGPTで十分では？」への<span className="text-es-blue">答え</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-600">
            汎用AIでも工夫すれば近いことはできます。違いは、記述採点のために
            はじめから作り込まれているかどうかです。正直に並べます。
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg"
        >
          {/* Header row (desktop only) */}
          <div className="hidden bg-slate-50 md:grid md:grid-cols-[1.3fr_1.4fr_1.6fr]">
            <div className="px-6 py-4 text-sm font-bold text-slate-500">機能</div>
            <div className="border-l border-slate-200 bg-es-teal-light px-6 py-4 text-sm font-bold text-es-teal-dark">
              Taskal AI
            </div>
            <div className="border-l border-slate-200 px-6 py-4 text-sm font-bold text-slate-500">
              汎用AIチャット
            </div>
          </div>

          {rows.map((row, i) => (
            <motion.div
              key={row.feature}
              variants={rowVariants}
              className={`grid grid-cols-1 md:grid-cols-[1.3fr_1.4fr_1.6fr] ${
                i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
              } ${i > 0 ? 'border-t border-slate-200' : ''}`}
            >
              {/* Feature */}
              <div className="px-6 pt-6 pb-2 md:py-6">
                <p className="font-bold text-slate-900">{row.feature}</p>
              </div>

              {/* Taskal */}
              <div className="px-6 py-3 md:border-l md:border-slate-200 md:py-6">
                <p className="mb-1 text-xs font-bold text-es-teal-dark md:hidden">
                  Taskal AI
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-es-teal/10">
                    <Check className="h-3.5 w-3.5 text-es-teal" />
                  </span>
                  <span className="text-sm leading-relaxed text-slate-700">
                    {row.taskal}
                  </span>
                </div>
              </div>

              {/* Generic */}
              <div className="px-6 pt-3 pb-6 md:border-l md:border-slate-200 md:py-6">
                <p className="mb-1 text-xs font-bold text-slate-500 md:hidden">
                  汎用AIチャット
                </p>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <Minus className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                  <span className="text-sm leading-relaxed text-slate-500">
                    {row.generic}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
          ※ 汎用AIチャットの挙動は製品・モデルやプロンプトによって変わります。上記は一般的な使い方を想定した比較です。
        </p>
      </div>
    </section>
  );
}

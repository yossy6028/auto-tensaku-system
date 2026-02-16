'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';

type FAQItem = {
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    question: 'AI添削の精度はどの程度ですか？',
    answer:
      '指導歴20年超のベテラン国語講師が監修した採点基準をもとにAIが評価します。内容・表現・構成の3軸で分析し、人間の採点と高い一致率を実現しています。',
  },
  {
    question: '生徒の答案データはどのように管理されていますか？',
    answer:
      '答案データはサーバーに保存されません。SSL通信で安全に送信され、採点処理が完了した時点でサーバーから即時破棄されます。AIの学習にも一切使用しません。',
  },
  {
    question: '無料トライアル後に自動で課金されますか？',
    answer:
      'いいえ。初回3回の無料トライアルにクレジットカード登録は不要です。有料プランへの切り替えはご自身で明示的にお手続きいただく必要があります。',
  },
  {
    question: '手書き答案の読み取り精度は？',
    answer:
      'スマートフォンで撮影した手書き答案をAI-OCRで高精度に読み取ります。ピントが合っていれば、一般的な中高生の筆跡で問題なく認識できます。',
  },
  {
    question: '対応している問題形式は？',
    answer:
      '中学受験・高校受験の国語に対応しています。論説文の要約、小説の心情説明、意見文など、幅広い記述形式で添削が可能です。',
  },
  {
    question: 'プランの変更やキャンセルはできますか？',
    answer:
      'はい。プランのアップグレード・ダウングレードはいつでも可能です。キャンセルも次回更新日までに手続きすれば、追加料金は発生しません。',
  },
];

function FAQAccordion({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="border-b border-slate-200"
      initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="pr-4 text-base font-semibold text-slate-900">
          {item.question}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 leading-relaxed text-slate-600">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-es-surface-light py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <motion.h2
          className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          よくある質問
        </motion.h2>

        <div className="mt-12">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} item={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

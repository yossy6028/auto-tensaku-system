'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Sparkles, ChevronRight, BookOpen, PenTool, FileText } from 'lucide-react';

// =============================================================================
// TODO(human): 添削サンプルデータを記入してください
//
// 各パターンに必要な項目:
//   - label: 表示ラベル（例: "中学受験 50字記述"）
//   - icon: アイコンコンポーネント
//   - question: 問題文
//   - studentAnswer: 生徒の回答（よくある間違いパターンを含む、リアルな回答）
//   - scores: { content: 0-10, expression: 0-10, structure: 0-10 }
//   - feedback: { content: string, expression: string, structure: string }
//   - improved: 改善後の回答例（任意）
//
// ポイント:
//   - 保護者が「うちの子もこう書く！」と共感するレベル感
//   - よくある間違い例: 主語述語のねじれ、根拠不足、段落構成の甘さ
//   - フィードバックは具体的に（「ここをこう直すと良い」）
// =============================================================================

const samples: Sample[] = [
  {
    label: '中学受験 50字記述',
    icon: BookOpen,
    question: '（問題文をここに記入）',
    studentAnswer: '（生徒の回答をここに記入 — 50字程度、よくある間違いを含む）',
    scores: { content: 5, expression: 4, structure: 6 },
    feedback: {
      content: '（内容に対するフィードバック）',
      expression: '（表現に対するフィードバック）',
      structure: '（構成に対するフィードバック）',
    },
    improved: '（改善後の回答例）',
  },
  {
    label: '高校受験 200字記述',
    icon: PenTool,
    question: '（問題文をここに記入）',
    studentAnswer: '（生徒の回答をここに記入 — 200字程度）',
    scores: { content: 6, expression: 5, structure: 4 },
    feedback: {
      content: '（内容に対するフィードバック）',
      expression: '（表現に対するフィードバック）',
      structure: '（構成に対するフィードバック）',
    },
    improved: '（改善後の回答例）',
  },
  {
    label: '作文・論述 400字',
    icon: FileText,
    question: '（問題文をここに記入）',
    studentAnswer: '（生徒の回答をここに記入 — 400字程度）',
    scores: { content: 7, expression: 5, structure: 5 },
    feedback: {
      content: '（内容に対するフィードバック）',
      expression: '（表現に対するフィードバック）',
      structure: '（構成に対するフィードバック）',
    },
    improved: '（改善後の回答例）',
  },
];

// =============================================================================
// ここから下はレイアウト・表示ロジック（編集不要）
// =============================================================================

type Sample = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  question: string;
  studentAnswer: string;
  scores: { content: number; expression: number; structure: number };
  feedback: { content: string; expression: string; structure: string };
  improved?: string;
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 text-xs font-medium text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${score * 10}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="w-8 text-right text-sm font-bold text-slate-700">{score}/10</span>
    </div>
  );
}

export function BeforeAfterSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = samples[activeIndex];
  const Icon = active.icon;

  return (
    <section id="before-after" className="py-20 bg-es-surface-light md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <p className="mb-3 text-sm font-semibold tracking-wider text-es-teal uppercase">
            添削結果サンプル
          </p>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
            写真を撮るだけで、<span className="text-es-blue">ここまでわかる</span>
          </h2>
          <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
            実際の添削結果をご覧ください。内容・表現・構成の3軸で、具体的な改善ポイントを提示します。
          </p>
        </motion.div>

        {/* Tab selector */}
        <div className="flex justify-center gap-3 mb-10 flex-wrap">
          {samples.map((sample, i) => {
            const TabIcon = sample.icon;
            return (
              <button
                key={sample.label}
                onClick={() => setActiveIndex(i)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  i === activeIndex
                    ? 'bg-es-teal text-white shadow-md shadow-es-teal/20'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <TabIcon className="h-4 w-4" />
                {sample.label}
              </button>
            );
          })}
        </div>

        {/* Before → After flow */}
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid gap-6 lg:grid-cols-[1fr,auto,1fr] lg:items-start"
        >
          {/* Before: 生徒の回答 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="h-5 w-5 text-slate-400" />
              <h3 className="font-bold text-slate-600">生徒の回答</h3>
            </div>

            {/* 問題文 */}
            <div className="mb-4 rounded-lg bg-slate-50 p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-1">問題</p>
              <p className="text-sm text-slate-700 leading-relaxed">{active.question}</p>
            </div>

            {/* 生徒の回答 */}
            <div className="rounded-lg bg-amber-50 p-4 border border-amber-100">
              <p className="text-xs font-medium text-amber-600 mb-1">回答</p>
              <p className="text-sm text-slate-800 leading-relaxed font-['Yu_Mincho',serif]">
                {active.studentAnswer}
              </p>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center lg:pt-24">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-es-teal shadow-lg shadow-es-teal/25"
            >
              <Sparkles className="h-5 w-5 text-white" />
            </motion.div>
          </div>

          {/* After: AI添削結果 */}
          <div className="rounded-2xl border border-es-teal/20 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-es-teal" />
              <h3 className="font-bold text-es-teal-dark">AI添削結果</h3>
              <span className="ml-auto text-xs text-slate-400">約3分で出力</span>
            </div>

            {/* Score bars */}
            <div className="mb-5 space-y-2.5 rounded-lg bg-es-surface-teal p-4">
              <ScoreBar label="内容" score={active.scores.content} color="bg-blue-500" />
              <ScoreBar label="表現" score={active.scores.expression} color="bg-es-teal" />
              <ScoreBar label="構成" score={active.scores.structure} color="bg-indigo-500" />
            </div>

            {/* Feedback */}
            <div className="space-y-3">
              {[
                { label: '内容', text: active.feedback.content, color: 'bg-blue-500' },
                { label: '表現', text: active.feedback.expression, color: 'bg-es-teal' },
                { label: '構成', text: active.feedback.structure, color: 'bg-indigo-500' },
              ].map((item) => (
                <div key={item.label} className="flex gap-3">
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Improved answer (if provided) */}
            {active.improved && (
              <div className="mt-5 rounded-lg bg-es-teal-light p-4 border border-es-teal/10">
                <p className="text-xs font-medium text-es-teal-dark mb-1">改善例</p>
                <p className="text-sm text-slate-800 leading-relaxed font-['Yu_Mincho',serif]">
                  {active.improved}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

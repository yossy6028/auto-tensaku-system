import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { ScoreCard } from '../components/ScoreCard';

const evaluationRows = [
  { criterion: 'テーマ・設問への応答', grade: 'A', score: 18, color: 'text-green-400' },
  { criterion: '構成・論理展開', grade: 'B', score: 15, color: 'text-blue-400' },
  { criterion: '根拠・具体例', grade: 'A', score: 17, color: 'text-green-400' },
  { criterion: '考えの深さ', grade: 'B', score: 14, color: 'text-blue-400' },
  { criterion: '表現・言語運用', grade: 'A', score: 16, color: 'text-green-400' },
];

export const ResultScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Score card entrance
  const scoreScale = spring({ frame, fps, config: { damping: 12 } });

  // Evaluation table entrance
  const tableOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });
  const tableY = interpolate(frame, [40, 60], [40, 0], { extrapolateRight: 'clamp' });

  // Feedback entrance
  const feedbackOpacity = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp' });

  // Rewrite example entrance
  const rewriteOpacity = interpolate(frame, [120, 140], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="flex items-start justify-center bg-slate-50 overflow-hidden p-16">
      <div className="flex w-full max-w-[1700px] gap-8">
        {/* Left column: Score + Evaluation */}
        <div className="flex-1">
          {/* Header */}
          <div className="mb-6">
            <p className="text-5xl font-bold text-slate-700 mb-2">
              <span className="text-es-teal">③</span> 結果を確認
            </p>
            <p className="text-3xl font-bold text-slate-900">採点レポート</p>
          </div>

          {/* Score card */}
          <div style={{ transform: `scale(${scoreScale})` }}>
            <ScoreCard score={80} frame={frame} fps={fps} />
          </div>

          {/* 3-axis evaluation table */}
          <div
            className="mt-6 rounded-2xl bg-white p-6 shadow-lg border border-slate-100"
            style={{
              opacity: tableOpacity,
              transform: `translateY(${tableY}px)`,
            }}
          >
            <p className="text-lg font-bold text-slate-900 mb-4">📊 観点別評価</p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-sm text-slate-500">観点</th>
                  <th className="pb-2 text-center text-sm text-slate-500">評価</th>
                  <th className="pb-2 text-right text-sm text-slate-500">点数</th>
                </tr>
              </thead>
              <tbody>
                {evaluationRows.map((row, i) => {
                  const rowDelay = 60 + i * 12;
                  const rowOpacity = interpolate(
                    frame, [rowDelay, rowDelay + 10], [0, 1],
                    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
                  );
                  return (
                    <tr
                      key={row.criterion}
                      className="border-b border-slate-50"
                      style={{ opacity: rowOpacity }}
                    >
                      <td className="py-3 text-sm text-slate-700">{row.criterion}</td>
                      <td className={`py-3 text-center text-lg font-bold ${row.color}`}>
                        {row.grade}
                      </td>
                      <td className="py-3 text-right text-sm font-semibold text-slate-900">
                        {row.score}/20
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Feedback + Rewrite */}
        <div className="flex-1 space-y-6">
          {/* Good points */}
          <div
            className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 shadow-lg border border-emerald-200"
            style={{ opacity: feedbackOpacity }}
          >
            <p className="text-lg font-bold text-emerald-800 mb-3">👍 良かった点</p>
            <ul className="space-y-2 text-sm text-emerald-700">
              <li>• 設問の意図を正確に捉え、的確に論述できている</li>
              <li>• 具体例を用いて説得力のある文章構成になっている</li>
            </ul>
          </div>

          {/* Improvement */}
          <div
            className="rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 shadow-lg border border-indigo-200"
            style={{ opacity: feedbackOpacity }}
          >
            <p className="text-lg font-bold text-indigo-800 mb-3">💡 改善のアドバイス</p>
            <ul className="space-y-2 text-sm text-indigo-700">
              <li>• 結論部分をより明確に述べると説得力が増します</li>
              <li>• 接続詞の使い方を工夫して論理の流れを滑らかに</li>
            </ul>
          </div>

          {/* Rewrite example */}
          <div
            className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-lg border border-amber-200"
            style={{ opacity: rewriteOpacity }}
          >
            <p className="text-lg font-bold text-amber-800 mb-3">✨ 満点の書き直し例</p>
            <p className="text-sm leading-relaxed text-amber-900" style={{ fontFamily: 'serif' }}>
              筆者が主張する「共生社会」の実現には、まず互いの違いを認識し、受け入れる姿勢が不可欠である。
              具体的には、地域における多文化交流イベントの開催や、教育現場での対話型授業の導入が有効だと考える…
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

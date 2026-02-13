import { interpolate, spring } from 'remotion';

type Props = {
  score: number;
  frame: number;
  fps: number;
};

export const ScoreCard: React.FC<Props> = ({ score, frame, fps }) => {
  // Animate score counting up
  const displayScore = Math.round(
    interpolate(frame, [5, 40], [0, score], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })
  );

  // Progress bar width
  const barWidth = interpolate(frame, [5, 40], [0, score], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🌟</span>
        <span className="text-sm font-medium text-white/80">総合スコア</span>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-8xl font-black text-white">{displayScore}</span>
        <span className="text-3xl font-bold text-white/60">%</span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-3 w-full rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-white transition-none"
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
};

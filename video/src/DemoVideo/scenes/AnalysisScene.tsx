import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

const analysisSteps = [
  { label: 'OCR読み取り中...', start: 10, end: 45 },
  { label: '内容を分析中...', start: 45, end: 75 },
  { label: '表現を評価中...', start: 75, end: 100 },
  { label: '構成をチェック中...', start: 100, end: 125 },
];

export const AnalysisScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Spinner rotation
  const spinAngle = frame * 6;

  // Progress bar
  const progress = interpolate(frame, [10, 125], [0, 100], { extrapolateRight: 'clamp' });

  // Done state
  const doneScale = frame >= 130
    ? spring({ frame: frame - 130, fps, config: { damping: 10 } })
    : 0;

  // Current step
  const currentStep = analysisSteps.findIndex(
    (step) => frame >= step.start && frame < step.end
  );

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center bg-gradient-to-br from-es-surface-deep-navy via-es-dark-blue to-es-blue">
      <div style={{ opacity: titleOpacity }} className="text-center">
        <p className="text-6xl font-bold text-white mb-10">
          <span className="text-es-teal">②</span> AIが分析
        </p>

        {/* Analysis card */}
        <div className="w-[600px] rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 p-12">
          {/* Spinner or done */}
          <div className="flex justify-center mb-8">
            {doneScale > 0 ? (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full bg-es-teal"
                style={{ transform: `scale(${doneScale})` }}
              >
                <span className="text-5xl text-white">✓</span>
              </div>
            ) : (
              <div
                className="h-24 w-24 rounded-full border-4 border-white/20 border-t-es-teal"
                style={{ transform: `rotate(${spinAngle}deg)` }}
              />
            )}
          </div>

          {/* Status text */}
          <p className="text-2xl font-semibold text-white mb-6">
            {doneScale > 0
              ? '分析完了！'
              : currentStep >= 0
                ? analysisSteps[currentStep].label
                : '準備中...'
            }
          </p>

          {/* Progress bar */}
          <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-es-blue to-es-teal transition-none"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="mt-8 flex justify-between">
            {['読取', '内容', '表現', '構成'].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    frame >= analysisSteps[i]?.end
                      ? 'bg-es-teal'
                      : frame >= analysisSteps[i]?.start
                        ? 'bg-es-teal animate-pulse'
                        : 'bg-white/20'
                  }`}
                />
                <span className="text-sm text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

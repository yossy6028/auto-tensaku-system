import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export const PrintScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title fade in
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Printer body appears
  const printerScale = spring({ frame: frame - 5, fps, config: { damping: 14 } });

  // Report slides DOWN out of printer (0 = hidden inside, 1 = fully out)
  const reportProgress = interpolate(frame, [30, 80], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const reportOpacity = interpolate(frame, [30, 38], [0, 1], { extrapolateRight: 'clamp' });

  // Student icons appear one by one
  const students = [
    { name: '生徒A', delay: 100 },
    { name: '生徒B', delay: 115 },
    { name: '生徒C', delay: 130 },
  ];

  // Arrow from report to students
  const arrowOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateRight: 'clamp' });

  // Batch grading callout
  const calloutScale = frame >= 145
    ? spring({ frame: frame - 145, fps, config: { damping: 12 } })
    : 0;

  // Report height for slide calculation
  const reportHeight = 320;

  return (
    <AbsoluteFill className="flex flex-col items-center bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Title */}
      <div style={{ opacity: titleOpacity }} className="mt-14 text-center">
        <p className="text-6xl font-bold text-slate-800">
          <span className="text-es-amber">④</span> レポートを印刷して配布
        </p>
        <p className="mt-4 text-2xl text-slate-500">
          個別フィードバックをそのまま生徒にお渡し
        </p>
      </div>

      {/* Printer + Report area - centered */}
      <div className="flex flex-1 items-start justify-center mt-10">
        <div className="flex items-start gap-20">
          {/* Left: Printer with report emerging */}
          <div style={{ transform: `scale(${Math.min(printerScale, 1)})` }}>
            {/* Printer body */}
            <div className="relative w-[360px]">
              {/* Printer top (input tray) */}
              <div className="h-6 bg-slate-600 rounded-t-xl mx-8" />

              {/* Printer main body */}
              <div className="h-[100px] rounded-2xl bg-slate-700 shadow-2xl flex items-center justify-center relative z-10">
                {/* Indicator light + status */}
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full ${
                    frame > 30 && frame < 80
                      ? 'bg-es-teal animate-pulse'
                      : frame >= 80
                        ? 'bg-es-teal'
                        : 'bg-slate-500'
                  }`} />
                  <span className="text-xl text-slate-300 font-medium">
                    {frame < 30 ? 'スタンバイ' : frame < 80 ? '印刷中...' : '完了'}
                  </span>
                </div>
              </div>

              {/* Output slot - paper emerges from here */}
              <div className="h-3 bg-slate-800 rounded-b mx-6 relative z-10" />

              {/* Paper sliding down from slot - clipped container */}
              <div
                className="relative mx-auto w-[280px] overflow-hidden"
                style={{ height: reportProgress * reportHeight }}
              >
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{ opacity: reportOpacity }}
                >
                  {/* Paper with slight shadow for depth */}
                  <div className="bg-white rounded-b-lg shadow-xl border border-t-0 border-slate-200 p-5">
                    {/* Report header */}
                    <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-3">
                      <div className="h-8 w-8 rounded-full bg-es-teal flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">E</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">採点レポート</p>
                        <p className="text-xs text-slate-400">Taskal AI</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-2xl font-black text-es-teal">80<span className="text-sm">点</span></p>
                      </div>
                    </div>
                    {/* Evaluation rows */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">テーマ応答</span>
                        <span className="text-xs font-bold text-green-600">A</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">構成・論理</span>
                        <span className="text-xs font-bold text-blue-600">B</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-600">根拠・具体例</span>
                        <span className="text-xs font-bold text-green-600">A</span>
                      </div>
                    </div>
                    {/* Comment */}
                    <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-500 leading-relaxed">
                      設問の意図を的確に捉え、具体例を交えた論述ができています。結論をより明確にすると…
                    </div>
                    {/* Decorative dotted tear line */}
                    <div className="mt-3 border-t-2 border-dashed border-slate-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Arrow + Students */}
          <div className="flex flex-col items-center pt-8" style={{ opacity: arrowOpacity }}>
            {/* Arrow */}
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="mb-6">
              <path d="M10 30 L45 30 M36 20 L48 30 L36 40" stroke="#2DB3A0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Students */}
            <div className="flex flex-col gap-8">
              {students.map((student) => {
                const s = frame >= student.delay
                  ? spring({ frame: frame - student.delay, fps, config: { damping: 12 } })
                  : 0;
                return (
                  <div
                    key={student.name}
                    className="flex items-center gap-4"
                    style={{ transform: `scale(${s})` }}
                  >
                    {/* Avatar */}
                    <div className="h-16 w-16 rounded-full bg-es-blue-light flex items-center justify-center shrink-0">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="1.5">
                        <path d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12z" />
                        <path d="M20 21c0-3.3-3.6-6-8-6s-8 2.7-8 6" />
                      </svg>
                    </div>
                    {/* Mini report */}
                    <div className="w-14 h-18 bg-white rounded shadow-md border border-slate-200 p-1.5 flex flex-col items-center justify-center">
                      <div className="h-1 w-8 bg-slate-200 rounded mb-0.5" />
                      <div className="h-1 w-6 bg-slate-200 rounded mb-0.5" />
                      <div className="text-xs font-bold text-es-teal">A</div>
                    </div>
                    {/* Name */}
                    <span className="text-lg font-medium text-slate-600">{student.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Batch grading callout */}
      {calloutScale > 0 && (
        <div
          className="absolute bottom-14 left-0 right-0 flex justify-center"
          style={{ transform: `scale(${calloutScale})` }}
        >
          <div className="rounded-2xl bg-es-teal px-10 py-4 shadow-xl">
            <p className="text-3xl font-bold text-white">
              同じ問題なら同時に10名まで一括採点可能！
            </p>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

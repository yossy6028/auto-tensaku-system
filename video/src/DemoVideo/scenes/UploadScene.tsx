import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export const UploadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Answer sheet paper appears
  const paperScale = spring({ frame, fps, config: { damping: 14 } });

  // Phone slides in from top
  const phoneY = interpolate(frame, [25, 55], [-400, 0], { extrapolateRight: 'clamp' });
  const phoneOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: 'clamp' });

  // Camera viewfinder overlay on phone
  const viewfinderOpacity = interpolate(frame, [55, 65], [0, 1], { extrapolateRight: 'clamp' });

  // Shutter button pulse
  const shutterFrame = 80;
  const isShutterMoment = frame >= shutterFrame && frame <= shutterFrame + 5;
  const shutterScale = isShutterMoment ? 0.8 : 1;

  // Flash
  const flashOpacity = frame >= shutterFrame && frame <= shutterFrame + 10
    ? interpolate(frame, [shutterFrame, shutterFrame + 3, shutterFrame + 10], [0, 0.7, 0], { extrapolateRight: 'clamp' })
    : 0;

  // Shutter ring burst (radiating circle)
  const ringScale = frame >= shutterFrame
    ? interpolate(frame, [shutterFrame, shutterFrame + 12], [0.3, 2.5], { extrapolateRight: 'clamp' })
    : 0;
  const ringOpacity = frame >= shutterFrame
    ? interpolate(frame, [shutterFrame, shutterFrame + 4, shutterFrame + 12], [0, 0.8, 0], { extrapolateRight: 'clamp' })
    : 0;

  // After shutter: photo captured thumbnail
  const capturedOpacity = interpolate(frame, [shutterFrame + 12, shutterFrame + 20], [0, 1], { extrapolateRight: 'clamp' });

  // Upload progress
  const uploadProgress = interpolate(frame, [shutterFrame + 25, shutterFrame + 65], [0, 100], { extrapolateRight: 'clamp' });

  // Done
  const doneScale = frame >= shutterFrame + 70
    ? spring({ frame: frame - (shutterFrame + 70), fps, config: { damping: 12 } })
    : 0;

  return (
    <AbsoluteFill className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Left side caption */}
      <div
        className="absolute left-[8%] top-1/2 -translate-y-1/2 max-w-lg"
        style={{ opacity: titleOpacity }}
      >
        <p className="text-7xl font-bold text-slate-900 leading-tight">
          <span className="text-es-blue">①</span> 答案を
          <br />撮影する
        </p>
        <p className="mt-6 text-3xl text-slate-500">
          手書き答案をそのままでOK。
          <br />スマホで撮るだけ。PDFにも対応。
        </p>
      </div>

      {/* Right side: desk area with paper + phone */}
      <div className="absolute right-[10%] top-1/2 -translate-y-1/2 flex flex-col items-center">
        {/* Paper + phone layered */}
        <div className="relative">
          {/* Answer sheet paper on desk */}
          <div
            className="w-[380px] rounded-lg bg-white shadow-xl border border-slate-200 p-8"
            style={{ transform: `scale(${Math.min(paperScale, 1)})` }}
          >
            {/* Paper header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
              <span className="text-lg font-bold text-slate-700">作文課題</span>
              <span className="text-sm text-slate-400">2025年 1学期</span>
            </div>
            {/* Handwritten-style lines */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 shrink-0">名前</span>
                <div className="h-[2px] flex-1 bg-slate-200 relative">
                  <span className="absolute -top-3 left-2 text-base text-slate-600" style={{ fontFamily: 'serif' }}>山田 太郎</span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {/* Simulated handwriting lines */}
                <div className="h-[2px] w-full bg-slate-100 relative">
                  <div className="absolute -top-3 left-0 right-8 h-3 rounded bg-slate-800/60"
                    style={{ clipPath: 'polygon(0 40%, 5% 70%, 10% 30%, 18% 60%, 25% 35%, 32% 65%, 38% 40%, 45% 55%, 52% 30%, 60% 50%, 68% 35%, 75% 60%, 80% 45%, 88% 55%, 92% 40%, 100% 50%)' }} />
                </div>
                <div className="h-[2px] w-full bg-slate-100 relative">
                  <div className="absolute -top-3 left-0 right-4 h-3 rounded bg-slate-800/60"
                    style={{ clipPath: 'polygon(0 50%, 8% 35%, 15% 60%, 22% 40%, 30% 55%, 38% 30%, 45% 65%, 52% 45%, 58% 55%, 65% 35%, 72% 50%, 80% 40%, 88% 60%, 95% 45%, 100% 55%)' }} />
                </div>
                <div className="h-[2px] w-full bg-slate-100 relative">
                  <div className="absolute -top-3 left-0 right-12 h-3 rounded bg-slate-800/60"
                    style={{ clipPath: 'polygon(0 45%, 7% 60%, 14% 35%, 22% 55%, 30% 40%, 38% 60%, 45% 35%, 52% 50%, 60% 40%, 68% 55%, 75% 35%, 82% 55%, 88% 45%, 100% 50%)' }} />
                </div>
                <div className="h-[2px] w-full bg-slate-100 relative">
                  <div className="absolute -top-3 left-0 right-20 h-3 rounded bg-slate-800/60"
                    style={{ clipPath: 'polygon(0 55%, 10% 35%, 20% 50%, 30% 40%, 40% 60%, 50% 35%, 60% 55%, 70% 40%, 80% 50%, 90% 42%, 100% 55%)' }} />
                </div>
                <div className="h-[2px] w-full bg-slate-100 relative">
                  <div className="absolute -top-3 left-0 right-32 h-3 rounded bg-slate-800/60"
                    style={{ clipPath: 'polygon(0 40%, 12% 55%, 25% 38%, 38% 60%, 50% 42%, 62% 55%, 75% 38%, 100% 50%)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Smartphone hovering above paper */}
          <div
            className="absolute -top-6 -right-10 w-[200px]"
            style={{
              opacity: phoneOpacity,
              transform: `translateY(${phoneY}px) rotate(-8deg)`,
            }}
          >
            {/* Phone body */}
            <div className="rounded-[24px] bg-slate-900 p-2 shadow-2xl border-2 border-slate-700">
              <div className="rounded-[18px] bg-slate-800 overflow-hidden">
                {/* Camera viewfinder */}
                <div className="relative h-[280px] bg-slate-100 flex items-center justify-center">
                  {/* Viewfinder: shows captured paper */}
                  <div style={{ opacity: viewfinderOpacity }} className="absolute inset-2">
                    {/* Mini answer sheet in viewfinder */}
                    <div className="h-full w-full rounded bg-white border border-slate-200 p-3 flex flex-col">
                      <div className="h-2 w-16 bg-slate-300 rounded mb-2" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-1.5 w-full bg-slate-400/50 rounded" />
                        <div className="h-1.5 w-11/12 bg-slate-400/50 rounded" />
                        <div className="h-1.5 w-full bg-slate-400/50 rounded" />
                        <div className="h-1.5 w-10/12 bg-slate-400/50 rounded" />
                        <div className="h-1.5 w-9/12 bg-slate-400/50 rounded" />
                      </div>
                    </div>
                    {/* Focus corners */}
                    <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-es-teal" />
                    <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-es-teal" />
                    <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-es-teal" />
                    <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-es-teal" />
                  </div>

                  {/* Captured photo confirmation */}
                  {capturedOpacity > 0 && (
                    <div
                      className="absolute inset-0 bg-white flex items-center justify-center"
                      style={{ opacity: capturedOpacity }}
                    >
                      <div className="text-center">
                        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-es-teal">
                          <span className="text-2xl text-white">✓</span>
                        </div>
                        <p className="mt-2 text-xs font-medium text-slate-600">撮影完了</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shutter button bar */}
                <div className="h-16 bg-slate-900 flex items-center justify-center">
                  <div
                    className="h-12 w-12 rounded-full border-4 border-white flex items-center justify-center"
                    style={{ transform: `scale(${shutterScale})` }}
                  >
                    <div className="h-9 w-9 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload progress bar below */}
        {frame >= shutterFrame + 25 && (
          <div className="w-[380px] mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">アップロード中...</span>
              <span className="text-sm font-bold text-es-teal">{Math.round(Math.min(uploadProgress, 100))}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-es-teal transition-none"
                style={{ width: `${Math.min(uploadProgress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Done */}
        {doneScale > 0 && (
          <div
            className="mt-4 flex items-center gap-2"
            style={{ transform: `scale(${doneScale})` }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-es-teal">
              <span className="text-lg text-white">✓</span>
            </div>
            <span className="text-xl font-bold text-es-teal">アップロード完了</span>
          </div>
        )}
      </div>

      {/* Shutter ring burst animation */}
      {ringOpacity > 0 && (
        <div
          className="absolute right-[22%] top-[38%] pointer-events-none"
          style={{
            opacity: ringOpacity,
            transform: `scale(${ringScale})`,
          }}
        >
          <div className="h-40 w-40 rounded-full border-4 border-es-teal" />
        </div>
      )}

      {/* Camera flash overlay */}
      <AbsoluteFill
        className="bg-white pointer-events-none"
        style={{ opacity: flashOpacity }}
      />
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile } from 'remotion';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = interpolate(frame, [0, 20], [0.8, 1], { extrapolateRight: 'clamp' });
  const textOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' });
  const textY = interpolate(frame, [25, 45], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center bg-gradient-to-br from-es-dark-blue via-es-blue to-es-teal">
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
        }}
      >
        <Img src={staticFile('logo-taskal-ai.png')} className="h-[450px] w-auto" style={{ mixBlendMode: 'multiply' }} />
      </div>

      <div
        className="mt-10 text-center"
        style={{
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <p className="text-4xl font-bold text-white leading-relaxed">
          もう、夜中に赤ペン握らなくていい。
        </p>
      </div>
    </AbsoluteFill>
  );
};

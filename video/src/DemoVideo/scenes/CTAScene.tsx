import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from 'remotion';

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const textScale = spring({ frame: frame - 5, fps, config: { damping: 12 } });
  const buttonScale = spring({ frame: frame - 25, fps, config: { damping: 10 } });
  const logoOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center bg-gradient-to-br from-es-dark-blue via-es-blue to-es-teal"
      style={{ opacity: bgOpacity }}
    >
      <div
        className="text-center"
        style={{ transform: `scale(${Math.max(textScale, 0)})` }}
      >
        <p className="text-5xl font-bold text-white">
          今すぐ無料で添削を体験
        </p>
        <p className="mt-4 text-xl text-white/70">
          初回3回無料 / クレジットカード不要
        </p>
      </div>

      <div
        className="mt-10"
        style={{ transform: `scale(${Math.max(buttonScale, 0)})` }}
      >
        <div className="rounded-full bg-white px-12 py-5 text-2xl font-bold text-es-teal shadow-2xl">
          無料で試してみる →
        </div>
      </div>

      <div className="mt-12" style={{ opacity: logoOpacity }}>
        <Img src={staticFile('logo-taskal-ai.png')} className="h-[400px] w-auto" style={{ mixBlendMode: 'multiply' }} />
      </div>
    </AbsoluteFill>
  );
};

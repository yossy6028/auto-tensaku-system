import { AbsoluteFill, Sequence, Audio, staticFile, interpolate, useCurrentFrame } from 'remotion';
import { IntroScene } from './scenes/IntroScene';
import { UploadScene } from './scenes/UploadScene';
import { AnalysisScene } from './scenes/AnalysisScene';
import { ResultScene } from './scenes/ResultScene';
import { PrintScene } from './scenes/PrintScene';
import { CTAScene } from './scenes/CTAScene';

// 30fps × 30秒 = 900フレーム
// シーン1: イントロ       0-90   (3秒)
// シーン2: ①撮影・UP     90-270  (6秒)
// シーン3: ②AI分析      270-420  (5秒)
// シーン4: ③結果表示    420-600  (6秒)
// シーン5: ④印刷・配布  600-780  (6秒)
// シーン6: CTA         780-900  (4秒)

const BgmTrack: React.FC = () => {
  const frame = useCurrentFrame();
  // Fade in over first 1 second, fade out over last 2 seconds
  const volume = interpolate(frame, [0, 30, 840, 900], [0, 0.3, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <Audio src={staticFile('bgm-corporate.mp3')} volume={volume} />;
};

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill className="bg-es-surface-deep-navy font-sans">
      {/* BGM - full duration with fade in/out */}
      <Sequence from={0} durationInFrames={900}>
        <BgmTrack />
      </Sequence>

      {/* SFX: Camera shutter at Upload scene frame 80 (global frame 170) */}
      <Sequence from={170} durationInFrames={45}>
        <Audio src={staticFile('sfx-shutter.wav')} volume={0.6} />
      </Sequence>

      {/* SFX: Success sound when result appears (global frame 450) */}
      <Sequence from={450} durationInFrames={60}>
        <Audio src={staticFile('sfx-success.wav')} volume={0.5} />
      </Sequence>

      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>

      <Sequence from={90} durationInFrames={180}>
        <UploadScene />
      </Sequence>

      <Sequence from={270} durationInFrames={150}>
        <AnalysisScene />
      </Sequence>

      <Sequence from={420} durationInFrames={180}>
        <ResultScene />
      </Sequence>

      <Sequence from={600} durationInFrames={180}>
        <PrintScene />
      </Sequence>

      <Sequence from={780} durationInFrames={120}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

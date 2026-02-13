import './index.css';
import { Composition } from 'remotion';
import { DemoVideo } from './DemoVideo/Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

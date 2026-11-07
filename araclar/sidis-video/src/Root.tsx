import { Composition } from "remotion";
import { SidisShort01, SHORT01_KARE, FPS as SIDIS_SHORT_FPS } from "./sidis-shorts/Short01";
import { SidisUzun, SIDIS_UZUN_KARE, SIDIS_UZUN_FPS } from "./sidis-uzun/Video";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SidisShort01" component={SidisShort01} durationInFrames={SHORT01_KARE} fps={SIDIS_SHORT_FPS} width={1080} height={1920} defaultProps={{ sesli: false }} />
    <Composition id="SidisUzun" component={SidisUzun} durationInFrames={SIDIS_UZUN_KARE} fps={SIDIS_UZUN_FPS} width={1920} height={1080} defaultProps={{ sesli: false }} />
  </>
);

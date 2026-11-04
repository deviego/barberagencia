import React from "react";
import { Composition, Still } from "remotion";
import { C1S1, C1S2, C1S3, C1S4, C2S1, C2S2, C2S3, POST, PLATFORM, RESPONSIVE, CLIENT_APP, REEL1_COVER, REEL2_COVER } from "./boards";
import { PROMO_1, PROMO_2, FPS, PROMO_DUR } from "./promos";

const FEED = { width: 1080, height: 1350 };
const STORY = { width: 1080, height: 1920 };

export const RemotionRoot: React.FC = () => (
  <>
    {/* Carrossel 1 — Agenda */}
    <Still id="c1-s1-capa" component={C1S1} {...FEED} />
    <Still id="c1-s2" component={C1S2} {...FEED} />
    <Still id="c1-s3" component={C1S3} {...FEED} />
    <Still id="c1-s4-cta" component={C1S4} {...FEED} />
    {/* Carrossel 2 — Plano */}
    <Still id="c2-s1-capa" component={C2S1} {...FEED} />
    <Still id="c2-s2" component={C2S2} {...FEED} />
    <Still id="c2-s3-cta" component={C2S3} {...FEED} />
    {/* Post prova social */}
    <Still id="post-prova-social" component={POST} {...FEED} />
    {/* Mockups da plataforma */}
    <Still id="plataforma-painel" component={PLATFORM} {...FEED} />
    <Still id="responsividade" component={RESPONSIVE} {...STORY} />
    <Still id="app-do-cliente" component={CLIENT_APP} {...STORY} />
    {/* Capas de reel */}
    <Still id="reel1-capa" component={REEL1_COVER} {...STORY} />
    <Still id="reel2-capa" component={REEL2_COVER} {...STORY} />
    {/* Reels animados 30s */}
    <Composition id="promo1-agenda-fila" component={PROMO_1} durationInFrames={PROMO_DUR} fps={FPS} {...STORY} />
    <Composition id="promo2-plano-app" component={PROMO_2} durationInFrames={PROMO_DUR} fps={FPS} {...STORY} />
  </>
);

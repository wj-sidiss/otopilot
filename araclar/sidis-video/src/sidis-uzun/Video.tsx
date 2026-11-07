// W.J. Sidis uzun video — 1920×1080, 30 fps. Her bölüm (1..74) SAHNELER'deki bileşenle çizilir, <Sahne> ile sarılır.
// Aynı anda en çok iki sahne çizilir: yeni sayfa düşerken altında katlanmış eski sayfa.
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { fontlariYukle } from "../lib/fonts";
import { BOLUMLER, DUS_KARE, ILK, RENK, Sahne, SIDIS_UZUN_KARE, TakipCubugu, YerTutucu, aktifBolum, giris, k } from "./Ortak";
import { SAHNELER_A } from "./BolumA";
import { SAHNELER_B } from "./BolumB";
import { SAHNELER_C } from "./BolumC";
import { SAHNELER_D } from "./BolumD";
import { SAHNELER_E } from "./BolumE";
import { SAHNELER_F } from "./BolumF";

fontlariYukle();

export { SIDIS_UZUN_KARE };
export const SIDIS_UZUN_FPS = 30;

export const SAHNELER: Record<number, React.FC<{ b: number }>> = {
  ...SAHNELER_A, ...SAHNELER_B, ...SAHNELER_C, ...SAHNELER_D, ...SAHNELER_E, ...SAHNELER_F,
};

export const SidisUzun: React.FC<{ sesli?: boolean }> = ({ sesli = false }) => {
  const f = useCurrentFrame();
  const b = aktifBolum(f);
  const goster: number[] = [];
  if (b > ILK && f < k(giris(b)) + DUS_KARE && BOLUMLER.some((x) => x.no === b - 1)) goster.push(b - 1);
  goster.push(b);
  return (
    <AbsoluteFill style={{ background: RENK.kagitKoyu, overflow: "hidden" }}>
      {goster.map((n) => {
        const S = SAHNELER[n] ?? YerTutucu;
        return (
          <Sahne key={n} b={n} f={f}>
            <S b={n} />
          </Sahne>
        );
      })}
      <TakipCubugu f={f} />
      {sesli && <Audio src={staticFile("anlatim.wav")} />}
      {sesli && <Audio src={staticFile("muzik.wav")} volume={0.06} loop />}
    </AbsoluteFill>
  );
};

// W.J. Sidis uzun video — ortak temel (docs/SIDIS_STIL.md).
// Zaman HER ZAMAN assets/sidis-uzun/zaman.json'dan (bölüm, cümle) numarasıyla okunur; sabit saniye yazılmaz.
// Gerçek ses gelince zaman.json aynı şemayla yeniden üretilir, her şey kendiliğinden yerine oturur.
// Sahneler Sequence İÇİNDE DEĞİL: useCurrentFrame() mutlak karedir, c()/cs() mutlak saniyedir → k() ile kareye çevir.
import React from "react";
import { Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame } from "remotion";
import zamanJson from "../../assets/sidis-uzun/zaman.json";
import { Kagit, MONO, RENK, SANS, SERIF } from "../sidis-shorts/parcalar";

// parçaları ve paleti buradan da al: import { WJ, Damga, Bilet, RENK, ... } from "./Ortak"
export * from "../sidis-shorts/parcalar";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// ---------------------------------------------------------------- zaman
export type Cumle = { no: number; metin: string; bas: number; son: number };
export type Bolum = { no: number; bas: number; son: number; cumleler: Cumle[] };
type Zaman = { fps: number; toplamSn: number; tahmini?: boolean; bolumler: Bolum[] };

export const ZAMAN = zamanJson as unknown as Zaman;
export const BOLUMLER = ZAMAN.bolumler;
export const ILK = BOLUMLER[0].no;
export const SON = BOLUMLER[BOLUMLER.length - 1].no;
export const SIDIS_UZUN_KARE = Math.ceil(ZAMAN.toplamSn * FPS);

/** saniye → kare */
export const k = (sn: number) => Math.round(sn * FPS);
/** f karesinin [a,b] karesi aralığındaki ilerlemesi, 0..1 kırpılmış */
export const ara = (f: number, a: number, b: number, easing?: (t: number) => number) =>
  interpolate(f, [a, Math.max(a + 1, b)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const bolum = (b: number): Bolum => BOLUMLER.find((x) => x.no === b) ?? BOLUMLER[BOLUMLER.length - 1];
/** b. bölümün n. cümlesi (n taşarsa son cümle) */
export const cum = (b: number, n: number): Cumle => {
  const B = bolum(b);
  return B.cumleler.find((x) => x.no === n) ?? B.cumleler[Math.max(0, Math.min(n, B.cumleler.length) - 1)];
};
export const cumleSayisi = (b: number) => bolum(b).cumleler.length;
/** b. bölümün n. cümlesinin başladığı saniye */
export const c = (b: number, n: number) => cum(b, n).bas;
/** b. bölümün n. cümlesinin bittiği saniye */
export const cs = (b: number, n: number) => cum(b, n).son;
/** bölüm sahnesinin açıldığı saniye: önceki bölümün sonu ile bu bölümün başı arasındaki sessizliğin ortası */
export const giris = (b: number) => (b <= ILK ? 0 : (bolum(b - 1).son + bolum(b).bas) / 2);
/** bölüm sahnesinin kapandığı saniye (= sonraki bölümün girişi; son bölümde video sonu) */
export const cikis = (b: number) => (b >= SON ? ZAMAN.toplamSn : giris(b + 1));

// ---------------------------------------------------------------- kısımlar (üst takip çubuğu)
export type Kisim = { harf: string; roma: string; ad: string; ilk: number; son: number };
export const KISIMLAR: Kisim[] = [
  { harf: "A", roma: "I", ad: "Fabrika", ilk: 1, son: 7 },
  { harf: "B", roma: "II", ad: "Senaryo ve ses", ilk: 8, son: 17 },
  { harf: "C", roma: "III", ad: "Zaman, görüntü, kontrol", ilk: 18, son: 30 },
  { harf: "D", roma: "IV", ad: "Bir videonun yapılışı", ilk: 31, son: 46 },
  { harf: "E", roma: "V", ad: "Maliyet ve strateji", ilk: 47, son: 60 },
  { harf: "F", roma: "VI", ad: "Hatalar ve hediye", ilk: 61, son: 74 },
];
export const kisim = (b: number) => KISIMLAR.find((x) => b >= x.ilk && b <= x.son) ?? KISIMLAR[KISIMLAR.length - 1];

/** f karesinde ekranda olan (en yeni) bölüm */
export const aktifBolum = (f: number) => {
  let b = ILK;
  for (const B of BOLUMLER) if (f >= k(giris(B.no))) b = B.no;
  return b;
};

const kolay = Easing.inOut(Easing.cubic);

export const TakipCubugu: React.FC<{ f: number }> = ({ f }) => {
  const b = aktifBolum(f);
  const K = kisim(b);
  const ilerleme = ara(f, k(giris(K.ilk)), k(cikis(K.son)));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 92, display: "flex", alignItems: "center", justifyContent: "center", gap: 22, background: `${RENK.kagit}E6` }}>
      {KISIMLAR.map((x, i) => {
        const simdi = x === K;
        const gecti = x.son < K.ilk;
        return (
          <React.Fragment key={x.harf}>
            {i > 0 && <span style={{ fontFamily: SERIF, fontSize: 38, color: RENK.murekkep, opacity: 0.35 }}>·</span>}
            <span style={{ position: "relative", fontFamily: SERIF, fontSize: simdi ? 42 : 38, color: RENK.murekkep, opacity: simdi ? 1 : gecti ? 0.62 : 0.32, whiteSpace: "nowrap" }}>
              {simdi ? `${x.roma} · ${x.ad}` : x.roma}
              {simdi && <span style={{ position: "absolute", left: 0, bottom: -4, height: 4, width: `${ilerleme * 100}%`, background: RENK.kirmizi, borderRadius: 2 }} />}
            </span>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 6, borderTop: `2px solid ${RENK.murekkep}`, borderBottom: `1px solid ${RENK.murekkep}`, height: 4, opacity: 0.55 }} />
    </div>
  );
};

// ---------------------------------------------------------------- künye (sol alt)
export const Kunye: React.FC<{ sayfa: number }> = ({ sayfa }) => (
  <div style={{ position: "absolute", left: 60, bottom: 26, fontFamily: SERIF, fontStyle: "italic", fontSize: 36, color: RENK.murekkep, opacity: 0.78 }}>
    W.J. Sidis · Defter, s. {sayfa}
  </div>
);

// ---------------------------------------------------------------- sahne: gazete katlanır, yenisi baskıdan düşer
export const KATLA_KARE = 11; // eski sayfa ikiye katlanır (cikis'ten önce)
export const DUS_KARE = 15; // yeni sayfa yukarıdan iner (giris'ten sonra); eski sayfa altında kalır

const SayfaArkasi: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${RENK.kagitKoyu}, ${RENK.kagit})` }}>
    <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${RENK.murekkep}14 1.3px, transparent 1.6px)`, backgroundSize: "11px 11px" }} />
  </div>
);

/** Video.tsx her bölümü bununla sarar: kâğıt zemin + künye + katlanma/düşme geçişi. f mutlak kare. */
export const Sahne: React.FC<{ b: number; f: number; children: React.ReactNode }> = ({ b, f, children }) => {
  const G0 = k(giris(b));
  const G1 = k(cikis(b));
  const sayfa = (
    <>
      <Kagit />
      {children}
      <Kunye sayfa={b} />
    </>
  );
  // giriş: baskı makinesinden düşer
  const dus = b <= ILK ? 1 : spring({ frame: f - G0, fps: FPS, config: { damping: 17, stiffness: 120, mass: 0.8 } });
  const katla = b >= SON ? 0 : ara(f, G1 - KATLA_KARE, G1, kolay);
  const gidis = b >= SON ? 0 : ara(f, G1, G1 + DUS_KARE, Easing.in(Easing.quad));

  if (katla <= 0) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", transform: `translateY(${(1 - dus) * -H}px) rotate(${(1 - dus) * -1.5}deg)`, boxShadow: dus < 1 ? "0 18px 40px rgba(40,30,10,0.35)" : undefined }}>
        {sayfa}
      </div>
    );
  }
  const aci = katla * 180;
  const yari = (ust: boolean): React.CSSProperties => ({ position: "absolute", inset: 0, overflow: "hidden", clipPath: ust ? "inset(0 0 50% 0)" : "inset(50% 0 0 0)" });
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2600, transform: `translateY(${gidis * 260}px) scale(${1 - katla * 0.04})`, opacity: 1 - gidis * 0.7 }}>
      <div style={yari(false)}>
        {sayfa}
        <div style={{ position: "absolute", inset: 0, background: "#2a1e0a", opacity: katla * 0.28 }} />
      </div>
      {aci <= 90 ? (
        <div style={{ ...yari(true), transformOrigin: "50% 50%", transform: `rotateX(${-aci}deg)` }}>
          {sayfa}
          <div style={{ position: "absolute", inset: 0, background: "#2a1e0a", opacity: (aci / 90) * 0.35 }} />
        </div>
      ) : (
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H / 2, transformOrigin: "50% 100%", transform: `rotateX(${-aci}deg)`, overflow: "hidden" }}>
          <SayfaArkasi />
          <div style={{ position: "absolute", inset: 0, background: "#2a1e0a", opacity: ((180 - aci) / 90) * 0.3 }} />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: H / 2 - 1, height: 2, background: RENK.murekkep, opacity: katla * 0.25 }} />
    </div>
  );
};

// ---------------------------------------------------------------- giriş/çıkış (saniye ile)
/** bas..son (saniye) arasında baskıdan iner gibi görünür; Katman'ın saniyeli hali. */
export const Gir: React.FC<{ bas: number; son?: number; x: number; y: number; w?: number; aci?: number; children: React.ReactNode }> = ({ bas, son, x, y, w, aci = 0, children }) => {
  const f = useCurrentFrame();
  const g0 = k(bas);
  const g1 = son === undefined ? Infinity : k(son);
  if (f < g0 - 1 || f > g1 + 7) return null;
  const sp = spring({ frame: f - g0, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const kapan = Number.isFinite(g1) ? ara(f, g1, g1 + 7, Easing.out(Easing.cubic)) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity: Math.min(1, sp * 1.6) * (1 - kapan), transform: `translateY(${(1 - sp) * -40 - kapan * 30}px) scale(${0.9 + 0.1 * sp}) rotate(${aci}deg)`, transformOrigin: "50% 0%" }}>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- daktiloyla yazılan, satır kıran başlık
/** Harfler bas'tan itibaren yazılır (yazSn sürede); yerleşim sabit kalır (yazılmamış kısım saydam). */
export const Manset: React.FC<{ metin: string; bas: number; yazSn?: number; boy?: number; renk?: string; font?: "serif" | "mono" | "sans"; hiza?: "left" | "center"; imlec?: boolean }> = ({
  metin, bas, yazSn, boy = 76, renk = RENK.murekkep, font = "serif", hiza = "left", imlec = true,
}) => {
  const f = useCurrentFrame();
  const sure = yazSn ?? Math.min(2.4, 0.03 * metin.length + 0.3);
  const n = Math.round(ara(f, k(bas), k(bas + sure)) * metin.length);
  const yaziyor = n > 0 && n < metin.length;
  const aile = font === "serif" ? SERIF : font === "mono" ? MONO : SANS;
  return (
    <div style={{ fontFamily: aile, fontSize: boy, lineHeight: 1.08, color: renk, textAlign: hiza, fontWeight: font === "sans" ? 800 : 400 }}>
      {metin.slice(0, n)}
      {imlec && f >= k(bas) && (yaziyor || Math.floor(f / 12) % 2 === 0) && (
        <span style={{ display: "inline-block", width: boy * 0.08, height: boy * 0.86, verticalAlign: "-0.1em", background: RENK.kirmizi, marginLeft: 4 }} />
      )}
      <span style={{ opacity: 0 }}>{metin.slice(n)}</span>
    </div>
  );
};

// ---------------------------------------------------------------- rozetler
/** küçük kırmızı "gerçek ekran kaydı" rozeti (yanıp sönen kayıt noktası) */
export const GercekRozet: React.FC<{ metin?: string }> = ({ metin = "gerçek ekran kaydı" }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 16px 7px 12px", background: RENK.kirmizi, color: RENK.kagitAcik, fontFamily: SANS, fontWeight: 600, fontSize: 34, borderRadius: 6, transform: "rotate(-1.5deg)", boxShadow: "3px 4px 0 rgba(27,26,23,0.18)", whiteSpace: "nowrap" }}>
      <span style={{ width: 14, height: 14, borderRadius: 7, background: RENK.kagitAcik, opacity: Math.floor(f / 15) % 2 === 0 ? 1 : 0.25 }} />
      {metin}
    </div>
  );
};

/** hız rozeti: ×2, ×6, ×16 — damga kenarlı */
export const HizRozeti: React.FC<{ hiz: number; renk?: string }> = ({ hiz, renk = RENK.murekkep }) => (
  <div style={{ display: "inline-block", padding: "2px 16px 4px", border: `4px solid ${renk}`, outline: `2px solid ${renk}`, outlineOffset: 3, color: renk, background: `${RENK.kagitAcik}F0`, fontFamily: MONO, fontWeight: 700, fontSize: 40, borderRadius: 6, transform: "rotate(3deg)" }}>
    ×{hiz}
  </div>
);

// ---------------------------------------------------------------- çerçeveli ekran: gerçek ekran görüntüsü dizisi
/** renders/sidis-uzun/pub/kare/NN/ içindeki kare sayıları (820×679 PNG, 000.png'den başlar) */
export const KARE_SAYISI: Record<number, number> = { 1: 24, 2: 19, 3: 17, 4: 14, 5: 20, 6: 12, 7: 13, 8: 18, 9: 24, 10: 16 };
export const KARE_W = 820;
export const KARE_H = 679;
export const kareYolu = (klasor: number, i: number) => staticFile(`kare/${String(klasor).padStart(2, "0")}/${String(i).padStart(3, "0")}.png`);

/**
 * Gerçek claude.ai görüntülerini bas..son (saniye) aralığına yayıp çapraz geçişle oynatır.
 * kareler verilmezse klasördeki tüm kareler sırayla. Yükseklik = w*679/820 + 54 (başlık çubuğu).
 */
export const Ekran: React.FC<{
  klasor: number; bas: number; son: number; x: number; y: number; w: number;
  kareler?: number[]; hiz?: number; rozet?: boolean; baslik?: string; aci?: number; gorunSon?: number;
}> = ({ klasor, bas, son, x, y, w, kareler, hiz, rozet = true, baslik = "claude.ai", aci = 0, gorunSon }) => {
  const f = useCurrentFrame();
  const liste = kareler ?? Array.from({ length: KARE_SAYISI[klasor] ?? 1 }, (_, i) => i);
  const t = ara(f, k(bas), k(son)) * liste.length;
  const i = Math.min(liste.length - 1, Math.floor(t));
  const yerel = t - i;
  const sonraki = i + 1 < liste.length ? interpolate(yerel, [0.72, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const ih = Math.round((w * KARE_H) / KARE_W);
  const zum = 1 + 0.035 * ara(f, k(bas), k(son));
  return (
    <Gir bas={bas} son={gorunSon ?? son} x={x} y={y} w={w} aci={aci}>
      <div style={{ position: "relative", width: w, border: `4px solid ${RENK.murekkep}`, borderRadius: 12, background: RENK.kagitAcik, boxShadow: "8px 10px 0 rgba(27,26,23,0.16)", overflow: "hidden" }}>
        <div style={{ height: 50, borderBottom: `3px solid ${RENK.murekkep}`, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
          {[0, 1, 2].map((j) => (
            <span key={j} style={{ width: 16, height: 16, borderRadius: 8, border: `3px solid ${RENK.murekkep}` }} />
          ))}
          <span style={{ marginLeft: 14, fontFamily: MONO, fontSize: 26, color: RENK.mavi }}>{baslik}</span>
        </div>
        <div style={{ position: "relative", width: w - 8, height: ih, overflow: "hidden", background: "#fff" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${zum})`, transformOrigin: "50% 30%" }}>
            <Img src={kareYolu(klasor, liste[i])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            {sonraki > 0 && <Img src={kareYolu(klasor, liste[i + 1])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: sonraki }} />}
          </div>
        </div>
      </div>
      {rozet && (
        <div style={{ position: "absolute", left: -18, bottom: -26 }}>
          <GercekRozet />
        </div>
      )}
      {hiz !== undefined && (
        <div style={{ position: "absolute", right: -22, top: -30 }}>
          <HizRozeti hiz={hiz} />
        </div>
      )}
    </Gir>
  );
};

// ---------------------------------------------------------------- kırmızı mürekkep işaretleri (çizilerek gelir)
type Isaret = { bas: number; sure?: number; son?: number; renk?: string; kalin?: number };
const cizim = (f: number, bas: number, sure: number, son?: number) => ({
  p: ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad)),
  op: son === undefined ? 1 : 1 - ara(f, k(son), k(son) + 8),
  gorunur: f >= k(bas) - 1 && (son === undefined || f <= k(son) + 8),
});
const Tuval: React.FC<{ op: number; children: React.ReactNode }> = ({ op, children }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: op, pointerEvents: "none" }}>
    {children}
  </svg>
);
const cizgiStil = (renk: string, kalin: number, p: number) => ({
  fill: "none", stroke: renk, strokeWidth: kalin, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p,
});

/** elle çizilmiş elips: (x,y) sol üst, w×h kutuyu çevreler; 1,1 tur döner */
export const Daire: React.FC<Isaret & { x: number; y: number; w: number; h: number; tohum?: string }> = ({ x, y, w, h, bas, sure = 0.5, son, renk = RENK.kirmizi, kalin = 6, tohum = "d" }) => {
  const f = useCurrentFrame();
  const z = cizim(f, bas, sure, son);
  if (!z.gorunur) return null;
  const cx = x + w / 2, cy = y + h / 2, n = 48;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = -2.2 + (i / n) * Math.PI * 2 * 1.1;
    const r = 1 + 0.05 * Math.sin(i * 0.7 + random(tohum) * 6) + (i / n) * 0.05;
    return `${(cx + Math.cos(a) * (w / 2 + 14) * r).toFixed(1)},${(cy + Math.sin(a) * (h / 2 + 12) * r).toFixed(1)}`;
  });
  return (
    <Tuval op={z.op}>
      <path d={`M${pts.join(" L")}`} {...cizgiStil(renk, kalin, z.p)} />
    </Tuval>
  );
};

const dalgaliCizgi = (x: number, y: number, w: number, tohum: string) => {
  const n = 12;
  return "M" + Array.from({ length: n + 1 }, (_, i) => `${(x + (i / n) * w).toFixed(1)},${(y + (random(tohum + i) - 0.5) * 5 + (i / n) * 3).toFixed(1)}`).join(" L");
};

/** altını çiz: (x,y) çizginin sol ucu, w genişlik */
export const AltCizgi: React.FC<Isaret & { x: number; y: number; w: number; cift?: boolean; tohum?: string }> = ({ x, y, w, bas, sure = 0.35, son, renk = RENK.kirmizi, kalin = 6, cift, tohum = "a" }) => {
  const f = useCurrentFrame();
  const z = cizim(f, bas, sure, son);
  if (!z.gorunur) return null;
  return (
    <Tuval op={z.op}>
      <path d={dalgaliCizgi(x, y, w, tohum)} {...cizgiStil(renk, kalin, z.p)} />
      {cift && <path d={dalgaliCizgi(x + 10, y + 13, w - 20, tohum + "2")} {...cizgiStil(renk, kalin * 0.7, ara(f, k(bas + sure * 0.6), k(bas + sure * 1.6)))} />}
    </Tuval>
  );
};

/** üstünü çiz (strikethrough): (x,y) yazının ortası hizasında sol uç */
export const UstunuCiz: React.FC<Isaret & { x: number; y: number; w: number; tohum?: string }> = ({ x, y, w, bas, sure = 0.3, son, renk = RENK.kirmizi, kalin = 7, tohum = "u" }) => {
  const f = useCurrentFrame();
  const z = cizim(f, bas, sure, son);
  if (!z.gorunur) return null;
  return (
    <Tuval op={z.op}>
      <path d={`M${x},${y + 6} Q${x + w / 2},${y - 8 + random(tohum) * 6} ${x + w},${y - 4}`} {...cizgiStil(renk, kalin, z.p)} />
    </Tuval>
  );
};

/** kavisli ok: (x1,y1)'den (x2,y2)'ye; egri = kavis (+/- yön) */
export const Ok: React.FC<Isaret & { x1: number; y1: number; x2: number; y2: number; egri?: number }> = ({ x1, y1, x2, y2, bas, sure = 0.45, son, renk = RENK.kirmizi, kalin = 6, egri = 0.25 }) => {
  const f = useCurrentFrame();
  const z = cizim(f, bas, sure, son);
  if (!z.gorunur) return null;
  const mx = (x1 + x2) / 2 - (y2 - y1) * egri;
  const my = (y1 + y2) / 2 + (x2 - x1) * egri;
  const aci = Math.atan2(y2 - my, x2 - mx);
  const uc = 26;
  const kol = (d: number) => `${(x2 - Math.cos(aci + d) * uc).toFixed(1)},${(y2 - Math.sin(aci + d) * uc).toFixed(1)}`;
  const ucP = ara(f, k(bas + sure * 0.85), k(bas + sure) + 4);
  return (
    <Tuval op={z.op}>
      <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} {...cizgiStil(renk, kalin, z.p)} />
      <path d={`M${kol(0.5)} L${x2},${y2} L${kol(-0.5)}`} {...cizgiStil(renk, kalin, ucP)} />
    </Tuval>
  );
};

// ---------------------------------------------------------------- yer tutucu sahne (kısım dosyaları bunun yerine gerçek sahne koyar)
export const YerTutucu: React.FC<{ b: number }> = ({ b }) => {
  const K = kisim(b);
  return (
    <>
      <Gir bas={giris(b)} x={160} y={200} w={1600}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.kirmizi, letterSpacing: 2, marginBottom: 24 }}>
          {K.roma} · {K.ad.toLocaleUpperCase("tr")} — No. {b}
        </div>
        <div style={{ borderTop: `3px solid ${RENK.murekkep}`, borderBottom: `1px solid ${RENK.murekkep}`, height: 5, marginBottom: 40 }} />
      </Gir>
      <div style={{ position: "absolute", left: 160, top: 330, width: 1600 }}>
        <Manset metin={cum(b, 1).metin} bas={c(b, 1)} boy={92} />
      </div>
    </>
  );
};

/** a..b aralığındaki bölümleri YerTutucu'ya eşler (kısım dosyalarında başlangıç) */
export const yerTutucular = (a: number, b: number): Record<number, React.FC<{ b: number }>> =>
  Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, YerTutucu]));

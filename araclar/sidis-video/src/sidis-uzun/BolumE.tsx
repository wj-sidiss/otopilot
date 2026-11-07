// Kısım E — "V · Maliyet ve strateji" (bölüm 47–60).
// Bütün ipuçları zaman.json'dan (bölüm, cümle) ile okunur. Cümle İÇİ ipuçları saniye değil, cümle süresinin ORANIdır (p(n, 0.5)),
// böylece gerçek ses gelince her şey orantılı olarak yerine oturur. Sahneler mutlak kare kullanır (Sequence yok).
import React from "react";
import { Easing, interpolate, random, useCurrentFrame } from "remotion";
import {
  AltCizgi, Balon, Daire, Dalga, Damga, Daktilo, Gir, H, MONO, Manset, Ok, Pencere, Poz, RENK, SANS, SERIF, UstunuCiz, W, WJ,
  ara, c, cikis, cs, k, yerTutucular,
} from "./Ortak";

type SahneFC = React.FC<{ b: number }>;

// ---------------------------------------------------------------- zaman kısayolları
/** t(n): n. cümlenin başı; p(n, x): n. cümlenin x oranındaki an; e(n): n. cümlenin sonu; son: sayfa kapanışı */
const zam = (b: number) => ({
  t: (n: number) => c(b, n),
  e: (n: number) => cs(b, n),
  p: (n: number, x: number) => c(b, n) + (cs(b, n) - c(b, n)) * x,
  son: cikis(b),
});
const kolay = Easing.inOut(Easing.cubic);

// ---------------------------------------------------------------- yazı stilleri
const ys = (boy: number, font: "serif" | "mono" | "sans" = "serif", renk = RENK.murekkep, ek?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: font === "serif" ? SERIF : font === "mono" ? MONO : SANS,
  fontSize: boy,
  lineHeight: 1.08,
  color: renk,
  fontWeight: font === "sans" ? 600 : 400,
  ...ek,
});

// ---------------------------------------------------------------- yardımcı parçalar (bu dosyaya özel)
/** mürekkeple çizilerek gelen serbest yol (mutlak 1920×1080 koordinat) */
const Cizim: React.FC<{ d: string; bas: number; sure?: number; son?: number; renk?: string; kalin?: number; dolgu?: string; dolguOp?: number }> = ({
  d, bas, sure = 0.6, son, renk = RENK.murekkep, kalin = 5, dolgu, dolguOp = 1,
}) => {
  const f = useCurrentFrame();
  if (f < k(bas) - 1) return null;
  if (son !== undefined && f > k(son) + 8) return null;
  const p = ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad));
  const op = son === undefined ? 1 : 1 - ara(f, k(son), k(son) + 8);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: op, pointerEvents: "none" }}>
      {dolgu && <path d={d} fill={dolgu} stroke="none" opacity={dolguOp * ara(f, k(bas + sure * 0.6), k(bas + sure) + 6)} />}
      <path d={d} fill="none" stroke={renk} strokeWidth={kalin} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

/** küçük onay işareti (x,y sol üst) */
const Tik: React.FC<{ x: number; y: number; bas: number; son?: number; renk?: string; boy?: number }> = ({ x, y, bas, son, renk = RENK.mavi, boy = 1 }) => (
  <Cizim d={`M${x} ${y + 22 * boy} L${x + 15 * boy} ${y + 40 * boy} L${x + 44 * boy} ${y}`} bas={bas} sure={0.3} son={son} renk={renk} kalin={7} />
);
/** küçük çarpı */
const Carpi: React.FC<{ x: number; y: number; bas: number; son?: number; boy?: number }> = ({ x, y, bas, son, boy = 40 }) => (
  <Cizim d={`M${x} ${y} L${x + boy} ${y + boy} M${x + boy} ${y} L${x} ${y + boy}`} bas={bas} sure={0.3} son={son} renk={RENK.kirmizi} kalin={7} />
);

/** damgayı bir konuma vurur; son verilirse solar */
const DamgaVur: React.FC<{ id: string; t: number; x: number; y: number; metin: string; boy?: number; aci?: number; son?: number; renk?: string }> = ({ id, t, x, y, metin, boy = 70, aci = -8, son, renk }) => {
  const f = useCurrentFrame();
  if (f < k(t) - 1) return null;
  if (son !== undefined && f > k(son) + 7) return null;
  const op = son === undefined ? 1 : 1 - ara(f, k(son), k(son) + 7);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: op }}>
      <Damga id={id} metin={metin} yas={f - k(t)} boy={boy} aci={aci} renk={renk} />
    </div>
  );
};

/** bilet/fiş kartı — etiketler ≥34 px (Bilet'in küçük etiketleri yerine) */
const Kart: React.FC<{ ust: string; w: number; degerBoy?: number; degerRenk?: string; ustRenk?: string; children: React.ReactNode }> = ({
  ust, w, degerBoy = 96, degerRenk = RENK.murekkep, ustRenk = RENK.kirmizi, children,
}) => (
  <div style={{ position: "relative", width: w, background: RENK.bilet, border: `4px solid ${RENK.murekkep}`, borderRadius: 10, display: "flex", boxShadow: "6px 7px 0 rgba(27,26,23,0.14)", boxSizing: "border-box" }}>
    <div style={{ width: 38, borderRight: `3px dashed ${RENK.murekkep}`, backgroundImage: `radial-gradient(${RENK.murekkep}55 2px, transparent 2.5px)`, backgroundSize: "14px 14px" }} />
    <div style={{ flex: 1, padding: "12px 22px 14px" }}>
      <div style={ys(34, "sans", ustRenk, { letterSpacing: 3 })}>{ust}</div>
      <div style={ys(degerBoy, "serif", degerRenk, { lineHeight: 1.02, whiteSpace: "nowrap" })}>{children}</div>
    </div>
  </div>
);

/** sayaç: bas'tan itibaren 0 → hedef */
const say = (f: number, bas: number, hedef: number, sure = 1.1) => Math.round(hedef * ara(f, k(bas), k(bas + sure), Easing.out(Easing.cubic)));

/** video kapağı taslağı (16:9) */
const Kapak: React.FC<{ w: number; oynat?: boolean; cizgi?: number; children?: React.ReactNode; zemin?: string }> = ({ w, oynat = true, cizgi = 2, children, zemin = RENK.kagitAcik }) => {
  const h = Math.round((w * 9) / 16);
  return (
    <div style={{ width: w }}>
      <div style={{ position: "relative", width: w, height: h, border: `4px solid ${RENK.murekkep}`, borderRadius: 10, background: zemin, overflow: "hidden", boxShadow: "6px 7px 0 rgba(27,26,23,0.14)", boxSizing: "border-box" }}>
        {children}
        {oynat && (
          <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
            <circle cx={w / 2} cy={h / 2} r={h * 0.17} fill={RENK.kagit} stroke={RENK.murekkep} strokeWidth={4} />
            <path d={`M${w / 2 - h * 0.05} ${h / 2 - h * 0.08} L${w / 2 + h * 0.09} ${h / 2} L${w / 2 - h * 0.05} ${h / 2 + h * 0.08} Z`} fill={RENK.murekkep} />
          </svg>
        )}
      </div>
      {Array.from({ length: cizgi }, (_, i) => (
        <div key={i} style={{ height: 14, width: `${i === 0 ? 92 : 58}%`, background: RENK.murekkep, opacity: i === 0 ? 0.75 : 0.35, borderRadius: 7, marginTop: 14 }} />
      ))}
    </div>
  );
};

/** telefon çerçevesi */
const Telefon: React.FC<{ w: number; h: number; children?: React.ReactNode }> = ({ w, h, children }) => (
  <div style={{ width: w, height: h, border: `8px solid ${RENK.murekkep}`, borderRadius: 44, background: RENK.kagitAcik, padding: 12, boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.16)", position: "relative" }}>
    <div style={{ position: "absolute", left: "50%", top: 8, width: 80, height: 12, marginLeft: -40, borderRadius: 6, background: RENK.murekkep }} />
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 28, border: `3px solid ${RENK.murekkep}`, background: RENK.kagit, overflow: "hidden", boxSizing: "border-box" }}>{children}</div>
  </div>
);

/** büyüteç (mürekkep çizimi) */
const Buyutec: React.FC<{ boy?: number }> = ({ boy = 170 }) => (
  <svg width={boy} height={boy} viewBox="0 0 170 170" style={{ overflow: "visible", display: "block" }}>
    <circle cx={64} cy={64} r={52} fill={`${RENK.kagitAcik}99`} stroke={RENK.murekkep} strokeWidth={8} />
    <path d="M36 50 Q44 32 64 28" fill="none" stroke={RENK.murekkep} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
    <line x1={102} y1={102} x2={156} y2={156} stroke={RENK.murekkep} strokeWidth={20} strokeLinecap="round" />
  </svg>
);

/** saat: ibreler hızla döner (saatlerce) */
const Saat: React.FC<{ boy: number; f: number; hiz?: number }> = ({ boy, f, hiz = 1 }) => (
  <svg width={boy} height={boy} viewBox="0 0 200 200" style={{ display: "block", overflow: "visible" }}>
    <circle cx={100} cy={100} r={90} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={7} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <line key={i} x1={100 + Math.cos(a) * 74} y1={100 + Math.sin(a) * 74} x2={100 + Math.cos(a) * (i % 3 === 0 ? 60 : 66)} y2={100 + Math.sin(a) * (i % 3 === 0 ? 60 : 66)} stroke={RENK.murekkep} strokeWidth={i % 3 === 0 ? 6 : 3} strokeLinecap="round" />;
    })}
    <line x1={100} y1={100} x2={100} y2={50} stroke={RENK.murekkep} strokeWidth={8} strokeLinecap="round" transform={`rotate(${f * 1.2 * hiz} 100 100)`} />
    <line x1={100} y1={100} x2={100} y2={30} stroke={RENK.kirmizi} strokeWidth={5} strokeLinecap="round" transform={`rotate(${f * 14 * hiz} 100 100)`} />
    <circle cx={100} cy={100} r={8} fill={RENK.murekkep} />
  </svg>
);

/** madde başlığı: kırmızı halkalı numara + serif başlık (sol üst) */
const Madde: React.FC<{ no: string; metin: string; bas: number }> = ({ no, metin, bas }) => (
  <Gir bas={bas} x={120} y={112} w={1680}>
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ width: 72, height: 72, borderRadius: 36, border: `5px solid ${RENK.kirmizi}`, display: "flex", alignItems: "center", justifyContent: "center", ...ys(54, "serif", RENK.kirmizi) }}>{no}</div>
      <div style={ys(64)}>{metin}</div>
    </div>
  </Gir>
);

/** üst başlık (yazılarak gelir) */
const Ust: React.FC<{ metin: string; bas: number; son?: number; boy?: number; renk?: string }> = ({ metin, bas, son, boy = 64, renk }) => (
  <Gir bas={bas} son={son} x={120} y={112} w={1680}>
    <Manset metin={metin} bas={bas} boy={boy} renk={renk} imlec={false} />
  </Gir>
);

/** W.J.'yi poz değiştirerek gösterir; her poz değişiminde küçük sarsılma */
const WJAkis: React.FC<{ pozlar: [number, Poz][]; x: number; y: number; boy: number; son?: number; gulumse?: boolean }> = ({ pozlar, x, y, boy, son, gulumse }) => {
  const f = useCurrentFrame();
  let poz = pozlar[0][1];
  let t0 = pozlar[0][0];
  for (const [t, pz] of pozlar) if (f >= k(t)) { poz = pz; t0 = t; }
  return (
    <Gir bas={pozlar[0][0]} son={son} x={x} y={y}>
      <WJ poz={poz} yas={f - k(t0)} f={f} boy={boy} gulumse={gulumse} fikir={poz === "dusunen" ? f - k(t0) - 10 : -1} />
    </Gir>
  );
};

// ================================================================ 47 — maliyet defteri
const S47: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p, son } = zam(b);
  const satirlar: { n: number; kalem: string; not: string; tutar: string; renk: string }[] = [
    { n: 3, kalem: "Senaryo", not: "Claude aboneliğimin içinde", tutar: "ek maliyet yok", renk: RENK.mavi },
    { n: 4, kalem: "Ses", not: "kendi klonum", tutar: "bedava", renk: RENK.mavi },
    { n: 5, kalem: "Hazır ses", not: "yarım saatlik bir video", tutar: "birkaç yüz kredi", renk: RENK.murekkep },
    { n: 6, kalem: "Görüntü", not: "tamamen kodla", tutar: "bedava", renk: RENK.mavi },
    { n: 7, kalem: "Müzik", not: "parça başına", tutar: "birkaç düzine kredi", renk: RENK.murekkep },
    { n: 8, kalem: "Gerçekçi video klipleri", not: "neredeyse hiç kullanmıyorum", tutar: "", renk: RENK.kirmizi },
  ];
  const SATIR_Y = 150;
  const SATIR_H = 100;
  return (
    <>
      <Ust metin="Bu iş kaça mal oluyor?" bas={t(1)} />
      {/* defter */}
      <Gir bas={p(1, 0.55)} x={110} y={210} w={1290}>
        <div style={{ position: "relative", width: 1290, height: 775, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, boxShadow: "8px 10px 0 rgba(27,26,23,0.15)", boxSizing: "border-box" }}>
          <div style={{ position: "absolute", left: 24, top: 14, ...ys(56) }}>Dürüst bir tablo</div>
          <div style={{ position: "absolute", left: 24, right: 24, top: 84, borderTop: `3px solid ${RENK.kirmizi}`, borderBottom: `1.5px solid ${RENK.kirmizi}`, height: 5 }} />
          <div style={{ position: "absolute", left: 22, top: 100, ...ys(34, "sans", RENK.murekkep, { opacity: 0.55, letterSpacing: 3 }) }}>KALEM</div>
          <div style={{ position: "absolute", left: 388, top: 100, ...ys(34, "sans", RENK.murekkep, { opacity: 0.55, letterSpacing: 3 }) }}>NOT</div>
          <div style={{ position: "absolute", left: 948, top: 100, ...ys(34, "sans", RENK.murekkep, { opacity: 0.55, letterSpacing: 3 }) }}>TUTAR</div>
          {/* cetvel çizgileri + sütun kenarları */}
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: SATIR_Y + (i + 1) * SATIR_H, borderTop: `2px solid ${RENK.mavi}44` }} />
          ))}
          <div style={{ position: "absolute", left: 372, top: 96, bottom: 0, borderLeft: `2px solid ${RENK.kirmizi}88` }} />
          <div style={{ position: "absolute", left: 932, top: 96, bottom: 0, borderLeft: `2px solid ${RENK.kirmizi}88` }} />
          {satirlar.map((r, i) => {
            const tut = ara(f, k(p(r.n, 0.42)), k(p(r.n, 0.42)) + 8);
            return (
              <Gir key={r.n} bas={t(r.n)} x={0} y={SATIR_Y + i * SATIR_H} w={1282}>
                <div style={{ display: "flex", alignItems: "center", height: SATIR_H }}>
                  <div style={{ width: 372, paddingLeft: 22, boxSizing: "border-box", ...ys(r.kalem.length > 12 ? 42 : 48, "serif", RENK.murekkep, { lineHeight: 0.98 }) }}>{r.kalem}</div>
                  <div style={{ width: 560, padding: "0 14px 0 18px", boxSizing: "border-box", ...ys(34, "mono", RENK.murekkep, { lineHeight: 1.12, opacity: 0.85 }) }}>{r.not}</div>
                  <div style={{ flex: 1, paddingLeft: 18, opacity: tut, transform: `translateX(${(1 - tut) * 20}px)`, ...ys(48, "serif", r.renk, { lineHeight: 1 }) }}>
                    {r.n === 8 ? <Damga id="e47pahali" metin="PAHALI" yas={f - k(p(8, 0.35))} boy={50} aci={-6} /> : r.tutar}
                  </div>
                </div>
              </Gir>
            );
          })}
        </div>
      </Gir>
      {/* "ses bedava, ama ekran kartı..." */}
      <Ok x1={1260} y1={210 + SATIR_Y + 1 * SATIR_H + 50} x2={1470} y2={520} egri={-0.2} bas={p(4, 0.45)} son={t(6) - 0.1} />
      {/* pahalı ama kullanmıyorum */}
      <Daire x={128 + 390} y={210 + SATIR_Y + 5 * SATIR_H + 8} w={520} h={84} bas={p(8, 0.62)} sure={0.6} />
      {/* sağ sütun: W.J. → saat → W.J. */}
      <WJAkis pozlar={[[t(1), "dusunen"], [t(2), "normal"]]} x={1475} y={360} boy={560} son={t(4) - 0.1} />
      <Gir bas={t(4)} son={t(6) - 0.1} x={1450} y={300} w={400}>
        <div style={{ ...ys(36, "sans", RENK.murekkep, { textAlign: "center", letterSpacing: 2 }) }}>ekran kartı</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <Saat boy={300} f={f} hiz={2.4} />
        </div>
        <div style={{ ...ys(68, "serif", RENK.kirmizi, { textAlign: "center", marginTop: 10 }) }}>saatlerce</div>
      </Gir>
      <WJAkis pozlar={[[t(6), "gosteren"], [t(7), "normal"], [t(8), "saskin"], [p(8, 0.62), "omuz"]]} x={1475} y={360} boy={560} son={son} />
    </>
  );
};

// ================================================================ 48 — zaman ve sabır
const S48: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p, son } = zam(b);
  // takvim: haftalar boyunca günler çarpılır
  const kutu = 86, bosluk = 12, sx = 200, sy = 300, gun = 28;
  const xP = ara(f, k(t(2)), k(p(3, 0.1)));
  const OLMAMIS_YER: [number, number][] = [
    [180, 300], [620, 320], [1080, 290], [1480, 330], [380, 470], [860, 450], [1300, 490],
    [160, 640], [600, 620], [1060, 650], [1500, 640], [360, 800], [900, 810],
  ];
  const olmamis = OLMAMIS_YER.map(([x, y], i) => ({
    x: x + (random(`ox${i}`) - 0.5) * 60,
    y: y + (random(`oy${i}`) - 0.5) * 40,
    aci: -16 + random(`oa${i}`) * 26,
    t: p(3, 0.04 + (i / OLMAMIS_YER.length) * 0.85),
  }));
  // basamak grafiği: her yeni video biraz daha iyi
  const basamak = Array.from({ length: 7 }, (_, i) => [300 + i * 200, 860 - i * 75] as const);
  const basamakD = "M" + basamak.map(([x, y], i) => (i === 0 ? `${x} ${y}` : `${x} ${basamak[i - 1][1]} L${x} ${y}`)).join(" L") + ` L${300 + 7 * 200} ${860 - 6 * 75}`;
  return (
    <>
      {/* 1: para değil — zaman ve sabır */}
      <Gir bas={t(1)} son={t(2) - 0.1} x={160} y={200} w={1600}>
        <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 4 })}>BU FABRİKANIN ASIL MALİYETİ</div>
      </Gir>
      <Gir bas={p(1, 0.15)} son={t(2) - 0.1} x={200} y={330}>
        <div style={ys(170)}>para</div>
      </Gir>
      <UstunuCiz x={190} y={440} w={330} bas={p(1, 0.45)} son={t(2) - 0.1} kalin={10} />
      <Gir bas={p(1, 0.6)} son={t(2) - 0.1} x={700} y={330}>
        <div style={ys(170, "serif", RENK.kirmizi)}>zaman ve sabır</div>
      </Gir>
      <AltCizgi x={700} y={530} w={1000} bas={p(1, 0.85)} son={t(2) - 0.1} cift />
      {/* üst başlık 2'den sonra kalır */}
      <Ust metin="Asıl maliyet: zaman ve sabır" bas={t(2)} />
      {/* 2: ilk kurulum — haftalar */}
      <Gir bas={t(2)} son={t(3) - 0.1} x={sx - 20} y={sy - 30} w={7 * (kutu + bosluk) + 40}>
        <div style={{ position: "relative", width: 7 * (kutu + bosluk) + 40, height: 4 * (kutu + bosluk) + 50, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, boxSizing: "border-box" }}>
          <svg width={7 * (kutu + bosluk) + 40} height={4 * (kutu + bosluk) + 50} style={{ position: "absolute", left: 0, top: 0 }}>
            {Array.from({ length: gun }, (_, i) => {
              const x = 20 + (i % 7) * (kutu + bosluk);
              const y = 26 + Math.floor(i / 7) * (kutu + bosluk);
              const q = Math.max(0, Math.min(1, xP * gun - i));
              return (
                <g key={i}>
                  <rect x={x} y={y} width={kutu} height={kutu} fill="none" stroke={RENK.murekkep} strokeWidth={2.5} opacity={0.6} />
                  {q > 0 && <path d={`M${x + 14} ${y + 14} L${x + kutu - 14} ${y + kutu - 14} M${x + kutu - 14} ${y + 14} L${x + 14} ${y + kutu - 14}`} stroke={RENK.kirmizi} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - q} fill="none" />}
                </g>
              );
            })}
          </svg>
        </div>
      </Gir>
      <Gir bas={t(2)} son={t(3) - 0.1} x={1000} y={360} w={760}>
        <div style={ys(70)}>İlk kurulum</div>
        <div style={ys(150, "serif", RENK.kirmizi)}>haftalar</div>
      </Gir>
      {/* 3: yüzlerce deneme, yüzlerce ret */}
      <Gir bas={t(3)} son={t(4) - 0.1} x={160} y={205} w={1600}>
        <div style={ys(66)}>Yüzlerce deneme, yüzlerce beğenmediğim şey</div>
      </Gir>
      {olmamis.map((o, i) => (
        <DamgaVur key={i} id={`e48o${i}`} t={o.t} x={o.x} y={o.y} metin="OLMAMIŞ" boy={42} aci={o.aci} son={t(4) - 0.1} />
      ))}
      {/* 4: günlerce → saatlerce */}
      <Gir bas={t(4)} son={t(5) - 0.1} x={200} y={360}>
        <Kart ust="ÖNCE · BİR VİDEO FİKRİ" w={640} degerBoy={120}>günlerce</Kart>
      </Gir>
      <UstunuCiz x={280} y={478} w={470} bas={p(4, 0.3)} son={t(5) - 0.1} kalin={9} />
      <Ok x1={860} y1={470} x2={1060} y2={470} egri={-0.2} bas={p(4, 0.45)} son={t(5) - 0.1} />
      <Gir bas={p(4, 0.55)} son={t(5) - 0.1} x={1090} y={360}>
        <Kart ust="ŞİMDİ" w={640} degerBoy={120} degerRenk={RENK.mavi} ustRenk={RENK.mavi}>saatlerce</Kart>
      </Gir>
      <Gir bas={p(4, 0.7)} son={t(5) - 0.1} x={1310} y={640}>
        <Saat boy={200} f={f} hiz={1.5} />
      </Gir>
      {/* 5: her yeni videoda biraz daha iyi */}
      <Gir bas={t(5)} son={t(6) - 0.1} x={160} y={205} w={1600}>
        <div style={ys(66)}>Her yeni videoda sistem biraz daha iyi</div>
      </Gir>
      <Cizim d={`M250 900 L1750 900 M250 900 L250 330`} bas={t(5)} sure={0.4} son={t(6) - 0.1} kalin={4} />
      <Cizim d={basamakD} bas={p(5, 0.15)} sure={2.6} son={t(6) - 0.1} renk={RENK.mavi} kalin={9} />
      {basamak.map(([x], i) => (
        <Gir key={i} bas={p(5, 0.15 + i * 0.1)} son={t(6) - 0.1} x={x + 40} y={915}>
          <div style={ys(34, "sans", RENK.murekkep, { opacity: 0.6 })}>video</div>
        </Gir>
      ))}
      {/* 6: hata → kural */}
      <Gir bas={t(6)} x={220} y={400}>
        <div style={{ padding: "26px 50px", border: `6px solid ${RENK.kirmizi}`, borderRadius: 12, background: RENK.kagitAcik, transform: "rotate(-3deg)", ...ys(110, "sans", RENK.kirmizi, { fontWeight: 900, letterSpacing: 6 }) }}>HATA</div>
      </Gir>
      <Ok x1={720} y1={490} x2={1060} y2={490} egri={-0.25} bas={p(6, 0.3)} kalin={8} />
      <Gir bas={p(6, 0.5)} x={1100} y={330} w={620}>
        <Pencere baslik="kurallar" w={620}>
          <div style={ys(56, "serif", RENK.murekkep)}>+ bir kural</div>
          <div style={{ height: 14, width: "80%", background: RENK.murekkep, opacity: 0.3, borderRadius: 7, marginTop: 24 }} />
          <div style={{ height: 14, width: "55%", background: RENK.murekkep, opacity: 0.3, borderRadius: 7, marginTop: 18 }} />
        </Pencere>
      </Gir>
    </>
  );
};

// ================================================================ 49 — kurallar dosyası
const S49: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const konusuyor = (f >= k(t(3)) && f < k(e5(b))) || (f >= k(t(6)) && f < k(p(6, 0.5)));
  const okuyor = f >= k(p(6, 0.45)) && f < k(t(7));
  const kurallar = [
    { n: 4, metin: "1. Kullanıcı başla demeden kredi harcama." },
    { n: 5, metin: "2. Video için önceki videonun müziğini taşıma, her videoya sıfırdan başla." },
  ];
  return (
    <>
      <Gir bas={t(1)} son={t(8) - 0.1} x={120} y={112} w={1680}>
        <div style={ys(62)}>“Her hatayı bir kurala çeviriyorum.”</div>
      </Gir>
      <AltCizgi x={330} y={188} w={560} bas={p(1, 0.45)} son={t(8) - 0.1} />
      <Gir bas={t(8)} x={120} y={112} w={1680}>
        <Manset metin="Fabrikanın hafızası bu." bas={t(8)} boy={72} renk={RENK.kirmizi} imlec={false} />
      </Gir>
      {/* 1: W.J. açıklıyor */}
      <WJAkis pozlar={[[t(1), "gosteren"]]} x={760} y={360} boy={560} son={t(2) - 0.1} />
      {/* Daktilo (Claude) */}
      <Gir bas={t(2)} x={130} y={560}>
        <Daktilo f={f} boy={420} konusuyor={konusuyor} goz={f >= k(t(7)) && f < k(p(7, 0.9)) ? "kirpGoz" : "acik"} bak={okuyor ? [8, -3] : [-6, 2]} />
      </Gir>
      {/* 2: sadece "düzelt" demiyorum */}
      <Gir bas={t(2)} son={t(3) - 0.1} x={140} y={240}>
        <Balon w={460} h={190} kuyrukX={220}>
          <div style={ys(80)}>“düzelt”</div>
        </Balon>
      </Gir>
      <UstunuCiz x={220} y={338} w={300} bas={p(2, 0.45)} son={t(3) - 0.1} kalin={9} />
      <Gir bas={p(2, 0.55)} son={t(3) - 0.1} x={720} y={300} w={900}>
        <div style={ys(60)}>sadece “düzelt” demiyorum</div>
      </Gir>
      {/* 3+: kurallar dosyası */}
      <Gir bas={t(3)} x={700} y={230} w={1110}>
        <Pencere baslik="kurallar" w={1110}>
          <div style={{ minHeight: 600 }}>
            <div style={ys(44, "sans", RENK.kirmizi, { letterSpacing: 2 })}>
              <Manset metin="her hata → bir kural + nedeni" bas={p(3, 0.15)} boy={44} font="sans" renk={RENK.kirmizi} imlec={false} />
            </div>
            <div style={{ borderTop: `2px solid ${RENK.murekkep}`, opacity: 0.3, margin: "14px 0 18px" }} />
            {kurallar.map((r) => (
              <div key={r.n} style={{ marginBottom: 16, minHeight: r.n === 5 ? 120 : 60 }}>
                <Manset metin={r.metin} bas={t(r.n) + 0.1} yazSn={(cs(b, r.n) - c(b, r.n)) * 0.7} boy={38} font="mono" imlec={f < k(t(r.n + 1))} />
                <div style={{ height: 12, width: r.n === 4 ? "48%" : "62%", background: RENK.mavi, opacity: 0.35 * ara(f, k(p(r.n, 0.85)), k(p(r.n, 0.85)) + 8), borderRadius: 6, marginTop: 10, marginLeft: 58 }} />
              </div>
            ))}
            {/* 6: dosya büyüyor */}
            {Array.from({ length: 4 }, (_, i) => {
              const g = ara(f, k(p(6, 0.08 + i * 0.1)), k(p(6, 0.08 + i * 0.1)) + 7);
              return (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20, opacity: g, transform: `translateY(${(1 - g) * -14}px)` }}>
                  <div style={ys(38, "mono", RENK.murekkep, { opacity: 0.6 })}>{i + 3}.</div>
                  <div style={{ height: 16, width: [620, 760, 540, 700][i], background: RENK.murekkep, opacity: 0.32, borderRadius: 8 }} />
                </div>
              );
            })}
          </div>
        </Pencere>
      </Gir>
      {/* 6: her işin başında okunuyor */}
      <Ok x1={760} y1={760} x2={560} y2={700} egri={0.25} bas={p(6, 0.5)} son={t(7) - 0.1} renk={RENK.mavi} />
      <Gir bas={p(6, 0.55)} son={t(7) - 0.1} x={130} y={300} w={560}>
        <div style={ys(54, "serif", RENK.mavi)}>her yeni işin başında okunuyor</div>
      </Gir>
      {/* 7: aynı hata ikinci kez olmuyor */}
      <DamgaVur id="e49ikinci" t={t(7)} x={960} y={720} metin="İKİNCİ KEZ YOK" boy={62} aci={-7} />
      {/* 8: hafıza */}
      <Daire x={712} y={240} w={1086} h={640} bas={t(8)} sure={0.6} kalin={7} />
    </>
  );
};
const e5 = (b: number) => cs(b, 5);

// ================================================================ 50 — fabrikanın dışı: vidIQ
const S50: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const cx = 520, cy = 580, r = 250;
  const kanallar = [0, 1, 2, 3];
  const lupX = interpolate(f, [k(p(5, 0.1)), k(p(5, 0.95))], [180, 1500], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: kolay });
  return (
    <>
      {/* 1–2: işin iki yarısı */}
      <Gir bas={t(1)} son={t(3) - 0.1} x={120} y={112} w={1680}>
        <div style={ys(64)}>Fabrikanın dışına çıkalım</div>
      </Gir>
      <Cizim d={`M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r} Z`} bas={p(1, 0.3)} sure={0.8} son={t(3) - 0.1} kalin={7} dolgu={RENK.mavi} dolguOp={0.28} />
      <Cizim d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r}`} bas={t(2)} sure={0.8} son={t(3) - 0.1} kalin={7} renk={RENK.kirmizi} dolgu={RENK.kirmizi} dolguOp={0.22} />
      <Gir bas={p(1, 0.45)} son={t(3) - 0.1} x={880} y={330} w={900}>
        <div style={ys(40, "sans", RENK.mavi, { letterSpacing: 3 })}>YARISI</div>
        <div style={ys(76)}>video üretmek</div>
      </Gir>
      <Gir bas={p(2, 0.2)} son={t(3) - 0.1} x={880} y={560} w={900}>
        <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 3 })}>DİĞER YARISI</div>
        <div style={ys(76, "serif", RENK.kirmizi)}>ne üreteceğine karar vermek</div>
      </Gir>
      {/* 3: araç */}
      <Gir bas={t(3)} son={t(5) - 0.1} x={260} y={250}>
        <Kart ust="KULLANDIĞIM ARAÇ" w={720} degerBoy={150} degerRenk={RENK.mavi}>vidIQ</Kart>
      </Gir>
      <WJAkis pozlar={[[t(3), "gosteren"]]} x={1260} y={330} boy={560} son={t(4) - 0.1} />
      {/* 4: kanallar, videolar, başlıklar */}
      {["kanallar", "videolar", "başlıklar"].map((s, i) => (
        <Gir key={s} bas={p(4, 0.15 + i * 0.25)} son={t(5) - 0.1} x={200 + i * 540} y={640} w={480}>
          <div style={{ border: `4px solid ${RENK.murekkep}`, borderRadius: 10, background: RENK.kagitAcik, padding: "22px 26px", display: "flex", alignItems: "center", gap: 20, boxShadow: "6px 7px 0 rgba(27,26,23,0.14)" }}>
            <Buyutec boy={90} />
            <div style={ys(62)}>{s}</div>
          </div>
        </Gir>
      ))}
      <Gir bas={p(4, 0.2)} son={t(5) - 0.1} x={1060} y={330} w={760}>
        <div style={ys(56)}>YouTube'u analiz eden bir araç</div>
      </Gir>
      {/* 5: başka kanalları incelemek */}
      <Gir bas={t(5)} x={120} y={112} w={1680}>
        <Manset metin="En çok yaptığım şey: başka kanalları incelemek" bas={t(5)} boy={62} imlec={false} />
      </Gir>
      {kanallar.map((i) => (
        <Gir key={i} bas={p(5, 0.05 + i * 0.07)} x={170 + i * 410} y={360} w={360} aci={[-2, 1.5, -1, 2][i]}>
          <div style={{ border: `4px solid ${RENK.murekkep}`, borderRadius: 10, background: RENK.kagitAcik, padding: 22, height: 440, boxSizing: "border-box", boxShadow: "6px 7px 0 rgba(27,26,23,0.14)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 70, height: 70, borderRadius: 35, border: `4px solid ${RENK.murekkep}`, background: RENK.kagitKoyu }} />
              <div style={{ height: 18, width: 170, background: RENK.murekkep, borderRadius: 9 }} />
            </div>
            {[0, 1, 2].map((j) => (
              <div key={j} style={{ display: "flex", gap: 14, marginTop: 26 }}>
                <div style={{ width: 120, height: 68, border: `3px solid ${RENK.murekkep}`, borderRadius: 6, background: RENK.kagit }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, background: RENK.murekkep, opacity: 0.5, borderRadius: 6, marginTop: 8 }} />
                  <div style={{ height: 12, width: "60%", background: RENK.murekkep, opacity: 0.3, borderRadius: 6, marginTop: 12 }} />
                </div>
              </div>
            ))}
          </div>
        </Gir>
      ))}
      {f >= k(p(5, 0.1)) && (
        <div style={{ position: "absolute", left: lupX, top: 480 + Math.sin(f * 0.12) * 40, transform: "rotate(-8deg)" }}>
          <Buyutec boy={230} />
        </div>
      )}
    </>
  );
};

// ================================================================ 51 — yeni açılmış kanal (adı gösterilmez)
const S51: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const sayaclar = [
    { n: 2, ust: "AÇILALI", deger: () => `${say(f, t(2), 8, 0.8)} gün` },
    { n: 3, ust: "YÜKLENEN", deger: () => `${say(f, t(3), 11, 0.8)} video` },
    { n: 4, ust: "ABONE", deger: () => `${say(f, t(4), 500, 1.1).toLocaleString("tr-TR")}${f >= k(t(4) + 1.1) ? "+" : ""}` },
    { n: 5, ust: "İZLENME", deger: () => `≈ ${say(f, t(5), 30, 1.0)} bin` },
  ];
  const lup = ara(f, k(p(7, 0.15)), k(p(7, 0.95)), kolay);
  return (
    <>
      <Ust metin="Yeni açılmış bir kanal" bas={t(1)} />
      {/* kanal kesiği — adı karartılmış */}
      <Gir bas={t(1)} x={120} y={210} w={640} aci={-1.5}>
        <div style={{ position: "relative", width: 640, height: 730, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 6, padding: 30, boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.15)" }}>
          <div style={ys(36, "sans", RENK.kirmizi, { letterSpacing: 4 })}>YENİ KANAL</div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 22 }}>
            <div style={{ width: 120, height: 120, borderRadius: 60, border: `5px solid ${RENK.murekkep}`, background: RENK.kagitKoyu }} />
            <div>
              <div style={{ width: 340, height: 50, background: RENK.murekkep, transform: "rotate(-1deg)" }} />
              <div style={ys(34, "mono", RENK.murekkep, { opacity: 0.6, marginTop: 10 })}>adı gizli</div>
            </div>
          </div>
          {[0, 1, 2].map((j) => (
            <div key={j} style={{ display: "flex", gap: 18, marginTop: 34 }}>
              <div style={{ width: 210, height: 118, border: `3px solid ${RENK.murekkep}`, borderRadius: 6, background: RENK.kagit }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, background: RENK.murekkep, opacity: 0.55, borderRadius: 7, marginTop: 12 }} />
                <div style={{ height: 14, width: "70%", background: RENK.murekkep, opacity: 0.3, borderRadius: 7, marginTop: 14 }} />
              </div>
            </div>
          ))}
        </div>
      </Gir>
      {/* 7: parça parça — kesik makas çizgileri */}
      {[0, 1, 2].map((i) => (
        <Cizim key={i} d={`M110 ${420 + i * 152} L780 ${414 + i * 152}`} bas={p(7, 0.1 + i * 0.12)} sure={0.5} renk={RENK.kirmizi} kalin={5} />
      ))}
      {f >= k(p(7, 0.15)) && (
        <div style={{ position: "absolute", left: 200 + lup * 360, top: 300 + lup * 380, transform: "rotate(-10deg)", opacity: ara(f, k(p(7, 0.15)), k(p(7, 0.15)) + 6) }}>
          <Buyutec boy={240} />
        </div>
      )}
      {/* 2–5: sayaçlar */}
      {sayaclar.map((s, i) => (
        <Gir key={s.n} bas={t(s.n)} x={850 + (i % 2) * 500} y={210 + Math.floor(i / 2) * 280} w={460}>
          <Kart ust={s.ust} w={460} degerBoy={104}>
            {/* Instrument Serif'te "11" → "ll" okunuyor: rakamlar Inter */}
            {s.deger().split(/(\d[\d.]*)/).map((parca, j) => (/\d/.test(parca) ? <span key={j} style={{ fontFamily: SANS, fontWeight: 600, fontSize: 84, letterSpacing: 2 }}>{parca}</span> : parca))}
          </Kart>
        </Gir>
      ))}
      {/* 6: çok iyi bir başlangıç */}
      <DamgaVur id="e51iyi" t={p(6, 0.2)} x={940} y={790} metin="İYİ BAŞLANGIÇ" boy={60} aci={-6} />
    </>
  );
};

// ================================================================ 52 — ders değil, hikâye
const S52: SahneFC = ({ b }) => {
  const { t, p } = zam(b);
  return (
    <>
      <Madde no="1" metin="En çok izlenen videolar" bas={t(1)} />
      {/* A: iki video, aynı kalıp */}
      {[0, 1].map((i) => (
        <Gir key={i} bas={p(1, 0.35 + i * 0.25)} son={t(4) - 0.1} x={140 + i * 500} y={280} w={460} aci={i ? 1.5 : -1.5}>
          <div style={ys(34, "sans", RENK.kirmizi, { letterSpacing: 3, marginBottom: 10 })}>UZUN VİDEO {i + 1}</div>
          <Kapak w={460} />
        </Gir>
      ))}
      <DamgaVur id="e52kalip" t={p(2, 0.45)} x={300} y={640} metin="AYNI KALIP" boy={70} aci={-5} son={t(4) - 0.1} />
      <Gir bas={t(3)} son={t(4) - 0.1} x={1130} y={240}>
        <Balon w={660} h={300} kuyrukX={300}>
          <div style={{ ...ys(54), padding: "0 36px", textAlign: "center" }}>“Şu sorunu yaşadım, yapay zekâyla şunu kurdum.”</div>
        </Balon>
      </Gir>
      <WJAkis pozlar={[[t(3), "telefon"]]} x={1320} y={600} boy={380} son={t(4) - 0.1} />
      {/* B: ders değil, hikâye */}
      <Gir bas={t(4)} son={t(7) - 0.1} x={160} y={250} w={1600}>
        <div style={{ display: "flex", gap: 60, alignItems: "baseline" }}>
          <span style={ys(120)}>bir ders değil,</span>
          <span style={ys(120, "serif", RENK.kirmizi)}>bir hikâye</span>
        </div>
      </Gir>
      <UstunuCiz x={295} y={335} w={180} bas={p(4, 0.3)} son={t(7) - 0.1} kalin={9} />
      <Daire x={950} y={275} w={290} h={110} bas={p(4, 0.6)} son={t(7) - 0.1} />
      <Gir bas={t(5)} son={t(7) - 0.1} x={160} y={500} w={1600}>
        <div style={ys(40, "sans", RENK.murekkep, { letterSpacing: 3, opacity: 0.7 })}>İZLEYİCİNİN İZLEDİĞİ ŞEY</div>
        <div style={{ display: "flex", gap: 50, alignItems: "baseline", marginTop: 12 }}>
          <span style={ys(76)}>ürün tanıtımı</span>
        </div>
      </Gir>
      <UstunuCiz x={155} y={600} w={430} bas={p(5, 0.3)} son={t(7) - 0.1} kalin={8} />
      <Gir bas={p(5, 0.45)} son={t(7) - 0.1} x={160} y={650} w={1600}>
        <div style={ys(76, "serif", RENK.mavi)}>birinin bir sorunu nasıl çözdüğü</div>
      </Gir>
      <DamgaVur id="e52fark" t={t(6)} x={1180} y={760} metin="ÖNEMLİ FARK" boy={64} aci={-7} son={t(7) - 0.1} />
      {/* C: iki sütun */}
      {[
        { n: 7, ust: "DERS ANLATAN VİDEO", soz: "“ne öğreneceğim?”", renk: RENK.murekkep, x: 140 },
        { n: 8, ust: "HİKÂYE ANLATAN VİDEO", soz: "“sonu ne olacak?”", renk: RENK.kirmizi, x: 990 },
      ].map((s) => (
        <Gir key={s.n} bas={t(s.n)} x={s.x} y={300} w={790}>
          <div style={{ height: 520, border: `4px solid ${RENK.murekkep}`, borderRadius: 12, background: RENK.kagitAcik, padding: "36px 40px", boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.14)" }}>
            <div style={ys(40, "sans", s.renk, { letterSpacing: 3 })}>{s.ust}</div>
            <div style={{ borderTop: `3px solid ${RENK.murekkep}`, margin: "20px 0 40px", opacity: 0.5 }} />
            <div style={ys(40, "sans", RENK.murekkep, { opacity: 0.6 })}>şöyle izlenir:</div>
            <div style={ys(96, "serif", s.renk, { marginTop: 16 })}>{s.soz}</div>
          </div>
        </Gir>
      ))}
      <AltCizgi x={1040} y={760} w={640} bas={p(8, 0.6)} cift />
    </>
  );
};

// ================================================================ 53 — videoların içi
const S53: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const sutunlar = ["saniye", "ne var", "geçiş", "yazı tipi", "müzik"];
  // zaman şeridi: farklı genişlikte sahne blokları, oynatma kafası
  const bloklar = [3, 2, 4, 2.5, 3.5, 2, 3, 4, 2.5, 3];
  const toplam = bloklar.reduce((a, x) => a + x, 0);
  const kafa = ara(f, k(t(4)), k(t(6)));
  const ucSahne = [
    { t: p(6, 0.0), ad: "bir yazı geliyor" },
    { t: p(6, 0.33), ad: "bir çizgi çiziliyor" },
    { t: p(6, 0.66), ad: "bir damga vuruluyor" },
  ];
  return (
    <>
      <Madde no="2" metin="Videoların içi" bas={t(1)} />
      {/* A: film şeridi → tablo */}
      <Gir bas={p(1, 0.3)} son={t(4) - 0.1} x={150} y={250} w={440}>
        <div style={ys(40, "sans", RENK.mavi, { letterSpacing: 2, marginBottom: 12 })}>vidIQ · video izleme</div>
        <div style={{ width: 300, background: RENK.murekkep, borderRadius: 8, padding: "10px 36px", boxSizing: "border-box", position: "relative" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 130, background: RENK.kagitAcik, borderRadius: 4, marginBottom: 10, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 18, top: 22, width: 60 + random(`fs${i}`) * 100, height: 14, background: RENK.murekkep, opacity: 0.6, borderRadius: 7 }} />
              <div style={{ position: "absolute", left: 18 + random(`fc${i}`) * 80, top: 56, width: 52, height: 52, borderRadius: 26, border: `4px solid ${i % 2 ? RENK.kirmizi : RENK.mavi}` }} />
            </div>
          ))}
          {[0, 1].map((s) => (
            <div key={s} style={{ position: "absolute", top: 0, bottom: 0, [s ? "right" : "left"]: 8, width: 18, backgroundImage: `repeating-linear-gradient(180deg, ${RENK.kagitAcik} 0 14px, transparent 14px 30px)` } as React.CSSProperties} />
          ))}
        </div>
      </Gir>
      <Ok x1={500} y1={560} x2={760} y2={560} egri={-0.2} bas={p(2, 0.4)} son={t(4) - 0.1} renk={RENK.mavi} kalin={7} />
      <Gir bas={p(2, 0.55)} son={t(4) - 0.1} x={790} y={260} w={1000}>
        <div style={{ ...ys(40, "sans", RENK.murekkep, { letterSpacing: 2, marginBottom: 12 }) }}>sahne sahne döküm</div>
        <div style={{ border: `4px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.kagitAcik, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: `3px solid ${RENK.murekkep}`, background: RENK.kagitKoyu, height: 70 }}>
            {sutunlar.map((s, i) => {
              const g = ara(f, k(p(3, 0.05 + i * 0.17)), k(p(3, 0.05 + i * 0.17)) + 7);
              return (
                <div key={s} style={{ flex: 1, borderLeft: i ? `2px solid ${RENK.murekkep}55` : undefined, display: "flex", alignItems: "center", justifyContent: "center", opacity: g, ...ys(36, "sans", RENK.murekkep) }}>{s}</div>
              );
            })}
          </div>
          {Array.from({ length: 6 }, (_, r) => (
            <div key={r} style={{ display: "flex", height: 66, borderBottom: `2px solid ${RENK.mavi}33` }}>
              {sutunlar.map((s, i) => {
                const g = ara(f, k(p(3, 0.05 + i * 0.17)) + r * 3, k(p(3, 0.05 + i * 0.17)) + r * 3 + 6);
                return (
                  <div key={s} style={{ flex: 1, borderLeft: i ? `2px solid ${RENK.murekkep}22` : undefined, display: "flex", alignItems: "center", padding: "0 16px" }}>
                    <div style={{ height: 12, width: `${(35 + random(`t${r}${i}`) * 55) * g}%`, background: i === 0 ? RENK.mavi : RENK.murekkep, opacity: 0.45, borderRadius: 6 }} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Gir>
      {/* B: 2–4 saniyede bir değişiyor */}
      <Gir bas={t(4)} son={t(6) - 0.1} x={160} y={250} w={1600}>
        <div style={ys(80)}>
          görüntü her <span style={{ color: RENK.kirmizi }}>2–4 saniyede</span> bir değişiyor
        </div>
      </Gir>
      <Gir bas={p(4, 0.2)} son={t(6) - 0.1} x={160} y={480} w={1600}>
        <div style={{ position: "relative", display: "flex", height: 170, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.kagitAcik, overflow: "hidden" }}>
          {bloklar.map((x, i) => {
            const g = ara(f, k(p(4, 0.2)) + i * 3, k(p(4, 0.2)) + i * 3 + 6);
            return (
              <div key={i} style={{ width: `${(x / toplam) * 100}%`, borderLeft: i ? `4px solid ${RENK.murekkep}` : undefined, opacity: g, position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: 26, width: "62%", height: 14, background: RENK.murekkep, opacity: 0.5, borderRadius: 7 }} />
                <div style={{ position: "absolute", left: 12, top: 66, width: 46, height: 46, borderRadius: i % 3 === 0 ? 23 : 4, border: `4px solid ${[RENK.kirmizi, RENK.mavi, RENK.murekkep][i % 3]}` }} />
              </div>
            );
          })}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${kafa * 100}%`, width: 6, background: RENK.kirmizi }} />
        </div>
      </Gir>
      <Gir bas={t(5)} son={t(6) - 0.1} x={160} y={720} w={1600}>
        <div style={ys(72, "serif", RENK.kirmizi)}>Hiçbir an ekran boş kalmıyor.</div>
      </Gir>
      <AltCizgi x={160} y={815} w={900} bas={p(5, 0.5)} son={t(6) - 0.1} />
      {/* C: yazı, çizgi, damga — söylenen kelimeyle aynı anda */}
      <Gir bas={ucSahne[0].t} x={160} y={260} w={560}>
        <Manset metin="bir yazı geliyor" bas={ucSahne[0].t} boy={72} />
      </Gir>
      <Gir bas={ucSahne[1].t} x={760} y={260} w={500}>
        <div style={ys(72)}>bir çizgi</div>
      </Gir>
      <AltCizgi x={760} y={360} w={440} bas={ucSahne[1].t + 0.2} sure={0.5} cift />
      <DamgaVur id="e53damga" t={ucSahne[2].t} x={1330} y={250} metin="DAMGA" boy={74} aci={-8} />
      <Gir bas={t(7)} x={160} y={730} w={1600}>
        <div style={ys(64)}>
          ve hepsi, <span style={{ color: RENK.kirmizi }}>söylenen kelimeyle aynı anda</span>
        </div>
      </Gir>
      <Gir bas={p(7, 0.2)} x={160} y={500} w={1600}>
        <Dalga tur="canli" w={1600} h={150} f={f} renk={RENK.mavi} cubuk={80} />
      </Gir>
      {[420, 1000, 1560].map((x, i) => (
        <Cizim key={i} d={`M${x} 560 L${x} 385`} bas={p(7, 0.35 + i * 0.12)} sure={0.35} renk={RENK.kirmizi} kalin={5} />
      ))}
    </>
  );
};

// ================================================================ 54 — kimlik
const S54: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const sayfa = (i: number) => (
    <div style={{ width: 420, height: 540, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 6, padding: 30, boxSizing: "border-box", boxShadow: "6px 8px 0 rgba(27,26,23,0.15)", backgroundImage: `radial-gradient(${RENK.murekkep}18 1.4px, transparent 1.8px)`, backgroundSize: "12px 12px" }}>
      <div style={{ height: 22, width: "80%", background: RENK.murekkep, borderRadius: 4 }} />
      <div style={{ borderTop: `3px solid ${RENK.murekkep}`, margin: "20px 0" }} />
      {[0, 1, 2, 3, 4].map((j) => (
        <div key={j} style={{ height: 12, width: `${60 + random(`s${i}${j}`) * 35}%`, background: RENK.murekkep, opacity: 0.35, borderRadius: 6, marginTop: 18 }} />
      ))}
      <div style={{ marginTop: 34, width: 120, height: 150, border: `4px solid ${RENK.murekkep}`, borderRadius: "60px 60px 10px 10px" }} />
    </div>
  );
  return (
    <>
      <Madde no="3" metin="Kanalın kimliği" bas={t(1)} />
      {/* 1: boş kalmasın — "kimlik" kartı + düşünen W.J. */}
      <Gir bas={p(1, 0.35)} son={t(2) - 0.1} x={560} y={380} w={620} aci={-2}>
        <Kart ust="ÜÇÜNCÜ BAKTIĞIM" w={620} degerBoy={120} degerRenk={RENK.kirmizi}>kimlik</Kart>
      </Gir>
      <Gir bas={p(1, 0.15)} son={t(2) - 0.1} x={1340} y={330}>
        <WJ poz="dusunen" yas={f - k(p(1, 0.15))} f={f} boy={520} />
      </Gir>
      {/* 2–3: aynı defterden */}
      {[0, 1, 2].map((i) => (
        <Gir key={i} bas={p(2, 0.1 + i * 0.2)} son={t(4) - 0.1} x={220 + i * 150} y={250 + i * 30} aci={-6 + i * 6}>
          {sayfa(i)}
        </Gir>
      ))}
      <Gir bas={p(2, 0.5)} son={t(3) - 0.1} x={1060} y={380} w={760}>
        <div style={ys(80)}>hepsi aynı defterden çıkmış gibi</div>
      </Gir>
      {["aynı kâğıt dokusu", "aynı mürekkep", "aynı karakter"].map((s, i) => (
        <Gir key={s} bas={p(3, 0.05 + i * 0.3)} son={t(4) - 0.1} x={1160} y={300 + i * 180} w={680}>
          <div style={ys(66, "serif", i === 2 ? RENK.kirmizi : RENK.murekkep)}>{s}</div>
        </Gir>
      ))}
      {[0, 1, 2].map((i) => (
        <Ok key={i} x1={1140} y1={340 + i * 180} x2={[860, 840, 740][i]} y2={[380, 460, 690][i]} egri={0.15} bas={p(3, 0.12 + i * 0.3)} son={t(4) - 0.1} kalin={5} />
      ))}
      {/* 4: ikincisini görünce tanıyor */}
      {[0, 1].map((i) => (
        <Gir key={i} bas={p(4, i * 0.3)} son={t(5) - 0.1} x={200 + i * 860} y={330} w={660}>
          <div style={ys(40, "sans", RENK.murekkep, { letterSpacing: 3, marginBottom: 10, opacity: 0.7 })}>{i ? "İKİNCİ VİDEO" : "BİR VİDEO"}</div>
          <Kapak w={660} zemin={RENK.kagit} />
        </Gir>
      ))}
      <Gir bas={p(4, 0.4)} son={t(5) - 0.1} x={900} y={480}>
        <div style={ys(150, "serif", RENK.kirmizi)}>=</div>
      </Gir>
      <Daire x={1060} y={400} w={660} h={360} bas={p(4, 0.6)} son={t(5) - 0.1} />
      <Gir bas={p(4, 0.7)} son={t(5) - 0.1} x={1100} y={850} w={700}>
        <div style={ys(56, "serif", RENK.kirmizi)}>hemen tanınıyor</div>
      </Gir>
      {/* 5: biçim aldım, kimliği kendim kurdum */}
      <Gir bas={t(5)} son={t(6) - 0.1} x={200} y={320}>
        <Kart ust="BİÇİM" w={700} degerBoy={110} ustRenk={RENK.mavi} degerRenk={RENK.mavi}>aldım</Kart>
      </Gir>
      <Gir bas={p(5, 0.5)} son={t(6) - 0.1} x={1020} y={320}>
        <Kart ust="KİMLİK" w={700} degerBoy={110}>kendim kurdum</Kart>
      </Gir>
      <Tik x={790} y={380} bas={p(5, 0.3)} son={t(6) - 0.1} boy={1.3} />
      {/* 6: onların tarihi figürü / benim Sidis'im */}
      <Gir bas={t(6)} son={t(7) - 0.1} x={260} y={250} w={560}>
        <div style={ys(40, "sans", RENK.murekkep, { letterSpacing: 3, opacity: 0.7 })}>ONLARIN</div>
        <div style={{ width: 460, height: 560, marginTop: 14, border: `4px dashed ${RENK.murekkep}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${RENK.kagitKoyu}88` }}>
          <div style={{ textAlign: "center", ...ys(56) }}>bir tarihi<br />figür</div>
        </div>
      </Gir>
      <Gir bas={p(6, 0.45)} son={t(7) - 0.1} x={1100} y={250} w={560}>
        <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 3 })}>BENİM</div>
      </Gir>
      <WJAkis pozlar={[[p(6, 0.45), "omuz"]]} x={1120} y={320} boy={560} son={t(7) - 0.1} gulumse />
      <Gir bas={p(6, 0.6)} son={t(7) - 0.1} x={1500} y={600}>
        <div style={ys(110, "serif", RENK.kirmizi)}>Sidis</div>
      </Gir>
      {/* 7: biçim serbest, kimlik değil */}
      <Gir bas={t(7)} x={200} y={330} w={1500}>
        <div style={ys(96, "serif", RENK.mavi)}>Biçimi öğrenmek serbest,</div>
      </Gir>
      <Gir bas={p(7, 0.45)} x={200} y={520} w={1500}>
        <div style={ys(96)}>kimliği kopyalamak değil.</div>
      </Gir>
      <AltCizgi x={200} y={450} w={980} bas={p(7, 0.3)} renk={RENK.mavi} />
      <UstunuCiz x={190} y={585} w={690} bas={p(7, 0.75)} kalin={9} />
    </>
  );
};

// ================================================================ 55 — analizin maliyeti + üç soru
const S55: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const sorular = ["En çok izlenen videolar hangi kalıpta?", "Görüntü kaç saniyede bir değişiyor?", "Kanalı bir bakışta tanıtan şey ne?"];
  return (
    <>
      <Ust metin="Bu analiz kaça mal oldu?" bas={t(1)} son={t(4) - 0.1} />
      {/* 2: fiş */}
      <Gir bas={p(1, 0.5)} son={t(4) - 0.1} x={180} y={230} w={820} aci={-1}>
        <div style={{ width: 820, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 6, padding: "28px 40px 34px", boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.15)" }}>
          <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 4 })}>ANALİZ FİŞİ · vidIQ</div>
          <div style={{ borderTop: `3px dashed ${RENK.murekkep}`, margin: "18px 0 22px", opacity: 0.6 }} />
          {[
            { tt: t(2), s: "2 uzun video izletmek" },
            { tt: p(2, 0.4), s: "1 kısa video izletmek" },
          ].map((r, i) => (
            <div key={i} style={{ opacity: ara(f, k(r.tt), k(r.tt) + 7), transform: `translateX(${(1 - ara(f, k(r.tt), k(r.tt) + 7)) * -20}px)`, ...ys(54, "mono", RENK.murekkep, { marginBottom: 18, fontSize: 44 }) }}>
              {r.s}
            </div>
          ))}
          <div style={{ borderTop: `3px dashed ${RENK.murekkep}`, margin: "10px 0 18px", opacity: 0.6 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: ara(f, k(p(2, 0.65)), k(p(2, 0.65)) + 6) }}>
            <span style={ys(48, "sans", RENK.murekkep, { letterSpacing: 2 })}>TOPLAM</span>
            <span style={ys(110, "serif", RENK.kirmizi)}>≈ {say(f, p(2, 0.65), 80, 1.0)} kredi</span>
          </div>
        </div>
      </Gir>
      {/* 3: bir saatte çözmek — ucuz */}
      <Gir bas={t(3)} son={t(4) - 0.1} x={1170} y={240} w={620}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Saat boy={300} f={f} hiz={3} />
        </div>
        <div style={ys(60, "serif", RENK.murekkep, { textAlign: "center", marginTop: 20 })}>bir rakip kanal,</div>
        <div style={ys(60, "serif", RENK.mavi, { textAlign: "center" })}>bir saatte</div>
      </Gir>
      <DamgaVur id="e55ucuz" t={p(3, 0.55)} x={1240} y={780} metin="UCUZ" boy={84} aci={-9} son={t(4) - 0.1} />
      {/* 4–7: üç soru kartı */}
      <Gir bas={t(4)} x={150} y={200} w={1220} aci={-0.8}>
        <div style={{ width: 1220, height: 680, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, padding: "40px 56px", boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.15)", backgroundImage: `repeating-linear-gradient(180deg, transparent 0 79px, ${RENK.mavi}33 79px 81px)`, backgroundPosition: "0 150px" }}>
          <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 4 })}>KENDİN YAPMAK İSTERSEN</div>
          <div style={ys(74, "serif", RENK.murekkep, { marginTop: 6 })}>şu üç soruyu sor</div>
          <div style={{ borderTop: `3px solid ${RENK.kirmizi}`, margin: "20px 0 30px" }} />
          {sorular.map((s, i) => {
            const g = ara(f, k(t(5 + i)), k(t(5 + i)) + 8);
            return (
              <div key={i} style={{ display: "flex", gap: 26, alignItems: "flex-start", marginBottom: 40, opacity: g, transform: `translateY(${(1 - g) * -20}px)` }}>
                <div style={{ flex: "0 0 auto", width: 76, height: 76, borderRadius: 38, border: `5px solid ${RENK.kirmizi}`, display: "flex", alignItems: "center", justifyContent: "center", ...ys(54, "serif", RENK.kirmizi) }}>{i + 1}</div>
                <div style={ys(64, "serif", RENK.murekkep, { paddingTop: 0 })}>{s}</div>
              </div>
            );
          })}
        </div>
      </Gir>
      <WJAkis pozlar={[[t(4), "gosteren"], [t(5), "dusunen"], [t(6), "normal"], [t(7), "dusunen"]]} x={1430} y={400} boy={560} />
    </>
  );
};

// ================================================================ 56 — başlık
const S56: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const adimlar = ["fikir", "senaryo", "ses", "görüntü", "başlık"];
  const yeniSira = [0, 2, 3, 4, 1];
  const m = ara(f, k(p(3, 0.3)), k(p(3, 0.3)) + 22, kolay);
  const kx = (i: number) => 170 + i * 320;
  const imX = interpolate(f, [k(p(1, 0.35)), k(p(1, 0.85))], [1500, 980], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: kolay });
  const ornekler = [
    { n: 6, a: "Sesimi klonladım,", b: "burnumdan konuşuyordum." },
    { n: 7, a: "Hazır araç bulamadım,", b: "kendi video fabrikamı kurdum." },
  ];
  const s8 = ara(f, k(p(8, 0.05)), k(p(8, 0.05)) + 10);
  const s8b = ara(f, k(p(8, 0.5)), k(p(8, 0.5)) + 10);
  return (
    <>
      {/* 1: tıklanmazsa izlenmez */}
      <Gir bas={t(1)} son={t(2) - 0.1} x={120} y={112} w={1680}>
        <Manset metin="En iyi video bile tıklanmazsa izlenmez." bas={t(1)} boy={64} imlec={false} />
      </Gir>
      <Gir bas={p(1, 0.2)} son={t(2) - 0.1} x={600} y={300} w={720}>
        <Kapak w={720} />
      </Gir>
      {f >= k(p(1, 0.3)) && f < k(t(2)) && (
        <svg width={80} height={100} viewBox="0 0 80 100" style={{ position: "absolute", left: imX, top: 520 + Math.sin(f * 0.15) * 20, overflow: "visible" }}>
          <path d="M6 4 L6 78 L26 60 L40 92 L54 86 L40 55 L66 55 Z" fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      )}
      <Gir bas={p(1, 0.7)} son={t(2) - 0.1} x={1380} y={380} w={440}>
        <div style={ys(66, "serif", RENK.kirmizi)}>tık yok,<br />izlenme yok</div>
      </Gir>
      {/* 2–4: başlık önce */}
      <Gir bas={t(2)} son={t(5) - 0.1} x={120} y={112} w={1680}>
        <div style={ys(64)}>Başlığı en sona bırakmıyorum</div>
      </Gir>
      {adimlar.map((s, i) => {
        const x = interpolate(m, [0, 1], [kx(i), kx(yeniSira[i])]);
        const zip = i === 4 ? Math.sin(m * Math.PI) * -150 : 0;
        const cizik = i === 4 ? ara(f, k(p(2, 0.45)), k(p(2, 0.45)) + 8) * (1 - m) : 0;
        const vurgu = i === 4 ? m : 0;
        return (
          <Gir key={s} bas={t(2) + i * 0.12} son={t(5) - 0.1} x={x} y={360 + zip} w={290}>
            <div style={{ position: "relative", width: 290, height: 130, border: `${4 + vurgu * 3}px solid ${vurgu > 0.5 ? RENK.kirmizi : RENK.murekkep}`, borderRadius: 10, background: RENK.kagitAcik, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", boxShadow: "5px 6px 0 rgba(27,26,23,0.14)", ...ys(54, "serif", i === 4 ? RENK.kirmizi : RENK.murekkep) }}>
              {s}
              {cizik > 0 && <div style={{ position: "absolute", left: 20, top: 62, height: 8, width: 250 * cizik, background: RENK.kirmizi, borderRadius: 4, transform: "rotate(-4deg)" }} />}
            </div>
          </Gir>
        );
      })}
      {[0, 1, 2, 3].map((i) => (
        <Gir key={i} bas={t(2) + 0.3} son={t(5) - 0.1} x={kx(i) + 292} y={398}>
          <div style={ys(44, "serif", RENK.murekkep, { opacity: 0.5 })}>→</div>
        </Gir>
      ))}
      <Gir bas={p(3, 0.65)} son={t(5) - 0.1} x={kx(1)} y={530} w={600}>
        <div style={ys(60, "serif", RENK.kirmizi)}>önce başlık</div>
      </Gir>
      <Gir bas={t(4)} son={t(5) - 0.1} x={170} y={700} w={1600}>
        <div style={ys(60)}>iyi başlık yok → fikir de yeterince net değil</div>
      </Gir>
      <DamgaVur id="e56net" t={p(4, 0.6)} x={1240} y={800} metin="NET DEĞİL" boy={58} aci={-6} son={t(5) - 0.1} />
      {/* 5–8: sorun + sonuç */}
      <Gir bas={t(5)} x={120} y={112} w={1680}>
        <div style={ys(68)}>
          Başlık = <span style={{ color: RENK.kirmizi }}>bir sorun</span> + <span style={{ color: RENK.mavi }}>bir sonuç</span>
        </div>
      </Gir>
      {/* 5: iki boş kalıp — sorun + sonuç */}
      <Gir bas={p(5, 0.3)} son={t(6) - 0.1} x={200} y={380} w={1520}>
        <div style={{ display: "flex", alignItems: "center", gap: 50 }}>
          <div style={{ width: 620, height: 260, border: `5px dashed ${RENK.kirmizi}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", ...ys(84, "serif", RENK.kirmizi) }}>bir sorun</div>
          <div style={ys(110)}>+</div>
          <div style={{ width: 620, height: 260, border: `5px dashed ${RENK.mavi}`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", opacity: ara(f, k(p(5, 0.6)), k(p(5, 0.6)) + 8), ...ys(84, "serif", RENK.mavi) }}>bir sonuç</div>
        </div>
      </Gir>
      {ornekler.map((o, i) => (
        <Gir key={o.n} bas={t(o.n)} x={150} y={300 + i * 290} w={1640}>
          <div style={ys(36, "sans", RENK.murekkep, { letterSpacing: 3, opacity: 0.65, marginBottom: 10 })}>ÖRNEK {i + 1}</div>
          <div style={{ display: "flex", gap: 22, alignItems: "flex-start", border: `4px solid ${RENK.murekkep}`, borderRadius: 10, background: RENK.kagitAcik, padding: "22px 30px 18px", boxShadow: "6px 7px 0 rgba(27,26,23,0.14)" }}>
            <div>
              <div style={{ ...ys(62), borderBottom: `6px solid ${RENK.kirmizi}`, borderBottomColor: `rgba(200,48,44,${s8})`, paddingBottom: 4 }}>{o.a}</div>
              <div style={{ ...ys(40, "sans", RENK.kirmizi, { marginTop: 8, opacity: s8 }) }}>merak</div>
            </div>
            <div>
              <div style={{ ...ys(62), borderBottom: `6px solid rgba(42,79,143,${s8b})`, paddingBottom: 4 }}>{o.b}</div>
              <div style={{ ...ys(40, "sans", RENK.mavi, { marginTop: 8, opacity: s8b }) }}>hikâye vaadi</div>
            </div>
          </div>
        </Gir>
      ))}
    </>
  );
};

// ================================================================ 57 — kapak
const S57: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  // 5: kapak telefona küçülür
  const kucul = ara(f, k(p(5, 0.25)), k(p(5, 0.25)) + 24, kolay);
  const TEL = { x: 1340, y: 220, w: 360, h: 700 };
  const ekranX = TEL.x + 20, ekranY = TEL.y + 140, ekranW = TEL.w - 40;
  const bx = 200, by = 330, bw = 800;
  const olcek = interpolate(kucul, [0, 1], [1, ekranW / bw]);
  const kx = interpolate(kucul, [0, 1], [bx, ekranX]);
  const ky = interpolate(kucul, [0, 1], [by, ekranY]);
  const sadeKapak = (w: number) => (
    <Kapak w={w} oynat={false} cizgi={0}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", left: 50 + (i % 2) * 360, top: 70 + Math.floor(i / 2) * 200, width: 310, height: 120, background: RENK.murekkep, borderRadius: 6, opacity: ara(f, k(p(4, 0.15 + i * 0.18)), k(p(4, 0.15 + i * 0.18)) + 6) }}>
          <div style={{ position: "absolute", left: 18, top: 10, ...ys(70, "serif", RENK.kagitAcik) }}>{i + 1}</div>
        </div>
      ))}
    </Kapak>
  );
  const kalabalik = (w: number) => (
    <Kapak w={w} oynat={false} cizgi={0}>
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: (20 + (i % 4) * 190) * (w / 800), top: (24 + Math.floor(i / 4) * 105) * (w / 800), width: (60 + random(`kb${i}`) * 110) * (w / 800), height: 12 * (w / 800), background: i % 5 === 0 ? RENK.kirmizi : RENK.murekkep, opacity: 0.7, borderRadius: 4 }} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <div key={"c" + i} style={{ position: "absolute", left: (60 + i * 150) * (w / 800), top: (70 + (i % 2) * 210) * (w / 800), width: 50 * (w / 800), height: 50 * (w / 800), borderRadius: "50%", border: `${Math.max(2, 3 * (w / 800))}px solid ${RENK.mavi}` }} />
      ))}
    </Kapak>
  );
  return (
    <>
      <Ust metin="Kapakta ise kural basit." bas={t(1)} />
      {/* 2: tekrar etme, tamamla */}
      <Gir bas={t(2)} son={t(3) - 0.1} x={200} y={300} w={1500}>
        <div style={ys(110)}>başlığı tekrar etme,</div>
      </Gir>
      <UstunuCiz x={458} y={368} w={445} bas={p(2, 0.35)} son={t(3) - 0.1} kalin={9} />
      <Gir bas={p(2, 0.45)} son={t(3) - 0.1} x={200} y={500} w={1500}>
        <div style={ys(110, "serif", RENK.kirmizi)}>başlığı tamamla</div>
      </Gir>
      <Daire x={508} y={505} w={298} h={100} bas={p(2, 0.7)} son={t(3) - 0.1} />
      {/* 3: başlık ne, kapak neden */}
      {[
        { tt: t(3), a: "BAŞLIK", s: "ne olduğunu söyler", renk: RENK.murekkep },
        { tt: p(3, 0.45), a: "KAPAK", s: "neden izlemen gerektiğini söyler", renk: RENK.kirmizi },
      ].map((r, i) => (
        <Gir key={i} bas={r.tt} son={t(4) - 0.1} x={200} y={300 + i * 230} w={1600}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 36 }}>
            <div style={{ width: 260, ...ys(48, "sans", r.renk, { letterSpacing: 4 }) }}>{r.a}</div>
            <div style={ys(80, "serif", r.renk)}>→ {r.s}</div>
          </div>
        </Gir>
      ))}
      <Gir bas={p(4, 0.3)} son={t(5) - 0.1} x={1100} y={380} w={700}>
        <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 3 })}>KAPAKTA EN FAZLA</div>
        <div style={ys(110)}>üç dört kelime</div>
      </Gir>
      {/* 5–6: telefonda kontrol */}
      <Gir bas={t(5)} son={t(7) - 0.1} x={TEL.x} y={TEL.y}>
        <Telefon w={TEL.w} h={TEL.h}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ position: "absolute", left: 8, right: 8, top: 330 + i * 76, height: 56, border: `2px solid ${RENK.murekkep}44`, borderRadius: 6 }} />
          ))}
        </Telefon>
      </Gir>
      {/* 4: en fazla üç dört kelime */}
      {f >= k(t(4)) - 1 && f < k(t(6)) + 8 && (
        <div style={{ position: "absolute", left: kx, top: ky, transform: `scale(${olcek})`, transformOrigin: "0 0", opacity: ara(f, k(t(4)), k(t(4)) + 7) * (1 - ara(f, k(t(6)), k(t(6)) + 8)) }}>{sadeKapak(bw)}</div>
      )}
      <Gir bas={p(5, 0.1)} son={t(6) - 0.1} x={200} y={250} w={1000}>
        <div style={ys(66)}>telefonda, küçültülmüş hâlde kontrol et</div>
      </Gir>
      {/* 6: bilgisayarda güzel, telefonda leke */}
      <Gir bas={t(6)} son={t(7) - 0.1} x={160} y={250} w={900}>
        <div style={ys(40, "sans", RENK.mavi, { letterSpacing: 3, marginBottom: 12 })}>BİLGİSAYARDA</div>
        {kalabalik(860)}
      </Gir>
      {f >= k(t(6)) && f < k(t(7)) + 8 && (
        <div style={{ position: "absolute", left: ekranX, top: ekranY, opacity: ara(f, k(t(6)), k(t(6)) + 8) * (1 - ara(f, k(t(7)), k(t(7)) + 8)), filter: `blur(${1 + 2.5 * ara(f, k(p(6, 0.3)), k(p(6, 0.6)))}px)` }}>{kalabalik(ekranW)}</div>
      )}
      <Daire x={ekranX - 10} y={ekranY - 10} w={ekranW + 20} h={200} bas={p(6, 0.55)} son={t(7) - 0.1} />
      <Gir bas={p(6, 0.6)} son={t(7) - 0.1} x={1050} y={560} w={270}>
        <div style={ys(50, "serif", RENK.kirmizi)}>telefonda okunmayan bir leke</div>
      </Gir>
      {/* 7: benim kapaklarım */}
      <Gir bas={t(7)} x={170} y={250} w={1060}>
        <Kapak w={1060} oynat={false} cizgi={0} zemin={RENK.kagit}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120, background: RENK.murekkep, display: "flex", alignItems: "center", gap: 20, padding: "0 30px" }}>
            {[260, 180, 300].map((w, i) => <div key={i} style={{ width: w, height: 30, background: RENK.kagit, borderRadius: 4, opacity: 0.85 }} />)}
          </div>
          <div style={{ position: "absolute", left: 50, top: 210, ...ys(210, "serif", RENK.murekkep) }}>KELİME</div>
        </Kapak>
      </Gir>
      <DamgaVur id="e57ornek" t={p(7, 0.45)} x={760} y={430} metin="ÖRNEK" boy={80} aci={-10} />
      {[
        { tt: p(7, 0.2), s: "gazete manşeti", y: 290, hx: 1080, hy: 310 },
        { tt: p(7, 0.45), s: "kırmızı damga", y: 480, hx: 1110, hy: 500 },
        { tt: p(7, 0.7), s: "tek büyük kelime", y: 680, hx: 800, hy: 590 },
      ].map((r, i) => (
        <React.Fragment key={i}>
          <Gir bas={r.tt} x={1330} y={r.y} w={560}>
            <div style={ys(60, "serif", i === 1 ? RENK.kirmizi : RENK.murekkep)}>{r.s}</div>
          </Gir>
          <Ok x1={1320} y1={r.y + 38} x2={r.hx} y2={r.hy} egri={0.12} bas={r.tt + 0.15} kalin={5} />
        </React.Fragment>
      ))}
    </>
  );
};

// ================================================================ 58 — kısa mı, uzun mu
const S58: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const ac = ara(f, k(p(8, 0.5)), k(p(8, 0.5)) + 18, kolay);
  const kisa = ["40 saniye", "tek bir fikir", "tek bir sahne", "sonunda bir son vuruş"];
  return (
    <>
      {/* 1–2: soru */}
      <Gir bas={t(1)} son={t(3) - 0.1} x={160} y={300} w={1200}>
        <Manset metin="Kısa video mu, uzun video mu?" bas={t(1)} boy={110} />
      </Gir>
      <WJAkis pozlar={[[p(1, 0.5), "dusunen"], [t(2), "omuz"]]} x={1420} y={380} boy={580} son={t(3) - 0.1} />
      <Gir bas={t(2)} son={t(3) - 0.1} x={160} y={620} w={1100}>
        <div style={ys(60, "serif", RENK.kirmizi)}>bu soruyu çok soruyorlar</div>
      </Gir>
      {/* 3–7: iki kart */}
      <Gir bas={t(3)} son={t(8) - 0.1} x={120} y={112} w={1680}>
        <div style={ys(64)}>
          İkisi birden, <span style={{ color: RENK.kirmizi }}>ama farklı işler için</span>
        </div>
      </Gir>
      <Gir bas={p(3, 0.2)} son={t(8) - 0.1} x={150} y={240} w={780}>
        <div style={{ height: 680, border: `4px solid ${RENK.murekkep}`, borderRadius: 12, background: RENK.kagitAcik, padding: "30px 40px", boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.14)" }}>
          <div style={ys(44, "sans", RENK.kirmizi, { letterSpacing: 4 })}>KISA VİDEO</div>
          <div style={{ ...ys(76), opacity: ara(f, k(t(4)), k(t(4)) + 7) }}>keşfedilmek için</div>
          <div style={{ borderTop: `3px solid ${RENK.murekkep}`, margin: "18px 0 24px", opacity: 0.4 }} />
          {kisa.map((s, i) => {
            const g = ara(f, k(p(5, 0.08 + i * 0.22)), k(p(5, 0.08 + i * 0.22)) + 7);
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22, opacity: g, transform: `translateX(${(1 - g) * -20}px)` }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, background: RENK.kirmizi }} />
                <div style={ys(56)}>{s}</div>
              </div>
            );
          })}
        </div>
      </Gir>
      <Gir bas={p(3, 0.5)} son={t(8) - 0.1} x={990} y={240} w={780}>
        <div style={{ height: 680, border: `4px solid ${RENK.murekkep}`, borderRadius: 12, background: RENK.kagitAcik, padding: "30px 40px", boxSizing: "border-box", boxShadow: "8px 10px 0 rgba(27,26,23,0.14)" }}>
          <div style={ys(44, "sans", RENK.mavi, { letterSpacing: 4 })}>UZUN VİDEO</div>
          <div style={{ ...ys(76, "serif", RENK.mavi), opacity: ara(f, k(t(6)), k(t(6)) + 7) }}>güven için</div>
          <div style={{ borderTop: `3px solid ${RENK.murekkep}`, margin: "18px 0 24px", opacity: 0.4 }} />
          <div style={{ ...ys(60), opacity: ara(f, k(t(7)), k(t(7)) + 7) }}>biri seni yarım saat dinlediyse</div>
          <div style={{ ...ys(76, "serif", RENK.mavi, { marginTop: 18 }), opacity: ara(f, k(p(7, 0.55)), k(p(7, 0.55)) + 7) }}>→ artık seni tanıyor</div>
        </div>
      </Gir>
      {/* 8: kapı */}
      <Gir bas={t(8)} x={120} y={330} w={600}>
        <div style={ys(44, "sans", RENK.kirmizi, { letterSpacing: 4 })}>KISA VİDEO</div>
        <div style={ys(96)}>kapıyı çalar</div>
      </Gir>
      <Gir bas={t(8)} x={760} y={230}>
        <div style={{ position: "relative", width: 400, height: 680 }}>
          <div style={{ position: "absolute", inset: 0, border: `8px solid ${RENK.murekkep}`, borderBottom: "none", background: RENK.bilet, boxSizing: "border-box" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ position: "absolute", left: 40 + i * 70, top: 40, bottom: 0, width: 4, background: RENK.kirmizi, opacity: 0.25 * ac, transform: `skewX(${-20 + i * 10}deg)` }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 8, top: 8, width: 384, height: 672, transformOrigin: "0 50%", transform: `perspective(1400px) rotateY(${-72 * ac}deg)`, background: RENK.kagitKoyu, border: `5px solid ${RENK.murekkep}`, boxSizing: "border-box" }}>
            <div style={{ position: "absolute", left: 40, top: 40, right: 40, height: 230, border: `4px solid ${RENK.murekkep}`, borderRadius: 4 }} />
            <div style={{ position: "absolute", left: 40, top: 320, right: 40, height: 300, border: `4px solid ${RENK.murekkep}`, borderRadius: 4 }} />
            <div style={{ position: "absolute", right: 34, top: 340, width: 30, height: 30, borderRadius: 15, background: RENK.murekkep }} />
          </div>
          <div style={{ position: "absolute", left: -60, right: -60, bottom: -6, height: 8, background: RENK.murekkep }} />
        </div>
      </Gir>
      {[0, 1, 2].map((i) => (
        <Cizim key={i} d={`M${1185 + i * 22} ${470 - i * 10} Q${1205 + i * 26} 520 ${1185 + i * 22} ${570 + i * 10}`} bas={p(8, 0.08 + i * 0.1)} sure={0.2} son={p(8, 0.48)} kalin={6} />
      ))}
      <Gir bas={p(8, 0.55)} x={1260} y={330} w={640}>
        <div style={ys(44, "sans", RENK.mavi, { letterSpacing: 4 })}>UZUN VİDEO</div>
        <div style={ys(96, "serif", RENK.mavi)}>içeri davet eder</div>
      </Gir>
    </>
  );
};

// ================================================================ 59 — kısa video kalıbı
const S59: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const PX = 160, PY = 190, PW = 380, PH = 760;
  const maddeler: { n: number; s: React.ReactNode; carpi?: boolean }[] = [
    { n: 2, s: "tek sahne, hiç kesme yok" },
    { n: 3, s: "üstte iki satırlık sabit başlık" },
    { n: 4, s: "ortada karakterler ve küçük nesneler" },
    { n: 5, s: "her 1,5–2 saniyede küçük bir değişiklik" },
    { n: 6, s: "altta kelime kelime altyazı" },
    { n: 7, s: <>sonda “abone ol” <span style={{ color: RENK.kirmizi }}>yok</span></>, carpi: true },
    { n: 8, s: "son vuruşla biter → izleyici başa döner" },
    { n: 9, s: "tekrar izleme → algoritmaya “iyi video” der" },
  ];
  const pozlar: Poz[] = ["normal", "gosteren", "saskin", "omuz", "dusunen"];
  const dongu = f >= k(t(5)) ? Math.floor((f - k(t(5))) / k(1.75)) : 0;
  const poz = pozlar[dongu % pozlar.length];
  const g = (tt: number) => ara(f, k(tt), k(tt) + 7);
  const altyazi = f >= k(t(6)) ? Math.floor((f - k(t(6))) / 9) % 5 : -1;
  return (
    <>
      <Ust metin="Benim kısa videolarımın kalıbı" bas={t(1)} />
      <Gir bas={t(1)} x={PX} y={PY}>
        <Telefon w={PW} h={PH}>
          {/* 3: iki satırlık başlık */}
          <div style={{ position: "absolute", left: 24, top: 36, width: 260, height: 26, background: RENK.murekkep, borderRadius: 5, opacity: g(t(3)) }} />
          <div style={{ position: "absolute", left: 24, top: 74, width: 200, height: 26, background: RENK.kirmizi, borderRadius: 5, opacity: g(p(3, 0.3)) }} />
          {/* 4: karakter, balon, sayaç, damga */}
          <div style={{ position: "absolute", left: 20, top: 300, opacity: g(p(4, 0.1)) }}>
            <WJ poz={poz} yas={f >= k(t(5)) ? (f - k(t(5))) % k(1.75) : 30} f={f} boy={300} />
          </div>
          <div style={{ position: "absolute", left: 150, top: 150, width: 170, height: 96, border: `4px solid ${RENK.murekkep}`, borderRadius: 18, background: RENK.kagitAcik, opacity: g(p(4, 0.35)) * (dongu % 2 === 1 ? 0 : 1) }}>
            <div style={{ margin: "22px 20px 0", height: 10, background: RENK.murekkep, borderRadius: 5, opacity: 0.6 }} />
            <div style={{ margin: "12px 20px 0", width: 80, height: 10, background: RENK.murekkep, borderRadius: 5, opacity: 0.4 }} />
          </div>
          <div style={{ position: "absolute", left: 210, top: 300 + (dongu % 3) * 4, width: 110, height: 70, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.bilet, opacity: g(p(4, 0.55)), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 16, height: 30 + ((dongu + i) % 3) * 6, background: RENK.murekkep, borderRadius: 3 }} />)}
          </div>
          <div style={{ position: "absolute", left: 200, top: 420, width: 120, height: 56, border: `5px solid ${RENK.kirmizi}`, borderRadius: 6, transform: `rotate(${-10 + (dongu % 2) * 6}deg)`, opacity: g(p(4, 0.75)) * 0.9 }} />
          {/* 6: kelime kelime altyazı */}
          <div style={{ position: "absolute", left: 24, right: 24, top: 620, display: "flex", gap: 8, justifyContent: "center", opacity: g(t(6)) }}>
            {[54, 70, 44, 62, 50].map((w, i) => (
              <div key={i} style={{ width: w, height: 22, borderRadius: 5, background: i === altyazi ? RENK.kirmizi : RENK.murekkep, opacity: i <= Math.max(altyazi, 0) || f >= k(t(7)) ? 1 : 0.2 }} />
            ))}
          </div>
        </Telefon>
      </Gir>
      <Gir bas={t(2)} x={PX + 30} y={PY + PH + 12} w={400}>
        <div style={ys(34, "sans", RENK.murekkep, { opacity: 0.65 })}>tek sahne · kesme yok</div>
      </Gir>
      {/* 8: başa dön oku */}
      <Ok x1={PX + PW + 10} y1={PY + PH - 80} x2={PX + PW + 10} y2={PY + 90} egri={0.18} bas={p(8, 0.4)} sure={0.7} renk={RENK.kirmizi} kalin={7} />
      {/* kontrol listesi */}
      {maddeler.map((m, i) => (
        <React.Fragment key={m.n}>
          <Gir bas={t(m.n)} x={780} y={210 + i * 92} w={1100}>
            <div style={ys(52)}>{m.s}</div>
          </Gir>
          {m.carpi ? <Carpi x={710} y={226 + i * 92} bas={t(m.n) + 0.25} /> : <Tik x={706} y={222 + i * 92} bas={t(m.n) + 0.25} />}
        </React.Fragment>
      ))}
    </>
  );
};

// ================================================================ 60 — uzun video kalıbı
const S60: SahneFC = ({ b }) => {
  const f = useCurrentFrame();
  const { t, p } = zam(b);
  const P0 = [220, 640], P1 = [560, 540], P5 = [1360, 330], P6 = [1640, 380];
  const dipler = [[700, 720], [820, 620], [940, 760], [1060, 650]];
  const hediye = ["bir araç", "bir şablon", "bir kural dosyası"];
  return (
    <>
      <Ust metin="Uzun videolarımın kalıbı" bas={t(1)} />
      {/* yol */}
      <Cizim d={`M${P0[0]} ${P0[1]} Q${(P0[0] + P1[0]) / 2} ${P1[1] - 40} ${P1[0]} ${P1[1]}`} bas={t(3)} sure={0.6} kalin={8} />
      <Cizim d={`M${P1[0]} ${P1[1]} ` + dipler.map(([x, y]) => `L${x} ${y}`).join(" ")} bas={t(4)} sure={1.6} kalin={8} />
      <Cizim d={`M${dipler[3][0]} ${dipler[3][1]} Q${1220} ${560} ${P5[0]} ${P5[1]}`} bas={t(6)} sure={0.7} renk={RENK.mavi} kalin={8} />
      <Cizim d={`M${P5[0]} ${P5[1]} L${P6[0] - 70} ${P6[1]}`} bas={t(7)} sure={0.4} renk={RENK.mavi} kalin={8} />
      {/* 2: hikâye ya da benzetme */}
      <Gir bas={t(2)} x={P0[0] - 26} y={P0[1] - 26}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: RENK.murekkep }} />
      </Gir>
      <Gir bas={t(2)} x={120} y={P0[1] + 50} w={460}>
        <div style={ys(40, "sans", RENK.murekkep, { opacity: 0.6, letterSpacing: 3 })}>ÖNCE</div>
        <div style={ys(60)}>bir hikâye ya da benzetme</div>
      </Gir>
      {/* 3: sorun */}
      <Gir bas={p(3, 0.3)} x={P1[0] - 26} y={P1[1] - 26}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: RENK.kirmizi }} />
      </Gir>
      <Gir bas={p(3, 0.3)} x={P1[0] - 90} y={P1[1] - 130} w={300}>
        <div style={ys(72, "serif", RENK.kirmizi)}>sorun</div>
      </Gir>
      {/* 4: denemeler, başarısız */}
      {[dipler[0], dipler[2]].map(([x, y], i) => (
        <Carpi key={i} x={x - 22} y={y - 22} bas={p(4, 0.45 + i * 0.25)} boy={44} />
      ))}
      <Gir bas={p(4, 0.2)} x={640} y={785} w={600}>
        <div style={ys(60)}>denemeler</div>
        <div style={{ ...ys(46, "serif", RENK.kirmizi), opacity: ara(f, k(p(4, 0.5)), k(p(4, 0.5)) + 7) }}>özellikle başarısız olanlar</div>
      </Gir>
      {/* 5: insanlar kendini görüyor */}
      <Gir bas={t(5)} son={t(6) - 0.1} x={760} y={230}>
        <Balon w={420} h={150} kuyrukX={150}>
          <div style={ys(54)}>“bu ben!”</div>
        </Balon>
      </Gir>
      <WJAkis pozlar={[[t(5), "saskin"], [p(5, 0.5), "gosteren"]]} x={1200} y={540} boy={400} son={t(6) - 0.1} />
      <Gir bas={p(5, 0.2)} son={t(6) - 0.1} x={1420} y={760} w={480}>
        <div style={ys(46, "serif", RENK.mavi)}>izleyici kendini görüyor</div>
      </Gir>
      {/* 6: çözüm ve sonuç */}
      <Gir bas={p(6, 0.5)} x={P5[0] - 26} y={P5[1] - 26}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: RENK.mavi }} />
      </Gir>
      <Gir bas={p(6, 0.5)} x={P5[0] - 200} y={P5[1] - 140} w={420}>
        <div style={ys(66, "serif", RENK.mavi)}>çözüm ve sonuç</div>
      </Gir>
      {/* 7: en sonda ücretsiz bir şey */}
      <Gir bas={p(7, 0.1)} x={P6[0] - 70} y={P6[1] - 60}>
        <svg width={150} height={140} viewBox="0 0 150 140" style={{ overflow: "visible" }}>
          <rect x={10} y={50} width={130} height={86} fill={RENK.bilet} stroke={RENK.murekkep} strokeWidth={6} />
          <rect x={2} y={30} width={146} height={28} fill={RENK.bilet} stroke={RENK.murekkep} strokeWidth={6} />
          <rect x={64} y={30} width={22} height={106} fill={RENK.kirmizi} />
          <path d="M75 30 Q40 -6 30 20 Q36 34 75 30 Q110 -6 120 20 Q114 34 75 30" fill="none" stroke={RENK.kirmizi} strokeWidth={6} />
        </svg>
      </Gir>
      <Gir bas={p(7, 0.1)} x={1450} y={530} w={460}>
        <div style={ys(40, "sans", RENK.kirmizi, { letterSpacing: 3 })}>EN SONDA, ÜCRETSİZ</div>
        {hediye.map((h, i) => (
          <div key={h} style={{ ...ys(54), marginTop: 8, opacity: ara(f, k(p(7, 0.3 + i * 0.2)), k(p(7, 0.3 + i * 0.2)) + 7) }}>· {h}</div>
        ))}
      </Gir>
      {/* 8: o da sana zamanını veriyor */}
      <Gir bas={t(8)} x={480} y={930} w={1360}>
        <div style={ys(50, "serif", RENK.murekkep, { textAlign: "right" })}>
          İzleyiciye bir şey verdiğinde, <span style={{ color: RENK.kirmizi }}>o da sana zamanını veriyor.</span>
        </div>
      </Gir>
    </>
  );
};

export const SAHNELER_E: Record<number, React.FC<{ b: number }>> = {
  ...yerTutucular(47, 60),
  47: S47,
  48: S48,
  49: S49,
  50: S50,
  51: S51,
  52: S52,
  53: S53,
  54: S54,
  55: S55,
  56: S56,
  57: S57,
  58: S58,
  59: S59,
  60: S60,
};

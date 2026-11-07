// Kısım A — "I · Fabrika" (bölüm 1–7).
// Her ipucu zaman.json'dan (bölüm, cümle) ile okunur: c(b,n) / cs(b,n), cümle içi ara noktalar t(b,n,oran).
// Sabit saniye YOK; ses yeniden üretilince her şey kendiliğinden yerine oturur.
import React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame } from "remotion";
import {
  Balon, Bilet, Daire, Daktilo, DaktiloYazi, Damga, Ekran, FPS, Gir, Manset, MONO, Ok, Pencere, RENK, SANS, SERIF, UstunuCiz, WJ, Poz,
  ara, c, cikis, cs, k, yerTutucular,
} from "./Ortak";

const INK = RENK.murekkep;

// ---------------------------------------------------------------- yardımcılar (bu dosyaya özel)
/** b. bölümün n. cümlesi içinde oran (0..1) noktasının saniyesi */
const t = (b: number, n: number, oran = 0) => c(b, n) + oran * (cs(b, n) - c(b, n));
const yas = (f: number, sn: number) => f - k(sn);

/** kendini çizen çizgi (pathLength=1); dolgu çizgi bitmeye yakın belirir */
const Yol: React.FC<{ d: string; p: number; kalin?: number; renk?: string; dolgu?: string; op?: number }> = ({ d, p, kalin = 5, renk = INK, dolgu, op = 1 }) => {
  if (p <= 0) return null;
  return (
    <path
      d={d}
      fill={dolgu ?? "none"}
      fillOpacity={dolgu ? interpolate(p, [0.55, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0}
      stroke={renk}
      strokeWidth={kalin}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - p}
      opacity={op}
    />
  );
};

/** mutlak konumlu svg tuvali */
const Tuval: React.FC<{ x: number; y: number; w: number; h: number; op?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, h, op = 1, children, style }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: x, top: y, overflow: "visible", opacity: op, ...style }}>
    {children}
  </svg>
);

/** bas..son (saniye) arasında görünürlük (kısa solma ile) */
const gorun = (f: number, bas: number, son?: number) => {
  if (f < k(bas)) return 0;
  const g = ara(f, k(bas), k(bas) + 6);
  const s = son === undefined ? 0 : ara(f, k(son), k(son) + 7);
  return g * (1 - s);
};
const pop = (f: number, bas: number) => spring({ frame: f - k(bas), fps: FPS, config: { damping: 12, stiffness: 180, mass: 0.6 } });

/** yazının üstüne/altına/çevresine çizilen kırmızı mürekkep; yazı ile birlikte akar (piksel ölçmeye gerek yok) */
const Vurgu: React.FC<{ tur: "alt" | "ust" | "daire"; bas: number; sure?: number; renk?: string; kalin?: number; children: React.ReactNode }> = ({
  tur, bas, sure = 0.4, renk = RENK.kirmizi, kalin = 7, children,
}) => {
  const f = useCurrentFrame();
  const id = React.useId().replace(/:/g, "");
  const p = ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad));
  const d = tur === "alt" ? "M0,96 Q50,103 100,94" : tur === "ust" ? "M-3,60 Q50,50 103,55" : "M52,-6 C112,-6 112,106 50,106 C-12,106 -12,-4 58,-12";
  const kutu: React.CSSProperties = tur === "daire" ? { left: "-9%", top: "-12%", width: "118%", height: "124%" } : { left: 0, top: 0, width: "100%", height: "100%" };
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      {p > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", ...kutu, overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <clipPath id={`v${id}`}>
              <rect x={-20} y={-40} width={140 * p} height={180} />
            </clipPath>
          </defs>
          <path d={d} clipPath={`url(#v${id})`} fill="none" stroke={renk} strokeWidth={kalin} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
};

/** büyütülmüş tramvay bileti (Bilet'in iç yazıları 34px altına düşmesin diye ×2) */
const BuyukBilet: React.FC<{ ust: string; deger: string; seri: string; w: number; degerBoy: number; degerRenk?: string; alt?: string; olcek?: number }> = ({
  ust, deger, seri, w, degerBoy, degerRenk, alt, olcek = 2,
}) => (
  <div style={{ width: w * olcek, transform: `scale(${olcek})`, transformOrigin: "0 0" }}>
    <Bilet ust={ust} deger={deger} seri={seri} w={w} degerBoy={degerBoy} degerRenk={degerRenk}>
      {alt && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 17, color: RENK.kirmizi, whiteSpace: "nowrap" }}>{alt}</div>}
    </Bilet>
  </div>
);

/** düz yazı satırı */
const Satir: React.FC<{ boy?: number; renk?: string; font?: string; italik?: boolean; children: React.ReactNode }> = ({ boy = 80, renk = INK, font = SERIF, italik, children }) => (
  <div style={{ fontFamily: font, fontSize: boy, lineHeight: 1.1, color: renk, fontStyle: italik ? "italic" : "normal", whiteSpace: "nowrap" }}>{children}</div>
);

/** W.J. — poz değişiminde "yas" sıfırlanır (zıplama) */
const WJPoz: React.FC<{ x: number; y: number; boy: number; adimlar: [number, Poz][]; ayna?: boolean; fikir?: number; dx?: number }> = ({ x, y, boy, adimlar, ayna, fikir, dx = 0 }) => {
  const f = useCurrentFrame();
  let poz: Poz = adimlar[0][1];
  let bas = adimlar[0][0];
  for (const [s, p] of adimlar) if (f >= k(s)) { poz = p; bas = s; }
  return (
    <div style={{ position: "absolute", left: x + dx, top: y, transform: ayna ? "scaleX(-1)" : undefined }}>
      <WJ poz={poz} yas={f - k(bas)} f={f} boy={boy} fikir={fikir} />
    </div>
  );
};

// ---------------------------------------------------------------- mürekkep çizimleri
/** amfi: sırtı dönük profesör başları (sırayla belirir) */
const Amfi: React.FC<{ bas: number; son: number }> = ({ bas, son }) => {
  const f = useCurrentFrame();
  const op = gorun(f, bas, son);
  if (op <= 0) return null;
  const kafalar: React.ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) {
      const x = 1010 + i * 130 + (r % 2) * 62;
      const yb = 780 + r * 100;
      const s = pop(f, bas + 0.25 + (r * 6 + i) * 0.05);
      kafalar.push(
        <g key={`${r}-${i}`} transform={`translate(${x} ${yb}) scale(${s}) translate(${-x} ${-yb})`} opacity={Math.min(1, s * 2)}>
          <path d={`M${x - 62} ${yb} Q${x - 60} ${yb - 64} ${x} ${yb - 66} Q${x + 60} ${yb - 64} ${x + 62} ${yb} Z`} fill={RENK.kagitKoyu} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={x} cy={yb - 96} r={33} fill={RENK.kagitAcik} stroke={INK} strokeWidth={5} />
          <path d={`M${x - 30} ${yb - 104} Q${x} ${yb - 136} ${x + 30} ${yb - 104}`} fill="none" stroke={INK} strokeWidth={4} opacity={0.6} />
        </g>,
      );
    }
  }
  const sahneP = ara(f, k(bas), k(bas + 0.5));
  return (
    <Tuval x={0} y={0} w={1920} h={1080} op={op}>
      <Yol d="M960 640 L1810 640" p={sahneP} kalin={6} />
      <Yol d="M1220 640 L1236 540 L1310 540 L1326 640" p={sahneP} kalin={5} dolgu={RENK.kagitKoyu} />
      <Yol d="M1214 540 L1332 540" p={sahneP} kalin={7} />
      {kafalar}
    </Tuval>
  );
};

/** kara tahta + tesseract (dördüncü boyut) */
const Tahta: React.FC<{ bas: number; son: number }> = ({ bas, son }) => {
  const f = useCurrentFrame();
  const op = gorun(f, bas, son);
  if (op <= 0) return null;
  const p = (a: number, s = 0.45) => ara(f, k(bas + a), k(bas + a + s), Easing.out(Easing.quad));
  const tebesir = RENK.kagitAcik;
  const kup = (ox: number, oy: number, s: number) => `M${ox} ${oy} h${s} v${s} h${-s} Z`;
  return (
    <Tuval x={1340} y={150} w={460} h={330} op={op}>
      <rect x={0} y={0} width={460} height={330} rx={8} fill="#2B2A25" stroke={INK} strokeWidth={8} opacity={p(0, 0.3)} />
      <Yol d={kup(130, 30, 170)} p={p(0.25)} renk={tebesir} kalin={4} />
      <Yol d={kup(185, 80, 70)} p={p(0.5)} renk={tebesir} kalin={4} />
      <Yol d="M130 30 L185 80 M300 30 L255 80 M300 200 L255 150 M130 200 L185 150" p={p(0.75)} renk={tebesir} kalin={4} />
      <text x={230} y={290} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={50} fill={tebesir} opacity={p(1.0, 0.3)}>
        dördüncü boyut
      </text>
    </Tuval>
  );
};

/** körüklü eski fotoğraf makinesi, sehpada */
const Kamera: React.FC<{ x: number; y: number; bas: number; flas: number[]; son?: number }> = ({ x, y, bas, flas, son }) => {
  const f = useCurrentFrame();
  const op = gorun(f, bas, son);
  if (op <= 0) return null;
  const p = ara(f, k(bas), k(bas + 0.5));
  const patla = flas.map((s) => (f >= k(s) && f < k(s) + 9 ? 1 - (f - k(s)) / 9 : 0)).reduce((a, b) => Math.max(a, b), 0);
  return (
    <Tuval x={x} y={y} w={300} h={380} op={op}>
      <Yol d="M130 210 L40 370 M130 210 L130 370 M130 210 L220 370" p={p} kalin={6} />
      <Yol d="M40 70 L180 70 L180 210 L40 210 Z" p={p} kalin={6} dolgu={RENK.kagitKoyu} />
      <Yol d="M180 90 L240 110 L240 170 L180 190 Z" p={p} kalin={5} dolgu={RENK.kagitAcik} />
      <Yol d="M200 96 L200 184 M220 103 L220 177" p={p} kalin={3} />
      <circle cx={256} cy={140} r={28} fill={RENK.kagitAcik} stroke={INK} strokeWidth={6} opacity={p} />
      <circle cx={256} cy={140} r={12} fill={INK} opacity={p} />
      <Yol d="M60 70 L60 30 L140 18 L140 30" p={p} kalin={5} />
      {patla > 0 && (
        <g opacity={patla}>
          <circle cx={100} cy={20} r={40 + (1 - patla) * 60} fill="#FFFDF4" stroke={INK} strokeWidth={4} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const r1 = 60 + (1 - patla) * 50;
            return <line key={i} x1={100 + Math.cos(a) * r1} y1={20 + Math.sin(a) * r1} x2={100 + Math.cos(a) * (r1 + 46)} y2={20 + Math.sin(a) * (r1 + 46)} stroke={INK} strokeWidth={5} strokeLinecap="round" />;
          })}
        </g>
      )}
    </Tuval>
  );
};

/** testere çatılı fabrika; dumanı tüter. (0,0)-(520,560) */
const FabrikaSvg: React.FC<{ p: number; f: number }> = ({ p, f }) => (
  <svg width={520} height={560} viewBox="0 0 520 560" style={{ overflow: "visible", display: "block" }}>
    <Yol d="M380 250 L380 60 L440 60 L440 250" p={p} kalin={6} dolgu={RENK.kagitKoyu} />
    <Yol d="M20 540 L20 190 L120 260 L120 190 L220 260 L220 190 L320 260 L320 190 L420 260 L500 260 L500 540 Z" p={p} kalin={6} dolgu={RENK.kagitAcik} />
    {[0, 1, 2, 3].map((i) => (
      <Yol key={i} d={`M${170 + i * 80} 320 h52 v70 h-52 Z M${196 + i * 80} 320 v70`} p={ara(p, 0.5, 1)} kalin={4} />
    ))}
    <Yol d="M40 540 L40 410 L140 410 L140 540" p={ara(p, 0.4, 1)} kalin={6} dolgu={RENK.kagitKoyu} />
    <Yol d="M40 440 L140 440 M40 470 L140 470 M40 500 L140 500" p={ara(p, 0.6, 1)} kalin={3} />
    {p >= 1 &&
      [0, 1, 2].map((i) => {
        const u = ((f / 40 + i / 3) % 1);
        return <circle key={i} cx={410 + u * 60 + Math.sin(u * 6) * 8} cy={40 - u * 130} r={14 + u * 26} fill="none" stroke={INK} strokeWidth={4} opacity={(1 - u) * 0.8} />;
      })}
  </svg>
);

/** 16:9 video çerçevesi + oynat üçgeni */
const VideoKare: React.FC<{ w: number; p: number; ilerleme?: number; children?: React.ReactNode }> = ({ w, p, ilerleme, children }) => {
  const h = Math.round((w * 9) / 16);
  return (
    <svg width={w} height={h + 40} viewBox={`0 0 ${w} ${h + 40}`} style={{ overflow: "visible", display: "block" }}>
      <Yol d={`M4 4 H${w - 4} V${h - 4} H4 Z`} p={p} kalin={7} dolgu={RENK.kagitAcik} />
      {children}
      {!children && p > 0.4 && (
        <path d={`M${w / 2 - 50} ${h / 2 - 64} L${w / 2 + 70} ${h / 2} L${w / 2 - 50} ${h / 2 + 64} Z`} fill={RENK.kirmizi} stroke={INK} strokeWidth={7} strokeLinejoin="round" opacity={ara(p, 0.4, 1)} />
      )}
      {ilerleme !== undefined && (
        <>
          <line x1={0} y1={h + 24} x2={w} y2={h + 24} stroke={INK} strokeWidth={6} opacity={0.25} strokeLinecap="round" />
          <line x1={0} y1={h + 24} x2={w * ilerleme} y2={h + 24} stroke={RENK.kirmizi} strokeWidth={8} strokeLinecap="round" />
          <circle cx={w * ilerleme} cy={h + 24} r={13} fill={RENK.kirmizi} />
        </>
      )}
    </svg>
  );
};

/** herkesin aynı kalıp küçük resmi (birebir aynı) */
const Kalip: React.FC<{ w: number }> = ({ w }) => {
  const h = Math.round((w * 9) / 16);
  return (
    <svg width={w} height={h} viewBox="0 0 320 180" style={{ display: "block" }}>
      <rect x={3} y={3} width={314} height={174} rx={8} fill={RENK.kagitKoyu} stroke={INK} strokeWidth={5} />
      <path d="M3 120 L120 60 L200 110 L317 40 L317 177 L3 177 Z" fill={INK} opacity={0.18} />
      <circle cx={250} cy={92} r={44} fill={RENK.kagitAcik} stroke={INK} strokeWidth={5} />
      <path d="M232 84 h6 M262 84 h6 M236 108 Q250 122 264 108" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
      <rect x={22} y={26} width={150} height={26} rx={4} fill={INK} />
      <rect x={22} y={60} width={110} height={26} rx={4} fill={RENK.kirmizi} />
      <path d="M150 128 L196 112 L186 150 Z" fill={RENK.kirmizi} />
    </svg>
  );
};

/** zar */
const Zar: React.FC<{ yuz: number; boyut: number; aci: number }> = ({ yuz, boyut, aci }) => {
  const N: Record<number, [number, number][]> = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  return (
    <svg width={boyut} height={boyut} viewBox="0 0 100 100" style={{ transform: `rotate(${aci}deg)`, display: "block", overflow: "visible" }}>
      <rect x={4} y={4} width={92} height={92} rx={16} fill={RENK.kagitAcik} stroke={INK} strokeWidth={5} />
      {N[yuz].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={8} fill={INK} />)}
    </svg>
  );
};

// ================================================================ BÖLÜM 1 — Harvard 1910, harika çocuk, kameralar
const S1: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const b5 = c(b, 5);
  const b6 = c(b, 6);
  const b7 = c(b, 7);
  return (
    <>
      {/* 1 — Merhaba! */}
      <Gir bas={Math.max(0, c(b, 1) - 0.3)} son={c(b, 2) + 0.2} x={160} y={380} w={1600}>
        <Manset metin="Merhaba!" bas={c(b, 1) - 0.2} yazSn={0.45} boy={190} hiza="center" />
      </Gir>

      {/* 2 — Harvard, ocak 1910 */}
      <Gir bas={c(b, 2) + 0.15} son={b5} x={130} y={150} w={780}>
        <div style={{ border: `4px solid ${INK}`, outline: `2px solid ${INK}`, outlineOffset: 5, background: RENK.kagitAcik, padding: "22px 30px", boxShadow: "6px 8px 0 rgba(27,26,23,0.14)" }}>
          <Manset metin="HARVARD · OCAK 1910" bas={c(b, 2) + 0.3} yazSn={1.1} boy={54} font="mono" />
        </div>
      </Gir>
      <Amfi bas={t(b, 2, 0.28)} son={b5} />
      {f < k(b5) + 8 && <WJPoz x={1010} y={640 - 300} boy={300} adimlar={[[t(b, 2, 0.3), "normal"], [c(b, 4), "gosteren"]]} />}
      <Gir bas={t(b, 2, 0.62)} son={b5} x={130} y={330} aci={-2}>
        <BuyukBilet ust="YAŞ" deger="on bir" seri="1910" w={250} degerBoy={54} alt="Harvard" />
      </Gir>

      {/* 3 — adı */}
      <Gir bas={c(b, 3)} son={b5} x={130} y={660} w={900}>
        <Vurgu tur="alt" bas={c(b, 3) + 0.7} sure={0.45}>
          <Satir boy={92}>William James Sidis</Satir>
        </Vurgu>
      </Gir>
      <Ok x1={860} y1={700} x2={1010} y2={470} bas={c(b, 3) + 1.0} son={b5} egri={-0.3} />

      {/* 4 — dördüncü boyut */}
      <Tahta bas={c(b, 4)} son={b5} />

      {/* 5 — gazete: HARİKA ÇOCUK */}
      <Gir bas={b5} son={b6 + 0.6} x={300} y={140} w={1320} aci={-1.5}>
        <div style={{ background: RENK.kagitAcik, border: `5px solid ${INK}`, padding: "26px 44px 34px", boxShadow: "12px 14px 0 rgba(27,26,23,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 3, color: INK }}>
            <span>ERTESİ GÜN</span>
            <span style={{ color: RENK.kirmizi }}>1910</span>
          </div>
          <div style={{ borderTop: `5px solid ${INK}`, borderBottom: `2px solid ${INK}`, height: 6, margin: "14px 0 10px" }} />
          <div style={{ fontFamily: SERIF, fontSize: 200, lineHeight: 1.0, textAlign: "center", color: INK, letterSpacing: 4 }}>
            <Vurgu tur="alt" bas={b5 + 1.2} sure={0.5} kalin={8}>
              HARİKA ÇOCUK
            </Vurgu>
          </div>
          <div style={{ borderTop: `2px solid ${INK}`, margin: "16px 0 22px" }} />
          <div style={{ display: "flex", gap: 34 }}>
            {[0, 1, 2].map((col) =>
              col === 1 ? (
                <div key={col} style={{ width: 300, height: 250, border: `4px solid ${INK}`, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", background: RENK.kagitKoyu }}>
                  <WJ poz="normal" yas={30} f={f} boy={300} />
                </div>
              ) : (
                <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 17, paddingTop: 6 }}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} style={{ height: 13, borderRadius: 3, background: INK, opacity: 0.22, width: `${70 + random(`g${col}${i}`) * 30}%` }} />
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      </Gir>

      {/* 6 — kameralardan, gazetecilerden uzak */}
      <Gir bas={b6 + 0.1} son={b7} x={130} y={140} w={1660}>
        <Satir boy={76}>kameralardan ve gazetecilerden uzak</Satir>
      </Gir>
      <Kamera x={110} y={470} bas={t(b, 6, 0.08)} flas={[t(b, 6, 0.32), t(b, 6, 0.48)]} son={b7} />
      <Kamera x={430} y={500} bas={t(b, 6, 0.16)} flas={[t(b, 6, 0.4)]} son={b7} />
      <Kamera x={750} y={480} bas={t(b, 6, 0.24)} flas={[t(b, 6, 0.36), t(b, 6, 0.52)]} son={b7} />
      {f >= k(t(b, 6, 0.2)) && f < k(b7) + 8 && (
        <div style={{ opacity: gorun(f, t(b, 6, 0.2), b7) }}>
          <WJPoz
            x={1360}
            y={980 - 460}
            boy={460}
            adimlar={[[t(b, 6, 0.2), "normal"], [t(b, 6, 0.33), "saskin"], [t(b, 6, 0.6), "normal"]]}
            dx={interpolate(f, [k(t(b, 6, 0.6)), k(t(b, 6, 0.9))], [0, 420], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) })}
          />
        </div>
      )}
      {f >= k(t(b, 6, 0.62)) && f < k(b7) + 8 && (
        <div style={{ position: "absolute", left: 1080, top: 300, opacity: gorun(f, t(b, 6, 0.62), b7) }}>
          <Damga id="uzakdur" metin="UZAK DUR" yas={yas(f, t(b, 6, 0.62))} boy={84} aci={-9} />
        </div>
      )}

      {/* 7 — yüzünün değil, fikirlerinin */}
      <Gir bas={b7} x={150} y={300} w={1300}>
        <Satir boy={120}>
          <Vurgu tur="ust" bas={b7 + 0.6} sure={0.35}>Yüzünün</Vurgu> değil,
        </Satir>
      </Gir>
      <Gir bas={b7 + 0.9} x={150} y={470} w={1300}>
        <Satir boy={96}>
          <Vurgu tur="alt" bas={b7 + 1.4} sure={0.4} renk={RENK.mavi}>fikirlerinin</Vurgu> konuşulmasını
        </Satir>
        <Satir boy={96}>istiyordu.</Satir>
      </Gir>
      {f >= k(b7) && <WJPoz x={1470} y={980 - 440} boy={440} adimlar={[[b7, "dusunen"]]} fikir={f - k(b7 + 0.9)} />}
    </>
  );
};

// ================================================================ BÖLÜM 2 — yüz yok, fabrika kurdum
const S2: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const b3 = c(b, 3), b4 = c(b, 4), b5 = c(b, 5), b6 = c(b, 6), b7 = c(b, 7);
  const fabP = ara(f, k(t(b, 5, 0.3)), k(t(b, 5, 0.3) + 1.2), Easing.out(Easing.quad));
  const KUTULAR = ["senaryo", "ses", "animasyon", "ekran kaydı", "kontrol"];
  return (
    <>
      {/* 1-2 — yüzümü göstermiyorum / ama üretmek istiyorum */}
      <Gir bas={c(b, 1)} son={b3} x={140} y={230} w={980}>
        <Manset metin="Ben de bu kanalda yüzümü göstermiyorum." bas={c(b, 1)} yazSn={1.4} boy={88} />
      </Gir>
      <Gir bas={c(b, 2)} son={b3} x={140} y={560} w={980}>
        <Satir boy={88}>
          Ama bir şey <Vurgu tur="alt" bas={c(b, 2) + 1.2}>üretmek</Vurgu>
        </Satir>
        <Satir boy={88}>istiyorum.</Satir>
      </Gir>
      {f >= k(c(b, 1)) && f < k(b3) + 8 && (
        <Tuval x={1200} y={170} w={460} h={640} op={gorun(f, c(b, 1), b3)}>
          <Yol d="M230 10 C380 10 450 150 450 320 C450 490 380 630 230 630 C80 630 10 490 10 320 C10 150 80 10 230 10 Z" p={ara(f, k(c(b, 1)), k(c(b, 1) + 0.7))} kalin={10} dolgu={RENK.kagitKoyu} />
          <Yol d="M230 34 C362 34 426 162 426 320 C426 478 362 606 230 606 C98 606 34 478 34 320 C34 162 98 34 230 34 Z" p={ara(f, k(c(b, 1) + 0.3), k(c(b, 1) + 1))} kalin={3} />
        </Tuval>
      )}
      {f >= k(c(b, 2)) && f < k(b3) + 8 && (
        <div style={{ opacity: gorun(f, c(b, 2), b3) }}>
          <WJPoz x={1308} y={780 - 440} boy={440} adimlar={[[c(b, 2), "gosteren"]]} />
        </div>
      )}
      {f >= k(t(b, 1, 0.55)) && f < k(c(b, 2)) + 8 && (
        <div style={{ position: "absolute", left: 1190, top: 420, opacity: gorun(f, t(b, 1, 0.55), c(b, 2)) }}>
          <Damga id="yuzyok" metin="YÜZ YOK" yas={yas(f, t(b, 1, 0.55))} boy={80} aci={-12} />
        </div>
      )}

      {/* 3 — yüz / zaman / bütçe yoksa */}
      <Gir bas={b3} son={b4} x={140} y={150} w={1600}>
        <Satir boy={84}>Sorun şu:</Satir>
      </Gir>
      {(["YÜZ", "ZAMAN", "BÜTÇE"] as const).map((ad, i) => {
        const bs = t(b, 3, 0.1 + i * 0.17);
        return (
          <React.Fragment key={ad}>
            <Gir bas={bs} son={b4} x={140 + i * 580} y={300} aci={i === 1 ? 2 : -2}>
              <BuyukBilet ust="YOKSA" deger={ad} seri={`No ${i + 1}`} w={240} degerBoy={58} />
            </Gir>
            {f >= k(bs + 0.5) && f < k(b4) + 8 && (
              <div style={{ position: "absolute", left: 300 + i * 580, top: 545, opacity: gorun(f, bs + 0.5, b4) }}>
                <Damga id={`yok${i}`} metin="YOK" yas={yas(f, bs + 0.5)} boy={64} aci={-14 + i * 6} />
              </div>
            )}
          </React.Fragment>
        );
      })}
      <Gir bas={t(b, 3, 0.68)} son={b4} x={140} y={700} w={1700}>
        <Satir boy={100}>
          düzenli video nasıl çıkarırsın<span style={{ color: RENK.kirmizi }}>?</span>
        </Satir>
      </Gir>

      {/* 4 — son birkaç hafta: takvim */}
      <Gir bas={b4} son={b5} x={140} y={150} w={1600}>
        <Satir boy={80}>Son birkaç haftadır cevabı arıyorum</Satir>
      </Gir>
      {f >= k(b4) && f < k(b5) + 8 && (
        <Tuval x={240} y={300} w={1000} h={600} op={gorun(f, b4, b5)}>
          {Array.from({ length: 28 }, (_, i) => {
            const r = Math.floor(i / 7), col = i % 7;
            const x = col * 140 + 10, y = r * 140 + 10;
            const kp = ara(f, k(b4) + i, k(b4) + i + 6);
            const xp = ara(f, k(t(b, 4, 0.15 + (i / 28) * 0.8)), k(t(b, 4, 0.15 + (i / 28) * 0.8)) + 5);
            return (
              <g key={i}>
                <rect x={x} y={y} width={120} height={120} rx={6} fill={RENK.kagitAcik} stroke={INK} strokeWidth={4} opacity={kp} />
                <Yol d={`M${x + 24} ${y + 24} L${x + 96} ${y + 96} M${x + 96} ${y + 24} L${x + 24} ${y + 96}`} p={xp} renk={RENK.kirmizi} kalin={8} />
              </g>
            );
          })}
        </Tuval>
      )}
      {f >= k(b4) && f < k(b5) + 8 && (
        <div style={{ opacity: gorun(f, b4, b5) }}>
          <WJPoz x={1380} y={960 - 470} boy={470} adimlar={[[b4, "dusunen"]]} fikir={f - k(t(b, 4, 0.6))} />
        </div>
      )}

      {/* 5 — Klod ile fabrika (gerçek ekran) */}
      <Ekran klasor={1} bas={b5} son={b6} x={110} y={150} w={880} hiz={6} />
      <Gir bas={t(b, 5, 0.25)} x={1130} y={150} w={760}>
        <Satir boy={70}>
          küçük <Vurgu tur="alt" bas={t(b, 5, 0.6)}>video fabrikası</Vurgu>
        </Satir>
      </Gir>
      {f >= k(t(b, 5, 0.3)) && (
        <div style={{ position: "absolute", left: 1400, top: 330, transform: "scale(0.885)", transformOrigin: "0 0" }}>
          <FabrikaSvg p={fabP} f={f} />
        </div>
      )}

      {/* 6 — senaryo, ses, animasyon, ekran kaydı, kontrol: banttan çıkar */}
      {f >= k(b6) && (
        <Tuval x={0} y={0} w={1920} h={1080} op={gorun(f, b6, b7)}>
          <Yol d="M80 828 L1440 828 M80 868 L1440 868" p={ara(f, k(b6), k(b6 + 0.5))} kalin={6} />
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={100 + i * 78} cy={848} r={13} fill="none" stroke={INK} strokeWidth={4} opacity={ara(f, k(b6) + i, k(b6) + i + 4)} transform={`rotate(${f * 12} ${100 + i * 78} 848)`} strokeDasharray="10 6" />
          ))}
        </Tuval>
      )}
      {KUTULAR.map((ad, i) => {
        const bs = t(b, 6, 0.04 + i * 0.17);
        if (f < k(bs) || f > k(b7) + 8) return null;
        const hiz = 15;
        const x = Math.max(90 + i * 256, 1380 - (f - k(bs)) * hiz);
        return (
          <div key={ad} style={{ position: "absolute", left: x, top: 720, width: 240, height: 104, border: `4px solid ${INK}`, background: RENK.bilet, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", opacity: ara(f, k(bs), k(bs) + 5) * (1 - ara(f, k(b7), k(b7) + 7)), boxShadow: "4px 5px 0 rgba(27,26,23,0.14)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: INK, whiteSpace: "nowrap" }}>{ad}</span>
          </div>
        );
      })}

      {/* 7 — şu an izlediğin video */}
      <Gir bas={b7} x={260} y={190} w={760}>
        <VideoKare w={760} p={ara(f, k(b7), k(b7 + 0.6))} ilerleme={ara(f, k(b7), k(cikis(b)))} />
      </Gir>
      <Gir bas={b7 + 0.3} x={140} y={720} w={1200}>
        <Satir boy={80}>şu an izlediğin video</Satir>
      </Gir>
      <Ok x1={1440} y1={480} x2={1060} y2={380} bas={b7 + 0.6} egri={0.25} />
      {f >= k(t(b, 7, 0.6)) && (
        <div style={{ position: "absolute", left: 830, top: 700 }}>
          <Damga id="buvideo" metin="BU VİDEO" yas={yas(f, t(b, 7, 0.6))} boy={76} aci={-7} />
        </div>
      )}
    </>
  );
};

// ================================================================ BÖLÜM 3 — parça parça, ücretsiz kod
const S3: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const b2 = c(b, 2), b3 = c(b, 3), b5 = c(b, 5);
  const ayril = ara(f, k(t(b, 1, 0.45)), k(t(b, 1, 0.45) + 0.8), Easing.inOut(Easing.cubic));
  const SATIRLAR: { ad: string; isaret: "evet" | "hayir"; renk: string }[] = [
    { ad: "neyin işe yaradığı", isaret: "evet", renk: RENK.mavi },
    { ad: "neyin yaramadığı", isaret: "hayir", renk: RENK.kirmizi },
    { ad: "nerede para yaktığım", isaret: "hayir", renk: RENK.kirmizi },
    { ad: "nerede bedava çözüm bulduğum", isaret: "evet", renk: RENK.mavi },
  ];
  const DOSYALAR = ["senaryo/", "ses/", "zamanlama/", "görüntü/", "kontrol/"];
  return (
    <>
      {/* 1 — fabrika parça parça */}
      <Gir bas={c(b, 1)} son={b2} x={140} y={150} w={1600}>
        <Manset metin="Fabrikayı parça parça göstereceğim." bas={c(b, 1)} yazSn={1.2} boy={84} />
      </Gir>
      {f < k(b2) + 8 &&
        [0, 1, 2, 3, 4].map((i) => {
          const sol = (i * 520) / 5;
          return (
            <div key={i} style={{ position: "absolute", left: 700, top: 330, opacity: gorun(f, c(b, 1) + 0.2, b2), clipPath: `inset(-200px ${520 - sol - 104}px -10px ${sol}px)`, transform: `translate(${(i - 2) * 70 * ayril}px, ${(i % 2 ? -1 : 1) * 24 * ayril}px) rotate(${(i - 2) * 3 * ayril}deg)` }}>
              <FabrikaSvg p={ara(f, k(c(b, 1) + 0.2), k(c(b, 1) + 1.2))} f={f} />
            </div>
          );
        })}
      {[0, 1, 2, 3, 4].map((i) => (
        <Gir key={i} bas={t(b, 1, 0.7) + i * 0.08} son={b2} x={735 + i * 104 + (i - 2) * 70} y={920}>
          <span style={{ fontFamily: SERIF, fontSize: 48, color: RENK.kirmizi }}>{["I", "II", "III", "IV", "V"][i]}</span>
        </Gir>
      ))}

      {/* 2 — işe yarayan / yaramayan / para yakılan / bedava */}
      {SATIRLAR.map((s, i) => {
        const bs = t(b, 2, 0.02 + i * 0.22);
        const y = 160 + i * 190;
        return (
          <React.Fragment key={s.ad}>
            <Gir bas={bs} son={b3} x={260} y={y} w={1300}>
              <div style={{ borderBottom: `2px solid ${INK}40`, paddingBottom: 14, width: 1300 }}>
                <Satir boy={80}>{s.ad}</Satir>
              </div>
            </Gir>
            {f >= k(bs + 0.4) && f < k(b3) + 8 && (
              <Tuval x={130} y={y + 8} w={100} h={100} op={gorun(f, bs + 0.4, b3)}>
                <Yol d={s.isaret === "evet" ? "M10 52 L40 84 L94 10" : "M14 14 L86 86 M86 14 L14 86"} p={ara(f, k(bs + 0.4), k(bs + 0.7))} renk={s.renk} kalin={11} />
              </Tuval>
            )}
          </React.Fragment>
        );
      })}

      {/* 3 — kod ücretsiz */}
      <Gir bas={b3} son={b5} x={140} y={160} w={820}>
        <Pencere baslik="video-fabrikasi/" w={820}>
          {DOSYALAR.map((d, i) => (
            <div key={d} style={{ fontFamily: MONO, fontSize: 44, lineHeight: 1.5, color: i % 2 ? RENK.mavi : INK, opacity: ara(f, k(b3 + 0.3 + i * 0.25), k(b3 + 0.3 + i * 0.25) + 4) }}>
              {"▸ "}{d}
            </div>
          ))}
        </Pencere>
      </Gir>
      {f >= k(t(b, 3, 0.55)) && f < k(b5) + 8 && (
        <div style={{ position: "absolute", left: 1090, top: 260, opacity: gorun(f, t(b, 3, 0.55), b5) }}>
          <Damga id="ucretsiz" metin="ÜCRETSİZ" yas={yas(f, t(b, 3, 0.55))} boy={84} aci={-8} />
        </div>
      )}
      {/* 4 — açık kaynak */}
      {f >= k(c(b, 4)) && f < k(b5) + 8 && (
        <div style={{ position: "absolute", left: 1070, top: 520, opacity: gorun(f, c(b, 4), b5) }}>
          <Damga id="acikkaynak" metin="AÇIK KAYNAK" yas={yas(f, c(b, 4))} boy={70} aci={5} renk={RENK.mavi} />
        </div>
      )}
      <Gir bas={c(b, 4) + 0.6} son={b5} x={1110} y={760} w={760}>
        <Satir boy={64} italik>herkes kullanabilir</Satir>
      </Gir>
      <Ok x1={1095} y1={810} x2={930} y2={640} bas={c(b, 4) + 0.9} son={b5} egri={0.3} />
      {/* 3-4 videonun sonunda: küçük not */}
      <Gir bas={t(b, 3, 0.3)} son={b5} x={160} y={830} w={900}>
        <Satir boy={50} renk={RENK.kirmizi} italik>videonun sonunda</Satir>
      </Gir>

      {/* 5 — ama önce: neden? */}
      <Gir bas={b5 + 0.25} x={160} y={330} w={1200}>
        <Satir boy={150}>
          Ama önce: <Vurgu tur="daire" bas={b5 + 1.0} sure={0.6}>neden?</Vurgu>
        </Satir>
      </Gir>
      {f >= k(b5) && <WJPoz x={1440} y={960 - 480} boy={480} adimlar={[[b5 + 0.2, "dusunen"]]} fikir={f - k(b5 + 1.2)} />}
    </>
  );
};

// ================================================================ BÖLÜM 4 — herkes aynı düğmeye basıyor
const S4: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const b2 = c(b, 2), b3 = c(b, 3), b4 = c(b, 4), b5 = c(b, 5), b6 = c(b, 6), b7 = c(b, 7), b8 = c(b, 8), b9 = c(b, 9);
  const FIILLER = ["uğraşıyorsun", "kurguluyorsun", "paylaşıyorsun"];
  const AYNI = ["aynı ses", "aynı yazı girişi", "aynı renk geçişi", "aynı hareket"];
  // göz bebeği gezinir
  const bx = Math.sin(f * 0.09) * 70, by = Math.cos(f * 0.13) * 22;
  return (
    <>
      {/* 1-4 — bir video, yorum, haklı */}
      <Gir bas={c(b, 1)} son={b5} x={150} y={150} w={820}>
        <Satir boy={64}>Bir video düşün.</Satir>
      </Gir>
      <Gir bas={c(b, 1) + 0.2} son={b5} x={150} y={250} w={760}>
        <VideoKare w={760} p={ara(f, k(c(b, 1) + 0.2), k(c(b, 1) + 0.8))} ilerleme={ara(f, k(b2), k(cs(b, 2)))} />
      </Gir>
      {FIILLER.map((v, i) => (
        <Gir key={v} bas={t(b, 2, i * 0.3)} son={b5} x={1020} y={260 + i * 120} w={800}>
          <Satir boy={76}>{v}</Satir>
        </Gir>
      ))}
      <Gir bas={b3} son={b5} x={150} y={760} w={1000}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, background: RENK.kagitAcik, border: `4px solid ${INK}`, borderRadius: 14, padding: "20px 28px", boxShadow: "6px 7px 0 rgba(27,26,23,0.14)" }}>
          <div style={{ width: 70, height: 70, borderRadius: 35, border: `4px solid ${INK}`, background: RENK.kagitKoyu, flexShrink: 0 }} />
          <Manset metin="bunu yapay zekâ yapmış." bas={b3 + 0.4} yazSn={1.3} boy={46} font="mono" />
        </div>
      </Gir>
      {f >= k(b4) && f < k(b5) + 8 && (
        <div style={{ position: "absolute", left: 1220, top: 690, opacity: gorun(f, b4, b5) }}>
          <Damga id="hakli" metin="HAKLI" yas={yas(f, b4)} boy={96} aci={-10} />
        </div>
      )}

      {/* 5 — göz tanıyor */}
      {f >= k(b5) && f < k(b6) + 8 && (
        <Tuval x={460} y={260} w={1000} h={500} op={gorun(f, b5, b6)}>
          <Yol d="M20 250 Q500 -60 980 250 Q500 560 20 250 Z" p={ara(f, k(b5), k(b5 + 0.6))} kalin={9} dolgu={RENK.kagitAcik} />
          <circle cx={500 + bx} cy={250 + by} r={120} fill="none" stroke={INK} strokeWidth={8} opacity={ara(f, k(b5 + 0.4), k(b5 + 0.6))} />
          <circle cx={500 + bx} cy={250 + by} r={58} fill={INK} opacity={ara(f, k(b5 + 0.4), k(b5 + 0.6))} />
          <circle cx={520 + bx} cy={228 + by} r={16} fill={RENK.kagitAcik} opacity={ara(f, k(b5 + 0.4), k(b5 + 0.6))} />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 140 + i * 90;
            return <Yol key={i} d={`M${x} ${105 - Math.sin((i / 8) * Math.PI) * 50} l${(i - 4) * 6} -46`} p={ara(f, k(b5 + 0.5), k(b5 + 0.8))} kalin={6} />;
          })}
        </Tuval>
      )}
      <Gir bas={b5 + 0.6} son={b6} x={160} y={820} w={1600}>
        <div style={{ textAlign: "center" }}>
          <Satir boy={76}>
            göz <Vurgu tur="alt" bas={b5 + 1.3}>hemen</Vurgu> tanıyor
          </Satir>
        </div>
      </Gir>

      {/* 6 — aynı ses, aynı yazı girişi... (3×2 kalıp) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Gir key={i} bas={b6 + i * 0.12} son={b7} x={130 + (i % 3) * 330} y={200 + Math.floor(i / 3) * 220}>
          <Kalip w={310} />
        </Gir>
      ))}
      {AYNI.map((a, i) => (
        <Gir key={a} bas={t(b, 6, i * 0.24)} son={b7} x={1180} y={180 + i * 120} w={700}>
          <Satir boy={68}>
            <Vurgu tur="alt" bas={t(b, 6, i * 0.24) + 0.35} sure={0.3}>{a}</Vurgu>
          </Satir>
        </Gir>
      ))}
      <Gir bas={t(b, 6, 0.3)} son={b7} x={140} y={680} w={1000}>
        <Satir boy={56} italik renk={RENK.kirmizi}>hepsi birebir aynı</Satir>
      </Gir>

      {/* 7 — bütün videolar birbirine benziyor (5×3) */}
      {Array.from({ length: 15 }, (_, i) => (
        <Gir key={i} bas={t(b, 7, (i / 15) * 0.55)} son={b8} x={110 + (i % 5) * 342} y={150 + Math.floor(i / 5) * 200}>
          <Kalip w={318} />
        </Gir>
      ))}
      <Gir bas={t(b, 7, 0.45)} son={b8} x={140} y={790} w={1700}>
        <Satir boy={80}>
          bütün videolar <Vurgu tur="alt" bas={t(b, 7, 0.7)}>birbirine benziyor</Vurgu>
        </Satir>
      </Gir>

      {/* 8 — sorun yapay zekâda değil */}
      <Gir bas={b8} x={150} y={170} w={1700}>
        <Satir boy={92}>
          Sorun: <Vurgu tur="ust" bas={b8 + 0.9} sure={0.35}>yapay zekâ</Vurgu>
        </Satir>
      </Gir>
      {/* 9 — herkesin aynı düğmeye basması */}
      <Gir bas={b9} x={150} y={300} w={1700}>
        <Satir boy={92}>
          herkesin <Vurgu tur="alt" bas={b9 + 0.9}>aynı düğmeye</Vurgu> basması
        </Satir>
      </Gir>
      {f >= k(b9) && (
        <Tuval x={720} y={470} w={480} h={460} op={ara(f, k(b9), k(b9) + 6)}>
          <Yol d="M30 420 L60 330 L420 330 L450 420 Z" p={ara(f, k(b9), k(b9 + 0.4))} kalin={7} dolgu={RENK.kagitKoyu} />
          <ellipse cx={240} cy={330 - (f >= k(t(b, 9, 0.5)) && Math.floor(f / 4) % 2 === 0 ? 6 : 26)} rx={170} ry={58} fill={RENK.kirmizi} stroke={INK} strokeWidth={7} opacity={ara(f, k(b9 + 0.2), k(b9 + 0.5))} />
          <text x={240} y={330 - (f >= k(t(b, 9, 0.5)) && Math.floor(f / 4) % 2 === 0 ? 6 : 26) + 16} textAnchor="middle" fontFamily={SANS} fontWeight={900} fontSize={46} fill={RENK.kagitAcik} letterSpacing={4} opacity={ara(f, k(b9 + 0.3), k(b9 + 0.5))}>
            ÜRET
          </text>
        </Tuval>
      )}
      {[
        [300, 560], [400, 960], [1620, 560], [1520, 960], [960, 1060],
      ].map(([x, y], i) => (
        <Ok key={i} x1={x} y1={y} x2={x < 960 ? 790 : x > 960 ? 1130 : 960} y2={y > 1000 ? 900 : 760} bas={t(b, 9, 0.15 + i * 0.1)} sure={0.35} egri={i % 2 ? 0.2 : -0.2} />
      ))}
    </>
  );
};

// ================================================================ BÖLÜM 5 — kredi maliyeti
const S5: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const b2 = c(b, 2), b3 = c(b, 3), b4 = c(b, 4), b5 = c(b, 5), b6 = c(b, 6), b7 = c(b, 7), b8 = c(b, 8);
  const sonuc = t(b, 2, 0.5);
  const kronoA = (f / 30) * Math.PI * 2;
  return (
    <>
      {/* W.J. bütün bölüm boyunca sağda, poz değiştirir */}
      {f >= k(c(b, 1)) && (
        <WJPoz
          x={1500}
          y={970 - 500}
          boy={500}
          adimlar={[[c(b, 1), "telefon"], [t(b, 2, 0.72), "omuz"], [b3, "dusunen"], [b5, "telefon"], [t(b, 7, 0.65), "saskin"], [b8, "dusunen"]]}
          fikir={f - k(t(b, 8, 0.4))}
        />
      )}

      {/* 1 — ilk denemeler */}
      <Gir bas={c(b, 1)} son={b3} x={140} y={150} w={1300}>
        <Manset metin="İlk denemelerim" bas={c(b, 1)} yazSn={0.8} boy={84} />
      </Gir>
      {/* 2 — bir cümle yazdım → güzel ama ruhsuz */}
      <Gir bas={b2} son={b3} x={140} y={280} w={1180}>
        <Pencere baslik="yapay zekâ video aracı" w={1180}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <DaktiloYazi metin="› bir cümle" ilerleme={ara(f, k(b2 + 0.2), k(b2 + 1.2))} f={f} boy={46} />
            <div style={{ padding: "8px 24px", borderRadius: 8, background: f >= k(t(b, 2, 0.38)) && f < k(t(b, 2, 0.38)) + 5 ? INK : RENK.kirmizi, color: RENK.kagitAcik, fontFamily: SANS, fontWeight: 800, fontSize: 36, letterSpacing: 2 }}>ÜRET</div>
          </div>
        </Pencere>
      </Gir>
      {f >= k(sonuc) && f < k(b3) + 8 && (
        <div style={{ position: "absolute", left: 140, top: 520, opacity: gorun(f, sonuc, b3) }}>
          <VideoKare w={620} p={ara(f, k(sonuc), k(sonuc + 0.6))}>
            <Yol d="M4 300 L150 150 L240 230 L360 90 L616 300" p={ara(f, k(sonuc + 0.2), k(sonuc + 0.9))} kalin={6} dolgu={RENK.kagitKoyu} />
            <circle cx={500} cy={90} r={40} fill="none" stroke={RENK.kirmizi} strokeWidth={6} opacity={ara(f, k(sonuc + 0.5), k(sonuc + 0.8))} />
          </VideoKare>
        </div>
      )}
      <Gir bas={t(b, 2, 0.6)} son={b3} x={820} y={580} w={600}>
        <Satir boy={64}>güzel ama</Satir>
      </Gir>
      {f >= k(t(b, 2, 0.75)) && f < k(b3) + 8 && (
        <div style={{ position: "absolute", left: 800, top: 680, opacity: gorun(f, t(b, 2, 0.75), b3) }}>
          <Damga id="ruhsuz" metin="RUHSUZ" yas={yas(f, t(b, 2, 0.75))} boy={86} aci={-6} />
        </div>
      )}

      {/* 3 — fiyatlara baktım: etiket */}
      {f >= k(b3) && f < k(b4) + 8 && (
        <Tuval x={420} y={220} w={720} h={560} op={gorun(f, b3, b4)} style={{ transform: `rotate(${Math.sin(f * 0.12) * 3}deg)`, transformOrigin: "120px 120px" }}>
          <Yol d="M120 60 L640 60 L700 280 L640 500 L120 500 Q90 500 90 470 L90 90 Q90 60 120 60 Z" p={ara(f, k(b3), k(b3 + 0.5))} kalin={8} dolgu={RENK.bilet} />
          <circle cx={170} cy={280} r={30} fill={RENK.kagit} stroke={INK} strokeWidth={6} opacity={ara(f, k(b3 + 0.3), k(b3 + 0.5))} />
          <Yol d="M170 250 Q120 120 10 30" p={ara(f, k(b3 + 0.3), k(b3 + 0.7))} kalin={5} />
          <text x={420} y={320} textAnchor="middle" fontFamily={SERIF} fontSize={150} fill={INK} opacity={ara(f, k(b3 + 0.4), k(b3 + 0.6))}>FİYAT</text>
        </Tuval>
      )}

      {/* 4 — saniye başına: kronometre */}
      {f >= k(b4) && f < k(b6) + 8 && (
        <Tuval x={150} y={250} w={340} h={400} op={gorun(f, b4, b6)}>
          <Yol d="M140 20 h60 M170 20 v40" p={ara(f, k(b4), k(b4 + 0.4))} kalin={8} />
          <Yol d="M170 70 A150 150 0 1 1 169.9 70 Z" p={ara(f, k(b4), k(b4 + 0.6))} kalin={8} dolgu={RENK.kagitAcik} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={170 + Math.sin(a) * 125} y1={220 - Math.cos(a) * 125} x2={170 + Math.sin(a) * 140} y2={220 - Math.cos(a) * 140} stroke={INK} strokeWidth={5} opacity={ara(f, k(b4 + 0.4), k(b4 + 0.6))} />;
          })}
          <line x1={170} y1={220} x2={170 + Math.sin(kronoA) * 115} y2={220 - Math.cos(kronoA) * 115} stroke={RENK.kirmizi} strokeWidth={8} strokeLinecap="round" opacity={ara(f, k(b4 + 0.4), k(b4 + 0.6))} />
          <circle cx={170} cy={220} r={12} fill={INK} />
        </Tuval>
      )}
      <Gir bas={b4 + 0.3} son={b6} x={560} y={290} w={900}>
        <Satir boy={76}>
          <Vurgu tur="alt" bas={t(b, 4, 0.55)}>saniye başına</Vurgu> ödeme
        </Satir>
      </Gir>
      {/* 5 — 1 saniye ≈ 80 kredi */}
      <Gir bas={b5 + 0.2} son={b6} x={580} y={440} aci={-2}>
        <BuyukBilet ust="1 SANİYE VİDEO" deger="≈ 80 kredi" seri="No 1" w={330} degerBoy={50} />
      </Gir>
      <Gir bas={t(b, 5, 0.6)} son={b6} x={600} y={780} w={800}>
        <Satir boy={44} italik>benim kullandığım platformda, en iyi modellerde</Satir>
      </Gir>

      {/* 6 — bir dakika = binlerce kredi: film şeridi */}
      {f >= k(b6) && f < k(b7) + 8 && (
        <Tuval x={130} y={250} w={1300} h={200} op={gorun(f, b6, b7)}>
          <rect x={0} y={0} width={1300} height={200} rx={10} fill={INK} opacity={ara(f, k(b6), k(b6) + 6)} />
          {Array.from({ length: 30 }, (_, i) => (
            <g key={i} opacity={ara(f, k(t(b, 6, 0.05 + (i / 30) * 0.6)), k(t(b, 6, 0.05 + (i / 30) * 0.6)) + 3)}>
              <rect x={10 + i * 43} y={40} width={34} height={120} rx={3} fill={RENK.kagitKoyu} />
              <rect x={20 + i * 43} y={12} width={14} height={14} rx={2} fill={RENK.kagit} />
              <rect x={20 + i * 43} y={174} width={14} height={14} rx={2} fill={RENK.kagit} />
            </g>
          ))}
        </Tuval>
      )}
      <Gir bas={b6 + 0.3} son={b7} x={140} y={520} w={1300}>
        <Satir boy={88}>1 dakikalık film</Satir>
      </Gir>
      <Gir bas={t(b, 6, 0.55)} son={b7} x={140} y={640} w={1300}>
        <Satir boy={88}>
          = <Vurgu tur="daire" bas={t(b, 6, 0.75)} sure={0.5}>binlerce kredi</Vurgu>
        </Satir>
      </Gir>

      {/* 7 — 3.700 kredilik fragman, boşa gitti */}
      <Gir bas={b7 + 0.1} son={b8} x={170} y={230} aci={-3}>
        <BuyukBilet ust="BİR FRAGMAN" deger="3.700 kredi" seri="No 1" w={400} degerBoy={66} alt="sonucu beğenmedim" />
      </Gir>
      {f >= k(t(b, 7, 0.72)) && f < k(b8) + 8 && (
        <div style={{ position: "absolute", left: 300, top: 560, opacity: gorun(f, t(b, 7, 0.72), b8) }}>
          <Damga id="bosagitti" metin="BOŞA GİTTİ" yas={yas(f, t(b, 7, 0.72))} boy={100} aci={-9} />
        </div>
      )}

      {/* 8 — pahalı bir hobi */}
      <Gir bas={b8} x={140} y={170} w={1300}>
        <Satir boy={70}>her şeyi video modeline yaptırırsan</Satir>
      </Gir>
      <Gir bas={t(b, 8, 0.42)} x={140} y={290} w={1300}>
        <Satir boy={120}>
          çok <Vurgu tur="alt" bas={t(b, 8, 0.62)} sure={0.45}>pahalı</Vurgu> bir hobi
        </Satir>
      </Gir>
      {Array.from({ length: 14 }, (_, i) => {
        const bs = t(b, 8, 0.1 + i * 0.055);
        if (f < k(bs)) return null;
        const d = spring({ frame: f - k(bs), fps: FPS, config: { damping: 13, stiffness: 140 } });
        const x = 180 + (i % 7) * 165 + random(`kx${i}`) * 30;
        const yhedef = 760 - Math.floor(i / 7) * 120 - random(`ky${i}`) * 20;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: 440 + (yhedef - 440) * d, width: 190, height: 96, background: RENK.bilet, border: `4px solid ${INK}`, borderRadius: 8, transform: `rotate(${(random(`kr${i}`) - 0.5) * 30}deg)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.kirmizi, opacity: Math.min(1, d * 2) }}>
            kredi
          </div>
        );
      })}
    </>
  );
};

// ================================================================ BÖLÜM 6 — kodla çizmek: zar vs plan
const S6: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const b2 = c(b, 2), b3 = c(b, 3), b4 = c(b, 4), b5 = c(b, 5), b6 = c(b, 6), b7 = c(b, 7);
  const yolP = ara(f, k(c(b, 1)), k(c(b, 1) + 0.9), Easing.out(Easing.quad));
  const zarAdim = Math.floor(f / 5);
  const KOD = ['<AltCizgi x={…} />', '<Damga metin="…" />', '<DaktiloYazi metin="…" />'];
  return (
    <>
      {/* 1-2 — başka yol: iki tabela */}
      <Gir bas={c(b, 1)} son={b3} x={140} y={140} w={1600}>
        <Satir boy={76}>Ben başka bir yol seçtim:</Satir>
      </Gir>
      <Gir bas={b2} son={b3} x={140} y={240} w={1600}>
        <Satir boy={76} renk={RENK.kirmizi}>
          videoyu <Vurgu tur="alt" bas={b2 + 0.5}>kodla çizmek</Vurgu>
        </Satir>
      </Gir>
      {f >= k(c(b, 1)) && f < k(b3) + 8 && (
        <Tuval x={0} y={0} w={1920} h={1080} op={gorun(f, c(b, 1), b3)}>
          <Yol d="M900 1000 L940 720 Q960 640 700 520 L470 430" p={yolP} kalin={7} />
          <Yol d="M1020 1000 L980 720 Q960 640 1220 520 L1450 430" p={yolP} kalin={7} />
          <Yol d="M960 980 L960 940 M960 900 L960 860 M960 820 L960 780" p={yolP} kalin={5} op={0.5} />
          <Yol d="M520 470 L520 660 M1400 470 L1400 660" p={ara(f, k(t(b, 1, 0.4)), k(t(b, 1, 0.6)))} kalin={8} />
        </Tuval>
      )}
      <Gir bas={t(b, 1, 0.45)} son={b3} x={260} y={390} aci={-4}>
        <div style={{ padding: "14px 30px", border: `5px solid ${INK}`, background: RENK.kagitAcik, fontFamily: SANS, fontWeight: 800, fontSize: 46, letterSpacing: 2, boxShadow: "5px 6px 0 rgba(27,26,23,0.15)" }}>VİDEO MODELİ</div>
      </Gir>
      <Gir bas={t(b, 1, 0.6)} son={b3} x={1300} y={390} aci={4}>
        <div style={{ padding: "14px 48px", border: `5px solid ${INK}`, background: RENK.kagitAcik, fontFamily: SANS, fontWeight: 800, fontSize: 46, letterSpacing: 2, boxShadow: "5px 6px 0 rgba(27,26,23,0.15)" }}>KOD</div>
      </Gir>
      <Daire x={1300} y={390} w={210} h={80} bas={b2 + 0.2} son={b3} />
      <UstunuCiz x={250} y={430} w={420} bas={b2 + 0.6} son={b3} />

      {/* 3 — "bana video üret" yerine "programı yaz" */}
      {f >= k(b3) && f < k(b4) + 8 && (
        <div style={{ position: "absolute", left: 780, top: 600, opacity: gorun(f, b3, b4) }}>
          <Daktilo f={f} boy={360} konusuyor={f >= k(t(b, 3, 0.45)) && f < k(t(b, 3, 0.85))} goz={f >= k(t(b, 3, 0.4)) ? "acik" : "kirpGoz"} />
        </div>
      )}
      <Gir bas={b3 + 0.1} son={b4} x={110} y={230} w={760}>
        <Balon w={760} h={220} kuyrukX={600}>
          <div style={{ fontFamily: MONO, fontSize: 50, color: INK }}>
            <Vurgu tur="ust" bas={t(b, 3, 0.4)} sure={0.35}>"bana video üret"</Vurgu>
          </div>
        </Balon>
      </Gir>
      <Gir bas={t(b, 3, 0.45)} son={b4} x={1010} y={190} w={820}>
        <Balon w={820} h={290} kuyrukX={140}>
          <div style={{ fontFamily: MONO, fontSize: 48, color: INK, lineHeight: 1.3, textAlign: "center" }}>
            "bana bu videoyu çizen
            <br />
            <Vurgu tur="alt" bas={t(b, 3, 0.75)} sure={0.4}>programı yaz</Vurgu>"
          </div>
        </Balon>
      </Gir>

      {/* 4 — fark büyük */}
      <Gir bas={b4} son={b5} x={160} y={380} w={1600}>
        <div style={{ textAlign: "center" }}>
          <Satir boy={170}>
            Fark <Vurgu tur="alt" bas={b4 + 0.4} sure={0.3}>büyük</Vurgu>.
          </Satir>
        </div>
      </Gir>

      {/* 5 — video modeli: zar */}
      <Gir bas={b5} son={b7} x={130} y={150} w={780}>
        <Satir boy={64}>video modeli: <span style={{ color: RENK.kirmizi }}>zar atar</span></Satir>
      </Gir>
      {f >= k(b5) && f < k(b7) + 8 && (
        <div style={{ position: "absolute", left: 160, top: 290, display: "flex", gap: 50, opacity: gorun(f, b5, b7) }}>
          {[0, 1, 2].map((i) => {
            const durdu = f >= k(t(b, 5, 0.7));
            const ad = durdu ? Math.floor(k(t(b, 5, 0.7)) / 5) : zarAdim;
            return <Zar key={i} yuz={1 + Math.floor(random(`z${i}-${ad}`) * 6)} boyut={170} aci={durdu ? (i - 1) * 12 : random(`za${i}-${zarAdim}`) * 90 - 45} />;
          })}
        </div>
      )}
      {[0, 1, 2].map((i) => (
        <Gir key={i} bas={t(b, 5, 0.3 + i * 0.18)} son={b7} x={140 + i * 260} y={560}>
          <div style={{ width: 230, height: 130, border: `4px solid ${INK}`, background: RENK.kagitAcik, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 20 + random(`o${i}a`) * 120, top: 15 + random(`o${i}b`) * 50, width: 40 + random(`o${i}c`) * 60, height: 40 + random(`o${i}c`) * 40, borderRadius: i === 1 ? 60 : 4, background: i === 2 ? RENK.kirmizi : INK, opacity: 0.8 }} />
            <div style={{ position: "absolute", left: 10, bottom: 12, width: 60 + random(`o${i}d`) * 140, height: 14, background: INK, opacity: 0.3 }} />
          </div>
        </Gir>
      ))}
      <Gir bas={t(b, 5, 0.7)} son={b7} x={140} y={730} w={800}>
        <Satir boy={50} italik>her seferinde baştan, her seferinde başka</Satir>
      </Gir>

      {/* 6 — kod: aynı plan, düzeltilebilir */}
      {f >= k(b6) && f < k(b7) + 8 && (
        <div style={{ position: "absolute", left: 960, top: 150, width: 4, height: 760, background: INK, opacity: 0.35 * gorun(f, b6, b7) }} />
      )}
      <Gir bas={b6} son={b7} x={1010} y={150} w={860}>
        <Satir boy={64}>kod: <span style={{ color: RENK.mavi }}>hep aynı çizim</span></Satir>
      </Gir>
      {f >= k(b6) && f < k(b7) + 8 && (
        <Tuval x={1010} y={270} w={820} h={520} op={gorun(f, b6, b7)}>
          <rect x={0} y={0} width={820} height={520} rx={8} fill={RENK.mavi} opacity={0.92} />
          {Array.from({ length: 21 }, (_, i) => <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={520} stroke={RENK.kagitAcik} strokeWidth={1.2} opacity={0.25} />)}
          {Array.from({ length: 14 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 40} x2={820} y2={i * 40} stroke={RENK.kagitAcik} strokeWidth={1.2} opacity={0.25} />)}
          <Yol d="M80 80 H460 V220 H80 Z" p={ara(f, k(b6 + 0.2), k(b6 + 0.8))} renk={RENK.kagitAcik} kalin={5} />
          <Yol d="M110 130 H400 M110 175 H330" p={ara(f, k(b6 + 0.6), k(b6 + 1.1))} renk={RENK.kagitAcik} kalin={8} />
          <Yol d="M540 120 A80 80 0 1 1 539.9 120 Z" p={ara(f, k(b6 + 0.8), k(b6 + 1.4))} renk={RENK.kagitAcik} kalin={5} />
          <Yol d="M80 320 Q240 260 400 330 T740 320" p={ara(f, k(b6 + 1.1), k(b6 + 1.7))} renk={RENK.kagitAcik} kalin={5} />
          <Yol d="M80 420 H740" p={ara(f, k(b6 + 1.3), k(b6 + 1.8))} renk={RENK.kagitAcik} kalin={4} op={0.7} />
          <text x={790} y={496} textAnchor="end" fontFamily={MONO} fontSize={34} fill={RENK.kagitAcik} opacity={ara(f, k(b6 + 1.5), k(b6 + 1.8))}>plan.tsx</text>
        </Tuval>
      )}
      <Daire x={1430} y={300} w={180} h={180} bas={t(b, 6, 0.55)} son={b7} renk={RENK.kirmizi} kalin={7} />
      <Gir bas={t(b, 6, 0.62)} son={b7} x={1300} y={820} w={600}>
        <Satir boy={64} renk={RENK.kirmizi} italik>istediğin gibi düzelt</Satir>
      </Gir>
      <Ok x1={1720} y1={815} x2={1560} y2={520} bas={t(b, 6, 0.7)} son={b7} egri={0.15} />

      {/* 7 — her çizgi, her damga, her daktilo yazısı: kod */}
      <Gir bas={b7} x={130} y={200} w={980}>
        <Pencere baslik="Video.tsx" w={980}>
          {KOD.map((s, i) => (
            <div key={i} style={{ height: 150, display: "flex", alignItems: "center" }}>
              <DaktiloYazi metin={s} ilerleme={ara(f, k(t(b, 7, i * 0.28)), k(t(b, 7, i * 0.28) + 0.8))} f={f} boy={40} renk={i === 1 ? RENK.kirmizi : INK} imlec={f < k(t(b, 7, (i + 1) * 0.28))} />
            </div>
          ))}
        </Pencere>
      </Gir>
      {f >= k(t(b, 7, 0.1)) && (
        <Tuval x={1300} y={300} w={460} h={60}>
          <Yol d="M0 30 Q115 14 230 32 T460 26" p={ara(f, k(t(b, 7, 0.12)), k(t(b, 7, 0.12) + 0.5))} renk={RENK.kirmizi} kalin={9} />
        </Tuval>
      )}
      {f >= k(t(b, 7, 0.38)) && (
        <div style={{ position: "absolute", left: 1330, top: 430 }}>
          <Damga id="ornekdamga" metin="DAMGA" yas={yas(f, t(b, 7, 0.38))} boy={80} aci={-7} />
        </div>
      )}
      {f >= k(t(b, 7, 0.62)) && (
        <div style={{ position: "absolute", left: 1310, top: 680 }}>
          <DaktiloYazi metin="daktilo yazısı" ilerleme={ara(f, k(t(b, 7, 0.62)), k(t(b, 7, 0.62) + 0.9))} f={f} boy={50} />
        </div>
      )}
      {[0, 1, 2].map((i) => (
        <Ok key={i} x1={1090} y1={330 + i * 150} x2={1280} y2={[330, 490, 710][i]} bas={t(b, 7, i * 0.28 + 0.15)} egri={0.12} sure={0.3} />
      ))}
    </>
  );
};

// ================================================================ BÖLÜM 7 — beş istasyon = beş aktarma bileti
const S7: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const ISTASYON = ["senaryo", "ses", "zamanlama", "görüntü", "kontrol"];
  const ROMA = ["I", "II", "III", "IV", "V"];
  const b7 = c(b, 7);
  return (
    <>
      <Gir bas={c(b, 1)} x={140} y={150} w={1640}>
        <Manset metin="Fabrikanın beş istasyonu var." bas={c(b, 1)} yazSn={1.0} boy={84} />
      </Gir>
      {ISTASYON.map((ad, i) => {
        const bs = c(b, i + 2);
        // 7'de ok geçerken sırayla hafifçe zıplar
        const zipla = f >= k(b7) ? Math.max(0, Math.sin(Math.min(Math.PI, (f - k(b7 + i * 0.15)) * 0.35))) * -24 : 0;
        return (
          <Gir key={ad} bas={bs} x={110 + i * 352} y={320 + (i % 2) * 40 + zipla} aci={i % 2 ? 3 : -3}>
            <BuyukBilet ust="" deger={ROMA[i]} seri={`No ${i + 1}`} w={160} degerBoy={66} />
            <div style={{ position: "absolute", left: 0, top: 262, width: 320, textAlign: "center" }}>
              <Satir boy={50}>{ad}</Satir>
            </div>
          </Gir>
        );
      })}
      <Ok x1={180} y1={780} x2={1760} y2={760} bas={b7} sure={0.9} egri={-0.06} />
      <Gir bas={b7 + 0.3} x={140} y={830} w={1600}>
        <Satir boy={72}>Şimdi sırayla gidelim.</Satir>
      </Gir>
    </>
  );
};

export const SAHNELER_A: Record<number, React.FC<{ b: number }>> = {
  ...yerTutucular(1, 7),
  1: S1,
  2: S2,
  3: S3,
  4: S4,
  5: S5,
  6: S6,
  7: S7,
};

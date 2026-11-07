// W.J. Sidis Shorts — ortak parçalar (docs/SIDIS_STIL.md): gazete kâğıdı zemin, W.J. ve Daktilo karakterleri,
// tramvay aktarma bileti, kırmızı damga, dalga formu, daktilo yazısı, kaydırıcı, ekran kartı, dosya penceresi.
import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring } from "remotion";

export const RENK = {
  kagit: "#ECE6D6",
  kagitAcik: "#F7F2E6",
  kagitKoyu: "#DCD2BC",
  bilet: "#F2E6C8",
  murekkep: "#1B1A17",
  kirmizi: "#C8302C",
  mavi: "#2A4F8F",
};

export const SERIF = "'Instrument Serif', serif";
export const MONO = "'JetBrains Mono', monospace";
export const SANS = "'Inter', sans-serif";

const cikis = Easing.out(Easing.cubic);

// ---------------------------------------------------------------- giriş/çıkış: yukarıdan baskı makinesinden çıkar gibi
export const gorunum = (f: number, fps: number, giris: number, son = Infinity, sure = 7) => {
  if (f < giris - 1 || f > son + sure) return { op: 0, ty: 0, sc: 1, gorunur: false };
  const sp = spring({ frame: f - giris, fps, config: { damping: 14, stiffness: 170, mass: 0.7 } });
  const kapan = !Number.isFinite(son) ? 0 : interpolate(f, [son, son + sure], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: cikis });
  return {
    op: Math.min(1, Math.max(0, sp * 1.6)) * (1 - kapan),
    ty: (1 - sp) * -40 - kapan * 30,
    sc: 0.9 + 0.1 * sp,
    gorunur: true,
  };
};

export const Katman: React.FC<{
  f: number; fps: number; giris: number; son?: number; x: number; y: number; w?: number; aci?: number; children: React.ReactNode;
}> = ({ f, fps, giris, son, x, y, w, aci = 0, children }) => {
  const g = gorunum(f, fps, giris, son);
  if (!g.gorunur) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity: g.op, transform: `translateY(${g.ty}px) scale(${g.sc}) rotate(${aci}deg)`, transformOrigin: "50% 0%" }}>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- zemin: gazete kâğıdı + tram noktası + kenar kararması
export const Kagit: React.FC = () => (
  <AbsoluteFill style={{ background: RENK.kagit }}>
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id="tram" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="5.5" cy="5.5" r="1.25" fill={RENK.murekkep} opacity="0.07" />
        </pattern>
        <filter id="lif">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.16  0 0 0 0.18 0" />
        </filter>
        <radialGradient id="karart" cx="50%" cy="48%" r="75%">
          <stop offset="55%" stopColor="#5a4320" stopOpacity="0" />
          <stop offset="100%" stopColor="#4a3515" stopOpacity="0.32" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#tram)" />
      <rect width="100%" height="100%" filter="url(#lif)" />
      <rect width="100%" height="100%" fill="url(#karart)" />
    </svg>
  </AbsoluteFill>
);

// ---------------------------------------------------------------- tramvay aktarma bileti
export const Bilet: React.FC<{ ust: string; deger: string; seri: string; w?: number; degerBoy?: number; degerRenk?: string; children?: React.ReactNode }> = ({
  ust, deger, seri, w = 300, degerBoy = 92, degerRenk = RENK.murekkep, children,
}) => {
  const delik = (top: boolean) => (
    <div style={{ position: "absolute", left: 58 - 11, [top ? "top" : "bottom"]: -13, width: 22, height: 22, borderRadius: 11, background: RENK.kagit, border: `3px solid ${RENK.murekkep}`, clipPath: top ? "inset(50% 0 0 0)" : "inset(0 0 50% 0)" } as React.CSSProperties} />
  );
  return (
    <div style={{ position: "relative", width: w, background: RENK.bilet, border: `3.5px solid ${RENK.murekkep}`, borderRadius: 10, display: "flex", boxShadow: `5px 6px 0 rgba(27,26,23,0.12)` }}>
      <div style={{ width: 58, borderRight: `3px dashed ${RENK.murekkep}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: "rotate(-90deg)", fontFamily: MONO, fontSize: 17, color: RENK.kirmizi, whiteSpace: "nowrap", letterSpacing: 1 }}>{seri}</div>
      </div>
      <div style={{ flex: 1, padding: "12px 16px 12px 18px" }}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 18, letterSpacing: 3, color: RENK.murekkep, opacity: 0.8 }}>{ust}</div>
        <div style={{ fontFamily: SERIF, fontSize: degerBoy, lineHeight: 1.02, color: degerRenk, whiteSpace: "nowrap" }}>{deger}</div>
        {children}
      </div>
      {delik(true)}
      {delik(false)}
    </div>
  );
};

// ---------------------------------------------------------------- kırmızı damga (eğik, mürekkep dokulu, "güm" diye iner)
export const Damga: React.FC<{ id: string; metin: string; yas: number; renk?: string; boy?: number; aci?: number }> = ({ id, metin, yas, renk = RENK.kirmizi, boy = 84, aci = -8 }) => {
  if (yas < 0) return null;
  const k = interpolate(yas, [0, 5, 8], [2.3, 0.94, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const op = interpolate(yas, [0, 3], [0, 1], { extrapolateRight: "clamp" });
  const w = Math.round(metin.length * boy * 0.74 + boy * 0.9);
  const h = Math.round(boy * 1.55);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", opacity: op * 0.92, transform: `rotate(${aci}deg) scale(${k})`, display: "block" }}>
      <defs>
        <filter id={`d-${id}`} x="-15%" y="-25%" width="130%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed={[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 97} result="g" />
          <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4.2 0 0 0 3.35" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="t" />
          <feDisplacementMap in="d" in2="t" scale="5" />
        </filter>
      </defs>
      <g filter={`url(#d-${id})`}>
        <rect x={5} y={5} width={w - 10} height={h - 10} rx={10} fill="none" stroke={renk} strokeWidth={8} />
        <rect x={17} y={17} width={w - 34} height={h - 34} rx={6} fill="none" stroke={renk} strokeWidth={3} />
        <text x={w / 2} y={h / 2 + boy * 0.36} textAnchor="middle" fontFamily={SANS} fontWeight={900} fontSize={boy} letterSpacing={boy * 0.06} fill={renk}>
          {metin}
        </text>
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------- dalga formu
export type DalgaTuru = "canli" | "duz" | "burun" | "boguk";
export const Dalga: React.FC<{ tur: DalgaTuru; w: number; h: number; f: number; renk?: string; tohum?: string; cubuk?: number }> = ({
  tur, w, h, f, renk = RENK.mavi, tohum = "d", cubuk = 40,
}) => {
  const orta = h / 2;
  if (tur === "burun") {
    // sıkışık, genizden gelen zikzak: dar zarf, çok yüksek frekans
    const n = 140;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const x = (i / n) * w;
      const zarf = 0.35 + 0.65 * Math.abs(Math.sin((i / n) * Math.PI * 3 + f * 0.05));
      const y = orta + Math.sin(i * 1.9 + f * 0.9) * (h * 0.36) * zarf * (0.6 + 0.4 * random(tohum + i));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
        <line x1={0} y1={orta} x2={w} y2={orta} stroke={RENK.murekkep} strokeWidth={1.5} opacity={0.25} />
        <polyline points={pts.join(" ")} fill="none" stroke={renk} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
    );
  }
  const aralik = w / cubuk;
  const kalin = tur === "boguk" ? aralik * 0.8 : aralik * 0.55;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible", filter: tur === "boguk" ? "blur(2.2px)" : undefined }}>
      <line x1={0} y1={orta} x2={w} y2={orta} stroke={RENK.murekkep} strokeWidth={1.5} opacity={0.25} />
      {Array.from({ length: cubuk }, (_, i) => {
        let a: number;
        if (tur === "canli") {
          a = (0.22 + 0.78 * Math.abs(Math.sin(i * 0.47 + 0.6) * Math.sin(i * 0.13 + 1.2))) * (0.7 + 0.3 * random(tohum + i));
          a *= 0.78 + 0.22 * Math.sin(f * 0.35 + i * 0.9);
        } else if (tur === "duz") {
          a = 0.1 + 0.06 * random(tohum + i) + 0.02 * Math.sin(f * 0.3 + i);
        } else {
          a = 0.32 + 0.22 * Math.abs(Math.sin(i * 0.21 + f * 0.08)) + 0.08 * random(tohum + i);
        }
        const yuk = Math.max(4, a * h * 0.92);
        return <rect key={i} x={i * aralik + (aralik - kalin) / 2} y={orta - yuk / 2} width={kalin} height={yuk} rx={kalin / 2} fill={renk} opacity={tur === "boguk" ? 0.65 : 1} />;
      })}
    </svg>
  );
};

// ---------------------------------------------------------------- daktilo yazısı (harf harf)
export const DaktiloYazi: React.FC<{ metin: string; ilerleme: number; f: number; boy?: number; renk?: string; imlec?: boolean }> = ({
  metin, ilerleme, f, boy = 44, renk = RENK.murekkep, imlec = true,
}) => {
  const n = Math.round(Math.max(0, Math.min(1, ilerleme)) * metin.length);
  const yaziyor = ilerleme > 0 && ilerleme < 1;
  const gozuk = imlec && (yaziyor || Math.floor(f / 12) % 2 === 0);
  return (
    <span style={{ fontFamily: MONO, fontSize: boy, color: renk, whiteSpace: "pre" }}>
      {metin.slice(0, n)}
      <span style={{ display: "inline-block", width: boy * 0.55, height: boy * 0.95, verticalAlign: "-0.15em", background: renk, opacity: gozuk ? 0.85 : 0, marginLeft: 2 }} />
    </span>
  );
};

// ---------------------------------------------------------------- konuşma balonu (kuyruk aşağı)
export const Balon: React.FC<{ w: number; h: number; kuyrukX: number; children: React.ReactNode }> = ({ w, h, kuyrukX, children }) => (
  <div style={{ position: "relative", width: w, height: h }}>
    <svg width={w} height={h + 50} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <path
        d={`M24 3 H${w - 24} Q${w - 3} 3 ${w - 3} 24 V${h - 24} Q${w - 3} ${h - 3} ${w - 24} ${h - 3} H${kuyrukX + 16} L${kuyrukX + 34} ${h + 44} L${kuyrukX - 14} ${h - 3} H24 Q3 ${h - 3} 3 ${h - 24} V24 Q3 3 24 3 Z`}
        fill={RENK.kagitAcik}
        stroke={RENK.murekkep}
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
  </div>
);

// ---------------------------------------------------------------- W.J. (maskot)
export type Poz = "normal" | "dusunen" | "saskin" | "gosteren" | "telefon" | "omuz";
type Nokta = [number, number];

const Kol: React.FC<{ p: Nokta[]; el?: "yumruk" | "acik" | "isaret" }> = ({ p, el = "yumruk" }) => {
  const d = p.map((n, i) => `${i ? "L" : "M"}${n[0]} ${n[1]}`).join(" ");
  const [ex, ey] = p[p.length - 1];
  const [px, py] = p[p.length - 2];
  const a = Math.atan2(ey - py, ex - px);
  return (
    <g>
      <path d={d} fill="none" stroke={RENK.murekkep} strokeWidth={32} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={RENK.kagitKoyu} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
      {el === "acik" &&
        [-0.62, -0.2, 0.2, 0.62].map((da, i) => (
          <line key={i} x1={ex} y1={ey} x2={ex + Math.cos(a + da) * 25} y2={ey + Math.sin(a + da) * 25} stroke={RENK.murekkep} strokeWidth={14} strokeLinecap="round" />
        ))}
      {el === "acik" &&
        [-0.62, -0.2, 0.2, 0.62].map((da, i) => (
          <line key={"i" + i} x1={ex} y1={ey} x2={ex + Math.cos(a + da) * 25} y2={ey + Math.sin(a + da) * 25} stroke={RENK.kagitAcik} strokeWidth={6} strokeLinecap="round" />
        ))}
      {el === "isaret" && (
        <>
          <line x1={ex} y1={ey} x2={ex + Math.cos(a) * 34} y2={ey + Math.sin(a) * 34} stroke={RENK.murekkep} strokeWidth={11} strokeLinecap="round" />
          <line x1={ex} y1={ey} x2={ex + Math.cos(a) * 34} y2={ey + Math.sin(a) * 34} stroke={RENK.kagitAcik} strokeWidth={5} strokeLinecap="round" />
        </>
      )}
      <circle cx={ex} cy={ey} r={el === "acik" ? 18 : 15} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4.5} />
    </g>
  );
};

const KOLLAR: Record<Poz, { l: Nokta[]; r: Nokta[]; le?: "yumruk" | "acik" | "isaret"; re?: "yumruk" | "acik" | "isaret" }> = {
  normal: { l: [[110, 214], [92, 296], [100, 368]], r: [[210, 214], [228, 296], [220, 368]] },
  dusunen: { l: [[110, 214], [98, 330], [224, 338]], r: [[210, 214], [242, 330], [182, 200]] },
  saskin: { l: [[110, 214], [56, 168], [58, 92]], r: [[210, 214], [264, 168], [262, 92]], le: "acik", re: "acik" },
  gosteren: { l: [[110, 214], [92, 296], [100, 368]], r: [[210, 214], [276, 214], [332, 166]], re: "isaret" },
  telefon: { l: [[110, 214], [84, 296], [142, 252]], r: [[210, 214], [236, 296], [180, 252]] },
  omuz: { l: [[110, 214], [58, 286], [30, 240]], r: [[210, 214], [262, 286], [290, 240]], le: "acik", re: "acik" },
};

export const WJ: React.FC<{ poz: Poz; yas: number; f: number; boy: number; gulumse?: boolean; fikir?: number }> = ({ poz, yas, f, boy, gulumse, fikir = -1 }) => {
  const k = boy / 580;
  const sars = Math.exp(-yas / 4) * Math.cos(yas * 0.75);
  const sy = 1 - 0.07 * sars + 0.006 * Math.sin(f * 0.12);
  const sx = 1 + 0.045 * sars;
  const kol = KOLLAR[poz];
  const saskin = poz === "saskin";
  const bak: Nokta = poz === "telefon" ? [0, 6] : poz === "dusunen" ? [5, -5] : poz === "gosteren" || poz === "omuz" ? [5, 0] : [3, 1];
  const kirp = Math.floor(f) % 97 < 3 && !saskin;
  const goz = (cx: number) =>
    kirp ? (
      <line x1={cx - 8} y1={128} x2={cx + 8} y2={128} stroke={RENK.murekkep} strokeWidth={4} strokeLinecap="round" />
    ) : (
      <circle cx={cx + bak[0]} cy={128 + bak[1]} r={saskin ? 3.5 : 5} fill={RENK.murekkep} />
    );
  const kas = saskin || poz === "omuz" ? -8 : 0;
  return (
    <svg width={320 * k} height={boy} viewBox="0 0 320 580" style={{ overflow: "visible", transform: `scale(${sx}, ${sy})`, transformOrigin: "50% 100%" }}>
      {/* bacaklar + ayakkabı */}
      <path d="M112 378 L104 540 L152 540 L158 404 L162 404 L168 540 L216 540 L208 378 Z" fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={5} strokeLinejoin="round" />
      <line x1={160} y1={404} x2={160} y2={392} stroke={RENK.murekkep} strokeWidth={4} />
      <ellipse cx={124} cy={548} rx={32} ry={12} fill={RENK.murekkep} />
      <ellipse cx={198} cy={548} rx={32} ry={12} fill={RENK.murekkep} />
      {/* kazak */}
      <path d="M104 208 Q160 192 216 208 L228 380 Q160 394 92 380 Z" fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={5} strokeLinejoin="round" />
      <path d="M96 362 Q160 374 224 362" fill="none" stroke={RENK.murekkep} strokeWidth={3} />
      <path d="M95 370 Q160 382 225 370" fill="none" stroke={RENK.murekkep} strokeWidth={2} opacity={0.6} />
      <text x={160} y={312} textAnchor="middle" fontFamily={SERIF} fontSize={50} fill={RENK.murekkep}>W.J.</text>
      {/* boyun + yaka */}
      <rect x={148} y={178} width={24} height={26} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} />
      <path d="M138 200 L160 228 L182 200" fill="none" stroke={RENK.murekkep} strokeWidth={4.5} strokeLinejoin="round" />
      {/* kollar */}
      <Kol p={kol.l} el={kol.le} />
      {poz !== "telefon" && poz !== "dusunen" && <Kol p={kol.r} el={kol.re} />}
      {poz === "telefon" && (
        <>
          <rect x={138} y={196} width={46} height={72} rx={8} fill={RENK.murekkep} transform="rotate(-8 161 232)" />
          <rect x={143} y={203} width={36} height={54} rx={4} fill={RENK.mavi} opacity={0.85} transform="rotate(-8 161 232)" />
          <Kol p={kol.r} el={kol.re} />
        </>
      )}
      {/* kulaklar + kafa */}
      <circle cx={100} cy={132} r={12} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} />
      <circle cx={220} cy={132} r={12} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} />
      <circle cx={160} cy={128} r={60} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} />
      {/* kaşlar */}
      <path d={`M124 ${104 + kas} Q137 ${98 + kas} 150 ${104 + kas}`} fill="none" stroke={RENK.murekkep} strokeWidth={4} strokeLinecap="round" />
      <path d={`M170 ${(poz === "dusunen" ? 98 : 104) + kas} Q183 ${(poz === "dusunen" ? 90 : 98) + kas} 196 ${(poz === "dusunen" ? 98 : 104) + kas}`} fill="none" stroke={RENK.murekkep} strokeWidth={4} strokeLinecap="round" />
      {/* gözlük */}
      {goz(137)}
      {goz(183)}
      <circle cx={137} cy={128} r={19} fill="none" stroke={RENK.murekkep} strokeWidth={4.5} />
      <circle cx={183} cy={128} r={19} fill="none" stroke={RENK.murekkep} strokeWidth={4.5} />
      <path d="M156 126 Q160 120 164 126" fill="none" stroke={RENK.murekkep} strokeWidth={4} />
      <line x1={118} y1={124} x2={104} y2={120} stroke={RENK.murekkep} strokeWidth={3.5} />
      <line x1={202} y1={124} x2={216} y2={120} stroke={RENK.murekkep} strokeWidth={3.5} />
      {/* burun + ağız */}
      <path d="M160 138 Q168 152 158 156" fill="none" stroke={RENK.murekkep} strokeWidth={3.5} strokeLinecap="round" />
      {saskin ? (
        <ellipse cx={160} cy={172} rx={9} ry={12} fill={RENK.murekkep} />
      ) : poz === "dusunen" ? (
        <path d="M146 172 L172 168" stroke={RENK.murekkep} strokeWidth={4} strokeLinecap="round" />
      ) : gulumse || poz === "omuz" ? (
        <path d="M140 164 Q160 184 180 164" fill="none" stroke={RENK.murekkep} strokeWidth={4.5} strokeLinecap="round" />
      ) : (
        <path d="M148 168 Q160 175 172 168" fill="none" stroke={RENK.murekkep} strokeWidth={4} strokeLinecap="round" />
      )}
      {/* kasket */}
      <path d="M94 104 Q90 46 160 38 Q228 42 228 98 Q192 86 160 88 Q124 88 94 104 Z" fill={RENK.murekkep} />
      <path d="M150 94 Q204 80 252 100 Q246 112 204 108 Q172 104 150 102 Z" fill={RENK.murekkep} />
      <path d="M116 66 Q160 50 206 62" fill="none" stroke={RENK.kagitAcik} strokeWidth={2} opacity={0.45} />
      <circle cx={160} cy={40} r={6} fill={RENK.murekkep} />
      {poz === "dusunen" && <Kol p={kol.r} el={kol.re} />}
      {/* fikir çizgileri */}
      {fikir >= 0 && fikir < 40 &&
        [-60, -25, 10].map((aci, i) => {
          const r = (aci * Math.PI) / 180;
          const u = interpolate(fikir, [0, 6, 30, 40], [0, 1, 1, 0], { extrapolateRight: "clamp" });
          return (
            <line key={i} x1={226 + Math.cos(r) * 26} y1={50 + Math.sin(r) * 26} x2={226 + Math.cos(r) * (26 + 30 * u)} y2={50 + Math.sin(r) * (26 + 30 * u)} stroke={RENK.kirmizi} strokeWidth={6} strokeLinecap="round" opacity={u} />
          );
        })}
    </svg>
  );
};

// ---------------------------------------------------------------- Daktilo (yapay zekâ)
export type Goz = "acik" | "kirp" | "kirpGoz" | "uzgun";
export const Daktilo: React.FC<{ f: number; boy: number; konusuyor: boolean; goz: Goz; bak?: Nokta }> = ({ f, boy, konusuyor, goz, bak = [-6, 2] }) => {
  const k = boy / 360;
  const tus = (x: number, y: number, i: number) => {
    const dy = konusuyor ? Math.max(0, Math.sin(f * 0.85 + i * 1.7)) * 7 : 0;
    return (
      <g key={i}>
        <line x1={x} y1={y + dy} x2={x} y2={y + 16} stroke={RENK.murekkep} strokeWidth={3} />
        <circle cx={x} cy={y + dy} r={10} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={3.5} />
      </g>
    );
  };
  const gozCiz = (cx: number, sag: boolean) => {
    if (goz === "kirp" || (goz === "kirpGoz" && sag)) {
      return <path d={`M${cx - 22} 80 Q${cx} 62 ${cx + 22} 80`} fill="none" stroke={RENK.murekkep} strokeWidth={5} strokeLinecap="round" />;
    }
    return (
      <g>
        <circle cx={cx} cy={76} r={23} fill="#fff" stroke={RENK.murekkep} strokeWidth={4.5} />
        <circle cx={cx + bak[0]} cy={76 + bak[1]} r={10} fill={RENK.murekkep} />
        <circle cx={cx + bak[0] + 3} cy={72 + bak[1]} r={3} fill="#fff" />
        {goz === "uzgun" && <path d={`M${cx - 24} ${sag ? 50 : 56} L${cx + 24} ${sag ? 56 : 50}`} stroke={RENK.murekkep} strokeWidth={5} strokeLinecap="round" />}
      </g>
    );
  };
  const kag = konusuyor ? Math.sin(f * 0.5) * 1.5 : 0;
  return (
    <svg width={boy} height={330 * k} viewBox="0 0 360 330" style={{ overflow: "visible" }}>
      {/* kâğıt + gözler */}
      <g transform={`translate(0 ${kag})`}>
        <path d="M102 150 L102 22 Q102 12 112 12 L250 12 Q260 12 260 22 L260 150 Z" fill="#FBF8EF" stroke={RENK.murekkep} strokeWidth={4.5} />
        <line x1={126} y1={116} x2={236} y2={116} stroke={RENK.murekkep} strokeWidth={2.5} opacity={0.35} />
        <line x1={126} y1={130} x2={208} y2={130} stroke={RENK.murekkep} strokeWidth={2.5} opacity={0.35} />
        {gozCiz(146, false)}
        {gozCiz(216, true)}
      </g>
      {/* kâğıt kılavuzu + merdane */}
      <rect x={84} y={130} width={192} height={12} rx={3} fill={RENK.murekkep} />
      <rect x={40} y={142} width={280} height={34} rx={17} fill={RENK.murekkep} />
      <circle cx={34} cy={159} r={17} fill="#3A3833" stroke={RENK.murekkep} strokeWidth={4} />
      <circle cx={326} cy={159} r={17} fill="#3A3833" stroke={RENK.murekkep} strokeWidth={4} />
      <path d="M44 150 L8 116 L18 104" fill="none" stroke={RENK.murekkep} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      {/* gövde */}
      <path d="M48 178 L312 178 L346 300 Q348 318 328 318 L32 318 Q12 318 14 300 Z" fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={5} strokeLinejoin="round" />
      <text x={180} y={204} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={15} letterSpacing={5} fill={RENK.murekkep}>DAKTİLO</text>
      {Array.from({ length: 9 }, (_, i) => tus(80 + i * 25, 224, i))}
      {Array.from({ length: 10 }, (_, i) => tus(68 + i * 25, 256, i + 9))}
      <rect x={110} y={286} width={140} height={14} rx={7} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={3.5} />
    </svg>
  );
};

// ---------------------------------------------------------------- kaydırıcı ("kalınlık")
export const Kaydirici: React.FC<{ deger: number; w: number }> = ({ deger, w }) => {
  const iz = w - 80;
  return (
    <div style={{ width: w, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 14, padding: "18px 40px 26px", boxSizing: "border-box", boxShadow: "6px 7px 0 rgba(27,26,23,0.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, letterSpacing: 3, color: RENK.murekkep }}>KALINLIK</span>
        <span style={{ fontFamily: MONO, fontSize: 36, color: RENK.mavi }}>{deger.toFixed(2)}</span>
      </div>
      <div style={{ position: "relative", height: 70, marginTop: 6 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 31, height: 8, background: RENK.murekkep, borderRadius: 4 }} />
        <div style={{ position: "absolute", left: 0, width: iz * deger, top: 29, height: 12, background: RENK.mavi, borderRadius: 6 }} />
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: (iz * i) / 10, top: 50, width: 3, height: i % 5 === 0 ? 18 : 10, background: RENK.murekkep }} />
        ))}
        <div style={{ position: "absolute", left: iz * deger - 26, top: 9, width: 52, height: 52, borderRadius: 26, background: RENK.kagitAcik, border: `6px solid ${RENK.murekkep}`, boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, color: RENK.murekkep, opacity: 0.7, marginTop: 4 }}>
        <span>ince</span>
        <span>kalın</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- ekran kartı + bellek çubuğu
export const EkranKarti: React.FC<{ f: number; gb: number; w: number; etiket: boolean; donuyor: boolean }> = ({ f, gb, w, etiket, donuyor }) => {
  const k = w / 760;
  const fan = (cx: number) => (
    <g transform={`translate(${cx} 128)`}>
      <circle r={78} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} />
      <g transform={`rotate(${donuyor ? f * 14 : f * 2})`}>
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d="M0 0 Q26 -18 58 -36 Q46 -10 0 0 Z" fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={3.5} transform={`rotate(${(i * 360) / 7})`} />
        ))}
      </g>
      <circle r={16} fill={RENK.murekkep} />
    </g>
  );
  const asim = Math.max(0, gb - 8);
  const doluluk = Math.min(gb, 8) / 8;
  const barW = w - 20;
  return (
    <div style={{ width: w }}>
      <svg width={w} height={290 * k} viewBox="0 0 760 290" style={{ display: "block", overflow: "visible" }}>
        <path d="M10 22 L34 22 L34 262 L10 262 Z" fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={4} />
        <rect x={34} y={14} width={706} height={232} rx={12} fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={5} />
        {fan(220)}
        {fan(430)}
        <rect x={560} y={50} width={150} height={150} rx={8} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} />
        <text x={635} y={115} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={22} letterSpacing={3} fill={RENK.murekkep}>EKRAN</text>
        <text x={635} y={145} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={22} letterSpacing={3} fill={RENK.murekkep}>KARTI</text>
        <text x={635} y={186} textAnchor="middle" fontFamily={SERIF} fontSize={46} fill={RENK.kirmizi} opacity={etiket ? 1 : 0}>8 GB</text>
        <rect x={150} y={246} width={380} height={24} fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={4} />
        {Array.from({ length: 18 }, (_, i) => (
          <line key={i} x1={166 + i * 20} y1={250} x2={166 + i * 20} y2={266} stroke={RENK.murekkep} strokeWidth={3} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 22, width: barW }}>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: 3, color: RENK.murekkep }}>BELLEK</span>
        <span style={{ fontFamily: MONO, fontSize: 38, color: asim > 0 ? RENK.kirmizi : RENK.murekkep }}>{gb.toFixed(1)} / 8 GB</span>
      </div>
      <div style={{ position: "relative", width: barW, height: 50, marginTop: 8, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.kagitAcik, boxSizing: "border-box" }}>
        <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: (barW - 16) * doluluk, background: doluluk > 0.9 ? RENK.kirmizi : RENK.mavi, borderRadius: 3 }} />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: ((barW - 8) * (i + 1)) / 8, top: 0, bottom: 0, width: 2, background: RENK.murekkep, opacity: 0.35 }} />
        ))}
        {asim > 0 && (
          <svg width={140} height={120} style={{ position: "absolute", left: barW - 12, top: -4, overflow: "visible" }}>
            <path d={`M0 4 H${Math.min(1, asim / 1.2) * 70} Q${Math.min(1, asim / 1.2) * 70 + 14} 26 ${Math.min(1, asim / 1.2) * 70} 46 H0 Z`} fill={RENK.kirmizi} />
            {[18, 44, 62].map((x, i) => {
              const u = Math.max(0, Math.min(1, asim / 1.2 - i * 0.15));
              return <path key={i} d={`M${x - 7} 44 Q${x} ${44 + 50 * u} ${x + 7} 44 Z`} fill={RENK.kirmizi} opacity={u > 0 ? 1 : 0} />;
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- dosya penceresi
export const Pencere: React.FC<{ baslik: string; w: number; children: React.ReactNode }> = ({ baslik, w, children }) => (
  <div style={{ width: w, background: "#FBF8EF", border: `5px solid ${RENK.murekkep}`, borderRadius: 14, boxShadow: "8px 10px 0 rgba(27,26,23,0.14)", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `4px solid ${RENK.murekkep}`, background: RENK.kagitKoyu }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: 9, border: `3.5px solid ${RENK.murekkep}` }} />
      ))}
      <span style={{ fontFamily: MONO, fontSize: 28, color: RENK.murekkep, marginLeft: 14 }}>{baslik}</span>
    </div>
    <div style={{ padding: "26px 30px 30px" }}>{children}</div>
  </div>
);

// Kısım F — "VI · Hatalar ve hediye" (bölüm 61–74).
// 61–70: on hata, her biri gazete "DÜZELTME" ilanı + sağda küçük çizim. 71: Sidis'e dönüş. 72: Otopilot hediyesi.
// 73: kendi zevkini kat. 74: sonraki video + yorum + kapanış kartı (delinen son bilet).
// Bütün ipuçları zaman.json'dan (bölüm, cümle[, cümle içi oran]) ile okunur; sabit saniye yok.
import React from "react";
import { Easing, random, useCurrentFrame } from "remotion";
import {
  AltCizgi, Balon, Bilet, Daire, Daktilo, DaktiloYazi, Dalga, Damga, Ekran, Gir, MONO, Manset, Ok, Poz, RENK, SANS, SERIF, UstunuCiz, WJ,
  ara, c, cikis, cs, giris, k, yerTutucular,
} from "./Ortak";

// ---------------------------------------------------------------- yardımcılar
type S = React.FC<{ b: number }>;
/** b. bölüm n. cümlenin içinde t oranındaki an (saniye) — uzun cümleleri bölmek için */
const z = (b: number, n: number, t = 0) => c(b, n) + (cs(b, n) - c(b, n)) * t;
const M = RENK.murekkep;
const KIR = RENK.kirmizi;
const MAV = RENK.mavi;

const DamgaT: React.FC<{ id: string; metin: string; bas: number; x: number; y: number; boy?: number; aci?: number; son?: number; renk?: string }> = ({ id, metin, bas, x, y, boy = 64, aci = -8, son, renk }) => {
  const f = useCurrentFrame();
  const yas = f - k(bas);
  if (yas < 0) return null;
  const op = son === undefined ? 1 : 1 - ara(f, k(son), k(son) + 8);
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: op }}>
      <Damga id={id} metin={metin} yas={yas} boy={boy} aci={aci} renk={renk} />
    </div>
  );
};

const WJT: React.FC<{ poz: Poz; bas: number; son?: number; x: number; y: number; boy: number; gulumse?: boolean; fikir?: number }> = ({ poz, bas, son, x, y, boy, gulumse, fikir }) => {
  const f = useCurrentFrame();
  return (
    <Gir bas={bas} son={son} x={x} y={y}>
      <WJ poz={poz} yas={f - k(bas)} f={f} boy={boy} gulumse={gulumse} fikir={fikir === undefined ? -1 : f - k(fikir)} />
    </Gir>
  );
};

const DaktiloT: React.FC<{ bas: number; son?: number; x: number; y: number; boy: number; konus?: [number, number]; goz?: "acik" | "kirp" | "kirpGoz" | "uzgun" }> = ({ bas, son, x, y, boy, konus, goz = "acik" }) => {
  const f = useCurrentFrame();
  const konusuyor = konus ? f >= k(konus[0]) && f <= k(konus[1]) : false;
  return (
    <Gir bas={bas} son={son} x={x} y={y}>
      <Daktilo f={f} boy={boy} konusuyor={konusuyor} goz={goz} />
    </Gir>
  );
};

/** kâğıt kart (mürekkep kenarlı) */
const Kart: React.FC<{ w?: number; renk?: string; boy?: number; font?: string; hiza?: "left" | "center"; bg?: string; pad?: string; children: React.ReactNode }> = ({ w, renk = M, boy = 44, font = SERIF, hiza = "left", bg = RENK.kagitAcik, pad = "14px 24px 16px", children }) => (
  <div style={{ width: w, boxSizing: "border-box", background: bg, border: `4px solid ${renk}`, borderRadius: 10, padding: pad, boxShadow: "6px 7px 0 rgba(27,26,23,0.14)", fontFamily: font, fontSize: boy, lineHeight: 1.12, color: M, textAlign: hiza }}>
    {children}
  </div>
);

const Etiket: React.FC<{ renk?: string; children: React.ReactNode }> = ({ renk = KIR, children }) => (
  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 3, color: renk }}>{children}</div>
);

/** elle çizilmiş onay işareti, bas'tan itibaren çizilir */
const Tik: React.FC<{ bas: number; boy?: number; renk?: string }> = ({ bas, boy = 46, renk = KIR }) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas) + 8, Easing.out(Easing.quad));
  return (
    <svg width={boy} height={boy} viewBox="0 0 50 50" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }}>
      <path d="M6 27 L20 41 L46 8" fill="none" stroke={renk} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};
const Carpi: React.FC<{ bas: number; boy?: number; renk?: string }> = ({ bas, boy = 46, renk = KIR }) => {
  const f = useCurrentFrame();
  const p1 = ara(f, k(bas), k(bas) + 5);
  const p2 = ara(f, k(bas) + 4, k(bas) + 9);
  const st = { fill: "none", stroke: renk, strokeWidth: 7, strokeLinecap: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <svg width={boy} height={boy} viewBox="0 0 50 50" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }}>
      <path d="M8 8 L42 42" {...st} strokeDashoffset={1 - p1} />
      <path d="M42 8 L8 42" {...st} strokeDashoffset={1 - p2} />
    </svg>
  );
};

/** tramvay biletini büyütür (parcalar'daki bilet 9:16 için küçük yazılı; 34px altı kalmasın) */
const BuyukBilet: React.FC<{ olcek?: number; w?: number; ust: string; deger: string; seri: string; degerBoy?: number; degerRenk?: string; children?: React.ReactNode }> = ({ olcek = 1.9, w = 300, children, ...p }) => (
  <div style={{ transform: `scale(${olcek})`, transformOrigin: "0 0", width: w }}>
    <Bilet w={w} {...p}>{children}</Bilet>
  </div>
);

/** basit pencere (başlık yazısı 34px) */
const Pen: React.FC<{ baslik: string; w: number; children: React.ReactNode; baslikRenk?: string }> = ({ baslik, w, children, baslikRenk = M }) => (
  <div style={{ width: w, background: "#FBF8EF", border: `5px solid ${M}`, borderRadius: 14, boxShadow: "8px 10px 0 rgba(27,26,23,0.14)", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: `4px solid ${M}`, background: RENK.kagitKoyu }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: 9, border: `3.5px solid ${M}`, flex: "0 0 auto" }} />
      ))}
      <span style={{ fontFamily: MONO, fontSize: 34, color: baslikRenk, marginLeft: 12, whiteSpace: "nowrap" }}>{baslik}</span>
    </div>
    <div style={{ padding: "22px 28px 26px" }}>{children}</div>
  </div>
);

/** karalama satırları (okunmayan metin yerine) */
const Karalama: React.FC<{ w: number; n: number; tohum: string; renk?: string; kalin?: number; ara_?: number }> = ({ w, n, tohum, renk = M, kalin = 6, ara_ = 26 }) => (
  <svg width={w} height={n * ara_} style={{ display: "block" }}>
    {Array.from({ length: n }, (_, i) => {
      const uz = w * (0.55 + 0.45 * random(tohum + i));
      return <line key={i} x1={0} y1={i * ara_ + ara_ / 2} x2={uz} y2={i * ara_ + ara_ / 2} stroke={renk} strokeWidth={kalin} strokeLinecap="round" opacity={0.5} />;
    })}
  </svg>
);

// ---------------------------------------------------------------- düzeltme ilanı iskeleti
const Duzeltme: React.FC<{ no: number; baslik: string; bas: number }> = ({ no, baslik, bas }) => (
  <>
    <Gir bas={bas} x={120} y={116} w={1680}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 3, color: KIR }}>DÜZELTME · No. {no}</span>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 38, color: M, opacity: 0.7 }}>on hatadan {no}.</span>
      </div>
      <div style={{ borderTop: `3px solid ${M}`, borderBottom: `1px solid ${M}`, height: 5, marginTop: 8 }} />
    </Gir>
    <div style={{ position: "absolute", left: 120, top: 196, width: 1680 }}>
      <Manset metin={baslik} bas={bas + 0.2} boy={76} />
    </div>
  </>
);

/** sol sütun: cümleye kilitli ilan satırları; en yenisi koyu, eskiler soluk */
const Satirlar: React.FC<{ satirlar: { t: number; metin: string }[]; x?: number; y?: number; w?: number; boy?: number }> = ({ satirlar, x = 120, y = 330, w = 800, boy = 46 }) => {
  const f = useCurrentFrame();
  let son = -1;
  satirlar.forEach((s, i) => {
    if (f >= k(s.t)) son = i;
  });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, display: "flex", flexDirection: "column", gap: 20 }}>
      {satirlar.map((s, i) => {
        const p = ara(f, k(s.t), k(s.t) + 10, Easing.out(Easing.cubic));
        return (
          <div key={i} style={{ display: "flex", gap: 18, opacity: p * (i === son ? 1 : 0.5), transform: `translateX(${(1 - p) * -30}px)` }}>
            <span style={{ flex: "0 0 auto", width: 30, height: 5, marginTop: boy * 0.62, background: i === son ? KIR : M }} />
            <span style={{ fontFamily: SERIF, fontSize: boy, lineHeight: 1.12, color: M }}>{s.metin}</span>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- küçük çizimler
const Kronometre: React.FC<{ boy: number; hiz?: number }> = ({ boy, hiz = 6 }) => {
  const f = useCurrentFrame();
  return (
    <svg width={boy} height={boy * 1.15} viewBox="0 0 200 230" style={{ display: "block", overflow: "visible" }}>
      <rect x={86} y={4} width={28} height={22} rx={4} fill={M} />
      <line x1={100} y1={26} x2={100} y2={40} stroke={M} strokeWidth={8} />
      <circle cx={100} cy={130} r={90} fill={RENK.kagitAcik} stroke={M} strokeWidth={7} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={100 + Math.sin(a) * 74} y1={130 - Math.cos(a) * 74} x2={100 + Math.sin(a) * 84} y2={130 - Math.cos(a) * 84} stroke={M} strokeWidth={i % 3 === 0 ? 6 : 3} />;
      })}
      <line x1={100} y1={130} x2={100} y2={62} stroke={KIR} strokeWidth={6} strokeLinecap="round" transform={`rotate(${f * hiz} 100 130)`} />
      <circle cx={100} cy={130} r={8} fill={M} />
    </svg>
  );
};

const Nota: React.FC<{ boy: number; renk?: string }> = ({ boy, renk = M }) => (
  <svg width={boy} height={boy} viewBox="0 0 100 100" style={{ display: "block" }}>
    <path d="M38 78 V20 L82 10 V66" fill="none" stroke={renk} strokeWidth={7} strokeLinejoin="round" />
    <ellipse cx={28} cy={80} rx={14} ry={10} fill={renk} transform="rotate(-20 28 80)" />
    <ellipse cx={72} cy={68} rx={14} ry={10} fill={renk} transform="rotate(-20 72 68)" />
  </svg>
);

const Kulak: React.FC<{ boy: number }> = ({ boy }) => (
  <svg width={boy} height={boy * 1.3} viewBox="0 0 100 130" style={{ display: "block", overflow: "visible" }}>
    <path d="M30 40 Q30 6 62 6 Q94 6 92 44 Q90 66 72 78 Q60 88 62 104 Q62 124 42 124 Q26 124 24 108" fill={RENK.kagitAcik} stroke={M} strokeWidth={6} strokeLinecap="round" />
    <path d="M46 44 Q48 24 64 26 Q78 28 76 46 Q74 58 62 62" fill="none" stroke={M} strokeWidth={5} strokeLinecap="round" />
  </svg>
);

const Duvar: React.FC<{ w: number; h: number; kapi?: number }> = ({ w, h, kapi = 0 }) => {
  const sira = 7;
  const tug = 110;
  const yh = h / sira;
  const kx = w / 2 - 70;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <rect x={0} y={0} width={w} height={h} fill={RENK.kagitKoyu} stroke={M} strokeWidth={6} />
      {Array.from({ length: sira }, (_, r) => (
        <g key={r}>
          {r > 0 && <line x1={0} y1={r * yh} x2={w} y2={r * yh} stroke={M} strokeWidth={3} opacity={0.7} />}
          {Array.from({ length: Math.ceil(w / tug) + 1 }, (_, i) => {
            const x = i * tug + (r % 2 ? tug / 2 : 0);
            return x > 0 && x < w ? <line key={i} x1={x} y1={r * yh} x2={x} y2={(r + 1) * yh} stroke={M} strokeWidth={3} opacity={0.7} /> : null;
          })}
        </g>
      ))}
      {kapi > 0 && (
        <g>
          <rect x={kx} y={h - 230} width={140} height={230} fill="#FBF8EF" stroke={M} strokeWidth={6} />
          <path d={`M${kx} ${h - 230} L${kx - 70 * kapi} ${h - 214} L${kx - 70 * kapi} ${h + 10} L${kx} ${h}`} fill={RENK.kagitKoyu} stroke={M} strokeWidth={5} strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
};

const Merdiven: React.FC<{ h: number }> = ({ h }) => (
  <svg width={120} height={h} viewBox={`0 0 120 ${h}`} style={{ display: "block", overflow: "visible" }}>
    <line x1={20} y1={h} x2={60} y2={0} stroke={M} strokeWidth={7} strokeLinecap="round" />
    <line x1={80} y1={h} x2={112} y2={0} stroke={M} strokeWidth={7} strokeLinecap="round" />
    {Array.from({ length: 7 }, (_, i) => {
      const t = (i + 0.6) / 7.4;
      return <line key={i} x1={20 + 40 * t} y1={h - h * t} x2={80 + 32 * t} y2={h - h * t} stroke={M} strokeWidth={6} strokeLinecap="round" />;
    })}
  </svg>
);

const Fan: React.FC<{ boy: number; hiz: number }> = ({ boy, hiz }) => {
  const f = useCurrentFrame();
  return (
    <svg width={boy} height={boy} viewBox="-80 -80 160 160" style={{ display: "block" }}>
      <circle r={74} fill={RENK.kagitAcik} stroke={M} strokeWidth={5} />
      <g transform={`rotate(${f * hiz})`}>
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d="M0 0 Q26 -18 56 -34 Q44 -10 0 0 Z" fill={RENK.kagitKoyu} stroke={M} strokeWidth={3.5} transform={`rotate(${(i * 360) / 7})`} />
        ))}
      </g>
      <circle r={14} fill={M} />
    </svg>
  );
};

const Bilgisayar: React.FC<{ w: number; children?: React.ReactNode }> = ({ w, children }) => (
  <div style={{ width: w, position: "relative" }}>
    <div style={{ width: w, height: w * 0.58, boxSizing: "border-box", border: `6px solid ${M}`, borderRadius: 12, background: "#FBF8EF", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    <div style={{ width: w * 0.16, height: w * 0.1, margin: "0 auto", background: M }} />
    <div style={{ width: w * 0.42, height: 12, margin: "0 auto", background: M, borderRadius: 6 }} />
  </div>
);

/** bölümün asıl cümleleri bittiğinde basılan damga */
const Duzeltildi: React.FC<{ b: number; bas: number; x: number; y: number }> = ({ b, bas, x, y }) => <DamgaT id={`dz${b}`} metin="DÜZELTİLDİ" bas={bas} x={x} y={y} boy={58} aci={-7} />;

// ================================================================ 61 — hatalara giriş + 1. hata: tek seferde
const S61: S = ({ b }) => {
  const f = useCurrentFrame();
  const g2 = c(b, 2);
  return (
    <>
      {/* giriş: on düzeltme fişi sırayla düşer */}
      <Gir bas={giris(b)} son={g2} x={160} y={150} w={1600}>
        <Etiket>VI · HATALAR — No. {b}</Etiket>
        <div style={{ borderTop: `3px solid ${M}`, borderBottom: `1px solid ${M}`, height: 5, marginTop: 10 }} />
      </Gir>
      {f < k(g2) + 8 && (
        <div style={{ position: "absolute", left: 160, top: 240, width: 1600 }}>
          <Manset metin="Bu fabrikayı kurarken çok hata yaptım." bas={z(b, 1, 0.35)} boy={84} />
        </div>
      )}
      {Array.from({ length: 10 }, (_, i) => (
        <Gir key={i} bas={z(b, 1, 0.3 + i * 0.065)} son={g2} x={160 + (i % 5) * 326} y={440 + Math.floor(i / 5) * 240} aci={(random("f61" + i) - 0.5) * 7}>
          <Kart w={290} hiza="center" pad="12px 10px 14px">
            <Etiket>DÜZELTME</Etiket>
            <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1 }}>No. {i + 1}</div>
          </Kart>
        </Gir>
      ))}
      {/* 1. hata */}
      {f >= k(g2) - 1 && (
        <>
          <Duzeltme no={1} baslik="Her şeyi tek seferde yaptırmak" bas={g2} />
          <Satirlar
            satirlar={[
              { t: z(b, 2, 0.3), metin: "Tek komut, tek seferde, koca bir iş." },
              { t: c(b, 3), metin: "“Bana on beş dakikalık bir video yap.”" },
              { t: z(b, 3, 0.6), metin: "Çıkan: ortalama bir şey." },
              { t: c(b, 4), metin: "Şimdi: iş istasyonlara bölünüyor, her biri ayrı kontrol." },
            ]}
          />
        </>
      )}
      <DaktiloT bas={g2 + 0.3} son={cs(b, 3)} x={1420} y={580} boy={330} konus={[z(b, 3, 0.2), z(b, 3, 0.6)]} />
      <Gir bas={c(b, 3)} son={cs(b, 3)} x={1040} y={330} w={760}>
        <Balon w={740} h={170} kuyrukX={540}>
          <span style={{ fontFamily: MONO, fontSize: 38, color: M, textAlign: "center", padding: "0 30px" }}>“15 dakikalık bir video yap”</span>
        </Balon>
      </Gir>
      <Gir bas={z(b, 3, 0.6)} son={cs(b, 3)} x={1020} y={640} aci={-4}>
        <Kart w={250} hiza="center" boy={50}>
          <Etiket renk={M}>SONUÇ</Etiket>ortalama
        </Kart>
      </Gir>
      <DamgaT id="f61a" metin="OLMAMIŞ" bas={z(b, 3, 0.68)} son={cs(b, 3)} x={1000} y={830} boy={62} aci={-10} />
      {[0, 1, 2, 3].map((i) => (
        <Gir key={i} bas={z(b, 4, i * 0.15)} x={1030 + (i % 2) * 400} y={360 + Math.floor(i / 2) * 200}>
          <Kart w={360} boy={52}>
            İstasyon {i + 1}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 34, marginTop: 6 }}>
              kontrol <Tik bas={z(b, 4, 0.35 + i * 0.12)} />
            </div>
          </Kart>
        </Gir>
      ))}
      <Duzeltildi b={b} bas={z(b, 4, 0.85)} x={1180} y={800} />
    </>
  );
};

// ================================================================ 62 — 2. hata: süre
const S62: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  return (
    <>
      <Duzeltme no={2} baslik="Süreyi hesaplamamak" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Senaryoyu yazdım: on beş dakika sandım." },
          { t: z(b, 2, 0.6), metin: "Seslendirince: on bir dakika." },
          { t: c(b, 3), metin: "Yapay zekâ sesi sandığımdan hızlı konuşuyordu." },
          { t: c(b, 4), metin: "Şimdi: kelime sayısından süre tahmini." },
          { t: c(b, 5), metin: "Kendi sesimde bir kelime ≈ yarım saniye." },
        ]}
      />
      <Gir bas={g + 0.3} son={c(b, 2)} x={1240} y={360}>
        <Kronometre boy={380} />
      </Gir>
      <Gir bas={c(b, 2)} son={cs(b, 2)} x={1020} y={360} w={780}>
        <Kart w={780} pad="16px 30px 20px">
          <Etiket renk={M}>SENARYO · TAHMİN</Etiket>
          <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
            <span style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 1.05 }}><span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 124, letterSpacing: 2 }}>15</span> dk</span>
            <span style={{ fontFamily: MONO, fontSize: 36, opacity: 0.7 }}>sandım</span>
          </div>
          <Karalama w={700} n={4} tohum="s62" />
        </Kart>
      </Gir>
      <UstunuCiz x={1050} y={505} w={330} bas={z(b, 2, 0.55)} son={cs(b, 2)} />
      <Gir bas={z(b, 2, 0.6)} son={cs(b, 2)} x={1420} y={750} aci={-6}>
        <div style={{ fontFamily: SERIF, fontSize: 150, color: KIR, lineHeight: 1 }}><span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 124, letterSpacing: 2 }}>11</span> dk</div>
        <div style={{ fontFamily: MONO, fontSize: 36, color: KIR }}>seslendirince</div>
      </Gir>
      <DaktiloT bas={c(b, 3)} son={cs(b, 3)} x={1300} y={420} boy={380} konus={[c(b, 3), cs(b, 3)]} />
      <Gir bas={c(b, 3) + 0.2} son={cs(b, 3)} x={1010} y={470}>
        <svg width={280} height={260} style={{ overflow: "visible" }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const kay = ((f * 14 + i * 60) % 280) - 40;
            return <line key={i} x1={240 - kay} y1={30 + i * 48} x2={240 - kay + 110} y2={30 + i * 48} stroke={M} strokeWidth={7} strokeLinecap="round" opacity={0.6} />;
          })}
        </svg>
      </Gir>
      <Gir bas={z(b, 3, 0.3)} son={cs(b, 3)} x={1060} y={790} aci={-4}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 72, color: KIR }}>hızlı konuşuyor</div>
      </Gir>
      <Gir bas={c(b, 4)} son={cikis(b)} x={1010} y={350}>
        <Kart w={390} boy={56} hiza="center">kelime sayısı</Kart>
      </Gir>
      <Gir bas={z(b, 4, 0.35)} son={cikis(b)} x={1540} y={350}>
        <Kart w={240} boy={56} hiza="center" renk={KIR}>süre</Kart>
      </Gir>
      <Ok x1={1410} y1={400} x2={1525} y2={400} egri={-0.3} bas={z(b, 4, 0.2)} />
      <Duzeltildi b={b} bas={z(b, 4, 0.6)} x={1080} y={520} />
      <Gir bas={c(b, 5)} x={1180} y={650} aci={-2}>
        <BuyukBilet olcek={1.8} w={320} ust="KENDİ SESİMDE" deger="≈ 0,5 sn" seri="No. 62" degerBoy={70} degerRenk={KIR}>
          <div style={{ fontFamily: MONO, fontSize: 20, color: M }}>bir kelime</div>
        </BuyukBilet>
      </Gir>
    </>
  );
};

// ================================================================ 63 — 3. hata: kredi
const KrediCubugu: React.FC<{ doluluk: number }> = ({ doluluk }) => (
  <div style={{ width: 760 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <Etiket renk={M}>KREDİ</Etiket>
    </div>
    <div style={{ position: "relative", height: 70, marginTop: 8, border: `5px solid ${M}`, borderRadius: 10, background: RENK.kagitAcik }}>
      <div style={{ position: "absolute", left: 5, top: 5, bottom: 5, width: `calc(${doluluk * 100}% - 10px)`, background: doluluk < 0.25 ? KIR : MAV, borderRadius: 4 }} />
    </div>
  </div>
);
const S63: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  const doluluk = 1 - 0.92 * ara(f, k(z(b, 2, 0.05)), k(z(b, 2, 0.55)), Easing.inOut(Easing.quad));
  return (
    <>
      <Duzeltme no={3} baslik="Kontrolsüz kredi harcamak" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Bir fragman için binlerce kredi." },
          { t: z(b, 2, 0.6), metin: "Sonuç: beğenmedim. Can yakıyor." },
          { t: c(b, 3), metin: "Kural: her adımdan önce toplam maliyet yazılır." },
          { t: z(b, 3, 0.55), metin: "Onay yoksa hiçbir şey başlamaz." },
          { t: c(b, 4), metin: "Ucuz modelle başla; beğenirsen pahalıya geç." },
        ]}
      />
      <Gir bas={g + 0.3} son={cs(b, 2)} x={1020} y={350}>
        <KrediCubugu doluluk={doluluk} />
      </Gir>
      <Gir bas={c(b, 2)} son={cs(b, 2)} x={1060} y={540} aci={-2}>
        <Pen baslik="fragman" w={520}>
          <svg width={460} height={150}>
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <rect x={i * 116} y={10} width={100} height={130} rx={6} fill={RENK.kagitKoyu} stroke={M} strokeWidth={4} />
                <path d={`M${i * 116 + 38} 52 L${i * 116 + 66} 75 L${i * 116 + 38} 98 Z`} fill={M} />
              </g>
            ))}
          </svg>
        </Pen>
      </Gir>
      <DamgaT id="f63a" metin="BEĞENMEDİM" bas={z(b, 2, 0.62)} son={cs(b, 2)} x={1180} y={800} boy={56} aci={-9} />
      <Gir bas={c(b, 3)} son={cs(b, 3)} x={1040} y={340} w={720}>
        <Kart w={720} pad="18px 30px 24px">
          <Etiket renk={M}>TOPLAM MALİYET</Etiket>
          <div style={{ fontFamily: MONO, fontSize: 40, marginTop: 10 }}>her adım: … kredi</div>
          <div style={{ borderTop: `3px dashed ${M}`, margin: "16px 0" }} />
          <div style={{ fontFamily: SERIF, fontSize: 60 }}>Onay?</div>
          <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
            <Kart w={200} hiza="center" boy={44} renk={MAV}>Evet</Kart>
            <Kart w={200} hiza="center" boy={44}>Hayır</Kart>
          </div>
        </Kart>
      </Gir>
      <DamgaT id="f63b" metin="ONAY BEKLİYOR" bas={z(b, 3, 0.55)} son={cs(b, 3)} x={1100} y={790} boy={52} aci={-6} />
      <Gir bas={c(b, 4)} x={1020} y={380}>
        <Kart w={330} boy={52} hiza="center">ucuz model</Kart>
      </Gir>
      <Gir bas={z(b, 4, 0.5)} x={1450} y={560}>
        <Kart w={330} boy={52} hiza="center" renk={KIR}>pahalı model</Kart>
      </Gir>
      <Ok x1={1200} y1={500} x2={1440} y2={610} egri={0.25} bas={z(b, 4, 0.25)} />
      <Gir bas={z(b, 4, 0.3)} x={1060} y={600} aci={-3}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: KIR }}>beğenirsem</div>
      </Gir>
      <Duzeltildi b={b} bas={z(b, 4, 0.75)} x={1120} y={790} />
    </>
  );
};

// ================================================================ 64 — 4. hata: sesi dinlemeden
const S64: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  return (
    <>
      <Duzeltme no={4} baslik="Sesi dinlemeden yayınlamak" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "“Ses hazır.” Gerçekten hazır değildi." },
          { t: c(b, 3), metin: "Claude sesi kulağıyla dinleyemiyor." },
          { t: c(b, 4), metin: "Yazıya çevirip kontrol ediyor; tonlama, heyecan, boğukluk yazıda görünmüyor." },
          { t: c(b, 5), metin: "Son dinleme her zaman benim." },
        ]}
      />
      <Gir bas={g + 0.3} son={c(b, 3)} x={1040} y={340}>
        <Dalga tur="canli" w={740} h={150} f={f} />
      </Gir>
      <DaktiloT bas={c(b, 2)} son={cs(b, 2)} x={1480} y={640} boy={300} konus={[c(b, 2), z(b, 2, 0.5)]} />
      <Gir bas={c(b, 2) + 0.2} son={cs(b, 2)} x={1340} y={500}>
        <Balon w={360} h={110} kuyrukX={290}>
          <span style={{ fontFamily: MONO, fontSize: 44 }}>ses hazır</span>
        </Balon>
      </Gir>
      <DamgaT id="f64a" metin="HAZIR DEĞİL" bas={z(b, 2, 0.6)} son={cs(b, 2)} x={990} y={790} boy={50} aci={-10} />
      <Gir bas={c(b, 3)} son={cs(b, 3)} x={1180} y={380}>
        <div style={{ position: "relative" }}>
          <Kulak boy={300} />
          <div style={{ position: "absolute", left: 20, top: 60 }}>
            <Carpi bas={z(b, 3, 0.35)} boy={260} />
          </div>
        </div>
      </Gir>
      <Gir bas={c(b, 4)} son={cs(b, 4)} x={1020} y={340}>
        <Dalga tur="canli" w={360} h={120} f={f} />
      </Gir>
      <Ok x1={1400} y1={400} x2={1520} y2={400} egri={-0.25} bas={z(b, 4, 0.15)} renk={M} son={cs(b, 4)} />
      <Gir bas={z(b, 4, 0.2)} son={cs(b, 4)} x={1540} y={340}>
        <Kart w={260} pad="18px 22px">
          <Etiket renk={M}>YAZI</Etiket>
          <Karalama w={200} n={3} tohum="y64" />
        </Kart>
      </Gir>
      {["tonlama", "heyecan", "boğukluk"].map((m, i) => (
        <Gir key={m} bas={z(b, 4, 0.4 + i * 0.15)} son={cs(b, 4)} x={1060 + i * 250} y={600}>
          <Kart w={230} boy={44} hiza="center">
            {m}
            <div style={{ fontFamily: SERIF, fontSize: 70, color: KIR, lineHeight: 1 }}>?</div>
          </Kart>
        </Gir>
      ))}
      <WJT poz="gosteren" bas={c(b, 5)} x={1060} y={480} boy={420} />
      <Gir bas={z(b, 5, 0.2)} x={1360} y={560} aci={-3}>
        <BuyukBilet olcek={1.7} w={250} ust="SON DİNLEME" deger="benim" seri="No. 64" degerBoy={64} degerRenk={KIR} />
      </Gir>
      <Duzeltildi b={b} bas={z(b, 5, 0.6)} x={1330} y={340} />
    </>
  );
};

// ================================================================ 65 — 5. hata: önceki ayarlar
const VideoKart: React.FC<{ n: number; nota?: boolean; renk?: string }> = ({ n, nota = true, renk = M }) => (
  <div style={{ width: 170, boxSizing: "border-box", border: `4px solid ${renk}`, borderRadius: 8, background: RENK.kagitAcik, boxShadow: "5px 6px 0 rgba(27,26,23,0.12)" }}>
    <div style={{ height: 110, background: RENK.kagitKoyu, borderBottom: `3px solid ${renk}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{nota && <Nota boy={78} />}</div>
    <div style={{ fontFamily: SERIF, fontSize: 40, textAlign: "center", padding: "4px 0" }}>Video {n}</div>
  </div>
);
const S65: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  return (
    <>
      <Duzeltme no={5} baslik="Önceki videonun ayarlarıyla başlamak" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Bir müziği beğendim, her videoya aynısını koydum." },
          { t: c(b, 3), metin: "Bir süre sonra bütün videolar aynı hissettirdi." },
          { t: c(b, 4), metin: "Şimdi her video sıfırdan başlıyor." },
          { t: c(b, 5), metin: "Kimlik sabit; müzik, ritim, renk vurgusu her seferinde yeniden seçiliyor." },
        ]}
      />
      <Gir bas={g + 0.3} son={c(b, 2)} x={1200} y={400}>
        <VideoKart n={1} />
      </Gir>
      <Gir bas={g + 0.6} son={c(b, 2)} x={1440} y={420} aci={4}>
        <Nota boy={180} renk={KIR} />
      </Gir>
      {[0, 1, 2, 3].map((i) => (
        <Gir key={i} bas={z(b, 2, 0.1 + i * 0.2)} son={cs(b, 3)} x={1010 + i * 200} y={420} aci={(i - 1.5) * 1.5}>
          <VideoKart n={i + 1} />
        </Gir>
      ))}
      <Daire x={1000} y={410} w={800} h={190} bas={c(b, 3)} son={cs(b, 3)} />
      <DamgaT id="f65a" metin="HEPSİ AYNI" bas={z(b, 3, 0.35)} son={cs(b, 3)} x={1150} y={700} boy={62} aci={-8} />
      <Gir bas={c(b, 4)} son={cs(b, 4)} x={1200} y={380}>
        <VideoKart n={5} nota={false} />
      </Gir>
      <DamgaT id="f65b" metin="SIFIRDAN" bas={z(b, 4, 0.4)} son={cs(b, 4)} x={1120} y={660} boy={70} aci={-6} />
      <Gir bas={c(b, 5)} x={1010} y={350} w={800}>
        <Kart w={800} pad="18px 30px 22px">
          <Etiket renk={M}>SABİT</Etiket>
          <div style={{ fontFamily: SERIF, fontSize: 60 }}>kimlik</div>
          <div style={{ borderTop: `3px solid ${M}`, margin: "14px 0" }} />
          <Etiket>HER VİDEODA YENİDEN</Etiket>
          {["müzik", "ritim", "renk vurgusu"].map((m, i) => (
            <div key={m} style={{ fontFamily: SERIF, fontSize: 56, opacity: ara(f, k(z(b, 5, 0.35 + i * 0.15)), k(z(b, 5, 0.35 + i * 0.15)) + 8) }}>
              {m}
            </div>
          ))}
        </Kart>
      </Gir>
      <Duzeltildi b={b} bas={z(b, 5, 0.85)} x={1300} y={820} />
    </>
  );
};

// ================================================================ 66 — 6. hata: bilgisayar
const IS_66 = ["ses üretimi", "video render", "konuşma tanıma"];
const S66: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  const yuk = [0, 1, 2].filter((i) => f >= k(z(b, 2, 0.12 + i * 0.28))).length;
  const doluluk = Math.min(1, ara(f, k(z(b, 2, 0.1)), k(cs(b, 2))) * 1.0);
  const tasti = f >= k(c(b, 3)) && f < k(c(b, 4));
  return (
    <>
      <Duzeltme no={6} baslik="Bilgisayarı unutmak" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Aynı gece: ses, render, konuşma tanıma." },
          { t: c(b, 3), metin: "Ekran kartı taştı, işler yarıda kaldı." },
          { t: c(b, 4), metin: "Şimdi ağır işler sıraya giriyor." },
          { t: c(b, 5), metin: "Biri bitmeden diğeri başlamıyor." },
        ]}
      />
      {/* ekran kartı + bellek */}
      <Gir bas={g + 0.3} son={cs(b, 3)} x={1040} y={560}>
        <div style={{ width: 720, height: 230, boxSizing: "border-box", border: `5px solid ${tasti ? KIR : M}`, borderRadius: 14, background: RENK.kagitKoyu, display: "flex", alignItems: "center", gap: 30, padding: "0 30px" }}>
          <Fan boy={170} hiz={tasti ? 2 : 6 + yuk * 6} />
          <Fan boy={170} hiz={tasti ? 2 : 6 + yuk * 6} />
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 3, lineHeight: 1.2 }}>
            EKRAN
            <br />
            KARTI
          </div>
        </div>
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 18 }}>
          <Etiket renk={M}>BELLEK</Etiket>
          <div style={{ position: "relative", width: 520, height: 46, border: `4px solid ${M}`, borderRadius: 8, background: RENK.kagitAcik }}>
            <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: `calc(${doluluk * 100}% - 8px)`, background: doluluk > 0.85 ? KIR : MAV, borderRadius: 3 }} />
            {tasti && (
              <svg width={120} height={120} style={{ position: "absolute", left: 500, top: -6, overflow: "visible" }}>
                <path d={`M0 6 H${40 + 40 * ara(f, k(c(b, 3)), k(c(b, 3)) + 20)} Q${92} 30 ${40} 50 H0 Z`} fill={KIR} />
                {[14, 40, 62].map((x, i) => {
                  const u = ara(f, k(c(b, 3)) + i * 5, k(c(b, 3)) + 30 + i * 5);
                  return <path key={i} d={`M${x - 8} 48 Q${x} ${48 + 70 * u} ${x + 8} 48 Z`} fill={KIR} />;
                })}
              </svg>
            )}
          </div>
        </div>
      </Gir>
      {IS_66.map((m, i) => (
        <Gir key={m} bas={z(b, 2, 0.12 + i * 0.28)} son={cs(b, 3)} x={1040 + i * 250} y={350 + (i % 2) * 40} aci={(i - 1) * 3}>
          <Kart w={230} boy={40} hiza="center" pad="12px 10px">
            {m}
          </Kart>
        </Gir>
      ))}
      <DamgaT id="f66a" metin="YARIDA KALDI" bas={z(b, 3, 0.3)} son={cs(b, 3)} x={1140} y={600} boy={58} aci={-9} />
      {IS_66.map((m, i) => {
        const bas1 = c(b, 5);
        const p = i === 0 ? ara(f, k(z(b, 5, 0.1)), k(cikis(b))) : 0;
        return (
          <Gir key={"s" + m} bas={z(b, 4, 0.1 + i * 0.2)} x={1010} y={350 + i * 170}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ fontFamily: SERIF, fontSize: 80, color: KIR, width: 60 }}>{i + 1}</div>
              <Kart w={420} boy={46} pad="12px 20px">
                {m}
                <div style={{ height: 14, marginTop: 6, border: `3px solid ${M}`, borderRadius: 4, position: "relative", opacity: f >= k(bas1) ? 1 : 0 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p * 100}%`, background: MAV }} />
                </div>
              </Kart>
              <span style={{ fontFamily: MONO, fontSize: 36, color: i === 0 ? MAV : M, opacity: f >= k(bas1) ? 1 : 0 }}>{i === 0 ? "çalışıyor" : "bekliyor"}</span>
            </div>
          </Gir>
        );
      })}
      <Duzeltildi b={b} bas={z(b, 5, 0.5)} x={1240} y={860} />
    </>
  );
};

// ================================================================ 67 — 7. hata: disk
const S67: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  const yigin = Math.floor(ara(f, k(c(b, 2)), k(cs(b, 4))) * 18);
  const temiz = ara(f, k(z(b, 5, 0.3)), k(z(b, 5, 0.9)));
  return (
    <>
      <Duzeltme no={7} baslik="Disk alanı" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Render, arkada dev dosyalar bırakıyor." },
          { t: c(b, 3), metin: "Bir gün baktım: diskte 27 GB yer kalmış." },
          { t: c(b, 4), metin: "70 GB geçici dosya birikmişti." },
          { t: c(b, 5), metin: "Şimdi her iş bitince temizlik yapan küçük bir betik var." },
        ]}
      />
      {/* 1: dolmak üzere olan disk */}
      <Gir bas={g + 0.4} son={c(b, 2) - 0.1} x={1080} y={420}>
        <Kart w={680} pad="18px 28px 24px">
          <Etiket renk={M}>DİSK</Etiket>
          <div style={{ position: "relative", height: 56, marginTop: 12, border: `4px solid ${M}`, borderRadius: 8 }}>
            <div style={{ position: "absolute", left: 3, top: 3, bottom: 3, width: `${(0.3 + 0.62 * ara(f, k(g + 0.5), k(c(b, 2) - 0.3), Easing.out(Easing.cubic))) * 100}%`, background: KIR, borderRadius: 3 }} />
          </div>
        </Kart>
      </Gir>
      {/* dosya yığını */}
      <Gir bas={c(b, 2)} son={cs(b, 4)} x={1020} y={360}>
        <svg width={420} height={600} style={{ overflow: "visible" }}>
          {Array.from({ length: yigin }, (_, i) => {
            const sira = Math.floor(i / 3);
            const x = (i % 3) * 130 + (sira % 2) * 20;
            const y = 540 - sira * 92;
            return (
              <g key={i}>
                <path d={`M${x} ${y} h90 l22 22 v62 h-112 Z`} fill={RENK.kagitAcik} stroke={M} strokeWidth={4} strokeLinejoin="round" />
                <path d={`M${x + 90} ${y} v22 h22`} fill="none" stroke={M} strokeWidth={3} />
              </g>
            );
          })}
        </svg>
      </Gir>
      <Gir bas={c(b, 3)} son={cs(b, 3)} x={1460} y={370}>
        <Kart w={340} pad="16px 24px">
          <Etiket renk={M}>DİSK · BOŞ YER</Etiket>
          <div style={{ fontFamily: SERIF, fontSize: 110, color: KIR, lineHeight: 1 }}>27 GB</div>
        </Kart>
      </Gir>
      <Daire x={1470} y={420} w={320} h={120} bas={z(b, 3, 0.4)} son={cs(b, 3)} />
      <Gir bas={c(b, 4)} son={cs(b, 4)} x={1450} y={560} aci={-3}>
        <Kart w={360} renk={KIR} pad="16px 24px">
          <Etiket>GEÇİCİ DOSYA</Etiket>
          <div style={{ fontFamily: SERIF, fontSize: 120, lineHeight: 1 }}>70 GB</div>
        </Kart>
      </Gir>
      <Gir bas={c(b, 5)} x={1020} y={360} w={780}>
        <Pen baslik="temizlik betiği" w={780}>
          <div style={{ lineHeight: 1.4 }}>
            <DaktiloYazi metin="geçici dosyalar siliniyor…" ilerleme={ara(f, k(z(b, 5, 0.05)), k(z(b, 5, 0.45)))} f={f} boy={38} imlec={false} />
            <br />
            <DaktiloYazi metin="tamam" ilerleme={ara(f, k(z(b, 5, 0.75)), k(z(b, 5, 0.85)))} f={f} boy={38} renk={MAV} />
          </div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16 }}>
            <Etiket renk={M}>DİSK</Etiket>
            <div style={{ position: "relative", flex: 1, height: 40, border: `4px solid ${M}`, borderRadius: 8 }}>
              <div style={{ position: "absolute", left: 3, top: 3, bottom: 3, width: `${(0.96 - 0.6 * temiz) * 100}%`, background: temiz > 0.6 ? MAV : KIR, borderRadius: 3 }} />
            </div>
          </div>
        </Pen>
      </Gir>
      <Duzeltildi b={b} bas={z(b, 5, 0.85)} x={1180} y={760} />
    </>
  );
};

// ================================================================ 68 — 8. hata: gizlilik
const Mock: React.FC<{ bulanik: number }> = ({ bulanik }) => (
  <div style={{ width: 640, height: 420, display: "flex", border: `5px solid ${M}`, borderRadius: 12, background: "#FBF8EF", overflow: "hidden", boxShadow: "8px 10px 0 rgba(27,26,23,0.14)" }}>
    <div style={{ width: 200, borderRight: `4px solid ${M}`, background: RENK.kagitKoyu, padding: "18px 16px", boxSizing: "border-box", filter: `blur(${bulanik * 9}px)` }}>
      <div style={{ width: 120, height: 22, borderRadius: 11, background: M, marginBottom: 26 }} />
      <Karalama w={160} n={8} tohum="m68" ara_={36} kalin={9} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: M }} />
        <div style={{ width: 90, height: 18, borderRadius: 9, background: M }} />
      </div>
    </div>
    <div style={{ flex: 1, padding: 30 }}>
      <Karalama w={360} n={6} tohum="m68b" ara_={40} kalin={7} />
    </div>
  </div>
);
const S68: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  return (
    <>
      <Duzeltme no={8} baslik="Gizliliği düşünmemek" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "İlk kayıtlarda ekranın kenarında adım ve eski sohbetlerim görünüyordu." },
          { t: c(b, 3), metin: "İzleyici fark etmese bile, ben fark ettim." },
          { t: c(b, 4), metin: "Şimdi her kayıt, kişisel bilgileri kesen ve bulanıklaştıran bir süzgeçten geçiyor." },
        ]}
      />
      <Gir bas={g + 0.3} son={z(b, 4, 0.45)} x={1010} y={350}>
        <Mock bulanik={ara(f, k(c(b, 4)), k(z(b, 4, 0.35)))} />
      </Gir>
      <Daire x={1010} y={350} w={210} h={420} bas={z(b, 2, 0.35)} son={cs(b, 3)} />
      <Gir bas={z(b, 2, 0.5)} son={cs(b, 2)} x={1100} y={800} aci={-3}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: KIR }}>adım + eski sohbetler</div>
      </Gir>
      <WJT poz="saskin" bas={c(b, 3)} son={cs(b, 3)} x={1665} y={480} boy={400} />
      <Gir bas={c(b, 4)} son={z(b, 4, 0.45)} x={1100} y={800} aci={-2}>
        <Kart w={420} hiza="center" renk={MAV} boy={48}>süzgeç: kes + bulanıklaştır</Kart>
      </Gir>
      <Ekran klasor={1} kareler={[0, 1, 2]} bas={z(b, 4, 0.45)} son={cikis(b)} x={1030} y={330} w={700} />
      <Ok x1={780} y1={820} x2={1020} y2={880} egri={0.2} bas={z(b, 4, 0.7)} />
      <Gir bas={z(b, 4, 0.7)} x={560} y={760} aci={-3}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: KIR }}>bulanık</div>
      </Gir>
      <Duzeltildi b={b} bas={z(b, 4, 0.8)} x={1340} y={430} />
    </>
  );
};

// ================================================================ 69 — 9. hata: güvenlik doğrulaması
const S69: S = ({ b }) => {
  const f = useCurrentFrame();
  const g = giris(b);
  const kapi = ara(f, k(z(b, 3, 0.4)), k(z(b, 3, 0.6)));
  return (
    <>
      <Duzeltme no={9} baslik="Güvenlik doğrulamasını aşmaya çalışmak" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Aslında yapmadım; ama aklımdan geçti." },
          { t: c(b, 3), metin: "Site seni bot sanıyorsa: kandırma, kendi tarayıcını kullan." },
          { t: c(b, 4), metin: "Daha dürüst. Daha az sorun." },
        ]}
      />
      <Gir bas={g + 0.3} son={cs(b, 3)} x={1180} y={420}>
        <Duvar w={600} h={460} kapi={kapi} />
      </Gir>
      <Gir bas={c(b, 1) + 0.6} son={cs(b, 3)} x={1240} y={340} aci={-2}>
        <Kart w={480} hiza="center" boy={40} renk={KIR}>güvenlik doğrulaması</Kart>
      </Gir>
      <WJT poz="dusunen" bas={c(b, 2)} son={cs(b, 2)} x={1000} y={510} boy={420} fikir={c(b, 2) + 0.4} />
      <Gir bas={z(b, 2, 0.25)} son={cs(b, 2)} x={1260} y={460}>
        <Merdiven h={420} />
      </Gir>
      <UstunuCiz x={1230} y={680} w={200} bas={z(b, 2, 0.6)} son={cs(b, 2)} />
      <Gir bas={z(b, 2, 0.6)} son={cs(b, 2)} x={1440} y={560}>
        <Carpi bas={z(b, 2, 0.6)} boy={150} />
      </Gir>
      <Gir bas={c(b, 3)} son={cs(b, 3)} x={1000} y={560}>
        <Kart w={260} boy={40} hiza="center">
          <span style={{ position: "relative" }}>kandırmak</span>
        </Kart>
      </Gir>
      <UstunuCiz x={1030} y={598} w={200} bas={z(b, 3, 0.2)} son={cs(b, 3)} />
      <Gir bas={z(b, 3, 0.55)} son={cs(b, 3)} x={1360} y={710} aci={-2}>
        <Kart w={260} boy={40} hiza="center" renk={MAV} pad="10px 12px">kendi tarayıcın</Kart>
      </Gir>
      <Ok x1={1140} y1={700} x2={1340} y2={790} egri={0.2} bas={z(b, 3, 0.5)} son={cs(b, 3)} renk={MAV} />
      {["daha dürüst", "daha az sorun"].map((m, i) => (
        <Gir key={m} bas={z(b, 4, 0.05 + i * 0.35)} x={1080 + i * 360} y={460 + i * 30} aci={(i - 0.5) * 4}>
          <Kart w={330} boy={52} hiza="center">
            {m} <Tik bas={z(b, 4, 0.2 + i * 0.35)} />
          </Kart>
        </Gir>
      ))}
      <Duzeltildi b={b} bas={z(b, 4, 0.75)} x={1200} y={700} />
    </>
  );
};

// ================================================================ 70 — 10. hata: her şeye kendim karar
const S70: S = ({ b }) => {
  const g = giris(b);
  return (
    <>
      <Duzeltme no={10} baslik="Her şeye kendim karar vermek" bas={g} />
      <Satirlar
        satirlar={[
          { t: c(b, 2), metin: "Teknik kararları yapay zekâya bıraktım." },
          { t: c(b, 3), metin: "Hangi kütüphane, hangi ayar, hangi dosya biçimi: o seçiyor." },
          { t: c(b, 4), metin: "Ben iki şeye karar veriyorum." },
          { t: c(b, 5), metin: "Gerisi fabrikanın işi." },
        ]}
      />
      <WJT poz="dusunen" bas={g + 0.3} son={c(b, 2)} x={1350} y={430} boy={480} />
      <DaktiloT bas={c(b, 2)} x={1010} y={330} boy={260} konus={[c(b, 3), cs(b, 3)]} />
      <WJT poz="gosteren" bas={c(b, 2)} x={1600} y={300} boy={290} />
      <Ok x1={1580} y1={420} x2={1300} y2={420} egri={-0.25} bas={z(b, 2, 0.3)} son={cs(b, 2)} />
      <Gir bas={z(b, 2, 0.4)} son={cs(b, 2)} x={1180} y={600}>
        <Kart w={460} boy={46} hiza="center">teknik kararlar</Kart>
      </Gir>
      {["hangi kütüphane", "hangi ayar", "hangi dosya biçimi"].map((m, i) => (
        <Gir key={m} bas={z(b, 3, 0.1 + i * 0.27)} x={990} y={600 + i * 100}>
          <Kart w={430} boy={42} pad="10px 20px">{m}</Kart>
        </Gir>
      ))}
      {["ne anlatacağım", "nasıl hissettirecek"].map((m, i) => (
        <Gir key={m} bas={z(b, 4, 0.25 + i * 0.3)} x={1460} y={680 + i * 110}>
          <Kart w={360} boy={44} pad="10px 20px" renk={KIR}>{m}</Kart>
        </Gir>
      ))}
      <Gir bas={c(b, 4)} x={1460} y={618}>
        <Etiket>BENİM KARARIM</Etiket>
      </Gir>
      <DamgaT id="f70a" metin="FABRİKANIN İŞİ" bas={z(b, 5, 0.15)} x={1180} y={935} boy={44} aci={-5} />
    </>
  );
};

// ================================================================ 71 — Sidis'e dönüş
/** cümleye kilitli üst başlık: her cümlede değişir */
const Basliklar: React.FC<{ b: number; satir: { n: number; metin: string; t?: number }[]; boy?: number; y?: number }> = ({ b, satir, boy = 70, y = 128 }) => (
  <>
    {satir.map((s, i) => {
      const bas = s.t ?? c(b, s.n);
      const son = i + 1 < satir.length ? (satir[i + 1].t ?? c(b, satir[i + 1].n)) - 0.25 : undefined;
      return (
        <Gir key={i} bas={bas} son={son} x={120} y={y} w={1680}>
          <Manset metin={s.metin} bas={bas} boy={boy} />
        </Gir>
      );
    })}
  </>
);
const Kupur: React.FC<{ w: number; tohum: string }> = ({ w, tohum }) => (
  <div style={{ width: w, boxSizing: "border-box", background: "#E4DCC6", border: `3px solid ${M}`, padding: "14px 20px 18px", boxShadow: "6px 7px 0 rgba(27,26,23,0.14)", clipPath: "polygon(0 2%, 8% 0, 22% 3%, 40% 0, 63% 2%, 80% 0, 100% 3%, 98% 50%, 100% 97%, 75% 100%, 50% 98%, 22% 100%, 0 98%, 2% 50%)" }}>
    <div style={{ fontFamily: SERIF, fontSize: 54, lineHeight: 1, borderBottom: `3px solid ${M}`, paddingBottom: 8, marginBottom: 12 }}>HARİKA ÇOCUK…</div>
    <div style={{ display: "flex", gap: 16 }}>
      <Karalama w={(w - 60) / 2} n={5} tohum={tohum} ara_={24} kalin={5} />
      <Karalama w={(w - 60) / 2} n={5} tohum={tohum + "x"} ara_={24} kalin={5} />
    </div>
  </div>
);
const S71: S = ({ b }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Basliklar
        b={b}
        satir={[
          { n: 1, metin: "Sidis'e dönelim." },
          { n: 2, metin: "Harika çocuk büyüdü." },
          { n: 3, metin: "Gazeteler yıllarca alay etti." },
          { n: 4, metin: "O, küçük şeyleri biriktirmeye devam etti." },
          { n: 5, metin: "Tramvay biletleri, notlar, diller, fikirler." },
          { n: 6, metin: "Bence bu kanalın da hikâyesi bu." },
          { n: 7, metin: "Büyük bir hamle değil, küçük parçalar." },
          { n: 8, metin: "Her video bir bilet." },
        ]}
      />
      {/* 1: büyük manşet kartı */}
      <Gir bas={c(b, 1) + 0.2} son={cs(b, 2)} x={160} y={340} aci={-1.5}>
        <Kupur w={760} tohum="k71a" />
      </Gir>
      <UstunuCiz x={190} y={392} w={400} bas={z(b, 2, 0.6)} son={cs(b, 2)} />
      {/* 2: küçük W.J. → büyük W.J. */}
      <WJT poz="normal" bas={c(b, 1) + 0.3} son={z(b, 2, 0.4)} x={1300} y={640} boy={300} />
      <WJT poz="normal" bas={z(b, 2, 0.45)} son={cs(b, 3)} x={1380} y={290} boy={680} />
      <Gir bas={z(b, 2, 0.5)} son={cs(b, 2)} x={300} y={700} aci={-4}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 80, color: KIR }}>büyüdü.</div>
      </Gir>
      {/* 3: alay eden gazeteler */}
      {[0, 1, 2].map((i) => (
        <Gir key={i} bas={z(b, 3, i * 0.2)} son={cs(b, 3)} x={140 + i * 360} y={330 + (i % 2) * 230} aci={(i - 1) * 5}>
          <Kupur w={520} tohum={"k71" + i} />
        </Gir>
      ))}
      {/* 4: kutuya biriken küçük şeyler */}
      <WJT poz="dusunen" bas={c(b, 4)} son={cs(b, 4)} x={1400} y={420} boy={500} />
      <Gir bas={c(b, 4)} son={cs(b, 4)} x={420} y={560}>
        <svg width={620} height={420} style={{ overflow: "visible" }}>
          {Array.from({ length: 9 }, (_, i) => {
            const p = ara(f, k(z(b, 4, 0.1 + i * 0.08)), k(z(b, 4, 0.1 + i * 0.08)) + 12, Easing.in(Easing.quad));
            const x = 120 + (i % 3) * 130 + random("x" + i) * 40;
            const y = -200 + p * (380 - Math.floor(i / 3) * 30);
            return p > 0 ? <rect key={i} x={x} y={y} width={90} height={56} rx={6} fill={RENK.bilet} stroke={M} strokeWidth={4} transform={`rotate(${(random("r" + i) - 0.5) * 40} ${x + 45} ${y + 28})`} /> : null;
          })}
          <path d="M60 220 L560 220 L520 410 L100 410 Z" fill={RENK.kagitKoyu} stroke={M} strokeWidth={6} strokeLinejoin="round" />
          <path d="M60 220 L20 150 L520 150 L560 220" fill="none" stroke={M} strokeWidth={5} strokeLinejoin="round" />
        </svg>
      </Gir>
      {/* 5: dört bilet */}
      {[
        ["TRAMVAY", "biletler"],
        ["DEFTER", "notlar"],
        ["SÖZLÜK", "diller"],
        ["KAFA", "fikirler"],
      ].map(([u, d], i) => (
        <Gir key={d} bas={z(b, 5, i * 0.2)} son={cs(b, 6)} x={140 + i * 430} y={420 + (i % 2) * 60} aci={(i - 1.5) * 3}>
          <BuyukBilet olcek={1.6} w={240} ust={u} deger={d} seri={`No. ${i + 1}`} degerBoy={50} />
        </Gir>
      ))}
      <AltCizgi x={180} y={780} w={1560} bas={c(b, 6)} son={cs(b, 6)} cift />
      <Gir bas={z(b, 6, 0.3)} son={cs(b, 6)} x={700} y={820}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 72, color: KIR }}>= bu kanal</div>
      </Gir>
      {/* 7: büyük hamle değil, küçük parçalar */}
      <Gir bas={c(b, 7)} son={cs(b, 7)} x={160} y={360}>
        <Kart w={620} boy={80} hiza="center" pad="40px 20px">büyük hamle</Kart>
      </Gir>
      <UstunuCiz x={180} y={455} w={580} bas={z(b, 7, 0.3)} son={cs(b, 7)} />
      {Array.from({ length: 12 }, (_, i) => (
        <Gir key={i} bas={z(b, 7, 0.4 + i * 0.04)} son={cs(b, 7)} x={980 + (i % 4) * 200} y={340 + Math.floor(i / 4) * 150} aci={(random("p" + i) - 0.5) * 16}>
          <div style={{ width: 160, height: 100, background: RENK.bilet, border: `4px solid ${M}`, borderRadius: 8, boxShadow: "4px 5px 0 rgba(27,26,23,0.12)", fontFamily: MONO, fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center", color: KIR }}>
            {String(i + 1).padStart(2, "0")}
          </div>
        </Gir>
      ))}
      {/* 8: her video bir bilet */}
      <Gir bas={c(b, 8)} x={560} y={380} aci={-2}>
        <BuyukBilet olcek={2.6} w={300} ust="HER VİDEO" deger="bir bilet" seri="No. 71" degerBoy={74} degerRenk={KIR} />
      </Gir>
    </>
  );
};

// ================================================================ 72 — hediye: Otopilot
const MODULLER = ["senaryo", "ses motorları", "telaffuz paketi", "altyazı", "video birleştirme"];
const S72: S = ({ b }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Gir bas={giris(b)} x={120} y={116} w={1680}>
        <Etiket>VI · HEDİYE — No. {b}</Etiket>
        <div style={{ borderTop: `3px solid ${M}`, borderBottom: `1px solid ${M}`, height: 5, marginTop: 8 }} />
      </Gir>
      {/* 1: söz verdiğim gibi */}
      <Gir bas={c(b, 1)} son={cs(b, 1)} x={140} y={240} w={1100}>
        <Manset metin="Söz verdiğim gibi: bu sistemin kodu ücretsiz." bas={c(b, 1)} boy={86} />
      </Gir>
      <WJT poz="gosteren" bas={c(b, 1) + 0.3} son={cs(b, 1)} x={1400} y={360} boy={560} gulumse />
      <DamgaT id="f72a" metin="ÜCRETSİZ" bas={z(b, 1, 0.55)} son={cs(b, 1)} x={300} y={640} boy={96} aci={-8} />
      {/* 2-3: depo kartı */}
      <Gir bas={c(b, 2)} x={120} y={230} w={1140}>
        <Pen baslik="" w={1140}>
          <div style={{ fontFamily: SERIF, fontSize: 170, lineHeight: 1, color: M }}>Otopilot</div>
          <div style={{ height: 50, marginTop: 10 }}>
            <DaktiloYazi metin="github.com/wj-sidiss/otopilot" ilerleme={ara(f, k(c(b, 3)), k(z(b, 3, 0.5)))} f={f} boy={44} renk={MAV} imlec={f >= k(c(b, 3)) && f < k(cs(b, 3))} />
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 24, alignItems: "center", opacity: ara(f, k(z(b, 3, 0.4)), k(z(b, 3, 0.4)) + 8) }}>
            <div style={{ border: `4px solid ${MAV}`, borderRadius: 30, padding: "4px 24px 8px", fontFamily: SANS, fontWeight: 600, fontSize: 36, color: MAV }}>açık kaynak</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: KIR, opacity: ara(f, k(z(b, 3, 0.65)), k(z(b, 3, 0.65)) + 8) }}>bağlantı açıklamada</div>
          </div>
          <div style={{ display: "flex", gap: 30, marginTop: 28, alignItems: "flex-start", opacity: ara(f, k(c(b, 5)), k(c(b, 5)) + 8) }}>
            <div style={{ flex: "0 0 auto" }}>
              <Etiket renk={M}>KURULUM ADIMLARI</Etiket>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 36, color: KIR }}>{n}.</span>
                  <Karalama w={300} n={1} tohum={"ku" + n} />
                </div>
              ))}
            </div>
          </div>
        </Pen>
      </Gir>
      <Ok x1={980} y1={600} x2={1000} y2={1000} egri={-0.2} bas={z(b, 3, 0.7)} son={cs(b, 4)} />
      {/* 4: içindekiler */}
      <Gir bas={c(b, 4)} x={1330} y={230} w={470}>
        <Etiket>İÇİNDE</Etiket>
        <div style={{ borderTop: `3px solid ${M}`, margin: "8px 0 6px" }} />
        {MODULLER.map((m, i) => (
          <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: SERIF, fontSize: 52, lineHeight: 1.3, opacity: ara(f, k(z(b, 4, 0.08 + i * 0.17)), k(z(b, 4, 0.08 + i * 0.17)) + 8) }}>
            {m}
            <Tik bas={z(b, 4, 0.12 + i * 0.17)} boy={40} />
          </div>
        ))}
      </Gir>
      {/* 6: kendi bilgisayarında */}
      <Gir bas={c(b, 6)} x={1420} y={710}>
        <Bilgisayar w={360}>
          <span style={{ fontFamily: SERIF, fontSize: 58 }}>Otopilot</span>
        </Bilgisayar>
      </Gir>
      <Gir bas={z(b, 6, 0.3)} x={1050} y={920} aci={-2}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 50, color: KIR }}>kendi bilgisayarında</div>
      </Gir>
    </>
  );
};

// ================================================================ 73 — kendi zevkini kat
const S73: S = ({ b }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Basliklar
        b={b}
        satir={[
          { n: 1, metin: "Ama bir şey söyleyeyim." },
          { n: 2, metin: "Bu sistem benim zevkime göre kuruldu." },
          { n: 3, metin: "Kurduktan sonra kendi denemelerini yap." },
          { n: 4, metin: "Beğendiklerini kurala yaz." },
          { n: 5, metin: "Benim damgam ile seninki aynı olmak zorunda değil." },
          { n: 6, metin: "Çıkanı paylaşmak yerine, üstüne kendi zevkini kat." },
        ]}
      />
      <WJT poz="normal" bas={c(b, 1)} son={cs(b, 2)} x={1460} y={380} boy={560} />
      <Gir bas={c(b, 1) + 0.4} son={cs(b, 1)} x={200} y={420}>
        <Balon w={760} h={170} kuyrukX={640}>
          <span style={{ fontFamily: SERIF, fontSize: 64 }}>Bir şey söyleyeyim.</span>
        </Balon>
      </Gir>
      <Gir bas={c(b, 2)} son={cs(b, 2)} x={200} y={330} w={900}>
        <Pen baslik="kurallar" w={900}>
          {["benim zevkim", "benim kararlarım"].map((m, i) => (
            <div key={m} style={{ fontFamily: SERIF, fontSize: 64, opacity: ara(f, k(z(b, 2, 0.1 + i * 0.35)), k(z(b, 2, 0.1 + i * 0.35)) + 8) }}>
              — {m}
            </div>
          ))}
          <Karalama w={700} n={3} tohum="z73" />
        </Pen>
      </Gir>
      {[0, 1, 2].map((i) => (
        <Gir key={i} bas={z(b, 3, 0.05 + i * 0.25)} son={cs(b, 3)} x={180 + i * 560} y={380 + (i % 2) * 50} aci={(i - 1) * 3}>
          <Kart w={480} boy={60} pad="20px 28px">
            Deneme {i + 1}
            <Karalama w={400} n={3} tohum={"d73" + i} />
            <div style={{ marginTop: 8 }}>{i === 1 ? <Carpi bas={z(b, 3, 0.2 + i * 0.25)} boy={60} /> : <Tik bas={z(b, 3, 0.2 + i * 0.25)} boy={60} />}</div>
          </Kart>
        </Gir>
      ))}
      <Gir bas={c(b, 4)} son={cs(b, 4) + 0.2} x={360} y={380} w={1200}>
        <Pen baslik="kurallar" w={1200}>
          <DaktiloYazi metin="+ beğendiğim → yeni kural" ilerleme={ara(f, k(c(b, 4)), k(cs(b, 4)))} f={f} boy={56} renk={MAV} />
        </Pen>
      </Gir>
      <Gir bas={c(b, 5)} son={cs(b, 5)} x={200} y={380}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, letterSpacing: 3, marginBottom: 30 }}>BENİM DAMGAM</div>
      </Gir>
      <DamgaT id="f73a" metin="BENİM" bas={z(b, 5, 0.1)} son={cs(b, 5)} x={220} y={470} boy={110} aci={-8} />
      <Gir bas={z(b, 5, 0.35)} son={cs(b, 5)} x={1100} y={380}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, letterSpacing: 3, color: MAV }}>SENİN DAMGAN</div>
      </Gir>
      <DamgaT id="f73b" metin="SENİN" bas={z(b, 5, 0.45)} son={cs(b, 5)} x={1100} y={470} boy={110} aci={5} renk={MAV} />
      <Gir bas={z(b, 5, 0.6)} son={cs(b, 5)} x={860} y={480}>
        <svg width={160} height={160} style={{ overflow: "visible" }}>
          <line x1={20} y1={60} x2={140} y2={60} stroke={M} strokeWidth={10} strokeLinecap="round" />
          <line x1={20} y1={100} x2={140} y2={100} stroke={M} strokeWidth={10} strokeLinecap="round" />
          <line x1={110} y1={20} x2={50} y2={140} stroke={KIR} strokeWidth={10} strokeLinecap="round" />
        </svg>
      </Gir>
      {/* 6: düğme → çıkan; üstüne zevk */}
      <Gir bas={c(b, 6)} son={cikis(b)} x={220} y={400}>
        <div style={{ width: 240, height: 240, borderRadius: 120, border: `8px solid ${M}`, background: KIR, boxShadow: "0 14px 0 #7a1c19", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 56, color: RENK.kagitAcik, transform: `translateY(${f >= k(z(b, 6, 0.1)) && f < k(z(b, 6, 0.1)) + 5 ? 10 : 0}px)` }}>BAS</div>
      </Gir>
      <Ok x1={520} y1={520} x2={760} y2={520} egri={-0.2} bas={z(b, 6, 0.12)} renk={M} />
      <Gir bas={z(b, 6, 0.18)} son={cikis(b)} x={790} y={420}>
        <Kart w={420} boy={56} hiza="center" pad="40px 20px">paylaş</Kart>
      </Gir>
      <UstunuCiz x={820} y={510} w={360} bas={z(b, 6, 0.35)} />
      <Gir bas={z(b, 6, 0.5)} x={1240} y={360} w={600} aci={-3}>
        <Manset metin="+ kendi zevkin" bas={z(b, 6, 0.5)} boy={110} renk={KIR} imlec={false} />
      </Gir>
      <AltCizgi x={1260} y={500} w={540} bas={z(b, 6, 0.8)} cift />
    </>
  );
};

// ================================================================ 74 — sonraki video + yorum + kapanış
const S74: S = ({ b }) => {
  const f = useCurrentFrame();
  const kapanis = c(b, 3);
  const delik = f - k(c(b, 4));
  const delikSp = delik < 0 ? 0 : Math.min(1, delik / 5);
  return (
    <>
      {/* 1: gelecek sayı */}
      <Gir bas={giris(b)} son={cs(b, 1)} x={120} y={116} w={1680}>
        <Etiket>GELECEK SAYI</Etiket>
        <div style={{ borderTop: `3px solid ${M}`, borderBottom: `1px solid ${M}`, height: 5, marginTop: 8 }} />
      </Gir>
      <Gir bas={c(b, 1)} son={cs(b, 1)} x={120} y={200} w={860}>
        <Manset metin="Fabrikanın en zor istasyonu:" bas={c(b, 1)} boy={72} />
        <div style={{ marginTop: 20 }}>
          <Manset metin="gerçek ekran kaydı" bas={z(b, 1, 0.3)} boy={110} renk={KIR} imlec={false} />
        </div>
      </Gir>
      {["adım adım", "sıfırdan kurmak"].map((m, i) => (
        <Gir key={m} bas={z(b, 1, 0.55 + i * 0.15)} son={cs(b, 1)} x={140 + i * 360} y={600}>
          <Kart w={330} boy={50} hiza="center">{m}</Kart>
        </Gir>
      ))}
      <Ekran klasor={9} bas={z(b, 1, 0.15)} son={cs(b, 1)} x={1050} y={250} w={760} hiz={6} />
      {/* 2: yorum */}
      <Gir bas={c(b, 2)} son={cs(b, 2)} x={120} y={150} w={1680}>
        <Manset metin="Hangi istasyonu daha detaylı görmek istersin?" bas={c(b, 2)} boy={72} />
      </Gir>
      <Gir bas={z(b, 2, 0.15)} son={cs(b, 2)} x={140} y={440} w={1100}>
        <Pen baslik="yorumlar" w={1100}>
          <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
            <div style={{ width: 70, height: 70, borderRadius: 35, background: RENK.kagitKoyu, border: `4px solid ${M}`, flex: "0 0 auto" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: M, opacity: 0.6 }}>Yorum ekle…</div>
              <div style={{ marginTop: 10, borderBottom: `3px solid ${M}`, paddingBottom: 10, minHeight: 56 }}>
                <DaktiloYazi metin="Şu istasyonu detaylı görmek istiyorum: …" ilerleme={ara(f, k(z(b, 2, 0.3)), k(z(b, 2, 0.9)))} f={f} boy={36} />
              </div>
            </div>
          </div>
        </Pen>
      </Gir>
      <WJT poz="gosteren" bas={z(b, 2, 0.1)} son={cs(b, 2)} x={1400} y={380} boy={560} gulumse />
      {/* 3-4: kapanış kartı */}
      <Gir bas={kapanis} x={0} y={170} w={1920}>
        <div style={{ textAlign: "center", fontFamily: SERIF, fontSize: 190, lineHeight: 1, color: M }}>W.J. Sidis</div>
        <div style={{ margin: "18px auto 0", width: 900, borderTop: `3px solid ${M}`, borderBottom: `1px solid ${M}`, height: 5 }} />
        <div style={{ textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: M, marginTop: 20 }}>Ben de oradan devam edeyim.</div>
      </Gir>
      <Gir bas={kapanis + 0.4} x={599} y={560} aci={-2}>
        <div style={{ position: "relative" }}>
          <BuyukBilet olcek={1.9} w={380} ust="SON AKTARMA" deger="Görüşmek üzere" seri="No. 74" degerBoy={44} degerRenk={KIR} />
          {delik >= 0 && (
            <>
              <div style={{ position: "absolute", left: 640, top: 70, width: 56, height: 56, borderRadius: 28, background: RENK.kagit, border: `5px solid ${M}`, transform: `scale(${0.4 + 0.6 * delikSp})`, boxShadow: "inset 2px 3px 0 rgba(27,26,23,0.25)" }} />
              <div style={{ position: "absolute", left: 650, top: 110 + Math.min(delik, 40) * 7, width: 36, height: 36, borderRadius: 18, background: RENK.bilet, border: `3px solid ${M}`, opacity: 1 - ara(delik, 20, 40) }} />
            </>
          )}
        </div>
      </Gir>
    </>
  );
};

export const SAHNELER_F: Record<number, React.FC<{ b: number }>> = {
  ...yerTutucular(61, 74),
  61: S61, 62: S62, 63: S63, 64: S64, 65: S65, 66: S66, 67: S67, 68: S68, 69: S69, 70: S70, 71: S71, 72: S72, 73: S73, 74: S74,
};

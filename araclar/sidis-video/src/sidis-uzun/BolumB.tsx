// Kısım B — "II · Senaryo ve ses" (bölüm 8–17).
// Her ipucu zaman.json'dan (bölüm, cümle) ile okunur: c(b,n) cümle başı, m(b,n,t) cümlenin t oranındaki an.
// Sabit saniye yok; ses yeniden üretilince her şey kendiliğinden kayar.
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  Balon, Bilet, Daktilo, Dalga, DalgaTuru, DaktiloYazi, Damga, Ekran, EkranKarti, GercekRozet, Gir, Goz, Kaydirici, MONO, Manset, Ok, Poz, RENK, SANS, SERIF, WJ,
  ara, c, cikis, cs, cumleSayisi, giris, k, yerTutucular,
} from "./Ortak";

type FC = React.FC<{ b: number }>;

// ---------------------------------------------------------------- zaman yardımcıları (hepsi zaman.json'dan)
/** n. cümlenin t (0..1) oranındaki saniye */
const m = (b: number, n: number, t: number) => c(b, n) + (cs(b, n) - c(b, n)) * t;
/** n. cümleye ait öğenin kalkacağı an: sonraki cümlenin başından hemen önce (son cümlede undefined = sayfa katlanana kadar) */
const bit = (b: number, n: number) => (n >= cumleSayisi(b) ? undefined : c(b, n + 1) - 0.22);
/** f anında saniye cinsinden zaman ≥ s mi */
const gecti = (f: number, s: number) => f >= k(s);

// ---------------------------------------------------------------- küçük parçalar (yalnız bu kısımda)
/** sayfanın üst-sol başlık etiketi */
const Kicker: React.FC<{ b: number; metin: string }> = ({ b, metin }) => (
  <Gir bas={giris(b) + 0.1} x={140} y={112}>
    <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.kirmizi, letterSpacing: 3, whiteSpace: "nowrap" }}>
      II · {metin} — No. {b}
    </div>
  </Gir>
);

/** okunur boyda bilet (orijinal Bilet 18px üst yazılı; 1.9 ölçekle ≥34px olur) */
const BiletB: React.FC<{ ust: string; deger: string; seri: string; w?: number; degerBoy?: number; degerRenk?: string; olcek?: number }> = ({ ust, deger, seri, w = 280, degerBoy = 72, degerRenk, olcek = 1.9 }) => (
  <div style={{ transform: `scale(${olcek})`, transformOrigin: "0 0", width: w }}>
    <Bilet ust={ust} deger={deger} seri={seri} w={w} degerBoy={degerBoy} degerRenk={degerRenk} />
  </div>
);

/** absolute konumlu damga; bas'ta "güm" diye iner */
const DamgaAt: React.FC<{ id: string; metin: string; bas: number; son?: number; x: number; y: number; boy?: number; aci?: number; renk?: string }> = ({ id, metin, bas, son, x, y, boy = 80, aci = -8, renk }) => {
  const f = useCurrentFrame();
  if (f < k(bas)) return null;
  const op = son === undefined ? 1 : 1 - ara(f, k(son), k(son) + 7);
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: op }}>
      <Damga id={id} metin={metin} yas={f - k(bas)} boy={boy} aci={aci} renk={renk} />
    </div>
  );
};

/** W.J., pozları zaman çizelgesine bağlı */
const WJAt: React.FC<{ pozlar: [number, Poz][]; bas: number; son?: number; x: number; y: number; boy: number; ayna?: boolean; gulumse?: boolean; fikir?: number }> = ({ pozlar, bas, son, x, y, boy, ayna, gulumse, fikir }) => {
  const f = useCurrentFrame();
  let p = pozlar[0];
  for (const q of pozlar) if (gecti(f, q[0])) p = q;
  return (
    <Gir bas={bas} son={son} x={x} y={y}>
      <div style={{ transform: ayna ? "scaleX(-1)" : undefined }}>
        <WJ poz={p[1]} yas={Math.max(0, f - k(p[0]))} f={f} boy={boy} gulumse={gulumse} fikir={fikir === undefined ? -1 : f - k(fikir)} />
      </div>
    </Gir>
  );
};

/** Daktilo (yapay zekâ): konuşma aralığı ve göz durumu zamana bağlı */
const DaktiloAt: React.FC<{ bas: number; son?: number; x: number; y: number; boy: number; konus?: [number, number][]; gozler?: [number, Goz][] }> = ({ bas, son, x, y, boy, konus = [], gozler = [] }) => {
  const f = useCurrentFrame();
  const konusuyor = konus.some(([a, z]) => f >= k(a) && f <= k(z));
  let g: Goz = "acik";
  for (const q of gozler) if (gecti(f, q[0])) g = q[1];
  return (
    <Gir bas={bas} son={son} x={x} y={y}>
      <Daktilo f={f} boy={boy} konusuyor={konusuyor} goz={g} />
    </Gir>
  );
};

/** kâğıt kart */
const Kart: React.FC<{ w: number; h?: number; pad?: string; kesik?: boolean; renk?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ w, h, pad = "24px 30px", kesik, renk, children, style }) => (
  <div style={{ width: w, height: h, boxSizing: "border-box", padding: pad, background: kesik ? "transparent" : RENK.kagitAcik, border: `4px ${kesik ? "dashed" : "solid"} ${renk ?? RENK.murekkep}`, borderRadius: 12, boxShadow: kesik ? undefined : "6px 7px 0 rgba(27,26,23,0.12)", position: "relative", ...style }}>
    {children}
  </div>
);

/** pencere (Pencere'nin büyük başlıklı hali: başlık ≥34px) */
const PencereB: React.FC<{ baslik: string; w: number; children: React.ReactNode }> = ({ baslik, w, children }) => (
  <div style={{ width: w, background: "#FBF8EF", border: `5px solid ${RENK.murekkep}`, borderRadius: 14, boxShadow: "8px 10px 0 rgba(27,26,23,0.14)", overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `4px solid ${RENK.murekkep}`, background: RENK.kagitKoyu }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 18, height: 18, borderRadius: 9, border: `3.5px solid ${RENK.murekkep}` }} />
      ))}
      <span style={{ fontFamily: MONO, fontSize: 36, color: RENK.murekkep, marginLeft: 14 }}>{baslik}</span>
    </div>
    <div style={{ padding: "24px 30px 28px" }}>{children}</div>
  </div>
);

const yazi = (boy: number, renk: string = RENK.murekkep, font: "serif" | "mono" | "sans" = "serif"): React.CSSProperties => ({
  fontFamily: font === "serif" ? SERIF : font === "mono" ? MONO : SANS,
  fontSize: boy,
  lineHeight: 1.1,
  color: renk,
  fontWeight: font === "sans" ? 600 : 400,
});

/** satır içi üstünü çizme (kırmızı mürekkep, soldan sağa) */
const Cizik: React.FC<{ bas: number; sure?: number; renk?: string; children: React.ReactNode }> = ({ bas, sure = 0.3, renk = RENK.kirmizi, children }) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad));
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      {p > 0 && <span style={{ position: "absolute", left: -8, top: "52%", height: 8, width: `calc((100% + 16px) * ${p})`, background: renk, borderRadius: 4, transform: "rotate(-2.5deg)", transformOrigin: "0 50%" }} />}
    </span>
  );
};

/** satır içi elle çizilmiş daire (konik maskeyle çizilerek gelir) */
const DaireIc: React.FC<{ bas: number; sure?: number; renk?: string; pay?: number; children: React.ReactNode }> = ({ bas, sure = 0.45, renk = RENK.kirmizi, pay = 18, children }) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad));
  const maske = `conic-gradient(from 200deg, #000 ${p * 360}deg, transparent 0)`;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      {p > 0 && (
        <span style={{ position: "absolute", left: -pay, right: -pay, top: -pay * 0.7, bottom: -pay * 0.7, border: `6px solid ${renk}`, borderRadius: "50%", transform: "rotate(-4deg)", WebkitMaskImage: maske, maskImage: maske }} />
      )}
    </span>
  );
};

/** satır içi altını çizme */
const AltIc: React.FC<{ bas: number; sure?: number; renk?: string; children: React.ReactNode }> = ({ bas, sure = 0.35, renk = RENK.kirmizi, children }) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad));
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      {p > 0 && <span style={{ position: "absolute", left: -4, bottom: -6, height: 7, width: `calc((100% + 8px) * ${p})`, background: renk, borderRadius: 4, transform: "rotate(-1deg)" }} />}
    </span>
  );
};

/** çizilerek gelen tik işareti */
const Tik: React.FC<{ bas: number; boy?: number; renk?: string }> = ({ bas, boy = 54, renk = RENK.mavi }) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas + 0.3), Easing.out(Easing.quad));
  return (
    <svg width={boy} height={boy} viewBox="0 0 60 60" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }}>
      <path d="M8 32 L24 48 L54 10" fill="none" stroke={renk} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

/** çizilerek gelen çarpı */
const Carpi: React.FC<{ bas: number; boy?: number; renk?: string }> = ({ bas, boy = 54, renk = RENK.kirmizi }) => {
  const f = useCurrentFrame();
  const p1 = ara(f, k(bas), k(bas + 0.18));
  const p2 = ara(f, k(bas + 0.15), k(bas + 0.33));
  const s = { fill: "none", stroke: renk, strokeWidth: 8, strokeLinecap: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <svg width={boy} height={boy} viewBox="0 0 60 60" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }}>
      <path d="M10 10 L50 50" {...s} strokeDashoffset={1 - p1} />
      <path d="M50 10 L10 50" {...s} strokeDashoffset={1 - p2} />
    </svg>
  );
};

/** svg içinde çizilerek gelen yol */
const Yol: React.FC<{ d: string; p: number; renk?: string; kalin?: number; dolgu?: string }> = ({ d, p, renk = RENK.murekkep, kalin = 5, dolgu }) => (
  <>
    {dolgu && p >= 1 && <path d={d} fill={dolgu} stroke="none" />}
    <path d={d} fill="none" stroke={renk} strokeWidth={kalin} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
  </>
);

/** dalga kartı: başlıklı çerçeve içinde dalga */
const DalgaKart: React.FC<{ tur: DalgaTuru; w: number; h: number; etiket?: string; renk?: string; tohum?: string }> = ({ tur, w, h, etiket, renk, tohum }) => {
  const f = useCurrentFrame();
  return (
    <Kart w={w} pad="18px 26px 22px">
      {etiket && <div style={{ ...yazi(36, RENK.murekkep, "sans"), letterSpacing: 2, marginBottom: 10 }}>{etiket}</div>}
      <Dalga tur={tur} w={w - 60} h={h} f={f} renk={renk} tohum={tohum} />
    </Kart>
  );
};

/** basit sürgü (tonlama / heyecan) */
const Surgu: React.FC<{ ad: string; deger: number; w: number }> = ({ ad, deger, w }) => (
  <div style={{ width: w }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ ...yazi(36, RENK.murekkep, "sans"), letterSpacing: 3 }}>{ad}</span>
      <span style={yazi(38, RENK.mavi, "mono")}>{deger.toFixed(2)}</span>
    </div>
    <div style={{ position: "relative", height: 50 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 21, height: 8, background: RENK.murekkep, borderRadius: 4 }} />
      <div style={{ position: "absolute", left: 0, width: w * deger, top: 19, height: 12, background: RENK.mavi, borderRadius: 6 }} />
      <div style={{ position: "absolute", left: w * deger - 22, top: 3, width: 44, height: 44, borderRadius: 22, background: RENK.kagitAcik, border: `6px solid ${RENK.murekkep}`, boxSizing: "border-box" }} />
    </div>
  </div>
);

/** sayaç: a..z arasında 0→hedef */
const say = (f: number, a: number, z: number, hedef: number) => Math.round(interpolate(f, [k(a), Math.max(k(a) + 1, k(z))], [0, hedef], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));

// =====================================================================================================
// 8 — Birinci istasyon: senaryo. Üç kural.
// =====================================================================================================
const S8: FC = ({ b }) => {
  const f = useCurrentFrame();
  const kural = (no: number, bas: number, icerik: React.ReactNode) => (
    <Gir bas={bas} x={170} y={300 + (no - 1) * 215} w={800}>
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
        <span style={{ ...yazi(80, RENK.kirmizi), lineHeight: 0.9 }}>{no}.</span>
        <div style={{ flex: 1 }}>{icerik}</div>
      </div>
    </Gir>
  );
  // kronometre ilerlemesi (5. cümle: "ilk üç saniye")
  const sn = ara(f, k(c(b, 5)), k(m(b, 5, 0.75)));
  const kanca = ara(f, k(c(b, 4)), k(m(b, 4, 0.7)), Easing.out(Easing.quad));
  return (
    <>
      <Kicker b={b} metin="İSTASYON 1 · SENARYO" />
      {/* 1–2: istasyon bileti + başlık, sonra ortalama istek */}
      <Gir bas={c(b, 1)} son={bit(b, 2)} x={150} y={190} aci={-3}>
        <BiletB ust="İSTASYON" deger="1" seri="No. 08" w={210} degerBoy={84} />
      </Gir>
      <Gir bas={c(b, 1) + 0.15} son={bit(b, 2)} x={620} y={200} w={1200}>
        <Manset metin="Senaryo" bas={c(b, 1) + 0.15} boy={170} imlec={false} />
      </Gir>
      <Gir bas={c(b, 2) + 0.2} son={bit(b, 2)} x={150} y={560} w={1000}>
        <Kart w={1000} pad="22px 30px">
          <div style={{ ...yazi(34, RENK.murekkep, "sans"), opacity: 0.6, marginBottom: 10 }}>çoğu kişinin isteği</div>
          <DaktiloYazi metin={"“bana bir video senaryosu yaz”"} ilerleme={ara(f, k(c(b, 2) + 0.3), k(m(b, 2, 0.4)))} f={f} boy={44} />
        </Kart>
      </Gir>
      <Gir bas={m(b, 2, 0.5)} son={bit(b, 2)} x={1230} y={470} w={540} aci={2}>
        <Kart w={540} h={380} pad="30px 34px">
          {[0.95, 0.88, 0.92, 0.7, 0.9, 0.6].map((w, i) => (
            <div key={i} style={{ height: 14, width: `${w * 100}%`, background: RENK.murekkep, opacity: 0.22, borderRadius: 7, marginBottom: 30 }} />
          ))}
        </Kart>
      </Gir>
      <DamgaAt id={`${b}-ort`} metin="ORTALAMA" bas={m(b, 2, 0.68)} son={bit(b, 2)} x={1255} y={590} boy={64} renk={RENK.murekkep} aci={-10} />

      {/* 3: gerçek ekran — Claude ile birlikte yazım; kurallar benden */}
      <Ekran klasor={2} bas={c(b, 3)} son={cs(b, 3)} gorunSon={bit(b, 3)} x={140} y={180} w={860} hiz={6} />
      <Gir bas={m(b, 3, 0.35)} son={bit(b, 3)} x={1080} y={210} w={760}>
        <Manset metin="Kuralları ben koyuyorum." bas={m(b, 3, 0.35)} boy={84} />
      </Gir>
      <WJAt pozlar={[[c(b, 3), "normal"], [m(b, 3, 0.7), "omuz"]]} bas={m(b, 3, 0.45)} son={bit(b, 3)} x={1330} y={440} boy={500} />

      {/* 4–9: kural defteri (sol) + sağda değişen çizimler */}
      <Gir bas={c(b, 4)} x={140} y={180} w={880}>
        <div style={{ ...yazi(40, RENK.murekkep, "sans"), letterSpacing: 6 }}>KURALLAR</div>
        <div style={{ borderTop: `3px solid ${RENK.murekkep}`, borderBottom: `1px solid ${RENK.murekkep}`, height: 5, marginTop: 10, width: 840 }} />
      </Gir>
      {kural(1, c(b, 4), <div style={yazi(56)}>İlk cümle <AltIc bas={m(b, 4, 0.55)}>kanca</AltIc> olmalı.</div>)}
      {kural(
        2,
        c(b, 6),
        <>
          <div style={yazi(56)}>Rakam ya da iddia varsa, <AltIc bas={m(b, 6, 0.6)}>doğrulanmış</AltIc> olacak.</div>
          {gecti(f, c(b, 7)) && (
            <div style={{ ...yazi(40, RENK.murekkep, "mono"), marginTop: 22 }}>
              <Cizik bas={m(b, 7, 0.45)}>uydurma istatistik</Cizik>
            </div>
          )}
        </>,
      )}
      {kural(3, c(b, 8), <div style={yazi(56)}>Kimseye para kazandırma sözü yok.</div>)}

      {/* 4: kanca */}
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={1240} y={210}>
        <svg width={420} height={560} viewBox="0 0 420 560" style={{ overflow: "visible" }}>
          <Yol d="M210 30 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0" p={kanca} kalin={7} />
          <Yol d="M210 52 L210 380 C210 500 80 500 80 400 L80 360" p={kanca} kalin={9} />
          <Yol d="M80 360 L52 400" p={ara(f, k(m(b, 4, 0.6)), k(m(b, 4, 0.8)))} kalin={9} />
        </svg>
        <div style={{ ...yazi(64), marginTop: -20, marginLeft: 150 }}>kanca</div>
      </Gir>
      {/* 5: kronometre — ilk üç saniye */}
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={1180} y={200}>
        <svg width={520} height={560} viewBox="0 0 520 560" style={{ overflow: "visible" }}>
          <rect x={235} y={20} width={50} height={36} rx={6} fill={RENK.murekkep} />
          <circle cx={260} cy={300} r={220} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={8} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            return <line key={i} x1={260 + Math.cos(a) * 190} y1={300 + Math.sin(a) * 190} x2={260 + Math.cos(a) * 210} y2={300 + Math.sin(a) * 210} stroke={RENK.murekkep} strokeWidth={5} />;
          })}
          <circle cx={260} cy={300} r={150} fill="none" stroke={RENK.kirmizi} strokeWidth={40} pathLength={1} strokeDasharray={`${sn * 0.25} 1`} transform="rotate(-90 260 300)" opacity={0.85} />
          <line x1={260} y1={300} x2={260 + Math.cos(sn * Math.PI * 0.5 - Math.PI / 2) * 170} y2={300 + Math.sin(sn * Math.PI * 0.5 - Math.PI / 2) * 170} stroke={RENK.murekkep} strokeWidth={8} strokeLinecap="round" />
          <circle cx={260} cy={300} r={14} fill={RENK.murekkep} />
        </svg>
        <div style={{ ...yazi(72), marginTop: -10, textAlign: "center", width: 520 }}>ilk {Math.max(0, Math.min(3, Math.floor(sn * 3 + 0.001)))} saniye</div>
      </Gir>
      {/* 6–7: gerçek ekran — doğrulama isteği */}
      <Ekran klasor={10} bas={c(b, 6)} son={cs(b, 7)} gorunSon={bit(b, 7)} x={1080} y={200} w={720} hiz={6} />
      {/* 8–9: para sözü yasak */}
      <Gir bas={c(b, 8)} x={1080} y={300} w={720} aci={-2}>
        <Kart w={720} pad="40px 40px">
          <div style={{ ...yazi(80), textAlign: "center" }}>
            {gecti(f, c(b, 9)) ? <Cizik bas={m(b, 9, 0.5)} sure={0.4}>“Şunu yap, zengin ol.”</Cizik> : "“Şunu yap, zengin ol.”"}
          </div>
        </Kart>
      </Gir>
      <DamgaAt id={`${b}-yasak`} metin="YASAK" bas={m(b, 9, 0.72)} x={1250} y={560} boy={120} aci={-9} />
    </>
  );
};

// =====================================================================================================
// 9 — Her bölüm bir benzetmeyle açılır: dükkân (tabela, vitrin, raflar) → Sidis.
// =====================================================================================================
const S9: FC = ({ b }) => {
  const f = useCurrentFrame();
  const pT = ara(f, k(c(b, 4) - 0.1), k(m(b, 4, 0.45)), Easing.out(Easing.quad));
  const pV = ara(f, k(m(b, 4, 0.3)), k(m(b, 4, 0.85)), Easing.out(Easing.quad));
  const pR = ara(f, k(m(b, 4, 0.6)), k(cs(b, 4) + 0.5), Easing.out(Easing.quad));
  const pB = ara(f, k(c(b, 4) - 0.3), k(c(b, 4) + 0.2));
  return (
    <>
      <Kicker b={b} metin="İSTASYON 1 · BENZETME" />
      {/* 1–2 */}
      <Gir bas={c(b, 1)} son={bit(b, 2)} x={160} y={200} w={1150}>
        <Manset metin="Bir şey daha:" bas={c(b, 1)} boy={110} />
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={160} y={400} w={1150}>
        <Manset metin="Her bölüm bir benzetmeyle açılır." bas={c(b, 2)} boy={100} />
      </Gir>
      <WJAt pozlar={[[c(b, 1), "dusunen"], [c(b, 2), "normal"]]} fikir={m(b, 1, 0.3)} bas={c(b, 1)} son={bit(b, 2)} x={1440} y={380} boy={560} />

      {/* 3: kanal sayfası = dükkân */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={160} y={320} w={640}>
        <PencereB baslik="kanal sayfası" w={640}>
          {[0.5, 0.95, 0.95, 0.8].map((w, i) => (
            <div key={i} style={{ height: i === 0 ? 30 : 70, width: `${w * 100}%`, background: i === 0 ? RENK.mavi : RENK.murekkep, opacity: i === 0 ? 0.6 : 0.14, borderRadius: 8, marginBottom: 18 }} />
          ))}
        </PencereB>
      </Gir>
      <Ok x1={830} y1={540} x2={1090} y2={540} egri={-0.18} bas={m(b, 3, 0.4)} son={bit(b, 3)} />
      <Gir bas={m(b, 3, 0.55)} son={bit(b, 3)} x={1130} y={400}>
        <div style={yazi(170)}>dükkân</div>
      </Gir>

      {/* 4–5: dükkân çizimi */}
      <Gir bas={c(b, 4) - 0.3} son={bit(b, 5)} x={140} y={180}>
        <svg width={820} height={790} viewBox="0 0 820 790" style={{ overflow: "visible" }}>
          {/* bina */}
          <Yol d="M40 760 L40 210 L780 210 L780 760" p={pB} kalin={7} />
          <Yol d="M20 760 L800 760" p={pB} kalin={7} />
          {/* tabela */}
          <Yol d="M90 40 L730 40 L730 170 L90 170 Z" p={pT} kalin={7} dolgu={RENK.kagitAcik} />
          <Yol d="M200 170 L200 210 M620 170 L620 210" p={pT} kalin={6} />
          <text x={410} y={130} textAnchor="middle" fontFamily={SERIF} fontSize={74} fill={RENK.murekkep} opacity={pT}>TABELA</text>
          {/* tente */}
          <Yol d="M40 210 L60 270 L120 270 L140 210 L160 270 L220 270 L240 210 L260 270 L320 270 L340 210 L360 270 L420 270 L440 210" p={pV} kalin={5} />
          {/* vitrin */}
          <Yol d="M80 300 L470 300 L470 640 L80 640 Z" p={pV} kalin={7} dolgu="#FBF8EF" />
          <Yol d="M275 300 L275 640" p={pV} kalin={4} />
          <Yol d="M120 600 L120 520 L180 520 L180 600 M200 600 C200 540 250 540 250 600 M310 600 L340 500 L370 600 Z M390 600 L390 540 L440 540 L440 600" p={ara(f, k(m(b, 4, 0.55)), k(cs(b, 4) + 0.3))} kalin={5} />
          <Yol d="M100 600 L450 600" p={pV} kalin={5} />
          <text x={275} y={700} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={40} letterSpacing={4} fill={RENK.kirmizi} opacity={pV}>VİTRİN</text>
          {/* raflar (kapıdan görünen) */}
          <Yol d="M520 300 L740 300 L740 760 L520 760 Z" p={pR} kalin={7} />
          {[380, 470, 560, 650].map((y, i) => (
            <Yol key={y} d={`M540 ${y} L720 ${y} M555 ${y} L555 ${y - 40} L585 ${y - 40} L585 ${y} M600 ${y} L600 ${y - 55} L622 ${y - 55} L622 ${y} M640 ${y} L640 ${y - 30} L700 ${y - 30} L700 ${y}`} p={ara(f, k(m(b, 4, 0.7) + i * 0.15), k(cs(b, 4) + 0.6 + i * 0.15))} kalin={4} />
          ))}
          <text x={630} y={735} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={40} letterSpacing={4} fill={RENK.kirmizi} opacity={pR}>RAFLAR</text>
        </svg>
      </Gir>
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={1080} y={300} w={760}>
        <Manset metin="Tabela, vitrin, raflar." bas={c(b, 4)} yazSn={Math.max(0.6, cs(b, 4) - c(b, 4))} boy={96} />
      </Gir>
      {/* 5: soyut → somut, izleyicinin kafasında resim */}
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={1060} y={230} w={800}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 30 }}>
          <span style={{ ...yazi(80), opacity: 0.55 }}>soyut</span>
          <span style={yazi(80, RENK.kirmizi)}>→</span>
          <span style={yazi(80)}>
            <AltIc bas={m(b, 5, 0.3)}>somut</AltIc>
          </span>
        </div>
      </Gir>
      <Gir bas={m(b, 5, 0.25)} son={bit(b, 5)} x={1060} y={380} w={800}>
        <div style={yazi(52)}>anlatması kolaylaşır</div>
      </Gir>
      <Gir bas={m(b, 5, 0.6)} son={bit(b, 5)} x={1060} y={500} w={460}>
        <div style={yazi(58, RENK.mavi)}>izleyicinin kafasında bir resim</div>
      </Gir>
      <WJAt pozlar={[[m(b, 5, 0.55), "dusunen"]]} fikir={m(b, 5, 0.7)} bas={m(b, 5, 0.55)} son={bit(b, 5)} x={1550} y={470} boy={480} />

      {/* 6–8: bu videoda benzetme Sidis */}
      <Gir bas={c(b, 6)} x={160} y={190} w={1600}>
        <Manset metin="Bu videoda o benzetme: Sidis." bas={c(b, 6)} boy={104} />
      </Gir>
      <Gir bas={c(b, 7)} x={150} y={420} w={500} aci={-2}>
        <Kart w={500} pad="0 0 26px">
          <div style={{ background: RENK.murekkep, color: RENK.kagitAcik, ...yazi(34, RENK.kagitAcik, "sans"), letterSpacing: 4, padding: "10px 24px" }}>GAZETE MANŞETİ</div>
          <div style={{ ...yazi(84), padding: "20px 24px 0", lineHeight: 1 }}>HARİKA ÇOCUK</div>
        </Kart>
      </Gir>
      <Gir bas={m(b, 7, 0.33)} x={710} y={430} w={500} aci={1.5}>
        <Kart w={500} pad="22px 26px">
          <div style={{ ...yazi(60), borderBottom: `3px solid ${RENK.murekkep}`, paddingBottom: 8, marginBottom: 14 }}>Gazeteler</div>
          <div style={{ display: "flex", gap: 18 }}>
            {[0, 1, 2].map((s) => (
              <div key={s} style={{ flex: 1 }}>
                {[1, 0.8, 1, 0.9, 0.6].map((w, i) => (
                  <div key={i} style={{ height: 9, width: `${w * 100}%`, background: RENK.murekkep, opacity: 0.25, borderRadius: 4, marginBottom: 14 }} />
                ))}
              </div>
            ))}
          </div>
        </Kart>
      </Gir>
      <Gir bas={m(b, 7, 0.66)} x={1290} y={430} aci={-4}>
        <BiletB ust="AKTARMA" deger="tramvay" seri="No. 09" w={270} degerBoy={52} olcek={1.9} />
      </Gir>
      {/* 8: neden tramvay bileti? */}
      <Gir bas={c(b, 8)} x={1290} y={210}>
        <div style={yazi(220, RENK.kirmizi)}>?</div>
      </Gir>
      <Gir bas={m(b, 8, 0.25)} x={160} y={800} w={1100}>
        <div style={yazi(72)}>neden tramvay bileti? birazdan.</div>
      </Gir>
      <AltCizgiAt bas={m(b, 8, 0.15)} x={1280} y={700} w={520} />
    </>
  );
};
/** Ortak'taki AltCizgi'yi doğrudan kullanmak yerine burada sabit konumlu kısa hali */
const AltCizgiAt: React.FC<{ bas: number; x: number; y: number; w: number }> = ({ bas, x, y, w }) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas + 0.4), Easing.out(Easing.quad));
  if (p <= 0) return null;
  return (
    <svg width={w + 20} height={40} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      <path d={`M0 18 Q${w / 2} 4 ${w} 14 M20 32 Q${w / 2} 22 ${w - 30} 28`} fill="none" stroke={RENK.kirmizi} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
};

// =====================================================================================================
// 10 — Okunuşa göre metin: ekranda "Claude", seste "Klod".
// =====================================================================================================
const S10: FC = ({ b }) => {
  const f = useCurrentFrame();
  return (
    <>
      <Kicker b={b} metin="İSTASYON 1 · OKUNUŞ" />
      <Gir bas={c(b, 1)} son={bit(b, 2)} x={160} y={190} w={1100}>
        <Manset metin="Claude'a bir iş daha." bas={c(b, 1)} boy={100} />
      </Gir>
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={160} y={190} w={1100}>
        <Manset metin="Yapay zekâ sesleri bazı kelimeleri bozar." bas={c(b, 3)} boy={72} />
      </Gir>
      <Gir bas={c(b, 4)} son={bit(b, 5)} x={160} y={190} w={1100}>
        <Manset metin="Doğru yazım ≠ doğru okunuş" bas={c(b, 4)} boy={80} />
      </Gir>
      <DaktiloAt
        bas={c(b, 1)}
        x={1360}
        y={240}
        boy={400}
        konus={[[c(b, 1), cs(b, 2)], [m(b, 4, 0.5), cs(b, 4)]]}
        gozler={[[c(b, 3), "uzgun"], [c(b, 5), "kirpGoz"], [c(b, 6), "acik"]]}
      />
      {/* Daktilo'nun yanlış okuyuşu */}
      <Gir bas={m(b, 3, 0.3)} son={bit(b, 3)} x={1340} y={640}>
        <DalgaKart tur="burun" w={460} h={110} etiket="bozuk okuma" renk={RENK.kirmizi} />
      </Gir>
      <Gir bas={m(b, 4, 0.5)} son={bit(b, 4)} x={1300} y={640}>
        <Balon w={440} h={150} kuyrukX={300}>
          <span style={yazi(80, RENK.kirmizi)}>“Kılaud?”</span>
        </Balon>
      </Gir>

      {/* 2–5: iki sütun: ekranda / seste */}
      <Gir bas={c(b, 2)} x={160} y={360} w={1100}>
        <Kart w={1100} h={450} pad="26px 40px">
          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, ...yazi(40, RENK.murekkep, "sans"), letterSpacing: 5 }}>EKRANDA</div>
            <div style={{ flex: 1, ...yazi(40, RENK.mavi, "sans"), letterSpacing: 5, paddingLeft: 40 }}>SESTE</div>
          </div>
          <div style={{ borderTop: `3px solid ${RENK.murekkep}`, marginTop: 12 }} />
          <div style={{ position: "absolute", left: 550, top: 26, bottom: 26, borderLeft: `3px solid ${RENK.murekkep}`, opacity: 0.4 }} />
          <div style={{ display: "flex", marginTop: 40 }}>
            <div style={{ flex: 1 }}>{gecti(f, c(b, 4)) && <span style={yazi(110)}>Claude</span>}</div>
            <div style={{ flex: 1, paddingLeft: 40 }}>
              {gecti(f, m(b, 4, 0.5)) && (
                <span style={yazi(100, RENK.kirmizi)}>
                  <Cizik bas={m(b, 4, 0.92)}>Kılaud</Cizik>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 26 }}>
            <div style={{ flex: 1, ...yazi(40, RENK.murekkep, "mono"), opacity: 0.6, paddingTop: 30 }}>{gecti(f, c(b, 5)) ? "doğru yazım" : ""}</div>
            <div style={{ flex: 1, paddingLeft: 40 }}>
              {gecti(f, c(b, 5)) && (
                <span style={yazi(110, RENK.mavi)}>
                  <DaireIc bas={m(b, 5, 0.5)}>Klod</DaireIc>
                </span>
              )}
            </div>
          </div>
        </Kart>
      </Gir>
      <DamgaAt id={`${b}-dogru`} metin="DOĞRU" bas={m(b, 5, 0.75)} x={980} y={760} boy={70} aci={-10} />
      {/* 6: ayrı bir araç — ileride */}
      <Ok x1={1000} y1={900} x2={1300} y2={930} egri={-0.2} bas={c(b, 6)} />
      <Gir bas={m(b, 6, 0.2)} x={1320} y={850} w={540} aci={-1.5}>
        <Kart w={500} pad="14px 24px">
          <div style={yazi(46)}>ayrı bir araç</div>
          <div style={yazi(36, RENK.kirmizi, "sans")}>ileride anlatılacak</div>
        </Kart>
      </Gir>
    </>
  );
};

// =====================================================================================================
// 11 — İkinci istasyon: ses. 6 saniyelik örnek, yerel ücretsiz model.
// =====================================================================================================
const S11: FC = ({ b }) => {
  const f = useCurrentFrame();
  const yuzX = ara(f, k(m(b, 3, 0.3)), k(m(b, 3, 0.55)));
  const adim = (i: number, bas: number, metin: string, son: React.ReactNode) => (
    <Gir bas={bas} x={160 + i * 400} y={600} w={360}>
      <Kart w={360} pad="22px 26px">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={yazi(48, RENK.murekkep, "mono")}>{metin}</span>
          {son}
        </div>
      </Kart>
    </Gir>
  );
  const nokta = ".".repeat(1 + (Math.floor(f / 8) % 3));
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · SES" />
      {/* 1–2 */}
      <Gir bas={c(b, 1)} son={bit(b, 2)} x={150} y={190} aci={-3}>
        <BiletB ust="İSTASYON" deger="2" seri="No. 11" w={210} degerBoy={84} />
      </Gir>
      <Gir bas={c(b, 1) + 0.15} son={bit(b, 2)} x={620} y={200} w={900}>
        <Manset metin="Ses" bas={c(b, 1) + 0.15} boy={170} imlec={false} />
      </Gir>
      <Gir bas={m(b, 2, 0.1)} son={bit(b, 2)} x={160} y={600} w={1150}>
        <div style={{ ...yazi(90), fontStyle: "italic" }}>
          “En çok <AltIc bas={m(b, 2, 0.45)}>canımı yakan</AltIc> istasyon.”
        </div>
      </Gir>
      <WJAt pozlar={[[c(b, 2), "saskin"]]} bas={m(b, 2, 0.3)} son={bit(b, 2)} x={1450} y={380} boy={560} />

      {/* 3: yüz yok, ses var */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={200} y={230}>
        <svg width={420} height={460} viewBox="0 0 420 460" style={{ overflow: "visible" }}>
          <rect x={10} y={10} width={400} height={440} rx={10} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={6} />
          <circle cx={210} cy={180} r={86} fill="none" stroke={RENK.murekkep} strokeWidth={6} />
          <path d="M70 450 C70 330 350 330 350 450" fill="none" stroke={RENK.murekkep} strokeWidth={6} />
          <Yol d="M40 40 L380 420" p={yuzX} renk={RENK.kirmizi} kalin={12} />
          <Yol d="M380 40 L40 420" p={ara(f, k(m(b, 3, 0.45)), k(m(b, 3, 0.7)))} renk={RENK.kirmizi} kalin={12} />
        </svg>
        <div style={{ ...yazi(64), marginTop: 14, textAlign: "center", width: 420 }}>yüz: yok</div>
      </Gir>
      <Gir bas={m(b, 3, 0.55)} son={bit(b, 3)} x={820} y={330}>
        <DalgaKart tur="canli" w={860} h={200} etiket="SES" />
        <div style={{ ...yazi(64), marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
          ses: var <Tik bas={m(b, 3, 0.75)} boy={64} />
        </div>
      </Gir>
      {/* 4: klon */}
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={160} y={200} w={1600}>
        <Manset metin="Kendi sesimi klonlamak" bas={c(b, 4)} boy={96} />
      </Gir>
      <Gir bas={c(b, 4) + 0.2} son={bit(b, 4)} x={160} y={420}>
        <DalgaKart tur="canli" w={640} h={180} etiket="BENİM SESİM" tohum="a" />
      </Gir>
      <Ok x1={830} y1={560} x2={1060} y2={560} egri={-0.2} bas={m(b, 4, 0.35)} son={bit(b, 4)} />
      <Gir bas={m(b, 4, 0.55)} son={bit(b, 4)} x={1100} y={420}>
        <DalgaKart tur="canli" w={640} h={180} etiket="KLON" tohum="a" renk={RENK.kirmizi} />
      </Gir>
      {/* 5–6: altı saniyelik telefon videosu */}
      <WJAt pozlar={[[c(b, 5), "telefon"], [c(b, 6), "gosteren"]]} bas={c(b, 5)} son={bit(b, 6)} x={280} y={380} boy={590} />
      <Gir bas={m(b, 5, 0.15)} son={bit(b, 6)} x={880} y={250} aci={-3}>
        <BiletB ust="ÖRNEK" deger="6 sn" seri="No. 11" w={240} degerBoy={84} />
      </Gir>
      <Gir bas={m(b, 5, 0.5)} son={bit(b, 6)} x={880} y={620} w={900}>
        <div style={yazi(64)}>telefonla çekilmiş bir video</div>
      </Gir>
      <Gir bas={c(b, 6)} son={bit(b, 6)} x={150} y={150}>
        <Balon w={560} h={150} kuyrukX={330}>
          <span style={yazi(70)}>“Altı saniye yeter.”</span>
        </Balon>
      </Gir>
      {/* 7–8: yerel, ücretsiz model; ses + metin + bekle */}
      <Gir bas={c(b, 7)} x={160} y={190} w={1100}>
        <PencereB baslik="yerel ses modeli" w={1100}>
          <div style={{ ...yazi(44, RENK.murekkep, "mono"), opacity: gecti(f, m(b, 7, 0.3)) ? 1 : 0, marginBottom: 14 }}>● kendi bilgisayarımda çalışıyor</div>
          <div style={{ ...yazi(44, RENK.murekkep, "mono"), opacity: gecti(f, m(b, 7, 0.7)) ? 1 : 0 }}>
            ● <AltIc bas={m(b, 7, 0.75)}>ücretsiz</AltIc>
          </div>
        </PencereB>
      </Gir>
      <WJAt pozlar={[[c(b, 7), "normal"], [c(b, 8), "dusunen"]]} bas={m(b, 7, 0.2)} x={1450} y={380} boy={560} />
      {adim(0, c(b, 8), "ses", <Tik bas={c(b, 8) + 0.3} />)}
      {adim(1, m(b, 8, 0.33), "metin", <Tik bas={m(b, 8, 0.33) + 0.3} />)}
      {adim(2, m(b, 8, 0.66), "bekle" + nokta, null)}
    </>
  );
};

// =====================================================================================================
// 12 — Sonuç: burundan, BOĞUK, üç deneme OLMAMIŞ, 17 dakikalık gece.
// =====================================================================================================
const S12: FC = ({ b }) => {
  const f = useCurrentFrame();
  const tur: DalgaTuru = gecti(f, c(b, 5)) ? "boguk" : gecti(f, c(b, 3)) ? "burun" : "canli";
  const altyazi = gecti(f, c(b, 5)) ? "boğuldu" : gecti(f, c(b, 4)) ? "biraz kalınlaştırdım" : gecti(f, c(b, 3)) ? "ama burnumdan" : "ses benim";
  const kalin = interpolate(f, [k(c(b, 4)), k(cs(b, 4))], [0.45, 0.82], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const ton = 0.5 + 0.28 * Math.sin((f - k(c(b, 6))) * 0.11);
  const hey = 0.42 + 0.3 * Math.sin((f - k(c(b, 6))) * 0.08 + 1.4);
  const deneme = (i: number) => {
    const bas = m(b, 7, 0.08 + i * 0.16);
    return (
      <React.Fragment key={i}>
        <Gir bas={bas} son={bit(b, 7)} x={160 + i * 420} y={665} aci={i % 2 ? 2 : -2}>
          <BiletB ust="DENEME" deger={`×${i + 1}`} seri={`No. 12-${i + 1}`} w={200} degerBoy={66} olcek={1.9} />
        </Gir>
        <DamgaAt id={`${b}-olm${i}`} metin="OLMAMIŞ" bas={m(b, 7, 0.68 + i * 0.1)} son={bit(b, 7)} x={175 + i * 420} y={878} boy={46} aci={-6 + i * 4} />
      </React.Fragment>
    );
  };
  const gunes = gecti(f, c(b, 9));
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · İLK DENEME" />
      {/* 1–7 */}
      <Gir bas={c(b, 1)} son={bit(b, 7)} x={160} y={170} w={900}>
        <Manset metin="Sonuç?" bas={c(b, 1)} boy={120} />
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 7)} x={160} y={330}>
        <DalgaKart tur={tur} w={1050} h={190} etiket="KLON SESİ" />
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 5)} x={160} y={630} w={1050}>
        <div style={yazi(68, gecti(f, c(b, 3)) ? RENK.kirmizi : RENK.murekkep)}>{altyazi}</div>
      </Gir>
      <DamgaAt id={`${b}-burun`} metin="BURUNDAN" bas={m(b, 3, 0.45)} son={bit(b, 4)} x={700} y={360} boy={76} />
      <DamgaAt id={`${b}-boguk`} metin="BOĞUK" bas={m(b, 5, 0.35)} son={bit(b, 7)} x={780} y={360} boy={96} />
      <Gir bas={c(b, 4)} son={bit(b, 5)} x={160} y={720}>
        <div style={{ transform: "scale(1.2)", transformOrigin: "0 0" }}>
          <Kaydirici deger={kalin} w={620} />
        </div>
      </Gir>
      <Gir bas={c(b, 6)} son={bit(b, 6)} x={160} y={640} w={1050}>
        <Kart w={1050} pad="26px 40px">
          <Surgu ad="TONLAMA" deger={ton} w={960} />
          <div style={{ height: 24 }} />
          <Surgu ad="HEYECAN" deger={hey} w={960} />
        </Kart>
      </Gir>
      {deneme(0)}
      {deneme(1)}
      {deneme(2)}
      <WJAt
        pozlar={[[c(b, 1), "dusunen"], [c(b, 2), "normal"], [c(b, 3), "saskin"], [c(b, 4), "dusunen"], [c(b, 5), "saskin"], [c(b, 6), "dusunen"], [m(b, 7, 0.7), "omuz"]]}
        bas={c(b, 1)}
        son={bit(b, 7)}
        x={1460}
        y={330}
        boy={560}
      />
      {/* 8–10: bir gece, 17 dakika, sabah */}
      <Gir bas={c(b, 8)} x={150} y={210} aci={-3}>
        <BiletB ust="SÜRE" deger="17 dk" seri="No. 12" w={230} degerBoy={84} />
      </Gir>
      <Gir bas={m(b, 8, 0.2)} x={700} y={230} w={700}>
        <div style={yazi(72)}>{gunes ? "sabah dinledim" : "bir gece boyunca"}</div>
      </Gir>
      <Gir bas={m(b, 8, 0.35)} x={700} y={360}>
        <DalgaKart tur="boguk" w={760} h={150} etiket="17 DAKİKA SESLENDİRME" />
      </Gir>
      <Gir bas={m(b, 8, 0.1)} x={1560} y={190}>
        <svg width={220} height={220} viewBox="0 0 220 220" style={{ overflow: "visible" }}>
          {gunes ? (
            <>
              <circle cx={110} cy={110} r={52} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={6} />
              {Array.from({ length: 10 }, (_, i) => {
                const a = (i / 10) * Math.PI * 2 + f * 0.01;
                return <line key={i} x1={110 + Math.cos(a) * 68} y1={110 + Math.sin(a) * 68} x2={110 + Math.cos(a) * 96} y2={110 + Math.sin(a) * 96} stroke={RENK.murekkep} strokeWidth={6} strokeLinecap="round" />;
              })}
            </>
          ) : (
            <path d="M140 30 A80 80 0 1 0 190 150 A64 64 0 1 1 140 30 Z" fill={RENK.murekkep} />
          )}
        </svg>
      </Gir>
      <WJAt pozlar={[[c(b, 9), "telefon"], [c(b, 10), "saskin"]]} bas={c(b, 9)} x={1530} y={440} boy={520} />
      <Gir bas={c(b, 10)} x={160} y={640} w={1300}>
        <div style={{ display: "flex", gap: 50, alignItems: "baseline" }}>
          <span style={yazi(100)}>Boğuk.</span>
          {gecti(f, m(b, 10, 0.3)) && <span style={yazi(100)}>Düz.</span>}
          {gecti(f, m(b, 10, 0.55)) && (
            <span style={yazi(100, RENK.kirmizi)}>
              <DaireIc bas={m(b, 10, 0.7)}>Heyecansız.</DaireIc>
            </span>
          )}
        </div>
      </Gir>
    </>
  );
};

// =====================================================================================================
// 13 — Sorun ayarda değil, örnekte: 6 sn düz → 37 sn canlı.
// =====================================================================================================
const S13: FC = ({ b }) => {
  const f = useCurrentFrame();
  const tag = (i: number, bas: number, metin: string) => (
    <Gir bas={bas} son={bit(b, 6)} x={700 + i * 260} y={250} aci={i % 2 ? 2 : -2}>
      <Kart w={240} pad="12px 18px" style={{ textAlign: "center" }}>
        <span style={yazi(44)}>{metin}</span>
      </Kart>
    </Gir>
  );
  const modelTur: DalgaTuru = gecti(f, c(b, 5)) ? "duz" : "burun";
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · ÖRNEK" />
      <WJAt
        pozlar={[[c(b, 1), "dusunen"], [c(b, 2), "gosteren"], [c(b, 4), "normal"], [c(b, 6), "gosteren"], [c(b, 7), "omuz"], [c(b, 8), "normal"]]}
        fikir={m(b, 1, 0.3)}
        bas={c(b, 1)}
        x={1460}
        y={380}
        boy={560}
        gulumse
      />
      {/* 1–2 */}
      <Gir bas={c(b, 1)} son={bit(b, 2)} x={160} y={200} w={1200}>
        <Manset metin="Sonra şunu fark ettim:" bas={c(b, 1)} boy={100} />
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={160} y={420} w={1200}>
        <div style={yazi(110)}>
          sorun: <Cizik bas={m(b, 2, 0.3)}>ayarda</Cizik>
        </div>
        {gecti(f, m(b, 2, 0.55)) && (
          <div style={{ ...yazi(110), marginTop: 40 }}>
            sorun: <span style={{ color: RENK.kirmizi, marginLeft: 24 }}><DaireIc bas={m(b, 2, 0.75)}>örnekte</DaireIc></span>
          </div>
        )}
      </Gir>
      {/* 3: 6 sn düz örnek */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={150} y={230} aci={-3}>
        <BiletB ust="ÖRNEK" deger="6 sn" seri="No. 13" w={230} degerBoy={84} />
      </Gir>
      <Gir bas={c(b, 3) + 0.2} son={bit(b, 3)} x={680} y={240}>
        <DalgaKart tur="duz" w={660} h={170} etiket="ALTI SANİYE" />
      </Gir>
      <Gir bas={m(b, 3, 0.35)} son={bit(b, 3)} x={680} y={560} w={700}>
        <div style={{ ...yazi(64), display: "flex", alignItems: "center", gap: 18 }}>
          tonlama: yok <Carpi bas={m(b, 3, 0.4)} />
        </div>
      </Gir>
      <Gir bas={m(b, 3, 0.6)} son={bit(b, 3)} x={680} y={660} w={700}>
        <div style={{ ...yazi(64), display: "flex", alignItems: "center", gap: 18 }}>
          heyecan: yok <Carpi bas={m(b, 3, 0.65)} />
        </div>
      </Gir>
      {/* 4–5: model taklit eder */}
      <Gir bas={c(b, 4)} son={bit(b, 5)} x={160} y={190} w={1250}>
        <Manset metin="Model, ne verirsen onu taklit eder." bas={c(b, 4)} boy={76} />
      </Gir>
      <Gir bas={c(b, 4) + 0.2} son={bit(b, 5)} x={140} y={440}>
        <DalgaKart tur={modelTur} w={380} h={140} etiket="ÖRNEK" tohum="m" />
      </Gir>
      <Ok x1={540} y1={540} x2={620} y2={540} egri={0} bas={m(b, 4, 0.25)} son={bit(b, 5)} />
      <DaktiloAt bas={m(b, 4, 0.1)} son={bit(b, 5)} x={640} y={400} boy={300} konus={[[c(b, 4), cs(b, 5)]]} />
      <Ok x1={960} y1={540} x2={1030} y2={540} egri={0} bas={m(b, 4, 0.45)} son={bit(b, 5)} />
      <Gir bas={m(b, 4, 0.55)} son={bit(b, 5)} x={1040} y={440}>
        <DalgaKart tur={modelTur} w={380} h={140} etiket="SES" tohum="m" />
      </Gir>
      <Gir bas={m(b, 5, 0.3)} son={bit(b, 5)} x={140} y={760} w={1300}>
        <div style={yazi(70)}>
          <AltIc bas={m(b, 5, 0.5)}>düz örnek</AltIc> → <AltIc bas={m(b, 5, 0.75)}>düz ses</AltIc>
        </div>
      </Gir>
      {/* 6: 37 sn canlı kayıt */}
      <Gir bas={c(b, 6)} son={bit(b, 6)} x={150} y={230} aci={-3}>
        <BiletB ust="ÖRNEK" deger="37 sn" seri="No. 13" w={250} degerBoy={84} />
      </Gir>
      {tag(0, m(b, 6, 0.1), "sessiz oda")}
      {tag(1, m(b, 6, 0.3), "canlı")}
      {tag(2, m(b, 6, 0.5), "enerjik")}
      <Gir bas={m(b, 6, 0.6)} son={bit(b, 6)} x={150} y={580}>
        <DalgaKart tur="canli" w={1180} h={200} etiket="OTUZ YEDİ SANİYE" />
      </Gir>
      {/* 7: fark */}
      <Gir bas={c(b, 7)} son={bit(b, 7)} x={150} y={260}>
        <DalgaKart tur="duz" w={560} h={170} etiket="6 SN" />
      </Gir>
      <Gir bas={c(b, 7) + 0.15} son={bit(b, 7)} x={770} y={260}>
        <DalgaKart tur="canli" w={560} h={170} etiket="37 SN" />
      </Gir>
      <DamgaAt id={`${b}-fark`} metin="FARK" bas={m(b, 7, 0.4)} son={bit(b, 7)} x={560} y={580} boy={120} aci={-7} />
      {/* 8: şu an dinlediğin ses */}
      <Gir bas={c(b, 8)} x={150} y={300}>
        <DalgaKart tur="canli" w={1200} h={260} etiket="ŞU AN DİNLEDİĞİN SES" renk={RENK.kirmizi} />
      </Gir>
      <Gir bas={m(b, 8, 0.3)} x={170} y={740}>
        <GercekRozet metin="o 37 saniyelik kayıttan" />
      </Gir>
    </>
  );
};

// =====================================================================================================
// 14 — Ekran kartı: 8 GB, model 6,5 GB, uzun örnek → taşma, kısa cümle.
// =====================================================================================================
const S14: FC = ({ b }) => {
  const f = useCurrentFrame();
  const gb =
    f < k(c(b, 3))
      ? 0
      : f < k(c(b, 4))
        ? interpolate(f, [k(c(b, 3) + 0.3), k(m(b, 3, 0.7))], [0, 6.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
        : f < k(c(b, 5))
          ? interpolate(f, [k(m(b, 4, 0.3)), k(m(b, 4, 0.8))], [6.5, 7.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : interpolate(f, [k(c(b, 5) + 0.2), k(m(b, 5, 0.6))], [7.6, 8.8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const parca = (i: number) => {
    const bas = c(b, 6) + i * 0.3;
    const dustu = i === 2;
    return (
      <Gir key={i} bas={bas} son={bit(b, 6)} x={160} y={360 + i * 112}>
        <Kart w={560} pad="14px 24px" renk={dustu && gecti(f, m(b, 6, 0.5)) ? RENK.kirmizi : undefined}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={yazi(44, RENK.murekkep, "mono")}>kısa cümle {i + 1}</span>
            {dustu ? gecti(f, m(b, 6, 0.5)) && <Carpi bas={m(b, 6, 0.5)} boy={46} /> : <Tik bas={bas + 0.35} boy={46} />}
          </div>
        </Kart>
      </Gir>
    );
  };
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · EKRAN KARTI" />
      {/* 1–5 */}
      <Gir bas={c(b, 1)} son={bit(b, 5)} x={140} y={200}>
        <div style={{ transform: "scale(1.5)", transformOrigin: "0 0" }}>
          <EkranKarti f={f} gb={gb} w={760} etiket={gecti(f, c(b, 2))} donuyor={gecti(f, c(b, 5))} />
        </div>
      </Gir>
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={1400} y={230} w={440}>
        <Manset metin="Asıl dersi ekran kartı verdi." bas={c(b, 1)} boy={76} />
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={1400} y={260} w={440}>
        <div style={yazi(90)}>kartım:</div>
        <div style={yazi(130, RENK.kirmizi)}>8 GB</div>
      </Gir>
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={1400} y={260} w={440}>
        <div style={yazi(70)}>ses modeli tek başına</div>
        <div style={yazi(120, RENK.mavi)}>6,5 GB</div>
      </Gir>
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={1400} y={250} w={440}>
        <div style={yazi(70)}>+ uzun örnek</div>
      </Gir>
      <Gir bas={m(b, 4, 0.45)} son={bit(b, 4)} x={1400} y={350} w={440}>
        <div style={yazi(56)}>her cümlede hafızada</div>
      </Gir>
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={1400} y={250} w={440}>
        <div style={yazi(70, RENK.kirmizi)}>hafıza taşıyor</div>
      </Gir>
      <DamgaAt id={`${b}-durdu`} metin="DURDU" bas={m(b, 5, 0.65)} son={bit(b, 5)} x={1390} y={430} boy={96} aci={-10} />
      {/* 6: kısa tut, kaldığı yerden devam */}
      <Gir bas={c(b, 6)} son={bit(b, 6)} x={160} y={190} w={1600}>
        <Manset metin="Cümleleri kısa tut." bas={c(b, 6)} boy={100} />
      </Gir>
      {[0, 1, 2, 3, 4].map(parca)}
      <Ok x1={740} y1={640} x2={900} y2={600} egri={-0.3} bas={m(b, 6, 0.65)} son={bit(b, 6)} />
      <Gir bas={m(b, 6, 0.7)} son={bit(b, 6)} x={920} y={540} w={800}>
        <div style={yazi(72)}>düşerse kaldığı yerden devam</div>
      </Gir>
      {/* 7–8: iyi kayıt ← iyi kart */}
      <Gir bas={c(b, 7)} x={150} y={320} aci={-3}>
        <BiletB ust="KLON İÇİN" deger="iyi kayıt" seri="No. 14" w={300} degerBoy={66} />
      </Gir>
      <Ok x1={780} y1={480} x2={1030} y2={480} egri={-0.2} bas={c(b, 8)} />
      <Gir bas={m(b, 8, 0.3)} x={1060} y={320} aci={2}>
        <BiletB ust="İYİ KAYIT İÇİN" deger="iyi kart" seri="No. 14" w={300} degerBoy={66} />
      </Gir>
      <Gir bas={m(b, 8, 0.2)} x={160} y={250} w={1600}>
        <div style={{ ...yazi(40, RENK.murekkep, "sans"), letterSpacing: 4, opacity: 0.7 }}>KISACASI</div>
      </Gir>
    </>
  );
};

// =====================================================================================================
// 15 — Kart yoksa: hazır ses, bedava motor, kendi klonum (üç seçenek kartı).
// =====================================================================================================
const S15: FC = ({ b }) => {
  const f = useCurrentFrame();
  const sutun = (i: number, bas: number, no: number, icerik: React.ReactNode) => (
    <Gir bas={bas} x={150 + i * 560} y={300} w={520}>
      <Kart w={520} h={540} pad="22px 30px" kesik={!icerik}>
        <div style={yazi(80, RENK.kirmizi)}>{no}.</div>
        {icerik}
      </Kart>
    </Gir>
  );
  const satir = (bas: number, metin: React.ReactNode, boy = 44) => <div style={{ ...yazi(boy), marginTop: 14, opacity: gecti(f, bas) ? 1 : 0 }}>{metin}</div>;
  const kart1 = gecti(f, c(b, 3)) ? (
    <>
      <div style={yazi(58)}>Hazır yapay zekâ sesi</div>
      {satir(c(b, 4), "dakikası birkaç düzine kredi", 40)}
      <div style={{ marginTop: 18, opacity: gecti(f, m(b, 4, 0.4)) ? 1 : 0 }}>
        <Dalga tur="canli" w={440} h={90} f={f} />
      </div>
      {satir(m(b, 4, 0.7), "kaliteli · heyecanlı", 40)}
    </>
  ) : null;
  const kart2 = gecti(f, c(b, 5)) ? (
    <>
      <div style={yazi(58)}>Tamamen bedava</div>
      {satir(c(b, 6), "tarayıcının sesli okuma motoru", 40)}
      <div style={{ marginTop: 18, opacity: gecti(f, m(b, 7, 0.5)) ? 1 : 0 }}>
        <Dalga tur="duz" w={440} h={90} f={f} />
      </div>
      {satir(c(b, 7), "ücretsiz · kurulum yok · biraz robotik", 38)}
    </>
  ) : null;
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · SEÇENEKLER" />
      <Gir bas={c(b, 1)} son={bit(b, 7)} x={160} y={170} w={1600}>
        <Manset metin="Peki kartın yoksa?" bas={c(b, 1)} boy={96} />
      </Gir>
      <Gir bas={c(b, 8)} x={160} y={170} w={1600}>
        <Manset metin="Ben üçünü de kullandım." bas={c(b, 8)} boy={96} />
      </Gir>
      {sutun(0, c(b, 2), 1, kart1)}
      {sutun(1, m(b, 2, 0.35), 2, kart2)}
      {sutun(
        2,
        c(b, 8),
        3,
        <>
          <div style={yazi(58)}>Kendi klonum</div>
          <div style={{ marginTop: 30 }}>
            <Dalga tur="canli" w={440} h={90} f={f} renk={RENK.kirmizi} tohum="k" />
          </div>
          <div style={{ ...yazi(40), marginTop: 14 }}>benim sesim</div>
        </>,
      )}
      <DamgaAt id={`${b}-kisa`} metin="KISA VİDEO" bas={m(b, 9, 0.1)} x={170} y={850} boy={50} aci={-5} />
      <DamgaAt id={`${b}-uzun`} metin="UZUN VİDEO" bas={m(b, 9, 0.42)} x={1290} y={850} boy={50} aci={-5} />
      <DamgaAt id={`${b}-acele`} metin="ACELE" bas={m(b, 9, 0.75)} x={820} y={850} boy={50} aci={-5} />
    </>
  );
};

// =====================================================================================================
// 16 — Telaffuz paketi: Türkçe zor, 130+ kelime, ekranda/seste kuralı, rapor.
// =====================================================================================================
const S16: FC = ({ b }) => {
  const f = useCurrentFrame();
  const sorun = (i: number, bas: number, kelime: React.ReactNode, not: string) => (
    <Gir bas={bas} son={bit(b, 3)} x={160} y={210 + i * 240} w={1200}>
      <Kart w={1200} pad="24px 40px">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
          <span style={yazi(88)}>{kelime}</span>
          <span style={{ ...yazi(40, RENK.kirmizi, "sans"), textAlign: "right" }}>{not}</span>
        </div>
      </Kart>
    </Gir>
  );
  const n = say(f, c(b, 5), m(b, 5, 0.75), 130);
  const kutu = (i: number, bas: number, metin: string, vurgu?: boolean) => (
    <Gir bas={bas} x={160 + i * 360} y={740}>
      <Kart w={280} pad="16px 20px" renk={vurgu ? RENK.kirmizi : undefined} style={{ textAlign: "center" }}>
        <span style={yazi(48, vurgu ? RENK.kirmizi : RENK.murekkep, "mono")}>{metin}</span>
      </Kart>
    </Gir>
  );
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · TELAFFUZ" />
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={160} y={200} w={1100}>
        <Manset metin="Okunuş meselesine dönelim." bas={c(b, 1)} boy={96} />
      </Gir>
      <DaktiloAt bas={c(b, 1)} son={bit(b, 3)} x={1420} y={300} boy={380} konus={[[c(b, 1), cs(b, 1)]]} gozler={[[c(b, 2), "uzgun"]]} />
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={160} y={260} w={1150}>
        <div style={yazi(220)}>
          <AltIc bas={m(b, 2, 0.4)}>Türkçe</AltIc>
        </div>
        <div style={{ ...yazi(64), marginTop: 10 }}>yapay zekâ sesleri için zor bir dil</div>
      </Gir>
      {sorun(0, c(b, 3), <>a<DaireIc bas={c(b, 3) + 0.4} pay={10}>ğ</DaireIc>aç</>, "yumuşak g yutuluyor")}
      {sorun(1, m(b, 3, 0.35), "kısaltmalar", "harf harf okunmuyor")}
      {sorun(2, m(b, 3, 0.68), "yabancı marka adları", "Türkçe gibi okunuyor")}

      {/* 4–8: paket */}
      <Gir bas={c(b, 4)} x={160} y={190} w={1060}>
        <PencereB baslik="telaffuz-paketi" w={1060}>
          <div style={{ display: "flex", ...yazi(36, RENK.murekkep, "sans"), letterSpacing: 4, opacity: gecti(f, c(b, 6)) ? 1 : 0 }}>
            <span style={{ width: 540 }}>EKRANDA BÖYLE YAZ</span>
            <span style={{ color: RENK.mavi }}>SESTE BÖYLE OKU</span>
          </div>
          <div style={{ borderTop: `3px solid ${RENK.murekkep}`, margin: "10px 0 16px", opacity: gecti(f, c(b, 6)) ? 1 : 0 }} />
          <div style={{ display: "flex", ...yazi(56, RENK.murekkep, "mono"), opacity: gecti(f, m(b, 6, 0.3)) ? 1 : 0 }}>
            <span style={{ width: 540 }}>Claude</span>
            <span style={{ color: RENK.mavi }}>→ Klod</span>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", gap: 40, marginTop: 22, opacity: gecti(f, m(b, 6, 0.45 + i * 0.12)) ? 0.22 : 0 }}>
              <div style={{ width: 380, height: 18, background: RENK.murekkep, borderRadius: 9 }} />
              <div style={{ width: 300, height: 18, background: RENK.mavi, borderRadius: 9 }} />
            </div>
          ))}
        </PencereB>
      </Gir>
      <Gir bas={c(b, 5)} x={1320} y={200} aci={3}>
        <BiletB ust="SÖZLÜK" deger={n >= 130 ? "130+" : String(n)} seri="No. 16" w={230} degerBoy={72} />
      </Gir>
      <Gir bas={m(b, 5, 0.4)} x={1330} y={480} w={500}>
        <div style={yazi(56)}>kelime</div>
      </Gir>
      {kutu(0, c(b, 7), "metin")}
      <Ok x1={450} y1={790} x2={510} y2={790} egri={0} bas={m(b, 7, 0.2)} />
      {kutu(1, m(b, 7, 0.25), "sözlük", true)}
      <Ok x1={810} y1={790} x2={870} y2={790} egri={0} bas={m(b, 7, 0.5)} />
      {kutu(2, m(b, 7, 0.55), "ses")}
      <Gir bas={c(b, 8)} x={1260} y={560} w={600}>
        <PencereB baslik="rapor" w={580}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, ...yazi(44) }}>
            <Carpi bas={m(b, 8, 0.25)} boy={40} /> riskli kelimeler
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, ...yazi(44), marginTop: 14, opacity: gecti(f, m(b, 8, 0.55)) ? 1 : 0 }}>
            <Tik bas={m(b, 8, 0.6)} boy={40} /> düzeltilenler
          </div>
        </PencereB>
      </Gir>
    </>
  );
};

// =====================================================================================================
// 17 — Konuşma tanıma ile kontrol: "taslağı" ≠ "tasarı", yeniden üretim, 25 cümle.
// =====================================================================================================
const S17: FC = ({ b }) => {
  const f = useCurrentFrame();
  const kulak = ara(f, k(c(b, 2)), k(m(b, 2, 0.6)), Easing.out(Easing.quad));
  const satir = (i: number, bas: number) => (
    <Gir key={i} bas={bas} son={bit(b, 5)} x={160} y={340 + i * 110} w={1240}>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ width: 460, height: 20, background: RENK.murekkep, opacity: 0.2, borderRadius: 10 }} />
        <div style={{ width: 460, height: 20, background: RENK.mavi, opacity: 0.3, borderRadius: 10 }} />
        <Tik bas={bas + 0.3} boy={50} />
      </div>
    </Gir>
  );
  const n = say(f, c(b, 7) + 0.3, m(b, 7, 0.8), 25);
  return (
    <>
      <Kicker b={b} metin="İSTASYON 2 · KONTROL" />
      {/* 1–2: her cümle tek tek, kulakla değil */}
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={160} y={200} w={900}>
        <Manset metin="Her cümle, tek tek." bas={c(b, 1)} boy={100} />
      </Gir>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Gir key={i} bas={c(b, 1) + 0.2 + i * 0.25} son={bit(b, 2)} x={1180} y={180 + i * 128}>
          <Kart w={600} pad="12px 24px">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={yazi(44, RENK.murekkep, "mono")}>cümle {i + 1}</span>
              <Tik bas={m(b, 1, 0.3) + i * 0.3} boy={44} />
            </div>
          </Kart>
        </Gir>
      ))}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={240} y={260}>
        <svg width={360} height={460} viewBox="0 0 360 460" style={{ overflow: "visible" }}>
          <Yol d="M110 400 C150 430 200 410 205 360 C210 320 240 300 270 260 C320 190 300 60 190 40 C90 25 40 100 60 170" p={kulak} kalin={9} />
          <Yol d="M120 190 C110 130 160 100 200 120 C240 140 230 200 195 220 C170 235 175 270 160 290" p={kulak} kalin={7} />
          <Yol d="M20 30 L340 440" p={ara(f, k(m(b, 2, 0.5)), k(cs(b, 2)))} renk={RENK.kirmizi} kalin={14} />
        </svg>
      </Gir>
      <Gir bas={m(b, 2, 0.4)} son={bit(b, 2)} x={600} y={420} w={560}>
        <div style={yazi(84)}>kulakla değil</div>
      </Gir>
      {/* 3: konuşma tanıma: ses → yazı */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={140} y={340}>
        <DalgaKart tur="canli" w={500} h={150} etiket="SES" />
      </Gir>
      <Ok x1={670} y1={470} x2={760} y2={470} egri={0} bas={m(b, 3, 0.2)} son={bit(b, 3)} />
      <Gir bas={m(b, 3, 0.25)} son={bit(b, 3)} x={780} y={380}>
        <Kart w={380} pad="26px 24px" style={{ textAlign: "center" }}>
          <div style={yazi(46, RENK.murekkep, "sans")}>konuşma tanıma modeli</div>
        </Kart>
      </Gir>
      <Ok x1={1190} y1={470} x2={1280} y2={470} egri={0} bas={m(b, 3, 0.5)} son={bit(b, 3)} />
      <Gir bas={m(b, 3, 0.55)} son={bit(b, 3)} x={1300} y={360}>
        <Kart w={480} pad="26px 28px">
          <div style={{ ...yazi(36, RENK.murekkep, "sans"), letterSpacing: 3, marginBottom: 14 }}>YAZI</div>
          {[1, 0.8, 0.9].map((w, i) => (
            <div key={i} style={{ height: 14, width: `${w * ara(f, k(m(b, 3, 0.6) + i * 0.3), k(m(b, 3, 0.6) + i * 0.3 + 0.4)) * 100}%`, background: RENK.murekkep, opacity: 0.3, borderRadius: 7, marginBottom: 22 }} />
          ))}
        </Kart>
      </Gir>
      {/* 4–5: metnim vs duyulan */}
      <Gir bas={c(b, 4)} son={bit(b, 5)} x={160} y={200} w={1240}>
        <div style={{ display: "flex", gap: 40 }}>
          <div style={{ width: 460, ...yazi(44, RENK.murekkep, "sans"), letterSpacing: 4 }}>METNİM</div>
          <div style={{ width: 460, ...yazi(44, RENK.mavi, "sans"), letterSpacing: 4 }}>DUYULAN</div>
        </div>
        <div style={{ borderTop: `3px solid ${RENK.murekkep}`, marginTop: 14, width: 1060 }} />
      </Gir>
      {[0, 1, 2].map((i) => satir(i, c(b, 4) + 0.2 + i * 0.35))}
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={160} y={672} w={1300}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <span style={{ width: 460, ...yazi(72, RENK.murekkep, "mono") }}>taslağı</span>
          <span style={{ width: 460, ...yazi(72, RENK.kirmizi, "mono") }}>
            {gecti(f, m(b, 5, 0.35)) ? <DaireIc bas={m(b, 5, 0.45)}>tasarı</DaireIc> : null}
          </span>
          {gecti(f, m(b, 5, 0.5)) && <Carpi bas={m(b, 5, 0.5)} boy={60} />}
        </div>
      </Gir>
      <DamgaAt id={`${b}-isaret`} metin="İŞARETLENDİ" bas={m(b, 5, 0.7)} son={bit(b, 5)} x={1240} y={790} boy={58} aci={-12} />
      {/* 6: yeniden üretim, daha iyisi seçilir */}
      <Gir bas={c(b, 6)} son={bit(b, 6)} x={160} y={190} w={1600}>
        <Manset metin="Farklı rastgelelikle yeniden üret, iyisini seç." bas={c(b, 6)} boy={76} />
      </Gir>
      <Gir bas={m(b, 6, 0.15)} son={bit(b, 6)} x={160} y={400}>
        <DalgaKart tur="burun" w={700} h={170} etiket="İLK ÜRETİM" tohum="1" />
      </Gir>
      <Gir bas={m(b, 6, 0.35)} son={bit(b, 6)} x={960} y={400}>
        <DalgaKart tur="canli" w={700} h={170} etiket="YENİ ÜRETİM" tohum="2" />
      </Gir>
      <DamgaAt id={`${b}-secildi`} metin="SEÇİLDİ" bas={m(b, 6, 0.7)} son={bit(b, 6)} x={1100} y={700} boy={90} aci={-7} />
      {/* 7: 17 dakikada 25 cümle */}
      <Gir bas={c(b, 7)} x={150} y={250} aci={-3}>
        <BiletB ust="17 DAKİKALIK VİDEO" deger={String(n)} seri="No. 17" w={380} degerBoy={110} degerRenk={RENK.kirmizi} />
      </Gir>
      <Gir bas={m(b, 7, 0.2)} x={960} y={290} w={860}>
        <div style={yazi(84)}>yanlış okunan cümle, böyle yakalandı</div>
      </Gir>
      <DamgaAt id={`${b}-yakaladi`} metin="YAKALANDI" bas={m(b, 7, 0.82)} x={980} y={620} boy={100} aci={-8} />
    </>
  );
};

export const SAHNELER_B: Record<number, React.FC<{ b: number }>> = {
  ...yerTutucular(8, 17),
  8: S8,
  9: S9,
  10: S10,
  11: S11,
  12: S12,
  13: S13,
  14: S14,
  15: S15,
  16: S16,
  17: S17,
};

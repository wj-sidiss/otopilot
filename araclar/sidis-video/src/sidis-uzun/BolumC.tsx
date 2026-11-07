// Kısım C — "III · Zaman, görüntü, kontrol" (bölüm 18–30).
// Her ipucu zaman.json'dan (bölüm, cümle) ile okunur; cümle içindeki kelimeler kel() ile cümlenin süresine
// harf oranıyla yayılır (gerçek ses gelince zaman.json yenilenir, hepsi kendiliğinden kayar). Sabit saniye yok.
// Gerçek ekran: renders/sidis-uzun/pub/kare/NN (claude.ai kırpılmış kareler); pilot Short kareleri: pub/c/kontrol/NN.png.
import React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import {
  AltCizgi, Balon, Bilet, Daire, Daktilo, DaktiloYazi, Dalga, Damga, Ekran, FPS, GercekRozet, Gir, KARE_SAYISI, MONO, Manset, Ok, Pencere, RENK, SANS, SERIF,
  UstunuCiz, WJ, ara, c, cikis, cum, cumleSayisi, cs, giris, k, kareYolu, yerTutucular,
} from "./Ortak";

type Sc = React.FC<{ b: number }>;

// ---------------------------------------------------------------- yardımcılar (yalnız bu dosya)
/** b. bölüm n. cümledeki `kelime`nin (kac. geçiş) tahmini başlangıç saniyesi: cümle süresi harf oranıyla bölünür */
const kel = (b: number, n: number, kelime: string, kac = 1) => {
  const C = cum(b, n);
  const m = C.metin.toLocaleLowerCase("tr");
  const h = kelime.toLocaleLowerCase("tr");
  let i = -1;
  for (let j = 0; j < kac; j++) {
    const yeni = m.indexOf(h, i + 1);
    if (yeni < 0) break;
    i = yeni;
  }
  if (i < 0) return C.bas;
  return C.bas + (i / m.length) * (C.son - C.bas);
};
/** n. cümleden başlayan bir vuruşun bitişi: bir sonraki cümleden hemen önce; son cümlede sayfa sonuna kadar kalır */
const bit = (b: number, n: number) => (n >= cumleSayisi(b) ? undefined : c(b, n + 1) - 0.2);

/** Bilet'in iç etiketleri 17–18px; CSS zoom ile büyütülür ki etiketler ≥34px okunsun. w/degerBoy GÖRÜNEN boyuttur. */
const BiletC: React.FC<{ ust: string; deger: string; seri: string; w: number; degerBoy?: number; olcek?: number }> = ({ ust, deger, seri, w, degerBoy = 92, olcek = 1.9 }) => (
  <div style={{ zoom: olcek } as React.CSSProperties}>
    <Bilet ust={ust} deger={deger} seri={seri} w={w / olcek} degerBoy={degerBoy / olcek} />
  </div>
);

/** sol üstte kırmızı küçük başlık */
const Ust: React.FC<{ metin: string; bas: number }> = ({ metin, bas }) => (
  <Gir bas={bas} x={120} y={112}>
    <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.kirmizi, letterSpacing: 3, whiteSpace: "nowrap" }}>{metin}</div>
  </Gir>
);

/** satır içi kırmızı işaret: üstünü çiz / daire / altını çiz; kutuya göre ölçeklenir */
const Isaretli: React.FC<{ tur: "ciz" | "daire" | "alt"; bas: number; sure?: number; renk?: string; kalin?: number; children: React.ReactNode }> = ({
  tur, bas, sure = 0.4, renk = RENK.kirmizi, kalin = 7, children,
}) => {
  const f = useCurrentFrame();
  const p = ara(f, k(bas), k(bas + sure), Easing.out(Easing.quad));
  const gor = f >= k(bas) - 1;
  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 1.1 }}>
      {children}
      {gor && tur !== "daire" && (
        <span style={{ position: "absolute", left: "-3%", width: "106%", top: tur === "ciz" ? "52%" : "100%", height: kalin, marginTop: tur === "ciz" ? -kalin / 2 : -kalin, background: renk, borderRadius: kalin, transform: `rotate(${tur === "ciz" ? -2 : 0.6}deg) scaleX(${p})`, transformOrigin: "0% 50%", pointerEvents: "none" }} />
      )}
      {gor && tur === "daire" && (
        <span style={{ position: "absolute", left: "-8%", top: "-6%", width: "116%", height: "116%", border: `${kalin}px solid ${renk}`, borderRadius: "50%", boxSizing: "border-box", transform: "rotate(-4deg)", WebkitMaskImage: `conic-gradient(from 200deg, #000 ${p * 360}deg, transparent 0)`, maskImage: `conic-gradient(from 200deg, #000 ${p * 360}deg, transparent 0)`, pointerEvents: "none" }} />
      )}
    </span>
  );
};

/** kırmızı el yazısı not */
const Not: React.FC<{ children: React.ReactNode; boy?: number; renk?: string }> = ({ children, boy = 46, renk = RENK.kirmizi }) => (
  <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: boy, color: renk, lineHeight: 1.05, whiteSpace: "nowrap" }}>{children}</div>
);

/** düz metin bloğu */
const Metin: React.FC<{ children: React.ReactNode; boy?: number; renk?: string; font?: string; hiza?: "left" | "center" }> = ({ children, boy = 56, renk = RENK.murekkep, font = SERIF, hiza = "left" }) => (
  <div style={{ fontFamily: font, fontSize: boy, color: renk, lineHeight: 1.12, textAlign: hiza, fontWeight: font === SANS ? 600 : 400 }}>{children}</div>
);

/** kâğıt kart çerçevesi */
const Kart: React.FC<{ w?: number; h?: number; children: React.ReactNode; pad?: number; arka?: string }> = ({ w, h, children, pad = 24, arka = RENK.kagitAcik }) => (
  <div style={{ width: w, height: h, boxSizing: "border-box", padding: pad, background: arka, border: `4px solid ${RENK.murekkep}`, borderRadius: 10, boxShadow: "6px 8px 0 rgba(27,26,23,0.14)", position: "relative" }}>{children}</div>
);

/** damgayı saniyeyle indir */
const DamgaS: React.FC<{ id: string; metin: string; bas: number; boy?: number; aci?: number; renk?: string }> = ({ id, metin, bas, boy = 84, aci = -8, renk }) => {
  const f = useCurrentFrame();
  return <Damga id={id} metin={metin} yas={f - k(bas)} boy={boy} aci={aci} renk={renk} />;
};

/** yayla gelen 0..1 */
const yay = (f: number, bas: number) => spring({ frame: f - k(bas), fps: FPS, config: { damping: 15, stiffness: 150, mass: 0.7 } });

/** pilot Short'un küçük karesi (270×480) */
const pilot = (i: number) => staticFile(`c/kontrol/${String(i).padStart(2, "0")}.png`);

// ---------------------------------------------------------------- çizimler (mürekkep çizgisi)
const Makara: React.FC<{ boy: number; f: number; donus?: number; etiket?: string }> = ({ boy, f, donus = 1, etiket }) => (
  <svg width={boy} height={boy} viewBox="0 0 200 200" style={{ overflow: "visible", display: "block" }}>
    <g transform={`rotate(${f * 1.5 * donus} 100 100)`}>
      <circle cx={100} cy={100} r={92} fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={6} />
      <circle cx={100} cy={100} r={60} fill="none" stroke={RENK.murekkep} strokeWidth={2} opacity={0.4} />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 5;
        return <circle key={i} cx={100 + Math.cos(a) * 52} cy={100 + Math.sin(a) * 52} r={20} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} />;
      })}
      <circle cx={100} cy={100} r={12} fill={RENK.murekkep} />
    </g>
    {etiket && (
      <text x={100} y={240} textAnchor="middle" fontFamily={SERIF} fontSize={44} fill={RENK.murekkep}>{etiket}</text>
    )}
  </svg>
);

const Makas: React.FC<{ boy: number; acik: number }> = ({ boy, acik }) => (
  <svg width={boy} height={boy * 0.7} viewBox="0 0 200 140" style={{ overflow: "visible", display: "block" }}>
    <g transform={`rotate(${-acik * 14} 110 70)`}>
      <path d="M110 70 L196 56 L198 62 Z" fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} strokeLinejoin="round" />
      <ellipse cx={46} cy={40} rx={34} ry={24} fill="none" stroke={RENK.murekkep} strokeWidth={8} />
      <line x1={74} y1={50} x2={110} y2={70} stroke={RENK.murekkep} strokeWidth={10} strokeLinecap="round" />
    </g>
    <g transform={`rotate(${acik * 14} 110 70)`}>
      <path d="M110 70 L196 84 L198 78 Z" fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} strokeLinejoin="round" />
      <ellipse cx={46} cy={100} rx={34} ry={24} fill="none" stroke={RENK.murekkep} strokeWidth={8} />
      <line x1={74} y1={90} x2={110} y2={70} stroke={RENK.murekkep} strokeWidth={10} strokeLinecap="round" />
    </g>
    <circle cx={110} cy={70} r={7} fill={RENK.kirmizi} />
  </svg>
);

const Saat: React.FC<{ boy: number; f: number; hiz: number }> = ({ boy, f, hiz }) => (
  <svg width={boy} height={boy} viewBox="0 0 200 200" style={{ display: "block", overflow: "visible" }}>
    <circle cx={100} cy={100} r={90} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={7} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return <line key={i} x1={100 + Math.cos(a) * 70} y1={100 + Math.sin(a) * 70} x2={100 + Math.cos(a) * 82} y2={100 + Math.sin(a) * 82} stroke={RENK.murekkep} strokeWidth={i % 3 === 0 ? 6 : 3} />;
    })}
    <line x1={100} y1={100} x2={100} y2={42} stroke={RENK.murekkep} strokeWidth={6} strokeLinecap="round" transform={`rotate(${f * hiz} 100 100)`} />
    <line x1={100} y1={100} x2={100} y2={60} stroke={RENK.kirmizi} strokeWidth={8} strokeLinecap="round" transform={`rotate(${(f * hiz) / 12} 100 100)`} />
    <circle cx={100} cy={100} r={8} fill={RENK.murekkep} />
    <rect x={88} y={-6} width={24} height={14} rx={3} fill={RENK.murekkep} />
  </svg>
);

/** küçük gazete sayfası (stil örneği) */
const Sayfacik: React.FC<{ w: number; varyant?: number; ortalama?: boolean }> = ({ w, varyant = 0, ortalama }) => {
  const h = w * 1.3;
  if (ortalama) {
    // rehbersiz: her biri başka bir "ortalama" görünüm (gri, yuvarlak, gölgeli)
    const r = [28, 4, 60][varyant % 3];
    const fnt = [SANS, MONO, SANS][varyant % 3];
    return (
      <div style={{ width: w, height: h, borderRadius: r, background: ["#d9d9de", "#e4e0d8", "#d4dbe3"][varyant % 3], border: "3px solid #9a9aa0", boxShadow: "0 12px 26px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ width: w * 0.42, height: w * 0.42, borderRadius: [w, 8, w * 0.1][varyant % 3], background: "#a7a8b0" }} />
        <div style={{ fontFamily: fnt, fontSize: 34, color: "#77787f" }}>ortalama</div>
      </div>
    );
  }
  return (
    <div style={{ width: w, height: h, background: RENK.kagit, border: `4px solid ${RENK.murekkep}`, borderRadius: 4, boxShadow: "6px 8px 0 rgba(27,26,23,0.14)", padding: 16, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
      <div style={{ fontFamily: SERIF, fontSize: 38, color: RENK.murekkep, lineHeight: 1, borderBottom: `3px solid ${RENK.murekkep}`, paddingBottom: 6 }}>Defter</div>
      {[0.9, 0.7, 0.82, 0.55].map((x, i) => (
        <div key={i} style={{ height: 8, width: `${x * 100}%`, background: RENK.murekkep, opacity: 0.55, marginTop: 14 }} />
      ))}
      <div style={{ position: "absolute", right: 14, bottom: 16, padding: "2px 10px", border: `4px solid ${RENK.kirmizi}`, color: RENK.kirmizi, fontFamily: SANS, fontWeight: 900, fontSize: 34, transform: `rotate(${-8 + varyant * 3}deg)` }}>W.J.</div>
    </div>
  );
};

/** zaman cetveli: cümlenin kelimeleri harf oranıyla dizilir, kırmızı oynatma çizgisi sesle ilerler,
 *  `hedef` kelimeye gelince üstüne iğneli bir öğe (children) düşer */
const Cetvel: React.FC<{ b: number; n: number; hedef: string; x: number; y: number; w: number; son?: number; children: React.ReactNode }> = ({ b, n, hedef, x, y, w, son, children }) => {
  const f = useCurrentFrame();
  const C = cum(b, n);
  const metin = C.metin;
  const kelimeler: { s: string; i: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(metin))) kelimeler.push({ s: m[0], i: m.index });
  const L = metin.length;
  const p = ara(f, k(C.bas), k(C.son));
  const hi = metin.toLocaleLowerCase("tr").indexOf(hedef.toLocaleLowerCase("tr"));
  const hx = (Math.max(0, hi) / L) * w;
  const hBas = kel(b, n, hedef);
  const dus = yay(f, hBas);
  return (
    <Gir bas={C.bas - 0.15} son={son} x={x} y={y} w={w}>
      <div style={{ position: "relative", width: w, height: 330 }}>
        {/* iğne + öğe */}
        {f >= k(hBas) - 1 && (
          <>
            <div style={{ position: "absolute", left: hx + 4, top: 150, width: 4, height: 92 * dus, background: RENK.kirmizi }} />
            <div style={{ position: "absolute", left: hx - 6, top: 238, width: 24, height: 24, borderRadius: 12, background: RENK.kirmizi }} />
            <div style={{ position: "absolute", left: hx - 30, top: 0, opacity: Math.min(1, dus * 1.5), transform: `translateY(${(1 - dus) * -60}px)` }}>{children}</div>
          </>
        )}
        {/* kelimeler */}
        {kelimeler.map((kk, j) => (
          <div key={j} style={{ position: "absolute", left: (kk.i / L) * w, top: 196, fontFamily: MONO, fontSize: 34, whiteSpace: "nowrap", color: kk.i === hi ? RENK.kirmizi : RENK.murekkep, opacity: kk.i / L <= p + 0.001 ? 1 : 0.3, fontWeight: kk.i === hi ? 700 : 400 }}>
            {kk.s}
          </div>
        ))}
        {/* cetvel */}
        <div style={{ position: "absolute", left: 0, top: 260, width: w, height: 4, background: RENK.murekkep }} />
        {Array.from({ length: 41 }, (_, j) => (
          <div key={j} style={{ position: "absolute", left: (j / 40) * w, top: 260, width: 3, height: j % 5 === 0 ? 30 : 16, background: RENK.murekkep, opacity: 0.8 }} />
        ))}
        <div style={{ position: "absolute", left: 0, top: 296, fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.murekkep, opacity: 0.6 }}>ses →</div>
        {/* oynatma çizgisi */}
        <div style={{ position: "absolute", left: p * w - 2, top: 180, width: 5, height: 120, background: RENK.kirmizi, opacity: 0.85 }} />
        <div style={{ position: "absolute", left: p * w - 12, top: 168, width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: `16px solid ${RENK.kirmizi}` }} />
      </div>
    </Gir>
  );
};

/** kelime fişi: kelime + altında baş/son çentikli çubuk */
const Fis: React.FC<{ kelime: string; f: number; bas: number; w: number }> = ({ kelime, f, bas, w }) => {
  const p = ara(f, k(bas), k(bas + 0.5), Easing.out(Easing.cubic));
  return (
    <div style={{ width: w }}>
      <div style={{ display: "inline-block", padding: "6px 16px", border: `3px solid ${RENK.murekkep}`, borderRadius: 6, background: RENK.kagitAcik, fontFamily: MONO, fontSize: 38, color: RENK.murekkep }}>{kelime}</div>
      <div style={{ position: "relative", height: 88, marginTop: 10 }}>
        <div style={{ position: "absolute", left: 0, top: 14, width: (w - 20) * p, height: 10, background: RENK.mavi, borderRadius: 5 }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 5, height: 38, background: RENK.kirmizi }} />
        <div style={{ position: "absolute", left: (w - 20) * p, top: 0, width: 5, height: 38, background: RENK.kirmizi, opacity: p }} />
        <div style={{ position: "absolute", left: 0, top: 36, fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.kirmizi, opacity: 0.85, whiteSpace: "nowrap" }}>baş · son</div>
      </div>
    </div>
  );
};

// ================================================================ 18 — Üçüncü istasyon: zamanlama
const S18: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s5 = c(b, 5);
  const kay = ara(f, k(kel(b, 5, "kayarsa")), k(kel(b, 5, "kayarsa") + 0.6), Easing.inOut(Easing.cubic));
  return (
    <>
      <Ust metin="III · İSTASYON 3" bas={giris(b)} />
      <Gir bas={c(b, 1)} x={120} y={166} w={1300}>
        <Manset metin="Üçüncü istasyon: zamanlama." bas={c(b, 1)} boy={92} />
      </Gir>
      <Gir bas={kel(b, 1, "zamanlama")} x={1440} y={120} aci={4}>
        <BiletC ust="İSTASYON" deger="3" seri="№ 3" w={420} degerBoy={110} />
      </Gir>
      <Gir bas={kel(b, 1, "zamanlama")} son={bit(b, 1)} x={120} y={480} w={1680}>
        <Dalga tur="canli" w={1680} h={220} f={f} tohum="s18" cubuk={70} />
      </Gir>

      {/* 2: görünmez ama kazandıran */}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={120} y={380} w={1700}>
        <div style={{ fontFamily: SERIF, fontSize: 200, lineHeight: 1, color: "transparent", WebkitTextStroke: `3px ${RENK.murekkep}`, opacity: 0.45, letterSpacing: 8 }}>görünmez</div>
        <div style={{ marginTop: 40 }}>
          <Metin boy={80}>
            ama videoyu <Isaretli tur="alt" bas={kel(b, 2, "kazandıran")} sure={0.5}>kazandıran</Isaretli> kısım bu.
          </Metin>
        </div>
      </Gir>
      <Gir bas={kel(b, 2, "kazandıran")} son={bit(b, 2)} x={1450} y={430}>
        <WJ poz="gosteren" yas={f - k(kel(b, 2, "kazandıran"))} f={f} boy={480} />
      </Gir>

      {/* 3: yazı tam o kelimede */}
      <Cetvel b={b} n={3} hedef="kelime" x={140} y={420} w={1640} son={bit(b, 3)}>
        <Kart pad={14}>
          <div style={{ fontFamily: SERIF, fontSize: 64, lineHeight: 1, color: RENK.murekkep, whiteSpace: "nowrap" }}>YAZI</div>
        </Kart>
      </Cetvel>
      <Gir bas={kel(b, 3, "gelmeli")} son={bit(b, 3)} x={1200} y={300}>
        <Not boy={52}>tam o kelimede</Not>
      </Gir>

      {/* 4: damga tam o kelimede */}
      <Cetvel b={b} n={4} hedef="kelimede" x={140} y={420} w={1640} son={bit(b, 4)}>
        <div style={{ marginLeft: -80, marginTop: -10 }}>
          <DamgaS id="c18" metin="TAM O KELİMEDE" bas={kel(b, 4, "kelimede")} boy={52} aci={-6} />
        </div>
      </Cetvel>

      {/* 5: yarım saniye kayarsa */}
      <Gir bas={s5} x={120} y={330} w={1200}>
        <svg width={1200} height={520} viewBox="0 0 1200 520" style={{ overflow: "visible" }}>
          <text x={0} y={60} fontFamily={SANS} fontWeight={600} fontSize={36} fill={RENK.murekkep}>kelime</text>
          <line x1={0} y1={150} x2={1150} y2={150} stroke={RENK.murekkep} strokeWidth={4} />
          <rect x={480} y={88} width={180} height={62} fill={RENK.mavi} opacity={0.85} rx={6} />
          <text x={570} y={132} textAnchor="middle" fontFamily={MONO} fontSize={36} fill={RENK.kagitAcik}>"söz"</text>

          <text x={0} y={260} fontFamily={SANS} fontWeight={600} fontSize={36} fill={RENK.murekkep}>yazı</text>
          <line x1={0} y1={350} x2={1150} y2={350} stroke={RENK.murekkep} strokeWidth={4} />
          <g transform={`translate(${kay * 150} 0)`}>
            <rect x={480} y={288} width={180} height={62} fill={kay > 0.5 ? RENK.kirmizi : RENK.murekkep} rx={6} />
            <text x={570} y={332} textAnchor="middle" fontFamily={MONO} fontSize={36} fill={RENK.kagitAcik}>YAZI</text>
          </g>
          <line x1={480} y1={160} x2={480} y2={420} stroke={RENK.murekkep} strokeWidth={3} strokeDasharray="10 8" />
          {kay > 0 && (
            <g opacity={kay}>
              <path d={`M480 440 L480 460 L${480 + 150 * kay} 460 L${480 + 150 * kay} 440`} fill="none" stroke={RENK.kirmizi} strokeWidth={5} />
              <text x={480 + 75} y={510} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={46} fill={RENK.kirmizi}>yarım saniye</text>
            </g>
          )}
        </svg>
      </Gir>
      <Gir bas={kel(b, 5, "ters")} x={1430} y={380}>
        <WJ poz="saskin" yas={f - k(kel(b, 5, "ters"))} f={f} boy={500} />
      </Gir>
      <Gir bas={kel(b, 5, "hisseder")} x={130} y={880}>
        <Not boy={48}>neyin yanlış olduğunu bilmez — ama hisseder</Not>
      </Gir>
    </>
  );
};

// ================================================================ 19 — her kelimenin zamanı
const S19: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s6 = c(b, 6);
  const tasin = ara(f, k(kel(b, 6, "ayarlıyor")), k(kel(b, 6, "ayarlıyor") + 0.7), Easing.inOut(Easing.cubic));
  const kelimeler1 = ["her", "kelimenin", "zamanını", "çıkarıyorum"];
  return (
    <>
      <Ust metin="ZAMANLAMA · KELİME KELİME" bas={giris(b)} />
      <Gir bas={c(b, 1)} x={120} y={166} w={1700}>
        <Manset metin="Her kelimenin bir zamanı var." bas={c(b, 1)} boy={84} />
      </Gir>

      {/* 1: kelime fişleri */}
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={140} y={440} w={1700}>
        <div style={{ display: "flex", gap: 30 }}>
          {kelimeler1.map((w, i) => (
            <Fis key={w} kelime={w} f={f} bas={kel(b, 1, w)} w={i === 3 ? 400 : 360} />
          ))}
        </div>
      </Gir>

      {/* 2: ses → model → kelime zamanları */}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={120} y={400} w={460}>
        <Dalga tur="canli" w={440} h={180} f={f} />
        <div style={{ marginTop: 16 }}>
          <Metin boy={44} font={SANS}>ses kaydı</Metin>
        </div>
      </Gir>
      <Ok x1={590} y1={490} x2={690} y2={490} egri={0} bas={kel(b, 2, "konuşma")} son={bit(b, 2)} />
      <Gir bas={kel(b, 2, "konuşma")} son={bit(b, 2)} x={710} y={370} w={520}>
        <Pencere baslik="model" w={520}>
          <Metin boy={52}>konuşma tanıma modeli</Metin>
        </Pencere>
      </Gir>
      <Ok x1={1245} y1={490} x2={1340} y2={490} egri={0} bas={kel(b, 2, "model", 2)} son={bit(b, 2)} />
      <Gir bas={kel(b, 2, "başladığı")} son={bit(b, 2)} x={1360} y={340} w={460}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {["ses", "kayıttan", "konuşma"].map((w, i) => (
            <Fis key={w} kelime={w} f={f} bas={kel(b, 2, "başladığı") + i * 0.35} w={420} />
          ))}
        </div>
      </Gir>

      {/* 3: saniyeye değil kelimeye */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={120} y={440} w={1680}>
        <Metin boy={124} hiza="center">
          <Isaretli tur="ciz" bas={kel(b, 3, "değil")}>saniyeye</Isaretli> değil,{" "}
          <span style={{ color: RENK.kirmizi }}>
            <Isaretli tur="daire" bas={kel(b, 3, "kelimeye")} sure={0.55}>kelimeye</Isaretli>
          </span>{" "}
          bağlı.
        </Metin>
      </Gir>

      {/* 4–5: yanlış ve doğru komut */}
      <Gir bas={c(b, 4)} son={s6 - 0.2} x={220} y={360} w={1480}>
        <Pencere baslik="sahne planı" w={1480}>
          <div style={{ fontFamily: MONO, fontSize: 48, color: RENK.murekkep, lineHeight: 1.6 }}>
            <Isaretli tur="ciz" bas={kel(b, 4, "demiyorum")}>yazı → onuncu saniyede gelsin</Isaretli>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 48, color: RENK.murekkep, lineHeight: 1.6, opacity: f >= k(c(b, 5)) ? 1 : 0 }}>
            {f >= k(c(b, 5)) && <DaktiloYazi metin={'yazı → "olmamış" kelimesinde gelsin'} ilerleme={ara(f, k(c(b, 5)), k(c(b, 5) + 1.4))} f={f} boy={48} />}
          </div>
        </Pencere>
      </Gir>
      <Gir bas={kel(b, 5, "olmamış")} son={s6 - 0.2} x={1130} y={700}>
        <DamgaS id="c19" metin="OLMAMIŞ" bas={kel(b, 5, "olmamış")} boy={84} aci={-7} />
      </Gir>

      {/* 6: ses değişir, iğne kendini ayarlar */}
      <Gir bas={s6} x={120} y={330} w={1700}>
        <div style={{ position: "relative", width: 1700, height: 620 }}>
          <div style={{ position: "absolute", left: 0, top: 120, fontFamily: SANS, fontWeight: 600, fontSize: 36, color: RENK.murekkep }}>eski ses</div>
          <div style={{ position: "absolute", left: 240, top: 80 }}>
            <Dalga tur="canli" w={1000} h={130} f={f} tohum="eski" />
          </div>
          <div style={{ position: "absolute", left: 0, top: 440, fontFamily: SANS, fontWeight: 600, fontSize: 36, color: RENK.murekkep, opacity: f >= k(kel(b, 6, "değiştirsem")) ? 1 : 0.2 }}>yeni ses</div>
          <div style={{ position: "absolute", left: 240, top: 400, opacity: f >= k(kel(b, 6, "değiştirsem")) ? 1 : 0.15 }}>
            <Dalga tur="canli" w={1400} h={130} f={f} tohum="yeni" renk={RENK.kirmizi} />
          </div>
          {/* "olmamış" kelimesinin yeri: eski 640, yeni 800 */}
          <div style={{ position: "absolute", left: 640, top: 60, width: 4, height: 170, background: RENK.murekkep, opacity: 0.5 }} />
          <div style={{ position: "absolute", left: 800, top: 380, width: 4, height: 170, background: RENK.kirmizi, opacity: 0.6 }} />
          <div style={{ position: "absolute", left: interpolate(tasin, [0, 1], [560, 720]), top: interpolate(tasin, [0, 1], [-20, 300]), padding: "4px 14px", border: `4px solid ${RENK.kirmizi}`, background: RENK.kagitAcik, color: RENK.kirmizi, fontFamily: SANS, fontWeight: 900, fontSize: 40, transform: "rotate(-4deg)" }}>OLMAMIŞ</div>
        </div>
      </Gir>
      <Gir bas={kel(b, 6, "ayarlıyor")} x={1100} y={900}>
        <Not boy={50}>kendini yeni sese ayarlıyor</Not>
      </Gir>
    </>
  );
};

// ================================================================ 20 — ses değişimi hikâyesi
const S20: Sc = ({ b }) => {
  const f = useCurrentFrame();
  // 5–6: makas sesi cümlelere böler, parçalar yerine oturur
  const s5 = c(b, 5);
  const kes0 = kel(b, 5, "yeni");
  const kes1 = kel(b, 5, "kestim");
  const otur = kel(b, 5, "oturttum");
  const makasP = ara(f, k(kes0), k(kes1 + 0.6));
  const parcalar = [
    { w: 260, slot: 300 },
    { w: 330, slot: 340 },
    { w: 240, slot: 280 },
    { w: 360, slot: 300 }, // sığmayan
    { w: 200, slot: 240 },
  ];
  const yeniX: number[] = [];
  const slotX: number[] = [];
  let ax = 0;
  let sx = 0;
  for (const p of parcalar) {
    yeniX.push(ax);
    slotX.push(sx);
    ax += p.w;
    sx += p.slot + 0;
  }
  const hizlan = ara(f, k(c(b, 6)), k(c(b, 6) + 0.9), Easing.inOut(Easing.cubic));
  return (
    <>
      <Ust metin="ZAMANLAMA · BİR ÖRNEK" bas={giris(b)} />
      <Gir bas={c(b, 1)} x={120} y={166} w={1700}>
        <Manset metin="Ne kazandırdı? Bir örnek." bas={c(b, 1)} boy={84} />
      </Gir>

      {/* 2: iki uzun video, yarım saat */}
      <Gir bas={kel(b, 2, "iki")} son={bit(b, 2)} x={180} y={360}>
        <Makara boy={300} f={f} etiket="video 1" />
      </Gir>
      <Gir bas={kel(b, 2, "uzun")} son={bit(b, 2)} x={600} y={360}>
        <Makara boy={300} f={f} donus={-1} etiket="video 2" />
      </Gir>
      <Gir bas={kel(b, 2, "toplam")} son={bit(b, 2)} x={1120} y={420} aci={-3}>
        <BiletC ust="TOPLAM" deger="yarım saat" seri="№ 20" w={560} degerBoy={84} />
      </Gir>

      {/* 3: sesi beğenmedim */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={120} y={460} w={1100}>
        <Dalga tur="duz" w={1000} h={200} f={f} cubuk={60} />
        <div style={{ marginTop: 10 }}>
          <Metin boy={44} font={SANS}>eski ses</Metin>
        </div>
      </Gir>
      <Gir bas={kel(b, 3, "beğenmedim")} son={bit(b, 3)} x={300} y={470}>
        <DamgaS id="c20a" metin="BEĞENMEDİM" bas={kel(b, 3, "beğenmedim")} boy={80} aci={-6} />
      </Gir>
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={1420} y={380}>
        <WJ poz="dusunen" yas={f - k(c(b, 3))} f={f} boy={520} />
      </Gir>

      {/* 4: normalde baştan render, saatlerce */}
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={160} y={360}>
        <Saat boy={380} f={f} hiz={f >= k(kel(b, 4, "saatlerce")) ? 40 : 6} />
      </Gir>
      <Gir bas={kel(b, 4, "render")} son={bit(b, 4)} x={680} y={400} w={1100}>
        <Metin boy={66}>bütün videoyu baştan render</Metin>
        <div style={{ marginTop: 30, width: 1000, height: 54, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.kagitAcik, overflow: "hidden" }}>
          <div style={{ width: `${3 + ara(f, k(kel(b, 4, "render")), k(cs(b, 4))) * 9}%`, height: "100%", background: RENK.mavi }} />
        </div>
        <div style={{ marginTop: 40 }}>
          <Metin boy={66}>
            yani <Isaretli tur="alt" bas={kel(b, 4, "saatlerce")}>saatlerce</Isaretli> beklemek
          </Metin>
        </div>
      </Gir>

      {/* 5–6: makas */}
      <Gir bas={s5} son={bit(b, 6)} x={160} y={330} w={1600}>
        <div style={{ position: "relative", width: 1600, height: 620 }}>
          <div style={{ position: "absolute", left: 0, top: 0, fontFamily: SANS, fontWeight: 600, fontSize: 36, color: RENK.kirmizi, opacity: 1 - ara(f, k(otur), k(otur) + 10) }}>yeni ses</div>
          <div style={{ position: "absolute", left: 0, top: 360, fontFamily: SANS, fontWeight: 600, fontSize: 36, color: RENK.murekkep }}>eski yerler (cümle cümle)</div>
          {/* eski zaman çizelgesindeki yuvalar */}
          {parcalar.map((p, i) => (
            <div key={"s" + i} style={{ position: "absolute", left: slotX[i] + i * 18, top: 420, width: p.slot, height: 110, border: `3px dashed ${RENK.murekkep}`, borderRadius: 6, boxSizing: "border-box", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 34, color: RENK.murekkep, opacity: 0.6 }}>{i + 1}</span>
            </div>
          ))}
          {parcalar.map((p, i) => {
            const kesildi = makasP * parcalar.length > i + 0.5;
            const t0 = otur + i * 0.25;
            const d = ara(f, k(t0), k(t0 + 0.6), Easing.inOut(Easing.cubic));
            const sigmayan = i === 3;
            const sx2 = sigmayan ? interpolate(hizlan, [0, 1], [p.w / p.slot, 1]) : 1;
            const genis = interpolate(d, [0, 1], [p.w, p.slot]) ;
            const x = interpolate(d, [0, 1], [yeniX[i] + (kesildi ? i * 14 : 0), slotX[i] + i * 18]);
            const y = interpolate(d, [0, 1], [60, 420]);
            const goster = sigmayan && d >= 1 ? p.slot * sx2 : genis;
            return (
              <div key={"p" + i} style={{ position: "absolute", left: x, top: y, width: goster, height: 110, overflow: "visible" }}>
                <div style={{ width: "100%", height: 110, background: `${RENK.kirmizi}22`, border: `3px solid ${sigmayan && d >= 1 && hizlan < 1 ? RENK.kirmizi : RENK.murekkep}`, borderRadius: 6, boxSizing: "border-box", overflow: "hidden", display: "flex", alignItems: "center" }}>
                  <Dalga tur="canli" w={Math.max(40, goster - 10)} h={80} f={f} tohum={"p" + i} cubuk={Math.max(6, Math.round(goster / 22))} renk={RENK.kirmizi} />
                </div>
              </div>
            );
          })}
          {/* kesim çizgileri */}
          {parcalar.slice(0, -1).map((p, i) => {
            const cx = yeniX[i + 1] + i * 14 + 7;
            const g = makasP * parcalar.length > i + 0.5 && f < k(otur);
            return g ? <div key={"k" + i} style={{ position: "absolute", left: cx - 2, top: 40, width: 4, height: 150, borderLeft: `4px dashed ${RENK.kirmizi}` }} /> : null;
          })}
          {f < k(otur) + 6 && (
            <div style={{ position: "absolute", left: makasP * (ax + 40) - 80, top: 180, opacity: 1 - ara(f, k(otur), k(otur) + 6) }}>
              <Makas boy={170} acik={Math.abs(Math.sin(f * 0.5))} />
            </div>
          )}
          {/* 6: sığmayan cümle biraz hızlanır */}
          {f >= k(c(b, 6)) && (
            <div style={{ position: "absolute", left: slotX[3] + 3 * 18 - 20, top: 550 }}>
              <Not boy={46}>sığmadı → biraz hızlı</Not>
            </div>
          )}
        </div>
      </Gir>

      {/* 7: hiç render etmeden */}
      <Gir bas={c(b, 7)} son={bit(b, 7)} x={120} y={420} w={1680}>
        <Metin boy={110} hiza="center">
          <Isaretli tur="ciz" bas={kel(b, 7, "etmeden")}>render</Isaretli> yok.
        </Metin>
        <div style={{ height: 30 }} />
        <Metin boy={88} hiza="center">
          sadece <Isaretli tur="daire" bas={kel(b, 7, "sesini")}>ses</Isaretli> değişti.
        </Metin>
      </Gir>

      {/* 8: birkaç dakika */}
      <Gir bas={c(b, 8)} x={300} y={420} aci={-3}>
        <BiletC ust="BÜTÜN İŞ" deger="birkaç dakika" seri="№ 20-8" w={760} degerBoy={110} />
      </Gir>
      <Gir bas={kel(b, 8, "sürdü")} x={1150} y={640}>
        <DamgaS id="c20b" metin="BİTTİ" bas={kel(b, 8, "sürdü")} boy={110} aci={-10} />
      </Gir>
    </>
  );
};

// ================================================================ 21 — Dördüncü istasyon: görüntü
const S21: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s4 = c(b, 4);
  const foto = kel(b, 4, "fotoğraflayıp");
  const flas = f >= k(foto) ? Math.max(0, 1 - (f - k(foto)) / 8) : 0;
  const nKare = Math.floor(ara(f, k(foto), k(kel(b, 4, "çeviriyor"))) * 5);
  return (
    <>
      <Ust metin="III · İSTASYON 4" bas={giris(b)} />
      <Gir bas={c(b, 1)} x={120} y={166} w={1300}>
        <Manset metin="Dördüncü istasyon: görüntü." bas={c(b, 1)} boy={92} />
      </Gir>
      <Gir bas={kel(b, 1, "görüntü")} x={1440} y={120} aci={-4}>
        <BiletC ust="İSTASYON" deger="4" seri="№ 4" w={420} degerBoy={110} />
      </Gir>
      <Gir bas={kel(b, 1, "görüntü")} son={bit(b, 1)} x={120} y={480} w={1680}>
        <Dalga tur="canli" w={1680} h={220} f={f} tohum="s21" cubuk={70} />
      </Gir>

      {/* 2: en eğlenceli kısım */}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={200} y={460} w={1000}>
        <Metin boy={84}>
          fabrikanın <Isaretli tur="alt" bas={kel(b, 2, "eğlenceli")}>en eğlenceli</Isaretli> kısmı
        </Metin>
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={1350} y={380}>
        <WJ poz="omuz" yas={f - k(c(b, 2))} f={f} boy={520} />
      </Gir>

      {/* 3: Remotion */}
      <Gir bas={kel(b, 3, "rimoşın")} son={bit(b, 3)} x={460} y={400} w={1000}>
        <Pencere baslik="araç" w={1000}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 120, color: RENK.mavi, textAlign: "center" }}>Remotion</div>
        </Pencere>
      </Gir>
      <Gir bas={kel(b, 3, "çiziyorum")} son={bit(b, 3)} x={1000} y={780}>
        <Not boy={52}>görüntüleri bununla çiziyorum</Not>
      </Gir>

      {/* 4: web sayfası → kare kare fotoğraf → video */}
      <Gir bas={s4} son={bit(b, 4)} x={120} y={340} w={640}>
        <Pencere baslik="web sayfası" w={620}>
          <div style={{ position: "relative", height: 330 }}>
            <div style={{ fontFamily: SERIF, fontSize: 56, color: RENK.murekkep, borderBottom: `3px solid ${RENK.murekkep}`, paddingBottom: 6 }}>Defter</div>
            {[0.9, 0.62, 0.78].map((x, i) => (
              <div key={i} style={{ height: 10, width: `${x * 100}%`, background: RENK.murekkep, opacity: 0.5, marginTop: 22 }} />
            ))}
            <div style={{ position: "absolute", right: 10, bottom: 10, transform: `translateX(${Math.sin(f * 0.15) * 30}px)` }}>
              <WJ poz="normal" yas={60} f={f} boy={170} />
            </div>
          </div>
        </Pencere>
        <div style={{ position: "absolute", inset: -10, background: "#fff", opacity: flas * 0.8, borderRadius: 14 }} />
      </Gir>
      <Gir bas={kel(b, 4, "kareyi")} son={bit(b, 4)} x={790} y={380}>
        <Not boy={46}>her kare →</Not>
        <Not boy={46}>fotoğraf</Not>
      </Gir>
      <Gir bas={foto} son={bit(b, 4)} x={1050} y={340} w={780}>
        <div style={{ background: RENK.murekkep, padding: "22px 18px", borderRadius: 6, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: i < Math.max(1, nKare + 1) ? 1 : 0.12 }}>
              <span style={{ fontFamily: MONO, fontSize: 34, color: RENK.kagitAcik, width: 70 }}>{String(i + 1).padStart(2, "0")}</span>
              <div style={{ flex: 1, height: 70, background: RENK.kagit, borderRadius: 3, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 12, top: 12, width: 170, height: 12, background: RENK.murekkep, opacity: 0.6 }} />
                <div style={{ position: "absolute", left: 12, top: 36, width: 120, height: 10, background: RENK.murekkep, opacity: 0.4 }} />
                <div style={{ position: "absolute", left: 380 + i * 30, top: 10, width: 44, height: 50, borderRadius: 22, border: `4px solid ${RENK.murekkep}` }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, opacity: f >= k(kel(b, 4, "videoya")) ? 1 : 0 }}>
          <Metin boy={48} font={SANS}>= video</Metin>
        </div>
      </Gir>

      {/* 5: Claude kodu yazar, ben anlatırım */}
      <Gir bas={c(b, 5)} x={180} y={390}>
        <Balon w={560} h={170} kuyrukX={120}>
          <div style={{ fontFamily: SERIF, fontSize: 46, color: RENK.murekkep, textAlign: "center", lineHeight: 1.05, padding: "0 20px" }}>ne istediğimi anlatıyorum</div>
        </Balon>
      </Gir>
      <Gir bas={kel(b, 5, "ben")} x={230} y={610}>
        <WJ poz="gosteren" yas={f - k(kel(b, 5, "ben"))} f={f} boy={360} />
      </Gir>
      <Gir bas={c(b, 5)} x={1080} y={300} w={720}>
        <Kart w={720} pad={22}>
          <DaktiloYazi metin={"<Sahne b={21}>\n  <Manset ... />"} ilerleme={ara(f, k(c(b, 5)), k(kel(b, 5, "ben")))} f={f} boy={38} />
        </Kart>
      </Gir>
      <Gir bas={c(b, 5)} x={1240} y={560}>
        <Daktilo f={f} boy={380} konusuyor={f < k(kel(b, 5, "ben"))} goz="acik" />
      </Gir>
      <Gir bas={kel(b, 5, "kodu")} x={1300} y={940}>
        <Not boy={40} renk={RENK.mavi}>Claude: kodu yazar</Not>
      </Gir>
    </>
  );
};

// ================================================================ 22 — stil rehberi
const S22: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s3 = c(b, 3);
  const satir = (bas: number, ad: string, icerik: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 24, height: 104, borderTop: `2px solid ${RENK.murekkep}33`, opacity: f >= k(bas) ? 1 : 0.15 }}>
      <div style={{ width: 290, fontFamily: SANS, fontWeight: 600, fontSize: 36, color: RENK.murekkep }}>{ad}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 18 }}>{icerik}</div>
      {f >= k(bas) && <div style={{ fontFamily: SERIF, fontSize: 56, color: RENK.kirmizi, transform: `scale(${Math.min(1, yay(f, bas))})` }}>✓</div>}
    </div>
  );
  const renkler: [string, string][] = [
    [RENK.kagit, "gazete kâğıdı"],
    [RENK.murekkep, "mürekkep siyahı"],
    [RENK.kirmizi, "damga kırmızısı"],
  ];
  return (
    <>
      <Ust metin="GÖRÜNTÜ · STİL REHBERİ" bas={giris(b)} />
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={120} y={300} w={1700}>
        <Manset metin="Ama burada çok önemli bir kural koydum." bas={c(b, 1)} boy={96} />
      </Gir>
      <Gir bas={kel(b, 1, "kural")} son={bit(b, 1)} x={700} y={600}>
        <DamgaS id="c22a" metin="KURAL" bas={kel(b, 1, "kural")} boy={130} aci={-8} />
      </Gir>

      {/* 2–4: rehber belgesi */}
      <Gir bas={c(b, 2)} son={bit(b, 4)} x={120} y={200} w={1000}>
        <Pencere baslik="docs/SIDIS_STIL.md" w={1000}>
          <div style={{ fontFamily: SERIF, fontSize: 64, color: RENK.murekkep, marginBottom: 12 }}>Stil rehberi</div>
          {satir(kel(b, 3, "renkler"), "Renkler", [RENK.kagit, RENK.murekkep, RENK.kirmizi, RENK.mavi].map((r) => <div key={r} style={{ width: 64, height: 64, borderRadius: 6, background: r, border: `3px solid ${RENK.murekkep}` }} />))}
          {satir(kel(b, 3, "yazı tipleri"), "Yazı tipleri", (
            <>
              <span style={{ fontFamily: SERIF, fontSize: 60 }}>Aa</span>
              <span style={{ fontFamily: MONO, fontSize: 52 }}>Aa</span>
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 52 }}>Aa</span>
            </>
          ))}
          {satir(kel(b, 3, "karakterler"), "Karakterler", <span style={{ fontFamily: SERIF, fontSize: 52 }}>W.J. · Daktilo</span>)}
          {satir(kel(b, 3, "geçişler"), "Geçişler", <span style={{ fontFamily: SERIF, fontSize: 52 }}>gazete katlanır</span>)}
        </Pencere>
      </Gir>
      <Gir bas={kel(b, 3, "hepsi")} son={c(b, 4) - 0.2} x={1220} y={420}>
        <DamgaS id="c22b" metin="ÖNCEDEN YAZILI" bas={kel(b, 3, "hepsi")} boy={56} aci={-6} />
      </Gir>
      {/* 4: bu videonun rehberi */}
      <Gir bas={kel(b, 4, "bin")} son={bit(b, 4)} x={1200} y={170} w={620}>
        <div style={{ fontFamily: SERIF, fontSize: 80, color: RENK.kirmizi, lineHeight: 1 }}>1910'lar</div>
      </Gir>
      {renkler.map(([r, ad], i) => (
        <Gir key={ad} bas={kel(b, 4, ad.split(" ")[0])} son={bit(b, 4)} x={1200} y={300 + i * 150} w={620}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 110, height: 110, borderRadius: 8, background: r, border: `4px solid ${RENK.murekkep}`, boxShadow: "4px 5px 0 rgba(27,26,23,0.15)" }} />
            <Metin boy={50}>{ad}</Metin>
          </div>
        </Gir>
      ))}
      <Gir bas={kel(b, 4, "daktilo")} son={bit(b, 4)} x={1200} y={760} w={620}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: 110, height: 110, borderRadius: 8, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 52 }}>Aa</div>
          <Metin boy={50}>daktilo yazısı</Metin>
        </div>
      </Gir>

      {/* 5: rehbersiz */}
      <Gir bas={c(b, 5)} x={120} y={190} w={820}>
        <Metin boy={60} font={SANS}>rehbersiz</Metin>
        <div style={{ display: "flex", gap: 34, marginTop: 30 }}>
          {[0, 1, 2].map((i) => (
            <Sayfacik key={i} w={230} varyant={i} ortalama />
          ))}
        </div>
      </Gir>
      <Daire x={130} y={290} w={790} h={330} bas={kel(b, 5, "ortalama")} sure={0.6} tohum="c22" />
      <Gir bas={kel(b, 5, "ortalama")} x={180} y={720}>
        <Not boy={56}>her seferinde "ortalama"</Not>
      </Gir>
      {/* 6: rehberle */}
      <Gir bas={c(b, 6)} x={1030} y={190} w={820}>
        <Metin boy={60} font={SANS}>rehberle</Metin>
        <div style={{ display: "flex", gap: 34, marginTop: 30 }}>
          {[0, 1, 2].map((i) => (
            <Sayfacik key={i} w={230} varyant={i} />
          ))}
        </div>
      </Gir>
      <Gir bas={kel(b, 6, "defterden")} x={1130} y={700}>
        <DamgaS id="c22c" metin="AYNI DEFTER" bas={kel(b, 6, "defterden")} boy={78} aci={-7} />
      </Gir>
    </>
  );
};

// ================================================================ 23 — tramvay biletleri
const S23: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s6 = c(b, 6);
  return (
    <>
      <Ust metin="GÖRÜNTÜ · BİLETLER" bas={giris(b)} />
      <Gir bas={c(b, 1)} x={120} y={166} w={1700}>
        <Manset metin="Peki tramvay biletleri nereden çıktı?" bas={c(b, 1)} boy={84} />
      </Gir>

      {/* 2: Sidis'in hobisi */}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={140} y={360} w={1050}>
        <Kart w={1050} pad={30}>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 40, letterSpacing: 4, color: RENK.murekkep, borderBottom: `4px double ${RENK.murekkep}`, paddingBottom: 10 }}>W.J. SIDIS</div>
          <div style={{ marginTop: 20 }}>
            <Metin boy={72}>
              tuhaf bir <Isaretli tur="daire" bas={kel(b, 2, "hobisi")} sure={0.5}>hobi</Isaretli>
            </Metin>
          </div>
        </Kart>
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={1400} y={360}>
        <WJ poz="dusunen" yas={f - k(c(b, 2))} f={f} boy={540} fikir={f - k(kel(b, 2, "hobisi"))} />
      </Gir>

      {/* 3: aktarma biletleri yelpazesi */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Gir key={i} bas={c(b, 3) + i * 0.3} son={bit(b, 3)} x={260 + i * 270} y={400 + (i % 2) * 70} aci={-12 + i * 6}>
          <Bilet ust="AKTARMA" deger="Transfer" seri={`№ ${(1 + i) * 1307}`} w={380} degerBoy={60} />
        </Gir>
      ))}
      <Gir bas={kel(b, 3, "biriktirirdi")} son={bit(b, 3)} x={600} y={820}>
        <Not boy={56}>aktarma biletleri biriktirirdi</Not>
      </Gir>

      {/* 4: takma adla kitap */}
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={260} y={330}>
        <svg width={420} height={560} viewBox="0 0 420 560" style={{ overflow: "visible", display: "block" }}>
          <path d="M40 30 L360 30 L360 530 L40 530 Z" fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={7} strokeLinejoin="round" />
          <path d="M360 30 L392 50 L392 548 L360 530" fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={6} strokeLinejoin="round" />
          <path d="M40 530 L72 548 L392 548" fill="none" stroke={RENK.murekkep} strokeWidth={6} />
          {[380, 400, 420].map((y) => <line key={y} x1={362} y1={y - 300} x2={390} y2={y - 282} stroke={RENK.murekkep} strokeWidth={2} opacity={0.4} />)}
          <rect x={80} y={90} width={240} height={150} fill="none" stroke={RENK.murekkep} strokeWidth={4} />
          <line x1={110} y1={140} x2={290} y2={140} stroke={RENK.murekkep} strokeWidth={8} />
          <line x1={130} y1={180} x2={270} y2={180} stroke={RENK.murekkep} strokeWidth={6} opacity={0.6} />
          <text x={200} y={420} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={46} fill={RENK.murekkep}>yazar: ?</text>
        </svg>
      </Gir>
      <Gir bas={kel(b, 4, "takma")} son={bit(b, 4)} x={800} y={420} w={1000}>
        <Metin boy={78}>
          <Isaretli tur="alt" bas={kel(b, 4, "takma")}>takma adla</Isaretli>
        </Metin>
        <Metin boy={78}>koca bir kitap</Metin>
      </Gir>
      <Gir bas={kel(b, 4, "yazdı")} son={bit(b, 4)} x={820} y={680}>
        <Not boy={52}>— biletler üzerine</Not>
      </Gir>

      {/* 5: kanalda her sayaç bir bilet */}
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={160} y={420} aci={-4}>
        <Bilet ust="AKTARMA" deger="Transfer" seri="№ 1910" w={420} degerBoy={66} />
      </Gir>
      <Ok x1={640} y1={510} x2={900} y2={510} egri={-0.18} bas={kel(b, 5, "kanalda")} son={bit(b, 5)} />
      <Gir bas={kel(b, 5, "sayacı")} son={bit(b, 5)} x={960} y={360} aci={3}>
        <Bilet ust="SAYAÇ" deger="sayaç" seri="№ 23-1" w={380} degerBoy={80} />
      </Gir>
      <Gir bas={kel(b, 5, "rozeti")} son={bit(b, 5)} x={1400} y={560} aci={-2}>
        <Bilet ust="ROZET" deger="rozet" seri="№ 23-2" w={300} degerBoy={80} />
      </Gir>

      {/* 6–8: büyük bilet + notlar */}
      <Gir bas={s6} x={200} y={360} aci={-2}>
        <Bilet ust="AKTARMA · TRANSFER" deger="Sidis" seri="№ 0417-1910" w={760} degerBoy={150} />
      </Gir>
      <Ok x1={1120} y1={330} x2={268} y2={350} egri={0.12} bas={kel(b, 6, "delikli")} son={bit(b, 6)} />
      <Gir bas={kel(b, 6, "delikli")} son={bit(b, 6)} x={1140} y={290}>
        <Not boy={52}>delikli kenar</Not>
      </Gir>
      <Ok x1={1120} y1={490} x2={700} y2={500} egri={0} bas={kel(b, 6, "eski")} son={bit(b, 6)} />
      <Gir bas={kel(b, 6, "eski")} son={bit(b, 6)} x={1140} y={450}>
        <Not boy={52}>eski mürekkep</Not>
      </Gir>
      <Ok x1={1120} y1={690} x2={236} y2={610} egri={-0.12} bas={kel(b, 6, "seri")} son={bit(b, 6)} />
      <Gir bas={kel(b, 6, "seri")} son={bit(b, 6)} x={1140} y={650}>
        <Not boy={52}>seri numarası</Not>
      </Gir>
      <Gir bas={kel(b, 7, "kimlik")} son={bit(b, 7)} x={1060} y={420}>
        <DamgaS id="c23" metin="KİMLİK" bas={kel(b, 7, "kimlik")} boy={120} aci={-8} />
      </Gir>
      <Gir bas={c(b, 7)} son={bit(b, 7)} x={220} y={760}>
        <Not boy={52}>küçük bir detay</Not>
      </Gir>
      <Gir bas={c(b, 8)} x={1350} y={380}>
        <WJ poz="gosteren" yas={f - k(c(b, 8))} f={f} boy={520} gulumse />
      </Gir>
      <Gir bas={kel(b, 8, "hatırlıyor")} x={360} y={760}>
        <Metin boy={66}>
          bileti gören, kanalı <Isaretli tur="alt" bas={kel(b, 8, "hatırlıyor")}>hatırlıyor</Isaretli>
        </Metin>
      </Gir>
    </>
  );
};

// ================================================================ 24 — iki karakter
const S24: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const wjB = 560;
  const wjK = wjB / 580;
  const wjX = 330;
  const wjY = 330;
  const dB = 470;
  const dK = dB / 360;
  const dX = 1130;
  const dY = 470;
  const konus = f >= k(c(b, 7)) && f < k(cs(b, 7));
  return (
    <>
      <Ust metin="GÖRÜNTÜ · KARAKTERLER" bas={giris(b)} />
      <Gir bas={c(b, 1)} x={120} y={166} w={1700}>
        <Manset metin="Karakterler de öyle." bas={c(b, 1)} boy={84} />
      </Gir>

      {/* 2: iki boş çerçeve */}
      <Gir bas={c(b, 2)} son={c(b, 3) + 0.4} x={260} y={330}>
        <div style={{ width: 640, height: 600, border: `4px dashed ${RENK.murekkep}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 220, color: RENK.murekkep, opacity: 0.35 }}>1</div>
      </Gir>
      <Gir bas={c(b, 2) + 0.3} son={c(b, 4) + 0.4} x={1050} y={330}>
        <div style={{ width: 640, height: 600, border: `4px dashed ${RENK.murekkep}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 220, color: RENK.murekkep, opacity: 0.35 }}>2</div>
      </Gir>

      {/* 3: W.J. + etiketler */}
      <Gir bas={kel(b, 3, "w.j.")} x={wjX} y={wjY}>
        <WJ poz={f >= k(c(b, 7)) ? "gosteren" : "normal"} yas={f - k(kel(b, 3, "w.j."))} f={f} boy={wjB} />
      </Gir>
      <Gir bas={kel(b, 3, "kasketli")} son={bit(b, 4)} x={60} y={300}>
        <Not boy={48}>kasket</Not>
      </Gir>
      <Ok x1={150} y1={360} x2={wjX + 110 * wjK} y2={wjY + 70 * wjK} egri={0.2} bas={kel(b, 3, "kasketli")} son={bit(b, 4)} kalin={5} />
      <Gir bas={kel(b, 3, "gözlüklü")} son={bit(b, 4)} x={700} y={330}>
        <Not boy={48}>gözlük</Not>
      </Gir>
      <Ok x1={720} y1={390} x2={wjX + 200 * wjK} y2={wjY + 125 * wjK} egri={-0.2} bas={kel(b, 3, "gözlüklü")} son={bit(b, 4)} kalin={5} />
      <Gir bas={kel(b, 3, "baş harfleri")} son={bit(b, 4)} x={700} y={640}>
        <Not boy={48}>baş harfler</Not>
      </Gir>
      <Ok x1={710} y1={680} x2={wjX + 225 * wjK} y2={wjY + 300 * wjK} egri={0.2} bas={kel(b, 3, "baş harfleri")} son={bit(b, 4)} kalin={5} />

      {/* 4: Daktilo */}
      <Gir bas={kel(b, 4, "daktilo")} x={dX} y={dY}>
        <Daktilo f={f} boy={dB} konusuyor={konus} goz={f >= k(c(b, 7)) && f < k(c(b, 7)) + 10 ? "kirpGoz" : "acik"} />
      </Gir>
      <Gir bas={kel(b, 4, "daktilo")} son={bit(b, 4)} x={1250} y={940}>
        <Not boy={48}>daktilo</Not>
      </Gir>

      {/* 5: robot değil, gözlü daktilo */}
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={1120} y={240} w={720}>
        <Metin boy={62}>
          <Isaretli tur="ciz" bas={kel(b, 5, "değil")}>robot</Isaretli> değil
        </Metin>
      </Gir>
      <Daire x={dX + 112 * dK} y={dY + 50 * dK} w={128 * dK} h={52 * dK} bas={kel(b, 5, "gözleri")} son={bit(b, 5)} tohum="goz" />
      <Gir bas={kel(b, 5, "gözleri")} son={bit(b, 5)} x={1500} y={330}>
        <Not boy={48}>gözleri olan</Not>
        <Not boy={48}>eski bir daktilo</Not>
      </Gir>

      {/* 6: yazı makinesi */}
      <Gir bas={kel(b, 6, "yazı makinesi")} son={bit(b, 6)} x={1120} y={250} w={720}>
        <Metin boy={66}>
          bir <Isaretli tur="alt" bas={kel(b, 6, "yazı makinesi")} sure={0.5}>yazı makinesi</Isaretli>
        </Metin>
      </Gir>

      {/* 7: ne yazdırırsan */}
      <Gir bas={c(b, 7)} x={1120} y={210} w={720}>
        <Kart w={720} pad={22}>
          <DaktiloYazi metin="ne yazdırırsan onu yazar" ilerleme={ara(f, k(c(b, 7)), k(cs(b, 7)))} f={f} boy={40} />
        </Kart>
      </Gir>
    </>
  );
};

// ================================================================ 25 — gerçek ekran, bot duvarı
const S25: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s5 = c(b, 5);
  const s6 = c(b, 6);
  return (
    <>
      <Ust metin="GÖRÜNTÜ · GERÇEK EKRAN" bas={giris(b)} />
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={120} y={320} w={1700}>
        <Manset metin="Peki gerçek ekran görüntüleri?" bas={c(b, 1)} boy={110} />
      </Gir>

      {/* 2–4: gerçek kayıt */}
      <Ekran klasor={8} bas={c(b, 2)} son={cs(b, 4)} gorunSon={s5 - 0.2} x={1000} y={160} w={800} hiz={2} />
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={120} y={330} w={820}>
        <Metin boy={72}>
          bazen <Isaretli tur="alt" bas={kel(b, 2, "gerçekten")}>gerçekten</Isaretli> ekranı göstermem lazım
        </Metin>
      </Gir>
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={120} y={360} w={820}>
        <Metin boy={64} font={MONO}>1. yazıyorum</Metin>
        <div style={{ height: 30 }} />
        <Metin boy={64} font={MONO} renk={f >= k(kel(b, 3, "cevabın")) ? RENK.murekkep : `${RENK.murekkep}33`}>2. cevap geliyor</Metin>
      </Gir>
      <Ok x1={760} y1={420} x2={1080} y2={330} egri={-0.2} bas={kel(b, 3, "yazdığımı")} son={bit(b, 3)} />
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={140} y={300} w={760}>
        <Kart w={620} pad={22} arka={RENK.kagit}>
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, color: RENK.murekkep, opacity: 0.7 }}>çizilmiş taklit</div>
          {[0.85, 0.6, 0.75].map((x, i) => (
            <div key={i} style={{ height: 14, width: `${x * 100}%`, background: RENK.murekkep, opacity: 0.35, marginTop: 22, borderRadius: 7 }} />
          ))}
        </Kart>
        <div style={{ marginTop: 40 }}>
          <Metin boy={66}>
            taklit değil, <span style={{ color: RENK.kirmizi }}>gerçeği</span>
          </Metin>
        </div>
      </Gir>
      <UstunuCiz x={140} y={420} w={640} bas={kel(b, 4, "istemedim")} son={bit(b, 4)} />
      <UstunuCiz x={150} y={460} w={620} bas={kel(b, 4, "istemedim") + 0.2} son={bit(b, 4)} tohum="u2" />

      {/* 5: ayrı tarayıcı, otomatik kayıt */}
      <Gir bas={s5} son={bit(b, 5)} x={160} y={330} w={1000}>
        <Pencere baslik="ayrı tarayıcı" w={1000}>
          <div style={{ fontFamily: MONO, fontSize: 44, color: RENK.murekkep, lineHeight: 1.6 }}>
            <DaktiloYazi metin={"siteye giriliyor…\nekran otomatik kaydediliyor"} ilerleme={ara(f, k(kel(b, 5, "sitesine")), k(cs(b, 5)))} f={f} boy={44} />
          </div>
        </Pencere>
      </Gir>
      <Gir bas={kel(b, 5, "kaydetmeye")} son={bit(b, 5)} x={1260} y={360}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: SANS, fontWeight: 600, fontSize: 44, color: RENK.kirmizi }}>
          <span style={{ width: 30, height: 30, borderRadius: 15, background: RENK.kirmizi, opacity: Math.floor(f / 12) % 2 ? 1 : 0.3 }} />
          otomatik kayıt
        </div>
      </Gir>
      <Gir bas={kel(b, 5, "ilk")} son={bit(b, 5)} x={1300} y={500}>
        <WJ poz="normal" yas={f - k(kel(b, 5, "ilk"))} f={f} boy={420} />
      </Gir>

      {/* 6–7: güvenlik duvarı (logo yok, çizim) */}
      <Gir bas={s6} x={160} y={300} w={900}>
        <svg width={900} height={600} viewBox="0 0 900 600" style={{ overflow: "visible", display: "block" }}>
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 7 }, (_, cc) => (
              <rect key={`${r}-${cc}`} x={(r % 2 ? -60 : 0) + cc * 130} y={r * 72} width={124} height={66} fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={4} />
            )),
          )}
          <rect x={180} y={150} width={540} height={270} rx={10} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={6} />
          <rect x={230} y={250} width={64} height={64} rx={6} fill="none" stroke={RENK.murekkep} strokeWidth={6} />
          <text x={320} y={235} fontFamily={SANS} fontWeight={600} fontSize={38} fill={RENK.murekkep}>güvenlik</text>
          <text x={320} y={300} fontFamily={SANS} fontWeight={600} fontSize={38} fill={RENK.murekkep}>doğrulaması</text>
          <text x={320} y={370} fontFamily={SERIF} fontStyle="italic" fontSize={40} fill={RENK.kirmizi}>bot musun?</text>
        </svg>
      </Gir>
      <Gir bas={kel(b, 6, "bot")} x={1250} y={380}>
        <WJ poz={f >= k(c(b, 7)) ? "omuz" : "saskin"} yas={f - k(kel(b, 6, "bot"))} f={f} boy={500} />
      </Gir>
      <Gir bas={kel(b, 6, "takıldım")} son={bit(b, 6)} x={1180} y={280}>
        <Not boy={52}>takıldım</Not>
      </Gir>
      <Gir bas={kel(b, 7, "aşmaya")} x={1080} y={250}>
        <Not boy={50}>aşmaya çalışmadım</Not>
      </Gir>
      <Gir bas={kel(b, 7, "doğru")} x={380} y={890}>
        <DamgaS id="c25" metin="DOĞRU YOL DEĞİL" bas={kel(b, 7, "doğru")} boy={62} aci={-7} />
      </Gir>
    </>
  );
};

// ================================================================ 26 — kendi tarayıcım, kareler, kenar sorunu
const Taslak: React.FC<{ f: number; w: number; menu: number; kirp?: number; isaret?: boolean }> = ({ f, w, menu, kirp = 0, isaret }) => {
  // logosuz, metinsiz eskiz: yan menü (menu 0..1 genişlik) + orta sohbet sütunu
  const h = 600;
  const menuW = 300 * menu;
  return (
    <div style={{ position: "relative", width: w, height: h, border: `5px solid ${RENK.murekkep}`, borderRadius: 12, background: RENK.kagitAcik, overflow: "hidden", boxShadow: "8px 10px 0 rgba(27,26,23,0.14)" }}>
      <div style={{ height: 54, borderBottom: `4px solid ${RENK.murekkep}`, background: RENK.kagitKoyu, display: "flex", alignItems: "center", gap: 12, padding: "0 18px" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 18, height: 18, borderRadius: 9, border: `3.5px solid ${RENK.murekkep}` }} />
        ))}
      </div>
      {menuW > 2 && (
        <div style={{ position: "absolute", left: 0, top: 54, bottom: 0, width: menuW, borderRight: `4px solid ${RENK.murekkep}`, background: RENK.kagit, overflow: "hidden" }}>
          <div style={{ margin: 24, width: 150, height: 34, borderRadius: 17, background: RENK.murekkep, opacity: 0.55 }} />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ margin: "22px 24px", height: 16, width: 180 + ((i * 37) % 70), borderRadius: 8, background: RENK.murekkep, opacity: 0.25 }} />
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: menuW + (w - menuW) / 2 - 260, top: 110, width: 520 }}>
        {[0.6, 0.95, 0.8, 0.9, 0.5].map((x, i) => (
          <div key={i} style={{ height: 16, width: `${x * 100}%`, marginLeft: i === 0 ? "40%" : 0, borderRadius: 8, background: i === 0 ? RENK.mavi : RENK.murekkep, opacity: i === 0 ? 0.5 : 0.3, marginBottom: 26 }} />
        ))}
        <div style={{ marginTop: 60, height: 70, border: `4px solid ${RENK.murekkep}`, borderRadius: 16 }} />
      </div>
      {kirp > 0 && (
        <>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (w - 600) / 2, background: RENK.murekkep, opacity: 0.45 * kirp }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: (w - 600) / 2, background: RENK.murekkep, opacity: 0.45 * kirp }} />
          <div style={{ position: "absolute", left: (w - 600) / 2, top: 64, width: 600, height: h - 84, border: `5px dashed ${RENK.kirmizi}`, boxSizing: "border-box", opacity: kirp }} />
        </>
      )}
      {isaret && <div style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, opacity: f * 0 }} />}
    </div>
  );
};

const S26: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s2 = c(b, 2);
  const foto = kel(b, 2, "fotoğrafını");
  const flas = f >= k(foto) && f < k(foto) + 10 ? 1 - (f - k(foto)) / 10 : 0;
  const s5 = c(b, 5);
  const adimlar: [string, string][] = [
    ["sekme", "arka planda sekme açar"],
    ["isteği", "isteği yazar"],
    ["bekliyor", "cevabı bekler"],
    ["fotoğrafını", "her adımda fotoğraf"],
  ];
  return (
    <>
      <Ust metin="GÖRÜNTÜ · GERÇEK EKRAN" bas={giris(b)} />
      {/* 1: kendi tarayıcım + arka plan sekmesi */}
      <Gir bas={c(b, 1)} son={bit(b, 1)} x={260} y={250} w={1400}>
        <Manset metin="Onun yerine kendi tarayıcıma döndüm." bas={c(b, 1)} boy={72} />
        <div style={{ marginTop: 40, width: 1400, border: `5px solid ${RENK.murekkep}`, borderRadius: 12, background: RENK.kagitAcik, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, padding: "12px 12px 0", background: RENK.kagitKoyu, borderBottom: `4px solid ${RENK.murekkep}` }}>
            {["sekme 1", "sekme 2", "arka plan"].map((t, i) => (
              <div key={t} style={{ padding: "8px 26px", border: `3px solid ${i === 2 ? RENK.kirmizi : RENK.murekkep}`, borderBottom: "none", borderRadius: "8px 8px 0 0", fontFamily: MONO, fontSize: 34, color: i === 2 ? RENK.kirmizi : RENK.murekkep, background: RENK.kagitAcik, opacity: i === 2 ? ara(f, k(kel(b, 1, "döndüm")), k(kel(b, 1, "döndüm") + 0.4)) : 1 }}>{t}</div>
            ))}
          </div>
          <div style={{ height: 240, padding: 30 }}>
            <Metin boy={56}>benim tarayıcım</Metin>
          </div>
        </div>
      </Gir>

      {/* 2–4: adımlar + gerçek kareler */}
      <Gir bas={s2} son={bit(b, 2)} x={120} y={170} w={800}>
        <Metin boy={58}>Claude, benim tarayıcımda:</Metin>
        {adimlar.map(([anahtar, yazi], i) => (
          <div key={yazi} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30, opacity: f >= k(kel(b, 2, anahtar)) ? 1 : 0.15 }}>
            <span style={{ width: 62, height: 62, borderRadius: 31, border: `4px solid ${RENK.murekkep}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 36, background: f >= k(kel(b, 2, anahtar)) ? RENK.bilet : "transparent" }}>{i + 1}</span>
            <Metin boy={50}>{yazi}</Metin>
          </div>
        ))}
      </Gir>
      <Ekran klasor={5} bas={s2 + 0.3} son={cs(b, 4)} gorunSon={s5 - 0.2} x={980} y={170} w={830} hiz={6} />
      {flas > 0 && <div style={{ position: "absolute", left: 980, top: 170, width: 830, height: 740, background: "#fff", opacity: flas * 0.85 }} />}
      {/* 3: film şeridi */}
      <Gir bas={c(b, 3)} son={bit(b, 4)} x={110} y={240} w={820}>
        <Metin boy={56}>fotoğraflar arka arkaya,</Metin>
        <Metin boy={56}>yumuşak geçişlerle</Metin>
        <div style={{ marginTop: 34, width: 820, height: 300, overflow: "hidden", background: RENK.murekkep, borderRadius: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 30, left: -ara(f, k(c(b, 3)), k(cs(b, 4))) * 700, display: "flex", gap: 20 }}>
            {[0, 3, 6, 9, 12, 15, 18].map((i) => (
              <Img key={i} src={kareYolu(5, i)} style={{ width: 290, height: 240, objectFit: "cover", border: `3px solid ${RENK.kagitAcik}` }} />
            ))}
          </div>
          {Array.from({ length: 14 }, (_, i) => (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", top: 8, left: i * 60 + 10, width: 26, height: 14, borderRadius: 3, background: RENK.kagit }} />
              <div style={{ position: "absolute", bottom: 8, left: i * 60 + 10, width: 26, height: 14, borderRadius: 3, background: RENK.kagit }} />
            </React.Fragment>
          ))}
        </div>
      </Gir>
      <Gir bas={kel(b, 4, "gerçek")} son={s5 - 0.2} x={1180} y={520}>
        <DamgaS id="c26" metin="GERÇEK" bas={kel(b, 4, "gerçek")} boy={110} aci={-9} />
      </Gir>

      {/* 5–6: kenarda ad ve eski sohbetler */}
      <Gir bas={s5} x={120} y={170} w={1100}>
        <Manset metin="Ama bir sorun daha çıktı." bas={s5} boy={72} />
      </Gir>
      <Gir bas={s5 + 0.3} x={160} y={300} w={1400}>
        <Taslak f={f} w={1400} menu={1} />
      </Gir>
      <Daire x={170} y={360} w={290} h={520} bas={kel(b, 6, "kenarında")} sure={0.6} tohum="kenar" />
      <Gir bas={kel(b, 6, "adım")} x={1240} y={240}>
        <Not boy={52}>adım</Not>
      </Gir>
      <Ok x1={1230} y1={290} x2={420} y2={420} egri={0.15} bas={kel(b, 6, "adım")} />
      <Gir bas={kel(b, 6, "sohbetlerim")} x={1580} y={560}>
        <Not boy={52}>eski</Not>
        <Not boy={52}>sohbetler</Not>
      </Gir>
      <Ok x1={1570} y1={640} x2={480} y2={700} egri={-0.1} bas={kel(b, 6, "sohbetlerim")} />
    </>
  );
};

// ================================================================ 27 — çözüm kodda: menü kapalı, kırp, bulanıklaştır
const S27: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const kapan = ara(f, k(kel(b, 2, "kapatıyoruz")), k(kel(b, 2, "kapatıyoruz") + 0.7), Easing.inOut(Easing.cubic));
  const kirp = ara(f, k(kel(b, 3, "kesiyoruz")), k(kel(b, 3, "kesiyoruz") + 0.5));
  const s4 = c(b, 4);
  const s6 = c(b, 6);
  const ekX = 560;
  const ekY = 210;
  const ekW = 800;
  const ih = Math.round(((ekW - 8) * 679) / 820);
  const resimY = ekY + 4 + 50 + 3;
  return (
    <>
      <Ust metin="GÖRÜNTÜ · GİZLİLİK" bas={giris(b)} />
      <Gir bas={c(b, 1)} son={s4 - 0.2} x={120} y={166} w={1700}>
        <Manset metin="Çözüm yine kodda." bas={c(b, 1)} boy={80} font="mono" />
      </Gir>

      {/* 1–3: eskiz üzerinde */}
      <Gir bas={c(b, 1) + 0.3} son={s4 - 0.2} x={260} y={310} w={1400}>
        <Taslak f={f} w={1400} menu={1 - kapan} kirp={kirp} />
      </Gir>
      <Gir bas={kel(b, 2, "kapatıyoruz")} son={bit(b, 2)} x={300} y={940}>
        <Not boy={48}>1 · yan menü kapalı</Not>
      </Gir>
      <Gir bas={kel(b, 3, "kesiyoruz")} son={s4 - 0.2} x={300} y={940}>
        <Not boy={48}>2 · yalnız ortadaki sütun</Not>
      </Gir>

      {/* 4: gerçek kare: alttaki kişisel öneriler bulanık */}
      <Ekran klasor={1} kareler={[0, 1, 2]} bas={s4} son={cs(b, 5)} gorunSon={s6 - 0.2} x={ekX} y={ekY} w={ekW} />
      <Daire x={ekX + 50} y={resimY + ih * 0.58} w={ekW - 110} h={ih * 0.22} bas={kel(b, 4, "bulanıklaştırıyoruz")} son={s6 - 0.2} sure={0.6} tohum="bulanik" />
      <Gir bas={kel(b, 4, "kişisel")} son={s6 - 0.2} x={1420} y={560}>
        <Not boy={50}>kişisel öneriler</Not>
      </Gir>
      <Gir bas={kel(b, 4, "bulanıklaştırıyoruz")} son={s6 - 0.2} x={1420} y={640}>
        <Not boy={50}>→ bulanık</Not>
      </Gir>
      <Gir bas={kel(b, 4, "otomatik")} son={bit(b, 4)} x={120} y={560}>
        <Not boy={50}>otomatik bulunur</Not>
      </Gir>
      {/* 5: bir kere kur, her videoda */}
      <Gir bas={c(b, 5)} son={s6 - 0.2} x={110} y={520} w={420}>
        <svg width={170} height={170} viewBox="0 0 170 170" style={{ display: "block", transform: `rotate(${f * 4}deg)` }}>
          <path d="M140 85 A55 55 0 1 1 115 39" fill="none" stroke={RENK.kirmizi} strokeWidth={9} strokeLinecap="round" />
          <path d="M100 22 L120 40 L96 52" fill="none" stroke={RENK.kirmizi} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <Not boy={46}>bir kere kur,</Not>
        <Not boy={46}>her videoda çalışır</Not>
      </Gir>

      {/* 6–7: on kısa video */}
      <Gir bas={s6} x={120} y={160} w={1100}>
        <Manset metin="On kısa video, gerçek ekranlarla." bas={s6} boy={72} />
      </Gir>
      {Array.from({ length: 10 }, (_, i) => {
        const bas = s6 + 0.2 + i * ((kel(b, 7, "tek") - s6 - 0.2) / 10);
        return (
          <Gir key={i} bas={bas} x={150 + (i % 5) * 330} y={270 + Math.floor(i / 5) * 305} aci={((i * 7) % 5) - 2}>
            <div style={{ width: 300, height: 290, border: `4px solid ${RENK.murekkep}`, background: "#fff", borderRadius: 6, overflow: "hidden", position: "relative", boxShadow: "5px 6px 0 rgba(27,26,23,0.15)" }}>
              <Img src={kareYolu(i + 1, Math.min(KARE_SAYISI[i + 1] - 1, Math.floor(KARE_SAYISI[i + 1] * 0.6)))} style={{ width: "100%", height: 250, objectFit: "cover" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, borderTop: `3px solid ${RENK.murekkep}`, background: RENK.bilet, fontFamily: MONO, fontSize: 34, lineHeight: "40px", textAlign: "center" }}>#{String(i + 1).padStart(2, "0")}</div>
            </div>
          </Gir>
        );
      })}
      <Gir bas={s6 + 0.6} x={150} y={905}>
        <GercekRozet />
      </Gir>
      <Gir bas={kel(b, 7, "tek")} x={1180} y={895}>
        <DamgaS id="c27" metin="TEK OTURUM" bas={kel(b, 7, "tek")} boy={84} aci={-6} />
      </Gir>
    </>
  );
};

// ================================================================ 28 — Beşinci istasyon: kontrol
const S28: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s5 = c(b, 5);
  const sorular = [
    { n: 5, metin: "Yazı üst üste biniyor mu?", kare: 2 },
    { n: 6, metin: "Türkçe harfler doğru mu?", kare: 5 },
    { n: 7, metin: "Bir şey ekrandan taşıyor mu?", kare: 7 },
    { n: 8, metin: "Damga yazıyı kapatıyor mu?", kare: 9 },
  ];
  const gx = 900;
  const gy = 300;
  const kw = 168;
  const kh = 299;
  const ara2 = 18;
  const kx = (i: number) => gx + ((i - 1) % 5) * (kw + ara2);
  const ky = (i: number) => gy + Math.floor((i - 1) / 5) * (kh + ara2);
  const s9 = c(b, 9);
  const tarama = ara(f, k(s9), k(cs(b, 9)));
  const taraI = Math.min(10, 1 + Math.floor(tarama * 10));
  return (
    <>
      <Ust metin="III · İSTASYON 5" bas={giris(b)} />
      <Gir bas={c(b, 1)} son={s5 - 0.2} x={120} y={166} w={1300}>
        <Manset metin="Beşinci istasyon: kontrol." bas={c(b, 1)} boy={92} />
      </Gir>
      <Gir bas={kel(b, 1, "kontrol")} son={s5 - 0.2} x={1440} y={120} aci={3}>
        <BiletC ust="İSTASYON" deger="5" seri="№ 5" w={420} degerBoy={110} />
      </Gir>
      <Gir bas={kel(b, 1, "kontrol")} son={bit(b, 1)} x={120} y={480} w={1680}>
        <Dalga tur="canli" w={1680} h={220} f={f} tohum="s28" cubuk={70} />
      </Gir>

      {/* 2: en sevdiğim */}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={200} y={500} w={1000}>
        <Metin boy={84}>
          <Isaretli tur="alt" bas={kel(b, 2, "sevdiğim")}>en çok sevdiğim</Isaretli> kısım
        </Metin>
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={1300} y={400}>
        <WJ poz="normal" gulumse yas={f - k(c(b, 2))} f={f} boy={500} />
      </Gir>

      {/* 3–4: iki ajan */}
      <Gir bas={c(b, 3)} son={s5 - 0.2} x={180} y={430}>
        <Daktilo f={f} boy={380} konusuyor={f < k(cs(b, 3))} goz="acik" bak={[6, 2]} />
      </Gir>
      <Gir bas={c(b, 3)} son={s5 - 0.2} x={170} y={850}>
        <Not boy={46}>ajan 1 · çiziyor</Not>
      </Gir>
      <Gir bas={kel(b, 3, "çiziyor")} son={s5 - 0.2} x={680} y={420}>
        <Sayfacik w={250} />
      </Gir>
      <Ok x1={960} y1={560} x2={1180} y2={560} egri={-0.15} bas={kel(b, 4, "başka")} son={s5 - 0.2} />
      <Gir bas={kel(b, 4, "başka")} son={s5 - 0.2} x={1260} y={430}>
        <Daktilo f={f} boy={380} konusuyor={false} goz="acik" bak={[-8, 0]} />
      </Gir>
      <Gir bas={kel(b, 4, "başka")} son={s5 - 0.2} x={1250} y={850}>
        <Not boy={46}>ajan 2 · denetliyor</Not>
      </Gir>
      <Gir bas={kel(b, 4, "görmemiş")} son={s5 - 0.2} x={1260} y={330}>
        <Not boy={44} renk={RENK.mavi}>sahneyi hiç görmedi</Not>
      </Gir>

      {/* 5–9: soru listesi + kontak sayfası */}
      <Gir bas={s5} x={110} y={320} w={760}>
        {sorular.map((q) => {
          const t = c(b, q.n);
          const tik = f >= k(cs(b, q.n) - 0.4);
          return (
            <div key={q.n} style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 34, opacity: f >= k(t) ? 1 : 0.15 }}>
              <span style={{ flex: "none", width: 50, height: 50, border: `4px solid ${RENK.murekkep}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 50, color: RENK.kirmizi, lineHeight: 1 }}>{tik ? "✓" : ""}</span>
              <Metin boy={48}>{q.metin}</Metin>
            </div>
          );
        })}
      </Gir>
      <Gir bas={s5 + 0.2} x={gx - 20} y={gy - 70}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.murekkep, letterSpacing: 2 }}>KONTAK SAYFASI · KARE KARE</div>
      </Gir>
      {Array.from({ length: 10 }, (_, j) => {
        const i = j + 1;
        const bas = s5 + 0.2 + j * 0.12;
        const aktif = f >= k(s9) && i === taraI;
        return (
          <Gir key={i} bas={bas} x={kx(i)} y={ky(i)}>
            <div style={{ width: kw, height: kh, border: `3px solid ${aktif ? RENK.kirmizi : RENK.murekkep}`, background: RENK.murekkep, overflow: "hidden", boxShadow: aktif ? `0 0 0 6px ${RENK.kirmizi}55` : undefined }}>
              <Img src={pilot(i)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </Gir>
        );
      })}
      {sorular.map((q, j) => (
        <Daire key={q.n} x={kx(q.kare) + 10} y={ky(q.kare) + 60 + (j % 2) * 80} w={kw - 20} h={110} bas={kel(b, q.n, q.metin.split(" ")[1].toLocaleLowerCase("tr"))} sure={0.45} tohum={"k" + j} kalin={6} />
      ))}
      <Gir bas={kel(b, 9, "kare kare")} x={gx} y={gy + 2 * (kh + ara2) + 6}>
        <Not boy={48}>ajan her kareye bakıyor</Not>
      </Gir>
    </>
  );
};

// ================================================================ 29 — on sorun
const S29: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const satirlar = ["damga yazıyı kapatıyor", "Ğ şapkası kayboluyor", "eller pençe gibi"];
  const s2 = c(b, 2);
  const s5 = c(b, 5);
  const kayDamga = ara(f, k(kel(b, 2, "kapatıyordu") + 0.6), k(kel(b, 2, "kapatıyordu") + 1.2), Easing.inOut(Easing.cubic));
  return (
    <>
      <Ust metin="KONTROL · RAPOR" bas={giris(b)} />
      {/* 1: rapor */}
      <Gir bas={c(b, 1)} son={s5 - 0.2} x={110} y={200} w={700}>
        <Pencere baslik="kontrol raporu" w={700}>
          {Array.from({ length: 10 }, (_, i) => {
            const t = c(b, 1) + 1.2 + i * 0.45;
            const vurgu = i < 3 && f >= k(c(b, 2 + i));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, height: 58, borderBottom: `2px solid ${RENK.murekkep}22`, opacity: f >= k(t) ? 1 : 0.12 }}>
                <span style={{ fontFamily: MONO, fontSize: 34, width: 60, color: RENK.murekkep }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, fontFamily: SERIF, fontSize: 38, color: vurgu ? RENK.kirmizi : RENK.murekkep, whiteSpace: "nowrap" }}>{i < 3 ? satirlar[i] : "—"}</span>
                <span style={{ fontFamily: SERIF, fontSize: 44, color: RENK.kirmizi }}>{f >= k(t + 0.25) ? "✓" : ""}</span>
              </div>
            );
          })}
        </Pencere>
      </Gir>
      <Gir bas={kel(b, 1, "on tane")} son={s2 - 0.2} x={980} y={300} aci={-3}>
        <BiletC ust="BULUNAN SORUN" deger="10" seri="№ 29" w={460} degerBoy={150} />
      </Gir>
      <Gir bas={kel(b, 1, "düzeltti")} son={s2 - 0.2} x={1080} y={640}>
        <DamgaS id="c29a" metin="DÜZELTİLDİ" bas={kel(b, 1, "düzeltti")} boy={80} aci={-7} />
      </Gir>

      {/* 2: damga üç denemeyi kapatıyor */}
      <Gir bas={s2} son={bit(b, 2)} x={900} y={250} w={920}>
        <div style={{ display: "flex", gap: 20 }}>
          {[1, 2, 3].map((i) => (
            <Kart key={i} w={280} h={170} pad={18}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, color: RENK.murekkep }}>deneme {i}</div>
              <div style={{ marginTop: 14 }}>
                <Dalga tur={i === 3 ? "boguk" : "burun"} w={230} h={60} f={f} tohum={"d" + i} />
              </div>
            </Kart>
          ))}
        </div>
        <div style={{ position: "absolute", left: 120, top: interpolate(kayDamga, [0, 1], [20, 230]) }}>
          <DamgaS id="c29b" metin="OLMAMIŞ" bas={kel(b, 2, "olmamış")} boy={110} aci={-6} />
        </div>
        <div style={{ position: "absolute", left: 0, top: 440 }}>
          <Not boy={48}>{kayDamga > 0.5 ? "sonra: damga aşağıda, yazılar açık" : "önce: damga üç denemenin üstünde"}</Not>
        </div>
      </Gir>

      {/* 3: Ğ şapkası */}
      <Gir bas={c(b, 3)} son={bit(b, 3)} x={940} y={230} w={880}>
        <div style={{ display: "flex", gap: 90, alignItems: "flex-end" }}>
          <div>
            {/* önce: şapkası kaybolmuş hâli (G) — daire tam o boşluğu çevirir */}
            <DamgaS id="c29c" metin="G" bas={c(b, 3)} boy={260} aci={-6} />
            <div style={{ marginTop: 46 }}>
              <Not boy={44}>önce</Not>
            </div>
          </div>
          <div style={{ opacity: f >= k(kel(b, 3, "kayboluyordu")) ? 1 : 0 }}>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 300, lineHeight: 1, color: RENK.kirmizi }}>Ğ</div>
            <Not boy={44}>sonra</Not>
          </div>
        </div>
      </Gir>
      <Daire x={1010} y={250} w={200} h={110} bas={kel(b, 3, "şapkası")} son={bit(b, 3)} tohum="sapka" />

      {/* 4: eller pençe */}
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={940} y={250} w={880}>
        <div style={{ display: "flex", gap: 120 }}>
          <div>
            <svg width={260} height={260} viewBox="0 0 260 260" style={{ display: "block" }}>
              <circle cx={130} cy={170} r={44} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={7} />
              {[-0.9, -0.3, 0.3, 0.9].map((a, i) => (
                <path key={i} d={`M${130 + Math.sin(a) * 40} ${170 - Math.cos(a) * 40} L${130 + Math.sin(a) * 100} ${170 - Math.cos(a) * 100} L${130 + Math.sin(a + 0.25) * 116} ${170 - Math.cos(a + 0.25) * 116}`} fill="none" stroke={RENK.murekkep} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
            <Not boy={48}>pençe</Not>
          </div>
          <div style={{ opacity: f >= k(kel(b, 4, "görünüyordu")) ? 1 : 0 }}>
            <svg width={260} height={260} viewBox="0 0 260 260" style={{ display: "block" }}>
              <circle cx={130} cy={150} r={40} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={7} />
            </svg>
            <Not boy={48} renk={RENK.murekkep}>sade el</Not>
          </div>
        </div>
      </Gir>
      <UstunuCiz x={940} y={545} w={150} bas={kel(b, 4, "görünüyordu")} son={bit(b, 4)} />

      {/* 5–6 */}
      <Gir bas={s5} x={200} y={380}>
        <WJ poz="dusunen" yas={f - k(s5)} f={f} boy={540} />
      </Gir>
      <Gir bas={kel(b, 5, "yarısını")} x={620} y={300} w={700}>
        <Metin boy={66}>
          ben <Isaretli tur="daire" bas={kel(b, 5, "yarısını")}>yarısını</Isaretli> fark etmezdim
        </Metin>
      </Gir>
      <Gir bas={c(b, 6)} x={1300} y={500}>
        <Daktilo f={f} boy={420} konusuyor={false} goz={f < k(c(b, 6)) + 12 ? "kirpGoz" : "acik"} />
      </Gir>
      <Gir bas={kel(b, 6, "fark")} x={470} y={660}>
        <DamgaS id="c29d" metin="AJAN FARK ETTİ" bas={kel(b, 6, "fark")} boy={66} aci={-6} />
      </Gir>
    </>
  );
};

// ================================================================ 30 — son söz bende
const S30: Sc = ({ b }) => {
  const f = useCurrentFrame();
  const s3 = c(b, 3);
  const igne = interpolate(ara(f, k(kel(b, 3, "ölçüyorum")), k(kel(b, 3, "uygun")), Easing.out(Easing.back(1.6))), [0, 1], [-70, 8]);
  const s6 = c(b, 6);
  return (
    <>
      <Ust metin="KONTROL · SON SÖZ" bas={giris(b)} />
      <Gir bas={c(b, 1)} son={s6 - 0.2} x={120} y={166} w={1300}>
        <Manset metin="Ama son söz hep bende." bas={c(b, 1)} boy={92} />
      </Gir>
      <Gir bas={kel(b, 1, "bende")} son={s3 - 0.2} x={1450} y={330}>
        <WJ poz={f >= k(c(b, 2)) ? "telefon" : "normal"} yas={f - k(kel(b, 1, "bende"))} f={f} boy={560} />
      </Gir>

      {/* 2: ajan "bitti" der, ben birkaç kareye bakarım */}
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={150} y={340}>
        <Balon w={300} h={130} kuyrukX={90}>
          <div style={{ fontFamily: SERIF, fontSize: 64, color: RENK.murekkep }}>"bitti"</div>
        </Balon>
      </Gir>
      <Gir bas={c(b, 2)} son={bit(b, 2)} x={150} y={560}>
        <Daktilo f={f} boy={340} konusuyor={f < k(kel(b, 2, "dediğinde") + 0.5)} goz="acik" />
      </Gir>
      {[2, 6, 9].map((i, j) => (
        <Gir key={i} bas={kel(b, 2, "birkaç") + j * 0.25} son={bit(b, 2)} x={660 + j * 230} y={360 + (j % 2) * 30} aci={-4 + j * 4}>
          <div style={{ width: 200, height: 356, border: `4px solid ${RENK.murekkep}`, overflow: "hidden", boxShadow: "6px 8px 0 rgba(27,26,23,0.14)" }}>
            <Img src={pilot(i)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </Gir>
      ))}

      {/* 3: ses seviyesi */}
      <Gir bas={s3} son={bit(b, 3)} x={260} y={330} w={760}>
        <svg width={760} height={480} viewBox="0 0 760 480" style={{ display: "block", overflow: "visible" }}>
          <path d="M80 400 A300 300 0 0 1 680 400" fill="none" stroke={RENK.murekkep} strokeWidth={8} />
          <path d="M380 100 A300 300 0 0 1 497 124" fill="none" stroke={RENK.mavi} strokeWidth={30} />
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI + (i / 10) * Math.PI;
            return <line key={i} x1={380 + Math.cos(a) * 270} y1={400 + Math.sin(a) * 270} x2={380 + Math.cos(a) * 300} y2={400 + Math.sin(a) * 300} stroke={RENK.murekkep} strokeWidth={5} />;
          })}
          <g transform={`rotate(${igne} 380 400)`}>
            <line x1={380} y1={400} x2={380} y2={130} stroke={RENK.kirmizi} strokeWidth={9} strokeLinecap="round" />
          </g>
          <circle cx={380} cy={400} r={22} fill={RENK.murekkep} />
          <text x={380} y={470} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={40} fill={RENK.murekkep}>SES SEVİYESİ</text>
        </svg>
      </Gir>
      <Gir bas={kel(b, 3, "youtube")} son={bit(b, 3)} x={1080} y={420}>
        <Not boy={56} renk={RENK.mavi}>YouTube için uygun mu?</Not>
      </Gir>
      <Gir bas={kel(b, 3, "uygun")} son={bit(b, 3)} x={1150} y={560}>
        <DamgaS id="c30a" metin="UYGUN" bas={kel(b, 3, "uygun")} boy={90} aci={-7} />
      </Gir>

      {/* 4: renkler doğru mu */}
      <Gir bas={c(b, 4)} son={bit(b, 4)} x={300} y={300} w={1400}>
        <div style={{ display: "flex", gap: 160, justifyContent: "center" }}>
          {[false, true].map((soluk) => (
            <div key={String(soluk)} style={{ opacity: !soluk || f >= k(kel(b, 4, "soluk")) ? 1 : 0.1 }}>
              <div style={{ width: 300, height: 533, border: `4px solid ${RENK.murekkep}`, overflow: "hidden" }}>
                <Img src={pilot(4)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: soluk ? "saturate(0.35) contrast(0.75) brightness(1.12)" : undefined }} />
              </div>
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <Not boy={48} renk={soluk ? RENK.kirmizi : RENK.murekkep}>{soluk ? "bazı oynatıcılar: soluk" : "doğru renk"}</Not>
              </div>
            </div>
          ))}
        </div>
      </Gir>

      {/* 5: tamam → video çıkıyor */}
      <Gir bas={c(b, 5)} son={bit(b, 5)} x={560} y={430}>
        <DamgaS id="c30b" metin="HEPSİ TAMAM" bas={c(b, 5) + 0.2} boy={110} aci={-6} />
      </Gir>
      <Gir bas={kel(b, 5, "video")} son={bit(b, 5)} x={760} y={720}>
        <Metin boy={66}>→ video çıkıyor</Metin>
      </Gir>

      {/* 6: prompt → video → paylaş: yok öyle bir şey */}
      <Gir bas={s6} son={bit(b, 6)} x={120} y={200} w={1680}>
        <Metin boy={90}>Böyle bir şey yok:</Metin>
      </Gir>
      {["prompt yazdım", "video çıktı", "paylaştım"].map((t, i) => (
        <Gir key={t} bas={kel(b, 6, t.split(" ")[0]) } son={bit(b, 6)} x={140 + i * 580} y={470}>
          <Kart pad={22}>
            <div style={{ fontFamily: MONO, fontSize: 48, whiteSpace: "nowrap" }}>{t}</div>
          </Kart>
        </Gir>
      ))}
      <Ok x1={560} y1={530} x2={700} y2={530} egri={0} bas={kel(b, 6, "video")} son={bit(b, 6)} kalin={5} renk={RENK.murekkep} />
      <Ok x1={1100} y1={530} x2={1260} y2={530} egri={0} bas={kel(b, 6, "paylaştım")} son={bit(b, 6)} kalin={5} renk={RENK.murekkep} />
      <UstunuCiz x={130} y={535} w={1560} bas={kel(b, 6, "yok")} son={bit(b, 6)} kalin={10} />

      {/* 7: herkesinkine benzeyen */}
      {Array.from({ length: 6 }, (_, i) => (
        <Gir key={i} bas={c(b, 7) + i * 0.15} x={200 + (i % 3) * 330} y={260 + Math.floor(i / 3) * 360}>
          <Sayfacik w={240} varyant={0} ortalama />
        </Gir>
      ))}
      <Daire x={190} y={260} w={950} h={680} bas={kel(b, 7, "herkesinkine")} sure={0.6} tohum="herkes" />
      <Gir bas={kel(b, 7, "benzeyen")} x={1270} y={420} w={560}>
        <Metin boy={70}>
          herkesinkine <Isaretli tur="alt" bas={kel(b, 7, "benzeyen")}>benzeyen</Isaretli>
        </Metin>
        <Metin boy={70}>bir şey</Metin>
      </Gir>
    </>
  );
};

export const SAHNELER_C: Record<number, React.FC<{ b: number }>> = {
  ...yerTutucular(18, 30),
  18: S18,
  19: S19,
  20: S20,
  21: S21,
  22: S22,
  23: S23,
  24: S24,
  25: S25,
  26: S26,
  27: S27,
  28: S28,
  29: S29,
  30: S30,
};

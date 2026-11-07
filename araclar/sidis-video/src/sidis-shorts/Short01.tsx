// W.J. Sidis Shorts #01 — "Sesimi klonladım. Burnumdan konuşuyordum."
// Tek sahne, kesme yok. TÜM ipuçları kelimeler.json'daki kelimelerden türetilir (saniye yazılmaz):
// gerçek ses gelince aynı şemayla dosya değişir, her şey kendiliğinden yerine oturur.
import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontlariYukle } from "../lib/fonts";
import veri from "../../assets/sidis-shorts/01/kelimeler.json";
import {
  Balon, Bilet, Daktilo, DaktiloYazi, Dalga, DalgaTuru, Damga, EkranKarti, Goz, Kagit, Katman, Kaydirici, MONO, Pencere, Poz, RENK, SANS, SERIF, WJ,
} from "./parcalar";

fontlariYukle();

export const FPS = 30;
type Kelime = { w: string; s: number; e: number };
const KELIMELER: Kelime[] = (veri as { kelimeler: Kelime[] }).kelimeler;
export const SHORT01_KARE = Math.round(((veri as { sure: number }).sure + 0.8) * FPS);

// ---------------------------------------------------------------- kelime → kare
const sade = (w: string) => w.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]/gu, "");
const bul = (kelime: string, n = 1): Kelime => {
  const hedef = sade(kelime);
  let say = 0;
  for (const k of KELIMELER) {
    if (sade(k.w) === hedef && ++say === n) return k;
  }
  throw new Error(`kelimeler.json içinde "${kelime}" (${n}. geçiş) yok`);
};
const bas = (kelime: string, n = 1) => Math.round(bul(kelime, n).s * FPS);
const son = (kelime: string, n = 1) => Math.round(bul(kelime, n).e * FPS);
const ara = (f: number, a: number, b: number) => interpolate(f, [a, Math.max(a + 1, b)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// ---------------------------------------------------------------- ipuçları
const C = {
  sesimi: bas("sesimi"),
  yapay: bas("yapay"),
  alti1: bas("altı", 1),
  yeter: bas("yeter"),
  dedim: bas("dedim"),
  sonuc: bas("sonuç"),
  ses1: bas("ses", 1),
  burnumdan: bas("burnumdan"),
  konusuyorum: bas("konuşuyorum"),
  biraz: bas("biraz"),
  kalinB: bas("kalınlaştırdım"),
  kalinS: son("kalınlaştırdım"),
  boguldu: bas("boğuldu"),
  uc1: bas("üç", 1),
  uc2: bas("üç", 2),
  uc3: bas("üç", 3),
  ayni: bas("aynı"),
  olmamis: bas("olmamış"),
  sonra: bas("sonra"),
  fark1: bas("fark", 1),
  sorun: bas("sorun"),
  ayardaS: son("ayarda"),
  degil: bas("değil"),
  ornekB: bas("örnekteymiş"),
  ornekS: son("örnekteymiş"),
  alti2: bas("altı", 2),
  tonlama: bas("tonlama"),
  heyecan: bas("heyecan"),
  model: bas("model"),
  taklitS: son("ediyor"),
  otuz: bas("otuz"),
  sessiz: bas("sessiz"),
  canli: bas("canlı"),
  fark2: bas("fark", 2),
  ama: bas("ama", 2),
  ekran: bas("ekran"),
  sekiz: bas("sekiz"),
  kart1S: son("kart", 1),
  uzun: bas("uzun"),
  kaldiramadi: bas("kaldıramadı"),
  kisacasi: bas("kısacası"),
  klon: bas("klon"),
  kart2S: son("kart", 2),
  bende: bas("bende"),
  hazir: bas("hazır"),
  var: bas("var", 2),
  varS: son("var", 2),
};

// W.J. pozları (kelimeye bağlı)
const POZLAR: [number, Poz][] = ([
  [0, "normal"],
  [C.yeter, "gosteren"],
  [C.sonuc, "dusunen"],
  [C.burnumdan, "saskin"],
  [C.biraz, "dusunen"],
  [C.boguldu, "saskin"],
  [C.uc1, "normal"],
  [C.olmamis, "saskin"],
  [C.sonra, "dusunen"],
  [C.ornekB, "gosteren"],
  [C.model, "dusunen"],
  [C.otuz, "gosteren"],
  [C.fark2, "normal"],
  [C.ekran, "telefon"],
  [C.kaldiramadi, "saskin"],
  [C.kisacasi, "gosteren"],
  [C.bende, "omuz"],
] as [number, Poz][]).sort((a, b) => a[0] - b[0]);

const DAMGALAR = [C.konusuyorum, C.boguldu, C.olmamis, C.fark2, C.kart2S];

// ---------------------------------------------------------------- altyazı: noktalama ya da 4 kelimede böl
type Parca = { i0: number; i1: number };
const PARCALAR: Parca[] = (() => {
  const out: Parca[] = [];
  let i0 = 0;
  KELIMELER.forEach((k, i) => {
    const bitti = /[.,?:!]$/.test(k.w) || i - i0 === 3 || i === KELIMELER.length - 1;
    if (bitti) {
      out.push({ i0, i1: i });
      i0 = i + 1;
    }
  });
  return out;
})();

const Altyazi: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  let p: Parca | null = null;
  for (let j = 0; j < PARCALAR.length; j++) {
    const a = KELIMELER[PARCALAR[j].i0].s - 0.08;
    const b = j + 1 < PARCALAR.length ? KELIMELER[PARCALAR[j + 1].i0].s - 0.08 : Infinity;
    if (t >= a && t < b && t < KELIMELER[PARCALAR[j].i1].e + 1.2) p = PARCALAR[j];
  }
  if (!p) return null;
  const yas = f - Math.round(KELIMELER[p.i0].s * FPS);
  const kalk = interpolate(yas, [-3, 4], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1478, height: 170, display: "flex", alignItems: "center", justifyContent: "center", transform: `translateY(${kalk}px)` }}>
      <div style={{ fontFamily: SERIF, fontSize: 80, lineHeight: 1.04, textAlign: "center", color: RENK.murekkep }}>
        {KELIMELER.slice(p.i0, p.i1 + 1).map((k, i) => {
          const sonraki = KELIMELER[p!.i0 + i + 1];
          const simdi = t >= k.s - 0.04 && t < k.e + 0.3 && !(sonraki && t >= sonraki.s - 0.04);
          const gecti = t >= k.s - 0.04;
          return (
            <span key={i} style={{ color: simdi ? RENK.kirmizi : RENK.murekkep, opacity: gecti ? 1 : 0.32 }}>
              {k.w}
              {i < p!.i1 - p!.i0 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- yardımcı: küçük etiket
const Etiket: React.FC<{ metin: string; renk?: string; yas: number }> = ({ metin, renk = RENK.kirmizi, yas }) => {
  if (yas < 0) return null;
  const k = interpolate(yas, [0, 5], [0.6, 1], { extrapolateRight: "clamp" });
  return (
    <span style={{ display: "inline-block", fontFamily: MONO, fontSize: 32, color: renk, border: `3px solid ${renk}`, borderRadius: 8, padding: "2px 12px", marginRight: 14, transform: `scale(${k})`, opacity: Math.min(1, yas / 3) }}>
      {metin}
    </span>
  );
};

const DalgaKarti: React.FC<{ f: number; fps: number; giris: number; cikis: number; y: number; bilet: string; tur: DalgaTuru; renk: string; tohum: string; children?: React.ReactNode }> = ({
  f, fps, giris, cikis, y, bilet, tur, renk, tohum, children,
}) => (
  <Katman f={f} fps={fps} giris={giris} son={cikis} x={70} y={y} w={940}>
    <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
      <Bilet ust="AKTARMA" deger={bilet} seri={tohum === "a" ? "No 1907-06" : "No 1907-37"} w={250} degerBoy={78} />
      <div>
        <Dalga tur={tur} w={620} h={120} f={f} renk={renk} tohum={tohum} cubuk={44} />
        <div style={{ marginTop: 8, height: 40 }}>{children}</div>
      </div>
    </div>
  </Katman>
);

// ---------------------------------------------------------------- sahne
export const SidisShort01: React.FC<{ sesli?: boolean }> = ({ sesli = false }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // poz + sarsılma yaşı
  let poz: Poz = "normal";
  let pozF = 0;
  for (const [pf, p] of POZLAR) if (f >= pf) { poz = p; pozF = pf; }

  // damga sarsıntısı
  const sonDamga = DAMGALAR.filter((d) => f >= d).pop();
  const sars = sonDamga !== undefined && f - sonDamga < 8 ? Math.sin((f - sonDamga) * 2.6) * (8 - (f - sonDamga)) * 0.9 : 0;

  // Daktilo durumu
  const balonlar: { a: number; b: number }[] = [
    { a: C.ses1, b: C.uc1 },
    { a: C.ayni, b: C.sonra },
    { a: C.sonra, b: C.sorun },
    { a: C.model, b: C.otuz },
    { a: C.fark2, b: C.ama },
    { a: C.hazir, b: Infinity },
  ];
  const konusuyor = balonlar.some((x) => f >= x.a && f < Math.min(x.b, x.a + 45));
  let goz: Goz = Math.floor(f) % 83 < 3 ? "kirp" : "acik";
  if (f >= C.olmamis && f < C.sonra) goz = "uzgun";
  if (f >= C.var) goz = f - C.var < 20 || f >= SHORT01_KARE - 16 ? "kirpGoz" : "acik";
  const dkGiris = interpolate(f, [C.yapay, C.yapay + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dkZipla = f >= C.yapay ? Math.abs(Math.sin(Math.min(f - C.yapay, 18) * 0.35)) * Math.exp(-(f - C.yapay) / 8) * 30 : 0;

  // balon içeriği
  let balonIcerik: React.ReactNode = null;
  let balonA = -1;
  let balonB = -1;
  for (const b of balonlar) if (f >= b.a - 1 && f <= b.b + 8) { balonA = b.a; balonB = b.b; }
  if (balonA === C.ses1) {
    const tur: DalgaTuru = f >= C.boguldu ? "boguk" : f >= C.kalinB ? "boguk" : "burun";
    balonIcerik = (
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {tur === "burun" ? (
          <svg width={64} height={90} viewBox="0 0 64 90">
            <path d="M22 6 Q30 40 50 62 Q58 74 44 80 Q34 84 26 76 Q16 82 10 74" fill="none" stroke={RENK.murekkep} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        <Dalga tur={tur} w={tur === "burun" ? 290 : 350} h={100} f={f} renk={RENK.kirmizi} tohum="b" cubuk={30} />
      </div>
    );
  } else if (balonA === C.ayni) {
    balonIcerik = <DaktiloYazi metin="olmamış." ilerleme={ara(f, C.ayni, C.olmamis + 6)} f={f} boy={58} renk={RENK.kirmizi} />;
  } else if (balonA === C.sonra) {
    balonIcerik = <span style={{ fontFamily: SERIF, fontSize: 130, lineHeight: 1, color: RENK.kirmizi }}>?</span>;
  } else if (balonA === C.model) {
    balonIcerik = (
      <div style={{ textAlign: "center" }}>
        <DaktiloYazi metin="ne verirsen o." ilerleme={ara(f, C.model, C.taklitS)} f={f} boy={40} />
        <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
          <Dalga tur="duz" w={330} h={56} f={f} renk={RENK.mavi} tohum="a" cubuk={30} />
        </div>
      </div>
    );
  } else if (balonA === C.fark2) {
    balonIcerik = <Dalga tur="canli" w={360} h={110} f={f} renk={RENK.mavi} tohum="c" cubuk={30} />;
  } else if (balonA === C.hazir) {
    balonIcerik = (
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: 3, color: RENK.mavi }}>HAZIR SES</span>
        <Dalga tur="canli" w={200} h={90} f={f} renk={RENK.mavi} tohum="h" cubuk={18} />
      </div>
    );
  }

  // üç deneme sayacı
  const deneme = f >= C.uc3 ? 3 : f >= C.uc2 ? 2 : f >= C.uc1 ? 1 : 0;
  const denemeF = [C.uc1, C.uc2, C.uc3];

  // kalınlık
  const kalinlik = 0.32 + 0.52 * ara(f, C.kalinB, C.kalinS + 4);

  // bellek
  let gb = 0;
  if (f >= C.sekiz) gb = 6.6 * ara(f, C.sekiz, C.kart1S);
  if (f >= C.uzun) gb = 6.6 + 1.4 * ara(f, C.uzun, C.kaldiramadi);
  if (f >= C.kaldiramadi) gb = 8 + 1.1 * ara(f, C.kaldiramadi, C.kaldiramadi + 14);

  return (
    <AbsoluteFill style={{ background: RENK.kagit, overflow: "hidden" }}>
      <Kagit />

      {/* sabit başlık */}
      <div style={{ position: "absolute", left: 60, right: 60, top: 222, textAlign: "center", fontFamily: SERIF, fontSize: 92, lineHeight: 1.0 }}>
        <div style={{ color: RENK.murekkep }}>Sesimi klonladım.</div>
        <div style={{ color: RENK.kirmizi }}>Burnumdan konuşuyordum.</div>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 424, height: 9, borderTop: `4px solid ${RENK.murekkep}`, borderBottom: `1.5px solid ${RENK.murekkep}` }} />

      <div style={{ position: "absolute", inset: 0, transform: `translate(${sars}px, ${sars * 0.4}px)` }}>
        {/* ---------- 1–2: ses dosyası bileti + "6 sn" */}
        <Katman f={f} fps={fps} giris={C.sesimi} son={C.sonuc} x={80} y={478} aci={-2}>
          <Bilet ust="SES ÖRNEĞİ" deger="efe-ses.wav" seri="No 1907-01" w={560} degerBoy={60}>
            <div style={{ marginTop: 10 }}>
              <Dalga tur="canli" w={440} h={80} f={f} renk={RENK.mavi} tohum="s" cubuk={36} />
            </div>
          </Bilet>
        </Katman>
        <Katman f={f} fps={fps} giris={C.alti1} son={C.sonuc} x={690} y={500} aci={5}>
          <Bilet ust="SÜRE" deger="6 sn" seri="No 0006" w={290} degerBoy={110} degerRenk={RENK.kirmizi} />
        </Katman>
        <Katman f={f} fps={fps} giris={C.yeter} son={C.sonuc} x={700} y={720} aci={-3}>
          <span style={{ fontFamily: MONO, fontSize: 34, color: RENK.murekkep }}>“yeter” dedim.</span>
        </Katman>

        {/* ---------- 3: burun sesi damgası */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center", opacity: f < C.biraz ? 1 : 0 }}>
          <Damga id="burun" metin="BURUN SESİ" yas={f - C.konusuyorum} boy={96} aci={-7} />
        </div>

        {/* ---------- 4: kalınlık kaydırıcısı + BOĞUK */}
        <Katman f={f} fps={fps} giris={C.biraz} son={C.uc1} x={100} y={490} w={880}>
          <Kaydirici deger={kalinlik} w={880} />
        </Katman>
        <div style={{ position: "absolute", left: 560, top: 690, opacity: f < C.uc1 ? 1 : 0 }}>
          <Damga id="boguk" metin="BOĞUK" yas={f - C.boguldu} boy={88} aci={6} />
        </div>

        {/* ---------- 5: üç deneme + sayaç + OLMAMIŞ */}
        {denemeF.map((df, i) => (
          <Katman key={i} f={f} fps={fps} giris={df} son={C.sonra} x={80 + i * 316} y={480} w={290}>
            <div style={{ position: "relative", height: 190, background: RENK.kagitAcik, border: `4px solid ${RENK.murekkep}`, borderRadius: 26, padding: "14px 20px", boxSizing: "border-box" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 22, letterSpacing: 3, color: RENK.murekkep }}>{["AYAR", "DENEME", "KERE"][i]} {i + 1}</div>
              <div style={{ marginTop: 14 }}>
                <Dalga tur={i === 1 ? "boguk" : "burun"} w={240} h={84} f={f + i * 9} renk={RENK.murekkep} tohum={"t" + i} cubuk={20} />
              </div>
              {f >= C.olmamis + i * 3 && (
                <svg width={290} height={190} style={{ position: "absolute", left: -4, top: -4, overflow: "visible" }}>
                  <line x1={14} y1={176} x2={14 + 262 * ara(f, C.olmamis + i * 3, C.olmamis + i * 3 + 5)} y2={176 - 162 * ara(f, C.olmamis + i * 3, C.olmamis + i * 3 + 5)} stroke={RENK.kirmizi} strokeWidth={9} strokeLinecap="round" />
                </svg>
              )}
            </div>
          </Katman>
        ))}
        <Katman f={f} fps={fps} giris={C.uc1} son={C.olmamis - 2} x={120} y={730} aci={-3}>
          <Bilet ust="DENEME SAYACI" deger={`×${deneme}`} seri={`No 000${deneme}`} w={420} degerBoy={110} degerRenk={RENK.kirmizi} />
        </Katman>
        <div style={{ position: "absolute", left: 0, right: 0, top: 690, display: "flex", justifyContent: "center", opacity: f < C.sonra ? 1 : 0 }}>
          <Damga id="olmamis" metin="OLMAMIŞ" yas={f - C.olmamis} boy={130} aci={-7} />
        </div>

        {/* ---------- 6: not kâğıdı "sorun: örnek" */}
        <Katman f={f} fps={fps} giris={C.sorun} son={C.alti2} x={170} y={540} w={740} aci={-2}>
          <div style={{ position: "relative", background: "#FBF8EF", border: `4px solid ${RENK.murekkep}`, padding: "50px 46px 40px", boxShadow: "7px 8px 0 rgba(27,26,23,0.13)" }}>
            <div style={{ position: "absolute", left: 270, top: -22, width: 150, height: 40, background: "rgba(200,180,130,0.75)", transform: "rotate(-4deg)", border: `2px solid rgba(27,26,23,0.25)` }} />
            <div style={{ position: "relative", display: "inline-block" }}>
              <DaktiloYazi metin="sorun: ayar" ilerleme={ara(f, C.sorun, C.ayardaS)} f={f} boy={58} imlec={f < C.ornekB} />
              {f >= C.degil && (
                <div style={{ position: "absolute", left: -6, top: "52%", height: 7, width: `${104 * ara(f, C.degil, C.degil + 6)}%`, background: RENK.kirmizi, borderRadius: 4 }} />
              )}
            </div>
            <div style={{ marginTop: 18, minHeight: 72 }}>
              {f >= C.ornekB && <DaktiloYazi metin="sorun: örnek" ilerleme={ara(f, C.ornekB, C.ornekS + 4)} f={f} boy={58} renk={RENK.mavi} />}
            </div>
          </div>
        </Katman>

        {/* ---------- 7–8: düz dalga vs canlı dalga */}
        <DalgaKarti f={f} fps={fps} giris={C.alti2} cikis={C.ama} y={462} bilet="6 sn" tur="duz" renk={RENK.murekkep} tohum="a">
          <Etiket metin="tonlama: yok" yas={f - C.tonlama} />
          <Etiket metin="heyecan: yok" yas={f - C.heyecan} />
        </DalgaKarti>
        <DalgaKarti f={f} fps={fps} giris={C.otuz} cikis={C.ama} y={680} bilet="37 sn" tur="canli" renk={RENK.mavi} tohum="c">
          <Etiket metin="sessiz oda" renk={RENK.mavi} yas={f - C.sessiz} />
          <Etiket metin="canlı" renk={RENK.mavi} yas={f - C.canli} />
        </DalgaKarti>
        <div style={{ position: "absolute", left: 770, top: 776, opacity: f >= C.fark2 && f < C.ama ? 1 : 0 }}>
          <Damga id="dogru" metin="DOĞRU" yas={f - C.fark2} boy={60} aci={-8} renk={RENK.mavi} />
        </div>

        {/* ---------- 9: ekran kartı */}
        <Katman f={f} fps={fps} giris={C.ama} son={C.kisacasi} x={120} y={470} w={840}>
          <EkranKarti f={f} gb={gb} w={840} etiket={f >= C.sekiz} donuyor={f >= C.uzun} />
        </Katman>

        {/* ---------- 10–11: kural.txt */}
        <Katman f={f} fps={fps} giris={C.kisacasi} x={90} y={480} w={900}>
          <Pencere baslik="kural.txt" w={900}>
            <div style={{ minHeight: 64 }}>
              <DaktiloYazi metin="klon = iyi kayıt + iyi kart" ilerleme={ara(f, C.klon, C.kart2S)} f={f} boy={46} imlec={f < C.bende} />
            </div>
            <div style={{ minHeight: 64, marginTop: 14 }}>
              {f >= C.bende && <DaktiloYazi metin="kart yoksa → hazır ses" ilerleme={ara(f, C.bende, C.varS)} f={f} boy={46} renk={RENK.kirmizi} />}
            </div>
          </Pencere>
        </Katman>

        <div style={{ position: "absolute", left: 110, top: 790 }}>
          <Damga id="kural" metin="KURAL" yas={f - C.kart2S} boy={60} aci={-6} />
        </div>

        {/* ---------- zemin (masa) çizgisi */}
        <div style={{ position: "absolute", left: 50, right: 50, top: 1436, height: 10, borderTop: `5px solid ${RENK.murekkep}`, borderBottom: `2px solid ${RENK.murekkep}`, opacity: 0.9 }} />

        {/* ---------- W.J. */}
        <div style={{ position: "absolute", left: 70, top: 1446 - 540, width: 300, height: 540 }}>
          <WJ poz={poz} yas={f - pozF} f={f} boy={540} gulumse={f >= C.fark2 && f < C.ekran} fikir={f - C.fark1} />
        </div>

        {/* ---------- Daktilo + balonu */}
        <div style={{ position: "absolute", left: 640, top: 1442 - 360 + dkGiris * 420 - dkZipla, width: 380, opacity: f >= C.yapay - 1 ? 1 : 0 }}>
          <Daktilo f={f} boy={380} konusuyor={konusuyor} goz={goz} bak={poz === "saskin" ? [-8, -4] : [-7, 2]} />
        </div>
        {balonIcerik && (
          <Katman f={f} fps={fps} giris={balonA} son={balonB} x={540} y={884} w={470}>
            <Balon w={470} h={170} kuyrukX={300}>
              {balonIcerik}
            </Balon>
          </Katman>
        )}
      </div>

      <Altyazi f={f} />

      {/* künye */}
      <div style={{ position: "absolute", left: 64, top: 1694, fontFamily: SANS, fontWeight: 600, fontSize: 26, letterSpacing: 1, color: RENK.murekkep, opacity: 0.72 }}>
        W.J. Sidis · Defter, s. 1
      </div>

      {sesli && <Audio src={staticFile("ses-01.wav")} />}
      {sesli && <Audio src={staticFile("muzik.wav")} volume={0.08} />}
    </AbsoluteFill>
  );
};

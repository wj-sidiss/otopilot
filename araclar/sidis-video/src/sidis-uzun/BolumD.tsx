// Kısım D — "IV · Bir videonun yapılışı" (bölüm 31–46).
// 31–34: pilot kısa videonun yapılışı (vuruş planı, yapımcı + denetçi ajan, düzeltmeler, gerçek önizleme kareleri)
// 35–41: yedi adımlık yol haritası (yedi aktarma bileti tek tek delinir)
// 42–46: okuyucu soruları sütunu
// Bütün ipuçları zaman.json'dan (bölüm, cümle) ile okunur: c(b,n), cs(b,n), ve cümle içi oran için z(b,n,p).
import React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import {
  AltCizgi, Balon, Daire, Daktilo, Dalga, Damga, FPS, GercekRozet, Gir, Goz, MONO, Manset, Ok, Pencere, Poz, RENK, SANS, SERIF, UstunuCiz, WJ,
  ara, c, cs, giris, k, yerTutucular,
} from "./Ortak";

// ---------------------------------------------------------------- zaman yardımcıları
/** b. bölüm n. cümlenin içinde p oranındaki an (saniye) — sabit saniye değil, cümle süresine orantılı */
const z = (b: number, n: number, p = 0) => c(b, n) + (cs(b, n) - c(b, n)) * p;
const pilot = (n: number) => staticFile(`d/pilot_${String(n).padStart(2, "0")}.png`);
const saniyeKare = (n: number) => staticFile(`d/s/${String(n).padStart(2, "0")}.png`);

// ---------------------------------------------------------------- küçük parçalar
const Yazi: React.FC<{ boy?: number; renk?: string; font?: "serif" | "sans" | "mono"; children: React.ReactNode; stil?: React.CSSProperties }> = ({ boy = 40, renk = RENK.murekkep, font = "serif", children, stil }) => (
  <div style={{ fontFamily: font === "serif" ? SERIF : font === "mono" ? MONO : SANS, fontWeight: font === "sans" ? 600 : 400, fontSize: boy, lineHeight: 1.15, color: renk, ...stil }}>{children}</div>
);

/** Damga'yı mutlak konuma, saniyeli ipucuyla yerleştirir */
const DamgaAt: React.FC<{ id: string; x: number; y: number; bas: number; metin: string; boy?: number; aci?: number; son?: number; renk?: string }> = ({ id, x, y, bas, metin, boy = 84, aci = -8, son, renk }) => {
  const f = useCurrentFrame();
  if (son !== undefined && f > k(son) + 8) return null;
  const op = son === undefined ? 1 : 1 - ara(f, k(son), k(son) + 8);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: op }}>
      <Damga id={id} metin={metin} yas={f - k(bas)} boy={boy} aci={aci} renk={renk} />
    </div>
  );
};

/** aktarma bileti (Bilet'in iri yazılı hali: tüm yazılar ≥34px) */
const Kupon: React.FC<{ ust?: string; deger: string; w?: number; boy?: number; renk?: string }> = ({ ust, deger, w = 320, boy = 68, renk = RENK.murekkep }) => {
  const yarim = (top: boolean) => (
    <div style={{ position: "absolute", left: 46 - 11, [top ? "top" : "bottom"]: -13, width: 22, height: 22, borderRadius: 11, background: RENK.kagit, border: `3px solid ${RENK.murekkep}`, clipPath: top ? "inset(50% 0 0 0)" : "inset(0 0 50% 0)" } as React.CSSProperties} />
  );
  return (
    <div style={{ position: "relative", width: w, background: RENK.bilet, border: `3.5px solid ${RENK.murekkep}`, borderRadius: 10, display: "flex", boxShadow: "5px 6px 0 rgba(27,26,23,0.12)" }}>
      <div style={{ width: 46, borderRight: `3px dashed ${RENK.murekkep}` }} />
      <div style={{ flex: 1, padding: "10px 16px 12px 18px" }}>
        {ust && <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 1, color: RENK.murekkep, opacity: 0.78, lineHeight: 1.1 }}>{ust}</div>}
        <div style={{ fontFamily: SERIF, fontSize: boy, lineHeight: 1.05, color: renk }}>{deger}</div>
      </div>
      {yarim(true)}
      {yarim(false)}
    </div>
  );
};

/** dikey telefon çerçevesinde gerçek pilot önizleme kareleri (çapraz geçişli) */
const PilotOynat: React.FC<{ kareler: number[]; bas: number; son: number; w: number; rozet?: string }> = ({ kareler, bas, son, w, rozet = "gerçek önizleme karesi" }) => {
  const f = useCurrentFrame();
  const t = ara(f, k(bas), k(son)) * kareler.length;
  const i = Math.min(kareler.length - 1, Math.floor(t));
  const gec = i + 1 < kareler.length ? interpolate(t - i, [0.75, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const h = Math.round((w * 16) / 9);
  return (
    <div style={{ position: "relative", width: w }}>
      <div style={{ position: "relative", width: w, height: h, border: `6px solid ${RENK.murekkep}`, borderRadius: 28, overflow: "hidden", background: RENK.kagitAcik, boxShadow: "8px 10px 0 rgba(27,26,23,0.16)" }}>
        <Img src={pilot(kareler[i])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        {gec > 0 && <Img src={pilot(kareler[i + 1])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: gec }} />}
      </div>
      {rozet && (
        <div style={{ position: "absolute", left: -30, bottom: -24 }}>
          <GercekRozet metin={rozet} />
        </div>
      )}
    </div>
  );
};

/** üst künye satırı (31–34) */
const Ust: React.FC<{ b: number; metin: string }> = ({ b, metin }) => (
  <Gir bas={giris(b) + 0.15} x={120} y={112} w={1680}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 22, fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 2 }}>
      <span style={{ color: RENK.kirmizi }}>No. {b}</span>
      <span style={{ color: RENK.murekkep, opacity: 0.75 }}>{metin.toLocaleUpperCase("tr")}</span>
    </div>
    <div style={{ borderTop: `3px solid ${RENK.murekkep}`, borderBottom: `1px solid ${RENK.murekkep}`, height: 5, marginTop: 10 }} />
  </Gir>
);

/** masa + Daktilo + isim levhası (ajanlar) */
const Masa: React.FC<{ ad: string; f: number; konusuyor: boolean; goz?: Goz; bak?: [number, number]; vurgu?: boolean; mercek?: boolean }> = ({ ad, f, konusuyor, goz = "acik", bak, vurgu, mercek }) => (
  <div style={{ position: "relative", width: 480, height: 520 }}>
    <div style={{ position: "absolute", left: 60, top: 0 }}>
      <Daktilo f={f} boy={360} konusuyor={konusuyor} goz={goz} bak={bak} />
    </div>
    <svg width={480} height={240} style={{ position: "absolute", left: 0, top: 320, overflow: "visible" }}>
      <rect x={6} y={10} width={468} height={26} rx={4} fill={RENK.kagitKoyu} stroke={RENK.murekkep} strokeWidth={5} />
      <path d="M40 36 L52 200 M440 36 L428 200 M60 120 L420 120" fill="none" stroke={RENK.murekkep} strokeWidth={5} strokeLinecap="round" />
    </svg>
    <div style={{ position: "absolute", left: 90, top: 372, width: 300, textAlign: "center", padding: "6px 0 8px", background: RENK.kagitAcik, border: `4px solid ${vurgu ? RENK.kirmizi : RENK.murekkep}`, borderRadius: 6, fontFamily: SANS, fontWeight: 600, fontSize: 38, letterSpacing: 4, color: vurgu ? RENK.kirmizi : RENK.murekkep }}>
      {ad}
    </div>
    {mercek && (
      <svg width={160} height={160} style={{ position: "absolute", left: 360, top: 60, overflow: "visible" }}>
        <circle cx={60} cy={60} r={46} fill={`${RENK.mavi}18`} stroke={RENK.murekkep} strokeWidth={7} />
        <path d="M94 94 L140 140" stroke={RENK.murekkep} strokeWidth={14} strokeLinecap="round" />
      </svg>
    )}
  </div>
);

/** elle çizilmiş onay işareti (kalemle çizilerek gelir) */
const Tik: React.FC<{ p: number; boy?: number; renk?: string }> = ({ p, boy = 44, renk = RENK.kirmizi }) => (
  <svg width={boy} height={boy} viewBox="0 0 44 44" style={{ overflow: "visible", flex: "none" }}>
    <rect x={3} y={3} width={38} height={38} rx={5} fill="none" stroke={RENK.murekkep} strokeWidth={3.5} />
    <path d="M10 22 L19 32 L38 4" fill="none" stroke={renk} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
  </svg>
);

/** mürekkep büyüteç */
const Mercek: React.FC<{ boy?: number }> = ({ boy = 150 }) => (
  <svg width={boy} height={boy} viewBox="0 0 150 150" style={{ overflow: "visible" }}>
    <circle cx={58} cy={58} r={46} fill={`${RENK.kagitAcik}66`} stroke={RENK.murekkep} strokeWidth={7} />
    <path d="M30 44 Q38 30 54 26" fill="none" stroke={RENK.murekkep} strokeWidth={3} opacity={0.5} />
    <path d="M92 92 L138 138" stroke={RENK.murekkep} strokeWidth={15} strokeLinecap="round" />
  </svg>
);

// ---------------------------------------------------------------- önce / sonra mini eskizler (200×150 tuval)
const EW = 300;
const EH = 170;
const Eskiz: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={EW} height={EH} viewBox={`0 0 ${EW} ${EH}`} style={{ display: "block", overflow: "visible" }}>
    {children}
  </svg>
);
const ink = { fill: "none", stroke: RENK.murekkep, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** zaman çizgisi: nesnenin bitişi yok / var */
const EskizBitis: React.FC<{ sonra: boolean }> = ({ sonra }) => (
  <Eskiz>
    <line x1={20} y1={120} x2={250} y2={120} {...ink} />
    {Array.from({ length: 9 }, (_, i) => <line key={i} x1={20 + i * 28.75} y1={112} x2={20 + i * 28.75} y2={128} {...ink} strokeWidth={3} />)}
    <line x1={250} y1={60} x2={250} y2={140} stroke={RENK.murekkep} strokeWidth={4} strokeDasharray="6 6" />
    <rect x={40} y={56} width={sonra ? 170 : 250} height={30} rx={6} fill={sonra ? RENK.mavi : RENK.kirmizi} opacity={0.85} />
    {sonra ? (
      <line x1={210} y1={44} x2={210} y2={98} stroke={RENK.murekkep} strokeWidth={6} strokeLinecap="round" />
    ) : (
      <path d="M290 71 L270 58 M290 71 L270 84" {...ink} stroke={RENK.kirmizi} strokeWidth={5} />
    )}
  </Eskiz>
);

/** düşünen poz: el kafanın arkasında / önünde */
const EskizEl: React.FC<{ sonra: boolean }> = ({ sonra }) => {
  const el = <circle cx={sonra ? 196 : 194} cy={sonra ? 110 : 50} r={20} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} strokeDasharray={sonra ? undefined : "5 5"} />;
  return (
    <Eskiz>
      {!sonra && el}
      <path d="M90 168 Q150 118 210 168" {...ink} />
      <circle cx={150} cy={80} r={46} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} />
      <path d="M106 66 Q104 26 150 24 Q196 26 194 62 Q150 52 106 66 Z" fill={RENK.murekkep} />
      <circle cx={136} cy={84} r={11} {...ink} strokeWidth={3} />
      <circle cx={164} cy={84} r={11} {...ink} strokeWidth={3} />
      <path d={`M206 168 Q${sonra ? 220 : 236} ${sonra ? 140 : 110} ${sonra ? 196 : 206} ${sonra ? 126 : 66}`} {...ink} strokeWidth={6} />
      {sonra && el}
    </Eskiz>
  );
};

/** damga denemelerin üstünde / altında */
const EskizDamga: React.FC<{ sonra: boolean }> = ({ sonra }) => (
  <Eskiz>
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={30 + i * 84} y={22} width={70} height={56} rx={6} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={4} />
        <path d={`M${42 + i * 84} 52 q10 -14 20 0 t20 0 t12 0`} {...ink} stroke={RENK.mavi} strokeWidth={3} />
      </g>
    ))}
    <g transform={sonra ? "translate(0 92) rotate(-4 150 30)" : "translate(0 18) rotate(-6 150 30)"}>
      <rect x={70} y={6} width={160} height={52} rx={6} fill={`${RENK.kirmizi}${sonra ? "22" : "CC"}`} stroke={RENK.kirmizi} strokeWidth={5} />
      <rect x={80} y={16} width={140} height={32} rx={3} fill="none" stroke={RENK.kirmizi} strokeWidth={2.5} />
    </g>
  </Eskiz>
);

/** altyazıda iki kelime aynı anda kırmızı / tek kelime */
const EskizAltyazi: React.FC<{ sonra: boolean }> = ({ sonra }) => (
  <Eskiz>
    <line x1={10} y1={150} x2={290} y2={150} {...ink} strokeWidth={2} opacity={0.4} />
    <text x={150} y={100} textAnchor="middle" fontFamily={SERIF} fontSize={56}>
      <tspan fill={RENK.kirmizi}>üç </tspan>
      <tspan fill={sonra ? RENK.murekkep : RENK.kirmizi} opacity={sonra ? 0.4 : 1}>deneme</tspan>
    </text>
  </Eskiz>
);

/** göz kırpma işaretleri zaman çizgisinde: her yerde / yalnız sonda */
const EskizGoz: React.FC<{ sonra: boolean }> = ({ sonra }) => {
  const yerler = sonra ? [236, 262] : [34, 70, 104, 140, 172, 208, 236, 262];
  return (
    <Eskiz>
      <line x1={20} y1={120} x2={280} y2={120} {...ink} />
      {sonra && <rect x={222} y={100} width={58} height={40} fill={`${RENK.mavi}22`} stroke={RENK.mavi} strokeWidth={3} />}
      {yerler.map((x) => (
        <path key={x} d={`M${x - 13} 70 Q${x} 54 ${x + 13} 70`} {...ink} stroke={RENK.kirmizi} strokeWidth={5} />
      ))}
    </Eskiz>
  );
};

/** açık el: ince pençe / kalın parmak */
const EskizParmak: React.FC<{ sonra: boolean }> = ({ sonra }) => {
  const a = [-0.62, -0.2, 0.2, 0.62];
  const cx = 150, cy = 110;
  return (
    <Eskiz>
      <path d="M150 168 L150 128" {...ink} strokeWidth={22} />
      <path d="M150 168 L150 128" fill="none" stroke={RENK.kagitKoyu} strokeWidth={14} strokeLinecap="round" />
      {a.map((d, i) => {
        const x2 = cx + Math.cos(-Math.PI / 2 + d) * 70, y2 = cy + Math.sin(-Math.PI / 2 + d) * 70;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={RENK.murekkep} strokeWidth={sonra ? 24 : 7} strokeLinecap="round" />
            {sonra && <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={RENK.kagitAcik} strokeWidth={13} strokeLinecap="round" />}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={28} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} />
    </Eskiz>
  );
};

/** başlık + ÖNCE | SONRA kartı. sonraBas'ta SONRA paneli gelir. */
const OnceSonra: React.FC<{ baslik: string; neden?: string; once: React.ReactNode; sonra: React.ReactNode; sonraBas: number; w?: number }> = ({ baslik, neden, once, sonra, sonraBas, w = 1000 }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - k(sonraBas), fps: FPS, config: { damping: 14, stiffness: 170 } });
  const panel = (ad: string, renk: string, icerik: React.ReactNode, op = 1, ty = 0) => (
    <div style={{ opacity: op, transform: `translateY(${ty}px)` }}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 3, color: renk, marginBottom: 6 }}>{ad}</div>
      <div style={{ border: `3px solid ${renk}`, borderRadius: 10, background: RENK.kagitAcik, padding: "10px 14px" }}>{icerik}</div>
    </div>
  );
  return (
    <div style={{ width: w, background: `${RENK.kagitAcik}D0`, border: `4px solid ${RENK.murekkep}`, borderRadius: 14, padding: "16px 26px 22px", boxShadow: "7px 8px 0 rgba(27,26,23,0.13)" }}>
      <div style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.1, color: RENK.murekkep }}>{baslik}</div>
      {neden && <div style={{ fontFamily: MONO, fontSize: 34, color: RENK.kirmizi, marginTop: 2 }}>{neden}</div>}
      <div style={{ display: "flex", gap: 28, marginTop: 12, alignItems: "flex-end" }}>
        {panel("ÖNCE", RENK.kirmizi, once)}
        <svg width={60} height={40} style={{ marginBottom: 80, opacity: f >= k(sonraBas) ? 1 : 0.2 }}>
          <path d="M4 20 H52 M38 6 L54 20 L38 34" {...ink} strokeWidth={5} />
        </svg>
        {f >= k(sonraBas) - 1 ? panel("SONRA", RENK.mavi, sonra, Math.min(1, sp * 1.5), (1 - sp) * -30) : <div style={{ width: EW + 34 }} />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 31 · vuruş planı
const S31: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const B = c(b, 4); // tablo evresi
  const satir = (y: number, bas: number, kelime: string, aciklama: string, sag: React.ReactNode) => (
    <Gir bas={bas} x={120} y={y} w={1680}>
      <div style={{ display: "flex", alignItems: "center", height: 190, borderBottom: `2px solid ${RENK.murekkep}55` }}>
        <div style={{ width: 560, fontFamily: SERIF, fontSize: 58, color: RENK.kirmizi, lineHeight: 1.05 }}>“{kelime}”</div>
        <div style={{ width: 640, fontFamily: SERIF, fontSize: 42, color: RENK.murekkep, lineHeight: 1.15 }}>{aciklama}</div>
        <div style={{ position: "relative", width: 480, height: 190 }}>{sag}</div>
      </div>
    </Gir>
  );
  return (
    <>
      <Ust b={b} metin="Pilot kısa video · yapılış" />
      {/* evre A: konu + senaryo */}
      <Gir bas={c(b, 1) + 0.2} son={B} x={120} y={230} w={1100}>
        <Manset metin="İlk kısa video, baştan sona." bas={c(b, 1) + 0.3} boy={92} />
      </Gir>
      <Gir bas={z(b, 1, 0.45)} son={B} x={1420} y={200} w={330}>
        <PilotOynat kareler={[1, 2, 4, 6, 7, 9, 12, 13]} bas={z(b, 1, 0.45)} son={B} w={330} />
      </Gir>
      <Ok x1={1080} y1={300} x2={1380} y2={400} bas={z(b, 1, 0.6)} son={c(b, 2)} egri={-0.2} />
      <Gir bas={c(b, 2)} son={B} x={120} y={410} w={1160}>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 3, color: RENK.murekkep, opacity: 0.7, marginBottom: 6 }}>KONU</div>
        <div style={{ borderLeft: `6px solid ${RENK.kirmizi}`, paddingLeft: 26 }}>
          <Yazi boy={70}>Sesimi klonladım.</Yazi>
          <Yazi boy={70} renk={RENK.kirmizi}>Burnumdan konuşuyordum.</Yazi>
        </div>
      </Gir>
      <Gir bas={c(b, 3)} son={B} x={120} y={700} aci={-2}>
        <Kupon ust="SENARYO" deger="40 sn" w={330} />
      </Gir>
      <Gir bas={z(b, 3, 0.45)} son={B} x={500} y={714} aci={2}>
        <Kupon ust="KELİME" deger="yüze yakın" w={400} />
      </Gir>
      {/* evre B: kelime → olay tablosu */}
      <Gir bas={B} x={120} y={200} w={1680}>
        <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: 36, letterSpacing: 3, paddingBottom: 10, borderBottom: `4px solid ${RENK.murekkep}` }}>
          <div style={{ width: 560 }}>KELİME</div>
          <div style={{ width: 640 }}>EKRANDA OLAN</div>
          <div style={{ fontFamily: MONO, fontWeight: 400, fontSize: 34, color: RENK.mavi, letterSpacing: 0 }}>sahne-plani.md</div>
        </div>
      </Gir>
      <Ok x1={330} y1={226} x2={660} y2={226} bas={c(b, 5)} egri={-0.18} />
      <AltCizgi x={120} y={268} w={190} bas={z(b, 5, 0.3)} />
      <Gir bas={c(b, 5)} son={c(b, 6)} x={700} y={420} w={900}>
        <Yazi boy={60} stil={{ textAlign: "center" }}>
          her vuruş <span style={{ color: RENK.kirmizi }}>=</span> bir kelime
        </Yazi>
      </Gir>
      {satir(290, c(b, 6), "altı saniyelik", "tramvay bileti gelir, üstünde 6 sn", (
        <div style={{ position: "absolute", left: 40, top: 30 }}>
          <Kupon ust="AKTARMA" deger="6 sn" w={260} />
        </div>
      ))}
      <Daire x={150} y={350} w={390} h={70} bas={z(b, 6, 0.55)} tohum="31a" son={c(b, 7)} />
      {satir(480, c(b, 7), "burnumdan konuşuyorum", "W.J. şaşırır, kırmızı damga vurulur", (
        <>
          <div style={{ position: "absolute", left: 10, top: -6 }}>
            <WJ poz="saskin" yas={f - k(c(b, 7))} f={f} boy={200} />
          </div>
          <div style={{ position: "absolute", left: 180, top: 60 }}>
            <Damga id="d31b" metin="DAMGA" yas={f - k(z(b, 7, 0.5))} boy={50} aci={-10} />
          </div>
        </>
      ))}
      {satir(670, c(b, 8), "olmamış", "koca damga iner, üç denemenin üstü çizilir", (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: "absolute", left: 20 + i * 150, top: 50, width: 130, height: 90, border: `3px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.kagitAcik, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 34 }}>
              {i + 1}
            </div>
          ))}
          <div style={{ position: "absolute", left: 60, top: 40 }}>
            <Damga id="d31c" metin="OLMAMIŞ" yas={f - k(z(b, 8, 0.4))} boy={56} aci={-9} />
          </div>
        </>
      ))}
      <UstunuCiz x={1330} y={790} w={460} bas={z(b, 8, 0.7)} />
    </>
  );
};

// ---------------------------------------------------------------- 32 · yapımcı ajan
const S32: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const isler = ["sahneyi kurdu", "karakterleri çizdi", "damgaları", "biletleri", "daktilo yazısını yaptı"];
  const s3 = c(b, 3), s3s = cs(b, 3);
  return (
    <>
      <Ust b={b} metin="İki ajan · 1: yapımcı" />
      <Gir bas={c(b, 1)} x={140} y={300}>
        <Masa ad="YAPIMCI" f={f} konusuyor={f >= k(c(b, 2)) && f < k(cs(b, 4))} vurgu={f >= k(c(b, 2))} />
      </Gir>
      <Gir bas={z(b, 1, 0.3)} son={c(b, 2) + 0.2} x={1200} y={300}>
        <Masa ad="DENETÇİ" f={f} konusuyor={false} />
      </Gir>
      <Gir bas={c(b, 1)} son={c(b, 2)} x={870} y={420}>
        <Yazi boy={140}>+</Yazi>
      </Gir>
      <Daire x={226} y={668} w={308} h={70} bas={z(b, 2, 0.15)} son={c(b, 3)} tohum="32a" />
      {/* yaptıkları */}
      {isler.map((m, i) => {
        const t = s3 + ((s3s - s3) * i) / isler.length;
        return (
          <Gir key={m} bas={t} son={c(b, 4)} x={820} y={210 + i * 74}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Tik p={ara(f, k(t) + 4, k(t) + 12)} />
              <Yazi boy={48}>{m}</Yazi>
            </div>
          </Gir>
        );
      })}
      <Gir bas={z(b, 3, 0.2)} son={c(b, 4)} x={1450} y={560}>
        <WJ poz="gosteren" yas={f - k(z(b, 3, 0.2))} f={f} boy={300} />
      </Gir>
      <DamgaAt id="d32a" x={830} y={640} bas={z(b, 3, 0.45)} son={c(b, 4)} metin="ÖRNEK" boy={64} />
      <Gir bas={z(b, 3, 0.65)} son={c(b, 4)} x={1060} y={800} aci={-3}>
        <Kupon ust="AKTARMA" deger="6 sn" w={260} />
      </Gir>
      {/* 14 kare */}
      {Array.from({ length: 14 }, (_, i) => {
        const t = z(b, 4, 0.05 + 0.5 * (i / 14));
        const flas = 1 - ara(f, k(t), k(t) + 6);
        return (
          <Gir key={i} bas={t} son={c(b, 5)} x={820 + (i % 7) * 140} y={220 + Math.floor(i / 7) * 240}>
            <div style={{ position: "relative", width: 124, height: 220, border: `3px solid ${RENK.murekkep}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              <Img src={saniyeKare(1 + Math.round((i * 38) / 13))} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flas * 0.9 }} />
            </div>
          </Gir>
        );
      })}
      <Gir bas={z(b, 4, 0.3)} son={c(b, 5)} x={820} y={730} aci={-2}>
        <Kupon ust="KENDİ KARELERİ" deger="14 kare" w={400} />
      </Gir>
      <Gir bas={z(b, 4, 0.6)} son={c(b, 5)} x={1270} y={760} w={560}>
        <Yazi boy={40} font="mono" renk={RENK.kirmizi}>kendi hatalarını düzeltti</Yazi>
      </Gir>
      {/* düzeltmeler */}
      <Gir bas={c(b, 5)} x={760} y={200}>
        <OnceSonra baslik="Son karelerde video çöküyordu" neden={f >= k(z(b, 5, 0.45)) ? "neden: nesnelerin bitiş zamanı yok" : " "} once={<EskizBitis sonra={false} />} sonra={<EskizBitis sonra />} sonraBas={c(b, 6)} w={1060} />
      </Gir>
      <DamgaAt id="d32b" x={1556} y={390} bas={z(b, 6, 0.3)} metin="DÜZELDİ" boy={48} aci={-7} />
      <Gir bas={c(b, 7)} x={760} y={615}>
        <OnceSonra baslik="Düşünen poz: el kafanın arkasında" once={<EskizEl sonra={false} />} sonra={<EskizEl sonra />} sonraBas={c(b, 8)} w={1060} />
      </Gir>
      <DamgaAt id="d32c" x={1556} y={800} bas={z(b, 8, 0.3)} metin="DÜZELDİ" boy={48} aci={-5} />
    </>
  );
};

// ---------------------------------------------------------------- 33 · denetçi ajan
const S33: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const B = c(b, 5);
  const s3 = c(b, 3), s3s = cs(b, 3);
  const gorulen = Math.round(ara(f, k(s3), k(s3s)) * 39);
  const kartlar: { baslik: string; once: React.ReactNode; sonra: React.ReactNode; n: number }[] = [
    { baslik: "Damga denemeleri kapatıyordu", once: <EskizDamga sonra={false} />, sonra: <EskizDamga sonra />, n: 5 },
    { baslik: "Altyazıda iki kelime birden yanıyordu", once: <EskizAltyazi sonra={false} />, sonra: <EskizAltyazi sonra />, n: 6 },
    { baslik: "Daktilo sürekli göz kırpıyordu", once: <EskizGoz sonra={false} />, sonra: <EskizGoz sonra />, n: 7 },
    { baslik: "Açık eller pençe gibiydi", once: <EskizParmak sonra={false} />, sonra: <EskizParmak sonra />, n: 8 },
  ];
  return (
    <>
      <Ust b={b} metin="İki ajan · 2: denetçi" />
      <Gir bas={c(b, 1)} son={B} x={120} y={330}>
        <Masa ad="DENETÇİ" f={f} konusuyor={f >= k(c(b, 4)) && f < k(cs(b, 4))} goz={f >= k(c(b, 2)) && f < k(c(b, 3)) ? "kirp" : "acik"} bak={[4, 2]} mercek={f >= k(z(b, 1, 0.4))} vurgu />
      </Gir>
      <Gir bas={c(b, 1) + 0.2} son={B} x={700} y={200} w={1100}>
        <Manset metin="İkinci ajan: denetçi." bas={c(b, 1) + 0.2} boy={80} />
      </Gir>
      <Gir bas={c(b, 2)} son={c(b, 3)} x={720} y={360} w={1000}>
        <Yazi boy={44} font="mono">videoyu daha önce görmedi</Yazi>
      </Gir>
      <DamgaAt id="d33a" x={760} y={470} bas={z(b, 2, 0.4)} son={c(b, 3)} metin="HİÇ GÖRMEDİ" boy={70} aci={-6} />
      {/* 39 kare */}
      {Array.from({ length: 39 }, (_, i) => {
        const gorundu = i < gorulen;
        if (f < k(s3)) return null;
        const simdi = i === gorulen - 1 && f < k(s3s);
        return (
          <div key={i} style={{ position: "absolute", left: 700 + (i % 13) * 86, top: 330 + Math.floor(i / 13) * 150, width: 78, height: 139, border: `${simdi ? 5 : 2.5}px solid ${simdi ? RENK.kirmizi : RENK.murekkep}`, borderRadius: 5, overflow: "hidden", background: RENK.kagitKoyu, opacity: f >= k(B) ? 1 - ara(f, k(B), k(B) + 7) : 1 }}>
            {gorundu && <Img src={saniyeKare(i + 1)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
        );
      })}
      <Gir bas={c(b, 3)} son={B} x={700} y={800} w={600}>
        <Yazi boy={40} font="mono">kare {Math.max(1, gorulen)} / 39 · saniyede 1</Yazi>
      </Gir>
      <Gir bas={c(b, 4)} son={B} x={1420} y={780} aci={-3}>
        <Kupon ust="BULDU" deger="10 sorun" w={360} renk={RENK.kirmizi} />
      </Gir>
      {/* dört düzeltme */}
      {kartlar.map((x, i) => (
        <Gir key={x.n} bas={c(b, x.n)} x={110 + (i % 2) * 860} y={200 + Math.floor(i / 2) * 400}>
          <OnceSonra baslik={x.baslik} once={x.once} sonra={x.sonra} sonraBas={z(b, x.n, 0.5)} w={830} />
        </Gir>
      ))}
    </>
  );
};

// ---------------------------------------------------------------- 34 · 18 dakika, sessiz önizleme, fabrika
const Saat: React.FC<{ aci: number }> = ({ aci }) => (
  <svg width={380} height={380} viewBox="0 0 380 380" style={{ overflow: "visible" }}>
    <circle cx={190} cy={190} r={170} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={7} />
    <path d={`M190 190 L190 20 A170 170 0 ${aci > 180 ? 1 : 0} 1 ${190 + Math.sin((aci * Math.PI) / 180) * 170} ${190 - Math.cos((aci * Math.PI) / 180) * 170} Z`} fill={RENK.kirmizi} opacity={0.2} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return <line key={i} x1={190 + Math.sin(a) * 146} y1={190 - Math.cos(a) * 146} x2={190 + Math.sin(a) * 162} y2={190 - Math.cos(a) * 162} stroke={RENK.murekkep} strokeWidth={i % 3 === 0 ? 7 : 4} />;
    })}
    <line x1={190} y1={190} x2={190 + Math.sin((aci * Math.PI) / 180) * 140} y2={190 - Math.cos((aci * Math.PI) / 180) * 140} stroke={RENK.murekkep} strokeWidth={8} strokeLinecap="round" />
    <circle cx={190} cy={190} r={12} fill={RENK.murekkep} />
  </svg>
);
const Hoparlor: React.FC<{ acik: boolean }> = ({ acik }) => (
  <svg width={150} height={120} viewBox="0 0 150 120" style={{ overflow: "visible" }}>
    <path d="M14 42 H44 L80 12 V108 L44 78 H14 Z" fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={6} strokeLinejoin="round" />
    {acik ? (
      <path d="M98 40 Q114 60 98 80 M114 24 Q140 60 114 96" fill="none" stroke={RENK.mavi} strokeWidth={6} strokeLinecap="round" />
    ) : (
      <path d="M100 38 L140 82 M140 38 L100 82" stroke={RENK.kirmizi} strokeWidth={8} strokeLinecap="round" />
    )}
  </svg>
);
const S34: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A2 = c(b, 3), A3 = c(b, 5);
  const fiiller = ["İzledim", "beğendim", "sesi ekledim"];
  const sesli = f >= k(z(b, 4, 0.66));
  return (
    <>
      <Ust b={b} metin="Süre ve sonuç" />
      {/* 18 dakika */}
      <Gir bas={c(b, 1)} son={A2} x={180} y={230}>
        <Saat aci={ara(f, k(c(b, 1)), k(cs(b, 2)), Easing.inOut(Easing.quad)) * 108} />
      </Gir>
      <Gir bas={z(b, 1, 0.35)} son={A2} x={640} y={300} aci={-2}>
        <Kupon ust="SÜREÇ" deger="~18 dakika" w={460} boy={76} />
      </Gir>
      <Gir bas={c(b, 2)} son={A2} x={1300} y={330}>
        <WJ poz="telefon" yas={f - k(c(b, 2))} f={f} boy={560} />
      </Gir>
      <Gir bas={z(b, 2, 0.3)} son={A2} x={640} y={560} w={600}>
        <Yazi boy={46} font="mono">ben: başka bir iş</Yazi>
        <Yazi boy={46} font="mono" renk={RENK.mavi}>ajanlar: çalışıyor</Yazi>
      </Gir>
      {/* sessiz önizleme */}
      <Gir bas={A2} son={A3} x={300} y={170} w={330}>
        <PilotOynat kareler={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]} bas={A2} son={A3} w={330} rozet="gerçek önizleme" />
      </Gir>
      <Gir bas={z(b, 3, 0.3)} son={A3} x={760} y={230}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Hoparlor acik={sesli} />
          <Yazi boy={60}>{sesli ? "sesli" : "sessiz önizleme"}</Yazi>
        </div>
      </Gir>
      {fiiller.map((m, i) => {
        const t = z(b, 4, i * 0.33);
        return (
          <Gir key={m} bas={t} son={A3} x={760} y={420 + i * 110}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <Tik p={ara(f, k(t) + 3, k(t) + 10)} boy={52} />
              <Yazi boy={66}>{m}</Yazi>
            </div>
          </Gir>
        );
      })}
      <Gir bas={z(b, 4, 0.66)} son={A3} x={1240} y={640}>
        <Dalga tur="canli" w={560} h={140} f={f} cubuk={36} />
      </Gir>
      {/* fabrikanın gücü */}
      <Gir bas={A3} x={180} y={230} w={700}>
        <Yazi boy={40} font="sans" renk={RENK.kirmizi} stil={{ letterSpacing: 4 }}>BEN</Yazi>
        <Yazi boy={84}>fikir ve zevk</Yazi>
      </Gir>
      <Gir bas={z(b, 5, 0.1)} x={300} y={440}>
        <WJ poz="gosteren" yas={f - k(z(b, 5, 0.1))} f={f} boy={520} />
      </Gir>
      <Gir bas={z(b, 5, 0.5)} x={1150} y={230} w={700}>
        <Yazi boy={40} font="sans" renk={RENK.mavi} stil={{ letterSpacing: 4 }}>MAKİNELER</Yazi>
        <Yazi boy={84}>tekrar</Yazi>
      </Gir>
      <Gir bas={z(b, 5, 0.55)} x={1220} y={500}>
        <Daktilo f={f} boy={420} konusuyor goz="acik" bak={[-8, 0]} />
      </Gir>
      <DamgaAt id="d34a" x={690} y={660} bas={z(b, 5, 0.8)} metin="FABRİKA" boy={76} aci={-7} />
    </>
  );
};

// ---------------------------------------------------------------- 35–41 · yedi bilet
const ADIMLAR = ["Kimlik", "Stil rehberi", "Ses", "Senaryo", "Küçük başla", "Denetçi", "Kurallar"];
const ROMA = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** üstte yedi aktarma bileti; adim'a kadar olanlar delinmiş, adim tam delBas anında delinir */
const YolHaritasi: React.FC<{ adim: number; delBas: number; dusBas?: number }> = ({ adim, delBas, dusBas }) => {
  const f = useCurrentFrame();
  return (
    <>
      {ADIMLAR.map((ad, i) => {
        const no = i + 1;
        const dus = dusBas === undefined ? 1 : spring({ frame: f - k(dusBas + i * 0.22), fps: FPS, config: { damping: 13, stiffness: 160, mass: 0.7 } });
        if (dusBas !== undefined && f < k(dusBas + i * 0.22) - 1) return null;
        const simdi = no === adim;
        const delindi = no < adim || (simdi && f >= k(delBas));
        const zimba = simdi ? ara(f, k(delBas), k(delBas) + 6) : delindi ? 1 : 0;
        const bas = simdi ? Math.sin(Math.min(1, ara(f, k(delBas), k(delBas) + 8)) * Math.PI) * 10 : 0;
        const op = no > adim ? 0.42 : no < adim ? 0.7 : 1;
        return (
          <div key={ad} style={{ position: "absolute", left: 55 + i * 260, top: 106 + bas + (1 - dus) * -160, width: 250, height: 104, opacity: op * Math.min(1, dus * 1.5), transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg) scale(${simdi ? 1.04 : 1})` }}>
            <div style={{ position: "absolute", inset: 0, background: RENK.bilet, border: `${simdi ? 5 : 3.5}px solid ${simdi ? RENK.kirmizi : RENK.murekkep}`, borderRadius: 10, display: "flex", boxShadow: "4px 5px 0 rgba(27,26,23,0.12)" }}>
              <div style={{ width: 62, borderRight: `3px dashed ${RENK.murekkep}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 44, color: RENK.kirmizi }}>{ROMA[i]}</div>
              <div style={{ flex: 1, padding: "6px 10px 6px 14px", display: "flex", alignItems: "center", fontFamily: SANS, fontWeight: 600, fontSize: 34, lineHeight: 1.05, color: RENK.murekkep }}>{ad}</div>
            </div>
            {zimba > 0 && (
              <>
                <div style={{ position: "absolute", right: 12, top: 10, width: 30, height: 30, borderRadius: 15, background: RENK.kagitKoyu, border: `3px solid ${RENK.murekkep}`, boxShadow: "inset 2px 3px 0 rgba(27,26,23,0.35)", transform: `scale(${zimba})` }} />
                {simdi && zimba < 1 && <div style={{ position: "absolute", right: 12 - 20 * zimba, top: 10 - 20 * zimba, width: 30 + 40 * zimba, height: 30 + 40 * zimba, borderRadius: "50%", border: `4px solid ${RENK.kirmizi}`, opacity: 1 - zimba }} />}
              </>
            )}
          </div>
        );
      })}
    </>
  );
};

const AdimBaslik: React.FC<{ no: number; metin: string; bas: number }> = ({ no, metin, bas }) => (
  <Gir bas={bas} x={120} y={250} w={1700}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
      <span style={{ fontFamily: SERIF, fontSize: 88, color: RENK.kirmizi, whiteSpace: "nowrap" }}>Adım {no} ·</span>
      <Manset metin={metin} bas={bas + 0.15} boy={88} />
    </div>
  </Gir>
);

/** küçük "dünya" eskizleri (sabit 300×220) */
const Dunya: React.FC<{ tur: "uzay" | "mutfak" | "bilgisayar" }> = ({ tur }) => (
  <svg width={300} height={220} viewBox="0 0 300 220" style={{ overflow: "visible" }}>
    {tur === "uzay" && (
      <g {...ink} strokeWidth={5}>
        <circle cx={150} cy={110} r={34} fill={RENK.kagitAcik} />
        <rect x={20} y={88} width={80} height={44} fill={`${RENK.mavi}30`} />
        <rect x={200} y={88} width={80} height={44} fill={`${RENK.mavi}30`} />
        <path d="M100 110 H116 M184 110 H200 M60 88 V132 M240 88 V132" />
        <path d="M150 76 V40 M140 40 H160" />
        {[[40, 30], [260, 40], [230, 190], [60, 180]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={3} fill={RENK.murekkep} />)}
      </g>
    )}
    {tur === "mutfak" && (
      <g {...ink} strokeWidth={5}>
        <path d="M70 100 H230 V170 Q230 190 210 190 H90 Q70 190 70 170 Z" fill={RENK.kagitAcik} />
        <path d="M50 108 H70 M230 108 H250 M120 100 Q150 80 180 100" />
        <path d="M110 70 q10 -16 0 -32 M150 66 q10 -16 0 -32 M190 70 q10 -16 0 -32" stroke={RENK.kirmizi} />
        <path d="M40 206 H260" />
      </g>
    )}
    {tur === "bilgisayar" && (
      <g {...ink} strokeWidth={5}>
        <rect x={60} y={20} width={180} height={140} rx={14} fill={RENK.kagitKoyu} />
        <rect x={80} y={38} width={140} height={100} rx={8} fill="#22302A" />
        <text x={92} y={80} fontFamily={MONO} fontSize={34} fill="#8FE3A0" stroke="none">C:\&gt;_</text>
        <path d="M110 160 L100 196 H200 L190 160" fill={RENK.kagitKoyu} />
      </g>
    )}
  </svg>
);

/** 16:9 mini video karesi */
const MiniKare: React.FC<{ w: number; arka?: string; children?: React.ReactNode }> = ({ w, arka = RENK.kagit, children }) => (
  <div style={{ position: "relative", width: w, height: (w * 9) / 16, border: `4px solid ${RENK.murekkep}`, borderRadius: 10, background: arka, overflow: "hidden", boxShadow: "6px 7px 0 rgba(27,26,23,0.13)" }}>{children}</div>
);

const S35: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 6), Bv = c(b, 7);
  const kutu = (i: number, baslik: string, ic: React.ReactNode, benim: string, kirmizi?: boolean) => (
    <Gir key={baslik} bas={z(b, 4, i * 0.3)} son={A} x={120 + i * 580} y={420} w={520}>
      <div style={{ height: 380, border: `4px solid ${RENK.murekkep}`, borderRadius: 14, background: `${RENK.kagitAcik}C0`, padding: "16px 22px", position: "relative" }}>
        <Yazi boy={40} font="sans" stil={{ letterSpacing: 3 }}>{baslik}</Yazi>
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, height: 230, display: "flex", alignItems: "center", justifyContent: "center" }}>{ic}</div>
        {f >= k(c(b, 5)) && (
          <div style={{ position: "absolute", left: 22, bottom: 14, opacity: ara(f, k(z(b, 5, i * 0.3)), k(z(b, 5, i * 0.3)) + 6) }}>
            <Yazi boy={44} renk={kirmizi ? RENK.kirmizi : RENK.mavi}>{benim}</Yazi>
          </div>
        )}
      </div>
    </Gir>
  );
  return (
    <>
      <Gir bas={c(b, 1)} son={c(b, 3)} x={120} y={330} w={1680}>
        <Manset metin="Peki sıfırdan başlayan biri bunu nasıl kurar?" bas={c(b, 1) + 0.1} boy={100} />
      </Gir>
      <Gir bas={z(b, 2, 0.5)} son={c(b, 3)} x={120} y={640} w={1200}>
        <Yazi boy={56} font="mono" renk={RENK.kirmizi}>yedi adım = yedi bilet</Yazi>
      </Gir>
      <YolHaritasi adim={1} delBas={c(b, 3)} dusBas={c(b, 2)} />
      <AdimBaslik no={1} metin="Bir kimlik seç." bas={c(b, 3)} />
      {kutu(0, "KARAKTER", <WJ poz="normal" yas={30} f={f} boy={220} />, "Sidis")}
      {kutu(1, "DÖNEM", (
        <svg width={230} height={200} viewBox="0 0 230 200">
          <rect x={6} y={6} width={218} height={188} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={5} />
          <text x={115} y={52} textAnchor="middle" fontFamily={SERIF} fontSize={40} fill={RENK.murekkep}>GAZETE</text>
          <line x1={20} y1={66} x2={210} y2={66} stroke={RENK.murekkep} strokeWidth={4} />
          {[86, 106, 126, 146, 166].map((y) => <line key={y} x1={20} y1={y} x2={y % 40 ? 200 : 150} y2={y} stroke={RENK.murekkep} strokeWidth={3} opacity={0.5} />)}
        </svg>
      ), "gazete kâğıdı")}
      {kutu(2, "RENK PALETİ", (
        <div style={{ display: "flex", gap: 16 }}>
          {[RENK.kagit, RENK.murekkep, RENK.kirmizi, RENK.mavi].map((r) => <div key={r} style={{ width: 90, height: 150, background: r, border: `4px solid ${RENK.murekkep}`, borderRadius: 8 }} />)}
        </div>
      ), "damga kırmızısı", true)}
      <Daire x={1548} y={530} w={90} h={150} bas={z(b, 5, 0.75)} son={A} tohum="35a" />
      {/* senin dünyan */}
      <Gir bas={A} son={Bv} x={120} y={420}>
        <Yazi boy={56}>Senin için başka bir şey olabilir:</Yazi>
      </Gir>
      {(["uzay", "mutfak", "bilgisayar"] as const).map((t, i) => (
        <Gir key={t} bas={z(b, 6, 0.3 + i * 0.22)} son={Bv} x={160 + i * 580} y={540} w={420}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Dunya tur={t} />
            <Yazi boy={44} stil={{ textAlign: "center" }}>{["bir uzay istasyonu", "bir mutfak", "eski bir bilgisayar ekranı"][i]}</Yazi>
          </div>
        </Gir>
      ))}
      {/* aynı dünya */}
      {[0, 1, 2].map((i) => (
        <Gir key={i} bas={Bv + i * 0.25} x={120 + i * 580} y={440} w={520}>
          <MiniKare w={520}>
            <div style={{ position: "absolute", left: 40, top: 40 }}><WJ poz={(["normal", "gosteren", "dusunen"] as Poz[])[i]} yas={30} f={f} boy={200} /></div>
            <div style={{ position: "absolute", left: 230, top: 90 }}><Damga id={`d35m${i}`} metin={`No. ${i + 1}`} yas={30} boy={44} aci={-6} /></div>
          </MiniKare>
          <Yazi boy={40} font="mono" stil={{ marginTop: 14 }}>video {i + 1}</Yazi>
        </Gir>
      ))}
      <AltCizgi x={120} y={820} w={1680} bas={z(b, 7, 0.4)} sure={0.6} />
      <DamgaAt id="d35b" x={1240} y={850} bas={z(b, 7, 0.55)} metin="AYNI DÜNYA" boy={60} aci={-4} />
    </>
  );
};

const S36: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const satirlar: { t: string; renkli?: boolean }[] = [
    { t: "renk:  #ECE6D6 · #1B1A17 · #C8302C", renkli: true },
    { t: "yazı:  Instrument Serif · JetBrains Mono" },
    { t: "poz:   normal · düşünen · şaşkın · gösteren" },
    { t: "geçiş: gazete katlanır, yenisi düşer" },
  ];
  const A = c(b, 5);
  return (
    <>
      <YolHaritasi adim={2} delBas={c(b, 1)} />
      <AdimBaslik no={2} metin="Kimliği bir stil rehberine yaz." bas={c(b, 1)} />
      <Gir bas={z(b, 1, 0.4)} son={A} x={120} y={390} w={1140}>
        <Pencere baslik="stil-rehberi.md" w={1140}>
          <div style={{ height: 300 }}>
            {satirlar.map((s, i) => {
              const t = z(b, 2, i * 0.24);
              const p = ara(f, k(t), k(t + 1.1));
              const n = Math.round(p * s.t.length);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, height: 72, fontFamily: MONO, fontSize: 36, color: RENK.murekkep, whiteSpace: "pre" }}>
                  <span>{s.t.slice(0, n)}</span>
                  {s.renkli && p >= 1 && [RENK.kagit, RENK.murekkep, RENK.kirmizi].map((r) => <span key={r} style={{ width: 34, height: 34, background: r, border: `3px solid ${RENK.murekkep}`, borderRadius: 4 }} />)}
                </div>
              );
            })}
          </div>
        </Pencere>
      </Gir>
      <DamgaAt id="d36a" x={1330} y={400} bas={c(b, 3)} son={A} metin="BİR SAYFA" boy={70} aci={-8} />
      <Gir bas={c(b, 4)} son={A} x={1420} y={580}>
        <Daktilo f={f} boy={360} konusuyor={f < k(cs(b, 4))} goz="acik" bak={[-10, -2]} />
      </Gir>
      <Ok x1={1270} y1={620} x2={1420} y2={720} bas={z(b, 4, 0.15)} son={A} egri={-0.3} />
      <Gir bas={z(b, 4, 0.45)} son={A} x={1300} y={930} w={600}>
        <Yazi boy={36} font="mono" renk={RENK.kirmizi}>her videoda ver</Yazi>
      </Gir>
      {/* rehber olmadan */}
      <Gir bas={A} x={120} y={400}>
        <Yazi boy={56}>Rehber olmadan:</Yazi>
      </Gir>
      {[
        { arka: "#1F2430", yazi: "#F5F5F5", font: SANS, m: "VİDEO 1" },
        { arka: "#F6D6E4", yazi: "#7A1F4F", font: SERIF, m: "video 2" },
        { arka: "#D8EEDB", yazi: "#1F5E2E", font: MONO, m: "Video_3" },
      ].map((v, i) => (
        <Gir key={i} bas={z(b, 5, 0.1 + i * 0.15)} x={120 + i * 580} y={500} w={520} aci={(i - 1) * 3}>
          <MiniKare w={520} arka={v.arka}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: v.font, fontWeight: v.font === SANS ? 800 : 400, fontSize: 64, color: v.yazi }}>{v.m}</div>
          </MiniKare>
        </Gir>
      ))}
      <DamgaAt id="d36b" x={520} y={820} bas={z(b, 5, 0.6)} metin="AYRI KANAL GİBİ" boy={64} aci={-5} />
    </>
  );
};

const S37: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 3), Bv = c(b, 4), Cv = c(b, 5);
  const poz: Poz = f >= k(Cv) ? "omuz" : f >= k(Bv) ? "dusunen" : f >= k(A) ? "telefon" : "gosteren";
  const pozBas = f >= k(Cv) ? Cv : f >= k(Bv) ? Bv : f >= k(A) ? A : c(b, 1);
  const ipuclari = ["sessiz bir oda", "telefon: bir karış", "30–40 sn canlı oku"];
  return (
    <>
      <YolHaritasi adim={3} delBas={c(b, 1)} />
      <AdimBaslik no={3} metin="Bir ses seç, ona sadık kal." bas={c(b, 1)} />
      <Gir bas={c(b, 1) + 0.3} x={1440} y={380}>
        <WJ poz={poz} yas={f - k(pozBas)} f={f} boy={560} gulumse={poz === "omuz"} />
      </Gir>
      <Gir bas={z(b, 1, 0.4)} son={A} x={120} y={420}>
        <Dalga tur="canli" w={1150} h={170} f={f} cubuk={60} />
      </Gir>
      <Gir bas={c(b, 2)} son={A} x={120} y={660} aci={-2}>
        <Kupon ust="EN İYİSİ" deger="kendi sesin" w={480} />
      </Gir>
      <Gir bas={z(b, 2, 0.5)} son={A} x={660} y={672} aci={2}>
        <Kupon ust="AMA" deger="iyi bir kayıtla" w={520} renk={RENK.kirmizi} />
      </Gir>
      {/* kayıt ipuçları */}
      {ipuclari.map((m, i) => (
        <Gir key={m} bas={z(b, 3, i * 0.3)} son={Bv} x={120} y={420 + i * 170} aci={i % 2 ? 1.5 : -1.5}>
          <Kupon ust={`KAYIT ${i + 1}`} deger={m} w={740} />
        </Gir>
      ))}
      <Gir bas={z(b, 3, 0.35)} son={Bv} x={960} y={470}>
        <svg width={380} height={360} viewBox="0 0 380 360" style={{ overflow: "visible" }}>
          <rect x={250} y={110} width={90} height={160} rx={14} fill={RENK.murekkep} />
          <rect x={260} y={124} width={70} height={124} rx={6} fill={RENK.mavi} opacity={0.85} />
          <path d="M40 120 Q90 100 100 160 Q110 210 60 230" {...ink} strokeWidth={6} />
          <path d="M106 190 H240 M118 176 L104 190 L118 204 M228 176 L242 190 L228 204" {...ink} stroke={RENK.kirmizi} strokeWidth={5} />
          <text x={172} y={320} textAnchor="middle" fontFamily={MONO} fontSize={34} fill={RENK.kirmizi}>bir karış</text>
        </svg>
      </Gir>
      {/* hazır ses */}
      <Gir bas={Bv} son={Cv} x={120} y={400} w={1150}>
        <Pencere baslik="hazır sesler" w={1150}>
          {["ses A", "ses B", "ses C"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 30, height: 96 }}>
              <span style={{ fontFamily: MONO, fontSize: 40, width: 170 }}>{s}</span>
              <Dalga tur="canli" w={760} h={70} f={f + i * 20} cubuk={40} tohum={s} renk={i === 1 ? RENK.mavi : `${RENK.murekkep}88`} />
            </div>
          ))}
        </Pencere>
      </Gir>
      <Daire x={150} y={592} w={1080} h={80} bas={z(b, 4, 0.35)} son={Cv} tohum="37a" />
      <Gir bas={z(b, 4, 0.6)} son={Cv} x={120} y={820} w={1200}>
        <Yazi boy={48} font="mono" renk={RENK.kirmizi}>her videoda aynı ses</Yazi>
      </Gir>
      {/* kimlik */}
      <Gir bas={Cv} x={120} y={420}>
        <Dalga tur="canli" w={1150} h={200} f={f} cubuk={60} />
      </Gir>
      <Gir bas={z(b, 5, 0.2)} x={120} y={680} w={1200}>
        <Yazi boy={60}>İzleyici sesi de hatırlıyor.</Yazi>
      </Gir>
      <DamgaAt id="d37a" x={760} y={760} bas={z(b, 5, 0.5)} metin="KİMLİK" boy={96} aci={-7} />
    </>
  );
};

const S38: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const satirlar = [
    { k: "“…altı saniyelik…”", n: "→ bilet: 6 sn" },
    { k: "“…burnumdan konuşuyorum…”", n: "→ W.J. şaşırır + damga" },
    { k: "“…olmamış…”", n: "→ koca damga + çizik" },
  ];
  return (
    <>
      <YolHaritasi adim={4} delBas={c(b, 1)} />
      <AdimBaslik no={4} metin="Senaryoyu kelimeye bağlı yaz." bas={c(b, 1)} />
      <Gir bas={z(b, 1, 0.45)} x={120} y={390} w={1240}>
        <Pencere baslik="senaryo.txt" w={1240}>
          {satirlar.map((s, i) => {
            const t = z(b, 2, 0.15 + i * 0.27);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", height: 96 }}>
                <span style={{ width: 640, fontFamily: SERIF, fontSize: 48, color: RENK.murekkep }}>{s.k}</span>
                <span style={{ fontFamily: MONO, fontSize: 36, color: RENK.kirmizi, opacity: ara(f, k(t), k(t) + 6), transform: `translateX(${(1 - ara(f, k(t), k(t) + 6)) * 20}px)` }}>{s.n}</span>
              </div>
            );
          })}
        </Pencere>
      </Gir>
      <Gir bas={c(b, 2)} son={c(b, 4)} x={120} y={830} w={1200}>
        <Yazi boy={40} font="mono">önemli kelime + o anda ekranda ne var</Yazi>
      </Gir>
      <Gir bas={c(b, 3)} x={1440} y={330}>
        <WJ poz="gosteren" yas={f - k(c(b, 3))} f={f} boy={420} />
      </Gir>
      <Gir bas={z(b, 3, 0.3)} x={1500} y={760}>
        <Daktilo f={f} boy={300} konusuyor={f < k(cs(b, 3))} goz={f >= k(c(b, 4)) ? "kirpGoz" : "acik"} bak={[-8, -4]} />
      </Gir>
      <Gir bas={z(b, 3, 0.55)} x={1400} y={260} w={500}>
        <Yazi boy={40} font="mono" renk={RENK.mavi}>ikiniz için kolay</Yazi>
      </Gir>
      <Daire x={770} y={462} w={540} h={300} bas={c(b, 4)} tohum="38a" sure={0.6} />
      <DamgaAt id="d38a" x={560} y={850} bas={z(b, 4, 0.4)} metin="VİDEONUN YARISI" boy={64} aci={-4} />
    </>
  );
};

const S39: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 5);
  const parca = (i: number, ic: React.ReactNode) => {
    const t = z(b, 6, 0.1 + i * 0.18);
    const p = ara(f, k(t), k(t) + 14, Easing.inOut(Easing.cubic));
    const bx = [520, 900, 1260, 700][i], by = [400, 400, 400, 640][i];
    const hx = [960, 1180, 1420, 1560][i], hy = [380, 560, 420, 580][i];
    if (f < k(t)) return null;
    return <div key={i} style={{ position: "absolute", left: bx + (hx - bx) * p, top: by + (hy - by) * p, transform: `scale(${1 - 0.35 * p})`, transformOrigin: "0 0" }}>{ic}</div>;
  };
  return (
    <>
      <YolHaritasi adim={5} delBas={c(b, 1)} />
      <AdimBaslik no={5} metin="Küçük başla." bas={c(b, 1)} />
      <Gir bas={c(b, 2)} x={140} y={380} w={290}>
        <PilotOynat kareler={[2, 4, 7, 9, 11, 13]} bas={c(b, 2)} son={cs(b, 6)} w={290} rozet="gerçek pilot" />
      </Gir>
      <Gir bas={z(b, 2, 0.3)} son={A} x={520} y={400} aci={-2}>
        <Kupon ust="İLK VİDEO" deger="40 sn kısa" w={430} />
      </Gir>
      {[
        { u: "SAHNE", d: "tek sahne" },
        { u: "KARAKTER", d: "iki karakter" },
        { u: "DAMGA", d: "üç damga" },
      ].map((x, i) => (
        <Gir key={x.u} bas={z(b, 3, i * 0.3)} son={A} x={520 + i * 440} y={600} aci={i % 2 ? 1.5 : -1.5}>
          <Kupon ust={x.u} deger={x.d} w={410} boy={60} />
        </Gir>
      ))}
      <Gir bas={c(b, 4)} son={A} x={1000} y={800} w={820}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width={110} height={110} viewBox="0 0 110 110" style={{ overflow: "visible" }}>
            <g transform={`rotate(${ara(f, k(c(b, 4)), k(cs(b, 4))) * 360} 55 55)`}>
              <path d="M55 10 A45 45 0 1 1 14 36" {...ink} stroke={RENK.kirmizi} strokeWidth={8} />
              <path d="M6 16 L14 38 L36 30" {...ink} stroke={RENK.kirmizi} strokeWidth={8} />
            </g>
          </svg>
          <Yazi boy={50}>beğenene kadar düzelt</Yazi>
        </div>
      </Gir>
      {/* uzun videoya geç */}
      <Gir bas={A} x={900} y={340} w={900}>
        <MiniKare w={900} />
        <Yazi boy={44} font="mono" stil={{ marginTop: 14 }}>uzun video</Yazi>
      </Gir>
      <Ok x1={470} y1={600} x2={880} y2={560} bas={z(b, 5, 0.3)} egri={-0.15} />
      {parca(0, <WJ poz="gosteren" yas={30} f={f} boy={260} />)}
      {parca(1, <Daktilo f={f} boy={260} konusuyor={false} goz="acik" />)}
      {parca(2, <Kupon ust="AKTARMA" deger="6 sn" w={260} />)}
      {parca(3, <Damga id="d39a" metin="ÖRNEK" yas={30} boy={56} />)}
      <Gir bas={z(b, 6, 0.75)} x={900} y={930} w={900}>
        <Yazi boy={44} font="mono" renk={RENK.kirmizi}>aynı parçalar, yeniden işe yarar</Yazi>
      </Gir>
    </>
  );
};

const S40: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 4);
  const s2 = c(b, 2), s2s = cs(b, 2);
  const mx = 120 + ara(f, k(s2), k(s2s), Easing.inOut(Easing.quad)) * 1300;
  const kart = (i: number, baslik: string, ic: React.ReactNode) => (
    <Gir key={baslik} bas={z(b, 3, i * 0.3)} son={A} x={120 + i * 580} y={650} w={540}>
      <div style={{ height: 330, border: `4px solid ${RENK.murekkep}`, borderRadius: 14, background: `${RENK.kagitAcik}C8`, padding: "16px 22px", position: "relative" }}>
        <Yazi boy={46}>{baslik}</Yazi>
        <div style={{ position: "absolute", left: 22, right: 22, top: 90, bottom: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{ic}</div>
      </div>
    </Gir>
  );
  return (
    <>
      <YolHaritasi adim={6} delBas={c(b, 1)} />
      <AdimBaslik no={6} metin="Kontrolü otomatikleştir." bas={c(b, 1)} />
      {Array.from({ length: 13 }, (_, i) => (
        <Gir key={i} bas={z(b, 1, 0.4) + i * 0.05} son={A} x={120 + i * 106} y={380}>
          <div style={{ width: 96, height: 171, border: `2.5px solid ${RENK.murekkep}`, borderRadius: 5, overflow: "hidden", background: "#fff" }}>
            <Img src={saniyeKare(1 + i * 3)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </Gir>
      ))}
      <Gir bas={z(b, 2, 0.3)} son={c(b, 3)} x={120} y={600} w={1300}>
        <Yazi boy={52} font="mono" renk={RENK.kirmizi}>her videodan sonra, kare kare</Yazi>
      </Gir>
      {f >= k(s2) && f < k(A) + 7 && (
        <div style={{ position: "absolute", left: mx, top: 400, opacity: 1 - ara(f, k(A), k(A) + 7) }}>
          <Mercek boy={160} />
        </div>
      )}
      <Gir bas={c(b, 2)} son={A} x={1540} y={340} w={320}>
        <Daktilo f={f} boy={260} konusuyor={f < k(s2s)} goz="acik" bak={[-10, 4]} />
        <Yazi boy={36} font="sans" stil={{ textAlign: "center", letterSpacing: 3 }}>DENETÇİ</Yazi>
      </Gir>
      {kart(0, "yazı taşması", (
        <div style={{ position: "relative", width: 280, height: 110, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, marginRight: 140 }}>
          <div style={{ position: "absolute", left: 16, top: 26, fontFamily: SERIF, fontSize: 52, whiteSpace: "nowrap", color: RENK.murekkep }}>Çok uzun bir başlık</div>
          <div style={{ position: "absolute", left: 270, top: -14, width: 6, height: 138, background: RENK.kirmizi }} />
        </div>
      ))}
      {kart(1, "harf hatası", (
        <div style={{ fontFamily: SERIF, fontSize: 84, color: RENK.murekkep }}>
          <span style={{ textDecoration: `line-through ${RENK.kirmizi} 6px` }}>Istanbul</span>
          <br />
          <span style={{ color: RENK.mavi }}>İstanbul</span>
        </div>
      ))}
      {kart(2, "ses seviyesi", (
        <svg width={360} height={180} viewBox="0 0 360 180">
          {Array.from({ length: 12 }, (_, i) => {
            const h = 30 + Math.abs(Math.sin(i * 0.9 + f * 0.25)) * 130;
            return <rect key={i} x={10 + i * 29} y={170 - h} width={20} height={h} fill={h > 140 ? RENK.kirmizi : RENK.mavi} rx={3} />;
          })}
          <line x1={0} y1={30} x2={360} y2={30} stroke={RENK.kirmizi} strokeWidth={4} strokeDasharray="10 8" />
        </svg>
      ))}
      {/* elden yapay zekâya */}
      <Gir bas={A} x={260} y={420}>
        <WJ poz="gosteren" yas={f - k(A)} f={f} boy={480} />
      </Gir>
      <Gir bas={A} x={200} y={360} w={500}>
        <Yazi boy={44} font="mono">önce elle</Yazi>
      </Gir>
      <Gir bas={z(b, 4, 0.45)} x={1450} y={480}>
        <Daktilo f={f} boy={400} konusuyor={f >= k(z(b, 4, 0.7))} goz="acik" bak={[-10, 0]} />
      </Gir>
      <Gir bas={z(b, 4, 0.45)} x={1380} y={360} w={520}>
        <Yazi boy={44} font="mono" renk={RENK.mavi}>sonra yapay zekâ</Yazi>
      </Gir>
      {f >= k(A) && (() => {
        const p = ara(f, k(z(b, 4, 0.35)), k(z(b, 4, 0.75)), Easing.inOut(Easing.cubic));
        return (
          <div style={{ position: "absolute", left: 640 + p * 320, top: 560 - Math.sin(p * Math.PI) * 120, transform: `rotate(${-4 + p * 8}deg)`, opacity: ara(f, k(A), k(A) + 8) }}>
            <Pencere baslik="kontrol listesi" w={420}>
              {["taşma", "harf", "ses"].map((m) => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 14, height: 54 }}>
                  <Tik p={1} boy={36} /> <span style={{ fontFamily: MONO, fontSize: 34 }}>{m}</span>
                </div>
              ))}
            </Pencere>
          </div>
        );
      })()}
    </>
  );
};

const S41: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const satirlar = [
    "1. Ekrandan çıkmayan nesneye bitiş ver.",
    "   neden: son karelerde video çöktü",
    "2. Göz kırpma yalnız son cümlede.",
    "   neden: sürekli kırpıyordu",
    "3. Açık ellerde parmaklar kalın.",
    "   neden: pençe gibi görünüyordu",
  ];
  const s3 = c(b, 3), s3s = cs(b, 3);
  const toplam = satirlar.join("").length;
  const yazilan = Math.round(ara(f, k(s3), k(s3s)) * toplam);
  let kalan = yazilan;
  const sayfaKalin = ara(f, k(c(b, 4)), k(cs(b, 4)));
  return (
    <>
      <YolHaritasi adim={7} delBas={c(b, 1)} />
      <AdimBaslik no={7} metin="Her hatayı bir kurala çevir." bas={c(b, 1)} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: 120 + (i + 1) * 12 * sayfaKalin, top: 390 + (i + 1) * 12 * sayfaKalin, width: 1140, height: 520, background: RENK.kagitAcik, border: `3px solid ${RENK.murekkep}`, borderRadius: 14, opacity: sayfaKalin > 0 ? 0.9 - i * 0.12 : 0, zIndex: 0 }} />
      )).reverse()}
      <Gir bas={c(b, 2)} x={120} y={390} w={1140}>
        <Pencere baslik="kurallar.md" w={1140}>
          <div style={{ height: 420 }}>
            {satirlar.map((s, i) => {
              const n = Math.max(0, Math.min(s.length, kalan));
              kalan -= s.length;
              return (
                <div key={i} style={{ fontFamily: MONO, fontSize: 34, height: 68, lineHeight: "68px", whiteSpace: "pre", color: s.startsWith("   ") ? RENK.kirmizi : RENK.murekkep }}>
                  {s.slice(0, n)}
                  {n > 0 && n < s.length && <span style={{ display: "inline-block", width: 18, height: 34, background: RENK.kirmizi, verticalAlign: "-4px" }} />}
                </div>
              );
            })}
            {yazilan === 0 && <span style={{ display: "inline-block", width: 18, height: 34, background: RENK.kirmizi, opacity: Math.floor(f / 12) % 2 }} />}
          </div>
        </Pencere>
      </Gir>
      <Gir bas={c(b, 4)} x={1360} y={390} aci={3}>
        <Kupon ust="İKİ AY SONRA" deger="kanalın hafızası" w={480} boy={56} />
      </Gir>
      <Gir bas={c(b, 5)} x={1440} y={590}>
        <Daktilo f={f} boy={360} konusuyor={false} goz="acik" bak={[-12, 4]} />
      </Gir>
      <Ok x1={1250} y1={700} x2={1430} y2={730} bas={z(b, 5, 0.2)} egri={0.2} />
      <Gir bas={z(b, 5, 0.45)} x={1230} y={985} w={680}>
        <Yazi boy={36} font="mono" renk={RENK.mavi}>her işe bunu okuyarak başlar</Yazi>
      </Gir>
    </>
  );
};

// ---------------------------------------------------------------- 42–46 · okuyucu soruları
const SORULAR = [
  "Yapay zekâ sesi YouTube'da sorun olur mu?",
  "Bu videolarla para kazanılır mı?",
  "Müzik nereden?",
  "Türkçe yapay zekâ sesleri yeterince iyi mi?",
  "Kod bilmem gerekiyor mu?",
];
/** sol sütun: gazetenin "okuyucu soruları" köşesi. soru = şu anki (1..5), sorBas = sorulduğu an */
const SoruSutunu: React.FC<{ soru: number; sorBas: number; basliBas?: number }> = ({ soru, sorBas, basliBas }) => {
  const f = useCurrentFrame();
  const baslik = basliBas === undefined ? 1 : spring({ frame: f - k(basliBas), fps: FPS, config: { damping: 15, stiffness: 150 } });
  if (basliBas !== undefined && f < k(basliBas) - 1) return null;
  return (
    <div style={{ position: "absolute", left: 70, top: 112, width: 560, bottom: 80, opacity: Math.min(1, baslik * 1.5), transform: `translateY(${(1 - baslik) * -40}px)` }}>
      <div style={{ borderTop: `5px solid ${RENK.murekkep}`, borderBottom: `2px solid ${RENK.murekkep}`, padding: "10px 0 8px", textAlign: "center", fontFamily: SERIF, fontSize: 52, color: RENK.murekkep }}>Okuyucu Soruları</div>
      <div style={{ height: 4, borderBottom: `2px solid ${RENK.murekkep}`, marginBottom: 22 }} />
      {SORULAR.map((s, i) => {
        const no = i + 1;
        if (no > soru) return null;
        const simdi = no === soru;
        const p = simdi ? ara(f, k(sorBas), k(sorBas) + 8) : 1;
        return (
          <div key={s} style={{ display: "flex", gap: 14, marginBottom: 22, opacity: (simdi ? 1 : 0.42) * p, transform: `translateX(${(1 - p) * -24}px)`, borderLeft: `6px solid ${simdi ? RENK.kirmizi : "transparent"}`, paddingLeft: 14 }}>
            <span style={{ fontFamily: SERIF, fontSize: 44, color: RENK.kirmizi, lineHeight: 1.1 }}>{no}.</span>
            <span style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.12, color: RENK.murekkep }}>{s}</span>
          </div>
        );
      })}
      <div style={{ position: "absolute", right: -36, top: 0, bottom: 0, borderRight: `2px solid ${RENK.murekkep}`, opacity: 0.5 }} />
    </div>
  );
};

const Soru: React.FC<{ metin: string; bas: number; son?: number; boy?: number }> = ({ metin, bas, son, boy = 72 }) => (
  <Gir bas={bas} son={son} x={720} y={170} w={1120}>
    <Manset metin={metin} bas={bas + 0.1} boy={boy} />
  </Gir>
);

const S42: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const evet = f >= k(z(b, 4, 0.3));
  return (
    <>
      <SoruSutunu soru={f >= k(c(b, 2)) ? 1 : 0} sorBas={c(b, 2)} basliBas={c(b, 1)} />
      <Gir bas={z(b, 1, 0.2)} son={c(b, 2)} x={860} y={300}>
        <svg width={760} height={460} viewBox="0 0 760 460" style={{ overflow: "visible" }}>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${i * 110} ${i * 70}) rotate(${(i - 1) * 6} 230 140)`}>
              <rect x={20} y={20} width={420} height={260} rx={8} fill={RENK.kagitAcik} stroke={RENK.murekkep} strokeWidth={6} />
              <path d="M20 20 L230 170 L440 20" fill="none" stroke={RENK.murekkep} strokeWidth={6} strokeLinejoin="round" />
            </g>
          ))}
        </svg>
      </Gir>
      <Gir bas={z(b, 1, 0.5)} son={c(b, 2)} x={760} y={820} w={1000}>
        <Yazi boy={48} font="mono" renk={RENK.kirmizi}>en çok sorulanlar</Yazi>
      </Gir>
      <Soru metin="Yapay zekâ sesiyle video yüklemek YouTube'da sorun olur mu?" bas={c(b, 2)} son={c(b, 3)} />
      {/* yükleme formu eskizi */}
      <Gir bas={c(b, 3)} x={720} y={180} w={1120}>
        <div style={{ border: `4px solid ${RENK.murekkep}`, borderRadius: 14, background: `${RENK.kagitAcik}E0`, overflow: "hidden", boxShadow: "8px 10px 0 rgba(27,26,23,0.14)" }}>
          <div style={{ padding: "12px 24px", borderBottom: `3px solid ${RENK.murekkep}`, background: RENK.kagitKoyu, fontFamily: SANS, fontWeight: 600, fontSize: 36 }}>YouTube · video yükleme (eskiz)</div>
          <div style={{ padding: "22px 28px 26px" }}>
            <Yazi boy={50}>Bu videoda değiştirilmiş ya da sentetik içerik var mı?</Yazi>
            <div style={{ display: "flex", gap: 80, marginTop: 24 }}>
              {["Evet", "Hayır"].map((m) => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, border: `4px solid ${RENK.murekkep}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {m === "Evet" && evet && <div style={{ width: 24, height: 24, borderRadius: 12, background: RENK.kirmizi }} />}
                  </div>
                  <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 42 }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Gir>
      <Daire x={748} y={340} w={150} h={50} bas={z(b, 4, 0.3)} tohum="42a" />
      <Gir bas={c(b, 4)} son={c(b, 6)} x={720} y={570} w={1120}>
        <Yazi boy={40} font="mono">gerçekçi kişi ya da olay</Yazi>
        <Yazi boy={40} font="mono">yapay üretildiyse <span style={{ color: RENK.kirmizi }}>→ evet</span></Yazi>
      </Gir>
      <Gir bas={c(b, 5)} x={720} y={700} w={700}>
        <Yazi boy={44} font="mono" renk={RENK.mavi}>şüphedeysem: hep evet</Yazi>
      </Gir>
      <DamgaAt id="d42a" x={1470} y={560} bas={z(b, 5, 0.3)} metin="EVET" boy={100} aci={-9} />
      <Gir bas={c(b, 6)} x={720} y={820} w={1120}>
        <Manset metin="Dürüst olmak, sonradan sorun yaşamaktan iyidir." bas={c(b, 6) + 0.1} boy={56} renk={RENK.murekkep} />
      </Gir>
    </>
  );
};

const S43: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 3), Bv = c(b, 4), Cv = c(b, 5);
  const merdiven = ara(f, k(z(b, 4, 0.05)), k(z(b, 4, 0.8)));
  const adimlar = 7;
  const yol = Array.from({ length: adimlar }, (_, i) => `L${100 + i * 140} ${380 - i * 46} L${100 + (i + 1) * 140} ${380 - i * 46}`).join(" ");
  return (
    <>
      <SoruSutunu soru={2} sorBas={c(b, 1)} />
      <Soru metin="Bu videolarla para kazanılır mı?" bas={c(b, 1)} />
      <Gir bas={c(b, 2)} son={A} x={760} y={420} aci={-3}>
        <Kupon ust="KAZANÇ" deger="—" w={420} boy={110} />
      </Gir>
      <Gir bas={z(b, 2, 0.15)} son={A} x={1260} y={440} w={560}>
        <Yazi boy={60} stil={{ textDecoration: `line-through ${RENK.kirmizi} 6px` }}>bir rakam</Yazi>
      </Gir>
      <DamgaAt id="d43a" x={1060} y={640} bas={z(b, 2, 0.45)} son={A} metin="RAKAM YOK" boy={80} aci={-6} />
      {["konu", "izleyici", "ülke", "süreklilik"].map((m, i) => (
        <Gir key={m} bas={z(b, 3, 0.1 + i * 0.18)} son={Bv} x={720 + i * 285} y={420} aci={i % 2 ? 2 : -2}>
          <Kupon deger={m} w={265} boy={52} />
        </Gir>
      ))}
      <Gir bas={z(b, 3, 0.75)} son={Bv} x={720} y={620} w={1100}>
        <Yazi boy={48} font="mono" renk={RENK.kirmizi}>kazanç bunlara göre çok değişir</Yazi>
      </Gir>
      <Gir bas={Bv} son={Cv} x={720} y={380}>
        <svg width={1140} height={500} viewBox="0 0 1140 500" style={{ overflow: "visible" }}>
          <path d="M60 20 V440 H1120" {...ink} strokeWidth={5} />
          <text x={1110} y={480} textAnchor="end" fontFamily={MONO} fontSize={34} fill={RENK.murekkep}>zaman</text>
          <path d={`M100 380 ${yol}`} fill="none" stroke={RENK.mavi} strokeWidth={9} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - merdiven} />
        </svg>
      </Gir>
      <Gir bas={z(b, 4, 0.3)} son={Cv} x={840} y={500} w={500}>
        <Yazi boy={48} renk={RENK.mavi}>düzenli</Yazi>
      </Gir>
      <Gir bas={z(b, 4, 0.55)} son={Cv} x={1150} y={360} w={600}>
        <Yazi boy={48} renk={RENK.mavi}>kendine ait</Yazi>
      </Gir>
      <Gir bas={Cv} x={760} y={440} w={1000} aci={-2}>
        <div style={{ border: `5px double ${RENK.murekkep}`, padding: "16px 30px", background: RENK.kagitAcik, textAlign: "center" }}>
          <Yazi boy={40} font="sans" stil={{ letterSpacing: 4 }}>İLAN</Yazi>
          <Yazi boy={92}>“Hızlı para!”</Yazi>
        </div>
      </Gir>
      <UstunuCiz x={830} y={562} w={860} bas={z(b, 5, 0.25)} kalin={9} />
      <DamgaAt id="d43b" x={1200} y={720} bas={z(b, 5, 0.45)} metin="ŞÜPHE" boy={96} aci={-8} />
    </>
  );
};

const Nota: React.FC = () => (
  <svg width={240} height={260} viewBox="0 0 240 260" style={{ overflow: "visible" }}>
    <path d="M80 200 V40 L210 14 V170" {...ink} strokeWidth={9} />
    <path d="M80 70 L210 44" {...ink} strokeWidth={9} />
    <ellipse cx={56} cy={204} rx={30} ry={22} transform="rotate(-20 56 204)" fill={RENK.murekkep} />
    <ellipse cx={186} cy={174} rx={30} ry={22} transform="rotate(-20 186 174)" fill={RENK.murekkep} />
  </svg>
);

const S44: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 3), Bv = c(b, 4);
  return (
    <>
      <SoruSutunu soru={3} sorBas={c(b, 1)} />
      <Soru metin="Müzik nereden?" bas={c(b, 1)} boy={96} />
      <Gir bas={z(b, 1, 0.3)} son={A} x={1500} y={170}>
        <Nota />
      </Gir>
      <Gir bas={c(b, 2)} son={A} x={720} y={480} aci={-2}>
        <Kupon ust="TELİFLİ" deger="bir şarkı" w={420} />
      </Gir>
      <Ok x1={1150} y1={520} x2={1290} y2={460} bas={z(b, 2, 0.3)} son={A} egri={-0.2} />
      <Ok x1={1150} y1={580} x2={1290} y2={690} bas={z(b, 2, 0.62)} son={A} egri={0.2} />
      <Gir bas={z(b, 2, 0.35)} son={A} x={1310} y={410} w={540}>
        <Yazi boy={56}>video engellenir</Yazi>
      </Gir>
      <Gir bas={z(b, 2, 0.68)} son={A} x={1310} y={650} w={540}>
        <Yazi boy={56}>kazanç başkasına gider</Yazi>
      </Gir>
      <DamgaAt id="d44a" x={760} y={680} bas={z(b, 2, 0.2)} son={A} metin="TELİF" boy={84} aci={-8} />
      <Gir bas={c(b, 3)} son={Bv} x={720} y={460} aci={-2}>
        <Kupon ust="YA" deger="yapay zekâyla üret" w={540} boy={58} />
      </Gir>
      <Gir bas={z(b, 3, 0.45)} son={Bv} x={1300} y={470} aci={2}>
        <Kupon ust="YA DA" deger="açık lisans" w={480} boy={58} />
      </Gir>
      <Gir bas={z(b, 3, 0.7)} son={Bv} x={720} y={700} w={1000}>
        <Nota />
      </Gir>
      <Gir bas={Bv} x={720} y={380} w={1120}>
        <Pencere baslik="muzik-kaynaklari.txt" w={1120}>
          {[
            { t: "parça        | kaynak       | lisans", r: RENK.murekkep },
            { t: "____________ | ____________ | ______", r: `${RENK.murekkep}88` },
            { t: "____________ | ____________ | ______", r: `${RENK.murekkep}88` },
          ].map((s, i) => {
            const t = z(b, 4, 0.1 + i * 0.25);
            return <div key={i} style={{ fontFamily: MONO, fontSize: 36, height: 70, lineHeight: "70px", whiteSpace: "pre", color: s.r, opacity: ara(f, k(t), k(t) + 6) }}>{s.t}</div>;
          })}
        </Pencere>
      </Gir>
      <Gir bas={z(b, 4, 0.6)} x={720} y={790} w={1000}>
        <Yazi boy={48} font="mono" renk={RENK.kirmizi}>her müziğin kaynağı not edilir</Yazi>
      </Gir>
    </>
  );
};

const S45: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 3), Cv = c(b, 5);
  const bar = (y: number, ad: string, oran: number, bas: number, renk: string) => {
    const p = ara(f, k(bas), k(bas) + 20, Easing.out(Easing.cubic));
    return (
      <Gir bas={bas} son={A} x={720} y={y} w={1120}>
        <Yazi boy={44} font="mono">{ad}</Yazi>
        <div style={{ position: "relative", width: 1000, height: 60, marginTop: 8, border: `4px solid ${RENK.murekkep}`, borderRadius: 8, background: RENK.kagitAcik }}>
          <div style={{ position: "absolute", left: 4, top: 4, bottom: 4, width: (1000 - 16) * oran * p, background: renk, borderRadius: 3 }} />
        </div>
      </Gir>
    );
  };
  return (
    <>
      <SoruSutunu soru={4} sorBas={c(b, 1)} />
      <Soru metin="Türkçe yapay zekâ sesleri yeterince iyi mi?" bas={c(b, 1)} />
      {bar(420, "bir yıl önce", 0.32, c(b, 2), `${RENK.murekkep}88`)}
      {bar(580, "bugün", 0.74, z(b, 2, 0.3), RENK.mavi)}
      <Gir bas={z(b, 2, 0.6)} son={A} x={1690} y={420} w={200}>
        <div style={{ height: 300, borderLeft: `5px dashed ${RENK.kirmizi}` }} />
      </Gir>
      <Gir bas={z(b, 2, 0.6)} son={A} x={1420} y={760} w={440}>
        <Yazi boy={44} renk={RENK.kirmizi} stil={{ textAlign: "right" }}>mükemmel: henüz değil</Yazi>
      </Gir>
      {[
        { u: "YUMUŞAK G", d: "ğ" },
        { u: "SORUN 2", d: "kısaltmalar" },
        { u: "YABANCI", d: "kelimeler" },
      ].map((x, i) => (
        <Gir key={x.u} bas={z(b, 3, 0.15 + i * 0.27)} x={720 + i * 380} y={400} aci={i % 2 ? 2 : -2}>
          <Kupon ust={x.u} deger={x.d} w={350} boy={60} renk={RENK.kirmizi} />
        </Gir>
      ))}
      <Gir bas={c(b, 4)} son={Cv - 0.3} x={720} y={620} w={1000}>
        <Pencere baslik="telaffuz paketi" w={1000}>
          {["Claude   → Klod", "YouTube  → Yutup"].map((s, i) => (
            <div key={s} style={{ fontFamily: MONO, fontSize: 40, height: 66, lineHeight: "66px", whiteSpace: "pre", opacity: ara(f, k(z(b, 4, 0.2 + i * 0.3)), k(z(b, 4, 0.2 + i * 0.3)) + 6) }}>{s}</div>
          ))}
        </Pencere>
      </Gir>
      <Gir bas={Cv} x={760} y={600}>
        <WJ poz="dusunen" yas={f - k(Cv)} f={f} boy={400} />
      </Gir>
      <Gir bas={z(b, 5, 0.15)} x={1100} y={800}>
        <Dalga tur="canli" w={720} h={130} f={f} cubuk={44} />
      </Gir>
      <DamgaAt id="d45a" x={1160} y={630} bas={z(b, 5, 0.45)} metin="SON DİNLEME: BEN" boy={52} aci={-5} />
    </>
  );
};

const S46: React.FC<{ b: number }> = ({ b }) => {
  const f = useCurrentFrame();
  const A = c(b, 4), Bv = c(b, 6);
  const kod = ["[C.burnumdan, \"saskin\"],", "[C.olmamis, \"saskin\"],", "[C.bende, \"omuz\"],"];
  const poz: Poz = f >= k(c(b, 5)) ? "dusunen" : "gosteren";
  return (
    <>
      <SoruSutunu soru={5} sorBas={c(b, 1)} />
      <Soru metin="Bunu yapmak için kod bilmem gerekiyor mu?" bas={c(b, 1)} son={Bv} boy={68} />
      <Gir bas={z(b, 1, 0.45)} son={c(b, 2)} x={720} y={460} w={1100}>
        <Yazi boy={52} font="mono" renk={RENK.kirmizi}>son soru</Yazi>
      </Gir>
      <DamgaAt id="d46a" x={900} y={420} bas={c(b, 2)} son={c(b, 3) + 0.4} metin="HAYIR" boy={150} aci={-8} />
      <Gir bas={c(b, 3)} son={A} x={720} y={480}>
        <Daktilo f={f} boy={320} konusuyor goz="acik" bak={[8, 0]} />
      </Gir>
      <Gir bas={z(b, 3, 0.15)} son={A} x={1090} y={430} w={760}>
        <Pencere baslik="Short01.tsx" w={760}>
          {kod.map((s, i) => (
            <div key={s} style={{ fontFamily: MONO, fontSize: 34, height: 60, lineHeight: "60px", whiteSpace: "pre", opacity: ara(f, k(z(b, 3, 0.2 + i * 0.25)), k(z(b, 3, 0.2 + i * 0.25)) + 5) }}>{s}</div>
          ))}
        </Pencere>
        <div style={{ position: "absolute", left: -20, bottom: -30 }}>
          <GercekRozet metin="gerçek kod" />
        </div>
      </Gir>
      <Gir bas={A} son={Bv} x={760} y={420}>
        <WJ poz={poz} yas={f - k(f >= k(c(b, 5)) ? c(b, 5) : A)} f={f} boy={520} />
      </Gir>
      <Gir bas={z(b, 4, 0.1)} son={c(b, 5)} x={1150} y={400}>
        <Balon w={620} h={180} kuyrukX={90}>
          <Yazi boy={52}>Ne istediğini net anlat.</Yazi>
        </Balon>
      </Gir>
      <Gir bas={c(b, 5)} son={Bv} x={1300} y={330} w={260}>
        <PilotOynat kareler={[9]} bas={c(b, 5)} son={cs(b, 5)} w={260} rozet="" />
      </Gir>
      <Gir bas={z(b, 5, 0.15)} son={Bv} x={1440} y={520}>
        <Mercek boy={220} />
      </Gir>
      <Gir bas={z(b, 5, 0.3)} son={Bv} x={1180} y={830} w={700}>
        <Yazi boy={48} font="mono" renk={RENK.kirmizi}>sonuca eleştirel bak</Yazi>
      </Gir>
      {/* son söz */}
      <Gir bas={Bv} x={720} y={300} w={1120}>
        <Yazi boy={110}>kod bilgisi değil,</Yazi>
      </Gir>
      <UstunuCiz x={730} y={372} w={420} bas={z(b, 6, 0.3)} kalin={10} />
      <Gir bas={z(b, 6, 0.4)} x={720} y={500} w={1120}>
        <Yazi boy={170} renk={RENK.kirmizi}>göz ve sabır.</Yazi>
      </Gir>
      <AltCizgi x={730} y={700} w={860} bas={z(b, 6, 0.7)} cift />
    </>
  );
};

export const SAHNELER_D: Record<number, React.FC<{ b: number }>> = {
  ...yerTutucular(31, 46),
  31: S31, 32: S32, 33: S33, 34: S34, 35: S35, 36: S36, 37: S37, 38: S38, 39: S39, 40: S40, 41: S41,
  42: S42, 43: S43, 44: S44, 45: S45, 46: S46,
};

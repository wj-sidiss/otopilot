// GORSEL ARAMA KELIMESI CIKARIMI VE SAHNE PLANI (GO grubu) — saf fonksiyonlar, ag/dosya YOK.
//
// Oncelik (gorsel-akis.js): --sahne N --ara > konu.sahneKelimeleri[sahne-1] > Voice/ARAMALAR.txt (ajan, Ingilizce) >
// Voice/gorsel-aramalari.json > BU DOSYADAKI otomatik cikarim.
// Otomatik cikarim yalnizca YEDEKTIR; soyut paragraflarda sinirlidir, yine de:
//   - Unicode duyarlidir (Turkce/aksanli harfler atilmaz), Ingilizce + Turkce/Ispanyolca/Almanca/Fransizca durak sozcukler
//   - dolgu kelimeler ("aynı", "hep", "neden", sifatlar, fiil cekimleri, cumle sonu yuklemi) ASLA arama terimi/capa olmaz
//   - Turkcede somut isimler ve gok cisimleri Ingilizceye cevrilir (lib/gorsel-sozluk.js: "Ay'ın" -> Moon, "kraterleri" ->
//     crater); cevrilen ifadeler `ingilizce` kumesine yazilir, akis bunlari Ingilizce arar (Pexels'e Turkce locale gitmez)
//   - cumle basi buyuk harfi ozel isim saymaz ("Imagine Einstein" -> "Einstein")
//   - buyuk harfli kisaltmalari (NASA, CERN, GPT) yakalar
//   - komsu icerik kelimelerinden ikili ifade kurar ("black hole", "polar bear")
"use strict";
const sozluk = require("./gorsel-sozluk.js");

// ---------------------------------------------------------------- durak sozcukler
const DURAK_EN = new Set(("a an the and or but if then than that this these those of in on at to for from by with " +
  "as is are was were be been being have has had do does did will would can could should may might must shall " +
  "it its it's we our us you your they their them he she his her i me my not no nor so such very more most " +
  "much many some any all both each few other another same own just also too only even still yet about into " +
  "over under again further once here there when where why how what which who whom while because before after " +
  "above below between through during against among within without across behind beyond upon since until " +
  "one two three first second next last new old good great big small long short high low right left thing " +
  "things something anything everything nothing someone anyone everyone way ways time times year years day days " +
  "make makes made making take takes took taken get gets got getting go goes going gone come comes came " +
  "know knows knew known think thinks thought see sees saw seen look looks looked want wants wanted " +
  "say says said tell tells told give gives gave given find finds found use uses used using " +
  "really actually basically simply literally probably maybe perhaps almost always never often sometimes " +
  "let lets like likes liked well back down out up off now today tomorrow yesterday " +
  "need needs needed later earlier soon forever whenever whatever anyway ahead ago away " +
  // soyut kelimeler: gorsel aramada ise yaramaz
  "moment moments people person story stories part parts half kind sort lot bit " +
  "end ends start starts side sides point points case cases fact facts idea ideas reason reasons " +
  "result results example examples number numbers group groups level levels area areas place places " +
  "life lives work works word words name names form forms line lines order orders state states " +
  "change changes question questions answer answers problem problems chance chances " +
  "sense senses truth kinds amount amounts piece pieces set sets step steps stage stages " +
  "difference differences matter matters issue issues topic subject feeling feelings " +
  "everybody nobody somebody anybody others rest whole entire actual real true false " +
  "begin begins began begun happen happens happened turn turns turned keep keeps kept " +
  "become becomes became put puts seem seems seemed leave leaves bring brings brought " +
  "call calls called working try tries tried ask asks asked show shows showed shown " +
  "mean means meant feel feels felt run runs ran stop stops stopped talk talks talked " +
  "believe believes hear hears heard hold holds held remember remembers write writes wrote " +
  "understand understands sit sits stand stands lose loses lost pay pays paid meet meets met " +
  "week weeks month months hour hours minute minutes seconds " +
  "tonight morning evening night already ever " +
  "little large huge tiny enough far near close early late fast slow hard easy simple " +
  "important different possible impossible available able likely unlikely certain sure " +
  "usually rarely mostly nearly exactly quite rather pretty fairly somewhat entirely completely " +
  "every either neither everywhere anywhere somewhere elsewhere however therefore moreover " +
  "instead besides otherwise meanwhile although though unless whether around throughout " +
  // kapanis cagrilari: hicbir konuda gorsel aramasi degildir
  "subscribe subscribed follow comment comments channel video videos " +
  // kanca/dolgu: gorsellenemez ("Imagine...", "an amazing secret", "millions of...")
  "imagine imagined guess wonder wondered reveal reveals revealed shocking amazing incredible unbelievable crazy insane " +
  "weird strange lots stuff type types billions millions thousands hundreds dozens secret secrets mystery mysteries " +
  "forget notification notifications icon"
  ).split(/\s+/));

const DURAK_TR = new Set(("ve bir bu şu o için ile de da ki mi mı mu mü gibi kadar çok daha en ama fakat ancak çünkü " +
  "olarak olan oldu olur olmuş olacak olduğu olduğunu olması olmak olması var yok ben sen biz siz onlar bunu şunu onu " +
  "bunlar şunlar her hiç bütün tüm sonra önce şimdi artık hem ya veya yani ne nasıl neden niye kim hangi nerede nereye " +
  "üzerinde içinde arasında göre karşı rağmen hâlâ hala bile sadece yalnızca belki zaten bazı birçok birkaç başka diğer " +
  "öyle böyle şöyle kendi kendisi bizim sizin onların benim senin onun bunun şunun üzere dolayı sanki hep hemen çoğu " +
  "pek fazla az eğer ise değil değildir gerek gerçekten aslında özellikle tabii tabi evet hayır peki işte şey şeyler " +
  "zaman kez kere defa yıl gün hafta ay saat dakika oluyor oluyordu yapıyor yapmak yaptı yapılan eder etti etmek edilen " +
  "gelen geldi gelir gidiyor gitti verir verdi aldı alır alan bulunan söyledi dedi diyor diye demek görünce gördü görür " +
  "bilir bildi biliyor istiyor istedi sonunda başında ortasında içindeki dışında altında önünde arkasında yanında " +
  "bunlardan bundan şundan ondan sonrasında öncesinde sırasında ayrıca üstelik yine tekrar sürekli genellikle " +
  "muhtemelen belli hatta oysa halbuki mesela örneğin sonuç neredeyse tam hiçbir herkes kimse biri bazen çoğu " +
  "olmadan olsa olsun olabilir olabilirdi olduğunda olursa dün bugün yarın gece sabah akşam " +
  // dolgu / baglac / zamir / soru (20 Eki 2026: "Ay neden hep aynı yüzünü gösterir?" -> "aynı" arandi)
  "aynı aynısı aynen nedeni nedenle nedeniyle niçin sebebi sebeple yüzden kesinlikle elbette etrafında çevresinde " +
  "boyunca beri itibaren dek değin yaklaşık milyarlarca milyonlarca binlerce yüzlerce onlarca sayısız birlikte beraber " +
  "henüz çoktan yeniden dahi yalnız hepsi hepimiz hepiniz biz bize bizi size sizi ona onları onlara buna bunda şuna şunda " +
  "neyi neye nedir kimin hangisi acaba mısın misin musun müsün mıdır midir mudur müdür vardır yoktur şeyi şeyin biraz gayet " +
  "oldukça epey dahil hakkında ait sayesinde yerine ardından esnasında üstünde karşısında altına altından altındaki " +
  "üstüne içine içinden dışına arka arkaya üst alt dış yan ileri geri aşağı yukarı ilk son sonraki önceki tek iki üç dört " +
  "beş altı yedi sekiz dokuz yüz bin milyon milyar trilyon olmaz ediyor ediyordu edilir denir denilir bilinir bilinen " +
  "görülür görülen sanılır gerekir gerekiyor lazım mümkün imkansız imkânsız tıpkı adeta âdeta resmen kısaca genelde " +
  "çoğunlukla birden aniden tamamen tamamıyla asla daima " +
  // kapanis cagrilari
  "takip abone beğen beğenmeyi kanal kanala kanalı kanalımıza video videoyu videoda videonun videoları izle izleyin " +
  "yorum yorumlara yorumlarda düşün düşünün hayal haydi hadi " +
  // cumle basi / yer gosterme / kanaat dolgulari (cumle basinda buyuk yazilinca ozel ad sanilmasin: "Bakın", "Orada")
  "bakın bakalım asıl aslen kısacası neyse orada burada şurada oraya buraya şuraya oradan buradan şuradan bazıları " +
  "bazısı bizler sizler kaç kaçı öte ötesi ötesinde bence sence galiba herhalde tamam bayağı bilinmeyen bilinmez merak " +
  "hazır arasındaki arasına arasından fazlası fazlasını dolu " +
  // emir / cagri kaliplarina uymayan sik kapanis ve kanca fiilleri
  "gelin bilin inanın dikkat edin unutma unutmayın hatırlayın izleyin yazın söyleyin paylaşın beğenin açın tıklayın " +
  "katılın görüşmek görüşürüz üzere").split(/\s+/));

// Temel durak sozcukler (es/de/fr): yalniz baglac/zamir/edat/yardimci fiil ve dolgu; Ingilizce liste her dilde gecerlidir.
const DURAK_ES = new Set(("el la los las un una unos unas y o pero si no sí que de del al a en con por para sin sobre entre " +
  "hasta desde como más menos muy mucho mucha muchos muchas poco poca todo toda todos todas otro otra otros otras este esta " +
  "estos estas ese esa esos esas aquel aquella esto eso lo le les se me te nos su sus mi mis tu tus nuestro nuestra es son " +
  "era eran fue fueron ser estar está están estaba hay había ha han he hemos tiene tienen tener hace hacen hacer puede " +
  "pueden poder también tampoco ya aún todavía siempre nunca cuando donde dónde porque por qué cómo cuál quién quien cual " +
  "bien mal así entonces luego después antes ahora hoy ayer mañana aquí allí cada mismo misma mismos solo sólo vez veces año " +
  "años día días cosa cosas parte forma manera tiempo gente persona personas algo nada alguien nadie grande pequeño nuevo " +
  "viejo primero primera último última gran buen bueno mejor peor casi sino aunque mientras durante según incluso además " +
  "realmente verdad tan tanto tanta cuanto video vídeo canal suscríbete sigue mismos mismas misterio misterios secreto " +
  "secretos razón respuesta pregunta imagina imagínate increíble increíbles enorme enormes millones miles cientos " +
  "ejemplo").split(/\s+/));
const DURAK_DE = new Set(("der die das den dem des ein eine einer eines einem einen und oder aber wenn dann als wie so auch " +
  "nur noch schon nicht kein keine ist sind war waren sein bin bist hat haben hatte hatten wird werden wurde wurden kann " +
  "können konnte muss müssen soll sollen will wollen ich du er sie es wir ihr mich dich sich uns euch mein dein ihr unser " +
  "euer zu von mit für auf an in im am aus bei nach vor über unter durch gegen ohne um bis seit zwischen dass weil ob denn " +
  "doch ja nein sehr mehr viel viele wenig alle alles jeder jede jedes andere anderen dieser diese dieses jener man was " +
  "wer wo wann warum wieso welche welcher hier dort da jetzt heute gestern morgen immer nie oft manchmal wieder fast etwa " +
  "ganz gar eigentlich wirklich einfach mal also dabei damit dafür davon darum deshalb trotzdem jahr jahre jahren tag tage " +
  "zeit ding dinge teil art weise leute mensch menschen etwas nichts jemand niemand groß große großen klein kleine neu " +
  "neue alt alte erste ersten letzte gut besser beste video kanal abonnieren folge gleich gleiche gleichen gleicher " +
  "gleiches selbe selben derselbe dieselbe dasselbe geheimnis rätsel grund antwort frage wahrheit stell stellt vorstellen " +
  "unglaublich unglaubliche unglaublichen riesig riesige riesigen millionen milliarden tausende hunderte " +
  "beispiel zeigt zeigen sieht sehen gibt geben macht machen").split(/\s+/));
const DURAK_FR = new Set(("le la les un une des du de et ou mais si ne pas plus moins très trop peu tout toute tous toutes " +
  "autre autres ce cet cette ces celui celle ceux mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je tu il " +
  "elle on nous vous ils elles me te se lui en au aux dans sur sous avec sans pour par entre chez vers depuis pendant " +
  "avant après comme que qui quoi dont où quand comment pourquoi est sont était étaient être été avoir ont avait avaient " +
  "fait faire peut peuvent pouvoir doit faut aussi encore déjà toujours jamais souvent parfois ici là maintenant " +
  "aujourd hier demain alors donc ainsi puis enfin même cela ça ceci chaque fois année années ans jour jours temps chose " +
  "choses partie façon manière gens personne personnes quelque rien grand grande petit petite nouveau nouvelle vieux " +
  "premier première dernier dernière bon bonne meilleur vraiment presque seulement surtout cependant pourtant vidéo " +
  "chaîne abonnez abonne mêmes mystère mystères secret secrets raison réponse vérité imaginez imaginer incroyable " +
  "incroyables énorme énormes millions milliards milliers centaines exemple").split(/\s+/));
const DURAK_DIL = { tr: DURAK_TR, es: DURAK_ES, de: DURAK_DE, fr: DURAK_FR };

// ---------------------------------------------------------------- terim secimi (Turkce)
// kelimeler() sayim icin bu kelimeleri tutar; ama SAHNE TERIMI ve CAPA olarak asla secilmezler (sifat, soyut/dolgu isim,
// kapanis cagrisi). Ekli bicimleri de kapsar: "yüzünü" (yüz), "önemliydi" (önemli), "sırlarını" (sır).
const SECIM_DISI_TR = new Set(("eski yeni büyük küçük uzun kısa yüksek alçak iyi kötü güzel çirkin harika muhteşem inanılmaz " +
  "ilginç gizemli garip tuhaf korkunç müthiş önemli farklı benzer gerçek doğru yanlış kolay zor hızlı yavaş derin geniş dar " +
  "ağır hafif yarım çift genel özel basit karmaşık olası belli açık kapalı gizli sonsuz devasa dev koca kocaman ufak minik " +
  "karanlık aydınlık parlak soğuk sıcak kalın ince ilkel modern antik ünlü meşhur popüler nadir yaygın şaşırtıcı korkutucu " +
  "eşsiz benzersiz ciddi kesin net tam uzak yakın " +
  "yüz aynı şey zaman yıl gün hafta saat dakika saniye kez kere kısım parça tür çeşit şekil şekl yer neden sebep sebeb " +
  "sonuç sonuc durum olay konu soru cevap fikir fikr bilgi sır sırr kanal video abone insan kişi hayat dünya taraf " +
  "sayı kat çekim tur süre gizem yanıt detay ayrıntı örnek mesele hikaye hikâye efsane yüzyıl asır asr asl " +
  "bildirim simge abonelik beğeni yorum düşünce").split(/\s+/));
// Fiil cekimi kaliplari (kok sozlukte degilse): -yor, -mak/-mek(te), -ması/-mesi, -dığı/-acağı, genis zaman + kisi,
// olumsuz genis zaman, -ıp, -arak, -ınca, -ken, -madan, -dıkça, -lattı/-landı, -sal/-sel, -sız, zarf -ca/-ce
const TR_FIIL = [
  /[ıiuü]?yor(?:[ıiuü]m|sun|[ıiuü]z|sunuz|lar|d[ıiuü][mnk]?|d[ıiuü]n[ıiuü]z|d[ıiuü]lar|muş|sa)?$/u,
  /^.{2,}m[ae]k(?:t[ae](?:d[ıi]r)?|t[ae]n|s[ıi]z[ıi]n)?$/u,
  /^.{2,}m[ae]s[ıi](?:n[ıi]|n[ae]|nd[ae]|n[ıi]n)?$/u,
  /(?:[dt][ıiuü]ğ|[ae]c[ae]ğ)[ıiuü](?:[mn]|m[ıiuü]z|n[ıiuü]z)?(?:n[ıiuü]|n[ae]|nd[ae]n?|n[ıiuü]n|y[ıiuü]|y[ae]|d[ae])?$/u,
  /^.{2,}[ae]c[ae]k(?:t[ıi]r|s[ıi]n|s[ıi]n[ıi]z|l[ae]r|m[ıi]ş|t[ıi])?$/u,
  /[ıiuüae]r(?:s[ıiuü]n(?:[ıiuü]z)?|[ıiuü]z|d[ıiuü]|m[ıiuü]ş)$/u,
  /^.{2,}m[ae]z(?:s[ıi]n|[ıi]z|l[ae]r)?$/u,
  /^.{2,}[^aeıioöuü][ıiuü]p$/u,
  /^.{2,}[ae]r[ae]k$/u,
  /^.{2,}[ıiuü]n[cç][ae]$/u,
  /(?:[ae]r|[ıiuü]r|y)ken$/u,
  /^.+m[ae]d[ae]n$/u,
  /[dt][ıiuü]k[cç][ae]$/u,
  /^.{3,}l[ae][nşt]?[dt][ıiuü]$/u,
  /^.{3,}s[ae]l$/u,
  /^.{3,}s[ıiuü]z$/u,
  /^.{4,}[cç][ae]$/u,
  // izleyiciye seslenme / kapanis cagrisi kaliplari (her senaryonun son paragrafinda: "Abone olmayı unutmayın"):
  // -mayı/-meyi, olumsuz emir -mayın, emir -ayın/-eyin, istek -alım/-elim ve -ayım/-eyim, -sanıza/-senize,
  // 2. cogul kisi -dınız ve iyelik "-ınız/-iniz" (+hal eki), "-ınla" ("arkadaşlarınla")
  /^.{2,}m[ae]y[ıi]$/u,
  /m[ae]y[ıi]n$/u,
  /^.{3,}[ae]y[ıi]n$/u,
  /^.{2,}[ae]l[ıi]m$/u,
  /^.{2,}[ae]y[ıi]m$/u,
  /s[ae]n[ıi]z[ae]$/u,
  /[dt][ıiuü]n[ıiuü]z$/u,
  /[ıiuü]n[ıiuü]z(?:[ıiuü]|[ae]|d[ae]n?|l[ae]|[ıiuü]n)?$/u,
  /[ıiuü]nl[ae]$/u,
];

// Bir arama ifadesi Ingilizce yerine Turkce mi yazilmis? (ARAMALAR.txt uyarisi icin; kesin degil, yalniz ipucu)
// Turkceye ozgu harf (ğ ı ş İ) ya da ç/ö/ü + Turkce sozcuk ya da en az iki Turkce sozcuk ("dolunay gece gökyüzü").
const EN_ORTAK = new Set("son alt yan tam kale pasta kent kurt para bin ilk dev".split(" "));
function turkceGorunuyorMu(ifade) {
  const s = String(ifade || "");
  if (/[ğĞıİşŞ]/.test(s)) return true;
  let kanit = 0;
  for (const w of s.toLocaleLowerCase("tr").split(/[^\p{L}]+/u)) {
    if (w.length < 3 || EN_ORTAK.has(w) || DURAK_EN.has(w)) continue;
    const c = sozluk.cevir(w);
    if (DURAK_TR.has(w) || (c && c.en.toLowerCase() !== w)) kanit++;
  }
  return kanit >= 2 || (kanit >= 1 && /[çÇöÖüÜ]/.test(s));
}

// Metindeki cumle sonu kelimeleri (Turkcede cogunlukla yuklem: "gösterir", "yavaşlattı"). -> Set(kucuk)
function cumleSonlari(metin, dil) {
  const s = new Set();
  const b = sozluk.belirtecler(metin);
  for (let i = 0; i < b.length; i++) if (i === b.length - 1 || b[i + 1].basta) s.add(temizKelime(kucukHarf(b[i].taban, dil), dil));
  return s;
}

// Kelime (kucuk, temizlenmis) sahne terimi ya da capa OLABILIR mi? sonlar: cumle sonu kelimeleri (yalniz Turkce)
function terimOlabilir(w, dil, sonlar) {
  if (!w || durakMi(w, dil)) return false;
  if (dil !== "tr") return true;
  if (sozluk.cevir(w)) return true;                                // somut isim (sozlukte): her zaman aday
  if (sozluk.kokler(w).some(k => SECIM_DISI_TR.has(k))) return false;
  if (TR_FIIL.some(re => re.test(w))) return false;
  if (sonlar && sonlar.has(w)) return false;
  return true;
}

// Cumle basinda buyuk yazilir ama ozel isim DEGILDIR (DURAK'ta olmayanlar)
const CUMLE_BASI_EN = new Set(("imagine picture consider suppose meet welcome think look watch listen wait notice " +
  "remember maybe perhaps meanwhile however instead finally stay try ask tell say come go see stop wait " +
  "yes okay sometimes nobody everyone someone everything nothing something anything somewhere tonight").split(/\s+/));

// Kisaltma gibi gorunen ama anlam tasimayan buyuk harf dizileri
const KISALTMA_KARA = new Set(["OK", "AM", "PM", "VS", "NO", "SO", "OR", "IT", "IS", "IF", "IN", "ON", "AT", "TO", "OF",
  "BY", "AS", "AN", "BE", "DO", "GO", "HE", "ME", "MY", "WE", "US", "ALL", "THE", "AND", "BUT", "FOR", "NOT", "YOU",
  "ARE", "WAS", "HAS", "HAD", "CAN", "NOW", "NEW", "ONE", "TWO", "BIR", "VE", "BU"]);

const kucukHarf = (s, dil) => (dil === "tr" ? String(s).toLocaleLowerCase("tr") : String(s).toLowerCase());
const durakMi = (w, dil) => DURAK_EN.has(w) || (!!DURAK_DIL[dil] && DURAK_DIL[dil].has(w));

// Aksan/Turkce karakterleri sadelestirir (karsilastirma icin): "Şeker" ~ "seker"
function katla(s) {
  return String(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i").replace(/İ/g, "i").toLowerCase();
}

// ---------------------------------------------------------------- kelime ayiklama
function temizKelime(w, dil) {
  let x = w.replace(/^['’-]+|['’-]+$/g, "");
  if (dil === "tr") x = x.replace(/['’]\p{L}{1,5}$/u, "");        // İstanbul'da -> istanbul
  else if (dil === "fr") x = x.replace(/^(?:l|d|j|m|n|s|t|c|qu)['’](?=\p{L})/u, "");   // l'univers -> univers
  else x = x.replace(/['’]s$/, "");                              // Einstein's -> einstein
  return x;
}

// Icerik kelimeleri (sirasi korunur, tekrarlar korunur)
function kelimeler(metin, dil) {
  return kucukHarf(metin, dil)
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .split(/\s+/)
    .map(w => temizKelime(w, dil))
    .filter(w => w.length > 2 && !durakMi(w, dil) && !/^\p{N}+$/u.test(w));
}

// Ozel isimler: "Cristiano Ronaldo", "Tower of London", "NASA". Cumle basindaki sıradan kelimeyi saymaz.
const BAGLAC = "(?:of|de|da|di|del|della|van|von|der|den|la|le|al|bin|el)";
const BUYUK = "\\p{Lu}\\p{Ll}{2,}(?:-\\p{Lu}\\p{Ll}+)?";
const RE_OZEL = new RegExp("([.!?…]\\s+|[\"“”]\\s*|\\n\\s*)?(" + BUYUK + "(?:\\s+(?:" + BAGLAC + "\\s+)?" + BUYUK + ")*)", "gu");
const RE_KISALTMA = /(?<![\p{L}\p{N}])\p{Lu}{2,6}(?![\p{L}\p{N}])/gu;

// kucuk: tum senaryoda KUCUK harfle gecen kelimelerin kumesi ("imagine" kucuk gecmisse cumle basindaki Imagine ozel isim degildir)
// ozelKanit (Turkce, istege bagli): senaryoda cumle ortasinda buyuk harfle ya da kesmeyle yazilan kelimeler
// (sozluk.ozelKanitlari). Verilirse cumle basindaki TEK buyuk harfli kelime bu kumede yoksa ozel isim sayilmaz
// ("Arka yüzünü ilk kez..." -> "Arka" degil). Cumle basindaki Turkce dolgu/sifat/fiil ve sozlukteki somut isimler
// ("Gökyüzüne bakınca") de ozel isim degildir.
function ozelIsimler(paragraf, secenek) {
  const o = secenek || {};
  const dil = o.dil || "en";
  const kucuk = o.kucuk || new Set();
  const siradan = w => {
    const k = kucukHarf(w, dil);
    if (durakMi(k, dil) || CUMLE_BASI_EN.has(k) || kucuk.has(k)) return true;
    return dil === "tr" && (!terimOlabilir(k, dil) || !!sozluk.cevir(k));
  };
  const bulunan = [];
  const metin = String(paragraf);
  let m;
  RE_OZEL.lastIndex = 0;
  while ((m = RE_OZEL.exec(metin)) !== null) {
    const cumleBasi = m.index === 0 || !!m[1];
    const kelimeler_ = m[2].split(/\s+/);
    // Cumle basindaki siradan kelimeyi at ("Imagine Einstein" -> "Einstein", "But Today" -> "")
    // Cumle basindaki tek kelime senaryoda hic kucuk harfle gecmiyorsa ("Einstein was...") ozel isim sayilir.
    if (cumleBasi) {
      while (kelimeler_.length && (siradan(kelimeler_[0]) || BAGLAC_TEST.test(kelimeler_[0]))) kelimeler_.shift();
      // tek kelime ve hic kaydirilmadi (cumlenin ILK kelimesi): kanit yoksa ozel isim degil
      if (o.ozelKanit && m[2].split(/\s+/).length === 1 && kelimeler_.length === 1 &&
          !o.ozelKanit.has(kucukHarf(kelimeler_[0], dil))) continue;
    }
    if (!kelimeler_.length) continue;
    const ifade = kelimeler_.join(" ");
    if (durakMi(kucukHarf(ifade, dil), dil)) continue;
    bulunan.push(ifade);
  }
  RE_KISALTMA.lastIndex = 0;
  // vurgu icin BUYUK yazilmis dolgu kelime kisaltma degildir ("Ay HEP AYNI yüzünü...", "it is VERY big")
  while ((m = RE_KISALTMA.exec(metin)) !== null) {
    const k = kucukHarf(m[0], dil);
    if (!KISALTMA_KARA.has(m[0]) && !durakMi(k, dil) && !(dil === "tr" && !terimOlabilir(k, dil))) bulunan.push(m[0]);
  }
  return [...new Set(bulunan)];
}
const BAGLAC_TEST = new RegExp("^" + BAGLAC + "$");

// Senaryoda KUCUK harfle gecen kelimeler (ozelIsimler icin)
function kucukSozluk(senaryo, dil) {
  const k = new Set();
  const re = /(?<![\p{L}\p{N}])\p{Ll}[\p{L}'’-]{2,}/gu;
  let m;
  while ((m = re.exec(String(senaryo))) !== null) k.add(kucukHarf(temizKelime(m[0], dil), dil));
  return k;
}

// ---------------------------------------------------------------- senaryo capasi
// Capanin ilk iki ogesi ayni dildeyse birlesik metin ("black hole galaxy"); biri cevrilmis (Ingilizce), digeri Turkceyse
// karisik dil aranmasin diye yalniz ilki. Ingilizce birlesim `ingilizce` kumesine eklenir.
function capaMetni(capa, ingilizce) {
  const c = (capa || []).slice(0, 2);
  if (c.length < 2) return c[0] || "";
  const ing = x => !!ingilizce && ingilizce.has(x);
  if (ing(c[0]) !== ing(c[1])) return c[0];
  const m = c.join(" ");
  if (ing(c[0]) && ingilizce) ingilizce.add(m);
  return m;
}

// Bir ozel isim ifadesinin TUM kelimeleri sozlukte cevrildiyse (tuketildiyse) Turkce hali tekrar aday olmaz ("Dünya" -> Earth)
const tuketildiMi = (ifade, tuketilen, dil) =>
  !!tuketilen && tuketilen.size > 0 && kucukHarf(ifade, dil).split(/\s+/).every(k => tuketilen.has(k));

// Turkce paragraf: sozluk terimleri (Ingilizce) + tuketilen kelimeler. Diger dillerde bos.
const BOS_TERIM = { liste: [], tuketilen: new Set() };
function sozlukTerimleri(metin, dil, senaryo) {
  if (dil !== "tr") return BOS_TERIM;
  return sozluk.terimler(metin, { senaryo, durakMi: k => durakMi(k, dil) });
}

// Tum senaryonun genel konusu: her sahne icin garanti yedek arama.
// secenek: {dil, kucuk, ozelKanit, ingilizce: Set (CIKTI: cevrilmis capa ogeleri buraya eklenir)}
function genelCapa(senaryo, paragraflar, secenek) {
  const o = secenek || {};
  const dil = o.dil || "en";
  const sayim = {}, paragrafta = {};
  for (const w of kelimeler(senaryo, dil)) sayim[w] = (sayim[w] || 0) + 1;
  for (const p of paragraflar)
    for (const w of new Set(kelimeler(p, dil))) paragrafta[w] = (paragrafta[w] || 0) + 1;

  // Turkce: senaryodaki ozel isim/somut isim cevirileri (paragraf basina bir kez sayilir)
  const ozelSayim = new Map(), somutSayim = new Map(), cevrilen = new Set(), tuketilen = new Set();
  const kucuk = o.kucuk || kucukSozluk(senaryo, dil);
  for (const p of paragraflar) {
    const t = sozlukTerimleri(p, dil, senaryo);
    const gorulen = new Set();
    for (const x of t.liste) {
      if (gorulen.has(x.en)) continue;
      gorulen.add(x.en); cevrilen.add(x.en);
      const hedef = x.tur === "ozel" ? ozelSayim : somutSayim;
      hedef.set(x.en, (hedef.get(x.en) || 0) + 1);
    }
    for (const k of t.tuketilen) tuketilen.add(k);
    for (const n of ozelIsimler(p, { dil, kucuk, ozelKanit: o.ozelKanit }))
      if (!tuketildiMi(n, t.tuketilen, dil) && !gorulen.has(n)) { gorulen.add(n); ozelSayim.set(n, (ozelSayim.get(n) || 0) + 1); }
  }

  // Konuyu temsil eden kelime = EN COK PARAGRAFTA gecen kelime (tek seferlik nadir kelime degil). Dolgu kelimeler
  // ("aynı", "hep"), sifatlar, fiil cekimleri ve cumle sonu yuklemleri capa OLAMAZ; sozlukte cevrilen kelime Ingilizce
  // haliyle (yukarida) sayilir.
  const sonlar = dil === "tr" ? cumleSonlari(senaryo, dil) : null;
  const sirali = Object.keys(sayim)
    .filter(w => terimOlabilir(w, dil, sonlar) && !(dil === "tr" && (sozluk.cevir(w) || tuketilen.has(w))))
    .sort((a, b) => (paragrafta[b] - paragrafta[a]) || (sayim[b] - sayim[a]) || a.localeCompare(b));

  const capa = [];
  const ekle = x => {
    if (katla(capa.join(" ")).includes(katla(x))) return;
    capa.push(x);
    if (cevrilen.has(x) && o.ingilizce) o.ingilizce.add(x);
  };
  // en cok paragrafta gecen ozel isim (esitlikte once gecen)
  const ozelSirali = [...ozelSayim.entries()].sort((a, b) => b[1] - a[1]);
  if (ozelSirali.length) ekle(ozelSirali[0][0]);
  // Turkce: birden cok paragrafta gecen somut isimler (Ingilizce)
  for (const [en, n] of [...somutSayim.entries()].sort((a, b) => b[1] - a[1])) {
    if (capa.length >= 3) break;
    if (n < 2 && capa.length) break;
    ekle(en);
  }
  for (const w of sirali) {
    if (capa.length >= 3) break;
    if (paragrafta[w] < 2 && capa.length) break;              // tek paragrafta gecen kelime capa olamaz
    ekle(w);
  }
  return capa;
}

// Yan yana iki icerik kelimesi ("black hole") -> kac kez gectigi. Senaryo boyunca tekrar eden ikili ifade
// gercek bir kavramdir ("polar bear"); bir kez gecen rastgele komsu kelimeler degildir.
// Turkcede dolgu/sifat/fiil iceren ikililer ("aynı yüzünü", "baktığında aynı") ve sozlukte Ingilizcesi olan kelimeler
// (Ingilizce terim olarak ayrica aday olurlar) ikili kurmaz.
function ikiliSayimlari(metin, dil) {
  const sonlar = dil === "tr" ? cumleSonlari(metin, dil) : null;
  const ham = kucukHarf(metin, dil).replace(/[^\p{L}\p{N}\s'’-]/gu, " ").split(/\s+/).filter(Boolean)
    .map(w => {
      const t = temizKelime(w, dil);
      if (!(t.length > 2 && !durakMi(t, dil) && !/^\p{N}+$/u.test(t))) return null;
      if (dil === "tr" && (!terimOlabilir(t, dil, sonlar) || sozluk.cevir(t))) return null;
      return t;
    });
  const sayim = new Map();
  for (let i = 0; i + 1 < ham.length; i++) {
    if (ham[i] && ham[i + 1] && ham[i] !== ham[i + 1]) {
      const a = ham[i] + " " + ham[i + 1];
      sayim.set(a, (sayim.get(a) || 0) + 1);
    }
  }
  return sayim;
}

// ---------------------------------------------------------------- paragraf icin arama ifadeleri
// Dondurur: en iyiden en genele sirali, tekil ifade listesi.
// baglam: {genelSayim, toplamKelime, capa, paragrafta, dil, kucuk, ikiliGenel,
//          senaryo (Turkce belirsiz ozel adlar icin), ozelKanit, ingilizce: Set (CIKTI: Ingilizce aranacak ifadeler)}
function ifadeCikar(paragraf, baglam) {
  const b = baglam || {};
  const dil = b.dil || "en";
  const genelSayim = b.genelSayim || {};
  const paragrafta = b.paragrafta || {};
  const toplamKelime = b.toplamKelime || 1000;
  const capa = b.capa || [];
  const ingilizce = new Set();                                 // bu listede Ingilizce olan ifadeler

  // Turkce: gok cisimleri / somut isimler Ingilizceye cevrilir ("Ay'ın" -> Moon, "kraterleri" -> crater)
  const t = sozlukTerimleri(paragraf, dil, b.senaryo);
  const ozelEn = t.liste.filter(x => x.tur === "ozel").map(x => x.en);
  const somutEn = t.liste.filter(x => x.tur !== "ozel").map(x => x.en);
  for (const x of t.liste) ingilizce.add(x.en);

  const sonlar = dil === "tr" ? cumleSonlari(paragraf, dil) : null;
  const k = kelimeler(paragraf, dil)
    .filter(w => terimOlabilir(w, dil, sonlar) && !(dil === "tr" && (sozluk.cevir(w) || t.tuketilen.has(w))));
  const yerel = {};
  for (const w of k) yerel[w] = (yerel[w] || 0) + 1;
  const puan = w => (yerel[w] || 0) * Math.log(toplamKelime / (genelSayim[w] || 1) + 1);

  // Metinde SADECE BIR KEZ gecen kelime konuyu temsil etmez; konu kelimeleri tekrar eder.
  const tumTekil = [...new Set(k)].sort((x, y) => puan(y) - puan(x));
  const tekrarEden = tumTekil.filter(w => (paragrafta[w] || 0) >= 2 || (genelSayim[w] || 0) >= 3);
  const tekil = tekrarEden.length ? tekrarEden : tumTekil;
  // ozel isimler: cevrilenler (Ingilizce) once, sonra cevrilemeyen Turkce adlar ("Galata Kulesi"); en cok 2
  const ozel = ozelEn.concat(ozelIsimler(paragraf, { dil, kucuk: b.kucuk, ozelKanit: b.ozelKanit })
    .filter(n => !tuketildiMi(n, t.tuketilen, dil)));

  // Ikili ifadeler: yan yana iki icerik kelimesi ("black hole"); senaryoda tekrar edenler one gecer
  const ikili = ikiliSayimlari(paragraf, dil);
  const genelIkili = b.ikiliGenel || new Map();
  const ikiliPuan = x => {
    const [x1, x2] = x.split(" ");
    return puan(x1) + puan(x2) + 2.5 * Math.min(4, (genelIkili.get(x) || 1) - 1) + (ikili.get(x) - 1);
  };
  const ikiliSirali = [...ikili.keys()].filter(x => !x.split(" ").some(w => t.tuketilen.has(w)))   // "sondası luna" (uzay sondası cevrildi)
    .sort((x, y) => ikiliPuan(y) - ikiliPuan(x));

  const capaMetin = capaMetni(capa, b.ingilizce);
  // SIRA ONEMLI: paragrafin KENDI kelimesi once; capa yalnizca yedek.
  const aday = [];
  ozel.slice(0, 2).forEach(o => aday.push(o));               // 1. ozel isimler — en degerli
  somutEn.slice(0, 2).forEach(o => aday.push(o));            // 1b. Turkce: sozlukteki somut isimler (Ingilizce)
  if (ikiliSirali[0]) aday.push(ikiliSirali[0]);              // 2. en iyi ikili ifade ("polar bear"): tek kelimeden daha belirgin
  if (tekil[0]) aday.push(tekil[0]);                          // 3. paragrafin en ayirt edici kelimesi
  if (tekil[1]) aday.push(tekil[1]);                          // 4. ikinci kelime
  // 5. konu + kelime: yalnizca konu adi bu paragrafta da geciyorsa (cok konulu senaryoda alakasiz birlesim uretmesin);
  //    cevrilmis (Ingilizce) capa Turkce kelimeyle birlestirilmez
  const capaIng = x => !!b.ingilizce && b.ingilizce.has(x);
  if (capa[0] && tekil[0] && !capaIng(capa[0]) && !katla(capa[0]).includes(katla(tekil[0])) && katla(paragraf).includes(katla(capa[0])))
    aday.push(capa[0] + " " + tekil[0]);
  if (capaMetin) aday.push(capaMetin);                        // 6. garanti yedek: genel konu
  if (capa[0]) aday.push(capa[0]);
  for (const x of capa) if (capaIng(x)) ingilizce.add(x);
  if (capaMetin && capaIng(capaMetin)) ingilizce.add(capaMetin);

  // buyuk/kucuk harf farkiyla tekrar eden ifadeler ("Ronaldo", "ronaldo") bir kez
  const goruldu = new Set(), son = [];
  for (const x of aday.filter(Boolean).map(y => y.trim()).filter(y => y.length >= 3)) {
    const k = katla(x);
    if (!goruldu.has(k)) { goruldu.add(k); son.push(x); }
  }
  if (b.ingilizce) for (const x of son) if (ingilizce.has(x)) b.ingilizce.add(x);
  return son;
}

// ---------------------------------------------------------------- kozmik konu tespiti (NASA icin)
// Turkce kokler \p{L}* ile (\w yalniz ASCII'dir: "yıldızların" eslesmiyordu). Kesmeli "Ay'ın" ve "uzay" gucludur.
const KOZMIK_GUCLU = /(?<![\p{L}\p{N}])(nebula|galax(?:y|ies)|cosmos|cosmic|quasar|supernova|astronaut\w*|astronomy|spacecraft|interstellar|spacetime|black holes?|solar system|milky way|nasa|hubble|telescope|orbit|planets?|asteroids?|comets?|neutron stars?|galaksi\p{L}*|gezegen\p{L}*|kara delik\p{L}*|evren\p{L}*|astronot\p{L}*|astronomi\p{L}*|teleskop\p{L}*|yörünge\p{L}*|kuyruklu yıldız\p{L}*|asteroit\p{L}*|uzay\p{L}*|ay['’]\p{L}+|dolunay\p{L}*|samanyolu\p{L}*|bulutsu\p{L}*|göktaşı\p{L}*)(?![\p{L}\p{N}])/giu;
const KOZMIK_GENIS = /(?<![\p{L}\p{N}])(nebula|galax\w*|cosmos|cosmic|quasar|supernova|astronaut\w*|astronom\w*|spacecraft|interstellar|spacetime|space-time|black holes?|solar system|milky way|nasa|hubble|telescope|orbit\w*|planets?|asteroids?|comets?|neutron stars?|stars?|moon|lunar|craters?|mars|jupiter|saturn|venus|mercury|universe|space station|rocket|satellite|galaksi\p{L}*|gezegen\p{L}*|kara delik\p{L}*|evren\p{L}*|yıldız\p{L}*|astronot\p{L}*|teleskop\p{L}*|yörünge\p{L}*|asteroit\p{L}*|roket\p{L}*|uydu\p{L}*|güneş sistemi|uzay\p{L}*|ay['’]\p{L}+|dünya['’]\p{L}+|dolunay\p{L}*|krater\p{L}*)(?![\p{L}\p{N}])/iu;

// "space" tek basina yetmez: futbol metnindeki "half second of space" NASA'yi tetikliyordu.
function kozmikMi(senaryo) {
  const v = String(senaryo).match(KOZMIK_GUCLU);
  return !!v && v.length >= 3;
}
const kozmikSahneMi = metin => KOZMIK_GENIS.test(String(metin));
// Sanat / tarih / antik donem sahnesi: muze kaynaklari (Met, AIC, Cleveland) yalniz bu durumda sorgulanir
const SANAT_GENIS = /(?<![\p{L}\p{N}])(paintings?|painters?|portraits?|sculptures?|statues?|art ?works?|artists?|museum|renaissance|baroque|impressionis\w*|medieval|ancient|antiquit\w*|archaeolog\w*|pharaohs?|egypt\w*|roman|romans|greek|greeks|byzantine|ottoman|dynasty|empire|emperors?|kings?|queens?|armou?r|manuscripts?|ceramics?|pottery|tapestr\w*|mythology|history|historical|resim\p{L}*|ressam\p{L}*|heykel\p{L}*|sanat\p{L}*|müze\p{L}*|rönesans\p{L}*|antik\p{L}*|arkeolo\p{L}*|firavun\p{L}*|mısır\p{L}*|roma\p{L}*|bizans\p{L}*|osmanlı\p{L}*|hanedan\p{L}*|imparator\p{L}*|imparatorluk\p{L}*|tarih\p{L}*|orta çağ\p{L}*|mitoloji\p{L}*)(?![\p{L}\p{N}])/iu;
const sanatSahneMi = metin => SANAT_GENIS.test(String(metin));

// ---------------------------------------------------------------- sahne plani
const kelimeSay = m => String(m).split(/\s+/).filter(Boolean).length;

// Kanonik paragraflari sahnelere toplar. Kisa paragraflar KOMSUYLA birlesir (dusmez):
// her sahne ~10 sn (kisa videoda ~6 sn) anlatim tasimali. HER paragraf tam bir sahnede.
//   -> [{no:1, paragraflar:[0,1], metin, kelime}]
function sahnePlan(paragraflar, secenek) {
  const o = secenek || {};
  const MIN = o.kisa ? 14 : 22;
  const sahneler = [];
  paragraflar.forEach((p, idx) => {
    const k = kelimeSay(p);
    const son = sahneler[sahneler.length - 1];
    if (son && son.kelime < MIN) { son.paragraflar.push(idx); son.metin += " " + p; son.kelime += k; }
    else sahneler.push({ paragraflar: [idx], metin: p, kelime: k });
  });
  // kisa kalan son sahne bir oncekine katilir
  if (sahneler.length > 1 && sahneler[sahneler.length - 1].kelime < MIN) {
    const son = sahneler.pop(), onceki = sahneler[sahneler.length - 1];
    onceki.paragraflar.push(...son.paragraflar); onceki.metin += " " + son.metin; onceki.kelime += son.kelime;
  }
  sahneler.forEach((s, i) => { s.no = i + 1; });
  return sahneler;
}

// Bir sahnede kac gorsel olsun: ~8 sn'de bir (kisa videoda ~6 sn), 2-14 arasi.
// Toplam 160'i asmasin diye (cok uzun videolar) oransal kisilir.
function sahneAdetleri(sahneler, secenek) {
  const o = secenek || {};
  const hiz = o.kelimeHizi || 151;
  const aralik = o.kisa ? 6 : 8;
  const adet = sahneler.map(s => Math.max(2, Math.min(14, Math.ceil((s.kelime / hiz * 60) / aralik))));
  const toplam = adet.reduce((a, b) => a + b, 0);
  const TAVAN = o.tavan || 160;
  if (toplam > TAVAN) {
    // cok uzun videoda sahne basina taban 1'e iner (yoksa 100+ sahnede 2'ser gorsel tavani asar)
    const taban = sahneler.length * 2 > TAVAN ? 1 : 2;
    const oran = TAVAN / toplam;
    for (let i = 0; i < adet.length; i++) adet[i] = Math.max(taban, Math.round(adet[i] * oran));
  }
  return adet;
}

// "Albert Einstein" -> "albert-einstein" (klasor adi icin, <=24 karakter, ASCII)
function klasorSlug(ifade) {
  const s = katla(ifade).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  return s || "sahne";
}
const sahneKlasorAdi = (no, ifade) => String(no).padStart(3, "0") + "-" + klasorSlug(ifade);

module.exports = {
  DURAK_EN, DURAK_TR, DURAK_ES, DURAK_DE, DURAK_FR, SECIM_DISI_TR, kelimeler, ozelIsimler, kucukSozluk, genelCapa, ifadeCikar,
  ikiliSayimlari, terimOlabilir, cumleSonlari, capaMetni, turkceGorunuyorMu, ozelKanitlari: sozluk.ozelKanitlari,
  kozmikMi, kozmikSahneMi, sanatSahneMi, sahnePlan, sahneAdetleri, klasorSlug, sahneKlasorAdi, katla, kelimeSay, durakMi, kucukHarf,
};

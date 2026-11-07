// Fontsource'ta "ı" latin, "ş ğ İ" latin-ext dosyasında; Türkçe için ikisi de yüklenir.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const LATIN = "U+0000-00FF, U+0131, U+2000-206F, U+20AC, U+2122";
const LATIN_EXT = "U+0100-0130, U+0132-024F";

const yukle = (family: string, dosya: string, weight: string, style = "normal") =>
  Promise.all([
    loadFont({ family, url: staticFile(`fonts/${dosya.replace("{alt}", "latin")}`), weight, style, unicodeRange: LATIN }),
    loadFont({ family, url: staticFile(`fonts/${dosya.replace("{alt}", "latin-ext")}`), weight, style, unicodeRange: LATIN_EXT }),
  ]);

let hazir: Promise<unknown> | null = null;

export const fontlariYukle = () => {
  hazir ??= Promise.all([
    ...["400", "600", "800", "900"].map((w) => yukle("Inter", `inter-{alt}-${w}-normal.woff2`, w)),
    yukle("Instrument Serif", "instrument-serif-{alt}-400-normal.woff2", "400"),
    yukle("Instrument Serif", "instrument-serif-{alt}-400-italic.woff2", "400", "italic"),
    ...["400", "700"].map((w) => yukle("JetBrains Mono", `jetbrains-mono-{alt}-${w}-normal.woff2`, w)),
    // etsyotomasyon arayüzünün başlık fontu (değişken kalınlık, OFL)
    yukle("Plus Jakarta Sans", "plus-jakarta-sans-{alt}-var.woff2", "200 800"),
  ]);
  return hazir;
};

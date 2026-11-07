# Interview

<!--
For the agent:
- This is the Film mode interview. The mode question (Quick / Film, SKILL.md "First questions"; the steps: references/film-mode.md) comes before it;
  Quick mode uses its own questions in one round (references/quick-mode.md §1): idea · medium · length and format ·
  style and mood · "Ses / Sound" · "Müzik / Music" (its own question): a) narrator + music · b) music + sound effects only, no words · c) on-screen
  text + music · d) own; ★ by purpose (promo / explainer → a; mood / art piece → b); never pick the voice-over
  silently. With a narrator, the same round adds voice type (warm documentary, energetic, intimate first person,
  elderly storyteller, playful, deadpan) and language (★ the user's language), as a follow-up tool call or as
  sub-options in the text message; word budget 30 s ≤ 40, 60 s ≤ 80; default engine Gemini TTS with a style
  prompt (ElevenLabs optional; the user's key and OK). The one-line sound identity follows that answer.
  The fifth question is "Referanslar / References": ★ search open sources, one board · only my own (refs/) · skip.
  Answers go into templates/quick/STATE.md (Sound (Q4), Music, Voice, Sound identity), not into this file.
- Question tool first (SKILL.md "Asking the user"): when the environment has an interactive multiple-choice tool
  (Claude Code: AskUserQuestion, 1-4 questions per call, 2-4 options each, an "Other" row always added;
  Cursor: AskQuestion), USE IT: one question per item, 2-4 options with the ★ one first and "★ (recommended)"
  in its label, the user's own answer always allowed; ask in the order of `references/film-mode.md` (Step 1): call 1 = Q1 and Q2 (two questions: length and format, and the medium); then the direction board is built for the picked interpretation and sent; call 2 = Q3 (about the board) and Q4; call 3 = Q5 and Q6;
  Q1 stays an open question (plain message or the "Other" field) when no idea has been given yet. The defaults
  block goes in a short text message before the first call.
- Without such a tool: the same order in messages (Q1 and Q2, then the board with Q3 and Q4, then Q5 and Q6), numbered, in the user's language (English and Turkish versions below).
- Q1 asks for the user's own idea first, as free text. If their first message already contains an idea, show
  2-3 interpretations of THAT idea in Q1 (one marked ★). Only if they say "no idea / suggest" ("fikrim yok /
  sen öner") offer 3 ideas. Never replace their idea with an unrelated one.
- Every other question: 3-5 concrete options, one marked ★ (recommended for this idea, with a few words why),
  and always "your own answer". A free answer is never forced into an option. If the idea is not known yet, mark
  the ★ that suits most ideas and refine the options in the follow-up.
- Q6 is in words only: Quality / Balanced / Economy. Never show money amounts.
- The purpose (Cinematic / Ad & product) is asked with the mode, before this interview; its file
  (references/purpose-cinematic.md or purpose-ad.md) sets the ★ of Q3 and Q5 and its own follow-up inputs.
- If the purpose is Ad & product (or Q1 shows a product, brand, ad or sponsor film), ask for the facts the specificity test needs (name and meaning,
  place, numbers, one constraint, materials, rituals, printed objects, sounds; references/writing.md §12) in one
  follow-up line; the full test is mandatory for these films. A story piece gets the light world test only.
- After the questions, show the defaults block once. "ok" / "tamam" accepts all of it; any line can be changed.
- Check the machine yourself (node, python3, ffmpeg, Chrome, free disk, capture.mjs --probe); never ask.
- The context and revision protocol (references/context-protocol.md) applies from this message on; the defaults
  block names it in one line.
- When answers arrive: write them into the Answers table below (Source: user / accepted ★ / default), set the
  STATE.md fields, then write the roadmap. If Q1 came back as a bare idea, the roadmap message opens with the 2-3
  interpretations to pick from.
-->

## Message (English)

> Let's make your film. Six quick questions; pick an option, combine them, or answer in your own words.
>
> **1. Your idea.** What is the film about, in a sentence or two? (If you have none, say "suggest" and I'll offer three.)
> *[If an idea is already known: 2-3 interpretations of it, one ★, plus "your own".]*
>
> **2. Length and format** (★ the length this idea needs, and why). a) 15 s vertical 9:16 (Reels/Shorts/TikTok) · b) 30 s vertical 9:16 · c) 60 s vertical or 16:9 · d) 1–3 min 16:9 (YouTube) · e) 3–8 min, built in acts · f) square 1:1 · g) your own
> - Medium, what the film is made of (asked as its own question): a) ★ *[the medium that suits the idea, and why]* · b) 3D realistic (real light and materials, like live action; the longest to build, above all with several worlds) · c) 2D animation (cel, rubber hose, anime) · d) hand-made (paint, ink, cut paper, clay or a maquette) · e) motion design · f) your own
>
> **3. Style** (with the direction board image, `review/directions.jpg`, three directions authored for this film): A) *[name: one line of the look and why it serves the story]* · B) *[…]* · C) *[…]*: ★ *[the one that fits, with a reason]* · see a proof frame of each first (this film's own subject in each direction) · from my references (drop images into `refs/`) · your own
>
> **4. Tone and references.** Three mood words, plus anything you love (images in `refs/`, links or film titles with timestamps in `refs/links.txt`). a) ★ *[three words that fit the idea]* · b) *[another set]* · c) *[a contrasting set]* · d) your own: Should I search open sources for references too? ★ yes, one board with the roadmap · only mine · skip
>
> **5. Voice and sound.**
> - Voice (★ from the purpose file, with a reason): a) none (picture and sound tell it) · b) narrator (warm, deadpan, playful, intimate first person, storyteller…) · c) dialogue · d) your own
> - Music, always its own question: a) ★ a real open-licence recording (2–3 candidates played to you, you pick by ear; a long film may take one per act) · b) my own song or track (send the file, and the lyric timings if it has words) · c) written in code for this film (code scores share a small set of voices and sound alike from film to film) · d) no music, sound design only
> - Sound identity, one line each: a) ★ *[concept 1]* · b) *[concept 2]* · c) *[concept 3]* · d) your own
>
> **6. Profile.** a) Quality (best result, takes longer) · b) ★ Balanced · c) Economy (fast and light) · d) your own
>
> **Defaults** (reply "ok", or change any line):
> - Engine: GPU pipeline in the browser (three.js), rendered frame by frame; code only, no paid models
> - Hook: the subject acts from frame 1 and the camera moves with it (a camera move alone is not a hook); checked by measurement
> - Subtitles: none unless you ask (at most 2 languages, stacked, in a safe area)
> - On-screen text: allowed where the format wants it (6 words per card at most)
> - Faces: allowed when the story needs them; for close-ups I suggest stylised faces or silhouettes
> - Deliverable: one master in your format + a poster frame; notes in one batch per round
> - Working method: this chat stays short; I do the work I hold the context for, and a fresh helper takes the parts that run beside it (sound, narration takes, research, the independent viewer); at each checkpoint I may suggest a new chat with one line: "Continue from STATE.md"

## Message (Türkçe)

> Filmini yapalım. Altı kısa soru; bir seçenek seç, birleştir ya da kendi cümlelerinle yanıtla.
>
> **1. Fikrin.** Film ne anlatsın, bir iki cümleyle? (Fikrin yoksa "sen öner" yaz, üç fikir getireyim.)
> *[Fikir zaten biliniyorsa: o fikrin 2-3 yorumu, biri ★, artı "kendi cevabın".]*
>
> **2. Süre ve format** (★ bu fikrin istediği süre, gerekçesiyle). a) 15 sn dikey 9:16 (Reels/Shorts/TikTok) · b) 30 sn dikey 9:16 · c) 60 sn dikey ya da 16:9 · d) 1–3 dk 16:9 (YouTube) · e) 3–8 dk, perdelerle kurulur · f) kare 1:1 · g) kendi cevabın
> - Biçim, film neden yapılmış olsun (ayrı bir soru olarak): a) ★ *[fikre uyan biçim, neden]* · b) 3B gerçekçi (gerçek ışık ve malzeme, canlı çekim gibi; kurması en uzun süren, birkaç dünya varsa daha da) · c) 2B animasyon (cel, rubber hose, anime) · d) el yapımı (boya, mürekkep, kesik kâğıt, kil ya da maket) · e) hareketli grafik · f) kendi cevabın
>
> **3. Stil** (yön panosu görseliyle, `review/directions.jpg`, bu film için kurulmuş üç yön): A) *[ad: görünüm ve hikâyeye neden hizmet ettiği, tek satır]* · B) *[…]* · C) *[…]*: ★ *[uyan, gerekçesiyle]* · önce her yönden bir deneme karesi göster (filmin kendi konusu, o yönde) · referanslarımdan (görselleri `refs/` klasörüne bırak) · kendi cevabın
>
> **4. Ton ve referanslar.** Üç duygu kelimesi ve sevdiğin örnekler (`refs/` içine görsel, `refs/links.txt` içine link ya da film adı + dakika). a) ★ *[fikre uyan üç kelime]* · b) *[başka bir set]* · c) *[zıt bir set]* · d) kendi cevabın: Açık kaynaklardan referans da arayayım mı? ★ evet, yol haritasıyla tek pano · sadece benimkiler · atla
>
> **5. Ses.**
> - Anlatıcı (★ amaç dosyasına göre, gerekçesiyle): a) yok (görüntü ve ses anlatsın) · b) dış ses (sıcak, kuru mizah, oyunbaz, birinci ağızdan, masalcı…) · c) diyalog · d) kendi cevabın
> - Müzik, her zaman ayrı bir soru: a) ★ açık lisanslı gerçek bir kayıt (2–3 aday dinletilir, kulağınla seçersin; uzun bir filmde her perdeye ayrı bir parça olabilir) · b) kendi şarkım ya da parçam (dosyayı, sözlüyse satır zamanlarını gönder) · c) bu film için kodla yazılmış (kod müzikleri az sayıda sesle çalışır ve filmden filme benzer duyulur) · d) müzik yok, yalnız ses tasarımı
> - Ses kimliği, her biri tek satır: a) ★ *[konsept 1]* · b) *[konsept 2]* · c) *[konsept 3]* · d) kendi cevabın
>
> **6. Profil.** a) Kalite (en iyi sonuç, daha uzun sürer) · b) ★ Dengeli · c) Ekonomik (hızlı ve hafif) · d) kendi cevabın
>
> **Varsayılanlar** ("tamam" yaz ya da istediğin satırı değiştir):
> - Motor: tarayıcıda GPU (three.js), kare kare render; yalnızca kod, ücretli model yok
> - Kanca: konu ilk kareden bir şey yapar, kamera onunla hareket eder (tek başına kamera hareketi kanca değildir); ölçülerek kontrol edilir
> - Altyazı: istemezsen yok (en fazla 2 dil, alt alta, güvenli alanda)
> - Ekran yazısı: formatın gerektirdiği yerde serbest (kart başına en fazla 6 kelime)
> - Yüzler: hikâye isterse serbest; yakın planda stilize yüz ya da siluet öneririm
> - Teslim: formatında bir master + poster karesi; notlar her turda tek seferde
> - Çalışma yöntemi: bu sohbet kısa kalır; bağlamı elimde olan işi ben yaparım, yanında yürüyebilen parçaları (ses, dış ses denemeleri, araştırma, bağımsız izleyici) brif alan yeni bir yardımcı alır; kontrol noktalarında tek satırla yeni sohbet önerebilirim: "STATE.md'den devam et"

## Answers

| # | Topic | Answer | Source (user / accepted ★ / default) |
|---|---|---|---|
| 1 | Idea (and the chosen interpretation) | | |
| 2 | Length · format · fps · medium | | |
| 3 | Style (the direction picked on the board) | | |
| 4 | Tone words · references | | |
| 5 | Voice · music · sound identity | | |
| 6 | Profile | | |
| — | Defaults (accepted / changed lines) | | |

## User references

| File, link or film + timestamps | What they like in it | Used for (look / sound / story) |
|---|---|---|

## Machine check (by the agent)

| Item | Result |
|---|---|
| Node ≥ 22 | |
| Python 3 | |
| ffmpeg / ffprobe | |
| Chrome / Chromium | |
| GPU in headless Chrome (`capture.mjs --probe`) | |
| Free disk (`df -h .`; Windows: `Get-PSDrive`) | |

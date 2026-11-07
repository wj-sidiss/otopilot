#!/usr/bin/env python3
"""Temp and final narration from the script, with Gemini TTS (default) or ElevenLabs (optional).
Python 3 standard library + ffmpeg. The key is entered once for every film (tools/keys.py set GEMINI_API_KEY) and
never printed; the environment or a film's own .env can override it.

  tts.py --lines audio/vo-lines.json --out audio/vo                           # Gemini, default voice and style
  tts.py --lines audio/vo-lines.json --out audio/vo --style "<the delivery, from the sound identity>"
  tts.py --lines audio/vo-lines.json --out audio/vo --voice <voice> --style "<the delivery>"
  tts.py --engine elevenlabs --voice <voice_id> --lines audio/vo-lines.json --out audio/vo --style "<the delivery>"
  tts.py --text "<one line of the script>" --id VO1 --out audio/vo --dry-run   # show the request, send nothing
  tts.py --audition "gemini:<voice>,gemini:<voice>,elevenlabs:<voice_id>" --text "<one line of the script>" \
         --style "<the delivery>" --out review/voices      # one short file per candidate voice, never joined

vo-lines.json (the writer exports it from SCRIPT.md; the style follows the film's sound identity):
  {"lines": [{"id": "VO1", "text": "<line>", "style": "<its delivery>"},
             {"id": "VO2", "text": "<line>", "style": "<its delivery>"}]}
A line's own "style" overrides --style. Output: <out>/<id>.wav (48 kHz mono, 24-bit) + <out>/tts-log.json.
The raw lines are never the film's voice: voice_treat.py gives them the film's own treatment next (sound.md §4b).
A chorus is one run per voice. No style is the default: it follows the film's voice treatment.

Engines
  gemini      GEMINI_API_KEY · model gemini-3.8-flash-tts (or gemini-3.8-flash-lite-tts) · named voices (e.g. Kore,
              Puck, Charon) · delivery in plain words through speech_metadata.style ("warm and curious", "deadpan")
  elevenlabs  ELEVENLABS_API_KEY · --voice <voice_id> from your voice library · model eleven_v3 (70+ languages,
              audio tags such as [excited], [laughs], [whispers]) or eleven_multilingual_v2 (steady multilingual
              narration, no tags)
  ema         EMA Lightning (Canberk Aslan, Apache 2.0): free and offline Turkish, no key; one voice, no style, --speed.
              Only for a user who chose to install it (about 800 MB): tts.py --install ema. Turkish only.
"""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import keys  # noqa: E402  (same folder: the key store shared by every film)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
ELEVEN_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """A request that carries a key is never followed to another address (the key would travel with it)."""
    def redirect_request(self, *args, **kwargs):
        return None


def post(url, body, headers, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=timeout) as r:
            return r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:800]
        for value in headers.values():                   # a service that echoes the key never gets it printed
            if value and len(str(value)) >= 8 and "/" not in str(value):
                detail = detail.replace(str(value), "<key>")
        raise RuntimeError(f"HTTP {e.code}: {detail}") from None


def post_patiently(url, body, headers, wait=time.sleep):
    """A per-minute limit (HTTP 429 with a retry delay) waits and tries again, up to three times; a daily quota raises
    QuotaSpent at once, so the run stops with what is left instead of failing line after line."""
    for attempt in range(4):
        try:
            return post(url, body, headers)
        except RuntimeError as e:
            text = str(e)
            if not text.startswith("HTTP 429"):
                raise
            if re.search(r"per[ _]?day|daily", text, re.I) or attempt == 3:
                raise QuotaSpent(text) from None
            delay = re.search(r'"retryDelay":\s*"(\d+)', text)
            wait(min(65, int(delay[1]) + 2) if delay else 25)


class QuotaSpent(RuntimeError):
    pass


def gemini_request(text, style, voice, model):
    content = {"type": "text", "text": text}
    if style:
        content["annotations"] = [{"type": "speech_metadata", "style": style}]
    return {"model": model, "input": [{"type": "user_input", "content": [content]}],
            "response_format": {"type": "audio"},
            "generation_config": {"speech_config": [{"voice": voice}]}}


def gemini_audio(resp):
    data = json.loads(resp)
    blocks = [c for st in data.get("steps", []) if st.get("type") == "model_output"
              for c in st.get("content", []) if c.get("type") == "audio"]
    if not blocks:
        raise RuntimeError("no audio in the Gemini response")
    return base64.b64decode(blocks[-1]["data"])


ELEVEN_TAGS = {"whisper": "whispers", "fısılt": "whispers", "excit": "excited", "energ": "excited", "curious": "curious",
               "sad": "sad", "calm": "calm", "warm": "warmly", "sarcas": "sarcastic", "deadpan": "deadpan", "laugh": "laughs",
               "shout": "shouting", "playful": "playfully", "tired": "tired", "mysteri": "mysteriously"}


def eleven_request(text, style, model, seed, stability):
    if style and not text.lstrip().startswith("["):
        tags = sorted({t for k, t in ELEVEN_TAGS.items() if k in style.lower()})
        if model in ("eleven_v3", "eleven_v4") and tags:
            text = "".join(f"[{t}] " for t in tags[:2]) + text   # audio tags: delivery direction, not spoken
        else:
            print(f"   note: ElevenLabs {model} takes no free-text style; '{style[:40]}' is not applied"
                  + ("" if model in ("eleven_v3", "eleven_v4") else " (eleven_v3 understands tags such as [calm], [excited])"))
    body = {"text": text, "model_id": model,
            "voice_settings": {"stability": stability, "similarity_boost": 0.75, "style": 0.0, "speed": 1.0}}
    if seed is not None:
        body["seed"] = seed
    return body


def to_wav(data, dst):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", "pipe:0", "-ac", "1", "-ar", "48000",
                        "-c:a", "pcm_s24le", dst], input=data, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError("ffmpeg could not decode the audio: " + p.stderr.decode()[-200:])
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst],
                       stdout=subprocess.PIPE, text=True).stdout.strip()
    return float(d or 0)


EMA_PY = os.environ.get("CINECODE_EMA_PYTHON") or os.path.expanduser(
    "~/.cinecode/tts-ema/Scripts/python.exe" if os.name == "nt" else "~/.cinecode/tts-ema/bin/python")
EMA_RUN = """import json, sys
from ema_lightning import EMA
job = json.load(sys.stdin)
tts = EMA()
for text, dst in job["items"]:
    tts.say(text, path=dst, seed=job["seed"], speed=job["speed"])
"""


def ema_missing():
    return None if os.path.exists(EMA_PY) else (
        "EMA Lightning (free, offline Turkish voice) is not installed: about 800 MB (PyTorch and a 34 MB model), only "
        "if the user wants it: python3 tools/tts.py --install ema; otherwise Gemini or the OS voice")


def ema_takes(items, seed, speed):
    """[(text, dst)] in one run of the model (it loads once); each take converted to 48 kHz 24-bit like the others."""
    raw = [(text, dst + ".ema.wav") for text, dst in items]
    p = subprocess.run([EMA_PY, "-c", EMA_RUN], input=json.dumps({"items": raw, "seed": seed, "speed": speed}),
                       text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        raise RuntimeError("EMA Lightning failed: " + p.stderr.strip()[-300:])
    out = []
    for (_, src), (_, dst) in zip(raw, items):
        with open(src, "rb") as f:
            out.append(to_wav(f.read(), dst))
        os.remove(src)
    return out


def install_ema():
    """A virtual environment of its own in ~/.cinecode/tts-ema: PyTorch needs Python 3.10 or newer, macOS ships 3.9."""
    import shutil
    py = next((p for p in (shutil.which(f"python3.{v}") for v in range(14, 9, -1)) if p), None)
    if not py and sys.version_info >= (3, 10):
        py = sys.executable
    if not py:
        sys.exit("EMA Lightning needs Python 3.10 or newer: brew install python (macOS), then run this again")
    venv = os.path.dirname(os.path.dirname(EMA_PY))
    subprocess.run([py, "-m", "venv", venv], check=True)
    subprocess.run([EMA_PY, "-m", "pip", "install", "-q", "--disable-pip-version-check", "ema-lightning"], check=True)
    print(f"EMA Lightning installed in {venv} (remove that folder to uninstall); the model (34 MB) comes on first use")
    return 0


def synth(engine, model, voice, text, style, a, dst):
    """One take to dst (48 kHz WAV); returns its length in seconds."""
    if engine == "ema":
        if ema_missing():
            raise RuntimeError(ema_missing())
        return ema_takes([(text, dst)], a.seed, a.speed)[0]
    if engine == "gemini":
        key = keys.get("GEMINI_API_KEY")
        body, url = gemini_request(text, style, voice, model), GEMINI_URL
        headers = {"x-goog-api-key": key or "", "Content-Type": "application/json"}
    else:
        key = keys.get("ELEVENLABS_API_KEY")
        body, url = eleven_request(text, style, model, a.seed, a.stability), ELEVEN_URL.format(voice=voice)
        headers = {"xi-api-key": key or "", "Content-Type": "application/json"}
    if not key:
        raise RuntimeError(f"{'GEMINI' if engine == 'gemini' else 'ELEVENLABS'}_API_KEY is not set (tools/keys.py open)")
    raw, _ = post_patiently(url, body, headers)
    return to_wav(gemini_audio(raw) if engine == "gemini" else raw, dst)


def auditioned(root="."):
    """An audition was made in this project (tts.py --audition leaves AUDITION.json beside its takes)."""
    for top, dirs, files in os.walk(root):
        if "AUDITION.json" in files:
            return True
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("tools", "renders", "frames", "node_modules")]
        if top.count(os.sep) - root.count(os.sep) >= 3:
            dirs[:] = []
    return False


def audition(a):
    if not a.text:
        sys.exit("--audition needs --text: one line of the script (about 8-15 words), the same for every voice")
    os.makedirs(a.out, exist_ok=True)
    made, cands = [], [c.strip() for c in a.audition.split(",") if c.strip()]
    for n, cand in enumerate(cands, 1):
        engine, _, voice = cand.partition(":")
        voice = voice or ("tr" if engine == "ema" else "")
        if engine not in ("gemini", "elevenlabs", "ema") or not voice:
            print(f"{n}. skipped '{cand}': write engine:voice (gemini:Kore, elevenlabs:<voice_id>, ema)")
            continue
        model = "ema-lightning" if engine == "ema" else a.model if a.model and (a.model.startswith("gemini") == (engine == "gemini")) else \
            ("gemini-3.8-flash-tts" if engine == "gemini" else "eleven_v3")
        name = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in voice)[:24]
        dst = os.path.join(a.out, f"{n}-{engine}-{name}.wav")
        if a.dry_run:
            print(f"{n}. {engine} {model} {voice} -> {dst}")
            continue
        try:
            dur = synth(engine, model, voice, a.text, a.style, a, dst)
            made.append(dst)
            print(f"{n}. {dst}  {dur:.1f} s  ({engine} · {voice})")
        except Exception as e:
            print(f"{n}. {engine} · {voice}: failed ({str(e)[:140]})")
    if a.dry_run:
        return 0
    if made:
        with open(os.path.join(a.out, "AUDITION.json"), "w", encoding="utf-8") as f:
            json.dump({"text": a.text, "takes": made}, f, ensure_ascii=False, indent=1)
        print(f"{len(made)} separate takes of the same line; play each on its own and let the user pick (no joined file)"
              + (f"; {len(cands) - len(made)} failed or skipped" if len(made) < len(cands) else ""))
        return 0
    print("no take was made: nothing to play (see the lines above)")
    return 1


def ema_lines(a, lines):
    """The whole narration with EMA Lightning in one run. One voice, no style: the film's treatment shapes it."""
    if a.dry_run:
        for ln in lines:
            print(f"{ln['id']}: ema-lightning (offline) seed={a.seed} speed={a.speed}: {ln['text'][:80]}")
        return 0
    if ema_missing():
        sys.exit(ema_missing())
    os.makedirs(a.out, exist_ok=True)
    items = [(ln["text"], os.path.join(a.out, f".{ln['id']}.new.wav")) for ln in lines]
    durs = ema_takes(items, a.seed, a.speed)
    log_path, log = os.path.join(a.out, "tts-log.json"), []
    if os.path.exists(log_path):
        with open(log_path, encoding="utf-8") as source:
            log = json.load(source)
    for ln, (_, tmp), dur in zip(lines, items, durs):
        dst = os.path.join(a.out, f"{ln['id']}.wav")
        os.replace(tmp, dst)
        log.append({"id": ln["id"], "engine": "ema", "model": "ema-lightning", "voice": "tr", "style": "",
                    "chars": len(ln["text"]), "seconds": round(dur, 2), "file": dst})
        print(f"{ln['id']}: {dst}  {dur:.2f} s  ({len(ln['text'])} chars)")
    with open(log_path, "w", encoding="utf-8") as destination:
        json.dump(log, destination, indent=1, ensure_ascii=False)
    print(f"total {sum(durs):.1f} s of narration · log {log_path} · EMA Lightning has one voice and no style: "
          f"voice_treat.py gives it the film's own voice next")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", choices=["gemini", "elevenlabs", "ema"], default=os.environ.get("TTS_ENGINE", "gemini"))
    ap.add_argument("--install", choices=["ema"], help="ema: install EMA Lightning (about 800 MB, once; ask the user first)")
    ap.add_argument("--speed", type=float, default=1.0, help="ema: 0.25 to 4")
    ap.add_argument("--lines", help="vo-lines.json")
    ap.add_argument("--text", help="one line instead of --lines")
    ap.add_argument("--id", default="VO1")
    ap.add_argument("--out", help="the folder for the takes (needed for everything but --install)")
    ap.add_argument("--voice", help="gemini: voice name (default Charon); elevenlabs: voice_id (required)")
    ap.add_argument("--model", help="gemini-3.8-flash-tts | gemini-3.8-flash-lite-tts | eleven_v3 | eleven_multilingual_v2")
    ap.add_argument("--style", default="", help='delivery from the sound identity (default: none)')
    ap.add_argument("--seed", type=int, default=7, help="elevenlabs: best-effort repeatable takes")
    ap.add_argument("--stability", type=float, default=0.45, help="elevenlabs: lower = more expressive")
    ap.add_argument("--only", help="comma list of line ids to (re)generate")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--voice-chosen", action="store_true", help="the user already picked this voice (no audition)")
    ap.add_argument("--audition", help='candidate voices for the user to choose by ear, "engine:voice,..."; with --text '
                                       '(one line of the script): one short file per candidate in --out, never joined')
    a = ap.parse_args()
    if a.install:
        return install_ema()
    if not a.out:
        ap.error("the following arguments are required: --out")
    if a.audition:
        return audition(a)

    if a.lines:
        with open(a.lines, encoding="utf-8") as source:
            lines = json.load(source)["lines"]
        if len(lines) > 3 and not a.voice_chosen and not a.dry_run and not auditioned():
            sys.exit("tts: the whole narration waits for the voice the user picked by ear: first --audition (2-3 voices "
                     "reading one line, KIT/references/sound.md §4b step 0), the user listens and picks; or "
                     "--voice-chosen when the user already named this voice")
    elif a.text:
        lines = [{"id": a.id, "text": a.text}]
    else:
        sys.exit("give --lines or --text")
    if a.only:
        keep = set(a.only.split(","))
        lines = [l for l in lines if l["id"] in keep]

    if a.engine == "ema":
        return ema_lines(a, lines)
    if a.engine == "gemini":
        key_name, model, voice = "GEMINI_API_KEY", a.model or "gemini-3.8-flash-tts", a.voice or "Charon"
    else:
        key_name, model, voice = "ELEVENLABS_API_KEY", a.model or "eleven_v3", a.voice
        if not voice and not a.dry_run:
            sys.exit("elevenlabs needs --voice <voice_id> (from your ElevenLabs voice library)")
    key = keys.get(key_name)
    if not key and not a.dry_run:
        sys.exit(f"{key_name} is not set yet. Enter it once for every film: python3 tools/keys.py set {key_name}")

    os.makedirs(a.out, exist_ok=True)
    log_path = os.path.join(a.out, "tts-log.json")
    log = []
    if os.path.exists(log_path):
        with open(log_path, encoding="utf-8") as source:
            log = json.load(source)
    total, failed, spent = 0.0, [], None
    for ln in lines:
        if spent:
            failed.append(ln["id"])
            continue
        style = ln.get("style", a.style)
        if a.engine == "gemini":
            body, url = gemini_request(ln["text"], style, voice, model), GEMINI_URL
            headers = {"x-goog-api-key": key or "", "Content-Type": "application/json"}
        else:
            body, url = eleven_request(ln["text"], style, model, a.seed, a.stability), ELEVEN_URL.format(voice=voice or "<voice_id>")
            headers = {"xi-api-key": key or "", "Content-Type": "application/json"}
        if a.dry_run:
            print(f"{ln['id']}: {a.engine} {model} voice={voice} POST {url.split('?')[0]}")
            print("   " + json.dumps(body, ensure_ascii=False)[:240])
            continue
        dst = os.path.join(a.out, f"{ln['id']}.wav")
        tmp = os.path.join(a.out, f".{ln['id']}.new.wav")
        try:
            raw, _ = post_patiently(url, body, headers)
            audio = gemini_audio(raw) if a.engine == "gemini" else raw
            dur = to_wav(audio, tmp)
            os.replace(tmp, dst)                       # a new take replaces the old one only when it is complete
        except QuotaSpent:
            spent = ln["id"]
            failed.append(ln["id"])
            continue
        except Exception as e:
            print(f"{ln['id']}: failed ({str(e)[:160]})" + (" · the previous take is kept" if os.path.exists(dst) else ""))
            failed.append(ln["id"])
            if os.path.exists(tmp):
                os.remove(tmp)
            continue
        total += dur
        log.append({"id": ln["id"], "engine": a.engine, "model": model, "voice": voice, "style": style,
                    "chars": len(ln["text"]), "seconds": round(dur, 2), "file": dst})
        print(f"{ln['id']}: {dst}  {dur:.2f} s  ({len(ln['text'])} chars)")
    if not a.dry_run:
        with open(log_path, "w", encoding="utf-8") as destination:
            json.dump(log, destination, indent=1, ensure_ascii=False)
        print(f"total {total:.1f} s of narration · log {log_path} · next: voice_treat.py (the film's own voice)")
        if spent:
            sys.exit(f"QUOTA SPENT at {spent}: the {a.engine} key's daily quota is used up; {len(failed)} line(s) wait: "
                     f"{', '.join(failed)}. Tell the user and offer: rerun tomorrow with --only {','.join(failed)} · fewer, "
                     f"longer lines (one per beat group) · EMA Lightning, free and offline for Turkish (--engine ema) · "
                     f"billing on the key. Meanwhile the OS voice stands in, said so")
        if failed:
            sys.exit(f"{len(failed)} line(s) failed: {', '.join(failed)} (fix and rerun with --only {','.join(failed)})")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())

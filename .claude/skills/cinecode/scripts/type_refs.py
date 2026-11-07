#!/usr/bin/env python3
"""Typography references from the real world, for the film's type board (Python 3 stdlib; ffmpeg for the sheet).

  python3 tools/type_refs.py --q "format:film-video" --sources fontsinuse --n 8 --out research/type-refs
  python3 tools/type_refs.py --q "title:tar|thriller" --sources artofthetitle --out research/type-titles
  python3 tools/type_refs.py --q "Fraunces" --sources typewolf --out research/type-fraunces
  python3 tools/type_refs.py --q "editorial typography" --sources arena --out research/type-arena
  (asset_search.py search --type typography --q … calls the same code)

Sources (mood references only: a link and a small thumbnail per record; never downloaded in full, never in the film):
  fontsinuse      Fonts In Use: real uses by format, topic and typeface. robots.txt asks for a 10 s crawl delay and
                  rules out /search, so this never searches: q = "format:<slug>" (film-video, advertising,
                  posters-flyers, branding-identity, packaging, social-media, signs, web, …), "topic:<slug>"
                  (film-and-television, music, food-beverage, technology, fashion-apparel, sports, …) or a
                  fontsinuse.com URL of a typeface or use page; plain words only filter the chosen listing.
  artofthetitle   Art of the Title: film and TV title sequences (the cinematic purpose). q = words matched against the
                  titles list, or "title:<slug>" for one sequence page.
  typewolf        Typewolf: a typeface's page (specimen, suggested pairing, sites using it). q = a family name, or
                  "sotd" for the latest Site of the Day picks.
  arena           Are.na public API (Content-Signal: use=reference): typography channels found by q, or
                  "channel:<slug>"; image blocks only.
  posters         Typographic Posters: link only (its pages render in the browser); opens a starting URL.
  The user's own: refs/type/ (screenshots, including posts saved in an Instagram collection; no automated
  Instagram access); type_extract.py and the board read that folder directly.

Politeness: a descriptive User-Agent, robots.txt read per host (plus the crawl delays and exclusions above), at least
1 s between requests to a host, 429/503 back-off, and a cache (research/.cache/type-refs) so nothing is fetched twice.
Writes <out>/results.json (numbered records, use: "mood-only"), <out>/thumbs/ and <out>/sheet.jpg.
"""
import argparse
import hashlib
import html
import json
import os
import re
import sys
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

UA = "cinecode-type-refs/1.0 (film typography reference research; low volume; respects robots.txt)"
CACHE = os.path.join("research", ".cache", "type-refs")
HOST_DELAY = {"fontsinuse.com": 10.0}                         # robots.txt Crawl-delay
NEVER = {"fontsinuse.com": ("/search",)}                      # robots.txt intent (its line lacks the colon)
_last, _robots = {}, {}


def _host(url):
    return urllib.parse.urlsplit(url).netloc.replace("www.", "")


def _robots_ok(url):
    p = urllib.parse.urlsplit(url)
    if any(p.path.startswith(x) for x in NEVER.get(_host(url), ())):
        return False
    base = f"{p.scheme}://{p.netloc}"
    if base not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            txt = _raw(base + "/robots.txt").decode("utf-8", "replace")
            rp.parse([] if "<html" in txt[:500].lower() else txt.splitlines())
        except Exception:
            rp.parse([])
        _robots[base] = rp
    return _robots[base].can_fetch(UA, url)


def _raw(url):
    host = _host(url)
    rp = _robots.get(f"{urllib.parse.urlsplit(url).scheme}://{urllib.parse.urlsplit(url).netloc}")
    gap = max(1.0, HOST_DELAY.get(host, 0), (rp.crawl_delay(UA) or 0) if rp else 0)
    wait = _last.get(host, 0) + gap - time.time()
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    for attempt in range(3):
        _last[host] = time.time()
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 2:
                time.sleep(min(30, float(e.headers.get("Retry-After") or 5 * (attempt + 1))))
                continue
            raise


def get(url, as_json=False, cache=None):
    cache = CACHE if cache is None else cache
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(cache, key[:2], key) if cache else None
    if path and os.path.exists(path):
        data = open(path, "rb").read()
    else:
        if not _robots_ok(url):
            raise RuntimeError(f"robots.txt rules out {url[:70]}")
        data = _raw(url)
        if path and len(data) < 3_000_000:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, "wb").write(data)
    return json.loads(data) if as_json else data.decode("utf-8", "replace")


def clean(s, n=90):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(s or "")))).strip()[:n]


def rec(source, sid, title, creator, date, page, thumb, **extra):
    r = {"source": source, "id": str(sid), "title": clean(title), "creator": clean(creator, 60) or "unknown",
         "date": clean(date, 20), "licence": "mood-only", "use": "mood-only", "page": page, "file": None,
         "thumb": thumb, "type": "typography"}
    r.update(extra)
    return r


def words_match(text, q):
    ws = [w for w in re.findall(r"\w+", q.lower()) if len(w) > 2]
    return not ws or any(w in text.lower() for w in ws)


# ---------------------------------------------------------------- Fonts In Use (category and typeface pages only)
FIU_FORMATS = {"advertising": 5, "album-art": 72, "art-illustration": 18, "booklets-pamphlets": 66, "books": 6,
               "branding-identity": 9, "ephemera": 73, "exhibition-installation": 69, "film-video": 15,
               "infographics-maps": 49, "magazines-periodicals": 11, "mobile-tablet": 16, "newspapers": 10,
               "object-product": 8, "packaging": 4, "posters-flyers": 12, "signs": 7, "social-media": 59,
               "software-apps": 17, "web": 3}
FIU_TOPICS = {"product": 19, "services": 20, "entertainment": 21, "institutional": 22, "event": 23, "fashion-apparel": 24,
              "news": 26, "graphic-design": 27, "home-interior": 28, "food-beverage": 30, "literature": 31,
              "technology": 32, "kids": 33, "science-nature": 34, "retail-shopping": 35, "automotive": 36,
              "architecture": 37, "travel": 38, "lifestyle": 39, "education-academia": 40, "activism": 41, "sports": 42,
              "music": 43, "health-fitness": 44, "art": 50, "religion-spirituality": 51, "business-and-finance": 53,
              "politics": 54, "local": 55, "governmental-civic": 56, "transportation": 67, "performing-arts": 68,
              "film-and-television": 70, "industrial-design": 71}


def src_fontsinuse(q, n):
    base = "https://fontsinuse.com"
    m = re.match(r"(format|topic):([\w-]+)\s*(.*)", q.strip())
    if q.startswith("http"):
        url, rest = q.split()[0], " ".join(q.split()[1:])
    elif m and m.group(1) == "format" and m.group(2) in FIU_FORMATS:
        url, rest = f"{base}/in/2/formats/{FIU_FORMATS[m.group(2)]}/{m.group(2)}", m.group(3)
    elif m and m.group(1) == "topic" and m.group(2) in FIU_TOPICS:
        url, rest = f"{base}/in/1/topics/{FIU_TOPICS[m.group(2)]}/{m.group(2)}", m.group(3)
    else:
        raise RuntimeError('q needs "format:<slug>", "topic:<slug>" or a fontsinuse.com URL (no search: robots.txt)')
    page = get(url)
    out = []
    for item in re.split(r'<div class="fiu-galleryItem"', page)[1:]:
        a = re.search(r'href="(/uses/(\d+)/[^"]+)"', item)
        if not a:
            continue
        title = re.search(r'fiu-galleryItem__headline">(.*?)</span>', item, re.S)
        date = re.search(r'fiu-galleryItem__date">(.*?)</span>', item, re.S)
        des = re.findall(r'<ul class="fiu-galleryItem__designers">(.*?)</ul>', item, re.S)
        img = re.search(r'<img[^>]+src="(https://assets\.fontsinuse\.com[^"]+)"', item) or re.search(r'srcset="(https://assets\.fontsinuse\.com[^" ]+)', item)
        t = clean(title.group(1) if title else "")
        if rest and not words_match(t + " " + clean(des[0] if des else ""), rest):
            continue
        out.append(rec("fontsinuse", a.group(2), t, clean(des[0]) if des else "", clean(date.group(1)) if date else "",
                       base + a.group(1), img.group(1) if img else None, listing=url))
        if len(out) >= n:
            break
    return out


# ---------------------------------------------------------------- Art of the Title
def src_artofthetitle(q, n):
    base = "https://www.artofthetitle.com"
    if q.startswith("title:"):
        slug = q[6:].strip().strip("/")
        page = get(f"{base}/title/{slug}/")
        og = re.search(r'<meta property="og:image" content="([^"]+)"', page)
        ttl = re.search(r"<title>(.*?)</title>", page, re.S)
        desc = re.search(r'<meta name="description" content="([^"]*)"', page)
        return [rec("artofthetitle", slug, clean(ttl.group(1) if ttl else slug), "", "", f"{base}/title/{slug}/",
                    og.group(1) if og else None, note=clean(desc.group(1), 200) if desc else "")]
    page = get(f"{base}/titles/")
    hits = []
    for slug, img, alt in re.findall(r'<a href="/title/([^"/]+)/" class="thumb">\s*<img[^>]+data-original="([^"]+)"[^>]*alt="([^"]*)"', page):
        exact = re.search(rf"(^|\W){re.escape(q.strip().lower())}(\W|$)", alt.lower())
        if exact or words_match(alt, q):
            hits.append((0 if exact else 1, rec("artofthetitle", slug, alt, "", "", f"{base}/title/{slug}/", img)))
    if not hits:
        print(f"artofthetitle: no title matches '{q}'; it is searched by film or show name (Se7en, Mad Men), "
              "not by genre", file=sys.stderr)
    return [r for _, r in sorted(hits, key=lambda h: h[0])][:n]


# ---------------------------------------------------------------- Typewolf
def src_typewolf(q, n):
    base = "https://www.typewolf.com"
    if q.strip().lower() == "sotd":
        page = get(f"{base}/site-of-the-day")
        out = []
        for slug, name in re.findall(r'<a href="/site-of-the-day/([^"]+)">([^<]+)</a>', page):
            if len(out) >= n:
                break
            out.append(rec("typewolf", slug, name, "", "", f"{base}/site-of-the-day/{slug}", None))
        return out
    slug = re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-")
    page = get(f"{base}/{slug}")
    text = clean(page, 100000)
    pair = re.search(r"Suggested Font Pairing (.{0,80}?) (?:\1 )?Font Pairings", text) or re.search(r"Suggested Font Pairing (\S+ \+ \S+(?: \S+)?)", text)
    imgs = re.findall(r'<img[^>]+src="(/assets/img/(?:specimens|sotd)/[^"]+)"', page)
    sites = re.findall(r'href="/site-of-the-day/([^"]+)"', page)
    out = [rec("typewolf", slug, f"{q} specimen", "Typewolf", "", f"{base}/{slug}", base + imgs[0] if imgs else None,
               pairing=clean(pair.group(1), 80) if pair else "")]
    for s, img in zip(sites, [i for i in imgs if "/sotd/" in i]):
        if len(out) >= n:
            break
        out.append(rec("typewolf", s, f"{q} in use: {s}", "", "", f"{base}/site-of-the-day/{s}", base + img))
    return out


# ---------------------------------------------------------------- Are.na (public API)
def src_arena(q, n):
    api = "https://api.are.na/v2"
    if q.startswith("channel:"):
        slugs = [q[8:].strip()]
    else:
        found = get(f"{api}/search/channels?" + urllib.parse.urlencode({"q": q if "typ" in q.lower() else q + " typography", "per": 6}), True)
        slugs = [c["slug"] for c in sorted(found.get("channels", []), key=lambda c: -c.get("length", 0))[:2]]
    out = []
    for s in slugs:
        data = get(f"{api}/channels/{s}/contents?" + urllib.parse.urlencode({"per": max(n * 2, 12), "direction": "desc"}), True)
        for b in data.get("contents", []):
            img = (b.get("image") or {}).get("thumb", {}).get("url") or (b.get("image") or {}).get("square", {}).get("url")
            if b.get("class") != "Image" and not img:
                continue
            src = (b.get("source") or {}).get("url")
            out.append(rec("arena", b["id"], b.get("title") or b.get("generated_title") or "", (b.get("user") or {}).get("full_name", ""),
                           (b.get("created_at") or "")[:10], f"https://www.are.na/block/{b['id']}", img, channel=s, origin=src))
            if len(out) >= n * len(slugs):
                break
    return out[:n]


def src_posters(q, n):
    return [rec("posters", "start", f"Typographic Posters: browse for '{q}'", "", "", "https://www.typographicposters.com/", None,
                note="link only: pages render in the browser; the user screenshots picks into refs/type/")]


SOURCES = {"fontsinuse": src_fontsinuse, "artofthetitle": src_artofthetitle, "typewolf": src_typewolf, "arena": src_arena,
           "posters": src_posters}
DEFAULT = {"cinematic": "artofthetitle,fontsinuse,arena", "ad": "fontsinuse,typewolf,arena"}


def sheet(results, out, cell=220, cols=4):
    os.makedirs(os.path.join(out, "thumbs"), exist_ok=True)
    files, shown = [], []
    for r in results:
        if not r.get("thumb"):
            continue
        p = os.path.join(out, "thumbs", f"{r['n']:02d}.img")
        try:
            open(p, "wb").write(_thumb(r["thumb"]))   # this result's own (cached) thumb: a reused number never shows an old image
            files.append(p); shown.append(r["n"]); r["sheet_cell"] = len(files)
        except Exception:
            pass
    if not files:
        return None
    cols = min(cols, len(files))
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for p in files:
        cmd += ["-i", p]
    f = "".join(f"[{i}]scale={cell}:{cell}:force_original_aspect_ratio=decrease,pad={cell}:{cell}:(ow-iw)/2:(oh-ih)/2,setsar=1[t{i}];" for i in range(len(files)))
    layout = "|".join(f"{(i % cols) * cell}_{(i // cols) * cell}" for i in range(len(files)))
    f += "".join(f"[t{i}]" for i in range(len(files))) + (f"xstack=inputs={len(files)}:layout={layout}:fill=black" if len(files) > 1 else "null")
    path = os.path.join(out, "sheet.jpg")
    try:
        subprocess.run(cmd + ["-filter_complex", f, "-frames:v", "1", "-q:v", "5", path], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return path
    except Exception:
        return None


def _thumb(url):
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(CACHE, key[:2], key) if CACHE else None
    if path and os.path.exists(path):
        return open(path, "rb").read()
    if not _robots_ok(url):
        raise RuntimeError("robots.txt rules out the thumbnail")
    data = _raw(url)
    if len(data) > 1_500_000:
        raise RuntimeError("not a thumbnail")
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "wb").write(data)
    return data


def search(q, n=6, sources=None, out="research/type-refs", purpose="cinematic"):
    results, notes, seen = [], [], set()
    for query in [x.strip() for x in q.split("|") if x.strip()]:
        for name in (sources or DEFAULT.get(purpose, DEFAULT["cinematic"])).split(","):
            name = name.strip()
            try:
                got = [r for r in SOURCES[name](query, n) if (r["source"], r["id"]) not in seen]
                seen |= {(r["source"], r["id"]) for r in got}
                results += got
                notes.append(f"{name}: {len(got)}")
            except Exception as e:
                notes.append(f"{name}: skipped ({str(e)[:70]})")
    for i, r in enumerate(results, 1):
        r["n"] = i
    os.makedirs(out, exist_ok=True)
    sh = sheet(results, out)
    json.dump({"query": q, "type": "typography", "role": "mood", "results": results},
              open(os.path.join(out, "results.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"type refs '{q}': {len(results)} · " + " · ".join(notes))
    for r in results:
        print(f"{r['n']:2d} [{r.get('sheet_cell', '-')}] {r['source']:13s} {r['title'][:52]}: {r['creator'][:24]}")
    print(f"files: {os.path.join(out, 'results.json')}" + (f", {sh} (look at this one image)" if sh else "") +
          " · mood-only: links and thumbnails for study, never placed in the film")
    return results


def main():
    global CACHE
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--q", required=True)
    ap.add_argument("--sources", help="comma list: " + ", ".join(SOURCES))
    ap.add_argument("--purpose", default="cinematic", choices=["cinematic", "ad"])
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cache", default=CACHE)
    a = ap.parse_args()
    CACHE = a.cache
    search(a.q, a.n, a.sources, a.out, a.purpose)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()

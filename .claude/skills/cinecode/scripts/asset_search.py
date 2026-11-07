#!/usr/bin/env python3
"""Search open collections, and Pixabay with the user's free key, then fetch picks with a LICENSES.csv row (Python 3
stdlib; ffmpeg optional).

  python3 tools/asset_search.py search --q "<a sound>" --type sound --out research/<sound>
  python3 tools/asset_search.py search --q "<what and where>" --type video --out research/<clip>   # stock footage
  python3 tools/asset_search.py search --q "<genre and players>" --type music --out research/music      # CC music
  python3 tools/asset_search.py search --q "<subject>" --sources met,cleveland --out research/<subject>
  python3 tools/asset_search.py search --q "<a sky or a room>" --type hdri --out research/hdri
  python3 tools/asset_search.py search --q "format:film-video" --type typography --out research/type-refs
  python3 tools/asset_search.py supply --q "<element>" --q "<element>"     # what the archives hold, nothing downloaded
  python3 tools/asset_search.py fetch --results research/<sound>/results.json --pick 2,5 --dest assets/sound
  python3 tools/asset_search.py board --dirs research/<element-a> research/<element-b> --per 3 --refs refs \
      --out research/board-v1     # Quick mode: one sheet for the whole gate

Sources (official APIs only, no browser; only Pixabay needs a key):
  pixabay     Pixabay: stock photos (--type image) and videos (--type video) under the Pixabay Content License
              (free for commercial use, no credit owed); needs the user's free key once: keys.py open PIXABAY_API_KEY.
              Real-world material only: a hit whose tags miss the query's words, or that is AI-generated, a cartoon or
              a 3D render, is dropped; videos come in the largest size up to 1920 px wide.
  wikimedia   Wikimedia Commons: images (--type image), sounds (--type sound) and videos (--type video); licence
              per file
  archive     Internet Archive: music (--type music: released tracks from its Jamendo and netlabel collections),
              recordings (--type sound) and films (--type video); public domain, CC0 and CC BY only
  aic         Art Institute of Chicago: public-domain artworks (CC0 images, up to 3000 px)
  cleveland   Cleveland Museum of Art Open Access: CC0 artworks and objects (images up to 3400 px)
  met         The Metropolitan Museum of Art Open Access: public-domain objects (CC0 images), opt-in
  rijks       Rijksmuseum: public-domain artworks, prints and photographs (images up to 3400 px); its search matches
              titles; opt-in
  openverse   Openverse (api.openverse.org): openly licensed images and audio gathered from many sites, filtered to
              CC0, PDM, CC BY, CC BY-SA; licence URL and attribution kept per item; check the item's source page.
              In the default sound and music searches: sounds (mostly Freesound), --type music = its music category
              (Jamendo tracks; CC BY-SA left out unless --licence names it, since share-alike music can carry its
              licence over to the whole film). Images opt-in. Its audio search can take 10-25 s, and it is often
              down: a search that it does not answer leaves it out of this film's searches for 30 minutes.
  polyhaven   Poly Haven: HDRIs and textures (--type hdri | texture), all CC0
  nasa        NASA Image and Video Library: images (NASA media guidelines: credit NASA, no endorsement)
  filmgrab    FilmGrab (film-grab.com, its WordPress REST API; robots.txt allows it): film stills, MOOD ONLY:
              small thumbnails for the boards (direction.py), never fetched into the film. --q is a film title
              (--n stills spread across that one film) or "cat:<name>" for a cinematographer, director or genre
              page (one still from each of --n films).
  --type typography: real-world typography references through type_refs.py (Fonts In Use by format/topic/typeface,
              Art of the Title, Typewolf, Are.na; Typographic Posters link only): mood-only links and thumbnails for
              the type reference board, never fetched into the film. KIT/references/typography.md §9.
Licences kept: cc0, pd, cc-by, cc-by-sa (default), nasa and pixabay; anything else (NC, ND, unknown) is dropped. FilmGrab
records are kept as "mood-only"; fetch refuses them.
--licence cc0,pd keeps only those.

search writes <out>/results.json (numbered records) and, when ffmpeg is present, <out>/sheet.jpg: one small
contact sheet of the thumbnails (look at it instead of single images: cheaper). It prints one line per result.
fetch downloads the picked numbers into --dest and appends a row per file to LICENSES.csv at once (no row, no use).
Music candidates: fetch --preview 30 first (the first 30 s of each, a few hundred KB, no row); the user listens and
picks; then fetch only that one in full.
board merges the first --per results of several searches (and the user's images in --refs) into one renumbered
<out>/results.json (fetch works on it) and one <out>/sheet.jpg. It prints one line per reference and a measured palette (hex).
Polite: a clear User-Agent, a pause between requests, results cached in research/.cache/.
"""
import argparse
import concurrent.futures
import csv
import datetime
import hashlib
import html
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "cinecode-asset-search/1.0 (open-licence film research; low volume)"
CACHE = os.path.join("research", ".cache")
OPEN = {"cc0", "pd", "cc-by", "cc-by-sa", "nasa", "pixabay"}
LIC_URL = {"cc0": "https://creativecommons.org/publicdomain/zero/1.0/",
           "pd": "https://creativecommons.org/publicdomain/mark/1.0/",
           "cc-by": "https://creativecommons.org/licenses/by/4.0/",
           "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/",
           "nasa": "https://www.nasa.gov/nasa-brand-center/images-and-media/",
           "pixabay": "https://pixabay.com/service/license-summary/"}
SOURCE_NAME = {"wikimedia": "Wikimedia Commons", "archive": "Internet Archive", "aic": "Art Institute of Chicago", "polyhaven": "Poly Haven",
               "nasa": "NASA", "met": "The Metropolitan Museum of Art", "openverse": "Openverse", "pixabay": "Pixabay",
               "cleveland": "Cleveland Museum of Art", "rijks": "Rijksmuseum"}
FIELDS = ["file", "title", "author", "source_url", "licence", "licence_url", "attribution_text", "modifications",
          "downloaded_at", "used_in", "notes"]
_last = {}                                    # host -> when its last request started: sources asked side by side never wait on each other
HOST_DELAY = {"film-grab.com": 2.0}           # seconds between requests; other hosts 0.5
MAX_WAIT = [None]                            # --max-wait: a short wait and no second try, for a board the user waits on
HOST_TIMEOUT = {"api.openverse.org": 60}      # its audio search can take 10-25 s on an uncached query; others 25


SHARED_PACE = {"film-grab.com": 1.0}           # a board starts its searches at once: their API calls queue across processes


def shared_pace(url):
    """Searches started side by side share one queue per rate-limited host, so six at once never meet a 429."""
    host = urllib.parse.urlparse(url).hostname or ""
    if host not in SHARED_PACE or "/wp-json/" not in url:
        return
    try:
        import fcntl
    except ImportError:                          # Windows: each process keeps its own pace
        return
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, f".pace-{host}"), "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0)
        try:
            last = float(f.read().strip() or 0)
        except ValueError:
            last = 0.0
        wait = last + SHARED_PACE[host] - time.time()
        if wait > 0:
            time.sleep(wait)
        f.seek(0)
        f.truncate()
        f.write(str(time.time()))


import threading
BUDGET = threading.local()                       # one deadline (and search: one wait) per source job, set in its thread
PACE = threading.Lock()


def wait_cap():
    """This thread's wait on one source (a search asks its sources side by side), else the run's --max-wait."""
    return getattr(BUDGET, "max_wait", None) or MAX_WAIT[0]


DOWN_FOR = 1800                                  # a source that did not answer sits out this film's searches this long


def down_until():
    try:
        with open(os.path.join(CACHE, "down.json")) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def mark_down(name):
    d = down_until()
    d[name] = time.time() + DOWN_FOR
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, "down.json"), "w") as fh:
        json.dump(d, fh)


def get(url, as_json=True):
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        with open(path, "rb") as fh:
            data = fh.read()
    else:
        host = urllib.parse.urlparse(url).hostname or ""
        with PACE:
            wait = _last.get(host, 0.0) + HOST_DELAY.get(host, 0.5) - time.time()
            _last[host] = time.time() + max(0.0, wait)
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "AIC-User-Agent": UA})
        timeout = wait_cap() or HOST_TIMEOUT.get(host, 25)
        deadline = getattr(BUDGET, "deadline", None)
        if deadline is not None:
            left = deadline - time.time()
            if left <= 0:
                raise TimeoutError("over its time")
            timeout = min(timeout, left)
        for attempt in ((0,) if deadline is not None else (0, 1)):   # a budgeted probe never sleeps on a retry
            shared_pace(url)
            _last[host] = time.time()
            try:
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    data = r.read()
                break
            except urllib.error.HTTPError as e:
                if e.code != 429 or attempt or deadline is not None:
                    raise
                after = int(e.headers.get("Retry-After") or 15) if str(e.headers.get("Retry-After") or 15).isdigit() else 15   # rate limited: wait once, then retry
                time.sleep(min(4, after) if wait_cap() else min(30, after))
            except (TimeoutError, socket.timeout, urllib.error.URLError) as e:
                timed_out = isinstance(e, (TimeoutError, socket.timeout)) or isinstance(getattr(e, "reason", None), (TimeoutError, socket.timeout))
                if not timed_out:
                    raise                                                      # a real connection error (refused, DNS, SSL): not a timeout
                if attempt or wait_cap():
                    raise TimeoutError("over its time") from e                 # normalise a stall to TimeoutError so callers keep the hits already collected
                # else: a slow search with no budget gets one more try (the loop continues)
        os.makedirs(CACHE, exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(data)
    return json.loads(data) if as_json else data


def clean(s, n=80):
    s = re.sub(r"<[^>]+>", "", str(s or ""))
    return re.sub(r"\s+", " ", s).strip()[:n]


def norm_licence(text):
    t = (text or "").lower()
    if "cc0" in t or "zero" in t:
        return "cc0"
    if "public domain" in t or t.startswith("pd"):
        return "pd"
    if "nc" in t.replace("-", " ").split() or "nd" in t.replace("-", " ").split():
        return None
    if "by-sa" in t or "by sa" in t:
        return "cc-by-sa"
    if "cc by" in t or "cc-by" in t:
        return "cc-by"
    return None


def rec(source, sid, title, creator, licence, page, file_url, thumb, kind):
    return {"source": source, "id": str(sid), "title": clean(title), "creator": clean(creator, 60) or "unknown",
            "licence": licence, "page": page, "file": file_url, "thumb": thumb, "type": kind}


def src_wikimedia(q, n, kind):
    ft = "audio" if kind in ("sound", "music") else "video" if kind == "video" else "bitmap"
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:{ft}",
         "gsrnamespace": "6", "gsrlimit": n * 3, "prop": "imageinfo", "iiprop": "url|extmetadata",
         "iiurlwidth": "480", "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist"}
    s = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p))
    out = []
    for page in sorted((s.get("query") or {}).get("pages", {}).values(), key=lambda x: x.get("index", 0)):
        ii = (page.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        short = (md.get("LicenseShortName") or {}).get("value") or ""
        lic = norm_licence(short)
        if lic:
            r = rec("wikimedia", page.get("pageid"), page.get("title", "").replace("File:", ""),
                    (md.get("Artist") or {}).get("value"), lic, ii.get("descriptionurl"), ii.get("url"),
                    ii.get("thumburl") if kind not in ("sound", "music") else None, kind)
            url = ((md.get("LicenseUrl") or {}).get("value") or "").strip()
            ver = re.search(r"(\d\.\d)", short)            # keep the file's own licence version (CC BY 2.0 is not 4.0)
            if url.startswith("http"):
                r["licence_url"] = url
            elif ver and lic in ("cc-by", "cc-by-sa"):
                r["licence_url"] = f"https://creativecommons.org/licenses/{lic[3:]}/{ver.group(1)}/"
            if short:
                r["licence_name"] = short
            out.append(r)
    return out[:n]


def src_aic(q, n, kind):
    s = get("https://api.artic.edu/api/v1/artworks/search?" + urllib.parse.urlencode(
        {"q": q, "query[term][is_public_domain]": "true", "limit": n,
         "fields": "id,title,artist_display,image_id,is_public_domain,thumbnail"}))
    base = (s.get("config") or {}).get("iiif_url", "https://www.artic.edu/iiif/2")

    def size(d):          # the original's own width up to 3000 px; its IIIF server honours only a width ("max" and boxes are not)
        w = (d.get("thumbnail") or {}).get("width")
        return f"{min(3000, w)}," if isinstance(w, int) and w > 0 else "843,"
    return [rec("aic", d["id"], d.get("title"), (d.get("artist_display") or "").split("\n")[0], "cc0",
                f"https://www.artic.edu/artworks/{d['id']}", f"{base}/{d['image_id']}/full/{size(d)}/0/default.jpg",
                f"{base}/{d['image_id']}/full/200,/0/default.jpg", "image")
            for d in s.get("data", []) if d.get("image_id") and d.get("is_public_domain")]


def src_polyhaven(q, n, kind):
    t = {"hdri": "hdris", "texture": "textures"}.get(kind, "all")
    s = get(f"https://api.polyhaven.com/assets?type={t}")
    words = [w.lower() for w in q.split()]
    scored = []
    for aid, a in s.items():
        hay = " ".join([aid, a.get("name", "")] + a.get("tags", []) + a.get("categories", [])).lower()
        score = sum(w in hay for w in words)
        if score:
            scored.append((-score, -a.get("download_count", 0), aid, a))
    return [rec("polyhaven", aid, a.get("name"), ", ".join(a.get("authors", {}).keys()), "cc0",
                f"https://polyhaven.com/a/{aid}", f"https://api.polyhaven.com/files/{aid}",
                f"https://cdn.polyhaven.com/asset_img/thumbs/{aid}.png?width=256",
                {0: "hdri", 1: "texture", 2: "model"}.get(a.get("type"), kind))
            for _, _, aid, a in sorted(scored)[:n]]


def src_nasa(q, n, kind):
    s = get("https://images-api.nasa.gov/search?" + urllib.parse.urlencode({"q": q, "media_type": "image", "page_size": n}))
    out = []
    for it in s.get("collection", {}).get("items", [])[:n]:
        d = (it.get("data") or [{}])[0]
        nid = urllib.parse.quote(d.get("nasa_id") or "")
        out.append(rec("nasa", d.get("nasa_id"), d.get("title"), d.get("photographer") or d.get("center") or "NASA", "nasa",
                       f"https://images.nasa.gov/details/{nid}", f"https://images-api.nasa.gov/asset/{nid}",
                       (it.get("links") or [{}])[0].get("href"), "image"))
    return out


def src_met(q, n, kind):
    s = get("https://collectionapi.metmuseum.org/public/collection/v1.1/search?" + urllib.parse.urlencode(
        {"q": q, "hasImages": "true", "limit": n * 4}))
    out = []
    for oid in (s.get("objectIDs") or [])[: n * 4]:
        try:
            o = get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
        except urllib.error.HTTPError as e:      # withdrawn object ids answer 404: skip them; a timeout or a 429 is not "none"
            if e.code == 404:
                continue
            raise
        except (TimeoutError, socket.timeout):   # out of time: keep what was found, else let the caller (supply) see the timeout
            if out:
                break
            raise
        if o.get("isPublicDomain") and o.get("primaryImageSmall"):
            out.append(rec("met", oid, o.get("title"), o.get("artistDisplayName") or o.get("culture"), "cc0",
                           o.get("objectURL"), o.get("primaryImage"), o.get("primaryImageSmall"), "image"))
        if len(out) >= n:
            break
    return out


def src_cleveland(q, n, kind):
    s = get("https://openaccess-api.clevelandart.org/api/artworks/?" + urllib.parse.urlencode(
        {"q": q, "has_image": 1, "cc0": 1, "limit": n}))
    out = []
    for d in s.get("data") or []:
        im = d.get("images") or {}
        big, small = (im.get("print") or im.get("web") or {}).get("url"), (im.get("web") or {}).get("url")
        if d.get("share_license_status") == "CC0" and big and small:
            out.append(rec("cleveland", d.get("id"), d.get("title"), ((d.get("creators") or [{}])[0] or {}).get("description"),
                           "cc0", d.get("url"), big, small, "image"))
    return out[:n]


RIJKS_EN = "http://vocab.getty.edu/aat/300388277"                 # Linked Art's tag for English text
RIJKS_LIC = {"publicdomain/zero": "cc0", "publicdomain/mark": "pd"}


def rijks_record(o):
    def text(items):                                              # the English wording when there is one
        items = [i for i in items if i.get("content")]
        pick = next((i for i in items if any(l.get("id") == RIJKS_EN for l in i.get("language") or [])), None)
        return (pick or (items[0] if items else {})).get("content")
    ids = o.get("identified_by") or []
    number = next((i.get("content") for i in ids if i.get("type") == "Identifier" and i.get("content")), None)
    for s in o.get("subject_of") or []:
        for dc in s.get("digitally_carried_by") or []:
            terms = " ".join(str(r.get("content")) for r in dc.get("referred_to_by") or [])
            lic = next((v for k, v in RIJKS_LIC.items() if k in terms), None)
            img = next((a.get("id") for a in dc.get("access_point") or []
                        if str(a.get("id")).startswith("https://iiif.micr.io/")), None)
            if lic and img and number:
                base = img.split("/full/")[0]
                return rec("rijks", number, text([i for i in ids if i.get("type") == "Name"]),
                           text((o.get("produced_by") or {}).get("referred_to_by") or []), lic,
                           f"https://www.rijksmuseum.nl/en/collection/{urllib.parse.quote(number)}",
                           f"{base}/full/!3400,3400/0/default.jpg", f"{base}/full/400,/0/default.jpg", "image")
    return None


def src_rijks(q, n, kind):
    s = get("https://data.rijksmuseum.nl/search/collection?" + urllib.parse.urlencode({"title": q, "imageAvailable": "true"}))
    out = []
    for it in (s.get("orderedItems") or [])[: n * 3]:
        oid = str(it.get("id") or "")
        if not oid.startswith("https://id.rijksmuseum.nl/"):      # follow only the museum's own object ids
            continue
        try:
            o = get(oid)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue
            raise
        except (TimeoutError, socket.timeout):   # out of time: keep what was found, else let the caller (supply) see the timeout
            if out:
                break
            raise
        r = rijks_record(o)
        if r:
            out.append(r)
        if len(out) >= n:
            break
    return out


OV_ALLOWED = set()                                # set by search(): the licences this run keeps
OV_LIC = {"cc0": "cc0", "pdm": "pd", "by": "cc-by", "by-sa": "cc-by-sa"}


def src_openverse(q, n, kind):
    media = "audio" if kind in ("sound", "music") else "images"
    params = {"q": q, "license": ",".join(OV_LIC), "page_size": n, "mature": "false"}
    if kind == "music":
        params["category"] = "music"              # Jamendo tracks; without it, audio is mostly Freesound and Wikimedia
        params["license"] = ",".join(k for k, v in OV_LIC.items() if v in OV_ALLOWED)   # most music is BY-SA: ask the API
    found = get(f"https://api.openverse.org/v1/{media}/?" + urllib.parse.urlencode(params)).get("results", [])
    if not found and " " in q.strip():           # every word must match (no OR syntax): try the words one by one
        for w in sorted(set(q.split()), key=len, reverse=True)[:3]:
            try:
                found += [d for d in get(f"https://api.openverse.org/v1/{media}/?" + urllib.parse.urlencode(dict(params, q=w))).get(
                    "results", []) if d.get("id") not in {x.get("id") for x in found}]
            except (TimeoutError, socket.timeout):   # out of time: keep what was found, else let the caller (supply) see the timeout
                if found:
                    break
                raise
            if len(found) >= n:
                break
    out = []
    for d in found:
        lic = OV_LIC.get(d.get("license"))
        if not lic:
            continue
        r = rec("openverse", d.get("id"), d.get("title"), d.get("creator"), lic, d.get("foreign_landing_url"),
                d.get("url"), d.get("thumbnail") if media == "images" else None, kind)
        r.update({"licence_url": d.get("license_url"), "attribution": d.get("attribution"),
                  "provider": d.get("source") or d.get("provider")})
        if d.get("duration"):
            r["duration"] = round(d["duration"] / 1000, 1)
        out.append(r)
    return out[:n]


def src_filmgrab(q, n, kind):
    api = "https://film-grab.com/wp-json/wp/v2"
    params = {"per_page": min(n, 10), "_fields": "id,link,title,featured_media,categories"}
    if q.startswith("cat:"):
        want = q[4:].strip().lower()
        cats = get(f"{api}/categories?" + urllib.parse.urlencode({"search": want, "per_page": 20, "_fields": "id,name,count"}))
        if not cats:
            return []
        exact = [c for c in cats if html.unescape(c["name"]).lower() == want]
        params["categories"] = (exact or [max(cats, key=lambda c: c.get("count", 0))])[0]["id"]
    else:                                       # a film title: stills from across that one film, not one per film
        params.update(search=q, per_page=10, _fields=params["_fields"] + ",content")
    posts = get(f"{api}/posts?" + urllib.parse.urlencode(params))
    if posts and "categories" not in params:     # the search matches any word on a page: keep only the film named
        norm = lambda t: re.sub(r"[^a-z0-9]+", " ", html.unescape(t).lower().replace("the ", "")).strip()
        named = [p_ for p_ in posts if norm((p_.get("title") or {}).get("rendered", "")) == norm(q)]
        if not named:
            print(f"filmgrab: no film titled \"{q}\" (the search found: " + ", ".join(
                html.unescape((p_.get("title") or {}).get("rendered", "")) for p_ in posts[:5]) + "); check the title",
                file=sys.stderr)
            return []
        post, title = named[0], html.unescape((named[0].get("title") or {}).get("rendered", ""))
        body = (post.get("content") or {}).get("rendered", "")
        stills = list(dict.fromkeys(u.split("?")[0] for u in re.findall(
            r'src="(https://film-grab\.com/wp-content/uploads/photo-gallery/thumb/[^"]+)"', body)))
        if stills:
            picks = [stills[round(i * (len(stills) - 1) / max(n - 1, 1))] for i in range(min(n, len(stills)))]
            return [dict(rec("filmgrab", f"{post['id']}-{i}", title, "", "mood-only", post.get("link"), None,
                             urllib.parse.quote(u, safe=":/"), "still"), use="mood-only")
                    for i, u in enumerate(dict.fromkeys(picks))]
    if not posts:
        return []
    cat_ids = sorted({c for p_ in posts for c in (p_.get("categories") or [])[:12]})
    media_ids = [p_["featured_media"] for p_ in posts if p_.get("featured_media")]
    cats = {c["id"]: html.unescape(c["name"]) for c in get(f"{api}/categories?" + urllib.parse.urlencode(
        {"include": ",".join(map(str, cat_ids)), "_fields": "id,name", "per_page": 100}))} if cat_ids else {}
    media = {m["id"]: m for m in get(f"{api}/media?" + urllib.parse.urlencode(
        {"include": ",".join(map(str, media_ids)), "_fields": "id,source_url,media_details", "per_page": 100}))} if media_ids else {}
    out = []
    for post in posts:                          # three requests per search in all: posts, their categories, their stills
        names = [cats[c] for c in (post.get("categories") or [])[:12] if c in cats]
        year = next((x for x in names if re.fullmatch(r"(18|19|20)\d\d", x)), "")
        people = [x for x in names if x != year and not re.search(r"\d", x)][:2]
        m = media.get(post.get("featured_media")) or {}
        sizes = (m.get("media_details") or {}).get("sizes") or {}
        thumb = next((sizes[k]["source_url"] for k in ("medium_large", "medium", "thumbnail") if k in sizes),
                     m.get("source_url"))
        r = rec("filmgrab", post["id"], html.unescape((post.get("title") or {}).get("rendered", "")), ", ".join(people),
                "mood-only", post.get("link"), None, thumb, "still")
        out.append(dict(r, year=year, use="mood-only"))
    return out


def src_pixabay(q, n, kind):
    """Pixabay's stock photos and videos (Pixabay Content License: free for commercial use, no credit owed, never sold or
    shared as files). Its search reaches far, so a hit's tags must name a word of the query; AI-generated pictures,
    cartoons and 3D renders are left out, since stock answers what the real world looks like."""
    if kind not in ("image", "video"):
        return []
    import keys
    key = keys.get("PIXABAY_API_KEY")
    if not key:
        raise RuntimeError("needs a free key: tools/keys.py open PIXABAY_API_KEY")
    base = "https://pixabay.com/api/videos/" if kind == "video" else "https://pixabay.com/api/"
    try:
        s = get(base + "?" + urllib.parse.urlencode({"key": key, "q": q[:100], "per_page": max(3, min(200, n * 3)),
                                                      "safesearch": "true", ("video_type" if kind == "video" else "image_type"):
                                                      "film" if kind == "video" else "photo"}))
    except Exception as e:                        # an error can carry the request's address, and the key in it
        raise RuntimeError(str(e).replace(key, "<key>").replace(urllib.parse.quote(key), "<key>")) from None
    words = [w for w in re.findall(r"\w+", q.lower()) if len(w) > 2]
    out = []
    for h in s.get("hits", []):
        tags = (h.get("tags") or "").lower()
        if (words and not any(w in tags for w in words)) or \
                re.search(r"\bai[- ]generated\b|\bgenerative\b|\bcartoon|\banimation\b|\b3d\b|\brender", tags):
            continue
        if kind == "video":
            sizes = [v for v in ((h.get("videos") or {}).get(k) or {} for k in ("large", "medium", "small", "tiny")) if v.get("url")]
            pick = next((v for v in sizes if (v.get("width") or 0) <= 1920), sizes[-1] if sizes else None)
            if not pick:
                continue
            r = rec("pixabay", h.get("id"), tags, h.get("user"), "pixabay", h.get("pageURL"), pick["url"],
                    next((v.get("thumbnail") for v in reversed(sizes) if v.get("thumbnail")), None), "video")
            r["duration"] = h.get("duration")
        else:
            r = rec("pixabay", h.get("id"), tags, h.get("user"), "pixabay", h.get("pageURL"),
                    h.get("largeImageURL") or h.get("webformatURL"), h.get("webformatURL") or h.get("previewURL"), "image")
        r["licence_url"], r["licence_name"] = LIC_URL["pixabay"], "Pixabay Content License"
        r["attribution"] = f'"{r["title"]}" by {r["creator"]} on Pixabay (Pixabay Content License)'
        out.append(r)
        if len(out) >= n:
            break
    return out


def src_archive(q, n, kind):
    """The Internet Archive's recordings and films: public domain, CC0 and CC BY only (no NC, no ND), one playable file
    each."""
    if kind not in ("sound", "music", "video"):
        return []
    media = "movies" if kind == "video" else "audio"
    where = " AND collection:(jamendo-albums OR netlabels)" if kind == "music" else ""   # music: released tracks, not radio shows
    query = f"({q}){where} AND mediatype:({media}) AND " + r"licenseurl:(*\/licenses\/by\/* OR *publicdomain*)"   # usable rows only
    s = get("https://archive.org/advancedsearch.php?" + urllib.parse.urlencode(
        [("q", query), ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "creator"), ("fl[]", "licenseurl"),
         ("rows", n * 8), ("output", "json")]))
    out = []
    for d in (s.get("response") or {}).get("docs", []):
        url = str(d.get("licenseurl") or "")
        lic = "cc0" if "zero" in url else "pd" if "publicdomain" in url else "cc-by" if "/licenses/by/" in url else None
        if not lic:
            continue
        try:
            meta = get(f"https://archive.org/metadata/{urllib.parse.quote(d['identifier'])}")
        except (TimeoutError, socket.timeout):   # out of time: keep what was found, else let the caller (supply) see the timeout
            if out:
                break
            raise
        playable = ("h.264", "h.264 IA", "MPEG4", "512Kb MPEG4") if kind == "video" else ("VBR MP3", "MP3", "128Kbps MP3", "Ogg Vorbis")
        files = [f for f in meta.get("files", []) if f.get("format") in playable]
        if not files:
            continue
        creator = d.get("creator")
        r = rec("archive", d["identifier"], d.get("title"), creator[0] if isinstance(creator, list) else creator, lic,
                f"https://archive.org/details/{d['identifier']}",
                f"https://archive.org/download/{d['identifier']}/{urllib.parse.quote(files[0]['name'])}",
                f"https://archive.org/services/img/{d['identifier']}" if kind == "video" else None, kind)
        r["licence_url"] = url
        out.append(r)
        if len(out) >= n:
            break
    return out


SOURCES = {"wikimedia": src_wikimedia, "archive": src_archive, "aic": src_aic, "met": src_met, "openverse": src_openverse,
           "polyhaven": src_polyhaven, "nasa": src_nasa, "filmgrab": src_filmgrab, "pixabay": src_pixabay,
           "cleveland": src_cleveland, "rijks": src_rijks}
DEFAULT = {"image": "wikimedia,aic,cleveland,nasa,pixabay", "sound": "wikimedia,openverse", "music": "archive,openverse",
           "hdri": "polyhaven", "texture": "polyhaven", "video": "pixabay,wikimedia,archive"}


def contact_sheet(results, out):
    thumbs, shown = [], []
    os.makedirs(os.path.join(out, "thumbs"), exist_ok=True)
    for r in results:
        if not r.get("thumb"):
            continue
        p = os.path.join(out, "thumbs", f"{r['n']:02d}.img")
        src = r["thumb"]
        try:
            if os.path.exists(src):                  # a local file (the user's refs/): read it, never download it
                data = None
                if os.path.abspath(src) != os.path.abspath(p):
                    with open(src, "rb") as source:
                        data = source.read()
            else:                                     # always this result's own (cached) thumb: a reused number never shows an old image
                data = get(src, as_json=False)
            if data is not None:
                with open(p + ".part", "wb") as destination:
                    destination.write(data)
                os.replace(p + ".part", p)
            thumbs.append(p)
            shown.append(r["n"])
        except Exception as e:
            print(f"thumb {r['n']}: skipped ({str(e)[:80]})")
    if not thumbs:
        return None
    try:
        cols = min(4, len(thumbs))
        rows = (len(thumbs) + cols - 1) // cols
        cmd = ["ffmpeg", "-v", "error", "-y"]
        for p in thumbs:
            cmd += ["-i", p]
        f = "".join(f"[{i}]scale=200:200:force_original_aspect_ratio=decrease,pad=200:200:(ow-iw)/2:(oh-ih)/2,setsar=1[t{i}];"
                    for i in range(len(thumbs)))
        layout = "|".join(f"{(i % cols) * 200}_{(i // cols) * 200}" for i in range(len(thumbs)))
        f += "".join(f"[t{i}]" for i in range(len(thumbs))) + \
            (f"xstack=inputs={len(thumbs)}:layout={layout}:fill=black" if len(thumbs) > 1 else "null")
        sheet = os.path.join(out, "sheet.jpg")
        subprocess.run(cmd + ["-filter_complex", f, "-frames:v", "1", "-q:v", "5", sheet], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return sheet, cols, shown
    except Exception:
        return None


def supply(a):
    """What the open archives hold for each key element, before any download: one metadata query per element and
    source, licences filtered, nothing fetched. A real person, team, event or brand often has almost nothing open; say
    so at once with the numbers and the routes, instead of searching for hours."""
    allowed = OPEN
    OV_ALLOWED.clear(); OV_ALLOWED.update(allowed)
    sources = (a.sources or "wikimedia,met,aic").split(",")
    print("supply (open licence only, metadata, nothing downloaded):")
    MAX_WAIT[0] = MAX_WAIT[0] or 10           # a probe answers in seconds: a slow source counts as skipped

    def ask(job):
        q, name = job
        BUDGET.deadline = time.time() + MAX_WAIT[0]   # the whole source, however many requests it makes
        try:
            return job, [r for r in SOURCES[name](q, a.n, "image") if r["licence"] in allowed]
        except Exception as e:
            return job, f"skipped ({str(e)[:40]})"
        finally:
            BUDGET.deadline = None

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=8) as pool:
        found = dict(pool.map(ask, [(q, name) for q in a.q for name in sources]))
    verdicts = []
    for q in a.q:
        counts, titles = {}, set()
        for name in sources:
            hits = found[(q, name)]
            if isinstance(hits, str):
                counts[name] = hits
                continue
            fresh = [r for r in hits if r["title"].lower()[:40] not in titles]
            titles.update(r["title"].lower()[:40] for r in fresh)
            counts[name] = len(fresh)
        total = len(titles)
        slow = [k for k, v in counts.items() if isinstance(v, str)]
        verdict = "enough" if total >= 8 else ("not judged yet" if slow else "thin" if total else "none")
        verdicts.append((q, verdict, slow))
        print(f"  {q[:44]:44s} " + " · ".join(f"{k} {v}" for k, v in counts.items()) + f"  -> {verdict} ({total})")
    late = sorted({s for _, v, slow in verdicts if v == "not judged yet" for s in slow})
    if late:
        print("Not judged yet: " + "; ".join(q for q, v, _ in verdicts if v == "not judged yet") + f" ({', '.join(late)} "
              "did not answer in time). Search them patiently in the background with --patient "
              f"(asset_search.py search --patient --sources {','.join(late)} --q …), and never tell the user anything is "
              "missing before that search has answered.")
    gaps = [q for q, v, _ in verdicts if v in ("thin", "none")]
    if gaps:
        print("Tell the user now, with these numbers: the open archives are thin or empty for " + "; ".join(gaps)
              + ". Routes: their own licensed material in assets/ (an agency, a private collection, a broadcaster), a design-led film "
              "(type, numbers, maps, recreated places), or a mix. Searching longer does not find what "
              "the archives do not hold.")


def search(a):
    if a.type == "typography":                  # mood references: type_refs.py (Fonts In Use, Art of the Title, Typewolf, Are.na)
        import type_refs
        type_refs.search(a.q, a.n, a.sources, a.out, a.purpose)
        return
    allowed = set(a.licence.split(",")) if a.licence else (OPEN - {"cc-by-sa"} if a.type == "music" else OPEN)
    OV_ALLOWED.clear(); OV_ALLOWED.update(allowed)
    results, seen = [], set()
    names = (a.sources or DEFAULT[a.type]).split(",")
    patient = getattr(a, "patient", False)        # --patient: every source in full, for a background run; the foreground never waits unbounded
    win = lambda nm: a.max_wait or (30 if nm == "openverse" else 20)   # seconds on one source; Openverse audio answers in 10-25 s
    down = {} if (a.sources or patient) else down_until()   # a source named with --sources is always asked
    asked = []
    for name in names:
        if down.get(name, 0) > time.time():
            back = time.strftime("%H:%M", time.localtime(down[name]))
            print(f"{name}: skipped (it did not answer a search here lately; asked again from {back}, or now with --sources {name})")
        else:
            asked.append(name)

    def ask(name):                                # each source in its own thread, with its own wait
        BUDGET.deadline = None if patient else time.time() + win(name)
        BUDGET.max_wait = None if patient else win(name)
        try:
            return list(SOURCES[name](a.q, a.n, a.type)), None
        except Exception as e:
            return [], e
        finally:
            BUDGET.deadline = BUDGET.max_wait = None
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(asked))) as pool:
        answers = dict(zip(asked, pool.map(ask, asked)))   # side by side: a search takes as long as its slowest source
    for name in asked:
        found, err = answers[name]
        if err is not None:
            print(f"{name}: skipped ({str(err)[:80]})")
            if isinstance(err, (TimeoutError, socket.timeout)) and not patient:
                mark_down(name)
        for r in found:
            key = (r["source"], r["id"])
            if (r["licence"] in allowed or r.get("use") == "mood-only") and key not in seen:
                seen.add(key)
                results.append(r)
    used = {}
    if a.type == "sound":
        results, used = used_lately(results)
    for i, r in enumerate(results, 1):
        r["n"] = i
        src = r["source"] + (f"/{r['provider']}" if r.get("provider") and r["provider"] != r["source"] else "")
        dur = f" · {r['duration']:.0f} s" if r.get("duration") else ""
        key = f"{r['source']}:{r['id']}"
        mark = f" · used in {used[key]}" if key in used else ""
        print(f"{i:>2}. [{src}] {r['title'][:60]} · {r['creator'][:30]} · {r['licence']}{dur}{mark}")
    os.makedirs(a.out, exist_ok=True)
    json.dump({"query": a.q, "type": a.type, "results": results}, open(os.path.join(a.out, "results.json"), "w"), indent=1)
    BUDGET.max_wait = None if patient else (a.max_wait or 20)   # a stalled thumbnail gets one short try, like each source
    try:
        sheet = contact_sheet(results, a.out) if a.type not in ("sound", "music") else None
    finally:
        BUDGET.max_wait = None
    print(f"{len(results)} results -> {a.out}/results.json" +
          (f"; sheet {sheet[0]} ({sheet[1]} per row, row by row = results {','.join(map(str, sheet[2]))})" if sheet else ""))


def tiny(path):
    """16x16 grey bytes of an image, to spot the same picture arriving twice (from two archives, or as two sizes)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=16:16,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    return raw if len(raw) == 256 else None


def page(img, captions=()):
    """A page beside an image that shows it at full width, with optional numbered captions above it. Its path, clicked
    in the Claude Code desktop app, opens it big in the app's own browser pane (elsewhere in the browser); the app does
    not show images inside a chat message."""
    import html as _h
    p = os.path.splitext(str(img))[0] + ".html"
    name = _h.escape(os.path.basename(str(img)))
    caps = "".join(f"<li>{_h.escape(c)}</li>" for c in captions)
    open(p, "w", encoding="utf-8").write(
        f'<!doctype html><meta charset=utf-8><title>{name}</title><style>body{{margin:0;background:#111;color:#eee;'
        f'font:18px/1.5 -apple-system,Helvetica,Arial,sans-serif}}ul{{margin:0;padding:14px 18px;list-style:none}}'
        f'img{{display:block;width:100%;height:auto}}</style>' + (f"<ul>{caps}</ul>" if caps else "") +
        f'<img src="{name}">')
    return os.path.abspath(p)


def show(path):
    """Put a board, a sheet or a film in front of the user: Preview on macOS, the default viewer elsewhere.
    CINECODE_NO_OPEN=1 turns it off (tests, servers)."""
    if os.environ.get("CINECODE_NO_OPEN") or not os.path.exists(str(path)):
        return False
    if not os.environ.get("CINECODE_OPEN"):
        return False                              # nothing opens a window: paths go into the message; CINECODE_OPEN=1 opens them
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif sys.platform.startswith("win"):
            os.startfile(str(path))
        elif shutil.which("xdg-open") and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
            subprocess.Popen(["xdg-open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            return False
    except OSError:
        return False
    return True


def board(a):
    results, prints, dropped = [], [], []
    os.makedirs(os.path.join(a.out, "thumbs"), exist_ok=True)
    def add(r, src_thumb):
        fp = tiny(src_thumb) if src_thumb and os.path.exists(src_thumb) else None
        if fp and any(sum(abs(x - y) for x, y in zip(fp, q)) / 256 < 10 for q in prints):
            dropped.append(r.get("title", "")[:30])
            return
        if fp:
            prints.append(fp)
        r = dict(r, n=len(results) + 1)
        dst = os.path.join(a.out, "thumbs", f"{r['n']:02d}.img")
        if src_thumb and os.path.exists(src_thumb):
            shutil.copyfile(src_thumb, dst)
        results.append(r)
    drop = {}
    for item in a.drop or []:                    # "<folder>:1,4": leave out results 1 and 4 of that search
        folder, _, nums = item.partition(":")
        drop.setdefault(folder.rstrip("/").split("/")[-1], set()).update(int(x) for x in nums.split(",") if x.strip().isdigit())
    for d in a.dirs or []:
        found = json.load(open(os.path.join(d, "results.json")))["results"]
        gone = drop.get(os.path.basename(d.rstrip("/")), set())
        for r in [r for r in found if r.get("thumb") and r.get("n") not in gone][:a.per]:
            add(dict(r, element=os.path.basename(d.rstrip("/"))), os.path.join(d, "thumbs", f"{r['n']:02d}.img"))
    if a.refs and os.path.isdir(a.refs):
        for f in sorted(os.listdir(a.refs)):
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                p = os.path.join(a.refs, f)
                add(dict(rec("user", f, f, "user", "user", p, p, p, "image"), element="user"), p)
    for r in results:
        print(f"{r['n']:>2}. {r['element'][:14]:<14} [{r['source']}] {r['title'][:50]} · {r['licence']}")
    if dropped:
        print(f"left out as the same picture again: {', '.join(dropped)}")
    json.dump({"query": "board", "type": "image", "results": results}, open(os.path.join(a.out, "results.json"), "w"),
              separators=(",", ":"))
    sheet = contact_sheet(results, a.out)
    if not sheet:
        sys.exit("board: no thumbnails")
    print(f"{len(results)} references -> {a.out}/results.json; sheet {sheet[0]} ({sheet[1]} per row) · show the user: {os.path.abspath(sheet[0])} (Claude Code: SendUserFile with display 'render', it opens big in the side panel; elsewhere the page {page(sheet[0])} in your message)"
          + (" · opened on the user's screen" if show(sheet[0]) else ""))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sheet[0], "-vf", "scale=32:32", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    bins = {}
    for i in range(0, len(raw) - 2, 3):
        r, g, b = (raw[i] >> 5, raw[i + 1] >> 5, raw[i + 2] >> 5)
        if r + g + b > 0:                                   # leave out the black padding
            bins[(r, g, b)] = bins.get((r, g, b), 0) + 1
    top = sorted(bins, key=bins.get, reverse=True)[:6]
    print("palette: " + " ".join("#%02x%02x%02x" % tuple(c * 32 + 16 for c in k) for k in top))


def file_url(r, variant):
    if r["source"] == "polyhaven":
        files = get(r["file"])
        res, fmt = (variant or "2k:hdr").split(":")
        for k in ("hdri", "Diffuse", "diff"):
            node = (files.get(k) or {}).get(res)
            if isinstance(node, dict):
                pick = node.get(fmt) or next(iter(node.values()))
                if isinstance(pick, dict) and "url" in pick:
                    return pick["url"]
        raise RuntimeError("no file for that variant; try --variant 1k:jpg or 2k:hdr")
    if r["source"] == "nasa":
        hrefs = [i["href"] for i in get(r["file"]).get("collection", {}).get("items", [])]
        for tag in ("~large", "~orig", "~medium"):
            for h in hrefs:
                if tag in h and h.lower().endswith((".jpg", ".jpeg", ".png")):
                    return h
        return hrefs[0]
    return r["file"]


def preview(url, path, secs):
    """The first `secs` of a track: ffmpeg reads the stream and stops, so the rest is never downloaded; without
    ffmpeg, the first bytes (about 30 s of a 320 kbps MP3 per 1.2 MB)."""
    if shutil.which("ffmpeg"):
        agent = ["-user_agent", UA] if url.startswith("http") else []
        fmt = {".mka": "matroska", ".oga": "ogg", ".m4a": "ipod"}.get(os.path.splitext(path)[1], None)
        subprocess.run(["ffmpeg", "-v", "error", "-y", *agent, "-t", str(secs), "-i", url, "-map", "0:a:0", "-c", "copy",
                        *(["-f", fmt] if fmt else []), path + ".part" + os.path.splitext(path)[1]], check=True, timeout=120)
        os.replace(path + ".part" + os.path.splitext(path)[1], path)
        return
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Range": f"bytes=0-{int(secs * 40000)}"})
    with urllib.request.urlopen(req, timeout=60) as resp, open(path + ".part", "wb") as f:
        f.write(resp.read())
    os.replace(path + ".part", path)


def sound_cache(r, ext):
    """A fetched sound also lands in the cache every film shares (sounds.py), so the next film copies it instead of
    downloading it again; None for other kinds."""
    if r.get("type") != "sound":
        return None
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import sounds
    except ImportError:
        return None
    return sounds.CACHE / "found" / f"{r['source']}-{r['id']}{ext}".replace("/", "-")


def used_lately(results):
    """Sounds your last films used go after the rest, marked, so the shared cache never becomes the same sounds."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import sounds
    except ImportError:
        return results, {}
    used = sounds.recent()
    return sorted(results, key=lambda r: f"{r['source']}:{r['id']}" in used), used


def fetch(a):
    data = json.load(open(a.results, encoding="utf-8"))
    by_n = {r["n"]: r for r in data["results"]}
    os.makedirs(a.dest, exist_ok=True)
    new = not os.path.exists(a.licenses) or os.path.getsize(a.licenses) == 0
    rows = []
    picks = [int(x) for x in a.pick.split(",")]
    deadline = time.time() + max(90, 30 * len(picks))   # a loose total backstop so a batch of dead links never hangs
    fails, down = {}, set()                             # connection failures in a row per source; a source found down (3 in a row) is skipped
    for n in picks:
        if time.time() >= deadline:
            print(f"{n}+: not fetched (the fetch spent its time; try again or another source)")
            break
        r = by_n.get(n)
        if not r:
            print(f"{n}: not in results")
            continue
        if r["source"] in down:
            print(f"{n}: skipped ({r['source']} is unreachable right now)")
            continue
        if r.get("use") == "mood-only" or r.get("licence") == "mood-only":
            print(f"{n}: mood-only reference (link and thumbnail for study): never fetched into the film")
            continue
        try:
            url = file_url(r, a.variant)
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1][:6] or ".bin"
            slug = re.sub(r"[^a-z0-9]+", "-", r["title"].lower()).strip("-")[:40] or "asset"
            path = os.path.join(a.dest, f"{r['source']}-{r['id']}-{slug}{ext}".replace("/", "-"))
            if os.path.exists(path):
                print(f"{n}: already here: {path}")
                fails.pop(r["source"], None)
                continue
            if a.preview and r.get("type") in ("sound", "music"):
                ext = ext if ext.lower() in (".mp3", ".ogg", ".oga", ".opus", ".flac", ".wav", ".m4a", ".aac") else ".mka"
                path = os.path.splitext(path)[0] + f"-preview{ext}"
                if not os.path.exists(path):
                    preview(url, path, a.preview)
                print(f"{n}: {path} · first {a.preview:g} s, for listening (no licence row; fetch the pick without --preview)")
                fails.pop(r["source"], None)
                continue
            shared = sound_cache(r, ext)
            if shared and shared.exists():
                shutil.copyfile(shared, path)
                print(f"{n}: from the shared sound cache (downloaded for an earlier film)")
            else:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "AIC-User-Agent": UA})   # AIC's image server refuses a file without it
                with urllib.request.urlopen(req, timeout=90) as resp, open(path + ".part", "wb") as f:
                    while chunk := resp.read(1 << 20):
                        f.write(chunk)
                os.replace(path + ".part", path)
                if shared:
                    shared.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(path, shared)
            if shared:
                import sounds
                sounds.remember(f"{r['source']}:{r['id']}")
            deadline = max(deadline, time.time() + max(90, 30 * len(picks)))   # a healthy fetch refreshes the budget
        except urllib.error.HTTPError as e:
            print(f"{n}: failed (the file is gone, HTTP {e.code})")       # the source answered; only this file is missing
            fails.pop(r["source"], None)
            continue
        except (urllib.error.URLError, TimeoutError, socket.timeout) as e:
            fails[r["source"]] = fails.get(r["source"], 0) + 1
            print(f"{n}: failed ({str(getattr(e, 'reason', e))[:70]})")
            if fails[r["source"]] >= 3:
                down.add(r["source"])
                print(f"{r['source']} looks unreachable (3 failures in a row) — skipping its remaining picks; other sources continue")
            continue
        except Exception as e:
            print(f"{n}: failed ({str(e)[:80]})")
            continue
        fails.pop(r["source"], None)
        lic = {"cc0": "CC0", "pd": "Public domain", "cc-by": "CC BY", "cc-by-sa": "CC BY-SA", "nasa": "Courtesy NASA",
               "pixabay": "Pixabay Content License"}[r["licence"]]
        rows.append({"file": path, "title": r["title"], "author": r["creator"], "source_url": r["page"],
                     "licence": r["licence"], "licence_url": r.get("licence_url") or LIC_URL[r["licence"]],
                     "attribution_text": r.get("attribution") or f'"{r["title"]}" by {r["creator"]}, {SOURCE_NAME[r["source"]]}, {lic}',
                     "modifications": "", "downloaded_at": datetime.date.today().isoformat(), "used_in": "",
                     "notes": f"type={r['type']}; source={r['source']}" + (f"; via {r['provider']}" if r.get("provider") else "")})
        print(f"{n}: {path} · {r['licence']}")
    if rows:
        with open(a.licenses, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            if new:
                w.writeheader()
            w.writerows(rows)
        print(f"logged {len(rows)} row(s) in {a.licenses}; fill 'used_in' and 'modifications' when used")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("--q", required=True)
    s.add_argument("--type", default="image", choices=["image", "video", "sound", "music", "hdri", "texture", "typography"])
    s.add_argument("--purpose", default="cinematic", choices=["cinematic", "ad"], help="typography: default sources")
    s.add_argument("--sources")
    s.add_argument("--licence")
    s.add_argument("--n", type=int, default=6)
    s.add_argument("--out", required=True)
    s.add_argument("--max-wait", type=float, help="seconds on one source before moving to the next (default 20; Openverse audio needs 10-25 s)")
    s.add_argument("--patient", action="store_true", help="search every source in full with no time limit — only for a background run, never the foreground")
    u = sub.add_parser("supply", help="count what the open archives hold per element, nothing downloaded")
    u.add_argument("--q", action="append", required=True, help="one key element per --q (English, the shape in words)")
    u.add_argument("--sources", help="default wikimedia,met,aic")
    u.add_argument("--n", type=int, default=20, help="results asked per source and element")
    u.add_argument("--max-wait", type=float, help="seconds per source, no second try (default 10)")
    f = sub.add_parser("fetch")
    f.add_argument("--results", required=True)
    f.add_argument("--pick", required=True)
    f.add_argument("--dest", required=True)
    f.add_argument("--variant", help="Poly Haven resolution:format, e.g. 2k:hdr, 1k:jpg")
    f.add_argument("--preview", type=float, help="sounds and music: only the first N seconds, for listening")
    f.add_argument("--licenses", default="LICENSES.csv")
    b = sub.add_parser("board")
    b.add_argument("--dirs", nargs="*", help="search output folders, one per key element")
    b.add_argument("--per", type=int, default=3)
    b.add_argument("--drop", nargs="*", help='results to leave out, per search folder: "<folder>:1,4" "<folder>:2"')
    b.add_argument("--refs", help="the user's reference folder (images)")
    b.add_argument("--out", required=True)
    a = ap.parse_args()
    MAX_WAIT[0] = getattr(a, "max_wait", None)
    {"search": search, "fetch": fetch, "board": board, "supply": supply}[a.cmd](a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()

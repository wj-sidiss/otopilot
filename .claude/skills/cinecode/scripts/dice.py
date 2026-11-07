#!/usr/bin/env python3
"""Seeds from outside, and the memory of this user's films (Python 3 stdlib; no CLI of its own).

A seed is a real thing drawn by chance, so a film's idea starts somewhere the model's habits would not go: a museum
object (the Cleveland Museum of Art's open access), a living species (among iNaturalist's 10,000 most observed),
something in space (JPL's pictures in NASA's image library), an invention (Wikipedia's timeline of historic
inventions), a heritage site or a craft or custom (UNESCO's lists, in seeds.json). `deal.py deal spark` puts one in
every hand, each from another pool; `deal.py deal seed --n <count>` deals one for each world of a film. A pool that
does not answer within a few seconds is replaced by one of the two lists, which need no network: a deal never waits
long or fails.

The memory: `make.py` records each film's title, idea and medium in ~/.cinecode/films.json (CINECODE_FILMS
overrides); `deal.py past --scan <folder>` adds films made before. `brief.py overlap` writes them, with the films on
the same shelf, into research/past-films.md for the helper that checks new ideas against them.
"""
import datetime
import hashlib
import html
import json
import os
import random
import re
import threading
import time
import urllib.parse
import urllib.request

UA = "cinecode-dice/1.0 (one request per seed for a film idea; low volume)"
WAIT = 8
DEADLINE = WAIT + 4      # a whole pool, its summary too: a slow trickle past it gives way to a list
SEEDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seeds.json")
POOLS = {"museum": "a museum object", "nature": "a living species", "sky": "something in space",
         "invention": "an invention", "place": "a heritage site", "custom": "a craft or custom"}
OFFLINE = ("place", "custom")
INSIDE = {"node_modules", "renders", "frames", "audio", "assets", "review", "research", "logs", "tools", "engine",
          "refs", "notes", "type", "fonts", "__pycache__"}


def get(url, wait=WAIT):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=wait) as r:
        return json.load(r)


def clean(text, n=260):
    text = " ".join(re.sub(r"<[^>]+>", " ", html.unescape(str(text or ""))).split()).replace(" · ", ", ")
    if len(text) <= n:
        return text
    cut = text[:n]
    end = cut.rfind(". ")
    return cut[:end + 1] if end > n // 3 else cut.rsplit(" ", 1)[0] + "…"


def summary(title, wait=4):
    """The opening of the English Wikipedia article, or "" (a disambiguation page, or no answer)."""
    try:
        d = get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_"), safe=""),
                wait)
    except Exception:
        return ""
    text = clean(d.get("extract"))
    return "" if d.get("type") == "disambiguation" or re.match(r"This (?:is a|article is a) list", text) else text


def museum(rng, avoid):
    d = get("https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=1&skip=%d&fields=title,type,"
            "creation_date,culture,technique,did_you_know,wall_description,url" % rng.randrange(40000))
    a = d["data"][0]
    what = ", ".join(x for x in (a.get("type"), "; ".join(a.get("culture") or []), a.get("creation_date"),
                                 a.get("technique")) if x)
    more = a.get("did_you_know") or a.get("wall_description") or ""
    return {"name": clean(a["title"], 120), "fact": clean(what + (". " + more if more else "")), "link": a.get("url", "")}


def nature(rng, avoid):
    t = get("https://api.inaturalist.org/v1/taxa?rank=species&is_active=true&order_by=observations_count&per_page=1"
            "&page=%d" % rng.randint(1, 10000))["results"][0]
    common, latin = t.get("preferred_common_name") or "", t["name"]
    wiki = (t.get("wikipedia_url") or "").rsplit("/wiki/", 1)
    fact = summary(urllib.parse.unquote(wiki[1])) if len(wiki) == 2 else ""
    return {"name": f"{common} ({latin})" if common else latin,
            "fact": fact or f"a species of {t.get('iconic_taxon_name') or 'living thing'}",
            "link": t.get("wikipedia_url") or f"https://www.inaturalist.org/taxa/{t['id']}"}


def sky(rng, avoid):
    year = rng.randint(1996, datetime.date.today().year - 1)       # the library dates JPL's pictures from 1996 on
    url = f"https://images-api.nasa.gov/search?media_type=image&center=JPL&year_start={year}&year_end={year}"
    c = get(url)["collection"]
    pages = min(100, -(-int((c.get("metadata") or {}).get("total_hits") or 0) // 100))
    if pages > 1:
        c = get(url + f"&page={rng.randint(1, pages)}")["collection"]
    items = [i["data"][0] for i in c.get("items") or [] if i.get("data")]
    i = rng.choice([i for i in items if len(clean(i.get("description"))) >= 60 and i.get("title") not in avoid] or items)
    return {"name": clean(i["title"], 120), "fact": clean(i.get("description")),
            "link": "https://images.nasa.gov/details/" + urllib.parse.quote(i["nasa_id"])}


def invention(rng, avoid):
    req = urllib.request.Request("https://en.wikipedia.org/w/index.php?title=Timeline_of_historic_inventions&action=raw",
                                 headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=WAIT) as r:
        wiki = re.split(r"\n==\s*(?:See also|References|Notes|Further reading|External links)\s*==", r.read().decode("utf-8", "replace"))[0]
    rows = []
    for line in wiki.splitlines():
        links = re.findall(r"\[\[([^\]|#]+)", line) if line.startswith("*") else []
        links = [x for x in links if not re.match(r"(?:Lists? of|Timeline of|Outline of|Category:|File:|Image:|"
                                                   r"\d+(?: BC)?(?: in [\w ]+)?$)", x, re.I)]
        head = line.lstrip("* ").split(":", 1)[0] if ":" in line else ""
        dated = len(head) < 60 and re.search(r"\d|century|millennium", head, re.I)     # an entry starts with its date
        if links and dated:
            text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|\{\{[^{}]*\}\}|'''?", "", line.lstrip("* "))
            rows.append((clean(re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text), 170), links[0]))
    name, title = rng.choice([r for r in rows if r[0] not in avoid] or rows)
    return {"name": name, "fact": summary(title),
            "link": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))}


def listed(kind, network=True):
    def draw(rng, avoid):
        with open(SEEDS, encoding="utf-8") as fh:
            rows = json.load(fh)[kind]
        name, desc, where, title = rng.choice([r for r in rows if r[0] not in avoid] or rows)
        fact = (summary(title) if network else "") or ", ".join(x for x in (desc, where) if x)
        return {"name": name, "fact": fact, "link": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title)}
    return draw


FETCH = {"museum": museum, "nature": nature, "sky": sky, "invention": invention,
         "place": listed("place"), "custom": listed("custom")}


def draw(seed, n=3, avoid=()):
    """n seeds, each from another pool while there are pools left (the order shuffled by the seed); every one a dict
    with its pool, name, fact and link. Pools are asked together; one that fails or is slow gives way to a list."""
    rng = random.Random(int(hashlib.sha256(f"{seed}|dice".encode()).hexdigest(), 16))
    order = []
    while len(order) < n:
        order += rng.sample(list(POOLS), len(POOLS))
    order, avoid = order[:n], set(avoid)
    rngs = [random.Random(rng.random()) for _ in order]

    found = {}

    def one(i):
        try:
            s = FETCH[order[i]](rngs[i], avoid)
            if s.get("name"):
                found[i] = dict(s, pool=order[i])
        except Exception:
            pass
    if os.environ.get("CINECODE_DICE") != "offline":                # offline: the two lists alone (tests, no network)
        workers = [threading.Thread(target=one, args=(i,), daemon=True) for i in range(n)]
        for w in workers:
            w.start()
        end = time.monotonic() + DEADLINE
        for w in workers:
            w.join(max(0.0, end - time.monotonic()))
    got = [found.get(i) for i in range(n)]
    for i, s in enumerate(got):
        if s is None:
            used = {g["pool"] for g in got if g}
            kind = next((k for k in OFFLINE if k not in used), OFFLINE[i % 2])
            got[i] = dict(listed(kind, network=False)(rngs[i], avoid | {g["name"] for g in got if g}), pool=kind)
    return got


def films_path():
    return os.environ.get("CINECODE_FILMS") or os.path.join(os.path.expanduser("~"), ".cinecode", "films.json")


IDEA = re.compile(r"^\s*-\s*\*\*(?:Idea|Logline)\b[^*\n]*:\*\*\s*(.+)$", re.M | re.I)


def film_entry(folder):
    """A film's title, idea and medium from its own files, or None while it has no idea yet."""
    def text(name):
        try:
            with open(os.path.join(folder, name), encoding="utf-8", errors="replace") as fh:
                return fh.read()
        except OSError:
            return ""
    state = text("STATE.md")
    idea = next((m.group(1).strip() for name in ("STATE.md", "ROADMAP.md", "SCRIPT.md")
                 for m in IDEA.finditer(state if name == "STATE.md" else text(name))
                 if not m.group(1).strip().startswith("<")), "")
    if not idea:
        return None
    title = re.match(r"#\s*State:\s*(.+)", state)
    title = re.sub(r"\s*\((?:working title|Quick mode)\)\s*$", "", title.group(1)).strip() if title else ""
    medium = re.search(r"^\s*-\s*\*\*Medium:\*\*\s*([^<\s].*)$", state, re.M)
    try:
        at = datetime.date.fromtimestamp(os.path.getmtime(os.path.join(folder, "STATE.md"))).isoformat()
    except OSError:
        at = ""
    return {"title": title if title and not title.startswith("<") else os.path.basename(os.path.abspath(folder)),
            "idea": clean(idea, 400), "medium": clean(medium.group(1), 80) if medium else "", "at": at}


def load_films():
    try:
        with open(films_path(), encoding="utf-8") as fh:
            films = json.load(fh)
        return films if isinstance(films, dict) else {}
    except (OSError, ValueError):
        return {}


def save_films(films):
    """Written whole and renamed into place, so a chat reading it never sees half of it."""
    path = films_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.{threading.get_ident()}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(films, fh, ensure_ascii=False, indent=1)
    for _ in range(40):                  # Windows: a scanner or indexer may hold the file for a moment
        try:
            os.replace(tmp, path)
            return
        except PermissionError:
            time.sleep(0.05)
    os.replace(tmp, path)


def update_films(change):
    """One read, change and write of the memory at a time across chats: a lock file, given up after five seconds (then
    OSError), taken over when a stopped chat left it."""
    lock, end = films_path() + ".lock", time.monotonic() + 5
    os.makedirs(os.path.dirname(lock), exist_ok=True)
    while True:
        try:
            os.close(os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            break
        except (FileExistsError, PermissionError):     # Windows: a lock still being deleted refuses a new one
            try:
                if time.time() - os.path.getmtime(lock) > 30:
                    os.remove(lock)
                    continue
            except OSError:
                pass
            if time.monotonic() > end:
                raise OSError("the film memory is busy")
            time.sleep(0.05)
    try:
        if os.path.exists(films_path()):
            with open(films_path(), encoding="utf-8") as fh:
                films = json.load(fh)                # a memory it cannot read is left as it is, never written over
        else:
            films = {}
        change(films)
        save_films(films)
    except ValueError:
        raise OSError("the film memory cannot be read")
    finally:
        for _ in range(40):
            try:
                os.remove(lock)
                break
            except PermissionError:          # Windows: the next chat's open of the lock can hold it for a moment
                time.sleep(0.05)
            except OSError:
                break


def remember(folder="."):
    """Record this film in the memory (its idea as it stands now); quiet when it has none yet or the file is busy."""
    entry = film_entry(folder)
    if not entry:
        return False
    try:
        update_films(lambda films: films.__setitem__(os.path.abspath(folder), entry))
        return True
    except OSError:
        return False


def scan(root, depth=4):
    """Every film under a folder (a folder with a STATE.md and an idea), into the memory; how many were found."""
    films = {}
    for here, dirs, files in os.walk(os.path.abspath(root)):
        if "STATE.md" in files:
            entry = film_entry(here)
            if entry:
                films[here] = entry
            dirs[:] = []                                     # never a film inside a film
            continue
        if here[len(os.path.abspath(root)):].count(os.sep) >= depth:
            dirs[:] = []
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in INSIDE]
    update_films(lambda known: known.update(films))
    return len(films)


def past(project="."):
    """This user's other films: the memory, plus the films on this film's shelf it has not met yet; newest first."""
    here = os.path.abspath(project)
    films = load_films()
    shelf = os.path.dirname(here)
    try:
        names = os.listdir(shelf)
    except OSError:
        names = []
    for name in names:
        d = os.path.join(shelf, name)
        if d not in films and os.path.isfile(os.path.join(d, "STATE.md")):
            entry = film_entry(d)
            if entry:
                films[d] = entry
    same = lambda a: os.path.normcase(a) == os.path.normcase(here)
    return sorted((dict(v, folder=k) for k, v in films.items() if not same(k)), key=lambda f: f.get("at", ""),
                  reverse=True)


def write_past(project=".", out="research/past-films.md"):
    films = past(project)
    lines = [f"# This user's films ({len(films)})", "",
             "Each: title · idea · medium. A new idea that shares its subject, key images, worlds or form with one of "
             "these repeats a film this user already has.", ""]
    lines += [f"- {f['title']} · {f['idea']}" + (f" · {f['medium']}" if f.get("medium") else "") for f in films] or \
             ["- none yet"]
    path = os.path.join(project, out)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    return len(films)

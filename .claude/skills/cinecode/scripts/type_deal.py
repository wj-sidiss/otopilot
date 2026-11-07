#!/usr/bin/env python3
"""The 'type' bank for deal.py: pairings from type-library.json, filtered by purpose, look and Turkish coverage,
weighted by the user's taste log, dealt with a seeded weighted draw; specimen setup and taste records (stdlib).

Used through deal.py (deal / redeal / pick / taste type ...).

Taste log: every pick, pass and rejection of a pairing or font, with its families, tags and the user's one-line
reason. Stored in the project's history.json ("taste") and, when enabled, in a user-level file shared by every film
(CINECODE_TASTE or ~/.cinecode/taste.json), so the eye learns across projects.

Weighting (newest event first; d = 0.85 ** age, so recent judgements count most):
  start 1.0; x1.6 when the pairing's look families meet the film's look
  liked event:    same pairing x(1 + 0.5d) · each shared family x(1 + 0.25d) · each shared tag x(1 + 0.12d)
  rejected event: same pairing x(1 - 0.6d) · each shared family x(1 - 0.35d) · each shared tag x(1 - 0.15d)
  passed (dealt, another one picked): each shared tag x(1 - 0.03d)
  clamped to 0.05 .. 4, so nothing is ever impossible and nothing always wins; the user's own answer stays open.
Draw: Efraimidis-Spirakis keys u ** (1 / w) from the seeded RNG, highest keys win, at most one pairing per display
family. Hard filters: purpose; Turkish 'verified' (unless latin_only); pairings already picked in this project.
"""
import datetime
import hashlib
import json
import os
import random
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DECAY, CLAMP = 0.85, (0.05, 4.0)
LIKE = {"pairing": 0.5, "family": 0.25, "tag": 0.12}
REJECT = {"pairing": 0.6, "family": 0.35, "tag": 0.15}
PASS_TAG = 0.03
GENERIC = {"serif", "sans", "mono", "display", "grotesque", "text", "handmade"}   # too broad to report as a leaning
CUSTOM_STOPS = {"SOFT": [0, 50, 100], "WONK": [0, 1], "YEAR": [1979, 2015, 2050], "ELSH": [0, 50, 100],
                "XROT": [-45, 0, 45], "YROT": [-45, 0, 45], "BLED": [0, 50, 100], "SCAN": [-53, 0, 100]}


def find(name, *rel):
    for p in [os.path.join(HERE, name)] + [os.path.join(HERE, "..", r, name) for r in rel]:
        if os.path.exists(p):
            return os.path.normpath(p)
    return None


def library(path=None):
    p = path or find("type-library.json", "references")
    if not p:
        raise SystemExit("type-library.json not found next to deal.py or in ../references (pass --library)")
    lib = json.load(open(p, encoding="utf-8"))
    lib["_fonts"] = {f["id"]: f for f in lib["fonts"]}
    lib["_pairs"] = {x["id"]: x for x in lib["pairings"]}
    return lib


def user_taste_path():
    return os.environ.get("CINECODE_TASTE") or os.path.join(os.path.expanduser("~"), ".cinecode", "taste.json")


def taste_events(history, use_user):
    ev = list(history.get("taste", []))
    if use_user and os.path.exists(user_taste_path()):
        ev += json.load(open(user_taste_path(), encoding="utf-8")).get("taste", [])
    seen, out = set(), []
    for e in sorted(ev, key=lambda e: e.get("at", ""), reverse=True):
        k = (e.get("at"), e.get("id"), e.get("verdict"))
        if k not in seen:
            seen.add(k)
            out.append(e)
    return out


def families(lib, pid):
    p = lib["_pairs"].get(pid)
    if p:
        return list(dict.fromkeys(lib["_fonts"][x]["family"] for x in (p["display"], p.get("accent"), p["text"], p["mono"]) if x))
    f = lib["_fonts"].get(pid)
    return [f["family"]] if f else []


def tags_of(lib, pid):
    p = lib["_pairs"].get(pid)
    if p:
        return set(p["tags"])
    f = lib["_fonts"].get(pid)
    return set(f["tags"]) if f else set()


def weight(lib, p, events, look_fams):
    w = 1.6 if look_fams and set(p["looks"]) & set(look_fams) else 1.0
    fams, tags = set(families(lib, p["id"])), set(p["tags"])
    for age, e in enumerate(events):
        d = DECAY ** age
        ef, et = set(e.get("families", [])), set(e.get("tags", []))
        if e.get("verdict") == "like":
            w *= (1 + LIKE["pairing"] * d) if e.get("id") == p["id"] else 1
            w *= (1 + LIKE["family"] * d) ** len(fams & ef) * (1 + LIKE["tag"] * d) ** len(tags & et)
        elif e.get("verdict") == "reject":
            w *= (1 - REJECT["pairing"] * d) if e.get("id") == p["id"] else 1
            w *= (1 - REJECT["family"] * d) ** len(fams & ef) * (1 - REJECT["tag"] * d) ** len(tags & et)
        elif e.get("verdict") == "pass":
            w *= (1 - PASS_TAG * d) ** len(tags & et)
    return max(CLAMP[0], min(CLAMP[1], w))


def look_families(lib, look):
    if not look:
        return []
    if look in lib["look_families"]:
        return [look]
    if look in lib["look_map"]:
        return lib["look_map"][look]
    return lib["look_map"].get(recipe_base(look), [])   # a style-library recipe deals as its base look family


def house_fonts():
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from fonts import COMMON
        return COMMON
    except ImportError:
        return set()


def recipe_base(look):
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, "styles-index.json"), os.path.join(here, "..", "styles", "index.json"),
              os.path.join("tools", "styles-index.json")):
        try:
            with open(p, encoding="utf-8") as f:
                styles = json.load(f)["styles"]
        except (OSError, ValueError, KeyError):
            continue
        hit = next((st for st in styles if st.get("id") == look), None)
        if hit:
            return hit.get("base")
    return None


def local_ready(lib, p):
    """A local-file pairing can be dealt only when its font files are already in the film's fonts/ folder."""
    for k in ("display", "text", "mono", "accent"):
        fid = p.get(k)
        if fid and lib["_fonts"][fid]["load"]["method"] == "local":
            d = os.path.join("fonts", fid)
            if not (os.path.isdir(d) and any(f.lower().endswith((".woff2", ".woff", ".otf", ".ttf")) for f in os.listdir(d))):
                return False
    return True


# The film's tone in plain words (Turkish or English): (core tags, one of which a pairing must carry; supporting tags).
MOOD = {
    ("comedy", "komik", "cartoon", "çizgi", "goofy", "slapstick", "playful", "eğlenceli", "fun"):
        ({"playful", "friendly", "rounded"}, {"quirky", "loud", "handwriting"}),
    ("kids", "çocuk", "children", "toy", "oyuncak"): ({"friendly", "rounded", "playful"}, {"handmade"}),
    ("horror", "korku", "thriller", "gerilim", "dark", "karanlık", "occult"):
        ({"occult", "gothic", "degraded"}, {"dramatic", "brutal", "condensed"}),
    ("documentary", "belgesel", "history", "tarih", "news", "haber", "archive", "arşiv"):
        ({"documentary", "archival", "editorial"}, {"neutral", "literary", "transitional"}),
    ("luxury", "lüks", "premium", "fashion", "moda", "elegant", "zarif"):
        ({"luxurious", "fashion", "didone", "elegant"}, {"high-contrast", "serif"}),
    ("tech", "teknoloji", "saas", "app", "uygulama", "software", "yazılım", "future", "gelecek"):
        ({"technical", "code", "futuristic"}, {"geometric", "clean", "mono"}),
    ("retro", "nostalji", "nostalgic", "vintage", "eski"): ({"retro", "nostalgic", "antique"}, {"signage"}),
    ("fairy", "masal", "folk", "halk", "storybook", "fable", "efsane", "myth"):
        ({"folk", "handmade"}, {"warm", "script-accent", "old-style"}),
    ("sport", "spor", "energy", "enerji", "action", "aksiyon"): ({"sporty", "heavy"}, {"bold", "condensed", "loud"}),
    ("romance", "romantik", "poetic", "şiirsel", "love", "aşk", "quiet", "sakin"):
        ({"script", "quiet", "elegant"}, {"literary", "old-style"}),
}


def fold(text):
    """Case-fold for matching Turkish and English alike: İ, I and ı all become i (Python's lower() turns İ into
    i + a combining dot)."""
    return text.replace("İ", "i").lower().replace("ı", "i")


def mood_tags(mood):
    """(core, all) tag sets for the tone words; empty sets when no word is known."""
    words = {fold(w.strip(" ,.;")) for w in (mood or "").split()}
    hits = [v for keys, v in MOOD.items() if words & {fold(k) for k in keys}]
    core = set().union(*[c for c, _ in hits]) if hits else set()
    return core, core | (set().union(*[x for _, x in hits]) if hits else set())


def deal(lib, seed, n, purpose=None, look=None, latin_only=False, exclude=(), events=(), mixed=False, allow_local=False,
         mood=None):
    fams = look_families(lib, look)
    core, want = mood_tags(mood)
    pool = []
    for p in lib["pairings"]:
        if p["id"] in exclude or (p.get("card") == "mixed") != mixed:   # mixed cards are a separate deal
            continue
        if p["local_files"] and not allow_local and not local_ready(lib, p):
            continue                             # its files are not here yet: a card would fail to load
        if purpose and purpose != "any" and purpose not in p["purposes"]:
            continue
        if not latin_only and p["turkish"] != "verified":
            continue
        w = weight(lib, p, events, fams) * (1 + 1.5 * len(set(p["tags"]) & want))
        if any(p.get(k) in house_fonts() for k in ("display", "text", "accent")):
            w *= 0.15                            # a face AI designs overuse (fonts.py COMMON) comes rarely, never first
        pool.append((p, w))
    # The film's look and tone are not mere preferences: when enough pairings fit them, only those are dealt.
    tone = lambda q: bool(core and set(q[0]["tags"]) & core)
    look_fit = lambda q: bool(fams and set(q[0]["looks"]) & set(fams))
    for fits in ([q for q in pool if tone(q) and look_fit(q)],   # both first; then the tone alone; then the look
                 [q for q in pool if tone(q)], [q for q in pool if look_fit(q)]):
        if len({lib["_pairs"][q[0]["id"]]["display"] for q in fits}) >= n:
            pool = fits
            break
    rng = random.Random(int(hashlib.sha256(f"{seed}|type".encode()).hexdigest(), 16))
    keyed = sorted(((rng.random() ** (1 / w), p["id"], w) for p, w in pool), reverse=True)
    out, used = [], set()
    for _, pid, w in keyed:
        d = lib["_pairs"][pid]["display"]
        if d in used:
            continue
        used.add(d)
        out.append((pid, round(w, 2)))
        if len(out) == n:
            break
    return out, fams


def summary(lib, pid):
    p = lib["_pairs"][pid]
    fam = " + ".join(families(lib, pid)) + (" (mixed card: dominant + accent)" if p.get("card") == "mixed" else "")
    local = " · local files" if p["local_files"] else ""
    return f"{fam}{local}: {p['why']}"


def role(lib, fid, kind):
    f = lib["_fonts"][fid]
    ld = f["load"]
    if ld["method"] == "local":
        fname = os.path.basename(ld.get("file") or f"{f['family'].replace(' ', '')}-Regular.woff2")
        return {"family": f["family"], "files": {"400": f"fonts/{fid}/{fname}"}, "cap": (f.get("metrics") or {}).get("cap"),
                "_download": ld["where"] + (f" @ {ld['commit'][:10]}" if ld.get("commit") else ""), "_licence": f["licence"]["id"]}
    r = {"family": f["family"], "pkg": ld["pkg"], "version": ld["version"]}
    if f.get("metrics"):
        r["cap"] = f["metrics"]["cap"]          # cap height / em: sizes text from the phone minimum
    if len(ld["subsets"]) == 1:
        r["subsets"] = ld["subsets"]
    if "variable" in ld:
        r["variable"], r["varVersion"] = ld["variable"]["file"], ld["variable"]["version"]
        file_axes = {"full": set(f["axes"]), "standard": set(f["axes"]) & {"wght", "wdth", "opsz", "ital", "slnt"},
                     "wght": {"wght"}}.get(r["variable"], set(f["axes"]))
        r["axes"] = {k: v for k, v in f["axes"].items() if k in file_axes and k != "ital"}
        stops = [{k: v} for k in r["axes"] if k in CUSTOM_STOPS for v in CUSTOM_STOPS[k]]
        if stops:
            r["stops"] = stops
    else:
        want = {"display": [700, 800, 600, 400, 900], "text": [400, 600, 500, 700], "mono": [400, 500], "accent": [400, 700]}[kind]
        r["weights"] = sorted({w for w in want if w in ld["weights"]} or {ld["weights"][0]})[:3]
    if kind == "mono" and "tnum" in f["features"]:
        r["features"] = '"tnum"'
    return r


def specimens(lib, project, dealt, title=None, suffix=""):
    """type/specimens.json for the dealt pairings + the specimen page and runtime beside it."""
    d = os.path.join(project, "type")
    os.makedirs(d, exist_ok=True)
    pairs = []
    for pid, _ in dealt:
        p = lib["_pairs"][pid]
        roles = {k: (role(lib, p[k], k) if p.get(k) else None) for k in ("display", "text", "mono", "accent")}
        setup = p.get("setup") or {}
        for k, st in setup.items():             # the setup's weight must be loaded; italic accents load the italic files
            r = roles.get(k)
            if r and st.get("wght") and "weights" in r and st["wght"] not in r["weights"] and st["wght"] in lib["_fonts"][p[k]]["load"]["weights"]:
                r["weights"] = sorted(set(r["weights"]) | {st["wght"]})
            if r and st.get("italic") and "italic" in lib["_fonts"][p[k]]["load"].get("styles", []):
                r["styles"] = ["normal", "italic"]
        for k, st in setup.items():             # the pairing's tested axis values become stops of that role
            r = roles.get(k)
            extra = {a: v for a, v in (st.get("axes") or {}).items() if r and a in r.get("axes", {}) and a not in ("wght", "opsz", "wdth")}
            if extra:
                r["stops"] = (r.get("stops") or []) + [extra]
        pairs.append({"id": pid, "why": p["why"], "setup": setup, "card": p.get("card"), "roles": {k: v for k, v in roles.items() if v or k != "accent"}})
    spec = {"title": title, "pairings": pairs}
    json.dump(spec, open(os.path.join(d, f"specimens{'-' + suffix if suffix else ''}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for name, rel, dst in (("type-specimen.html", "templates", "specimen.html"), ("type.mjs", "starter", "type.mjs")):
        src = find(name, rel)
        if src and not os.path.exists(os.path.join(d, dst)):
            shutil.copy2(src, os.path.join(d, dst))
    return d, pairs


def record(history, use_user, lib, pid, verdict, reason, project, extra=None):
    e = {"at": datetime.datetime.now().isoformat(timespec="seconds"), "project": os.path.basename(os.path.abspath(project)),
         "kind": "pairing" if pid in lib["_pairs"] else "font", "id": pid, "verdict": verdict,
         "families": families(lib, pid), "tags": sorted(tags_of(lib, pid)), "reason": reason}
    if extra:
        e.update({k: v for k, v in extra.items() if v})
    return store(history, use_user, e)


def store(history, use_user, e):
    history.setdefault("taste", []).append(e)
    if use_user:
        p = user_taste_path()
        os.makedirs(os.path.dirname(p), exist_ok=True)
        u = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"taste": []}
        u["taste"].append(e)
        json.dump(u, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return e


def leanings(events, top=4):
    """Tags the taste log currently favours and avoids (for the deal printout and the plan)."""
    score = {}
    for age, e in enumerate(events):
        s = {"like": 1, "reject": -1, "pass": -0.2}.get(e.get("verdict"), 0) * DECAY ** age
        for t in e.get("tags", []):
            if t not in GENERIC:
                score[t] = score.get(t, 0) + s
    ranked = sorted(score.items(), key=lambda kv: kv[1])
    return [t for t, v in ranked[::-1][:top] if v > 0], [t for t, v in ranked[:top] if v < 0]


# ---------------------------------------------------------------- deal.py <cmd> type …
def add_args(ap):
    ap.add_argument("--purpose", help="type: cinematic | ad | any (default: any)")
    ap.add_argument("--look", help="type: the film's look or recipe id, or a look family (favours matching pairings)")
    ap.add_argument("--mood", help='type: the film\'s tone in plain words, e.g. "komik çizgi film", "horror", "belgesel", "luxury"')
    ap.add_argument("--latin-only", action="store_true", help="type: allow pairings without verified Turkish")
    ap.add_argument("--title", help="type deal: the film's own headline, as it stands on screen (required)")
    ap.add_argument("--sub", help="type deal: the film's second line, if it has one")
    ap.add_argument("--cta", help="type deal (ad): the film's call to action, if it has one")
    ap.add_argument("--still", help="type deal: a still of the film (relative to type/), the cards sit on it")
    ap.add_argument("--families", help="pick type own: the user's own families, e.g. 'Brand Sans + Newsreader'")
    ap.add_argument("--verdict", choices=["like", "reject"], help="taste: the user's verdict")
    ap.add_argument("--library", help="type: path to type-library.json")
    ap.add_argument("--user-taste", action="store_true", help="type: also read and write the user-level taste file")
    ap.add_argument("--mixed", action="store_true", help="type: deal mixed-style pairings (dominant + script/italic accent) for title, CTA, cover and end cards")
    ap.add_argument("--allow-local", action="store_true", help="type: also deal pairings whose font files are not in fonts/ yet (the user downloads them first)")


def run(a, h, path, base_seed, save, one_line, user_default=False, capture="node tools/capture.mjs"):
    """deal / redeal / pick / taste for the 'type' category; deal.py hands over after parsing."""
    lib = library(a.library)
    use_user = user_default or a.user_taste or bool(os.environ.get("CINECODE_TASTE")) or os.path.exists(user_taste_path())
    events = taste_events(h, use_user)
    now = lambda: datetime.datetime.now().isoformat(timespec="minutes")
    cat = "type-mixed" if a.mixed else "type"
    hands = [d for d in h["deals"] if d["category"] == cat]
    hand = hands[-1] if hands and hands[-1]["pick"] is None else None
    rnd = len(hands) + 1

    def show(d):
        print(f"{cat} · seed {d['seed']}" + (f" · re-deal: {d['redeal_reason']}" if d.get("redeal_reason") else ""))
        for i, k in enumerate(d["dealt"], 1):
            print(f"  {i}. {k}: {summary(lib, k)}")
        print(f'pick one from this film\'s facts: deal.py pick type <id>{" --mixed" if a.mixed else ""} --reason "…"')

    def fresh(seed, extra_out=(), reason=None):
        picked = {d["pick"] for d in hands if d["pick"]}
        got, fams = deal(lib, seed, a.n, a.purpose, a.look, a.latin_only, picked | set(extra_out), events, a.mixed,
                         getattr(a, "allow_local", False), getattr(a, "mood", None))
        d = {"category": cat, "seed": seed, "dealt": [p for p, _ in got], "weights": dict(got), "look_families": fams,
             "filters": {"purpose": a.purpose, "look": a.look, "mood": getattr(a, "mood", None), "latin_only": a.latin_only},
             "redeal_reason": reason, "pick": None, "reason": None, "at": now()}
        h["deals"].append(d)
        save(path, h)
        show(d)
        cards(d)

    def cards(d):
        folder, pairs = specimens(lib, a.project, [(x, 0) for x in d["dealt"]], a.title, "mixed" if a.mixed else "")
        likes, avoids = leanings(events)
        if likes or avoids:
            print(f"taste so far: leans to {', '.join(likes) or '-'}; away from {', '.join(avoids) or '-'}")
        sj = "specimens-mixed.json" if a.mixed else "specimens.json"
        from urllib.parse import quote
        words = "".join(f"&{k}={quote(v)}" for k, v in (("title", a.title), ("sub", a.sub), ("cta", a.cta), ("still", a.still)) if v)
        if not a.title:
            print("specimen cards show the film's own words: deal again with --title \"<the headline as it stands on "
                  "screen>\" (and --sub, --cta for an ad, --still for a frame); without them no cards are made")
            pairs = []
        else:
            print(f"specimens: {folder}/{sj} (one card per pairing; the film's palette goes in --params):")
        for i, p in enumerate(pairs):
            need = [r["_download"] for r in p["roles"].values() if r and "_download" in r]
            print(f"  {capture} --url type/specimen.html --frames 0 --format jpeg --out review/type{'-mixed' if a.mixed else ''}-{i + 1} "
                  f"--params \"i={i}{'&spec=' + sj if a.mixed else ''}&w=1080&h=1920&purpose={a.purpose or 'cinematic'}{words}&bg=…&ink=…&accent=…\""
                  + (f"   (local files first: {', '.join(need)})" if need else ""))
        print('or the user\'s own: deal.py pick type own --families "…" --reason "…"')

    if a.cmd == "taste":
        if not a.choice or not a.verdict:
            sys.exit('usage: deal.py taste type <pairing or font id> --verdict like|reject --reason "…"')
        if a.choice not in lib["_pairs"] and a.choice not in lib["_fonts"]:
            sys.exit(f"unknown pairing or font: {a.choice}")
        e = record(h, use_user, lib, a.choice, a.verdict, one_line(a.reason), a.project)
        save(path, h)
        print(f"taste: {e['verdict']} {e['id']} ({', '.join(e['families'])}): {e['reason']}")
    elif a.cmd == "deal":
        context = {"purpose": a.purpose, "look": a.look, "mood": getattr(a, "mood", None), "latin_only": a.latin_only}
        if hand and (hand.get("filters") or {}) == context:
            print('a hand is already open (a new one needs: redeal --reason "…")')
            show(hand)
            if a.title:                            # the same hand, now on the film's own words
                cards(hand)
            return
        if hand:                                   # new context (a look, a purpose): a fresh hand, no taste recorded
            hand["pick"], hand["reason"] = "(context changed)", "dealt again with " + ", ".join(
                f"{k} {v}" for k, v in context.items() if v and v != (hand.get("filters") or {}).get(k))
        fresh(f"{base_seed}#{rnd}")
    elif a.cmd == "redeal":
        reason = one_line(a.reason)
        if not hand:
            sys.exit("no open hand: use deal")
        hand["pick"], hand["reason"] = "(re-dealt)", reason
        for pid in hand["dealt"]:
            record(h, use_user, lib, pid, "reject", reason, a.project, {"look": a.look, "purpose": a.purpose})
        events[:0] = taste_events({"taste": h["taste"][-len(hand["dealt"]):]}, False)
        shown = set()
        for d in reversed(hands):
            if d["pick"] != "(re-dealt)":
                break
            shown |= set(d["dealt"])
        fresh(f"{base_seed}#{rnd}", extra_out=shown, reason=reason)
    elif a.cmd == "pick":
        reason = one_line(a.reason)
        if not hand:
            sys.exit("no open hand: use deal first")
        if a.choice not in hand["dealt"] and a.choice != "own":
            sys.exit(f"pick one of: {', '.join(hand['dealt'])} (or 'own' for the user's own answer)")
        hand["pick"], hand["reason"] = a.choice, reason
        for pid in hand["dealt"]:
            record(h, use_user, lib, pid, "like" if pid == a.choice else "pass", reason, a.project,
                   {"look": a.look, "purpose": a.purpose} if pid == a.choice else None)
        if a.choice == "own":
            store(h, use_user, {"at": datetime.datetime.now().isoformat(timespec="seconds"),
                                "project": os.path.basename(os.path.abspath(a.project)), "kind": "own", "id": "own",
                                "verdict": "like", "families": [x.strip() for x in (a.families or "").split("+") if x.strip()],
                                "tags": [], "reason": reason})
        save(path, h)
        print(f"logged: {cat} = {a.choice}: {reason}" + (" (taste log: project + user)" if use_user else " (taste log: project)"))

#!/usr/bin/env python3
"""A deck of camera moves, shot sizes and transitions for one film, drawn at random (Python 3 standard library only).

Habit makes every film open on the same push-in and close on the same dissolve. The deck is a draw weighted by the
film's tempo, with no move, size or transition repeated on neighbouring shots, each big move at most once, and the
moves this machine's last films opened or signed with pushed back. It is a starting hand for the director card's
Camera and Transitions lines, not a rule: keep what serves each beat, swap the rest with a reason.

  python3 tools/moves.py deal --shots 6 --tempo standard --seed "<the idea>"
  python3 tools/moves.py recent                  # what the last films used
  python3 tools/moves.py form "<the brief>" --seconds 25   # one continuous shot or cuts, with the reasons

The vocabulary is references/camera-moves.md; each name there has its build (CAM, plane(), retime(), the scene's `in`).
Memory: ~/.cinecode/shown-moves.json (CINECODE_SHOWN_MOVES sets another path), one entry per film folder.
"""
import argparse
import hashlib
import json
import os
import random
import sys

MOVES = {   # move: (energetic, standard, contemplative) weight
    "dolly in": (2, 3, 3), "dolly out": (1, 2, 3), "push-in on detail": (3, 3, 2), "pull-back reveal": (2, 3, 3),
    "truck with the subject": (3, 3, 1), "orbit": (3, 2, 1), "crane up": (1, 2, 3), "crane down": (1, 2, 2),
    "pan": (2, 2, 2), "tilt": (1, 2, 2), "zoom in": (2, 1, 1), "FPV fly-through": (3, 1, 0),
    "handheld drift": (2, 1, 1), "locked-off hold": (1, 2, 4), "rack focus": (1, 2, 3), "focus pull": (1, 2, 2),
}
BIG = {"dolly zoom": (1, 1, 1), "speed ramp": (3, 2, 1), "freeze frame": (2, 2, 1), "time-lapse": (1, 2, 2)}
CUTS = {   # transition into the shot
    "hard cut": (4, 5, 3), "match cut": (2, 3, 3), "whip pan": (3, 1, 0), "cross dissolve": (0, 1, 3),
    "iris": (1, 1, 1), "wipe": (1, 1, 0), "smash cut": (2, 1, 1), "J-cut (sound first)": (1, 2, 2),
    "L-cut (sound carries over)": (1, 2, 2),
}
ONCE = {"smash cut", "iris", "wipe"}
SIZES = ["wide", "medium", "close", "extreme close", "macro"]
SPEED = {"energetic": ["fast", "medium"], "standard": ["medium", "slow"], "contemplative": ["slow", "very slow"]}
TEMPO = {"energetic": 0, "enerjik": 0, "tempolu": 0, "standard": 1, "standart": 1, "contemplative": 2, "sakin": 2}


def memory_path():
    return os.environ.get("CINECODE_SHOWN_MOVES") or os.path.join(os.path.expanduser("~"), ".cinecode", "shown-moves.json")


def memory():
    try:
        return json.load(open(memory_path(), encoding="utf-8")).get("films", {})
    except (OSError, ValueError):
        return {}


def remember(film, deck):
    films = memory()
    films.pop(film, None)
    films[film] = {"opener": deck[0]["move"], "signature": deck_signature(deck),
                   "big": [d["big"] for d in deck if d.get("big")]}
    films = dict(list(films.items())[-12:])
    os.makedirs(os.path.dirname(memory_path()), exist_ok=True)
    json.dump({"films": films}, open(memory_path(), "w", encoding="utf-8"), ensure_ascii=False)


def deck_signature(deck):
    counts = {}
    for d in deck:
        counts[d["move"]] = counts.get(d["move"], 0) + 1
    return max(counts, key=lambda m: (counts[m], m != "locked-off hold"))


def pick(rng, table, col, avoid=(), lately=()):
    names = [n for n in table if n not in avoid and table[n][col] > 0]
    weights = [table[n][col] * (0.3 if n in lately else 1) for n in names]
    return rng.choices(names, weights)[0]


def deal(shots, tempo, seed, lately):
    col = TEMPO.get(tempo.lower(), 1)
    rng = random.Random(int(hashlib.sha256(f"{seed}|{shots}|{tempo}|{sorted(lately)}".encode()).hexdigest(), 16))
    deck, used_once, big_at = [], set(), None
    if shots >= 4:                                 # one big move, near the turn (60-75 % of the film)
        big_at = min(shots - 1, max(1, round(shots * rng.uniform(0.55, 0.75))))
    for i in range(shots):
        prev = deck[-1] if deck else {}
        move = pick(rng, MOVES, col, avoid={prev.get("move")}, lately=lately if i == 0 else ())
        size = rng.choice([s for s in SIZES if s != prev.get("size")])
        cut = None if i == 0 else pick(rng, CUTS, col, avoid={prev.get("cut")} | used_once)
        if cut in ONCE:
            used_once.add(cut)
        d = {"shot": i + 1, "size": size, "move": move, "speed": rng.choice(SPEED.get(tempo.lower(), SPEED["standard"])),
             "cut": cut}
        if i == big_at:
            d["big"] = pick(rng, BIG, col)
        deck.append(d)
    return deck


def cmd_deal(a):
    films = memory()
    here = os.path.abspath(a.film or os.getcwd())
    lately = {f[k] for name, f in films.items() if name != here for k in ("opener", "signature") if f.get(k)}
    deck = deal(a.shots, a.tempo, a.seed or here, lately)
    print(f"deck ({a.tempo}, {a.shots} shots; a draw, not a rule: keep what serves each beat, swap the rest with a reason)")
    for d in deck:
        into = "opening, moving from frame 0" if d["cut"] is None else f"in: {d['cut']}"
        big = f" · BIG: {d['big']} (once in the film)" if d.get("big") else ""
        print(f"  {d['shot']}. {d['size']} · {d['move']}, {d['speed']} · {into}{big}")
    print(f"signature candidate: {deck_signature(deck)} (returns, changed, at the hook, the turn and the payoff)")
    if lately:
        print(f"(pushed back, the last films opened or signed with them: {', '.join(sorted(lately))})")
    if not a.dry:
        remember(here, deck)


# The form of the film: one continuous shot (the camera travels one world) or a cut film (shots joined by cuts).
ONE_SHOT = ["tek plan", "tek çekim", "tek kare", "kesintisiz", "kesme yok", "kesmeden", "one shot", "one-shot", "oner",
            "single take", "single shot", "long take", "continuous", "unbroken", "no cuts", "drone", "dron", "takip ed",
            "follows", "following", "tracking", "track the", "fly through", "flies through", "flying through", "uçarak",
            "içinden geç", "travels through", "travelling through", "journey", "yolculuk", "grows into", "grow into",
            "shrink", "küçül", "büyüyerek", "yaklaş", "uzaklaş", "approach", "pull back", "pulls back", "zoom into",
            "zooms into", "push through", "close pass", "sweeping", "sweeps", "passes by", "yanından geç", "orbit",
            "etrafında dön", "around the product", "360", "reveal", "açılarak", "from far", "uzaktan"]
CUTS_WORDS = ["özellik", "features", "feature list", "reasons", "neden", "steps", "adım adım", "tutorial", "montage",
              "montaj", "kolaj", "collage", "farklı mekan", "locations", "cities", "şehirler", "before and after",
              "önce ve sonra", "testimonial", "röportaj", "interview", "anlatıcı", "narrator", "explainer", "açıklayıcı",
              "hızlı kurgu", "fast cuts", "quick cuts", "tiktok", "reels", "shorts", "music video", "klip", "beat",
              "chapters", "bölüm", "documentary", "belgesel", "timeline", "tarihçe"]


def form(brief, seconds=0):
    """(form, reasons): 'one shot', 'cuts', or 'one shot with hidden cuts' for a long continuous journey."""
    text = " " + brief.lower().replace("İ", "i") + " "
    one = [w for w in ONE_SHOT if w in text]
    cuts = [w for w in CUTS_WORDS if w in text]
    score = len(one) - len(cuts)
    if seconds and seconds <= 40:
        score += 0.5                                  # a short film can be one move
    if seconds > 90:
        score -= 1                                    # a long one rarely holds a single unbroken move
    if score >= 1.5:
        kind = "one shot with hidden cuts" if seconds > 60 else "one shot"
    elif score <= -1:
        kind = "cuts"
    else:
        kind = "either"
    return kind, one, cuts


def cmd_form(a):
    kind, one, cuts = form(a.brief, a.seconds)
    why = []
    if one:
        why.append("a continuous journey in the brief: " + ", ".join(f'"{w}"' for w in one[:6]))
    if cuts:
        why.append("pieces the brief lists or explains: " + ", ".join(f'"{w}"' for w in cuts[:6]))
    print(f"form: {'★ ' if kind != 'either' else ''}{kind}" + (f" ({'; '.join(why)})" if why else ""))
    if kind.startswith("one shot"):
        print("  the camera travels one world built once: CAM.path keys through the beats, the subject moving, foreground "
              "planes wiping past; no cut (references/camera-moves.md, One continuous shot)"
              + ("; past about 60 s, hide the joins inside the move (a whip, a pass behind a foreground object, a "
                 "push through a surface)" if kind.endswith("cuts") else ""))
    elif kind == "cuts":
        print("  shots joined by cuts, each a new picture; the deck: moves.py deal --shots N")
    else:
        print("  no clear sign either way: decide on the card. One shot when the film is one place, one subject and a "
              "change of scale or a reveal; cuts when it lists, explains or travels between places")


def cmd_recent(a):
    for name, f in memory().items():
        print(f"{os.path.basename(name)}: opener {f.get('opener')} · signature {f.get('signature')} · big {', '.join(f.get('big') or []) or '-'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("deal", help="draw a deck for this film")
    p.add_argument("--shots", type=int, required=True)
    p.add_argument("--tempo", default="standard", help="energetic · standard · contemplative (the card's tempo)")
    p.add_argument("--seed", help="the idea in a few words (the same idea and memory give the same deck)")
    p.add_argument("--film", help="the film folder (default: here)")
    p.add_argument("--dry", action="store_true", help="do not remember this deck")
    p.set_defaults(fn=cmd_deal)
    sub.add_parser("recent", help="what the last films opened and signed with").set_defaults(fn=cmd_recent)
    f = sub.add_parser("form", help="one continuous shot or cuts, from the brief")
    f.add_argument("brief")
    f.add_argument("--seconds", type=float, default=0)
    f.set_defaults(fn=cmd_form)
    a = ap.parse_args()
    if getattr(a, "shots", 1) < 1:
        ap.error("--shots must be 1 or more")
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())

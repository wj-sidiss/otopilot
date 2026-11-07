#!/usr/bin/env python3
"""Check a shots.json against the cinecode film rules (Python 3 standard library only).

Usage: python3 validate_shots.py shots.json
Exit code 1 on errors. Warnings do not fail; give each one a reason in STATE.md or fix it.

Checks
  structure   required fields, unique ids, integer frames, contiguous timing, duration_frames matches
  hook        the first shot starts at frame 0 and moves from frame 1: camera.move.moving_at_start is true
              or "action_from_frame_1" is true (hard rule)
  shots       shot count for the length: an average shot of 4-12 s, at least 4 (warning outside;
              references/craft.md §0), every shot has at least one read that fits it
  action      every shot names its subject's action in "action" (what the subject does; a camera move alone is
              not a scene) (error); a moving camera needs its camera line (error), shaped 'name, seconds, easing, target' (warning)
  rhythm      shot lengths not too even (spread >= 0.30), no run of 5+ alike, acts or chapters at different paces
  framing     no repeated framing (location + size + lens) unless "motif": true
  text        on-screen text <= 6 words per card, on screen >= 0.6 s + 0.25 s per word
  words       narration ("vo" per shot): <= 9 words per line; total <= runtime_s * 4/3 (30 s -> 40, 60 s -> 80)
  camera      every moving shot has a camera line in camera.move.line: "name, seconds, speed easing, target"
              with a name from references/camera-moves.md (warning)
"""
import json
import os
import re
import sys

REQUIRED_TOP = ["title", "fps", "width", "height", "shots"]
REQUIRED_SHOT = ["id", "start", "end", "description", "reads", "camera"]
TEXT_MAX_WORDS = 6
MOVE_NAMES = ("pan", "tilt", "dolly in", "dolly out", "dolly zoom", "vertigo", "zoom in", "zoom out", "tracking", "truck",
              "orbit", "arc", "crane", "pedestal", "push-in", "pull-back", "fpv", "fly-through", "handheld", "slow motion",
              "speed ramp", "time-lapse", "freeze frame", "rack focus", "focus pull", "locked")
LINE_MAX_WORDS = 9


def camera_move(shot):
    """The shot's camera move as a dict, whether written as an object, a move object or a bare camera line."""
    cam = shot.get("camera") or {}
    cam = cam if isinstance(cam, dict) else {"move": str(cam)}
    move = cam.get("move") or {}
    if isinstance(move, str):
        move = {"line": move, "type": "locked" if move.strip().lower().startswith("locked") else "move"}
    return move if isinstance(move, dict) else {}


def rhythm(shots, fps, warn):
    """Tempo must move: shot lengths that are all alike, or acts that keep one pace, read as monotony."""
    d = [((s.get("end") or 0) - (s.get("start") or 0)) / fps for s in shots if isinstance(s.get("end"), int)]
    if len(d) >= 12:
        mean = sum(d) / len(d)
        cv = (sum((x - mean) ** 2 for x in d) / len(d)) ** 0.5 / mean if mean else 0
        if cv < 0.3:
            warn(f"shot lengths are too even (spread {cv:.2f}, under 0.30): vary them with the beat types "
                 f"(craft.md §3), short runs against long holds")
        run, best = 1, (1, 0)
        for i in range(1, len(d)):
            run = run + 1 if abs(d[i] - d[i - 1]) <= 0.15 * max(d[i], d[i - 1]) else 1
            best = max(best, (run, i))
        if best[0] >= 5:
            first = shots[best[1] - best[0] + 1].get("id"); last = shots[best[1]].get("id")
            warn(f"{first}..{last}: {best[0]} shots in a row of about the same length; break the run (a quick run, a long hold)")
    groups = {}
    for s in shots:
        key = s.get("act") or s.get("chapter") or s.get("section")
        if key and isinstance(s.get("end"), int):
            groups.setdefault(key, []).append((s["end"] - s["start"]) / fps)
    if len(groups) >= 3:
        avg = {k: sum(v) / len(v) for k, v in groups.items()}
        if max(avg.values()) <= 1.25 * min(avg.values()):
            warn("every act or chapter keeps the same pace (average shot within 25 %); let the tempo rise and fall "
                 "with the story (a faster act toward the turn, a held one after it)")


def main(path):
    try:
        with open(path, encoding="utf-8") as f:
            film = json.load(f)
    except ValueError as e:
        sys.exit(f"FAILED: {path} is not valid JSON ({getattr(e, 'msg', e)})")
    if not isinstance(film, dict) or not isinstance(film.get("shots", []), list):
        sys.exit(f"FAILED: {path} holds an object with \"shots\": a list of shot objects (templates/shots.example.json)")
    shape = []
    for i, s in enumerate(film.get("shots") or []):
        if not isinstance(s, dict):
            shape.append(f"shot {i + 1} is {type(s).__name__}, not an object")
            continue
        for key, kind in (("reads", "{read, t}"), ("text_on_screen", "{text, t}")):
            items = s.get(key) or []
            if not isinstance(items, list) or not all(isinstance(x, dict) for x in items):
                shape.append(f"{s.get('id', i + 1)}: '{key}' is a list of objects {kind}")
        if not isinstance(s.get("camera") or {}, (dict, str)):          # a bare line ("locked, 6 s") is a move
            shape.append(f"{s.get('id', i + 1)}: 'camera' is an object or a line")
    track = film.get("text_on_screen") or []
    if not isinstance(track, list) or not all(isinstance(x, dict) for x in track):
        shape.append("film: 'text_on_screen' is a list of objects {text, t: [start, end] in film seconds}")
    if shape:
        sys.exit("FAILED: shots.json is not in the kit's shape (templates/shots.example.json):\n  " + "\n  ".join(shape[:8]))
    errors, warnings = [], []
    err, warn = errors.append, warnings.append

    for k in REQUIRED_TOP:
        if k not in film:
            err(f"top level: missing '{k}'")
    try:                                         # the film's words: a dash is an error, a generated-sounding tell a warning
        sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
        import words_check
        dashes, tells = words_check.check(words_check.json_words(path))
        for where, s in dashes:
            err(f"{where}: a dash in '{s[:50]}' (never in the film's words: a comma, a full stop, a colon or a line break)")
        for where, s, label in tells[:6]:
            warn(f"{where}: '{s[:50]}' reads as generated ({label}); rewrite it, or keep it with a reason")
    except ImportError:
        pass
    shots = film.get("shots") or []
    if not shots:
        err("no shots")
        return report(film, errors, warnings)
    fps = float(film.get("fps", 24))
    runtime_s = (shots[-1].get("end") or 0) / fps
    roadmap = os.path.join(os.path.dirname(os.path.abspath(path)), "ROADMAP.md")
    if runtime_s >= 300:
        text = open(roadmap, encoding="utf-8").read() if os.path.isfile(roadmap) else ""
        at = text.find("Curiosity map")
        rows = [l for l in text[at:].splitlines()[1:40] if l.startswith("|") and "---" not in l and "<" not in l
                and not l.lower().startswith("| question")] if at >= 0 else []
        if len(rows) < 3:
            err(f"a {runtime_s / 60:.0f}-minute film needs its curiosity map in ROADMAP.md (references/writing.md §13): at "
                "least three questions, each with the second it opens and the second it is paid")

    ids = [s.get("id") for s in shots]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        err(f"duplicate shot id {dup}")
    runtime = (shots[-1].get("end") or 0) / fps
    lo, hi = max(4, round(runtime / 12)), max(8, round(runtime / 4))
    if runtime and not lo <= len(shots) <= hi:
        warn(f"{len(shots)} shots for {runtime:.0f} s (average {runtime / len(shots):.1f} s); about {lo}-{hi} fit this length "
             f"(an average of 4-12 s, references/craft.md §0)")
    rhythm(shots, fps, warn)

    framings, prev_end, vo_words = {}, None, 0
    for n, s in enumerate(shots):
        sid = s.get("id", f"#{n + 1}")
        for k in REQUIRED_SHOT:
            if k not in s:
                err(f"{sid}: missing '{k}'")
        start, end = s.get("start"), s.get("end")
        if not isinstance(start, int) or not isinstance(end, int) or end <= start:
            err(f"{sid}: start/end must be integer frames with end > start")
            continue
        dur = (end - start) / fps
        if prev_end is None and start != 0:
            err(f"{sid}: the first shot must start at frame 0")
        if prev_end is not None and start != prev_end:
            err(f"{sid}: {'gap' if start > prev_end else 'overlap'} with the previous shot (ends {prev_end}, starts {start})")
        prev_end = end

        if not str(s.get("action") or "").strip():
            err(f"{sid}: no 'action': name what the subject does in this shot (one action; the camera move is not it)")

        cam = s.get("camera") if isinstance(s.get("camera"), dict) else {}
        move = camera_move(s)
        line = str(move.get("line") or "").strip().lower()
        if move.get("type") not in (None, "locked"):
            secs = re.search(r"(\d+(?:\.\d+)?)\s*s\b", line)
            if not line:
                err(f"{sid}: no camera line: add camera.move.line, e.g. \"dolly in, 3 s, slow ease-in-out, toward the figure\"")
            elif not line.startswith(MOVE_NAMES) or not secs:
                warn(f"{sid}: camera line '{line[:50]}' should read 'name, seconds, speed easing, target' (names: camera-moves.md)")
            elif float(secs.group(1)) > dur + 0.5:
                warn(f"{sid}: camera line lasts {secs.group(1)} s but the shot is {dur:.1f} s")
        if n == 0 and not (move.get("moving_at_start") is True or s.get("action_from_frame_1") is True):
            err(f"{sid}: HOOK RULE: the first shot must move from frame 1 "
                "(camera.move.moving_at_start: true, or action_from_frame_1: true)")
        elif n == 0 and s.get("action_from_frame_1") is not True:
            warn(f"{sid}: lead the hook with an action: the subject acts from frame 1 (action_from_frame_1: true)")
        if n == 0 and dur < 2.0 and len(shots) > 1:
            nxt = shots[1]
            nmove = camera_move(nxt)
            if not (nmove.get("moving_at_start") or nxt.get("action_from_frame_1")):
                warn(f"{nxt.get('id')}: falls inside the first 2 s; keep the motion going (moving_at_start or action_from_frame_1)")

        reads = s.get("reads") or []
        if not reads:
            err(f"{sid}: no reads (what must the viewer understand here?)")
        for r in reads:
            t = r.get("t") or [None, None]
            if t[0] is None or t[1] is None or t[1] <= t[0] or t[0] < -1e-6 or t[1] > dur + 1e-6:
                err(f"{sid}: read '{str(r.get('read', ''))[:40]}' window {t} is invalid or outside 0-{dur:.2f} s")
            elif t[1] - t[0] < 0.5:
                warn(f"{sid}: read '{str(r.get('read', ''))[:40]}' gets only {t[1] - t[0]:.2f} s")

        key = "|".join(str(x) for x in (s.get("location"), cam.get("size"), cam.get("lens_mm")))
        if key in framings and not (s.get("motif") and framings[key].get("motif")):
            err(f"{sid}: repeats the framing of {framings[key].get('id')} [{key}]; change size or lens, or mark both motif: true")
        framings.setdefault(key, s)

        for tx in s.get("text_on_screen") or []:
            words = len(str(tx.get("text", "")).split())
            t = tx.get("t") or [0, 0]
            if isinstance(t, str):                     # "0.4-3.0" written as text
                t = [float(x) for x in __import__("re").findall(r"\d+(?:\.\d+)?", t)][:2] or [0, 0]
            t = [float(x) for x in t] if len(t) == 2 and all(isinstance(x, (int, float, str)) for x in t) else [0, 0]
            need = 0.6 + 0.25 * words
            if words > TEXT_MAX_WORDS:
                err(f"{sid}: on-screen text '{tx.get('text')}' has {words} words (max {TEXT_MAX_WORDS})")
            if t[0] < -1e-6 or t[1] > dur + 1e-6 or t[1] <= t[0]:
                err(f"{sid}: on-screen text '{tx.get('text')}' window {t} is invalid or outside 0-{dur:.2f} s")
            elif t[1] - t[0] + 1e-6 < need:
                err(f"{sid}: on-screen text '{tx.get('text')}' is shown {t[1] - t[0]:.2f} s, needs {need:.2f} s")

        vo = s.get("vo")
        for line in ([vo] if isinstance(vo, str) else vo or []):  # one line, or a list of lines
            line = line.get("text", "") if isinstance(line, dict) else str(line)
            w = len(line.split())
            vo_words += w
            if w > LINE_MAX_WORDS:
                err(f"{sid}: narration line has {w} words (max {LINE_MAX_WORDS}): '{line}'")

    total = prev_end or 0
    for tx in film.get("text_on_screen") or []:      # the film's own text track: words that span beats (a one-shot film)
        words = len(str(tx.get("text", "")).split())
        t = tx.get("t") or [0, 0]
        t = [float(x) for x in t] if isinstance(t, list) and len(t) == 2 and all(isinstance(x, (int, float)) for x in t) else [0, 0]
        need = 0.6 + 0.25 * words
        if words > TEXT_MAX_WORDS:
            err(f"film text '{tx.get('text')}' has {words} words (max {TEXT_MAX_WORDS})")
        if t[0] < -1e-6 or t[1] > total / fps + 1e-6 or t[1] <= t[0]:
            err(f"film text '{tx.get('text')}' window {t} is invalid or outside 0-{total / fps:.2f} s")
        elif t[1] - t[0] + 1e-6 < need:
            err(f"film text '{tx.get('text')}' is shown {t[1] - t[0]:.2f} s, needs {need:.2f} s")
    if "duration_frames" in film and film["duration_frames"] != total:
        err(f"duration_frames is {film['duration_frames']} but the shots end at frame {total}")
    secs = total / fps
    if secs <= 180:                                  # short films: room to breathe, about 80 words a minute
        budget = int(secs * 4 / 3)
        if vo_words > budget:
            err(f"narration has {vo_words} words; the budget for {secs:.1f} s is {budget}")
    else:                                            # long narrated films: documentary pace, about 140 words a minute
        budget = int(secs * 2.3)
        if vo_words > budget:
            warn(f"narration has {vo_words} words; about {budget} fit {secs / 60:.1f} min at documentary pace")
        elif vo_words and vo_words < secs * 1.6:
            warn(f"narration has {vo_words} words for {secs / 60:.1f} min: the voice rests more than it speaks; a "
                 f"narrated film this long takes about {int(secs * 1.8)}-{budget} (references/writing.md §5)")
    return report(film, errors, warnings, vo_words, budget)


def report(film, errors, warnings, vo_words=0, budget=0):
    shots = film.get("shots") or []
    fps = float(film.get("fps", 24))
    if shots and isinstance(shots[-1].get("end"), int):
        total = shots[-1]["end"] / fps
        print(f"{film.get('title', '?')}: {len(shots)} shots, {total:.2f} s, average {total / len(shots):.2f} s, "
              f"narration {vo_words}/{budget} words")
    for w in warnings:
        print(f"WARNING  {w}")
    for e in errors:
        print(f"ERROR    {e}")
    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0 if len(sys.argv) == 2 else 2)
    sys.exit(main(sys.argv[1]))

#!/usr/bin/env python3
"""Directions for a Film mode idea: three looks side by side, each a style plus film stills, then the picked one
measured into the film's look (Python 3 stdlib + ffmpeg; no installs).

  # 1. stills per direction (mood only): films whose look fits, by title, or a cinematographer or genre page
  python3 tools/asset_search.py search --q "<film title>" --sources filmgrab --n 6 --out research/dir-a1
  python3 tools/asset_search.py search --q "cat:<cinematographer>" --sources filmgrab --n 3 --out research/dir-a2
  # 2. one image: one row per direction (style poster, up to four stills, measured palette)
  python3 tools/direction.py board --row "A|<label>|<style id>|research/dir-a1,research/dir-a2" \
      --row "B|…|…|…" --row "C|…|…|…" --out review/directions.jpg
  # 3. after the pick: measure its stills into a look patch for engine/looks.mjs
  python3 tools/direction.py measure --dirs research/dir-a1,research/dir-a2 --out research/direction
  # 4. at the style frame: the still against the picked direction
  python3 tools/direction.py compare review/style-v1.png --against research/direction/direction.json

Measured per still and pooled: palette (k-means in CIELAB, k = 5, sorted dark to light, accent = most chromatic),
luminance percentiles (p5, p50, p95), contrast (p95 - p5), dark and bright shares, saturation (mean CIELAB chroma),
warmth (mean b* of the mid-tones), vignette (corner to centre), and an **estimate** of the key light: the centroid of
the brightest pixels gives the side (frame left or right, or frontal) and the height. The estimate is a starting
point for `light.azimuthDeg` / `elevationDeg` (scene.html: 180 = from the camera, about 90 = frame right, about 270 =
frame left); the eye decides at the style frame.

Film stills are copyrighted: they are thumbnails for choosing and measuring, never fetched in full, never in a frame.
"""
import argparse
import glob
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
W = 96                                       # analysis width: palette and tone, not detail
BASE_FAMILIES = {"cinematic-realistic", "anime-cel", "pastel-storybook", "claymation", "papercut-collage",
                 "retro-synthwave-vhs", "glossy-commercial", "handmade-ink"}


def decode(path, width=W):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip().split(",")
    try:
        w0, h0 = int(probe[0]), int(probe[1])
    except (ValueError, IndexError):
        raise SystemExit(f"{path} is not a picture ffprobe can read") from None
    h = max(2, round(width * h0 / w0 / 2) * 2)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={width}:{h}", "-frames:v", "1",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    px = [tuple(raw[i:i + 3]) for i in range(0, len(raw) - 2, 3)]
    return px, width, len(px) // width


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def to_lab(p):
    r, g, b = (lin(v) for v in p)
    x, y, z = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, \
              (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def lab_hex(L):
    l, a, b = L
    fy = (l + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    inv = lambda t: t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787
    x, y, z = inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883
    rgb = (3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.2040 * y + 1.0570 * z)
    g = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return "#" + "".join(f"{round(max(0, min(1, g(c))) * 255):02x}" for c in rgb)


def kmeans(labs, k=5, iters=16):
    step = max(1, len(labs) // 4000)
    pts = labs[::step]
    srt = sorted(pts, key=lambda p: p[0])
    cent = [srt[int((i + 0.5) * len(srt) / k)] for i in range(k)]   # seeded by lightness: deterministic
    for _ in range(iters):
        groups = [[] for _ in range(k)]
        for p in pts:
            j = min(range(k), key=lambda i: (p[0] - cent[i][0]) ** 2 + (p[1] - cent[i][1]) ** 2 + (p[2] - cent[i][2]) ** 2)
            groups[j].append(p)
        cent = [tuple(sum(c[d] for c in g) / len(g) for d in range(3)) if g else cent[i] for i, g in enumerate(groups)]
    shares = [len(g) / len(pts) for g in groups]
    return sorted(zip(cent, shares), key=lambda cs: cs[0][0])


def pct(vals, q):
    return vals[min(len(vals) - 1, int(q * len(vals)))]


def measure_one(path):
    px, w, h = decode(path)
    labs = [to_lab(p) for p in px]
    Ls = sorted(l[0] for l in labs)
    p5, p50, p95, p85 = pct(Ls, 0.05), pct(Ls, 0.5), pct(Ls, 0.95), pct(Ls, 0.85)
    chroma = [math.hypot(a, b) for l, a, b in labs if l > 15]
    mids = [b for l, a, b in labs if 30 < l < 75]
    bright = [(i % w, i // w) for i, l in enumerate(labs) if l[0] >= p85]
    cx = (sum(x for x, _ in bright) / len(bright) / (w - 1)) * 2 - 1 if bright else 0.0
    cy = (sum(y for _, y in bright) / len(bright) / (h - 1)) * 2 - 1 if bright else 0.0
    cw, ch = max(1, w // 6), max(1, h // 6)
    corner = [labs[y * w + x][0] for y in list(range(ch)) + list(range(h - ch, h)) for x in list(range(cw)) + list(range(w - cw, w))]
    centre = [labs[y * w + x][0] for y in range(h // 3, 2 * h // 3) for x in range(w // 3, 2 * w // 3)]
    return {"file": path, "labs": labs, "p5": p5, "p50": p50, "p95": p95, "contrast": p95 - p5,
            "dark": sum(l < 15 for l in Ls) / len(Ls), "bright": sum(l > 85 for l in Ls) / len(Ls),
            "chroma": sum(chroma) / max(1, len(chroma)), "warmth": sum(mids) / max(1, len(mids)),
            "vignette": (sum(corner) / len(corner)) / max(1.0, sum(centre) / len(centre)), "key": (cx, cy)}


def pool(ms):
    labs = [l for m in ms for l in m["labs"]]
    pal = kmeans(labs)
    avg = lambda k: sum(m[k] for m in ms) / len(ms)
    cx, cy = sum(m["key"][0] for m in ms) / len(ms), sum(m["key"][1] for m in ms) / len(ms)
    return {"palette": [{"hex": lab_hex(c), "share": round(s, 3), "chroma": round(math.hypot(c[1], c[2]), 1)} for c, s in pal],
            "p5": avg("p5"), "p50": avg("p50"), "p95": avg("p95"), "contrast": avg("contrast"), "dark": avg("dark"),
            "bright": avg("bright"), "chroma": avg("chroma"), "warmth": avg("warmth"), "vignette": avg("vignette"),
            "key": (cx, cy)}


def words(P):
    key = "low-key" if P["p50"] < 35 else "high-key" if P["p50"] > 62 else "mid-key"
    con = "hard" if P["contrast"] > 70 else "soft" if P["contrast"] < 45 else "medium"
    sat = "muted" if P["chroma"] < 14 else "saturated" if P["chroma"] > 32 else "moderate"
    warm = "warm" if P["warmth"] > 6 else "cool" if P["warmth"] < -4 else "neutral"
    cx = P["key"][0]
    side = "frame right" if cx > 0.18 else "frame left" if cx < -0.18 else "frontal"
    return f"{key}, {con} contrast, {sat}, {warm}; key light {side}, {'high' if P['key'][1] < -0.2 else 'low' if P['key'][1] > 0.2 else 'mid'} (estimate)"


def look_patch(P):
    pal = P["palette"]
    accent = max(pal[1:], key=lambda c: c["chroma"] * (1.4 if c["share"] < 0.2 else 1))
    rest = [c["hex"] for c in pal if c is not accent]
    cx, cy = P["key"]
    az = 180 if abs(cx) <= 0.18 else (180 - 70 * min(1, abs(cx) / 0.6)) if cx > 0 else (180 + 70 * min(1, abs(cx) / 0.6))
    el = round(max(10, min(70, 35 - 40 * cy)))
    return {
        "palette": [rest[0], rest[1], rest[2], rest[3] if len(rest) > 3 else rest[2], accent["hex"]],
        "light": {"azimuthDeg": round(az), "elevationDeg": el,
                  "ambient": round(max(0.1, min(0.9, 0.15 + 0.9 * (P["p5"] / 40))), 2),
                  "exposure": round(max(0.7, min(1.4, 0.75 + P["p50"] / 100)), 2)},
        "post": {"contrast": round(max(-0.2, min(0.3, (P["contrast"] - 55) / 150)), 2),
                 "saturation": round(max(-0.5, min(0.3, (P["chroma"] - 22) / 60)), 2),
                 "vignette": {"darkness": round(max(0, min(0.8, (1 - P["vignette"]) * 1.4)), 2)}},
    }


def stills(dirs, limit=None):
    out = []
    for d in dirs:
        res = json.load(open(os.path.join(d, "results.json"), encoding="utf-8"))["results"]
        for r in res:
            p = os.path.join(d, "thumbs", f"{r['n']:02d}.img")
            if os.path.exists(p):
                out.append((p, r))
    return out[:limit] if limit else out


def palette_strip(pal, width, path):
    pal = [c for c in pal if c["share"] > 0.001] or pal[:1]   # a one-colour reference leaves empty clusters
    total = sum(c["share"] for c in pal) or 1.0
    widths = [max(1, int(c["share"] / total * width)) for c in pal]
    widths[widths.index(max(widths))] += width - sum(widths)   # the widest takes the rounding, so the sum is exact
    parts = [f"color=c=0x{c['hex'][1:]}:s={w}x40[c{i}]" for i, (c, w) in enumerate(zip(pal, widths))]
    graph = ";".join(parts) + ";" + ("".join(f"[c{i}]" for i in range(len(pal))) + f"hstack=inputs={len(pal)}"
                                     if len(pal) > 1 else "[c0]null")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "nullsrc=s=16x16", "-filter_complex", graph,
                    "-frames:v", "1", path], check=True)


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


def labelled_board(styles, rows, width, out):
    """Each row under a bar with its number and the name the style question uses for it, nothing else, shot by headless
    Chrome. False without Chrome: the plain stack is used then."""
    exe = styles.chrome()
    if not exe:
        return False
    import html as H
    import tempfile
    bar, total, parts = 44, 0, []
    for path, _, letter, label, films in rows:
        h = int(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=height", "-of", "csv=p=0", path],
                               capture_output=True, text=True).stdout.strip() or 0)
        total += bar + h + 8
        parts.append(f'<div class="b"><i>{H.escape(letter)}</i><b>{H.escape(label)}</b></div>'
                     f'<img src="{H.escape(Path(path).resolve().as_uri())}" style="height:{h}px">')
    page = ("<!doctype html><meta charset=utf-8><style>body{margin:0;background:#000;font-family:-apple-system,Helvetica,"
            "Arial,sans-serif}.b{height:44px;display:flex;align-items:center;gap:12px;padding:0 10px;color:#eee}"
            ".b i{font:700 20px/32px -apple-system,Helvetica,Arial,sans-serif;font-style:normal;background:#f2c230;color:#111;"
            "min-width:32px;height:32px;border-radius:16px;text-align:center}.b b{font-size:19px;white-space:nowrap}"
            "img{display:block;margin-bottom:8px}</style>" + "".join(parts))
    with tempfile.TemporaryDirectory() as tmp:
        src, png = os.path.join(tmp, "board.html"), os.path.join(tmp, "board.png")
        open(src, "w", encoding="utf-8").write(page)
        r = subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                            f"--window-size={width},{total}", f"--screenshot={png}", Path(src).resolve().as_uri()],
                           capture_output=True, timeout=60)
        if r.returncode != 0 or not os.path.exists(png):
            return False
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", png, "-q:v", "4", out], check=True)
    return True


def one_tone(measured):
    """Three directions that all sit in the dark, or all without colour, are one choice offered three times."""
    if len(measured) < 2:
        return ""
    why = []
    if max(P["p50"] for P in measured) < 45:
        why.append("every row is low-key")
    if max(P["chroma"] for P in measured) < 25:
        why.append("no row carries colour (all muted or monochrome)")
    if not why:
        return ""
    return ("ONE TONE: " + " and ".join(why) + ". Swap one direction for one in daylight or in colour (high-key light, "
            "saturated fills, painted or graphic colour) that still serves this story; keep an all-dark board only when "
            "the story happens only at night, and then say so to the user in one line")


def cmd_board(a):
    sys.path.insert(0, HERE)
    import styles
    data = styles.index()
    tmp = os.path.join(os.path.dirname(os.path.abspath(a.out)), ".direction-board")
    os.makedirs(tmp, exist_ok=True)
    cell_w, cell_h, rows_img, measured = 320, 180, [], []
    for ri, row in enumerate(a.row):
        letter, label, style_id, dirs = (row.split("|") + ["", "", "", ""])[:4]
        cells = []
        recipe = next((s for s in data["styles"] if s["id"] == style_id), None)
        if recipe and recipe.get("poster"):      # a library recipe brings its poster; a base family has none
            cells.append(styles.fetch(recipe["poster"], os.path.join(styles.CACHE, data.get("commit", "x")[:12], recipe["id"] + ".jpg")))
        elif not recipe and style_id and style_id not in BASE_FAMILIES:
            raise SystemExit(f"row {letter}: unknown style {style_id} (a base family or styles.py list)")
        found = stills([d for d in dirs.split(",") if d], limit=4)
        cells += [p for p, _ in found]
        if not cells:
            raise SystemExit(f"row {letter}: no style poster or stills")
        P = pool([measure_one(p) for p, _ in found]) if found else None
        try:
            measured.append(P or pool([measure_one(cells[0])]))
        except Exception:                        # a poster that cannot be measured leaves the check to the others
            pass
        inputs, chain = [], []
        for i, c in enumerate(cells):
            inputs += ["-i", c]
            chain.append(f"[{i}:v]scale={cell_w}:{cell_h}:force_original_aspect_ratio=increase,crop={cell_w}:{cell_h},setsar=1[v{i}]")
        graph = ";".join(chain) + ";" + "".join(f"[v{i}]" for i in range(len(cells))) + \
            (f"hstack=inputs={len(cells)}" if len(cells) > 1 else "null")
        strip_w = cell_w * len(cells)
        row_img = os.path.join(tmp, f"row{ri}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-frames:v", "1", row_img], check=True)
        if P:
            strip = os.path.join(tmp, f"strip{ri}.png")
            palette_strip(P["palette"], strip_w, strip)
            stacked = os.path.join(tmp, f"rowp{ri}.png")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", row_img, "-i", strip, "-filter_complex", "vstack=inputs=2",
                            "-frames:v", "1", stacked], check=True)
            row_img = stacked
        films = ", ".join(dict.fromkeys(f"{r['title']} ({r.get('year', '')})".replace(" ()", "") for _, r in found))
        rows_img.append((row_img, strip_w, letter, label, films))
        print(f"{letter}. {label} · style {style_id or '-'} · {films or 'no stills'}")
        if P:
            print(f"   {words(P)} · palette {' '.join(c['hex'] for c in P['palette'])}")
    maxw = max(r[1] for r in rows_img)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    labelled = labelled_board(styles, rows_img, maxw, a.out)
    inputs, chain = [], []
    for i, (p, w, *_) in enumerate(rows_img if not labelled else []):
        inputs += ["-i", p]
        chain.append(f"[{i}:v]pad={maxw}:ih+8:0:0:black[r{i}]")
    if not labelled:
        graph = ";".join(chain) + ";" + "".join(f"[r{i}]" for i in range(len(rows_img))) + \
            (f"vstack=inputs={len(rows_img)}" if len(rows_img) > 1 else "null")
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-frames:v", "1", "-q:v", "4", a.out],
                       check=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    tone = one_tone(measured)
    if tone:
        print(tone)
    caps = [f'{r.split("|")[0]} · {(r.split("|") + [""])[1]}' for r in a.row]
    print(f"board: {a.out} (rows top to bottom; first cell = the style's poster, then the stills, palette strip below) · "
          f"show the user: {os.path.abspath(a.out)} (Claude Code: SendUserFile with display 'render', it opens big in the "
          f"side panel; elsewhere the page {page(a.out, caps)} in your message)" + small_copy(a.out)
          + (" · opened on the user's screen" if show(a.out) else ""))


def small_copy(board):
    """A board of many rows passes a megapixel: the user sees it whole, the agent reads a small copy of it."""
    size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                           "-of", "csv=p=0:s=x", board], capture_output=True, text=True).stdout.strip()
    try:
        w, h = (int(x) for x in size.split("x"))
    except ValueError:
        return ""
    if w * h <= 900_000:
        return ""
    small = os.path.splitext(board)[0] + "-small.jpg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", board, "-vf", f"scale={int(w * (900_000 / (w * h)) ** 0.5) // 2 * 2}:-2",
                    "-q:v", "4", small], check=True)
    return f" · to look at it yourself, read {small}"


def expand(paths):
    """Wildcards are opened here: bash expands refs/*.* before Python sees it, PowerShell passes it as it is."""
    out = []
    for p in paths:
        hits = sorted(glob.glob(p)) if any(c in p for c in "*?[") else [p]
        if not hits:
            raise SystemExit(f"nothing matches {p}")
        out += hits
    return out


def cmd_measure(a):
    paths = [p for p, _ in stills([d for d in (a.dirs or "").split(",") if d])] + expand(a.images)
    if a.pick:
        keep = {int(x) for x in a.pick.split(",")}
        paths = [p for i, p in enumerate(paths, 1) if i in keep]
    if not paths:
        raise SystemExit("measure: no images (--dirs search folders and/or image paths)")
    ms, read = [], []
    for p in paths:                                   # a note or a PDF beside the pictures is passed over, not fatal
        try:
            ms.append(measure_one(p))
            read.append(p)
        except SystemExit as e:
            print(f"passed over: {e}")
    if not ms:
        raise SystemExit("measure: none of these is a picture ffprobe can read")
    paths = read
    P = pool(ms)
    patch = look_patch(P)
    per = [{k: round(m[k], 3) for k in ("p50", "contrast", "chroma", "warmth", "dark")} for m in ms]
    os.makedirs(a.out, exist_ok=True)
    out = {"from": paths, "measured": {k: (round(v, 3) if isinstance(v, float) else v) for k, v in P.items()},
           "per_still": per, "words": words(P), "look_patch": patch}
    json.dump(out, open(os.path.join(a.out, "direction.json"), "w", encoding="utf-8"), indent=1)
    print(f"{len(paths)} stills · {words(P)}")
    print(f"palette {' '.join(c['hex'] for c in P['palette'])} · L p5/p50/p95 {P['p5']:.0f}/{P['p50']:.0f}/{P['p95']:.0f}")
    print(f"look patch -> {os.path.join(a.out, 'direction.json')}: palette, light (az {patch['light']['azimuthDeg']}°, "
          f"el {patch['light']['elevationDeg']}°, estimate), post contrast {patch['post']['contrast']}, "
          f"saturation {patch['post']['saturation']}")


def cmd_compare(a):
    d = json.load(open(a.against, encoding="utf-8"))
    ref, per = d["measured"], d.get("per_still") or [d["measured"]]
    m = pool([measure_one(a.still)])
    rows = [("key (L p50)", "p50", 1, 8), ("contrast", "contrast", 1, 12), ("saturation", "chroma", 1, 6),
            ("warmth (b*)", "warmth", 1, 5), ("dark share", "dark", 100, 12)]
    off = 0
    for name, k, scale, tol in rows:                 # inside the span of the direction's stills, with a tolerance
        v, lo, hi = m[k] * scale, min(x[k] for x in per) * scale - tol, max(x[k] for x in per) * scale + tol
        flag = "ok" if lo <= v <= hi else ("higher" if v > hi else "lower")
        off += flag != "ok"
        print(f"  {name:<12} still {v:6.1f} · direction {lo + tol:6.1f}…{hi - tol:.1f} · {flag}")
    print(f"  still: {words(m)}")
    print(f"  direction: {words(ref) if 'key' in ref else ''}")
    print("  MATCH" if off == 0 else f"  {off} measure(s) off: adjust the look, or name it as intentional")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("board")
    p.add_argument("--row", action="append", required=True, help='"A|label|style-id|search-dir,search-dir"')
    p.add_argument("--out", default="review/directions.jpg")
    p.set_defaults(fn=cmd_board)
    p = sub.add_parser("measure")
    p.add_argument("images", nargs="*")
    p.add_argument("--dirs", help="search folders (results.json + thumbs/)")
    p.add_argument("--pick", help="numbers of the stills to use, in the order listed (default: all)")
    p.add_argument("--out", default="research/direction")
    p.set_defaults(fn=cmd_measure)
    p = sub.add_parser("compare")
    p.add_argument("still")
    p.add_argument("--against", required=True)
    p.set_defaults(fn=cmd_compare)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())

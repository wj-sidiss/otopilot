#!/usr/bin/env python3
"""Measure typography in reference images and check type contrast on rendered frames (Python 3 stdlib + ffmpeg).

  python3 tools/type_extract.py measure refs/type/*.jpg research/type-refs/thumbs/03.img --out type/direction-draft.json
  python3 tools/type_extract.py measure refs/type/a.jpg refs/type/b.png --case 1=caps,2=mixed --out type/direction-draft.json
  python3 tools/type_extract.py contrast review/frame-0120.png --box 0.08,0.70,0.84,0.12 --ink f2efe6

measure: coarse, honest heuristics from a 360 px greyscale copy of each image. Ink is the minority class after an
Otsu threshold; text lines are rows with many ink/paper transitions. Per image: line heights and the size hierarchy
(largest / median / smallest line, number of size levels), all-caps vs mixed case (ink in the ascender band vs the
x-height band; --case overrides per image), a tracking proxy (mean gap between letter blobs / line height),
alignment (spread of left edges, centres, right edges), text area share, and the colour of type and paper. It writes
a draft type direction (case, align, title_share, scale ratio, tracking, colours) that the agent turns into the
film's type spec together with its own visual read of the downscaled references, and the user confirms.
Photographs, script faces and textured posters fool it: the draft says how many lines it found per image so a weak
read is visible. KIT/references/typography.md §9.

contrast: WCAG contrast of an ink colour against the background inside a box (x, y, w, h as shares of the frame) on a
rendered frame: the median background and the worst 10 % (closest to the ink), letter edges left out. Frame only
the type being checked: other coloured type inside the box counts as background. Text needs 4.5:1, large display 3:1.
"""
import argparse
import glob
import json
import os
import statistics
import subprocess
import sys

WIDTH = 360


def load(path, gray=True, width=WIDTH):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        w0, h0 = (int(x) for x in probe.stdout.strip().split(",")[:2])
    except ValueError:
        raise SystemExit(f"{path} is not a picture ffprobe can read") from None
    w = min(width, w0) if width else w0
    h = max(2, round(h0 * w / w0 / 2) * 2)
    fmt = "gray" if gray else "rgb24"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}:flags=area,format={fmt}",
                          "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return w, h, raw


def otsu(px):
    hist = [0] * 256
    for v in px:
        hist[v] += 1
    total, sum_all = len(px), sum(i * c for i, c in enumerate(hist))
    best, th, wb, sb = 0, 127, 0, 0
    for t in range(256):
        wb += hist[t]
        if wb == 0 or wb == total:
            continue
        sb += t * hist[t]
        mb, mf = sb / wb, (sum_all - sb) / (total - wb)
        between = wb * (total - wb) * (mb - mf) ** 2
        if between > best:
            best, th = between, t
    return th


def hexc(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c))):02x}" for c in rgb)


def lum(rgb):
    c = [x / 255 for x in rgb]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def measure_one(path, case_tag=None):
    w, h, g = load(path)
    _, _, rgb = load(path, gray=False)
    th = otsu(g)
    dark = sum(1 for v in g if v <= th)
    ink_dark = dark < len(g) / 2                       # ink = the minority class
    ink = [(v <= th) == ink_dark for v in g]
    rows = []
    for y in range(h):
        r = ink[y * w:(y + 1) * w]
        trans = sum(1 for x in range(1, w) if r[x] != r[x - 1])
        rows.append((sum(r), trans))
    texty = [cnt > w * 0.01 and tr >= 6 for cnt, tr in rows]
    lines, y = [], 0
    while y < h:
        if texty[y]:
            y0 = y
            while y < h and (texty[y] or (y + 1 < h and texty[y + 1])):
                y += 1
            if 3 <= y - y0 <= h * 0.28:                  # taller blocks are pictures, not lines of type
                lines.append([y0, y])
        y += 1
    found = []
    for y0, y1 in lines:
        cols = [any(ink[yy * w + x] for yy in range(y0, y1)) for x in range(w)]
        xs = [x for x, c in enumerate(cols) if c]
        if not xs:
            continue
        x0, x1 = xs[0], xs[-1]
        gaps, run = [], 0
        for x in range(x0, x1 + 1):
            if not cols[x]:
                run += 1
            elif run:
                gaps.append(run); run = 0
        lh = y1 - y0
        band = max(1, lh // 4)
        top = sum(rows[yy][0] for yy in range(y0, y0 + band)) / band
        mid = sum(rows[yy][0] for yy in range(y0 + band, y1 - band)) / max(1, lh - 2 * band)
        found.append({"y": y0, "h": lh, "x0": x0, "x1": x1, "gap": statistics.median(gaps) / lh if gaps else 0,
                      "caps_score": top / mid if mid else 0})
    res = {"file": path, "size": [w, h], "lines": len(found)}
    if not found:
        res["note"] = "no text lines found (photograph, script face or texture): rely on the visual read"
        return res
    hs = sorted(l["h"] for l in found)
    levels = []
    for v in hs:
        if not levels or v > levels[-1] * 1.18:
            levels.append(v)
    lefts = [l["x0"] / w for l in found]
    cents = [(l["x0"] + l["x1"]) / 2 / w for l in found]
    rights = [l["x1"] / w for l in found]
    spread = {k: statistics.pstdev(v) if len(v) > 1 else 0 for k, v in (("left", lefts), ("center", cents), ("right", rights))}
    if len(found) == 1:
        align = "center" if abs(cents[0] - 0.5) < 0.06 else ("left" if lefts[0] < 0.25 else "right" if rights[0] > 0.75 else "free")
    else:
        align = min(spread, key=spread.get)
    caps = statistics.median(l["caps_score"] for l in found)
    inkpx = [i for i in range(w * h) if ink[i] and texty[i // w]]
    paper = [i for i in range(w * h) if not ink[i] and texty[i // w]]
    avg = lambda idx: [statistics.fmean(rgb[3 * i + c] for i in idx[:: max(1, len(idx) // 4000)]) for c in range(3)] if idx else [0, 0, 0]
    ic, pc = avg(inkpx), avg(paper)
    big = max(found, key=lambda l: l["h"])
    res.update({
        "line_heights_px": hs, "size_levels": len(levels),
        "hierarchy": {"largest_over_median": round(hs[-1] / statistics.median(hs), 2), "largest_over_smallest": round(hs[-1] / hs[0], 2)},
        "title_share": round(big["h"] / 0.72 / min(w, h), 3),
        "case": case_tag or ("caps" if caps > 0.62 else "mixed"), "case_source": "tag" if case_tag else f"heuristic (score {caps:.2f})",
        "tracking_gap": round(statistics.median(l["gap"] for l in found), 3),
        "align": align, "text_area": round(sum((l["x1"] - l["x0"]) * l["h"] for l in found) / (w * h), 3),
        "ink": hexc(ic), "paper": hexc(pc), "contrast": round(ratio(ic, pc), 2), "ink_is_dark": ink_dark,
    })
    res["confidence"] = "weak" if len(found) < 3 or res["text_area"] > 0.6 else "fair"
    return res


def tracking_word(gap):
    return "tight" if gap < 0.09 else "normal" if gap < 0.2 else "open"


def expand(paths):
    """Wildcards are opened here: bash expands refs/*.* before Python sees it, PowerShell passes it as it is."""
    out = []
    for p in paths:
        hits = sorted(glob.glob(p)) if any(c in p for c in "*?[") else [p]
        if not hits:
            raise SystemExit(f"nothing matches {p}")
        out += hits
    return out


def measure(a):
    a.images = expand(a.images)
    tags = {}
    for part in (a.case or "").split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            tags[int(k)] = v.strip()
    per = []                                     # a note or a PDF beside the type references is passed over, not fatal;
    for i, p in enumerate(a.images, 1):          # the kept images keep their 1-based number, so --case still lines up
        try:
            per.append(measure_one(p, tags.get(i)))
        except SystemExit as e:
            print(f"passed over: {e}")
    if not per:
        raise SystemExit("measure: none of these is a picture ffprobe can read")
    good = [r for r in per if r.get("lines") and r.get("confidence") == "fair"] or [r for r in per if r.get("lines")]
    for i, r in enumerate(per, 1):
        if r.get("lines"):
            print(f"{i}. {os.path.basename(r['file'])}: {r['lines']} lines, {r['size_levels']} size levels, "
                  f"title {r['title_share']:.3f}, {r['case']}, align {r['align']}, gap {r['tracking_gap']}, "
                  f"text {r['text_area']:.0%}, {r['ink']} on {r['paper']} ({r['contrast']}:1) · {r['confidence']}")
        else:
            print(f"{i}. {os.path.basename(r['file'])}: {r['note']}")
    vote = lambda k: max(set(r[k] for r in good), key=[r[k] for r in good].count) if good else None
    draft = {
        "kind": "type direction draft (heuristic; the agent adds its visual read, the user confirms)",
        "from": [r["file"] for r in per],
        "case": vote("case"), "align": vote("align"),
        "title_share": round(statistics.median(r["title_share"] for r in good), 3) if good else None,
        "scale_ratio": round(statistics.median(r["hierarchy"]["largest_over_median"] for r in good), 2) if good else None,
        "size_levels": round(statistics.median(r["size_levels"] for r in good)) if good else None,
        "tracking": tracking_word(statistics.median(r["tracking_gap"] for r in good)) if good else None,
        "text_area": round(statistics.median(r["text_area"] for r in good), 3) if good else None,
        "palette": [{"ink": r["ink"], "paper": r["paper"]} for r in good][:6],
        "per_image": per,
        "visual_read": "", "confirmed_by_user": False,
    }
    if draft["tracking"]:
        draft["tracking_em"] = {"tight": -0.01, "normal": 0.0, "open": 0.06}[draft["tracking"]]
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(draft, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"draft: case {draft['case']}, align {draft['align']}, title_share {draft['title_share']}, scale ×{draft['scale_ratio']}, "
          f"tracking {draft['tracking']}, text area {draft['text_area']} -> {a.out}")
    print("next: write your own read of the downscaled references into visual_read, then confirm with the user")


def contrast(a):
    w, h, rgb = load(a.frame, gray=False, width=0)
    x, y, bw, bh = (float(v) for v in a.box.split(","))
    X0, Y0, X1, Y1 = int(x * w), int(y * h), int((x + bw) * w), int((y + bh) * h)
    ink = tuple(int(a.ink.strip("#")[i:i + 2], 16) for i in (0, 2, 4))
    at = lambda xx, yy: tuple(rgb[3 * (yy * w + xx) + c] for c in range(3))
    near_ink = lambda p: sum(abs(p[c] - ink[c]) for c in range(3)) <= 90
    inky = {(xx, yy) for yy in range(Y0, Y1) for xx in range(X0, X1) if near_ink(at(xx, yy))}
    edge = {(xx + dx, yy + dy) for xx, yy in inky for dx in range(-3, 4) for dy in range(-3, 4)}   # anti-aliased letter edges
    far = [at(xx, yy) for yy in range(Y0, Y1, 2) for xx in range(X0, X1, 2) if (xx, yy) not in edge]
    if not far:
        sys.exit("the box holds only ink-coloured pixels: widen it")
    li = lum(ink)
    far.sort(key=lambda p: abs(lum(p) - li))
    worst = far[: max(1, len(far) // 10)]
    med = sorted(far, key=lum)[len(far) // 2]
    rm, rw = ratio(ink, med), min(ratio(ink, p) for p in worst)
    verdict = "pass (text)" if rw >= 4.5 else "pass (large display only)" if rw >= 3 else "FAIL"
    print(f"contrast {a.ink} in box: median background {hexc(med)} {rm:.2f}:1 · worst 10 % {rw:.2f}:1 -> {verdict}")
    if verdict == "FAIL":
        print("fix: a scrim or shadow behind the type, a darker/lighter ink, or move the type to a calmer area")
        return 1
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("measure")
    m.add_argument("images", nargs="+")
    m.add_argument("--case", help="manual tags per image number: 1=caps,2=mixed")
    m.add_argument("--out", required=True)
    c = sub.add_parser("contrast")
    c.add_argument("frame")
    c.add_argument("--box", required=True, help="x,y,w,h as shares of the frame")
    c.add_argument("--ink", required=True, help="the type colour, hex")
    a = ap.parse_args()
    return measure(a) if a.cmd == "measure" else contrast(a)


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    sys.exit(main())

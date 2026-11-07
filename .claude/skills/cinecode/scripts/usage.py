#!/usr/bin/env python3
"""What the chats on this film cost, in tokens, read from Claude Code's local session files (standard library only).

  python3 tools/usage.py            one line per chat: turns, tokens, context now, images, helpers; then the total
  python3 tools/usage.py --now      the newest chat's context size in one line

Every turn re-reads the whole chat, so a chat's context size is what each further step costs. A chat that has grown
past about 160 K tokens (the guard's first reminder) is cheaper to continue in a new chat from STATE.md than in place.
Other tools (Cursor and the rest) keep no token counts on disk; there the tool's own usage page is the source.
"""
import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

CLAUDE_PROJECTS = Path.home() / ".claude" / "projects"


def context_of(usage):
    return sum(usage.get(k, 0) for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))


# API list prices, $ per million input tokens, and the cache-read multiplier, as the pricing page lists them
# (platform.claude.com/docs/en/about-claude/pricing, October 2026). Output costs 5x input, a 5-minute cache write
# 1.25x, a 1-hour write 2x. The most specific id first; a model not listed here is not guessed: it is counted as
# unpriced and named. Haiku 5.5 has two tiers by prompt size (see cost_of).
PRICES = [("fable-5-1", 10, 0.025), ("mythos-5-1", 10, 0.025), ("fable-5", 10, 0.1), ("mythos-5", 10, 0.1),
          ("opus-5-5", 4, 0.05), ("opus-5", 5, 0.1), ("opus-4-8", 5, 0.1), ("opus-4-7", 5, 0.1), ("opus-4-6", 5, 0.1),
          ("opus-4-5", 5, 0.1), ("opus-4-1", 15, 0.1), ("opus-4", 15, 0.1),
          ("sonnet-5-5", 2, 0.05), ("sonnet-5", 2, 0.1), ("sonnet-4-6", 3, 0.1), ("sonnet-4-5", 3, 0.1), ("sonnet-4", 3, 0.1),
          ("haiku-5-5", 0.10, 0.1), ("haiku-4-5", 1, 0.1), ("haiku-3-5", 0.8, 0.1)]
HAIKU_55_LONG = (100_000, 0.50)      # Haiku 5.5: prompts over 100,000 tokens are billed at $0.50 per million input
LOAD_UNIT = 15.0          # one "film" of load: a typical 30-second Quick film, measured at list prices; never shown as money


def cost_of(usage, model):
    """A turn's cost in dollars at API list prices, or None for a model without a listed price. An estimate: a
    subscription draws on its limits instead, and the list changes."""
    price = next(((name, p, r) for name, p, r in PRICES if name in str(model or "")), None)
    if not price:
        return None
    name, p, read = price
    prompt = usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0) + usage.get("cache_read_input_tokens", 0)
    if name == "haiku-5-5" and prompt > HAIKU_55_LONG[0]:
        p = HAIKU_55_LONG[1]
    split = usage.get("cache_creation") or {}
    w5, w1 = split.get("ephemeral_5m_input_tokens"), split.get("ephemeral_1h_input_tokens")
    writes = 1.25 * (w5 or 0) + 2 * (w1 or 0) if (w5 is not None or w1 is not None) \
        else 1.25 * usage.get("cache_creation_input_tokens", 0)
    return p / 1e6 * (usage.get("input_tokens", 0) + writes + read * usage.get("cache_read_input_tokens", 0)
                      + 5 * usage.get("output_tokens", 0))


def last_context(path, tail=4_000_000):
    """Context size of the newest assistant turn in a session file (reads only the end of the file)."""
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            f.seek(max(0, f.tell() - tail))
            lines = f.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return 0
    for line in reversed(lines):
        if '"assistant"' not in line or '"usage"' not in line:
            continue
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get("type") == "assistant" and not r.get("isSidechain"):
            c = context_of((r.get("message") or {}).get("usage") or {})
            if c:
                return c
    return 0


def session_stats(path):
    seen, s = set(), {"turns": 0, "tokens": 0, "usd": 0.0, "unpriced": 0, "images": 0, "ctx": 0, "title": "", "start": None}
    with open(path, encoding="utf-8", errors="replace") as fh_:
        rows_ = fh_.readlines()
    for line in rows_:
        try:
            r = json.loads(line)
        except ValueError:
            continue
        m = r.get("message") or {}
        if s["start"] is None and r.get("timestamp"):
            s["start"] = r["timestamp"]
        if r.get("type") == "custom-title":
            s["title"] = r.get("customTitle", "")
        if r.get("type") == "assistant" and m.get("id") not in seen:
            seen.add(m.get("id"))
            u = m.get("usage") or {}
            c = context_of(u)
            s["turns"] += 1
            s["tokens"] += c + u.get("output_tokens", 0)
            usd = cost_of(u, m.get("model"))
            s["usd"] += usd or 0
            s["unpriced"] += usd is None
            s["ctx"] = c or s["ctx"]
        if r.get("type") == "user" and isinstance(m.get("content"), list):
            for x in m["content"]:
                if isinstance(x, dict) and x.get("type") == "tool_result" and isinstance(x.get("content"), list):
                    s["images"] += sum(1 for y in x["content"] if isinstance(y, dict) and y.get("type") == "image")
                elif isinstance(x, dict) and x.get("type") == "image":
                    s["images"] += 1
    return s


def helper_tokens(path):
    total, usd, unpriced = 0, 0.0, 0
    for f in glob.glob(str(Path(path).with_suffix("")) + "/subagents/*.jsonl"):
        seen = set()
        with open(f, encoding="utf-8", errors="replace") as fh_:
            rows_ = fh_.readlines()
        for line in rows_:
            if '"usage"' not in line:
                continue
            try:
                r = json.loads(line)
            except ValueError:
                continue
            m = r.get("message") or {}
            if r.get("type") == "assistant" and m.get("id") not in seen:
                seen.add(m.get("id"))
                u = m.get("usage") or {}
                total += context_of(u) + u.get("output_tokens", 0)
                cost = cost_of(u, m.get("model"))
                usd += cost or 0
                unpriced += cost is None
    return total, usd, unpriced


def sessions_for(project):
    """Session files whose chat ran in this folder, or in a parent folder and worked on this one."""
    project = Path(project).resolve()
    found = []
    for folder in [project] + list(project.parents)[:3]:
        d = CLAUDE_PROJECTS / re.sub(r"[^A-Za-z0-9]", "-", str(folder))
        for f in d.glob("*.jsonl"):
            if folder == project:
                found.append(f)
                continue
            with open(f, encoding="utf-8", errors="replace") as fh:
                if any(str(project) + "/" in line for line in fh):
                    found.append(f)
    return sorted(set(found), key=os.path.getmtime)


def fmt(n):
    return f"{n / 1e6:.1f} M" if n >= 1e6 else f"{n / 1e3:.0f} K"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--now", action="store_true")
    ap.add_argument("--project", default=str(Path(__file__).resolve().parent.parent))
    a = ap.parse_args()
    files = sessions_for(a.project)
    if not files:
        sys.exit("No Claude Code chats found for this folder (other tools keep no token counts on disk).")
    if a.now:
        print(f"context now: {fmt(last_context(files[-1]))} tokens per step (newest chat: {files[-1].stem[:8]})")
        return
    total, usd, unpriced = 0, 0.0, 0
    for f in files:
        s = session_stats(f)
        h, hu, hn = helper_tokens(f)
        total += s["tokens"] + h
        usd += s["usd"] + hu
        unpriced += s["unpriced"] + hn
        when = datetime.fromisoformat(s["start"].replace("Z", "+00:00")).astimezone().strftime("%m-%d %H:%M") \
            if s["start"] else "?"
        print(f"{when} · {s['turns']:>3} turns · {fmt(s['tokens'] + h):>7} · load {(s['usd'] + hu) / LOAD_UNIT:.1f}"
              + (f" (helpers {fmt(h)})" if h else "")
              + f" · context now {fmt(s['ctx'])} · {s['images']} images · {s['title'][:40]}")
    print(f"total {fmt(total)} tokens in {len(files)} chat(s) · load {usd / LOAD_UNIT:.1f} (1 = a typical 30-second "
          "Quick film: each turn weighed by its model, cache reads and writes at their own rates; an estimate"
          + (f"; {unpriced} turn(s) of an unknown model left out" if unpriced else "") + "). Load is for the kit's "
          "budget, never quoted to the user as money. A long chat re-reads itself on every step; at a gate, a new chat "
          "from STATE.md starts small again.")


if __name__ == "__main__":
    if os.name == "nt" and not sys.flags.utf8_mode:   # Windows reads, writes and prints in a legacy code page
        import subprocess
        sys.exit(subprocess.call([sys.executable] + sys.argv, env=dict(os.environ, PYTHONUTF8="1")))
    for _s in (sys.stdin, sys.stdout, sys.stderr):
        getattr(_s, "reconfigure", lambda **k: None)(encoding="utf-8", errors="replace")
    main()

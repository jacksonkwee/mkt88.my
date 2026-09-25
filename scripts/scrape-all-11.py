#!/usr/bin/env python
"""
Collect LIVE and PAST results for all 11 games on the MKT88 home page.

Every number comes from the same public result pages the app itself reads, via
Scrapling (Chrome TLS impersonation, plain HTTP - no browser needed):

  live : live4d2u.net/liveosx.json        -> 10 games in one request
         9lotto.com/result                -> Nine Lotto
  past : live4dresult.net/past-results/<date>  -> Magnum, Da Ma Cai, Sports Toto,
                                                  Singapore, Sabah 88, Sandakan, Cash Sweep
         live4d2u.net/past-results/<date>      -> Grand Dragon, Lucky HariHari, Perdana
         9lotto.com/result/<date>              -> Nine Lotto

Usage:
  python scripts/scrape-all-11.py --days 7
  python scripts/scrape-all-11.py --dates 2026-09-23 --dates 2026-09-24
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from scrapling.fetchers import Fetcher

UA_TIMEOUT = 25
OUT_DEFAULT = os.path.join("data", "all-11-results.json")

# The 11 tiles on the home page, in the order they are shown there.
GAMES = [
    ("magnum", "Magnum 4D"),
    ("damacai", "Da Ma Cai 1+3D"),
    ("sportstoto", "Sports Toto 4D"),
    ("sg", "Singapore 4D"),
    ("grand-dragon", "Grand Dragon 4D"),
    ("nine-lotto", "Nine Lotto 4D"),
    ("sabah88", "Sabah 88 4D"),
    ("sandakan", "Sandakan 4D"),
    ("cashsweep", "Cash Sweep 4D"),
    ("perdana", "Perdana 4D"),
    ("lucky-harihari", "Lucky HariHari 4D"),
]
GAME_LABEL = dict(GAMES)

# live4d2u live feed key -> game
FEED_KEY = {
    "M": "magnum", "D": "damacai", "T": "sportstoto", "S": "sg",
    "ST": "sandakan", "SW": "cashsweep", "SB": "sabah88",
    "G": "grand-dragon", "H": "lucky-harihari", "P": "perdana",
}

# live4dresult card table -> game (the Malaysia / Singapore archive page)
MY_TABLE = {
    "table-1": "magnum", "table-4": "damacai", "table-6": "sportstoto",
    "table-8": "sandakan", "table-9": "cashsweep", "table-10": "sabah88",
    "table-11": "sg",
}
# Extra draws worth keeping with the parent game (3+3D, 5D/6D, Magnum Life/Gold).
MY_EXTRA = {"table-2": "magnum", "table-3": "magnum", "table-5": "damacai", "table-7": "sportstoto"}

# live4d2u past page id prefixes -> game
KH_PREFIX = {"g": "grand-dragon", "h": "lucky-harihari", "p": "perdana"}

LETTERS_SP = list("ABCDEFGHIJKLM")   # 13 specials
LETTERS_CS = list("NOPQRSTUVW")      # 10 consolations


def num(v) -> str:
    """Keep a real 4-digit result, otherwise the standard blank."""
    s = str(v or "").strip()
    return s if re.fullmatch(r"\d{4}", s) else "----"


def clean(v) -> str:
    return re.sub(r"\s+", "", str(v or ""))


def set_of(prize, special, cons, **extra):
    out = {
        "prize": [num(p) for p in (prize or [])][:3],
        "special": [num(s) for s in (special or [])][:13],
        "cons": [num(c) for c in (cons or [])][:10],
    }
    out.update({k: v for k, v in extra.items() if v not in (None, "")})
    return out


def has_numbers(res: dict) -> bool:
    for key in ("prize", "special", "cons"):
        for v in res.get(key) or []:
            if re.fullmatch(r"\d{4}", str(v)):
                return True
    return False


# ---------------------------------------------------------------- live ------
def live_from_feed() -> dict:
    p = Fetcher.get("https://www.live4d2u.net/liveosx.json?ts=%d" % int(time.time() * 1000), timeout=UA_TIMEOUT)
    feed = json.loads(p.body if isinstance(p.body, str) else p.body.decode("utf-8", "ignore"))
    out = {}
    for key, game in FEED_KEY.items():
        d = feed.get(key) or {}
        res = set_of(
            [d.get("P1"), d.get("P2"), d.get("P3")],
            [d.get("S%d" % i) for i in range(1, 14)],
            [d.get("C%d" % i) for i in range(1, 11)],
            date=d.get("DD") or "", drawNo=d.get("DN") or "",
            complete=str(d.get("COMPLETE4D", "")) if d.get("COMPLETE4D") is not None else "",
            source="live4d2u/liveosx.json",
        )
        out[game] = res
    return out


def live_nine() -> dict:
    p = Fetcher.get("https://9lotto.com/result", timeout=UA_TIMEOUT)
    return {"nine-lotto": nine_set(p)}


def nine_set(page, source="9lotto.com") -> dict:
    txt = re.sub(r"\s+", " ", page.css("body").get() or "")
    draw = re.search(r"DRAW NO:\s*</span>\s*<span>([^<]+)</span>", txt)
    datem = re.search(r'placeholder="(\d{4}-\d{2}-\d{2})"', txt)
    prize = [clean(page.css("#n1::text").get()), clean(page.css("#n2::text").get()), clean(page.css("#n3::text").get())]
    special = [clean(page.css("#n%s::text" % L).get()) for L in LETTERS_SP]
    cons = [clean(page.css("#n%s::text" % L).get()) for L in LETTERS_CS]
    res = set_of(prize, special, cons, source=source)
    if draw:
        res["drawNo"] = draw.group(1).strip()
    if datem:
        res["date"] = datem.group(1)
    return res


# ---------------------------------------------------------------- past ------
def norm_date(v) -> str:
    """'Date:23-09-2026(Wed)' or '23-09-2026 (Wed)' -> '23-09-2026 (Wed)'."""
    s = clean(v)
    s = re.sub(r"^[Dd]ate:?\s*", "", s)
    m = re.fullmatch(r"(\d{2}-\d{2}-\d{4})\((\w+)\)", s)
    return "%s (%s)" % (m.group(1), m.group(2)) if m else s


def pick(page, card, patterns, i) -> str:
    """The cards do not agree on field names (Sabah 88 uses lotto_number_N)."""
    for pat in patterns:
        v = clean(page.css("%s [data-id='%s']::text" % (card, pat % i)).get())
        if v:
            return v
    return ""


def grid_from_tables(page, card, index):
    """Positional fallback: the special grid is the card's 2nd table (app does the same)."""
    tables = page.css(card + " table")
    if len(tables) <= index:
        return []
    return [clean(t) for t in tables[index].css("td.lottery-number::text").getall()]


SPECIAL_IDS = ["special-%d", "special_number_%d", "lotto_number_%d", "winning_number_%d", "number_%d"]
CONS_IDS = ["consolation-%d", "consolation_number_%d"]


def has_any(vals) -> bool:
    return any(re.fullmatch(r"\d{4}", str(v)) for v in (vals or []))


def my_past(page, iso: str) -> dict:
    out = {}
    labels = dict(MY_TABLE)
    labels.update(MY_EXTRA)
    for table, game in labels.items():
        card = ".card.outer-box.%s" % table
        if not page.css(card):
            continue
        date_lbl = norm_date(page.css(card + " [data-id='date']::text").get())
        if not date_lbl:
            continue
        draw = clean(page.css(card + " [data-id='draw_no']::text").get())
        prize = [clean(page.css("%s [data-id='%s']::text" % (card, k)).get())
                 for k in ("first_prize", "second_prize", "third_prize")]
        special = [pick(page, card, SPECIAL_IDS, i) for i in range(1, 14)]
        cons = [pick(page, card, CONS_IDS, i) for i in range(1, 11)]
        if not has_any(special):
            special = grid_from_tables(page, card, 1)[:13]
        if not has_any(cons):
            cons = grid_from_tables(page, card, 2)[:10]
        res = set_of(prize, special, cons, date=date_lbl, drawNo=draw,
                     source="live4dresult.net/past-results/" + iso)
        prev = out.get(game)
        if prev and has_numbers(prev):
            # keep the second draw (3+3D / 5D / 6D / Life) beside the main one
            prev.setdefault("extra", []).append({"table": table, **res})
        else:
            out[game] = res
    return out


def kh_past(page, iso: str) -> dict:
    out = {}
    for prefix, game in KH_PREFIX.items():
        date_lbl = norm_date(page.css("#%sdd::text" % prefix).get())
        draw = clean(page.css("#%sdn::text" % prefix).get())
        if not date_lbl and not draw:
            continue
        res = set_of(
            [page.css("#%sp%d::text" % (prefix, i)).get() for i in (1, 2, 3)],
            [page.css("#%ss%d::text" % (prefix, i)).get() for i in range(1, 14)],
            [page.css("#%sc%d::text" % (prefix, i)).get() for i in range(1, 11)],
            date=date_lbl, drawNo=draw,
            source="live4d2u.net/past-results/" + iso,
        )
        out[game] = res
    return out

def collect_live() -> tuple:
    t0 = time.time()
    live = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_feed = pool.submit(live_from_feed)
        f_nine = pool.submit(live_nine)
        try:
            live.update(f_feed.result())
        except Exception as e:
            print("  live feed failed:", str(e)[:90])
        try:
            live.update(f_nine.result())
        except Exception as e:
            print("  nine lotto live failed:", str(e)[:90])
    return live, time.time() - t0


def collect_past(dates: list) -> tuple:
    t0 = time.time()
    past = {}
    jobs = []
    for iso in dates:
        y, m, d = iso.split("-")
        jobs.append((iso, "my", "https://live4dresult.net/past-results/" + iso))
        jobs.append((iso, "kh", "https://www.live4d2u.net/past-results/" + iso))
        jobs.append((iso, "nine", "https://9lotto.com/result/%s-%d-%d" % (y, int(m), int(d))))

    def run(job):
        iso, kind, url = job
        try:
            p = Fetcher.get(url, timeout=UA_TIMEOUT)
        except Exception as e:
            return iso, kind, None, str(e)[:80]
        return iso, kind, p, None

    with ThreadPoolExecutor(max_workers=4) as pool:
        for iso, kind, page, err in pool.map(run, jobs):
            bucket = past.setdefault(iso, {})
            if page is None:
                bucket.setdefault("_errors", []).append("%s: %s" % (kind, err))
                continue
            try:
                if kind == "my":
                    for g, r in my_past(page, iso).items():
                        if not has_numbers(bucket.get(g, {})):
                            bucket[g] = r
                elif kind == "kh":
                    bucket.update(kh_past(page, iso))
                else:
                    bucket["nine-lotto"] = nine_set(page, "9lotto.com/result/" + iso)
            except Exception as e:
                bucket.setdefault("_errors", []).append("%s parse: %s" % (kind, str(e)[:80]))
    return past, time.time() - t0


def main() -> int:
    ap = argparse.ArgumentParser(description="Collect all 11 games: live + past results.")
    ap.add_argument("--days", type=int, default=7, help="how many past days to collect (default 7)")
    ap.add_argument("--dates", action="append", default=[], help="explicit YYYY-MM-DD (repeatable)")
    ap.add_argument("--out", default=OUT_DEFAULT, help="output JSON path")
    args = ap.parse_args()

    if args.dates:
        dates = sorted(args.dates)
    else:
        today = date.today()
        dates = [(today - timedelta(days=n)).isoformat() for n in range(1, args.days + 1)]

    started = time.time()
    print("Collecting all 11 games  |  live + %d past days" % len(dates))
    live, live_s = collect_live()
    past, past_s = collect_past(dates)
    total = time.time() - started

    # per-game report: how many of the requested days actually carry a draw
    print("\n%-17s %-7s %s" % ("GAME", "LIVE", "PAST DAYS WITH A RESULT"))
    for game, label in GAMES:
        lv = live.get(game) or {}
        ok_live = "OK" if has_numbers(lv) else "-"
        have = sum(1 for iso in dates if has_numbers(past.get(iso, {}).get(game, {})))
        print("%-17s %-7s %d/%d" % (label, ok_live, have, len(dates)))

    payload = {
        "collectedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "dates": dates,
        "live": live,
        "past": past,
        "seconds": {"live": round(live_s, 1), "past": round(past_s, 1), "total": round(total, 1)},
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    live_ok = sum(1 for g, _ in GAMES if has_numbers(live.get(g) or {}))
    print("\nlive games collected : %d/11   (%.1fs)" % (live_ok, live_s))
    print("past pages collected : %d days in %.1fs (%.2fs/day)"
          % (len(dates), past_s, past_s / max(1, len(dates))))
    print("saved                : %s" % args.out)
    return 0 if live_ok == 11 else 1


if __name__ == "__main__":
    sys.exit(main())
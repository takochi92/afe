#!/usr/bin/env python3
"""Reply to narrowly defined questions under our own Threads posts.

The network secret is attached to graph.threads.net by the Claude environment.
Dry-run is the default. --post is intended only for the scheduled Claude run
after threads_read_replies and threads_content_publish have been verified.
"""

import argparse
import csv
import datetime as dt
import json
import pathlib
import subprocess
import sys
import urllib.parse

API = "https://graph.threads.net/v1.0"
USER_ID = "29526192993649084"
LOG = pathlib.Path(__file__).resolve().parents[1] / "records" / "threads_auto_replies.csv"
DAILY_LIMIT = 3


def api(path, data=None):
    url = API + path
    args = ["curl", "-fsS", "--max-time", "30"]
    if data is not None:
        args += ["-X", "POST"]
        for key, value in data.items():
            args += ["--data-urlencode", f"{key}={value}"]
    args.append(url)
    result = subprocess.run(args, capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(f"Threads API request failed ({result.returncode}): {result.stderr.strip()}")
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Threads API returned invalid JSON") from exc
    if "error" in payload:
        raise RuntimeError("Threads API rejected the request: " + str(payload["error"].get("message", "unknown")))
    return payload


def answer(text):
    """Return a reviewed general answer only for two unambiguous FAQs."""
    t = text.replace(" ", "").replace("　", "")
    if any(x in t for x in ("おすすめ", "買うべき", "利回り", "贈与", "税金", "どの証券", "私の場合", "うちの場合")):
        return None
    if any(x in t for x in ("もう買える", "いつ買える", "投資できる", "いつから買える")):
        return "ご質問ありがとうございます。2026年10月に一部で始まったのは事前申込です。制度開始は2027年1月予定で、受付方法は金融機関ごとに異なります。最新の案内をご確認ください。"
    if "60万" in t and any(x in t for x in ("必ず", "必要", "満額", "全部", "毎年")):
        return "ご質問ありがとうございます。年間60万円は投資枠の上限で、必ず使う金額ではありません。教育費を使う時期と家計を先に確認してください。投資には元本割れの可能性があります。"
    return None


def rows():
    if not LOG.exists():
        return []
    with LOG.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def append_row(root_id, reply_id, posted_id, permalink):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    fresh = not LOG.exists()
    with LOG.open("a", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        if fresh:
            writer.writerow(("posted_at_utc", "root_id", "reply_id", "posted_id", "permalink"))
        writer.writerow((dt.datetime.now(dt.timezone.utc).isoformat(), root_id, reply_id, posted_id, permalink))


def run(post):
    now = dt.datetime.now(dt.timezone.utc)
    if now.date() >= dt.date(2027, 1, 1):
        raise RuntimeError("The 2026 FAQ responses expired; update them before using the bot in 2027")
    history = rows()
    done_ids = {x.get("reply_id") for x in history}
    posted_today = sum(x.get("posted_at_utc", "").startswith(now.date().isoformat()) for x in history)
    if posted_today >= DAILY_LIMIT:
        print("Daily auto-reply limit reached")
        return
    roots = api(f"/{USER_ID}/threads?fields=id,has_replies,text&limit=20").get("data", [])
    candidates = []
    for root in roots:
        if not root.get("has_replies") or "NISA" not in root.get("text", "").upper():
            continue
        root_id = root["id"]
        query = urllib.parse.urlencode({"fields": "id,text,username,is_reply_owned_by_me,replied_to,timestamp", "limit": 100})
        conversation = api(f"/{root_id}/conversation?{query}").get("data", [])
        answered_ids = {str(x.get("replied_to", {}).get("id")) for x in conversation if x.get("is_reply_owned_by_me")}
        for item in conversation:
            reply_id = str(item.get("id", ""))
            if not reply_id or item.get("is_reply_owned_by_me") or reply_id in done_ids or reply_id in answered_ids:
                continue
            if str(item.get("replied_to", {}).get("id", "")) != root_id:
                continue
            response = answer(item.get("text", ""))
            if response:
                candidates.append((root_id, reply_id, response))
    remaining = max(0, DAILY_LIMIT - posted_today)
    for root_id, reply_id, response in candidates[:remaining]:
        if not post:
            print(json.dumps({"mode": "dry-run", "root_id": root_id, "reply_id": reply_id, "response": response}, ensure_ascii=False))
            continue
        created = api(f"/{USER_ID}/threads", {"media_type": "TEXT", "text": response, "reply_to_id": reply_id})
        creation_id = created.get("id")
        if not creation_id:
            raise RuntimeError("Reply container ID was missing")
        published = api(f"/{USER_ID}/threads_publish", {"creation_id": creation_id})
        posted_id = published.get("id")
        if not posted_id:
            raise RuntimeError("Reply publication ID was missing; inspect Threads before retrying")
        permalink = api(f"/{posted_id}?fields=permalink").get("permalink", "")
        append_row(root_id, reply_id, posted_id, permalink)
        print(json.dumps({"mode": "posted", "reply_id": reply_id, "permalink": permalink}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--post", action="store_true", help="Publish reviewed FAQ replies; default is dry-run")
    args = parser.parse_args()
    try:
        run(args.post)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


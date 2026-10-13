#!/usr/bin/env python3
"""Screen recent public Threads questions and answer two reviewed NISA FAQs.

Uses Claude's network secret for graph.threads.net. Dry-run is the default.
Requires a token with public threads_keyword_search, threads_read_replies and
threads_content_publish. Never replies to posts by our account or adds links.
"""

import argparse
import csv
import datetime as dt
import json
import pathlib
import sys
import urllib.parse

from threads_autoreply import API, USER_ID, answer, api

REPO = pathlib.Path(__file__).resolve().parents[1]
LOG = REPO / "records" / "threads_discovery_replies.csv"
OWN_USERNAME = "flysheep59"
QUERIES = ("こどもNISA", "子どもNISA")
JST = dt.timezone(dt.timedelta(hours=9))
MAX_PER_DAY = 2
RECENT_HOURS = 6


def parse_time(value):
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else None
    except (ValueError, AttributeError):
        return None


def read_log():
    if not LOG.exists():
        return []
    with LOG.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def write_log(post_id, author, reply_id, permalink):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    fresh = not LOG.exists()
    with LOG.open("a", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        if fresh:
            writer.writerow(("posted_at_utc", "post_id", "author", "reply_id", "permalink"))
        writer.writerow((dt.datetime.now(dt.timezone.utc).isoformat(), post_id, author, reply_id, permalink))


def candidates(now, rows, own_targets, search_results):
    done_ids = {row.get("post_id") for row in rows} | own_targets
    recent_authors = {
        row.get("author", "").lower()
        for row in rows
        if (stamp := parse_time(row.get("posted_at_utc", ""))) and now - stamp < dt.timedelta(days=7)
    }
    found = {}
    for item in search_results:
        post_id = str(item.get("id", ""))
        author = (item.get("username") or "").lower()
        message = item.get("text") or ""
        stamp = parse_time(item.get("timestamp", ""))
        if not post_id or not author or author == OWN_USERNAME or author in recent_authors:
            continue
        if post_id in done_ids or item.get("has_replies") is True:
            continue
        if not stamp or not dt.timedelta(0) <= now - stamp <= dt.timedelta(hours=RECENT_HOURS):
            continue
        if "NISA" not in message.upper() or not any(mark in message for mark in ("?", "？", "教えて", "どうなの")):
            continue
        if "http" in message.lower() or "#PR" in message.upper():
            continue
        response = answer(message)
        if response:
            found[post_id] = (item, response)
    return sorted(found.values(), key=lambda entry: entry[0].get("timestamp", ""), reverse=True)


def run(post):
    now = dt.datetime.now(dt.timezone.utc)
    if now.date() >= dt.date(2027, 1, 1):
        raise RuntimeError("2026 NISA answers expired; review official information before restarting")
    rows = read_log()
    today_jst = now.astimezone(JST).date()
    count_today = sum(
        (stamp := parse_time(row.get("posted_at_utc", ""))) is not None and stamp.astimezone(JST).date() == today_jst
        for row in rows
    )
    if count_today >= MAX_PER_DAY:
        print("Daily public-reply limit reached")
        return
    recent_replies = api(f"/{USER_ID}/replies?fields=id,replied_to&limit=100").get("data", [])
    own_targets = {str((x.get("replied_to") or {}).get("id")) for x in recent_replies}
    results = []
    for query in QUERIES:
        params = urllib.parse.urlencode({"q": query, "search_type": "RECENT", "fields": "id,text,username,permalink,timestamp,has_replies", "limit": 50})
        results += api(f"/keyword_search?{params}").get("data", [])
    if results and not any((item.get("username") or "").lower() != OWN_USERNAME for item in results):
        raise RuntimeError("Only our own posts were searchable; verify public keyword-search approval")
    selected = candidates(now, rows, own_targets, results)
    if not selected:
        print("No recent, clearly answerable public questions")
        return
    used_authors = set()
    for item, response in selected:
        if len(used_authors) >= MAX_PER_DAY - count_today:
            break
        author = item["username"].lower()
        if author in used_authors:
            continue
        used_authors.add(author)
        post_id = str(item["id"])
        if not post:
            print(json.dumps({"mode": "dry-run", "post_id": post_id, "author": author, "post_url": item.get("permalink"), "response": response}, ensure_ascii=False))
            continue
        # Re-read the target immediately before replying; a changed/deleted post is skipped.
        latest = api(f"/{post_id}?fields=id,text,username,timestamp,has_replies")
        if latest.get("text") != item.get("text") or latest.get("has_replies") is True:
            continue
        created = api(f"/{USER_ID}/threads", {"media_type": "TEXT", "text": response, "reply_to_id": post_id})
        creation_id = created.get("id")
        if not creation_id:
            raise RuntimeError("Reply container ID missing")
        published = api(f"/{USER_ID}/threads_publish", {"creation_id": creation_id})
        reply_id = published.get("id")
        if not reply_id:
            raise RuntimeError("Reply publication uncertain; inspect Threads before retrying")
        permalink = api(f"/{reply_id}?fields=permalink").get("permalink", "")
        write_log(post_id, author, reply_id, permalink)
        print(json.dumps({"mode": "posted", "post_id": post_id, "reply_url": permalink}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--post", action="store_true", help="Publish eligible replies; default is dry-run")
    args = parser.parse_args()
    try:
        run(args.post)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


#!/bin/bash
# Threadsに1件投稿して records/posts.csv に記録する。
# 使い方: scripts/threads_post.sh "<投稿文>" [画像.png または afe-assets の公開画像URL] [トピック]
# 前提: 環境のネットワークシークレットでトークンが自動で付く（ここでは扱わない）。
#       画像つきは /home/user/afe-assets（公開リポジトリ）をクローン済みであること。
# 呼ぶのは、検品に合格した投稿だけ。
set -euo pipefail
TEXT="${1:?投稿文が必要}"; IMG="${2:-}"; TOPIC="${3:-}"
UID_="29526192993649084"; API="https://graph.threads.net/v1.0"
REPO="$(cd "$(dirname "$0")/.." && pwd)"; ASSETS="/home/user/afe-assets"
# 二重投稿の防止：直近の投稿に、同じ書き出し（先頭30字）があれば、投稿せず終了する
RECENT=$(curl -sS -m 20 "$API/$UID_/threads?fields=text&limit=25" || true)
if echo "$RECENT" | python3 -c "import sys,json;t=sys.argv[1][:30];d=json.load(sys.stdin).get('data',[]);sys.exit(0 if any((p.get('text') or '')[:30]==t for p in d) else 1)" "$TEXT" 2>/dev/null; then echo "同じ書き出しの投稿が直近にあるため、投稿しません（二重投稿の防止）"; exit 6; fi
URL=""
if [ -n "$IMG" ]; then
  if [[ "$IMG" == https://raw.githubusercontent.com/takochi92/afe-assets/main/images/* ]]; then
    URL="$IMG"
  else
    [ -f "$IMG" ] || { echo "画像ファイルがありません: $IMG"; exit 2; }
    [ -d "$ASSETS/.git" ] || { echo "afe-assets がありません"; exit 2; }
    D=$(date -u +%Y-%m-%d); N="$(date -u +%H%M%S)-$(basename "$IMG")"
    mkdir -p "$ASSETS/images/$D"; cp "$IMG" "$ASSETS/images/$D/$N"
    git -C "$ASSETS" add -A
    git -C "$ASSETS" -c user.name=takochi92 -c user.email=kotaro.0218777@gmail.com commit -q -m "画像を追加: $D/$N"
    git -C "$ASSETS" push -q origin main
    URL="https://raw.githubusercontent.com/takochi92/afe-assets/main/images/$D/$N"
    for i in 1 2 3 4 5 6; do [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = 200 ] && break; sleep 3; done
  fi
  [ "$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "$URL")" = 200 ] || { echo "画像URLを取得できません: $URL"; exit 2; }
fi
j() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }
ARGS=(--data-urlencode "text=$TEXT")
if [ -n "$TOPIC" ]; then ARGS+=(--data-urlencode "topic_tag=$TOPIC"); fi
if [ -n "$URL" ]; then
  C=$(curl -sS -m 30 -X POST "$API/$UID_/threads" --data-urlencode media_type=IMAGE --data-urlencode "image_url=$URL" "${ARGS[@]}")
else
  C=$(curl -sS -m 30 -X POST "$API/$UID_/threads" --data-urlencode media_type=TEXT "${ARGS[@]}")
fi
CID=$(echo "$C" | j id); [ -n "$CID" ] || { echo "作成に失敗: $C"; exit 3; }
for i in 1 2 3 4 5 6 7 8; do
  S=$(curl -sS -m 20 "$API/$CID?fields=status,error_message" | j status)
  [ "$S" = FINISHED ] && break; [ "$S" = ERROR ] && { echo "処理エラー"; exit 4; }; sleep 5
done
P=$(curl -sS -m 30 -X POST "$API/$UID_/threads_publish" --data-urlencode "creation_id=$CID")
MID=$(echo "$P" | j id); [ -n "$MID" ] || { echo "公開に失敗: $P"; exit 5; }
PL=$(curl -sS -m 20 "$API/$MID?fields=permalink" | j permalink)
python3 - "$REPO/records/posts.csv" "$MID" "$PL" "$URL" "$TEXT" <<'PY'
import csv,sys,datetime
f,mid,pl,url,text=sys.argv[1:6]
new=not __import__('os').path.exists(f)
with open(f,'a',newline='') as fh:
    w=csv.writer(fh)
    if new: w.writerow(['posted_at_utc','media_id','permalink','image_url','text'])
    w.writerow([datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),mid,pl,url,text])
PY
echo "投稿しました: $PL"


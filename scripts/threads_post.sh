#!/bin/bash
# Threadsに1件投稿して records/posts.csv に記録する。
# 使い方: scripts/threads_post.sh "<投稿文>" [画像.png]
# 前提: 環境のネットワークシークレットでトークンが自動で付く（ここでは扱わない）。
#       画像つきは /home/user/afe-assets（公開リポジトリ）をクローン済みであること。
# 呼ぶのは、検品に合格した投稿だけ。
set -euo pipefail
TEXT="${1:?投稿文が必要}"; IMG="${2:-}"
UID_="29526192993649084"; API="https://graph.threads.net/v1.0"
REPO="$(cd "$(dirname "$0")/.." && pwd)"; ASSETS="/home/user/afe-assets"
URL=""
if [ -n "$IMG" ]; then
  [ -d "$ASSETS/.git" ] || { echo "afe-assets がありません"; exit 2; }
  D=$(date -u +%Y-%m-%d); N="$(date -u +%H%M%S)-$(basename "$IMG")"
  mkdir -p "$ASSETS/images/$D"; cp "$IMG" "$ASSETS/images/$D/$N"
  git -C "$ASSETS" add -A
  git -C "$ASSETS" -c user.name=takochi92 -c user.email=kotaro.0218777@gmail.com commit -q -m "画像を追加: $D/$N"
  git -C "$ASSETS" push -q origin main
  URL="https://raw.githubusercontent.com/takochi92/afe-assets/main/images/$D/$N"
  for i in 1 2 3 4 5 6; do [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" = 200 ] && break; sleep 3; done
fi
j() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }
if [ -n "$URL" ]; then
  C=$(curl -sS -m 30 -X POST "$API/$UID_/threads" --data-urlencode media_type=IMAGE --data-urlencode "image_url=$URL" --data-urlencode "text=$TEXT")
else
  C=$(curl -sS -m 30 -X POST "$API/$UID_/threads" --data-urlencode media_type=TEXT --data-urlencode "text=$TEXT")
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

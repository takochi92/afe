#!/bin/bash
# Instagramに1件投稿（1枚または複数枚）して records/ig_posts.csv に記録する。【未テスト】
# 使い方: scripts/instagram_post.sh "<キャプション>" <画像.jpg または afe-assets の公開画像URL> ... （画像は1〜10枚、JPEG）
# 前提: 環境のネットワークシークレット（INSTAGRAM_ACCESS_TOKEN、graph.instagram.com 宛てに Authorization: Bearer が自動で付く）。
#       画像は /home/user/afe-assets（公開リポジトリ）をクローン済みであること。呼ぶのは、検品に合格した投稿だけ。
set -euo pipefail
CAP="${1:?キャプションが必要}"; shift; [ "$#" -ge 1 ] && [ "$#" -le 10 ] || { echo "画像は1〜10枚"; exit 2; }
VER="${IG_API_VERSION:-v23.0}"; API="https://graph.instagram.com/$VER"
REPO="$(cd "$(dirname "$0")/.." && pwd)"; ASSETS="/home/user/afe-assets"; D=$(date -u +%Y-%m-%d); T=$(date -u +%H%M%S)
j() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }
# 二重投稿の防止：直近の投稿に、同じ書き出し（キャプション先頭30字）があれば、投稿せず終了する
IGID=$(curl -sS -m 20 "$API/me?fields=user_id" | j user_id 2>/dev/null || true)
if [ -n "${IGID:-}" ]; then
  RECENT=$(curl -sS -m 20 "$API/$IGID/media?fields=caption&limit=25" || true)
  if echo "$RECENT" | python3 -c "import sys,json;t=sys.argv[1][:30];d=json.load(sys.stdin).get('data',[]);sys.exit(0 if any((p.get('caption') or '')[:30]==t for p in d) else 1)" "$CAP" 2>/dev/null; then echo "同じ書き出しの投稿が直近にあるため、投稿しません（二重投稿の防止）"; exit 6; fi
fi
# 1) 公開済みURLはそのまま使い、ローカル画像だけ公開リポジトリに保存する
URLS=(); NEED_PUSH=0
for f in "$@"; do
  if [[ "$f" == https://raw.githubusercontent.com/takochi92/afe-assets/main/images/*.jpg ]]; then
    URLS+=("$f")
  else
    [ -f "$f" ] || { echo "画像ファイルがありません: $f"; exit 2; }
    [ -d "$ASSETS/.git" ] || { echo "afe-assets がありません"; exit 2; }
    mkdir -p "$ASSETS/images/$D/ig-$T"
    n=$(basename "$f"); cp "$f" "$ASSETS/images/$D/ig-$T/$n"
    URLS+=("https://raw.githubusercontent.com/takochi92/afe-assets/main/images/$D/ig-$T/$n")
    NEED_PUSH=1
  fi
done
if [ "$NEED_PUSH" -eq 1 ]; then
  git -C "$ASSETS" add -A; git -C "$ASSETS" -c user.name=takochi92 -c user.email=kotaro.0218777@gmail.com commit -q -m "Instagram用の画像を追加: $D/ig-$T"; git -C "$ASSETS" push -q origin main
fi
for u in "${URLS[@]}"; do
  for i in 1 2 3 4 5 6; do [ "$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "$u")" = 200 ] && break; sleep 3; done
  [ "$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "$u")" = 200 ] || { echo "画像URLを取得できません: $u"; exit 2; }
done
# 2) アカウントidを取得
ME=$(curl -sS -m 20 "$API/me?fields=user_id,username"); IG=$(echo "$ME" | j user_id); [ -n "$IG" ] || { echo "アカウント取得に失敗: $ME"; exit 3; }
wait_ready() { for i in $(seq 1 12); do S=$(curl -sS -m 20 "$API/$1?fields=status_code" | j status_code); [ "$S" = FINISHED ] && return 0; [ "$S" = ERROR ] && { echo "処理エラー: $1"; return 1; }; sleep 5; done; return 1; }
if [ "${#URLS[@]}" -eq 1 ]; then
  C=$(curl -sS -m 30 -X POST "$API/$IG/media" --data-urlencode "image_url=${URLS[0]}" --data-urlencode "caption=$CAP"); CID=$(echo "$C" | j id)
else
  KIDS=()
  for u in "${URLS[@]}"; do K=$(curl -sS -m 30 -X POST "$API/$IG/media" --data-urlencode "image_url=$u" --data-urlencode "is_carousel_item=true"); KID=$(echo "$K" | j id); [ -n "$KID" ] || { echo "子の作成に失敗: $K"; exit 4; }; KIDS+=("$KID"); done
  for k in "${KIDS[@]}"; do wait_ready "$k"; done
  CH=$(IFS=,; echo "${KIDS[*]}")
  C=$(curl -sS -m 30 -X POST "$API/$IG/media" --data-urlencode "media_type=CAROUSEL" --data-urlencode "children=$CH" --data-urlencode "caption=$CAP"); CID=$(echo "$C" | j id)
fi
[ -n "$CID" ] || { echo "コンテナの作成に失敗: $C"; exit 5; }
wait_ready "$CID" || { echo "コンテナが準備できません"; exit 6; }
# 3) 公開して記録
P=$(curl -sS -m 30 -X POST "$API/$IG/media_publish" --data-urlencode "creation_id=$CID"); MID=$(echo "$P" | j id); [ -n "$MID" ] || { echo "公開に失敗: $P"; exit 7; }
PL=$(curl -sS -m 20 "$API/$MID?fields=permalink" | j permalink)
python3 - "$REPO/records/ig_posts.csv" "$MID" "$PL" "${#URLS[@]}" "$CAP" <<'PY'
import csv,sys,os,datetime
f,mid,pl,n,cap=sys.argv[1:6]; new=not os.path.exists(f)
with open(f,'a',newline='') as fh:
    w=csv.writer(fh)
    if new: w.writerow(['posted_at_utc','media_id','permalink','images','caption'])
    w.writerow([datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),mid,pl,n,cap])
PY
echo "投稿しました: $PL"


# マイ金庫（自宅サーバー同期版）

ブラウザ内で暗号化する自作パスワード管理。自宅サーバーは**暗号文を預かるだけ**で、復号はできません。

## 構成
- `index.html` … 画面と暗号処理（AES-256-GCM / PBKDF2 60万回）。単体でも動く（同期なし）
- `server/server.py` … 同期サーバー（標準ライブラリのみ）。`GET/PUT /vault`、トークン認証、版管理、保存のたびに世代バックアップ（既定60世代）
- `docker-compose.yml` / `Dockerfile` … 常駐用。`127.0.0.1:8080` にだけ待ち受け
- `backup-offsite.sh` … 暗号化済みファイルを別の場所へコピー（rclone）

## セットアップ（homesv で）
```sh
cd tools/vault
echo "VAULT_TOKEN=$(openssl rand -hex 24)" > .env     # この値が「同期トークン」。控えておく
docker compose up -d --build
sudo tailscale serve --bg --https=443 http://127.0.0.1:8080   # tailnet 内だけに https で公開
```
- ※ `tailscale serve` は tailnet の管理画面で **HTTPS Certificates を有効化**しておく必要がある。**Funnel は使わない**
- ブラウザの暗号機能は https（または localhost）でしか動かないため、この手順が必要
- 各端末で `https://homesv.<tailnet名>.ts.net/` を開き、同期トークンを入力 → マスターパスワードで金庫を作成／開く
- 2台目以降は、トークンを入れてから同じマスターパスワードで開く

## バックアップ（最初から入れる）
1. サーバー側: `data/vault.json` と `data/backups/`（直近60世代）
2. 別の場所へ: `rclone config` で Drive 等を設定し、cron に `backup-offsite.sh` を登録（中身は暗号文なので外に置いても読めない）
3. 画面の「バックアップ」ボタンで手元に書き出すのも併用

## 仕組みと限界
- 保存のたびに版番号つきで送信。別端末と同時に編集した場合は、項目ごとに新しい方を採用して合流
- 端末が圏外のときは手元に保存し、次の保存時に同期
- シークレットキーなし。守りの要はマスターパスワード（12文字以上必須、長い文章を推奨）
- 同期トークンが漏れても、暗号文を上書き・削除はされうる（読むことは不可）。世代バックアップから戻せる
- 第三者監査は受けていない

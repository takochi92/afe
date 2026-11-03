#!/bin/sh
# 暗号化済みの金庫ファイルを別の場所へコピーする（中身はマスターパスワードなしでは読めない）。
# 使い方: RCLONE_REMOTE=mydrive:vault-backup ./backup-offsite.sh   （rclone config 済みであること）
# cron例: 17 3 * * * cd /path/to/tools/vault && RCLONE_REMOTE=mydrive:vault-backup ./backup-offsite.sh
set -eu
: "${RCLONE_REMOTE:?RCLONE_REMOTE を指定してください}"
rclone copy "$(dirname "$0")/data" "$RCLONE_REMOTE" --include "vault.json" --include "backups/**"

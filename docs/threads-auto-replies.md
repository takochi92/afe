# Threads 質問への定時検索・自動返信

対象: `flysheep59` 自身の「こどもNISA」投稿についた直接の返信、および公開検索で見つけた他人の「こどもNISA／子どもNISA」の新しい疑問投稿。DMは対象外。

## できること

- `scripts/threads_autoreply.py` は直近20件の自分の投稿と、その会話をThreads APIで読む。
- 「もう買える／いつ買える」と「年間60万円を必ず使うのか」の明確な質問だけに、検品済みの定型文を1回返す。
- 個別の商品選択、税、贈与、利回り、家庭ごとの判断は自動返信しない。
- 1日最大3件。既に自分が答えた返信と `records/threads_auto_replies.csv` にある返信は飛ばす。2027年1月以降は文面の再確認まで停止。
- 初期状態は表示のみ。`python3 scripts/threads_autoreply.py` で候補を確認し、権限と動作を確かめた後に限り `--post` で送信する。
- `scripts/threads_discovery_reply.py` は定時に公開投稿を新着検索する。直近6時間で、質問文が明確で、検品済みの2種類のFAQに正確に該当するものだけを対象にする。リンクや宣伝文は返信に含めない。
- 他人の投稿への返信は1日最大2件、同一作者へは7日で1回まで。既に返信がある投稿、自分の投稿、更新・削除された投稿、個別の投資判断や税の質問を除く。本人の最近の返信履歴と記録ファイルで二重返信を防ぐ。

## 稼働前に必要なこと

1. MetaのThreadsアプリと現在のトークンで、`threads_basic`、`threads_content_publish`、`threads_read_replies`、`threads_keyword_search` が実際に使えるか確認する。返信管理の権限 `threads_manage_replies` も必要な操作では有効にする。既存の記録は `threads_basic` と `threads_content_publish` のみ。オーナーは2026-10-13に自動返信の運用を許可したが、Meta API側の追加スコープが実際に有効かは未確認。
2. 権限を追加した場合は、トークンを再認可し、Claude環境の既存ネットワークシークレットを更新する。トークンをチャットやリポジトリに貼らない。
3. Claude環境で下書きモードの `python3 scripts/threads_autoreply.py` と `python3 scripts/threads_discovery_reply.py` を実行し、権限エラーがなく、候補が正確か確認する。公開検索で自分の投稿しか出ない場合はアプリ承認を確認し、他人への返信は行わない。
4. 既存のThreads定時起動（8:07、10:23、12:26、15:37、19:41 JST）に両スクリプトの `--post` 実行を組み込む。各スクリプトは条件に合うものがなければ何も投稿しない。投稿後の記録ファイルをブランチにコミットし、公開URLと返信先を確認する。

## API出典

- Meta公式Threads API Postmanコレクション: https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- 返信の取得: `GET /{thread_id}/conversation`
- 返信の作成: `POST /{user_id}/threads` に `reply_to_id` を付け、作成されたコンテナを公開する
- 公開投稿の検索: `GET /keyword_search?q=...&search_type=RECENT`（`threads_keyword_search`。Metaのアプリ審査状態によっては、自分の投稿しか検索できないため、その場合は外部投稿への返信を停止）


# Threads 質問への自動返信（準備中）

対象: `flysheep59` 自身の「こどもNISA」投稿についた直接の返信だけ。他人の投稿やDMへは送らない。

## できること

- `scripts/threads_autoreply.py` は直近20件の自分の投稿と、その会話をThreads APIで読む。
- 「もう買える／いつ買える」と「年間60万円を必ず使うのか」の明確な質問だけに、検品済みの定型文を1回返す。
- 個別の商品選択、税、贈与、利回り、家庭ごとの判断は自動返信しない。
- 1日最大3件。既に自分が答えた返信と `records/threads_auto_replies.csv` にある返信は飛ばす。2027年1月以降は文面の再確認まで停止。
- 初期状態は表示のみ。`python3 scripts/threads_autoreply.py` で候補を確認し、権限と動作を確かめた後に限り `--post` で送信する。

## 稼働前に必要なこと

1. MetaのThreadsアプリに、返信を読む権限 `threads_read_replies` があるか確認する。返信管理の権限 `threads_manage_replies` も必要な操作では有効にする。既存の記録には `threads_basic` と `threads_content_publish` のみが記載されている。
2. 権限を追加した場合は、トークンを再認可し、Claude環境の既存ネットワークシークレットを更新する。トークンをチャットやリポジトリに貼らない。
3. Claude環境で下書きモードを実行し、権限エラーがなく、候補が正確か確認する。
4. 投稿モードの実行後、記録ファイルをブランチにコミットし、公開URLと返信先を確認する。定期起動を追加するのはこの確認後。

## API出典

- Meta公式Threads API Postmanコレクション: https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api
- 返信の取得: `GET /{thread_id}/conversation`
- 返信の作成: `POST /{user_id}/threads` に `reply_to_id` を付け、作成されたコンテナを公開する


# Threads自動投稿の準備状況

最終更新: 2026-10-11

## オーナーの許可（2026-10-11、チャットで直接）
- Threads（アカウント flysheep59）への投稿は、**今後は自動投稿を許可**する（オーナーの言葉：「今後は自動投稿許可」）
- 範囲：下のルールを満たす投稿に限る。ルールを満たさない投稿、または新しい種類の操作（リンクの掲載、他のSNS、有料の操作、アカウント設定の変更）は、都度オーナーに確認する
- テスト投稿は成功（2026-10-11 02:54 UTC）。https://www.threads.com/@flysheep59/post/DeVofVloIy6

## 状況
- Meta for Developers: アプリ「Flysheep」を作成済み。ユースケース「Threads APIにアクセス」を追加
- 許可: `threads_basic`、`threads_content_publish` が「テスト準備完了」。アプリは未公開（開発モード）のままにする。アプリレビューには出さない（投稿するのは自分のアカウントだけ）
- テスター: Threadsアカウント `flysheep59` をThreadsテスターに追加し、Threads側で招待を承認済み
- 長期アクセストークン: 生成済み。環境の「ネットワークシークレット」に登録した（変数名の想定は `THREADS_ACCESS_TOKEN`）。**値は誰にも見せない・チャットや記事、リポジトリに書かない**
- ネットワーク: `graph.threads.net` に通る。トークンは環境のネットワークシークレットとして、通信時に自動で付く（`Authorization: Bearer`）。**値は私たちからは見えない**
- Threadsのユーザーid: 29526192993649084（username: flysheep59）

## 完了したこと
- テスト投稿（文字）、テスト投稿（画像つき）が成功。画像の公開先は `takochi92/afe-assets`（公開リポジトリ）の `images/<日付>/`
- 部品: `scripts/make_card.js`（図解画像）、`scripts/threads_post.sh`（投稿・記録）
- 毎日の手順: `docs/daily-sns-routine.md`

## 次にやること（古いメモ。1と2は完了）
1. 接続テスト: `graph.threads.net` に届くか。トークンが使えるか（`GET /v1.0/me?fields=id,username`）。ユーザーIDを取得して控える
2. テスト投稿を1件だけ。**内容をオーナーに見せて許可をもらってから**出す
3. 画像つき投稿: 画像は公開URLが必要。置き場所を決める（公開用リポジトリなど）
4. 毎日の自動投稿（承認制 → 品質が安定したら完全自動）。承認は会社サイトのページで行う
5. 長期トークンは約60日で切れる。切れる前の更新（`refresh_access_token`）を自動化する

## 投稿の手順（API）
- 文字だけ: `POST /v1.0/<user-id>/threads`（`media_type=TEXT`, `text=...`）→ 返ってきた id で `POST /v1.0/<user-id>/threads_publish`（`creation_id=...`）
- 画像: `media_type=IMAGE`, `image_url=<公開URL>`。公開URLの置き場所は未決
- 取得: `GET /v1.0/<media-id>?fields=id,permalink,text,timestamp`
- ヘッダーは付けない（プロキシが自動で付ける）

## ルール
- **自動投稿してよいのは、検品部（inspector）が合格にしたものだけ**。検品の記録は `reviews/` に残す
- 投稿した内容・時刻・URLは、記録部が `records/` に記録する
- 1日の投稿数の上限は3件（オーナーの「じゃんじゃん投稿可能」の指示、2026-10-11。最初は2件だった）。同じ内容の繰り返しはしない。スパム扱いを避けるため
- 「どうなるか分からない」「規約や法令の判断に迷う」投稿は出さず、オーナーに確認する
- 投稿は検品に合格したものだけ。PR表記、金融の注意（外務行為の禁止、断定表現の禁止）は `docs/compliance.md` に従う
- アフィリエイトリンクを直接Threadsに貼る前に、各ASPと広告主の掲載可否を確認する（`sales/programs.md`）

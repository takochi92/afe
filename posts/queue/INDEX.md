# 投稿ストック（Threads）

毎朝の自動投稿は、この表の「使える」ものから1件ずつ使う。使ったら「投稿済み」にURLを書く。
**使える条件**：検品が合格。公式確認は、オーナーが「許可したことにしてくれ。じゃんじゃん投稿可能」と指示した（2026-10-11）ため、**待たずに調査資料の内容で使ってよい**。公式サイトが開けたら、その時点で確認して、食い違いがあれば直す。**例外：02（贈与税）は、監修が決まるまで使わない（オーナー指示：監修は保留）。**

| 番号 | 題材 | 検品 | 公式確認 | 投稿済み |
|---|---|---|---|---|
| 01 | 親の口座が別の会社 | 合格（再検品の軽微修正を反映済み） | 省略（オーナー承認。後で公式を確認） | 2026-10-12 https://www.threads.com/@flysheep59/post/DeYJX8HIPFs |
| 02 | 祖父母が出すとき | 合格 | **使わない（税の話。監修が決まるまで保留）** | |
| 03 | きょうだいが2人以上 | 合格（再検品済み） | 省略（オーナー承認。後で公式を確認） | 2026-10-12 https://www.threads.com/@flysheep59/post/DeX4bY3iUO1 |
| 04 | ジュニアNISAとの違い | 修正済み（使う前に、検品部が軽く確認する） | 省略（オーナー承認。後で公式を確認） | 2026-10-12 https://www.threads.com/@flysheep59/post/DeYRFFHnEQD |
| 05 | 12歳からの払出し | 合格（再検品済み） | 省略（オーナー承認。後で公式を確認） | 2026-10-12 https://www.threads.com/@flysheep59/post/DeYnCLRHNgH |
| 06 | 児童手当を積み立てる | 合格 | 不要（制度の数字を使わない一般的な注意） | 2026-10-11 https://www.threads.com/@flysheep59/post/DeWVWanm0tV |
| 07 | 18歳になったら | 合格 | 省略（オーナー承認。後で公式を確認） | 2026-10-12 https://www.threads.com/@flysheep59/post/DeYDMIgoDs5 |
| 08 | 申込開始＝もう買える？（図解） | 合格（reviews/kodomo-nisa-jizen-2026-10-14.md） | 済（金融庁・SBI証券・マネックス証券） | 2026-10-17 https://www.threads.com/@flysheep59/post/Dek7EezlA87 |
| 09 | 事前申込前の3点チェック | 合格（reviews/kodomo-nisa-growth-2026-10-13.md） | 済（金融庁・マネックス証券） | 2026-10-18 https://www.threads.com/@flysheep59/post/DenQO4PmAA9 |
| 10 | 年間60万円は目標ではない | 合格（reviews/kodomo-nisa-growth-2026-10-13.md） | 済（金融庁） | 未投稿 |
| 11 | 0〜17歳はつみたて投資枠のみ | 合格（reviews/sns-2026-10-17-tsumitate-only.md） | 済（金融庁・財務省） | 2026-10-17 https://www.threads.com/@flysheep59/post/DelJGGvFW4S |
| 12 | 年間60万円・600万円は買った金額で数える | 合格（reviews/sns-2026-10-17-kaiire-base.md、2回目） | 済（財務省の大綱） | 2026-10-17 https://www.threads.com/@flysheep59/post/DelfBLknNPw |
| 13 | こどもNISAの法律は成立済み | 合格（reviews/sns-2026-10-17-law-passed.md） | 済（財務省・金融庁） | 2026-10-17 https://www.threads.com/@flysheep59/post/Del6_tzFWi1 |

## 使い方
- 投稿文は各ファイルの「## 投稿文」の節だけを使う（冒頭の「修正済み」の行は使わない）
- 画像は `scripts/make_card.js` で、各ファイルの「## カード」の1行JSONから作る。08〜10は画像が公開済みのため、各ファイルの画像URLを `scripts/threads_post.sh` の第2引数にそのまま渡す。第3引数にトピック `こどもNISA` を渡す
- 公式確認の対象ドメイン（fsa.go.jp / mof.go.jp / nta.go.jp / caa.go.jp）は、環境のネットワーク設定で許可すると、私が直接確認できる

次の優先候補: 08 → 09 → 10。08のInstagram原稿は `posts/ig/2026-10-14-kodomo-nisa-jizen.md`。Threads原稿は順に `posts/queue/2026-10-14-kodomo-nisa-jizen.md`、`posts/queue/2026-10-15-kodomo-nisa-checklist.md`、`posts/queue/2026-10-16-kodomo-nisa-60man.md`。08・09・10は同日にまとめて出さず、各題材の間を1日以上空ける。投稿前に records とアカウントの直近投稿で重複・制度の更新を確認し、上限内で出す。投稿後に公開URLを表へ記録する。各原稿のリンクはThreadsからブログへの流入を識別するためのもの。

投稿後の24時間・72時間の確認と改善手順は `docs/kodomo-nisa-growth-runbook.md`。

旧ストックの推奨順: 06 → 03 → 07 → 01 → 04 → 05（02は保留）。使えるものが尽きたら、リサーチ資料から新しく作る（手順は docs/daily-sns-routine.md）。

